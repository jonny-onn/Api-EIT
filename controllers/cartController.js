import { Cart } from "../models/Cart.js"


export const createCart = async (req, res) => {
    const {body} = req

    try {
        console.log("Carrito recibido:", JSON.stringify(body, null, 2))

        // Permitir enviar array directo 
        const payload = Array.isArray(body) ? { cart: body } : body;

        // Validar estructura básica
        if (!payload?.cart || !Array.isArray(payload.cart) || payload.cart.length === 0) {
            return res.status(400).json({ ok: false, msg: "Formato inválido. Debe enviar un array con productos del carrito." })
        }

        const cart = await Cart.create(payload)

        res.json({
            ok: true,
            msg: "Carrito creado correctamente.",
            cart
        }) 
    } catch (error) {
        console.log("Error interno:", error)
        res.status(500).json({
            ok: false,
            msg: "Error de servidor."
        })
    }
}