import { MercadoPagoConfig, Preference, Payment } from "mercadopago" // Se mantiene import para otras partes (webhook) pero endpoints principales usarán fetch directo
import { Order } from "../models/Order.js";
import { ProcessedEvent } from "../models/ProcessedEvent.js";
import { createHmac } from "crypto";

export const createCheckoutPreference = async (req, res) => {
    const { body } = req
    try {
        console.log('[Checkout] body recibido:', JSON.stringify(body, null, 2));
        if (!process.env.ACCESS_TOKEN_MP) {
            console.log('[Checkout] Falta ACCESS_TOKEN_MP');
            return res.status(500).json({ ok: false, msg: 'Falta ACCESS_TOKEN_MP en servidor' });
        }
        console.log('[Checkout] ENV resumen:', {
            hasToken: !!process.env.ACCESS_TOKEN_MP,
            tokenPrefix: process.env.ACCESS_TOKEN_MP?.slice(0, 15),
            URL_FRONT: process.env.URL_FRONT
        });
    const externalReference = body.external_reference || `order-${Date.now()}`;

        // Sanitizar items (solo campos requeridos por MP)
        const rawItems = Array.isArray(body.items) ? body.items : [];
        const items = rawItems.map((i, idx) => ({
            id: String(i.id || idx + 1),
            title: String(i.title || 'Item'),
            quantity: Number(i.quantity) || 1,
            unit_price: Number(i.unit_price || i.price || 0),
        }));
        if (!items.length) {
            return res.status(400).json({ ok: false, msg: 'No se enviaron items para la preferencia' });
        }

        const preferenceBody = {
            items,
            back_urls: {
                success: `${process.env.URL_FRONT}/checkout/success`,
                failure: `${process.env.URL_FRONT}/checkout/failure`,
                pending: `${process.env.URL_FRONT}/checkout/pending`
            },
            auto_return: 'approved',
            external_reference: externalReference
        };

        console.log('[Checkout] preferenceBody a enviar:', JSON.stringify(preferenceBody, null, 2));
        // Llamada directa (se omite SDK para evitar errores opacos)
        let response;
        try {
            const fetchFn = (global).fetch || (await import('node-fetch')).default;
            const httpResp = await fetchFn('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.ACCESS_TOKEN_MP}`
                },
                body: JSON.stringify(preferenceBody)
            });
            const json = await httpResp.json();
            if (!httpResp.ok) {
                console.log('[Checkout][HTTP] Error preferencia:', httpResp.status, json);
                return res.status(httpResp.status).json({ ok: false, msg: 'Error HTTP creando preferencia', status: httpResp.status, mp: json });
            }
            response = json;
        } catch (httpErr) {
            console.log('[Checkout][HTTP] Excepción preferencia:', httpErr?.message || httpErr);
            return res.status(500).json({ ok: false, msg: 'Excepción HTTP creando preferencia', detail: httpErr?.message || String(httpErr) });
        }
        console.log('[Checkout] Preferencia creada:', {
            id: response.id,
            init_point: response.init_point,
            sandbox_init_point: response.sandbox_init_point,
            externalReference
        });

        const initPoint = response.init_point || response.sandbox_init_point;

        // Guardar orden preliminar
        const orderItems = items.map(i => ({
            productId: i.id,
            title: i.title,
            quantity: i.quantity,
            unit_price: i.unit_price,
        }));
        const total = orderItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0)
        try {
            await Order.create({ preferenceId: response.id, items: orderItems, total, status: 'created', externalReference })
        } catch (dbErr) {
            console.log('[Checkout] Error guardando Order preliminar:', dbErr?.message || dbErr);
        }

        res.json({
            ok: true,
            preferenceId: response.id,
            initPoint,
            sandboxInitPoint: response.sandbox_init_point,
            externalReference
        })
        
    } catch (error) {
        console.log("[Checkout] Error interno createPreference:", error?.message || error)
        res.status(500).json({
            ok: false,
            msg: "Error de servidor creando preferencia (bloque general)",
            detail: error?.message || String(error),
            stack: error?.stack
        })
    }
}

// Endpoint rápido de prueba de preferencia sin frontend
export const testPreference = async (req, res) => {
    req.body = {
        items: [{ id: 'test-1', title: 'Item Test', quantity: 1, unit_price: 10 }]
    };
    return createCheckoutPreference(req, res);
}

