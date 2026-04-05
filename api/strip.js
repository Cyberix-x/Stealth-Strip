/**
 * api/strip.js — Vercel Serverless Function
 *
 * POST /api/strip
 * Accepts: multipart/form-data with field "image"
 * Returns: binary image buffer (metadata stripped) via sharp
 *          Header X-Total-Processed: <global counter from MongoDB>
 */

import sharp from "sharp";
import { IncomingForm } from "formidable";
import fs from "fs";
import { connectDB } from "../lib/db.js";
import Counter from "../lib/models/Counter.js";

// Disable default body parser — formidable handles it
export const config = {
  api: { bodyParser: false },
};

// Parse multipart form
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ keepExtensions: true, maxFileSize: 20 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ── 1. Parse uploaded file ───────────────────────────────────────────────
    const { files } = await parseForm(req);
    const uploaded = files.image;
    if (!uploaded) {
      return res.status(400).json({ error: "No image field in form data." });
    }

    const filePath = Array.isArray(uploaded) ? uploaded[0].filepath : uploaded.filepath;
    const mimeType = Array.isArray(uploaded) ? uploaded[0].mimetype : uploaded.mimetype;
    const inputBuffer = fs.readFileSync(filePath);

    // ── 2. Strip metadata with sharp ────────────────────────────────────────
    // sharp().toBuffer() re-encodes the image without any EXIF/XMP/IPTC data
    const cleanedBuffer = await sharp(inputBuffer)
      .rotate()          // auto-rotate based on EXIF orientation (then drops EXIF)
      .withMetadata(false) // explicit: strip ALL metadata
      .toBuffer();

    // ── 3. Increment global counter in MongoDB ───────────────────────────────
    let totalProcessed = 0;
    try {
      await connectDB();
      const doc = await Counter.findOneAndUpdate(
        { _id: "global" },
        { $inc: { totalFilesProcessed: 1 } },
        { upsert: true, new: true }
      );
      totalProcessed = doc.totalFilesProcessed;
    } catch (dbErr) {
      // Non-fatal: DB is down. Log and continue.
      console.error("MongoDB counter error:", dbErr.message);
    }

    // ── 4. Return cleaned image ──────────────────────────────────────────────
    const outputMime = mimeType || "image/jpeg";
    res.setHeader("Content-Type", outputMime);
    res.setHeader("Content-Disposition", "attachment; filename=cleaned_image.jpg");
    res.setHeader("X-Total-Processed", String(totalProcessed));
    res.setHeader("Access-Control-Expose-Headers", "X-Total-Processed");
    return res.status(200).send(cleanedBuffer);

  } catch (err) {
    console.error("strip handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
