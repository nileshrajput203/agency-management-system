import { Router } from "express";
import { db, contentPostsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";

const router = Router();

// POST /api/client/feedback — store content post feedback/comment
router.post("/feedback", asyncHandler(async (req, res) => {
  const { postId, comment } = req.body as { postId?: string; comment?: string };
  if (!postId || !comment) throw createError("postId and comment are required", 400);

  if (!isValidUUID(postId)) {
    throw createError("Invalid postId format", 400);
  }

  const sanitized = sanitizeAndValidate({ postId, comment });
  const userId = (req as any).userId ?? null;

  // Store as a comment on the content post's comments JSON column
  const [post] = await db
    .select({ id: contentPostsTable.id, comments: contentPostsTable.comments })
    .from(contentPostsTable)
    .where(eq(contentPostsTable.id, sanitized.postId))
    .limit(1);

  if (!post) throw createError("Post not found", 404);

  const existing = Array.isArray(post.comments) ? post.comments : [];

  const newComment = {
    id: crypto.randomUUID(),
    userId,
    comment: sanitized.comment,
    createdAt: new Date().toISOString(),
  };
  const updated = [...existing, newComment];

  await db
    .update(contentPostsTable)
    .set({ comments: updated })
    .where(eq(contentPostsTable.id, sanitized.postId));

  return res.status(201).json(newComment);
}));

export default router;
