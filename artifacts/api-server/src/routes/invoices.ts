import { Router } from "express";
import { db } from "@workspace/db";
import { invoices, clients } from "@workspace/db/schema";
import type { LineItem } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

function calcTotals(lineItems: LineItem[]) {
  const subtotal = lineItems.reduce((s, item) => {
    return s + item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100);
  }, 0);
  const tax = lineItems.reduce((s, item) => {
    const base = item.quantity * item.unitPrice * (1 - (item.discount ?? 0) / 100);
    return s + base * ((item.taxPercent ?? 0) / 100);
  }, 0);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

function generateNumber(prefix: string) {
  const now = new Date();
  const yr = now.getFullYear().toString().slice(-2);
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${yr}${mo}-${rand}`;
}

router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const { clientId, status } = req.query as Record<string, string>;
    let conditions = [];
    if (clientId) conditions.push(eq(invoices.clientId, clientId));
    if (status) conditions.push(eq(invoices.status, status as any));

    const allInvoices = await db.select().from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`created_at desc`);

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;

    res.json(allInvoices.map((inv) => ({
      ...inv,
      clientName: clientMap[inv.clientId] ?? null,
      createdAt: inv.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/financial-summary", requireAuth, async (_req, res) => {
  try {
    const allInvoices = await db.select().from(invoices);
    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;

    const now = new Date();
    const totalRevenue = allInvoices.filter((i) => i.status === "PAID").reduce((s, i) => s + (i.total ?? 0), 0);
    const outstanding = allInvoices.filter((i) => ["SENT", "VIEWED"].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0);
    const overdue = allInvoices.filter((i) => {
      if (i.status !== "OVERDUE") return false;
      return true;
    }).reduce((s, i) => s + (i.total ?? 0), 0);

    const revenueByClient: Record<string, number> = {};
    for (const inv of allInvoices.filter((i) => i.status === "PAID")) {
      const name = clientMap[inv.clientId] ?? "Unknown";
      revenueByClient[name] = (revenueByClient[name] ?? 0) + (inv.total ?? 0);
    }

    res.json({
      totalRevenue,
      outstanding,
      overdue,
      invoiceCount: allInvoices.length,
      paidCount: allInvoices.filter((i) => i.status === "PAID").length,
      revenueByClient: Object.entries(revenueByClient).map(([clientName, amount]) => ({ clientName, amount })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const lineItems: LineItem[] = data.lineItems ?? [];
    const { subtotal, tax, total } = calcTotals(lineItems);

    const [invoice] = await db.insert(invoices).values({
      id: createId(),
      number: generateNumber("INV"),
      clientId: data.clientId,
      status: "DRAFT",
      lineItems,
      subtotal,
      tax,
      discount: data.discount ?? 0,
      total,
      notes: data.notes ?? null,
      paymentInstructions: data.paymentInstructions ?? null,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate ?? null,
    }).returning();
    res.status(201).json({ ...invoice, clientName: null, createdAt: invoice.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, (req.params.id as string)) });
    if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;
    res.json({ ...invoice, clientName: clientMap[invoice.clientId] ?? null, createdAt: invoice.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    if (req.body.lineItems) {
      const { subtotal, tax, total } = calcTotals(req.body.lineItems);
      Object.assign(updateData, { subtotal, tax, total });
    }
    const [updated] = await db.update(invoices).set(updateData).where(eq(invoices.id, (req.params.id as string))).returning();
    if (!updated) { res.status(404).json({ error: "Invoice not found" }); return; }
    res.json({ ...updated, clientName: null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/invoices/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(invoices).where(eq(invoices.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
