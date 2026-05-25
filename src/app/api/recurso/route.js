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
      ? `\n\nHISTORICO RELATADO PELO CONDUTOR:\n"${historicoPenalidade}"\nUse essas informacoes para construir argumentos de defesa personalizados e especificos.`
      : "";

    // PASSO 1: extrair dados do auto com prompt focado e direto
    const promptExtracao = `Voce e um especialista em leitura de documentos de transito brasileiro.

Analise CUIDADOSAMENTE a imagem/documento do auto de infracao e extraia TODOS os dados visiveis, incluindo os menores detalhes.

PROCURE especificamente por:
- Numero do auto de infracao (geralmente um codigo alfanumerico longo)
- Data da infracao (dia/mes/ano)
- Hora da infracao (HH:MM)
- Local exato (rua, avenida, km, bairro, cidade)
- Codigo da infracao (numero do artigo/codigo CONTRAN, ex: 55191, 74550, etc.)
- Descricao da infracao (texto descrevendo o que foi cometido)
- Artigo do CTB infringido
- Placa do veiculo
- Pontos na CNH
- Valor da multa em reais
- Orgao autuador (CET, DETRAN, PRF, PMC, SEMOB, etc.)
- Identificacao do agente autuador (nome ou matricula)
- Tipo/gravidade da infracao (leve, media, grave, gravissima)

Se um campo nao estiver visivel ou legivel no documento, use "Nao identificado" como valor.
NAO invente dados que nao estao no documento.

Responda APENAS com JSON valido, sem nenhum texto antes ou depois, sem markdown:
{"numero_auto":"...","data":"...","hora":"...","local":"...","codigo_infracao":"...","descricao_infracao":"...","artigo_ctb":"...","placa":"...","pontos":"...","valor_multa":"...","orgao_autuador":"...","agente_autuador":"...","tipo_infracao":"..."}`;

    // PASSO 2: gerar o recurso com os dados extraidos
    // Data atual formatada no padrão brasileiro
    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo"
    });

    const promptRecurso = (dados) => `Voce e um advogado especialista em Direito de Transito brasileiro com vasta experiencia em recursos administrativos perante a JARI e CETRAN.

DADOS DO AUTO DE INFRACAO EXTRAIDOS:
- Numero do auto: ${dados.numero_auto}
- Data: ${dados.data}
- Hora: ${dados.hora}
- Local: ${dados.local}
- Codigo da infracao: ${dados.codigo_infracao}
- Descricao: ${dados.descricao_infracao}
- Artigo CTB: ${dados.artigo_ctb}
- Placa: ${dados.placa}
- Pontos: ${dados.pontos}
- Valor da multa: ${dados.valor_multa}
- Orgao autuador: ${dados.orgao_autuador}
- Agente: ${dados.agente_autuador}
- Gravidade: ${dados.tipo_infracao}

${dadosRecorrente ? `DADOS DO RECORRENTE:\n${dadosRecorrente}` : "DADOS DO RECORRENTE: A preencher pelo cliente"}${historicoTexto}

Redija um RECURSO ADMINISTRATIVO DE 1a INSTANCIA (JARI) completo, tecnico e fundamentado.

ESTRUTURA OBRIGATORIA:
1. CABECALHO: "EXCELENTISSIMO(A) SENHOR(A) PRESIDENTE DA JUNTA ADMINISTRATIVA DE RECURSOS DE INFRACOES - JARI"
2. QUALIFICACAO DO RECORRENTE: use os dados fornecidos acima
3. DOS FATOS: descricao detalhada do auto de infracao com os dados extraidos
4. DO DIREITO - FUNDAMENTACAO JURIDICA:
   - Art. 280 CTB (requisitos obrigatorios do auto - questione cada campo ausente ou incorreto)
   - Art. 281 CTB (nulidades do auto de infracao)
   - Art. 282 e 283 CTB (notificacao e prazo recursal)
   - Resolucao CONTRAN pertinente ao codigo da infracao
   - Principios constitucionais: ampla defesa (art. 5 LV CF), contraditorio, presuncao de inocencia
   - Cite pelo menos 2 precedentes de CETRAN ou STJ sobre o tipo de infracao
5. DOS ARGUMENTOS DE DEFESA (use TODOS que se aplicam):
   - Vicios formais: campos em branco, ilegibilidade, dados inconsistentes no auto
   - Ausencia ou deficiencia de sinalizacao no local
   - Questionamento tecnico do equipamento se for infracao de velocidade (calibracao INMETRO, portaria vigente)
   - Cerceamento de defesa
   - Se historico do cliente mencionado: use para argumento especifico (emergencia medica = art. 235 CTB, sinalizacao = dever do poder publico, etc.)
6. DOS PEDIDOS:
   - Conhecimento e provimento do recurso
   - Cancelamento do auto de infracao numero ${dados.numero_auto}
   - Arquivamento do processo administrativo
   - Devolucao dos ${dados.pontos} pontos na CNH
   - Restituicao do valor de ${dados.valor_multa} se ja pago
7. FECHO: "Local e data: [cidade do recorrente ou cidade da infracao], ${dataHoje}." Espaco para assinatura e nome do recorrente

IMPORTANTE: Minimo de 800 palavras. Use linguagem juridica formal. Cite os dados reais do auto extraidos acima.

Responda APENAS com o texto do recurso, sem JSON, sem markdown, sem explicacoes adicionais.`;

    const modelos = [
      "claude-sonnet-4-5",
      "claude-opus-4-5",
      "claude-haiku-4-5",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ];

    let ultimoErro = "";

    // ── PASSO 1: Extrair dados do auto ────────────────────────
    let dadosExtraidos = null;

    for (const modelo of modelos) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: modelo,
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: [
                { type: fileType === "pdf" ? "document" : "image", source: { type: "base64", media_type: finalMediaType, data: fileB64 } },
                { type: "text", text: promptExtracao }
              ]
            }]
          })
        });

        if (!res.ok) {
          ultimoErro = `extracao ${modelo}: HTTP ${res.status}`;
          console.error("[MULTA-AI] Extracao erro", modelo, res.status);
          continue;
        }

        const data = await res.json();
        const rawText = data.content?.find(b => b.type === "text")?.text || "";
        const clean = rawText.replace(/```json|```/g, "").trim();

        try {
          dadosExtraidos = JSON.parse(clean);
          console.log("[MULTA-AI] Dados extraidos com modelo:", modelo, dadosExtraidos);
          break;
        } catch {
          // tenta extrair JSON do meio do texto
          const match = clean.match(/\{[\s\S]+\}/);
          if (match) {
            try { dadosExtraidos = JSON.parse(match[0]); break; } catch {}
          }
          ultimoErro = `extracao ${modelo}: JSON invalido`;
          continue;
        }
      } catch (err) {
        ultimoErro = `extracao ${modelo}: ${err.message}`;
        continue;
      }
    }

    if (!dadosExtraidos) {
      return Response.json({ error: "Nao foi possivel extrair os dados do auto. Verifique se a imagem esta legivel. Detalhe: " + ultimoErro }, { status: 502 });
    }

    // ── PASSO 2: Gerar o recurso ──────────────────────────────
    let recursoTexto = "";

    for (const modelo of modelos) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: modelo,
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [{ type: "text", text: promptRecurso(dadosExtraidos) }]
            }]
          })
        });

        if (!res.ok) {
          ultimoErro = `recurso ${modelo}: HTTP ${res.status}`;
          console.error("[MULTA-AI] Recurso erro", modelo, res.status);
          continue;
        }

        const data = await res.json();
        recursoTexto = data.content?.find(b => b.type === "text")?.text || "";

        if (recursoTexto.length > 200) {
          console.log("[MULTA-AI] Recurso gerado com modelo:", modelo, "Chars:", recursoTexto.length);
          break;
        }

        ultimoErro = `recurso ${modelo}: resposta muito curta (${recursoTexto.length} chars)`;
      } catch (err) {
        ultimoErro = `recurso ${modelo}: ${err.message}`;
        continue;
      }
    }

    if (!recursoTexto || recursoTexto.length < 200) {
      return Response.json({ error: "Nao foi possivel gerar o recurso. Tente novamente. Detalhe: " + ultimoErro }, { status: 502 });
    }

    return Response.json({ dados: dadosExtraidos, recurso: recursoTexto });

  } catch (err) {
    console.error("[MULTA-AI] Erro interno:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}

