import { model, Schema } from "mongoose";

const cartProduct = {
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Products",
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
}

const CartSchema = new Schema({
    cart: {
        type: [cartProduct],
        require: true
    }
}, { timestamps: true })

export const Cart = model("Cart", CartSchema)