/**
 * /api/extrair â€” Extrai dados dos documentos enviados
 * Rota separada para evitar timeout na Vercel (plano free: 60s)
 */
export const runtime = "nodejs";
export const maxDuration = 55;

export async function POST(request) {
  try {
    const body = await request.json();
    const arquivos = body.arquivos
      ? body.arquivos.slice(0, 2)
      : body.fileB64
        ? [{ b64: body.fileB64, mediaType: body.mediaType || "image/jpeg", fileType: body.fileType || "image" }]
        : [];

    if (arquivos.length === 0) {
      return Response.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "API key nao configurada." }, { status: 500 });

    const MODELOS = [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6",
      "claude-3-haiku-20240307",
      "claude-3-5-sonnet-20241022",
    ];

    const prompt = `Analise os documentos e extraia dados. Documentos possiveis: auto de infracao, CNH, RG, CRLV, comprovante de endereco.

Para AUTO DE INFRACAO: numero_auto, data, hora, local, codigo_infracao, descricao_infracao, artigo_ctb, placa, pontos, valor_multa, orgao_autuador, agente_autuador, tipo_infracao
Para CNH/RG: nome, cpf, rg, numero_cnh
Para CRLV: placa_veiculo, renavam

Use null se nao visivel. NAO invente dados.

JSON APENAS, sem markdown:
{"auto":{"numero_auto":null,"data":null,"hora":null,"local":null,"codigo_infracao":null,"descricao_infracao":null,"artigo_ctb":null,"placa":null,"pontos":null,"valor_multa":null,"orgao_autuador":null,"agente_autuador":null,"tipo_infracao":null},"pessoais":{"nome":null,"cpf":null,"rg":null,"numero_cnh":null,"placa_veiculo":null,"renavam":null,"endereco":null}}`;

    let ultimoErro = "";

    for (const modelo of MODELOS) {
      try {
        console.log("[EXTRAIR]", modelo, "| arquivos:", arquivos.length);
        const content = [
          ...arquivos.map(arq => ({
            type: arq.fileType === "pdf" ? "document" : "image",
            source: { type: "base64", media_type: arq.mediaType, data: arq.b64 }
          })),
          { type: "text", text: prompt }
        ];

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: modelo, max_tokens: 600, messages: [{ role: "user", content }] })
        });

        if (!res.ok) { ultimoErro = `${modelo}: HTTP ${res.status}`; continue; }

        const data = await res.json();
        const texto = data.content?.find(b => b.type === "text")?.text || "";
        const clean = texto.replace(/```json|```/g, "").trim();

        let parsed = null;
        try { parsed = JSON.parse(clean); } catch {
          const m = clean.match(/\{[\s\S]+\}/);
          if (m) try { parsed = JSON.parse(m[0]); } catch {}
        }

        if (parsed?.auto !== undefined) {
          console.log("[EXTRAIR] OK:", modelo);
          return Response.json({ extraido: parsed, modelo });
        }
        ultimoErro = `${modelo}: JSON invalido`;
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[EXTRAIR]", ultimoErro);
      }
    }

    return Response.json({ error: "Falha ao extrair dados. Detalhe: " + ultimoErro }, { status: 502 });

  } catch (err) {
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}
