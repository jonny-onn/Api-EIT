import { MercadoPagoConfig, Preference, Payment } from "mercadopago"
import { Order } from "../models/Order.js";
import { ProcessedEvent } from "../models/ProcessedEvent.js";
import { createHmac } from "crypto";

export const createCheckoutPreference = async (req, res) => {
    const { body } = req
    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.ACCESS_TOKEN_MP })
        const preference = new Preference(client)

        const response = await preference.create({
            body: {
                ...body,
                back_urls: {
            success: `${process.env.URL_FRONT}/checkout/success`,
            failure: `${process.env.URL_FRONT}/checkout/failure`,
            pending: `${process.env.URL_FRONT}/checkout/pending`
                }   
            }
        })

        // Guardar orden preliminar
        const items = (body.items || []).map((i) => ({
            productId: i.id,
            title: i.title,
            quantity: i.quantity,
            unit_price: i.unit_price,
        }))
        const total = items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0)
        await Order.create({ preferenceId: response.id, items, total, status: 'created' })

        res.json({
            ok: true,
            preferenceId: response.id
        })
        
    } catch (error) {
        console.log("Error interno:", error)
        res.status(500).json({
            ok: false,
            msg: "Error de servidor."
        })
    }
}

export const processPayment = async (req, res) => {
    const { body } = req;
    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.ACCESS_TOKEN_MP });
        const payment = new Payment(client);

        const transaction_amount = Number(body.transaction_amount ?? body.amount ?? 0);
        const payload = {
            ...body,
            transaction_amount,
        };

        const response = await payment.create({ body: payload });

        // Actualizar orden por paymentId o preferenceId
        try {
            await Order.findOneAndUpdate(
                { preferenceId: response.order?.id || payload.preference_id },
                {
                    paymentId: String(response.id),
                    status: response.status,
                    payerEmail: response.payer?.email,
                    raw: response,
                },
                { new: true }
            )
        } catch {}

        res.json({ ok: true, payment: response });
    } catch (error) {
        console.log("Error interno:", error);
        res.status(500).json({ ok: false, msg: "Error de servidor." });
    }
}

// Webhook de Mercado Pago (validación asíncrona de pagos)
export const webhook = async (req, res) => {
    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.ACCESS_TOKEN_MP });
        const payment = new Payment(client);

        const { query, body, headers } = req;
        const type = query.type || query.topic || body?.type;
        const id = query["data.id"] || body?.data?.id || body?.id;

        // Idempotencia básica por eventId (cuando venga en el body)
        const eventId = body?.id || `${type}:${id}`;
        if (eventId) {
            const already = await ProcessedEvent.findOne({ eventId });
            if (already) return res.sendStatus(200);
        }

        // Validación opcional de firma si se configura SECRET_WEBHOOK (no es obligatoria para MP pública)
        try {
            const secret = process.env.SECRET_WEBHOOK;
            const signature = headers["x-signature"] || headers["x-hub-signature"];
            if (secret && signature && typeof signature === 'string') {
                const hmac = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
                const expected = `sha256=${hmac}`;
                if (signature !== expected) {
                    console.log('Webhook MP - firma inválida');
                    return res.sendStatus(200);
                }
            }
        } catch {}

        if (type === 'payment' && id) {
            try {
                const info = await payment.get({ id });
                console.log('Webhook MP - payment:', {
                    id,
                    status: info.status,
                    status_detail: info.status_detail,
                    payer: info.payer?.email,
                    transaction_amount: info.transaction_amount,
                });

                // Persistir estado
                try {
                    // Intentar por paymentId luego por preferenceId
                    let updated = await Order.findOneAndUpdate(
                        { paymentId: String(info.id) },
                        {
                            status: info.status,
                            payerEmail: info.payer?.email,
                            raw: info,
                        },
                        { new: true }
                    )
                    if (!updated && info.order?.id) {
                        updated = await Order.findOneAndUpdate(
                            { preferenceId: info.order.id },
                            {
                                paymentId: String(info.id),
                                status: info.status,
                                payerEmail: info.payer?.email,
                                raw: info,
                            },
                            { new: true }
                        )
                    }
                } catch {}
            } catch (e) {
                console.log('Webhook MP - error obteniendo pago:', e?.message || e);
            }
        } else {
            console.log('Webhook MP - evento recibido:', { query, body });
        }

        // Marcar evento como procesado
        if (eventId) {
            try { await ProcessedEvent.create({ eventId, type }); } catch {}
        }

        // Responder 200 siempre para evitar reintentos excesivos
        return res.sendStatus(200);
    } catch (error) {
        console.log('Webhook MP - error general:', error);
        return res.sendStatus(200);
    }
}