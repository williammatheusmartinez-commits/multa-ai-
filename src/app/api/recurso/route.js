export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { fileB64, fileType, mediaType, historicoPenalidade, perfil, veiculo } = await request.json();

    if (!fileB64 || !fileType) {
      return Response.json({ error: "Arquivo obrigatorio." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Chave de API nao configurada no servidor." }, { status: 500 });
    }

    const finalMediaType = fileType === "pdf"
      ? "application/pdf"
      : (mediaType && mediaType.startsWith("image/") ? mediaType : "image/jpeg");

    const dadosRecorrente = [
      perfil?.nome && `Nome completo: ${perfil.nome}`,
      perfil?.cpf && `CPF: ${perfil.cpf}`,
      perfil?.rg && `RG: ${perfil.rg}`,
      perfil?.endereco && `Endereco: ${perfil.endereco}`,
      perfil?.cidade && `Cidade: ${perfil.cidade}`,
      perfil?.uf && `UF: ${perfil.uf}`,
      perfil?.cep && `CEP: ${perfil.cep}`,
      perfil?.telefone && `Telefone: ${perfil.telefone}`,
      perfil?.cnh && `Numero CNH: ${perfil.cnh}`,
      veiculo?.placa && `Placa do veiculo: ${veiculo.placa}`,
      veiculo?.modelo && `Modelo/Marca: ${veiculo.modelo}`,
      veiculo?.ano && `Ano: ${veiculo.ano}`,
      veiculo?.renavam && `RENAVAM: ${veiculo.renavam}`,
    ].filter(Boolean).join("\n");

    const historicoTexto = historicoPenalidade
      ? `\n\nHISTORICO RELATADO PELO CONDUTOR:\n"${historicoPenalidade}"\nUse para construir argumentos de defesa personalizados.`
      : "";

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
    });

    // Modelos atualizados — verificados em maio/2026
    // Visão: modelos que suportam imagem/PDF
    const MODELOS_VISAO = [
      "claude-sonnet-4-6",           // Sonnet 4.6 — melhor custo-benefício atual
      "claude-haiku-4-5-20251001",   // Haiku 4.5 — rápido e barato
      "claude-3-5-sonnet-20241022",  // fallback estável com visão
      "claude-3-haiku-20240307",     // fallback leve com visão
    ];

    // Texto: qualquer modelo serve
    const MODELOS_TEXTO = [
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ];

    const promptExtracao = `Voce e um especialista em leitura de documentos de transito brasileiro.

Analise CUIDADOSAMENTE a imagem/documento do auto de infracao e extraia TODOS os dados visiveis.

PROCURE especificamente por:
- Numero do auto de infracao
- Data da infracao (dia/mes/ano)
- Hora da infracao (HH:MM)
- Local exato (rua, avenida, km, bairro, cidade)
- Codigo da infracao (CONTRAN, ex: 55191, 74550)
- Descricao da infracao
- Artigo do CTB infringido
- Placa do veiculo
- Pontos na CNH
- Valor da multa em reais
- Orgao autuador (CET, DETRAN, PRF, PMC, SEMOB)
- Identificacao do agente autuador
- Tipo/gravidade (leve, media, grave, gravissima)

Se um campo nao estiver visivel, use "Nao identificado".
NAO invente dados.

Responda APENAS com JSON valido, sem markdown, sem texto antes ou depois:
{"numero_auto":"...","data":"...","hora":"...","local":"...","codigo_infracao":"...","descricao_infracao":"...","artigo_ctb":"...","placa":"...","pontos":"...","valor_multa":"...","orgao_autuador":"...","agente_autuador":"...","tipo_infracao":"..."}`;

    const promptRecurso = (dados) => `Voce e um advogado especialista em Direito de Transito brasileiro com vasta experiencia em recursos administrativos perante a JARI e CETRAN.

DADOS DO AUTO DE INFRACAO:
- Numero: ${dados.numero_auto}
- Data: ${dados.data} | Hora: ${dados.hora}
- Local: ${dados.local}
- Codigo: ${dados.codigo_infracao} — ${dados.descricao_infracao}
- Artigo CTB: ${dados.artigo_ctb}
- Placa: ${dados.placa} | Pontos: ${dados.pontos} | Valor: ${dados.valor_multa}
- Orgao: ${dados.orgao_autuador} | Agente: ${dados.agente_autuador}
- Gravidade: ${dados.tipo_infracao}

${dadosRecorrente ? `DADOS DO RECORRENTE:\n${dadosRecorrente}` : "RECORRENTE: dados a preencher"}${historicoTexto}

Redija um RECURSO ADMINISTRATIVO DE 1a INSTANCIA (JARI) completo e fundamentado.

ESTRUTURA OBRIGATORIA:
1. CABECALHO: "EXCELENTISSIMO(A) SENHOR(A) PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRACOES - JARI"
2. QUALIFICACAO DO RECORRENTE (use os dados fornecidos)
3. DOS FATOS: descricao detalhada da infracao com todos os dados do auto
4. DO DIREITO:
   - Art. 280 CTB (requisitos do auto — questione campos ausentes)
   - Art. 281 CTB (nulidades)
   - Art. 282 e 283 CTB (notificacao e prazo)
   - Resolucao CONTRAN pertinente
   - Principios constitucionais: ampla defesa (art. 5 LV CF), contraditorio, presuncao de inocencia
   - Minimo 2 precedentes de CETRAN ou STJ
5. ARGUMENTOS DE DEFESA:
   - Vicios formais do auto
   - Sinalizacao ausente ou deficiente
   - Equipamento sem calibracao INMETRO (se velocidade)
   - Historico do cliente (se informado)
6. PEDIDOS:
   - Cancelamento do auto ${dados.numero_auto}
   - Arquivamento do processo
   - Devolucao dos ${dados.pontos} pontos
   - Restituicao de ${dados.valor_multa} se pago
7. FECHO: data de hoje ${dataHoje}, espaco para assinatura

Minimo 800 palavras. Linguagem juridica formal.
Responda APENAS com o texto do recurso, sem JSON, sem markdown.`;

    const chamarAPI = async (modelo, content) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelo,
          max_tokens: content.length > 1 ? 4000 : 1000,
          messages: [{ role: "user", content }]
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      return data.content?.find(b => b.type === "text")?.text || "";
    };

    let ultimoErro = "";

    // ── PASSO 1: Extrair dados do auto ────────────────────────
    let dadosExtraidos = null;

    for (const modelo of MODELOS_VISAO) {
      try {
        console.log("[MULTA-AI] Extracao com:", modelo);
        const texto = await chamarAPI(modelo, [
          {
            type: fileType === "pdf" ? "document" : "image",
            source: { type: "base64", media_type: finalMediaType, data: fileB64 }
          },
          { type: "text", text: promptExtracao }
        ]);

        const clean = texto.replace(/```json|```/g, "").trim();

        try {
          dadosExtraidos = JSON.parse(clean);
          console.log("[MULTA-AI] Extracao OK:", modelo);
          break;
        } catch {
          const match = clean.match(/\{[\s\S]+\}/);
          if (match) {
            try { dadosExtraidos = JSON.parse(match[0]); console.log("[MULTA-AI] Extracao OK (fallback):", modelo); break; } catch {}
          }
          ultimoErro = `${modelo}: JSON invalido`;
          continue;
        }
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI] Extracao erro:", ultimoErro);
        continue;
      }
    }

    if (!dadosExtraidos) {
      return Response.json({
        error: "Nao foi possivel extrair os dados do auto. Verifique se a imagem esta legivel. Detalhe: " + ultimoErro
      }, { status: 502 });
    }

    // ── PASSO 2: Gerar o recurso ──────────────────────────────
    let recursoTexto = "";

    for (const modelo of MODELOS_TEXTO) {
      try {
        console.log("[MULTA-AI] Recurso com:", modelo);
        recursoTexto = await chamarAPI(modelo, [
          { type: "text", text: promptRecurso(dadosExtraidos) }
        ]);

        if (recursoTexto.length > 200) {
          console.log("[MULTA-AI] Recurso OK:", modelo, "chars:", recursoTexto.length);
          break;
        }

        ultimoErro = `${modelo}: resposta curta (${recursoTexto.length} chars)`;
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI] Recurso erro:", ultimoErro);
        continue;
      }
    }

    if (!recursoTexto || recursoTexto.length < 200) {
      return Response.json({
        error: "Nao foi possivel gerar o recurso. Tente novamente. Detalhe: " + ultimoErro
      }, { status: 502 });
    }

    return Response.json({ dados: dadosExtraidos, recurso: recursoTexto });

  } catch (err) {
    console.error("[MULTA-AI] Erro interno:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}

