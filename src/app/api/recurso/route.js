export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { fileB64, fileType, mediaType, historicoPenalidade } = await request.json();

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

    const historicoTexto = historicoPenalidade
      ? "\n\nHistorico relatado pelo cliente: " + historicoPenalidade
      : "";

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: fileType === "pdf" ? "document" : "image",
                source: { type: "base64", media_type: finalMediaType, data: fileB64 },
              },
              {
                type: "text",
                text: "Voce e um especialista em direito de transito brasileiro com vasta experiencia em recursos administrativos." + historicoTexto + "\n\nAnalise este auto de infracao e:\n1. Extraia todos os dados relevantes do documento\n2. Redija um recurso administrativo de 1a instancia (JARI) completo, formal e fundamentado\n\nO recurso deve:\n- Ser endereçado a Junta Administrativa de Recursos de Infracoes (JARI)\n- Apresentar qualificacao completa do recorrente (use dados do auto)\n- Arguir todos os vicios formais identificaveis\n- Fundamentar no CTB (arts. 280, 281, 282, 283) e Resolucoes CONTRAN pertinentes\n- Usar o historico relatado pelo cliente para fortalecer os argumentos quando relevante\n- Incluir pedido de cancelamento da autuacao e devolucao de pontos\n- Ter linguagem juridica formal mas clara\n- Ter ao menos 400 palavras\n\nResponda APENAS em JSON valido, sem markdown, sem texto fora do JSON:\n{\"dados\":{\"numero_auto\":\"...\",\"data\":\"...\",\"hora\":\"...\",\"local\":\"...\",\"codigo_infracao\":\"...\",\"descricao_infracao\":\"...\",\"artigo_ctb\":\"...\",\"placa\":\"...\",\"pontos\":\"...\",\"valor_multa\":\"...\"},\"recurso\":\"texto completo do recurso com quebras de linha \\n\"}",
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Anthropic error:", errText);
      return Response.json({ error: "Erro ao processar com a IA. Tente novamente." }, { status: 502 });
    }

    const data = await anthropicResponse.json();
    const rawText = data.content?.find((b) => b.type === "text")?.text || "";
    const clean = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error("JSON parse error. Raw:", rawText.slice(0, 500));
      return Response.json({ error: "A IA nao retornou formato valido. Tente novamente." }, { status: 500 });
    }

    if (!parsed.dados || !parsed.recurso) {
      return Response.json({ error: "Resposta incompleta da IA. Tente novamente." }, { status: 500 });
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("Erro interno:", err);
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
