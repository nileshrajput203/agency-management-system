import { Router } from "express";
import { db } from "@workspace/db";
import { vendorsTable } from "@workspace/db/schema";
import { eq, desc, asc, and, isNull, or, ilike } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

function sanitizeVendor(body: any, isUpdate = false) {
  if (!isUpdate && (!body.name || typeof body.name !== "string" || body.name.trim() === "")) {
    throw createError("Vendor / Creator name is required", 400);
  }
  return sanitizeAndValidate(body, {
    numbers: ["followerCount", "commercialRatePerReel"],
    enums: {
      vendorType: ["VENDOR", "FREELANCER", "INFLUENCER"],
    },
  });
}

// GET /api/vendors — list all active vendors and influencers
router.get("/", requirePermission("purchase_orders.view"), asyncHandler(async (req, res) => {
  const { type, niche, search } = req.query as Record<string, string>;

  const conditions = [isNull(vendorsTable.deletedAt)];

  if (type) {
    conditions.push(eq(vendorsTable.vendorType, type.toUpperCase()));
  }
  if (niche) {
    conditions.push(ilike(vendorsTable.niche, `%${niche}%`));
  }
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(vendorsTable.name, q),
        ilike(vendorsTable.instagramHandle, q),
        ilike(vendorsTable.contactPerson, q),
        ilike(vendorsTable.email, q),
        ilike(vendorsTable.city, q)
      )!
    );
  }

  const rows = await db
    .select()
    .from(vendorsTable)
    .where(and(...conditions))
    .orderBy(asc(vendorsTable.name));

  return res.json(rows);
}));

// GET /api/vendors/:id — get single vendor/creator
router.get("/:id", requirePermission("purchase_orders.view"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid vendor ID format", 400);

  const [row] = await db
    .select()
    .from(vendorsTable)
    .where(and(eq(vendorsTable.id, id), isNull(vendorsTable.deletedAt)));

  if (!row) throw createError("Vendor not found", 404);
  return res.json(row);
}));

// POST /api/vendors — create vendor or creator
router.post("/", requirePermission("purchase_orders.create"), asyncHandler(async (req, res) => {
  const sanitized = sanitizeVendor(req.body, false);
  const userId = (req as any).userId;

  const [row] = await db
    .insert(vendorsTable)
    .values({
      ...sanitized,
      createdBy: userId,
    })
    .returning();

  return res.status(201).json(row);
}));

// PATCH /api/vendors/:id — update vendor
router.patch("/:id", requirePermission("purchase_orders.edit"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid vendor ID format", 400);

  const sanitized = sanitizeVendor(req.body, true);
  const userId = (req as any).userId;

  const [row] = await db
    .update(vendorsTable)
    .set({
      ...sanitized,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(and(eq(vendorsTable.id, id), isNull(vendorsTable.deletedAt)))
    .returning();

  if (!row) throw createError("Vendor not found", 404);
  return res.json(row);
}));

// DELETE /api/vendors/:id — soft delete vendor
router.delete("/:id", requirePermission("purchase_orders.delete"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid vendor ID format", 400);

  const [row] = await db
    .update(vendorsTable)
    .set({
      deletedAt: new Date(),
      isActive: false,
      updatedBy: (req as any).userId,
    })
    .where(and(eq(vendorsTable.id, id), isNull(vendorsTable.deletedAt)))
    .returning({ id: vendorsTable.id });

  if (!row) throw createError("Vendor not found", 404);
  return res.status(204).send();
}));

export default router;

