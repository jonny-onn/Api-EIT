import { Router } from "express";
import { createCheckoutPreference, webhook, processPayment, testPreference } from "../controllers/checkoutController.js";

const route = Router()

route.post("/", createCheckoutPreference)
route.post("/test", testPreference)
route.post("/process_payment", processPayment)
route.post("/webhook", webhook)

export default route