// Endpoint llamado desde el Payment Brick para crear el pago directo
export const processPayment = async (req, res) => {
    const { body } = req;
    try {
        if (!process.env.ACCESS_TOKEN_MP) {
            return res.status(500).json({ ok: false, msg: 'ACCESS_TOKEN_MP no configurado en el servidor' });
        }
        console.log('[processPayment][HTTP] body recibido:', JSON.stringify(body, null, 2));
        const preference_id = body.preference_id || body.preferenceId;
        const transaction_amount = Number(body.transaction_amount ?? body.amount ?? 0);
        if (!preference_id) return res.status(400).json({ ok: false, msg: 'Falta preference_id' });
        if (!transaction_amount || transaction_amount <= 0) return res.status(400).json({ ok: false, msg: 'Monto inválido' });
        const paymentBody = {
            transaction_amount,
            token: body.token,
            description: body.description || 'Compra Juguetería',
            installments: body.installments || 1,
            payment_method_id: body.payment_method_id,
            payer: {
                email: body?.payer?.email || 'test_user_123456@testuser.com',
                identification: body?.payer?.identification
            }
        };
        if (!paymentBody.payment_method_id) return res.status(400).json({ ok: false, msg: 'Falta payment_method_id' });
        const needsToken = paymentBody.payment_method_id !== 'account_money' && paymentBody.payment_method_id !== 'ticket' && paymentBody.payment_method_id !== 'atm';
        if (needsToken && !paymentBody.token) return res.status(400).json({ ok: false, msg: 'Falta token' });

        let response;
        try {
            const fetchFn = (global).fetch || (await import('node-fetch')).default;
            const httpResp = await fetchFn('https://api.mercadopago.com/v1/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.ACCESS_TOKEN_MP}`
                },
                body: JSON.stringify(paymentBody)
            });
            const json = await httpResp.json();
            if (!httpResp.ok) {
                console.log('[processPayment][HTTP] Error pago:', httpResp.status, json);
                return res.status(httpResp.status).json({ ok: false, msg: 'Error HTTP creando pago', status: httpResp.status, mp: json });
            }
            response = json;
        } catch (httpErr) {
            console.log('[processPayment][HTTP] Excepción pago:', httpErr?.message || httpErr);
            return res.status(500).json({ ok: false, msg: 'Excepción HTTP creando pago', detail: httpErr?.message || String(httpErr) });
        }

        console.log('[processPayment][HTTP] respuesta pago:', JSON.stringify(response, null, 2));
        try {
            await Order.findOneAndUpdate(
                { preferenceId: preference_id },
                {
                    paymentId: String(response.id),
                    status: response.status,
                    payerEmail: response.payer?.email,
                    raw: response,
                },
                { new: true }
            );
        } catch (e) { console.log('[processPayment] No se pudo actualizar Order:', e?.message || e); }
        return res.json({ ok: true, payment: response });
    } catch (error) {
        console.log('[processPayment] Error interno (capa superior):', error?.message || error);
        return res.status(500).json({ ok: false, msg: 'Error de servidor (capa superior)', detail: error?.message || String(error) });
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

        // Validación de firma (x-signature) según documentación MP (manifest id:...;request-id:...;ts:...;)
        try {
            const secret = process.env.SECRET_WEBHOOK;
            const xSignature = headers['x-signature'];
            const xRequestId = headers['x-request-id'];
            if (secret && typeof xSignature === 'string') {
                // x-signature formato: ts=...,v1=...
                const parts = xSignature.split(',').map(p => p.trim());
                let ts, hash;
                for (const p of parts) {
                    const [k, v] = p.split('=');
                    if (k === 'ts') ts = v; else if (k === 'v1') hash = v;
                }
                const dataId = query['data.id'] || body?.data?.id || body?.id || '';
                const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts || ''};`;
                const computed = createHmac('sha256', secret).update(manifest).digest('hex');
                const now = Date.now();
                const tsNum = Number(ts);
                const tooOld = !tsNum || Math.abs(now - tsNum) > 5 * 60 * 1000; // 5 minutos tolerancia
                if (computed !== hash || tooOld) {
                    console.log('Webhook MP - firma inválida o timestamp fuera de ventana', { manifest, computed, hash, ts, now });
                    return res.sendStatus(200);
                }
            }
        } catch (e) {
            console.log('Webhook MP - error validando firma:', e?.message || e);
        }

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
