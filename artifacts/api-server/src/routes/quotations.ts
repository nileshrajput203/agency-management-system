import { Router } from "express";
import { db } from "@workspace/db";
import { quotationsTable, invoicesTable, clientsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

let invoiceCounterQ = 3000;

async function generateQuotationNumber(): Promise<string> {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(quotationsTable);
    const n = (Number(count) + 1).toString().padStart(5, "0");
    return `QT-${n}`;
  } catch {
    return `QT-${Date.now()}`;
  }
}

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: quotationsTable.id,
        number: quotationsTable.number,
        clientId: quotationsTable.clientId,
        joinedClientName: clientsTable.companyName,
        status: quotationsTable.status,
        quotationDate: quotationsTable.quotationDate,
        validUntil: quotationsTable.validUntil,
        dueDate: quotationsTable.dueDate,
        currency: quotationsTable.currency,
        companyName: quotationsTable.companyName,
        companyPhone: quotationsTable.companyPhone,
        companyGstin: quotationsTable.companyGstin,
        companyAddress: quotationsTable.companyAddress,
        companyCity: quotationsTable.companyCity,
        companyPostal: quotationsTable.companyPostal,
        companyState: quotationsTable.companyState,
        companyEmail: quotationsTable.companyEmail,
        companyPan: quotationsTable.companyPan,
        logoUrl: quotationsTable.logoUrl,
        clientName: quotationsTable.clientName,
        clientPhone: quotationsTable.clientPhone,
        clientGstin: quotationsTable.clientGstin,
        clientAddress: quotationsTable.clientAddress,
        clientCity: quotationsTable.clientCity,
        clientPostal: quotationsTable.clientPostal,
        clientState: quotationsTable.clientState,
        clientEmail: quotationsTable.clientEmail,
        clientPan: quotationsTable.clientPan,
        billingAddress: quotationsTable.billingAddress,
        shippingAddress: quotationsTable.shippingAddress,
        lineItems: quotationsTable.lineItems,
        subtotal: quotationsTable.subtotal,
        taxAmount: quotationsTable.taxAmount,
        discount: quotationsTable.discount,
        discountType: quotationsTable.discountType,
        total: quotationsTable.total,
        notes: quotationsTable.notes,
        termsAndConditions: quotationsTable.termsAndConditions,
        signatureText: quotationsTable.signatureText,
        bankDetails: quotationsTable.bankDetails,
        createdAt: quotationsTable.createdAt,
      })
      .from(quotationsTable)
      .leftJoin(clientsTable, eq(quotationsTable.clientId, clientsTable.id));

    const mapped = rows.map((r) => ({
      ...r,
      clientName: r.clientName || r.joinedClientName || null,
    }));
    return res.json(mapped);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.clientId) delete body.clientId;
    if (!body.number) body.number = await generateQuotationNumber();
    const [row] = await db.insert(quotationsTable).values(body).returning();
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.clientId === "") body.clientId = null;
    const [row] = await db
      .update(quotationsTable)
      .set(body)
      .where(eq(quotationsTable.id, req.params.id))
      .returning();
    return res.json(row);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(quotationsTable).where(eq(quotationsTable.id, req.params.id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/:id/convert-to-invoice", async (req, res) => {
  try {
    const [quot] = await db
      .select()
      .from(quotationsTable)
      .where(eq(quotationsTable.id, req.params.id));
    if (!quot) return res.status(404).json({ error: "Not found" });

    invoiceCounterQ++;
    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        number: `INV-${invoiceCounterQ}`,
        clientId: quot.clientId,
        status: "DRAFT",
        subtotal: quot.subtotal,
        taxAmount: quot.taxAmount,
        total: quot.total,
        notes: quot.notes,
        companyGstin: quot.companyGstin,
        clientGstin: quot.clientGstin,
        billingAddress: quot.billingAddress,
        shippingAddress: quot.shippingAddress,
        termsAndConditions: quot.termsAndConditions,
        bankDetails: quot.bankDetails as unknown as typeof invoicesTable.$inferInsert["bankDetails"],
        lineItems: quot.lineItems as unknown as typeof invoicesTable.$inferInsert["lineItems"],
      })
      .returning();

    await db
      .update(quotationsTable)
      .set({ status: "APPROVED" })
      .where(eq(quotationsTable.id, req.params.id));

    return res.status(201).json(invoice);
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
