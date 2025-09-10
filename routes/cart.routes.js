import express from "express"
import { createCart } from "../controllers/cartController.js"

const route = express.Router()

route.post("/", createCart)

export default route