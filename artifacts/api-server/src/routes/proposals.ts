import { Router } from "express";
import { db } from "@workspace/db";
import { proposals, clients } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/proposals", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.query as Record<string, string>;
    const allProposals = await db.select().from(proposals)
      .where(clientId ? eq(proposals.clientId, clientId) : undefined)
      .orderBy(sql`created_at desc`);

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;

    res.json(allProposals.map((p) => ({
      ...p,
      clientName: clientMap[p.clientId] ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/proposals", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [proposal] = await db.insert(proposals).values({
      id: createId(),
      title: data.title,
      clientId: data.clientId,
      status: "DRAFT",
      content: data.content ?? null,
      template: data.template ?? null,
    }).returning();
    res.status(201).json({ ...proposal, clientName: null, createdAt: proposal.createdAt.toISOString(), updatedAt: proposal.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/proposals/:id", requireAuth, async (req, res) => {
  try {
    const proposal = await db.query.proposals.findFirst({ where: eq(proposals.id, (req.params.id as string)) });
    if (!proposal) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...proposal, clientName: null, createdAt: proposal.createdAt.toISOString(), updatedAt: proposal.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/proposals/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(proposals).set({ ...req.body, updatedAt: new Date() })
      .where(eq(proposals.id, (req.params.id as string))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, clientName: null, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/proposals/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(proposals).where(eq(proposals.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
