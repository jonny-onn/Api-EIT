import express from "express"
import { createProduct, deleteProduct, getProducts, updateProduct, getProductById } from "../controllers/productsController.js"
import upload from "../utils/storage.js";

const route = express.Router()

route
    .post("/", upload.single("img"), createProduct)
    .get("/", getProducts)
    .get("/:id", getProductById)
    
    .put("/:id", updateProduct)
    .delete("/:id", deleteProduct)
    
    .put("/edit/:id", updateProduct)
    .delete("/delete/:id", deleteProduct)

export default route;