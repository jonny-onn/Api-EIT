import { Schema, model } from "mongoose";

const ProcessedEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String },
  },
  { timestamps: true }
);

export const ProcessedEvent = model("ProcessedEvent", ProcessedEventSchema);
