import express from "express"
import { createCart, getCarts } from "../controllers/cartController.js"

const route = express.Router()

route.post("/", createCart)
route.get("/", getCarts)

export default route