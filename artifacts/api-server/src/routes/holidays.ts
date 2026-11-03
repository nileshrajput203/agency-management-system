import { Router } from "express";
import { db } from "@workspace/db";
import { holidaysTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

// GET /api/holidays — list company & national holidays
router.get("/", requirePermission("attendance.view"), asyncHandler(async (_req, res) => {
  const rows = await db
    .select()
    .from(holidaysTable)
    .orderBy(asc(holidaysTable.date));
  return res.json(rows);
}));

// POST /api/holidays — create new holiday
router.post("/", requirePermission("attendance.manage"), asyncHandler(async (req, res) => {
  const { name, date, type = "COMPANY", isPaid = true } = req.body || {};

  if (!name || typeof name !== "string") {
    throw createError("Holiday name is required", 400);
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError("Valid date in YYYY-MM-DD format is required", 400);
  }

  const [row] = await db
    .insert(holidaysTable)
    .values({
      name: name.trim(),
      date,
      type: ["NATIONAL", "FESTIVAL", "COMPANY"].includes(type) ? type : "COMPANY",
      isPaid: Boolean(isPaid),
    })
    .returning();

  return res.status(201).json(row);
}));

// DELETE /api/holidays/:id — delete holiday
router.delete("/:id", requirePermission("attendance.manage"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const [deleted] = await db.delete(holidaysTable).where(eq(holidaysTable.id, id)).returning({ id: holidaysTable.id });
  if (!deleted) throw createError("Holiday not found", 404);
  return res.status(204).send();
}));

export default router;
