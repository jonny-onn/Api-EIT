import { Router } from "express";
import { createCheckoutPreference, processPayment, webhook } from "../controllers/checkoutController.js";

const route = Router()

route.post("/", createCheckoutPreference)
route.post("/process_payment", processPayment)
route.post("/webhook", webhook)

export default route