import { Message } from "../models/Message.js"


export const postMessage = async (req, res) => {
    try {
        
        await Message.create(req.body)

        res.json({
            ok: true,
            msg: "Mensaje enviado correctamente."
        })

    } catch (error) {
        console.log("Error interno:", error)
        res.status(500).json({
            ok: false,
            msg: "Error de servidor."
        })
    }
} 