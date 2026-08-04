import { Router } from "express";
import { db } from "@workspace/db";
import { leadsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

const STAGES = ["LEAD", "CONTACTED", "DEMO_GIVEN", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"];

function sanitizeLead(body: any, isUpdate = false) {
  if (!isUpdate && (!body.title || typeof body.title !== "string" || body.title.trim() === "")) {
    throw createError("Lead title is required", 400);
  }
  return sanitizeAndValidate(body, {
    dates: ["expectedCloseDate", "stageChangedAt", "nextCallDate"],
    numbers: ["value", "probability"],
    enums: {
      stage: STAGES,
    }
  });
}

router.get("/", requirePermission("sales.view"), asyncHandler(async (req, res) => {
  const rows = await db.select().from(leadsTable);
  const now = Date.now();
  const result = rows.map((lead) => ({
    ...lead,
    daysInStage: lead.stageChangedAt
      ? Math.floor((now - new Date(lead.stageChangedAt).getTime()) / 86400000)
      : 0,
  }));
  return res.json(result);
}));

router.get("/pipeline-summary", requirePermission("sales.view"), asyncHandler(async (req, res) => {
  const allLeads = await db
    .select({
      stage: leadsTable.stage,
      value: leadsTable.value,
    })
    .from(leadsTable);

  const stageCounts: Record<string, number> = {};
  const stageValues: Record<string, number> = {};

  for (const lead of allLeads) {
    if (lead.stage) {
      stageCounts[lead.stage] = (stageCounts[lead.stage] || 0) + 1;
      stageValues[lead.stage] = (stageValues[lead.stage] || 0) + (Number(lead.value) || 0);
    }
  }

  const summary = STAGES.map((stage) => ({
    stage,
    count: stageCounts[stage] ?? 0,
    totalValue: stageValues[stage] ?? 0,
  }));
  return res.json(summary);
}));

router.post("/", requirePermission("sales.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeLead(body, false);
  const [row] = await db
    .insert(leadsTable)
    .values({ ...sanitized, stageChangedAt: new Date() })
    .returning();
  return res.status(201).json(row);
}));

router.patch("/:id", requirePermission("sales.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeLead(body, true);
  const updates: Record<string, unknown> = { ...sanitized };
  if (sanitized.stage) updates.stageChangedAt = new Date();
  const [row] = await db
    .update(leadsTable)
    .set(updates)
    .where(eq(leadsTable.id, (req.params.id as string)))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("sales.delete"), asyncHandler(async (req, res) => {
  await db.delete(leadsTable).where(eq(leadsTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

// Returns leads with a nextCallDate that is today or overdue (for Sales Tasks tab)
router.get("/scheduled-calls", requirePermission("sales.view"), asyncHandler(async (req, res) => {
  const rows = await db.select().from(leadsTable);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scheduled = rows
    .filter((l) => l.nextCallDate && new Date(l.nextCallDate) <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30))
    .map((lead) => {
      const callDate = new Date(lead.nextCallDate!);
      const isOverdue = callDate < todayStart;
      const isToday = callDate >= todayStart && callDate < new Date(todayStart.getTime() + 86400000);
      return {
        ...lead,
        daysInStage: lead.stageChangedAt
          ? Math.floor((Date.now() - new Date(lead.stageChangedAt).getTime()) / 86400000)
          : 0,
        callStatus: isOverdue ? "OVERDUE" : isToday ? "TODAY" : "UPCOMING",
      };
    })
    .sort((a, b) => new Date(a.nextCallDate!).getTime() - new Date(b.nextCallDate!).getTime());
  return res.json(scheduled);
}));

export default router;
