import { Router } from "express";
import { db } from "@workspace/db";
import { quotations, invoices, clients } from "@workspace/db/schema";
import type { LineItem } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

function calcTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce((s, item) => s + item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100), 0);
  const tax = lineItems.reduce((s, item) => {
    const base = item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100);
    return s + base * ((item.taxPercent ?? 0) / 100);
  }, 0);
  return { subtotal, tax, total: subtotal + tax };
}

function generateNumber(prefix: string) {
  const now = new Date();
  return `${prefix}-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
}

router.get("/quotations", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.query as Record<string, string>;
    const allQuotations = await db.select().from(quotations)
      .where(clientId ? eq(quotations.clientId, clientId) : undefined)
      .orderBy(sql`created_at desc`);

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;

    res.json(allQuotations.map((q) => ({ ...q, clientName: clientMap[q.clientId] ?? null, createdAt: q.createdAt.toISOString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const lineItems: LineItem[] = data.lineItems ?? [];
    const { subtotal, tax, total } = calcTotals(lineItems);

    const [quotation] = await db.insert(quotations).values({
      id: createId(),
      number: generateNumber("QUO"),
      clientId: data.clientId,
      status: "DRAFT",
      lineItems,
      subtotal,
      tax,
      discount: data.discount ?? 0,
      total,
      notes: data.notes ?? null,
      validUntil: data.validUntil ?? null,
    }).returning();
    res.status(201).json({ ...quotation, clientName: null, createdAt: quotation.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quotations/:id", requireAuth, async (req, res) => {
  try {
    const quotation = await db.query.quotations.findFirst({ where: eq(quotations.id, (req.params.id as string)) });
    if (!quotation) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...quotation, clientName: null, createdAt: quotation.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quotations/:id", requireAuth, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    if (req.body.lineItems) {
      const { subtotal, tax, total } = calcTotals(req.body.lineItems);
      Object.assign(updateData, { subtotal, tax, total });
    }
    const [updated] = await db.update(quotations).set(updateData).where(eq(quotations.id, (req.params.id as string))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, clientName: null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/quotations/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(quotations).where(eq(quotations.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations/:id/convert", requireAuth, async (req, res) => {
  try {
    const quotation = await db.query.quotations.findFirst({ where: eq(quotations.id, (req.params.id as string)) });
    if (!quotation) { res.status(404).json({ error: "Quotation not found" }); return; }

    const [invoice] = await db.insert(invoices).values({
      id: createId(),
      number: generateNumber("INV"),
      clientId: quotation.clientId,
      status: "DRAFT",
      lineItems: quotation.lineItems as LineItem[],
      subtotal: quotation.subtotal,
      tax: quotation.tax,
      discount: quotation.discount,
      total: quotation.total,
      notes: quotation.notes,
      invoiceDate: new Date().toISOString().slice(0, 10),
    }).returning();

    await db.update(quotations).set({ status: "APPROVED" }).where(eq(quotations.id, (req.params.id as string)));

    res.status(201).json({ ...invoice, clientName: null, createdAt: invoice.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
