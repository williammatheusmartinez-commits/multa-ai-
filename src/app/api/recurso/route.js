/**
 * /api/recurso — Gera o recurso administrativo (só texto, sem imagens)
 * Recebe dados já extraídos pela rota /api/extrair
 */
export const runtime = "nodejs";
export const maxDuration = 55;

export async function POST(request) {
  try {
    const { dadosAuto, qualificacao, historicoPenalidade } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return Response.json({ error: "API key nao configurada." }, { status: 500 });

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
    });

    const historicoTexto = historicoPenalidade
      ? `\nHISTORICO DO CONDUTOR: "${historicoPenalidade}"\nUse para argumentos personalizados de defesa.`
      : "";

    const MODELOS = [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6",
      "claude-3-haiku-20240307",
      "claude-3-5-sonnet-20241022",
    ];

    const a = dadosAuto || {};

    const prompt = `Voce e advogado especialista em Direito de Transito brasileiro, com experiencia em recursos perante JARI e CETRAN.

AUTO DE INFRACAO:
- Numero: ${a.numero_auto || "Nao identificado"}
- Data: ${a.data || "Nao identificado"} | Hora: ${a.hora || "Nao identificado"}
- Local: ${a.local || "Nao identificado"}
- Codigo CONTRAN: ${a.codigo_infracao || "Nao identificado"}
- Descricao: ${a.descricao_infracao || "Nao identificado"}
- Artigo CTB: ${a.artigo_ctb || "Nao identificado"}
- Placa: ${a.placa || "Nao identificado"} | Pontos: ${a.pontos || "Nao identificado"} | Valor: ${a.valor_multa || "Nao identificado"}
- Orgao: ${a.orgao_autuador || "Nao identificado"} | Agente: ${a.agente_autuador || "Nao identificado"}
- Gravidade: ${a.tipo_infracao || "Nao identificado"}

RECORRENTE:
${qualificacao || "Dados a preencher pelo cliente"}
${historicoTexto}

Redija RECURSO ADMINISTRATIVO DE 1a INSTANCIA completo.

ESTRUTURA OBRIGATORIA:
1. CABECALHO: "EXCELENTISSIMO(A) SENHOR(A) PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRACOES - JARI"
2. QUALIFICACAO DO RECORRENTE (use os dados acima)
3. DOS FATOS: descreva a infracao com os dados do auto
4. DO DIREITO:
   - Art. 280 CTB: campos "Nao identificado" = vicio formal grave
   - Art. 281 CTB: nulidades do auto
   - Art. 282 e 283 CTB: prazos de notificacao e recursal
   - Resolucao CONTRAN pertinente ao codigo da infracao
   - Art. 5 LV CF: ampla defesa e contraditorio
   - 2 precedentes de CETRAN ou STJ
5. ARGUMENTOS DE DEFESA:
   - Vicios formais por campos ausentes (art. 280 CTB)
   - Sinalizacao deficiente no local
   - Se velocidade: calibracao INMETRO e portaria vigente
   - Historico do condutor (se disponivel)
6. PEDIDOS: cancelamento auto ${a.numero_auto || "em questao"}, arquivamento, devolucao pontos, restituicao valor
7. FECHO: ${dataHoje}, espaco para assinatura

Minimo 800 palavras. Linguagem juridica formal.
Responda APENAS com o texto do recurso. Sem JSON. Sem markdown.`;

    let ultimoErro = "";

    for (const modelo of MODELOS) {
      try {
        console.log("[RECURSO]", modelo);
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: modelo, max_tokens: 4000, messages: [{ role: "user", content: prompt }] })
        });

        if (!res.ok) { ultimoErro = `${modelo}: HTTP ${res.status}`; continue; }

        const data = await res.json();
        const recurso = data.content?.find(b => b.type === "text")?.text || "";

        if (recurso.length > 300) {
          console.log("[RECURSO] OK:", modelo, recurso.length, "chars");
          return Response.json({ recurso });
        }
        ultimoErro = `${modelo}: resposta curta`;
      } catch (err) {
        ultimoErro = `${modelo}: ${err.message}`;
        console.error("[RECURSO]", ultimoErro);
      }
    }

    return Response.json({ error: "Falha ao gerar recurso. Detalhe: " + ultimoErro }, { status: 502 });

  } catch (err) {
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}
