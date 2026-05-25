export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();

    // Suporta novo formato (arquivos múltiplos) e legado (arquivo único)
    const arquivos = body.arquivos || (body.fileB64 ? [{
      b64: body.fileB64,
      mediaType: body.mediaType || "image/jpeg",
      fileType: body.fileType || "image",
      nome: "documento"
    }] : []);

    if (arquivos.length === 0) {
      return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Chave de API nao configurada no servidor." }, { status: 500 });
    }

    const { historicoPenalidade, perfil, veiculo } = body;

    const dadosRecorrente = [
      perfil?.nome     && `Nome completo: ${perfil.nome}`,
      perfil?.cpf      && `CPF: ${perfil.cpf}`,
      perfil?.rg       && `RG: ${perfil.rg}`,
      perfil?.endereco && `Endereco: ${perfil.endereco}`,
      perfil?.cidade   && `Cidade: ${perfil.cidade}`,
      perfil?.uf       && `UF: ${perfil.uf}`,
      perfil?.cep      && `CEP: ${perfil.cep}`,
      perfil?.telefone && `Telefone: ${perfil.telefone}`,
      perfil?.cnh      && `Numero CNH: ${perfil.cnh}`,
      veiculo?.placa   && `Placa: ${veiculo.placa}`,
      veiculo?.modelo  && `Modelo: ${veiculo.modelo}`,
      veiculo?.ano     && `Ano: ${veiculo.ano}`,
      veiculo?.renavam && `RENAVAM: ${veiculo.renavam}`,
    ].filter(Boolean).join("\n");

    const historicoTexto = historicoPenalidade
      ? `\nHISTORICO DO CONDUTOR: "${historicoPenalidade}"\nUse para argumentos de defesa personalizados.`
      : "";

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
    });

    // Modelos atualizados - maio/2026
    const MODELOS = [
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ];

    // ── Helper para chamar a API ──────────────────────────────
    const chamarAPI = async (modelo, content, maxTokens = 1500) => {
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
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      return data.content?.find(b => b.type === "text")?.text || "";
    };

    // ── Monta blocos de conteúdo para cada arquivo ────────────
    const montarBlocoArquivo = (arq) => ({
      type: arq.fileType === "pdf" ? "document" : "image",
      source: { type: "base64", media_type: arq.mediaType, data: arq.b64 }
    });

    // ── PASSO 1: Identificar e classificar os documentos ─────
    // A IA analisa todos os arquivos de uma vez e identifica:
    // - Qual é o auto de infração
    // - Quais são documentos pessoais (CNH, RG, CRLV, etc.)
    // - Extrai dados de cada um

    const promptClassificacao = `Voce e um especialista em documentos brasileiros de transito e identificacao.

Analise TODOS os documentos enviados abaixo e identifique o tipo de cada um.

TIPOS POSSIVEIS:
- AUTO_INFRACAO: Auto de infração, notificação de autuação, boleto de multa
- CNH: Carteira Nacional de Habilitação (frente ou verso)
- RG: Documento de identidade (RG, CPF, ou combinado)
- CRLV: Certificado de Registro e Licenciamento do Veículo
- COMPROVANTE_ENDERECO: Conta de luz, água, banco, telefone
- OUTRO: Qualquer outro documento

Para o AUTO_INFRACAO, extraia TODOS os dados visiveis:
- numero_auto: número do auto de infração
- data: data da infração
- hora: hora da infração
- local: local exato (rua, avenida, km, bairro, cidade)
- codigo_infracao: código CONTRAN
- descricao_infracao: descrição completa da infração
- artigo_ctb: artigo do CTB infringido
- placa: placa do veículo
- pontos: pontos na CNH
- valor_multa: valor em reais
- orgao_autuador: órgão que aplicou a multa
- agente_autuador: identificação do agente
- tipo_infracao: gravidade (leve/média/grave/gravíssima)

Para documentos PESSOAIS (CNH, RG, CRLV), extraia:
- nome: nome completo
- cpf: CPF se visível
- rg: RG se visível
- data_nascimento: data de nascimento
- numero_cnh: número da CNH se for CNH
- placa_crlv: placa se for CRLV
- renavam: RENAVAM se for CRLV
- endereco: endereço se for comprovante

IMPORTANTE:
- Se um campo nao estiver visivel, use null (nao use "Nao identificado")
- NAO invente dados que nao estao nos documentos
- Se houver mais de um auto de infracao, use o mais recente
- Documentos pessoais servem para preencher a qualificação do recorrente

Responda APENAS com JSON valido, sem markdown:
{
  "auto_infracao": {
    "numero_auto": null,
    "data": null,
    "hora": null,
    "local": null,
    "codigo_infracao": null,
    "descricao_infracao": null,
    "artigo_ctb": null,
    "placa": null,
    "pontos": null,
    "valor_multa": null,
    "orgao_autuador": null,
    "agente_autuador": null,
    "tipo_infracao": null
  },
  "dados_pessoais": {
    "nome": null,
    "cpf": null,
    "rg": null,
    "data_nascimento": null,
    "numero_cnh": null,
    "placa_crlv": null,
    "renavam": null,
    "endereco": null
  },
  "documentos_encontrados": ["lista dos tipos identificados"]
}`;

    let dadosCompletos = null;
    let ultimoErro = "";

    // Monta o conteúdo com todos os arquivos
    const contentClassificacao = [
      ...arquivos.map(arq => montarBlocoArquivo(arq)),
      {
        type: "text",
        text: `Analise os ${arquivos.length} documento(s) acima.\n\n${promptClassificacao}`
      }
    ];

    for (const modelo of MODELOS) {
      try {
        console.log("[MULTA-AI] Classificacao com:", modelo, "| Arquivos:", arquivos.length);
        const texto = await chamarAPI(modelo, contentClassificacao, 2000);
        const clean = texto.replace(/```json|```/g, "").trim();

        try {
          const parsed = JSON.parse(clean);
          if (parsed.auto_infracao || parsed.dados_pessoais) {
            dadosCompletos = parsed;
            console.log("[MULTA-AI] Classificacao OK:", modelo, "| Docs:", parsed.documentos_encontrados);
            break;
          }
        } catch {
          const match = clean.match(/\{[\s\S]+\}/);
          if (match) {
            try {
              const parsed = JSON.parse(match[0]);
              if (parsed.auto_infracao || parsed.dados_pessoais) {
                dadosCompletos = parsed;
                console.log("[MULTA-AI] Classificacao OK (fallback):", modelo);
                break;
              }
            } catch {}
          }
          ultimoErro = `${modelo}: JSON invalido`;
          continue;
        }
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI] Erro classificacao:", ultimoErro);
        continue;
      }
    }

    if (!dadosCompletos) {
      return Response.json({
        error: "Não foi possível analisar os documentos. Verifique se as imagens estão legíveis. Detalhe: " + ultimoErro
      }, { status: 502 });
    }

    // Extrai dados do auto e dados pessoais
    const auto = dadosCompletos.auto_infracao || {};
    const pessoais = dadosCompletos.dados_pessoais || {};

    // Mescla dados pessoais extraídos dos documentos com os do perfil do usuário
    // Prioridade: dados extraídos dos documentos > dados do perfil cadastrado
    const nomeRecorrente  = pessoais.nome     || perfil?.nome     || null;
    const cpfRecorrente   = pessoais.cpf      || perfil?.cpf      || null;
    const rgRecorrente    = pessoais.rg       || perfil?.rg       || null;
    const cnhRecorrente   = pessoais.numero_cnh || perfil?.cnh    || null;
    const placaRecorrente = pessoais.placa_crlv || auto.placa     || veiculo?.placa || null;
    const renavamRec      = pessoais.renavam  || veiculo?.renavam || null;
    const enderecoRec     = pessoais.endereco || perfil?.endereco || null;

    // Normaliza os dados do auto (substitui null por "Não identificado" apenas para exibição)
    const dadosAuto = {
      numero_auto:        auto.numero_auto        || "Não identificado",
      data:               auto.data               || "Não identificado",
      hora:               auto.hora               || "Não identificado",
      local:              auto.local              || "Não identificado",
      codigo_infracao:    auto.codigo_infracao    || "Não identificado",
      descricao_infracao: auto.descricao_infracao || "Não identificado",
      artigo_ctb:         auto.artigo_ctb         || "Não identificado",
      placa:              placaRecorrente          || "Não identificado",
      pontos:             auto.pontos             || "Não identificado",
      valor_multa:        auto.valor_multa        || "Não identificado",
      orgao_autuador:     auto.orgao_autuador     || "Não identificado",
      agente_autuador:    auto.agente_autuador    || "Não identificado",
      tipo_infracao:      auto.tipo_infracao      || "Não identificado",
    };

    // Monta qualificação completa do recorrente
    const qualificacaoRecorrente = [
      nomeRecorrente   && `Nome completo: ${nomeRecorrente}`,
      cpfRecorrente    && `CPF: ${cpfRecorrente}`,
      rgRecorrente     && `RG: ${rgRecorrente}`,
      cnhRecorrente    && `Número CNH: ${cnhRecorrente}`,
      placaRecorrente  && `Placa do veículo: ${placaRecorrente}`,
      renavamRec       && `RENAVAM: ${renavamRec}`,
      enderecoRec      && `Endereço: ${enderecoRec}`,
      perfil?.cidade   && `Cidade: ${perfil.cidade}`,
      perfil?.uf       && `UF: ${perfil.uf}`,
      perfil?.telefone && `Telefone: ${perfil.telefone}`,
      dadosRecorrente, // dados cadastrados no perfil como complemento
    ].filter(Boolean).join("\n");

    // ── PASSO 2: Gerar o recurso ──────────────────────────────
    const promptRecurso = `Voce e um advogado especialista em Direito de Transito brasileiro com vasta experiencia em recursos administrativos perante a JARI e CETRAN.

DADOS DO AUTO DE INFRACAO:
- Numero: ${dadosAuto.numero_auto}
- Data: ${dadosAuto.data} | Hora: ${dadosAuto.hora}
- Local: ${dadosAuto.local}
- Codigo CONTRAN: ${dadosAuto.codigo_infracao}
- Descricao: ${dadosAuto.descricao_infracao}
- Artigo CTB: ${dadosAuto.artigo_ctb}
- Placa: ${dadosAuto.placa} | Pontos: ${dadosAuto.pontos} | Valor: ${dadosAuto.valor_multa}
- Orgao: ${dadosAuto.orgao_autuador} | Agente: ${dadosAuto.agente_autuador}
- Gravidade: ${dadosAuto.tipo_infracao}

QUALIFICACAO DO RECORRENTE:
${qualificacaoRecorrente || "Dados a serem preenchidos pelo cliente"}
${historicoTexto}

Documentos analisados: ${(dadosCompletos.documentos_encontrados || []).join(", ")}

Redija um RECURSO ADMINISTRATIVO DE 1a INSTANCIA (JARI) completo e fundamentado.

ESTRUTURA OBRIGATORIA:
1. CABECALHO: "EXCELENTISSIMO(A) SENHOR(A) PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRACOES - JARI"

2. QUALIFICACAO DO RECORRENTE:
Use os dados fornecidos acima. Se o nome estiver disponível, use na qualificação completa.
Formato: "[Nome], portador do CPF nº [CPF], RG nº [RG], residente em [endereço], condutor do veículo de placa [placa]..."

3. DOS FATOS:
Descreva detalhadamente a infração com base nos dados do auto.
Se campos estiverem como "Não identificado", mencione isso como vício formal.

4. DO DIREITO - FUNDAMENTACAO JURIDICA:
- Art. 280 CTB: questione cada campo ausente ou ilegível como vício formal invalidante
- Art. 281 CTB: nulidades do auto de infração
- Art. 282 e 283 CTB: prazos de notificação e recursal
- Resolução CONTRAN aplicável ao código da infração
- Art. 5º, LV CF: ampla defesa e contraditório
- Presunção de inocência
- Mínimo 2 precedentes de CETRAN ou STJ sobre o tipo de infração

5. DOS ARGUMENTOS DE DEFESA:
- Se campos do auto estão como "Não identificado": use como vício formal grave (art. 280 CTB)
- Vícios formais: campos em branco, ilegibilidade, inconsistências
- Ausência ou deficiência de sinalização no local
- Se infração de velocidade: questione calibração INMETRO do equipamento
- Cerceamento de defesa por ausência de dados obrigatórios
- Use o histórico do condutor para argumentos específicos se disponível

6. DOS PEDIDOS:
- Conhecimento e provimento do recurso
- Cancelamento do auto nº ${dadosAuto.numero_auto}
- Arquivamento do processo administrativo
- Devolução dos ${dadosAuto.pontos} pontos na CNH
- Restituição de ${dadosAuto.valor_multa} se já pago

7. FECHO:
"[Cidade], ${dataHoje}."
Espaço para assinatura e nome do recorrente.

IMPORTANTE:
- Mínimo 800 palavras
- Linguagem jurídica formal
- Se dados do auto forem "Não identificado", transforme isso em argumento de defesa (vício formal)
- Use os dados reais disponíveis

Responda APENAS com o texto do recurso, sem JSON, sem markdown, sem explicações.`;

    let recursoTexto = "";

    for (const modelo of MODELOS) {
      try {
        console.log("[MULTA-AI] Gerando recurso com:", modelo);
        recursoTexto = await chamarAPI(modelo, [{ type: "text", text: promptRecurso }], 4000);

        if (recursoTexto.length > 200) {
          console.log("[MULTA-AI] Recurso OK:", modelo, "chars:", recursoTexto.length);
          break;
        }
        ultimoErro = `${modelo}: resposta curta (${recursoTexto.length} chars)`;
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI] Erro recurso:", ultimoErro);
        continue;
      }
    }

    if (!recursoTexto || recursoTexto.length < 200) {
      return Response.json({
        error: "Não foi possível gerar o recurso. Tente novamente. Detalhe: " + ultimoErro
      }, { status: 502 });
    }

    return Response.json({
      dados: dadosAuto,
      recurso: recursoTexto,
      documentos_encontrados: dadosCompletos.documentos_encontrados || [],
      dados_pessoais_extraidos: {
        nome: nomeRecorrente,
        cpf: cpfRecorrente,
        rg: rgRecorrente,
        cnh: cnhRecorrente,
      }
    });

  } catch (err) {
    console.error("[MULTA-AI] Erro interno:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}
