export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();

    // Suporta múltiplos arquivos mas processa apenas os primeiros 2
    // para evitar timeout (base64 de imagens é muito pesado)
    const arquivos = body.arquivos
      ? body.arquivos.slice(0, 2) // máx 2 arquivos para não dar timeout
      : body.fileB64
        ? [{ b64: body.fileB64, mediaType: body.mediaType || "image/jpeg", fileType: body.fileType || "image", nome: "documento" }]
        : [];

    if (arquivos.length === 0) {
      return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Chave de API nao configurada." }, { status: 500 });
    }

    const { historicoPenalidade, perfil, veiculo } = body;

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
    });

    const dadosRecorrente = [
      perfil?.nome     && `Nome: ${perfil.nome}`,
      perfil?.cpf      && `CPF: ${perfil.cpf}`,
      perfil?.rg       && `RG: ${perfil.rg}`,
      perfil?.endereco && `Endereco: ${perfil.endereco}`,
      perfil?.cidade   && `Cidade: ${perfil.cidade}`,
      perfil?.uf       && `UF: ${perfil.uf}`,
      perfil?.cep      && `CEP: ${perfil.cep}`,
      perfil?.telefone && `Telefone: ${perfil.telefone}`,
      perfil?.cnh      && `CNH: ${perfil.cnh}`,
      veiculo?.placa   && `Placa: ${veiculo.placa}`,
      veiculo?.modelo  && `Modelo: ${veiculo.modelo}`,
      veiculo?.renavam && `RENAVAM: ${veiculo.renavam}`,
    ].filter(Boolean).join("\n");

    const historicoTexto = historicoPenalidade
      ? `\nHISTORICO DO CONDUTOR: "${historicoPenalidade}"`
      : "";

    // Modelos — ordem de preferência
    const MODELOS = [
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ];

    const chamarAPI = async (modelo, content, maxTokens) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: modelo, max_tokens: maxTokens, messages: [{ role: "user", content }] })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 150)}`);
      }
      const data = await res.json();
      return data.content?.find(b => b.type === "text")?.text || "";
    };

    const montarBloco = (arq) => ({
      type: arq.fileType === "pdf" ? "document" : "image",
      source: { type: "base64", media_type: arq.mediaType, data: arq.b64 }
    });

    // ── PASSO 1: Extrair dados de todos os arquivos de uma vez ─
    const promptExtracao = `Analise os documentos enviados e extraia informacoes de cada um.

DOCUMENTOS POSSIVEIS: auto de infracao, CNH, RG, CRLV, comprovante de endereco.

Para o AUTO DE INFRACAO extraia:
numero_auto, data, hora, local, codigo_infracao, descricao_infracao, artigo_ctb, placa, pontos, valor_multa, orgao_autuador, agente_autuador, tipo_infracao

Para CNH/RG extraia: nome, cpf, rg, data_nascimento, numero_cnh
Para CRLV extraia: placa_veiculo, renavam, modelo_veiculo

Se um campo nao estiver visivel use null. NAO invente dados.

