/**
 * API Route: /api/recurso
 * Recebe o arquivo (base64) e chama a Anthropic com segurança.
 * A chave ANTHROPIC_API_KEY fica apenas no servidor — nunca exposta ao browser.
 */

export const runtime = "nodejs";
export const maxDuration = 60; // segundos — necessário para análise de PDF/imagem

export async function POST(request) {
  try {
    const { fileB64, fileType } = await request.json();

    if (!fileB64 || !fileType) {
      return Response.json({ error: "Arquivo obrigatório." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Chave de API não configurada." }, { status: 500 });
    }

    const mediaType = fileType === "pdf" ? "application/pdf" : "image/jpeg";

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
                source: { type: "base64", media_type: mediaType, data: fileB64 },
              },
              {
                type: "text",
                text: `Você é um especialista em direito de trânsito brasileiro com vasta experiência em recursos administrativos.

Analise este auto de infração e:
1. Extraia todos os dados relevantes do documento
2. Redija um recurso administrativo de 1ª instância (JARI) completo, formal e fundamentado

O recurso deve:
- Ser endereçado à Junta Administrativa de Recursos de Infrações (JARI)
- Apresentar qualificação completa do recorrente (use dados do auto)
- Arguir todos os vícios formais identificáveis (falta de dados obrigatórios, prazo de notificação, etc.)
- Fundamentar no CTB (especialmente arts. 280, 281, 282, 283) e Resoluções CONTRAN pertinentes
- Incluir pedido de cancelamento da autuação e devolução de pontos
- Ter linguagem jurídica formal mas clara
- Ter ao menos 400 palavras

Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON:
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
    "valor_multa": "..."
  },
  "recurso": "texto completo do recurso com quebras de linha \\n"
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text();
      console.error("Anthropic error:", err);
      return Response.json({ error: "Erro ao processar com a IA." }, { status: 502 });
    }

    const data = await anthropicResponse.json();
    const rawText = data.content?.find((b) => b.type === "text")?.text || "";
    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return Response.json(parsed);
  } catch (err) {
    console.error("Erro na API route:", err);
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
