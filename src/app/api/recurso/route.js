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

    // Monta bloco de dados do recorrente para enriquecer o recurso
    const dadosRecorrente = [
      perfil?.nome && `Nome: ${perfil.nome}`,
      perfil?.cpf && `CPF: ${perfil.cpf}`,
      perfil?.rg && `RG: ${perfil.rg}`,
      perfil?.endereco && `Endereco: ${perfil.endereco}`,
      perfil?.cidade && `Cidade: ${perfil.cidade}`,
      perfil?.uf && `UF: ${perfil.uf}`,
      perfil?.cep && `CEP: ${perfil.cep}`,
      perfil?.telefone && `Telefone: ${perfil.telefone}`,
      perfil?.email && `E-mail: ${perfil.email}`,
      perfil?.cnh && `CNH: ${perfil.cnh}`,
      veiculo?.placa && `Placa do veiculo: ${veiculo.placa}`,
      veiculo?.modelo && `Modelo: ${veiculo.modelo}`,
      veiculo?.ano && `Ano: ${veiculo.ano}`,
      veiculo?.renavam && `RENAVAM: ${veiculo.renavam}`,
    ].filter(Boolean).join("\n");

    const historicoTexto = historicoPenalidade
      ? `\n\nHISTORICO RELATADO PELO CLIENTE (use para fortalecer a defesa):\n${historicoPenalidade}`
      : "";

    const prompt = `Voce e um advogado especialista em Direito de Transito brasileiro, com vasta experiencia em recursos administrativos perante a JARI (Junta Administrativa de Recursos de Infracoes) e CETRAN.

${dadosRecorrente ? `DADOS DO RECORRENTE (use para qualificacao completa no recurso):\n${dadosRecorrente}` : ""}${historicoTexto}

Analise o auto de infracao anexo e:
1. Extraia TODOS os dados do documento com precisao
2. Redija um RECURSO ADMINISTRATIVO DE 1a INSTANCIA (JARI) tecnicamente completo, formal e fundamentado

REQUISITOS OBRIGATORIOS DO RECURSO:
- Cabecalho formal: "EXCELENTISSIMO SENHOR PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRACOES - JARI"
- Qualificacao completa do recorrente (use os dados fornecidos, ou "QUALIFICACAO A SER PREENCHIDA" se nao houver)
- Descricao detalhada dos fatos
- FUNDAMENTACAO JURIDICA OBRIGATORIA com artigos especificos:
  * Art. 280 CTB (requisitos formais do auto)
  * Art. 281 CTB (nulidades)
  * Art. 282 CTB (notificacao)
  * Art. 283 CTB (prazo recursal)
  * Resolucoes CONTRAN pertinentes ao tipo de infracao
  * Jurisprudencia e sumulas aplicaveis (STJ, STF, CETRAN)
- ARGUMENTOS DE DEFESA:
  * Vicios formais do auto de infracao (falta de dados obrigatorios, ilegibilidade, dados incorretos)
  * Ausencia ou deficiencia de sinalizacao
  * Questionamento tecnico do equipamento de medicao se aplicavel (calibracao, homologacao INMETRO)
  * Cerceamento de defesa
  * Principios constitucionais: ampla defesa, contraditorio, presuncao de inocencia
  * Use o historico do cliente para argumentos especificos quando relevante
- PEDIDOS: cancelamento da autuacao, arquivamento do processo, devolucao dos pontos, restituicao do valor pago se aplicavel
- Fecho formal com data e local para assinatura
- Minimo de 600 palavras no recurso

USE O HISTORICO RELATADO PELO CLIENTE para construir argumentos de defesa especificos e personalizados. Se o cliente relatou emergencia medica, cite o art. 235 CTB e jurisprudencia sobre excludentes de ilicitude. Se relatou sinalização deficiente, cite o dever do poder publico.

Responda APENAS em JSON valido, sem markdown, sem texto fora do JSON:
{
  "dados": {
    "numero_auto": "...",
    "data": "...",
    "hora": "...",
    "local": "...",
    "codigo_infracao": "...",
    "descricao_infracao": "...",
    "artigo_ctb": "...",
    "placa": "...",
    "pontos": "...",
    "valor_multa": "...",
    "orgao_autuador": "...",
    "agente_autuador": "...",
    "tipo_infracao": "..."
  },
  "recurso": "texto completo e tecnico do recurso com quebras de linha \\n"
}`;

    const modelos = [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ];

    let ultimoErro = "";

    for (const modelo of modelos) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelo,
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                {
                  type: fileType === "pdf" ? "document" : "image",
                  source: { type: "base64", media_type: finalMediaType, data: fileB64 },
                },
                { type: "text", text: prompt }
              ]
            }]
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          ultimoErro = `${modelo}: HTTP ${res.status} - ${errText.slice(0, 300)}`;
          console.error("[MULTA-AI] Erro modelo", modelo, res.status, errText.slice(0, 300));
          continue;
        }

        const data = await res.json();
        const rawText = data.content?.find(b => b.type === "text")?.text || "";
        const clean = rawText.replace(/```json|```/g, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(clean);
        } catch (parseErr) {
          console.error("[MULTA-AI] JSON parse error com modelo", modelo, rawText.slice(0, 400));
          ultimoErro = `${modelo}: JSON invalido`;
          continue;
        }

        if (!parsed.dados || !parsed.recurso) {
          console.error("[MULTA-AI] Resposta incompleta do modelo", modelo);
          ultimoErro = `${modelo}: resposta incompleta`;
          continue;
        }

        console.log("[MULTA-AI] Sucesso com modelo:", modelo, "Tamanho recurso:", parsed.recurso.length);
        return Response.json({ ...parsed, _modelo: modelo });

      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[MULTA-AI] Excecao modelo", modelo, err.message);
        continue;
      }
    }

    return Response.json({
      error: "Nao foi possivel gerar o recurso. Verifique sua chave de API e creditos na Anthropic. Detalhe tecnico: " + ultimoErro
    }, { status: 502 });

  } catch (err) {
    console.error("[MULTA-AI] Erro interno:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}
