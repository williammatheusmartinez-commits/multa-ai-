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
      return Response.json({ error: "Chave de API nao configurada." }, { status: 500 });
    }

    const finalMediaType = fileType === "pdf"
      ? "application/pdf"
      : (mediaType && mediaType.startsWith("image/") ? mediaType : "image/jpeg");

    const historicoTexto = historicoPenalidade
      ? "\n\nHistorico relatado pelo cliente: " + historicoPenalidade
      : "";

    // Tenta modelos em ordem de preferencia
    const modelos = [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307"
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
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: [
                {
                  type: fileType === "pdf" ? "document" : "image",
                  source: { type: "base64", media_type: finalMediaType, data: fileB64 },
                },
                {
                  type: "text",
                  text: "Voce e especialista em direito de transito brasileiro." + historicoTexto + "\n\nAnalise este auto de infracao e redija um recurso administrativo de 1a instancia (JARI) completo, fundamentado no CTB (arts. 280, 281, 282, 283). Minimo 400 palavras. Use o historico do cliente para fortalecer a defesa quando relevante.\n\nResponda APENAS em JSON valido sem markdown:\n{\"dados\":{\"numero_auto\":\"...\",\"data\":\"...\",\"hora\":\"...\",\"local\":\"...\",\"codigo_infracao\":\"...\",\"descricao_infracao\":\"...\",\"artigo_ctb\":\"...\",\"placa\":\"...\",\"pontos\":\"...\",\"valor_multa\":\"...\"},\"recurso\":\"texto completo com \\n\"}"
                }
              ]
            }]
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          ultimoErro = `${modelo}: ${res.status} - ${errText.slice(0, 200)}`;
          console.error("Erro modelo", modelo, res.status, errText.slice(0, 200));
          continue; // tenta próximo modelo
        }

        const data = await res.json();
        const rawText = data.content?.find(b => b.type === "text")?.text || "";
        const clean = rawText.replace(/```json|```/g, "").trim();

        let parsed;
        try {
          parsed = JSON.parse(clean);
        } catch {
          console.error("JSON parse error com modelo", modelo, rawText.slice(0, 300));
          continue;
        }

        if (!parsed.dados || !parsed.recurso) {
          console.error("Resposta incompleta do modelo", modelo);
          continue;
        }

        // Sucesso!
        return Response.json({ ...parsed, _modelo: modelo });

      } catch (err) {
        ultimoErro = err.message;
        console.error("Excecao modelo", modelo, err.message);
        continue;
      }
    }

    // Todos os modelos falharam
    return Response.json({
      error: "Nao foi possivel gerar o recurso. Verifique sua chave de API e creditos na Anthropic. Detalhe: " + ultimoErro
    }, { status: 502 });

  } catch (err) {
    console.error("Erro interno:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}

