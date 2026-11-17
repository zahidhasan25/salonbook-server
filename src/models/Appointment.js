import mongoose from "mongoose";

export const TIME_SLOTS = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM",
];

const appointmentSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    // Better Auth user id (string), NOT a Mongo ObjectId — the `user`
    // collection is owned by Better Auth and its ids are strings.
    customerId: { type: String, required: true },
    appointmentDate: { type: Date, required: true },
    timeSlot: { type: String, required: true, enum: TIME_SLOTS },
    message: { type: String, default: "" },
    servicePrice: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
  },
  { timestamps: true }
);

// Prevent duplicate active appointments for same customer + service + date + slot (enforced in route too, with a clear 409).
appointmentSchema.index(
  { customerId: 1, serviceId: 1, appointmentDate: 1, timeSlot: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "confirmed"] } } }
);

export default mongoose.model("Appointment", appointmentSchema);
