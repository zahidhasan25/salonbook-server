import mongoose from "mongoose";

export const CATEGORIES = [
  "Haircut & Styling",
  "Hair Coloring",
  "Hair Treatment",
  "Facial & Skincare",
  "Makeup",
  "Manicure & Pedicure",
  "Spa & Massage",
];

const serviceSchema = new mongoose.Schema(
  {
    serviceName: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0.01 },
    duration: { type: Number, required: true, min: 1 }, // minutes
    image: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
