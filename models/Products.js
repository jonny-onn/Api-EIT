import { model, Schema } from "mongoose";


const ProductSchema = new Schema({
    name: {
        type: String,
        unique: true,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        default: 0
    },
    brand: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        required: true
    },
    longDescription: {
        type: String
    },
    freeShipping: {
        type: Boolean,
        default: false
    },
    img: {
        type: String,
        required: true
    },
    ageFrom: {
        type: Number,
    },
    ageTo: {
        type: Number,
    },
    deletedAt: {
        type: Date,
    },
}, {timestamps: true})

ProductSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id
}})

export const Products = model("Product", ProductSchema)