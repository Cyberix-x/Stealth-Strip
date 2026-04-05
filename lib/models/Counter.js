/**
 * lib/models/Counter.js — Mongoose model for global stats counter
 */

import mongoose from "mongoose";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },         // e.g. "global"
  totalFilesProcessed: { type: Number, default: 0 },
});

// Prevent model re-registration on hot-reload
const Counter =
  mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

export default Counter;
