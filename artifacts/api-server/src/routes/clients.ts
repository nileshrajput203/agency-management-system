import { Router } from "express";
import { db } from "@workspace/db";
import { clients, contentContracts, projects } from "@workspace/db/schema";
import { eq, ilike, sql, and, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const { search, category, health } = req.query as Record<string, string>;

    let conditions = [];
    if (search) {
      conditions.push(
        sql`(lower(company_name) like ${`%${search.toLowerCase()}%`} or lower(contact_person) like ${`%${search.toLowerCase()}%`} or lower(email) like ${`%${search.toLowerCase()}%`})`
      );
    }
    if (category && category !== "ALL") {
      conditions.push(eq(clients.category, category as any));
    }
    if (health && health !== "ALL") {
      conditions.push(eq(clients.health, health as any));
    }

    const allClients = await db.select().from(clients).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(sql`created_at desc`);

    const projectCounts = await db.select({
      clientId: projects.clientId,
      count: sql<number>`count(*)`,
    }).from(projects).groupBy(projects.clientId);

    const countMap: Record<string, number> = {};
    for (const row of projectCounts) {
      if (row.clientId) countMap[row.clientId] = Number(row.count);
    }

    res.json(allClients.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      projectCount: countMap[c.id] ?? 0,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [client] = await db.insert(clients).values({
      id: createId(),
      companyName: data.companyName,
      contactPerson: data.contactPerson ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      billingAddress: data.billingAddress ?? null,
      gstin: data.gstin ?? null,
      category: data.category ?? "LEAD",
      health: data.health ?? "GREEN",
      source: data.source ?? null,
      internalNotes: data.internalNotes ?? null,
      website: data.website ?? null,
      instagram: data.instagram ?? null,
      facebook: data.facebook ?? null,
      youtube: data.youtube ?? null,
      linkedin: data.linkedin ?? null,
      brandColors: data.brandColors ?? null,
    }).returning();
    res.status(201).json({ ...client, createdAt: client.createdAt.toISOString(), updatedAt: client.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  try {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, (req.params.id as string)),
    });
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json({ ...client, createdAt: client.createdAt.toISOString(), updatedAt: client.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/clients/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(clients)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clients.id, (req.params.id as string)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(clients).where(eq(clients.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/contracts", requireAuth, async (req, res) => {
  try {
    const contracts = await db.select().from(contentContracts)
      .where(eq(contentContracts.clientId, (req.params.id as string)));
    res.json(contracts.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients/:id/contracts", requireAuth, async (req, res) => {
  try {
    const [contract] = await db.insert(contentContracts).values({
      id: createId(),
      clientId: (req.params.id as string),
      platform: req.body.platform,
      postsPerMonth: req.body.postsPerMonth ?? 0,
      reelsPerMonth: req.body.reelsPerMonth ?? 0,
      storiesPerMonth: req.body.storiesPerMonth ?? 0,
      carouselsPerMonth: req.body.carouselsPerMonth ?? 0,
      captionWriting: req.body.captionWriting ?? false,
      hashtagResearch: req.body.hashtagResearch ?? false,
      scheduling: req.body.scheduling ?? false,
      contractMonths: req.body.contractMonths ?? 1,
      startDate: req.body.startDate,
      monthlyRetainer: req.body.monthlyRetainer ?? null,
    }).returning();
    res.status(201).json({ ...contract, createdAt: contract.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
