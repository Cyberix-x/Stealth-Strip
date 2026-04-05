/**
 * lib/db.js — MongoDB connection utility
 *
 * Uses a module-level cached promise so Vercel serverless functions
 * reuse an existing connection across warm invocations (connection pooling).
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local or Vercel dashboard."
  );
}

// Module-level connection cache (survives warm Lambda re-use)
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

/**
 * connectDB()
 * Returns a live Mongoose connection. Call this at the top of every handler.
 */
export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,   // fail fast if not connected
      serverSelectionTimeoutMS: 5000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow retry on next call
    throw err;
  }

  return cached.conn;
}
