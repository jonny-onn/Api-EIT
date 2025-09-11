import { model, Schema } from "mongoose";

const cartProduct = {
    productId: {
        // Aceptar directamente el id string mapeado (no forzar ObjectId para flexibilidad)
        type: String,
        required: true,
        index: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    }
}

const CartSchema = new Schema({
    cart: {
        type: [cartProduct],
        require: true
    }
}, { timestamps: true })

export const Cart = model("Cart", CartSchema)