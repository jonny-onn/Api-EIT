import { Router } from "express";
import { getOrders, getOrderById } from "../controllers/ordersController.js";

const route = Router();

route.get("/", getOrders);
route.get("/:id", getOrderById);

export default route;
