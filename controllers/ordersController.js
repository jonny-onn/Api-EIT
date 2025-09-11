import { Order } from "../models/Order.js";

export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ ok: true, orders });
  } catch (error) {
    console.log("Error interno:", error);
    res.status(500).json({ ok: false, msg: "Error de servidor." });
  }
};

export const getOrderById = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: "Orden no encontrada" });
    res.json({ ok: true, order });
  } catch (error) {
    console.log("Error interno:", error);
    res.status(500).json({ ok: false, msg: "Error de servidor." });
  }
};
