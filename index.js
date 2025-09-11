import express from "express"
import cors from "cors"
import dotenv from "dotenv"

import { dbConection } from "./database/dbConection.js"

import productRoutes from "./routes/products.routes.js"
import cartRoutes from "./routes/cart.routes.js"
import checkoutRoutes from "./routes/checkout.routes.js"
import messageRoutes from "./routes/massage.routes.js"
import imageRoutes from "./routes/image.routes.js"
import ordersRoutes from "./routes/orders.routes.js"

const server = express();

const api = async () => {
    dotenv.config()

    await dbConection()

    server.use(express.json())
    server.use(cors())

    // Health check y raíz
    server.get("/", (req, res) => res.json({ ok: true, msg: "API EIT" }))
    server.get("/healthz", (req, res) => res.send("ok"))
    server.get("/debug/mp", (req, res) => {
        res.json({
            hasToken: !!process.env.ACCESS_TOKEN_MP,
            tokenFirst6: process.env.ACCESS_TOKEN_MP ? process.env.ACCESS_TOKEN_MP.slice(0, 12) : null,
            urlFront: process.env.URL_FRONT
        })
    })

    server.use("/images", imageRoutes)
    server.use("/api/cart", cartRoutes)
    server.use("/api/checkout", checkoutRoutes)
    server.use("/api/contact", messageRoutes)
    server.use("/api/products", productRoutes)
    server.use("/api/orders", ordersRoutes)

    const PORT = process.env.PORT || 3000
    server.listen(PORT, () => console.log("Servidor corriendo en el puerto", PORT))
}

api()