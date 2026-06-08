import { Router } from "express";
import { db } from "@workspace/db";
import { leads, users } from "@workspace/db/schema";
import { eq, notInArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/leads", requireAuth, async (_req, res) => {
  try {
    const allLeads = await db.select().from(leads).orderBy(sql`created_at desc`);
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap: Record<string, string> = {};
    for (const u of allUsers) userMap[u.id] = u.name;

    res.json(allLeads.map((l) => ({
      ...l,
      assigneeName: l.assigneeId ? userMap[l.assigneeId] ?? null : null,
      daysInStage: Math.floor((Date.now() - new Date(l.stageChangedAt).getTime()) / 86400000),
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leads", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [lead] = await db.insert(leads).values({
      id: createId(),
      title: data.title,
      companyName: data.companyName ?? null,
      contactName: data.contactName ?? null,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      value: data.value ?? null,
      stage: data.stage ?? "LEAD",
      probability: data.probability ?? null,
      notes: data.notes ?? null,
      industry: data.industry ?? null,
      assigneeId: data.assigneeId ?? null,
    }).returning();
    res.status(201).json({
      ...lead,
      assigneeName: null,
      daysInStage: 0,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/leads/pipeline-summary", requireAuth, async (_req, res) => {
  try {
    const stages = ["LEAD", "CONTACTED", "DEMO_GIVEN", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"];
    const summary = await db.select({
      stage: leads.stage,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`coalesce(sum(value), 0)`,
    }).from(leads).groupBy(leads.stage);

    const stageMap: Record<string, { count: number; totalValue: number }> = {};
    for (const row of summary) {
      stageMap[row.stage] = { count: Number(row.count), totalValue: Number(row.totalValue) };
    }

    res.json(stages.map((stage) => ({
      stage,
      count: stageMap[stage]?.count ?? 0,
      totalValue: stageMap[stage]?.totalValue ?? 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/leads/:id", requireAuth, async (req, res) => {
  try {
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, (req.params.id as string)) });
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
    res.json({ ...lead, assigneeName: null, daysInStage: 0, createdAt: lead.createdAt.toISOString(), updatedAt: lead.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/leads/:id", requireAuth, async (req, res) => {
  try {
    const existing = await db.query.leads.findFirst({ where: eq(leads.id, (req.params.id as string)) });
    if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }

    const updateData: any = { ...req.body, updatedAt: new Date() };
    if (req.body.stage && req.body.stage !== existing.stage) {
      updateData.stageChangedAt = new Date();
    }

    const [updated] = await db.update(leads).set(updateData).where(eq(leads.id, (req.params.id as string))).returning();
    res.json({ ...updated, assigneeName: null, daysInStage: 0, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/leads/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(leads).where(eq(leads.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
