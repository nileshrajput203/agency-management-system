import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { storedFilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission } from "../middleware/auth";
import { logger } from "../lib/logger";

const router = Router();

export const UPLOADS_DIR = process.env.UPLOADS_DIR || (process.env.VERCEL ? "/tmp/uploads" : path.resolve(process.cwd(), "uploads"));
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (_) {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || "52428800", 10);

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = /image\/(jpeg|jpg|png|gif|webp|svg\+xml)|video\/(mp4|quicktime|x-msvideo|x-matroska|webm)|application\/pdf/;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images, videos, and PDFs are allowed"));
    }
  },
});

/**
 * Public file serving handler with Serverless /tmp cache fallback.
 * Checks local disk (/tmp/uploads) first. If missing (container recycle),
 * fetches from the PostgreSQL `stored_files` table, restores to disk, and streams.
 */
export async function serveUploadedFile(req: Request, res: Response) {
  const raw = req.params.filename;
  const filename = path.basename(Array.isArray(raw) ? raw[0] : (raw || req.path));
  if (!filename || filename === "." || filename === "/") {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const localFilePath = path.join(UPLOADS_DIR, filename);

  // 1. Fast path: file is still on disk
  if (fs.existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  // 2. Fallback path: file was wiped from /tmp on serverless cold start; stream from DB
  try {
    const [stored] = await db
      .select()
      .from(storedFilesTable)
      .where(eq(storedFilesTable.filename, filename))
      .limit(1);

    if (!stored || !stored.data) {
      return res.status(404).json({ error: "File not found" });
    }

    const buffer = Buffer.from(stored.data, "base64");

    // Cache back to local /tmp for subsequent requests on this warm instance
    try {
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      fs.writeFileSync(localFilePath, buffer);
    } catch (_) {}

    res.setHeader("Content-Type", stored.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(buffer);
  } catch (err: any) {
    logger.error({ err, filename }, "Failed to stream file from stored_files DB fallback");
    return res.status(500).json({ error: "Failed to retrieve file" });
  }
}

// GET /api/uploads/:filename fallback (if reached via router)
router.get("/:filename", serveUploadedFile);

// POST /api/uploads
router.post("/", requirePermission("attachments.upload"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const filename = req.file.filename;
  const url = `/api/uploads/${filename}`;

  // Persist small files (avatars, thumbnails, receipts <= 2MB) in DB for serverless durability without exhausting DB capacity
  if (req.file.size <= 2 * 1024 * 1024) {
    try {
      const buffer = fs.readFileSync(req.file.path);
      const base64Data = buffer.toString("base64");

      await db
        .insert(storedFilesTable)
        .values({
          id: crypto.randomUUID(),
          filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          data: base64Data,
        })
        .onConflictDoNothing();
    } catch (dbErr) {
      logger.warn({ dbErr, filename }, "Non-fatal: could not persist upload to database fallback table");
    }
  }

  res.status(201).json({
    url,
    filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

export default router;
