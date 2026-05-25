/**
 * API Route: /api/pix
 * Cria cobrança PIX via Mercado Pago
 * Variável necessária na Vercel: MERCADOPAGO_ACCESS_TOKEN
 */

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { plano, email, nome, valor } = await request.json();

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) {
      return Response.json({ error: "Mercado Pago nao configurado." }, { status: 500 });
    }

    const idempotency = `multa-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const body = {
      transaction_amount: valor,
      description: `Multa.AI — ${plano}`,
      payment_method_id: "pix",
      payer: {
        email: email || "cliente@multa.ai",
        first_name: nome?.split(" ")[0] || "Cliente",
        last_name: nome?.split(" ").slice(1).join(" ") || "Multa AI",
      },
    };

    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Idempotency-Key": idempotency,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[MULTA-AI] MP error:", data);
      return Response.json({ error: data.message || "Erro ao criar PIX." }, { status: 502 });
    }

    const pix = data.point_of_interaction?.transaction_data;

    return Response.json({
      id: data.id,
      status: data.status,
      qr_code: pix?.qr_code,
      qr_code_base64: pix?.qr_code_base64,
      expiracao: data.date_of_expiration,
    });

  } catch (err) {
    console.error("[MULTA-AI] Erro interno PIX:", err);
    return Response.json({ error: "Erro interno: " + err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "ID obrigatorio." }, { status: 400 });

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    const data = await res.json();
    return Response.json({ status: data.status, status_detail: data.status_detail });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
