import { Cart } from "../models/Cart.js"


export const createCart = async (req, res) => {
    const { body } = req;
    try {
        console.log("[Cart] Body recibido:", JSON.stringify(body, null, 2));

        // Permitir omitir guardado para pruebas: /api/cart?skip=1
        if (req.query.skip === '1') {
            return res.json({ ok: true, skipped: true, msg: 'Guardado omitido (flag skip=1)' });
        }

        const payload = Array.isArray(body) ? { cart: body } : body;
        if (!payload?.cart || !Array.isArray(payload.cart) || payload.cart.length === 0) {
            return res.status(400).json({ ok: false, msg: "Formato inválido. Se espera { cart: [ { productId, quantity } ] }." });
        }

        const cleaned = payload.cart.map((item, idx) => {
            const productId = String(item.productId || '').trim();
            const quantity = Number(item.quantity || 0);
            if (!productId) throw new Error(`Item ${idx} sin productId`);
            if (!quantity || quantity <= 0) throw new Error(`Item ${idx} con quantity inválido`);
            return { productId, quantity };
        });

        const cart = await Cart.create({ cart: cleaned });

        return res.json({ ok: true, msg: "Carrito creado correctamente", cart });
    } catch (error) {
        console.log("[Cart] Error:", error?.message || error);
        return res.status(500).json({ ok: false, msg: "Error creando carrito", detail: error?.message || error });
    }
};

export const getCarts = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const carts = await Cart.find().sort({ createdAt: -1 }).limit(limit);
        return res.json({ ok: true, carts, limit });
    } catch (error) {
        console.log('[Cart][GET] Error:', error?.message || error);
        return res.status(500).json({ ok: false, msg: 'Error obteniendo carritos', detail: error?.message || error });
    }
};