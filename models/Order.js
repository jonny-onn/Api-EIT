import { Schema, model } from "mongoose";

const OrderItemSchema = new Schema({
  productId: { type: String },
  title: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit_price: { type: Number, required: true },
});

const OrderSchema = new Schema(
  {
    preferenceId: { type: String, index: true },
    paymentId: { type: String, index: true },
    status: { type: String, default: 'pending' },
    items: { type: [OrderItemSchema], default: [] },
    total: { type: Number, default: 0 },
    payerEmail: { type: String },
  externalReference: { type: String },
    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Order = model('Order', OrderSchema);