Responda SOMENTE com JSON valido sem markdown:
{"auto":{"numero_auto":null,"data":null,"hora":null,"local":null,"codigo_infracao":null,"descricao_infracao":null,"artigo_ctb":null,"placa":null,"pontos":null,"valor_multa":null,"orgao_autuador":null,"agente_autuador":null,"tipo_infracao":null},"pessoais":{"nome":null,"cpf":null,"rg":null,"numero_cnh":null,"placa_veiculo":null,"renavam":null,"endereco":null}}`;

    let extraido = null;
    let ultimoErro = "";

    // Monta conteúdo com todos os arquivos
    const contentExtracao = [
      ...arquivos.map(arq => montarBloco(arq)),
      { type: "text", text: promptExtracao }
    ];

    for (const modelo of MODELOS) {
      try {
        console.log("[MULTA-AI] Extraindo com:", modelo, "| Arquivos:", arquivos.length);
        const texto = await chamarAPI(modelo, contentExtracao, 800);
        const clean = texto.replace(/```json|```/g, "").trim();

        let parsed = null;
        try { parsed = JSON.parse(clean); } catch {
          const match = clean.match(/\{[\s\S]+\}/);
          if (match) try { parsed = JSON.parse(match[0]); } catch {}
        }

        if (parsed && (parsed.auto || parsed.pessoais)) {
          extraido = parsed;
          console.log("[MULTA-AI] Extracao OK:", modelo);
          break;
        }
        ultimoErro = `${modelo}: JSON invalido`;
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI]", ultimoErro);
      }
    }

    if (!extraido) {
      return Response.json({ error: "Nao foi possivel analisar os documentos. Tente com imagem mais legivel. Detalhe: " + ultimoErro }, { status: 502 });
    }

    const a = extraido.auto || {};
    const p2 = extraido.pessoais || {};

    // Mescla: dados extraídos dos docs têm prioridade sobre perfil cadastrado
    const nome     = p2.nome       || perfil?.nome     || null;
    const cpf      = p2.cpf        || perfil?.cpf      || null;
    const rg       = p2.rg         || perfil?.rg       || null;
    const cnh      = p2.numero_cnh || perfil?.cnh      || null;
    const placa    = a.placa       || p2.placa_veiculo || veiculo?.placa  || null;
    const renavam  = p2.renavam    || veiculo?.renavam || null;
    const endereco = p2.endereco   || perfil?.endereco || null;

    const dadosAuto = {
      numero_auto:        a.numero_auto        || "Nao identificado",
      data:               a.data               || "Nao identificado",
      hora:               a.hora               || "Nao identificado",
      local:              a.local              || "Nao identificado",
      codigo_infracao:    a.codigo_infracao    || "Nao identificado",
      descricao_infracao: a.descricao_infracao || "Nao identificado",
      artigo_ctb:         a.artigo_ctb         || "Nao identificado",
      placa:              placa                || "Nao identificado",
      pontos:             a.pontos             || "Nao identificado",
      valor_multa:        a.valor_multa        || "Nao identificado",
      orgao_autuador:     a.orgao_autuador     || "Nao identificado",
      agente_autuador:    a.agente_autuador    || "Nao identificado",
      tipo_infracao:      a.tipo_infracao      || "Nao identificado",
    };

    const qualificacao = [
      nome     && `Nome: ${nome}`,
      cpf      && `CPF: ${cpf}`,
      rg       && `RG: ${rg}`,
      cnh      && `CNH: ${cnh}`,
      placa    && `Placa: ${placa}`,
      renavam  && `RENAVAM: ${renavam}`,
      endereco && `Endereco: ${endereco}`,
      perfil?.cidade   && `Cidade: ${perfil.cidade}`,
      perfil?.uf       && `UF: ${perfil.uf}`,
      perfil?.telefone && `Telefone: ${perfil.telefone}`,
      dadosRecorrente,
    ].filter(Boolean).join("\n");

    // ── PASSO 2: Gerar o recurso (sem imagens — só texto) ──────
    const promptRecurso = `Voce e advogado especialista em Direito de Transito brasileiro, com experiencia em recursos perante JARI e CETRAN.

AUTO DE INFRACAO:
- Numero: ${dadosAuto.numero_auto}
- Data: ${dadosAuto.data} | Hora: ${dadosAuto.hora}
- Local: ${dadosAuto.local}
- Codigo CONTRAN: ${dadosAuto.codigo_infracao}
- Descricao: ${dadosAuto.descricao_infracao}
- Artigo CTB: ${dadosAuto.artigo_ctb}
- Placa: ${dadosAuto.placa} | Pontos: ${dadosAuto.pontos} | Valor: ${dadosAuto.valor_multa}
- Orgao: ${dadosAuto.orgao_autuador} | Agente: ${dadosAuto.agente_autuador}
- Gravidade: ${dadosAuto.tipo_infracao}

RECORRENTE:
${qualificacao || "Dados a preencher"}
${historicoTexto}

Redija RECURSO ADMINISTRATIVO DE 1a INSTANCIA (JARI) completo.

ESTRUTURA:
1. CABECALHO: "EXCELENTISSIMO(A) SENHOR(A) PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRACOES - JARI"
2. QUALIFICACAO: use os dados do recorrente acima
3. DOS FATOS: descreva a infracao com os dados do auto
4. DO DIREITO:
   - Art. 280 CTB: questione campos "Nao identificado" como vicio formal
   - Art. 281 CTB: nulidades
   - Art. 282 e 283 CTB: prazos
   - Resolucao CONTRAN pertinente
   - Art. 5 LV CF: ampla defesa e contraditorio
   - 2 precedentes CETRAN ou STJ
5. ARGUMENTOS DE DEFESA:
   - Campos ausentes = vicio formal invalidante (art. 280 CTB)
   - Sinalizacao deficiente
   - Se velocidade: calibracao INMETRO
   - Use historico do condutor se disponivel
6. PEDIDOS: cancelamento auto ${dadosAuto.numero_auto}, arquivamento, devolucao ${dadosAuto.pontos} pontos, restituicao ${dadosAuto.valor_multa}
7. FECHO: ${dataHoje}

Minimo 800 palavras. Linguagem juridica formal.
Responda APENAS com o texto do recurso, sem JSON, sem markdown.`;

    let recurso = "";

    for (const modelo of MODELOS) {
      try {
        console.log("[MULTA-AI] Gerando recurso:", modelo);
        recurso = await chamarAPI(modelo, [{ type: "text", text: promptRecurso }], 4000);
        if (recurso.length > 300) { console.log("[MULTA-AI] Recurso OK:", modelo, recurso.length, "chars"); break; }
        ultimoErro = `${modelo}: resposta curta`;
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI]", ultimoErro);
      }
    }

    if (!recurso || recurso.length < 300) {
      return Response.json({ error: "Nao foi possivel gerar o recurso. Tente novamente. " + ultimoErro }, { status: 502 });
    }

    return Response.json({ dados: dadosAuto, recurso });

  } catch (err) {
    console.error("[MULTA-AI] Erro interno:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}
