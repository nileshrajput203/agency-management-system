import { Router } from "express";
import { db } from "@workspace/db";
import { contentPostsTable, clientsTable, clientCalendarSharesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { clientId } = req.query as Record<string, string>;
    const rows = await db
      .select({
        id: contentPostsTable.id,
        platform: contentPostsTable.platform,
        contentType: contentPostsTable.contentType,
        status: contentPostsTable.status,
        caption: contentPostsTable.caption,
        description: contentPostsTable.description,
        referenceUrl: contentPostsTable.referenceUrl,
        assetsLink: contentPostsTable.assetsLink,
        scheduledAt: contentPostsTable.scheduledAt,
        shootDate: contentPostsTable.shootDate,
        clientId: contentPostsTable.clientId,
        clientName: clientsTable.companyName,
        title: contentPostsTable.title,
        script: contentPostsTable.script,
        ideation: contentPostsTable.ideation,
        format: contentPostsTable.format,
        needsRevision: contentPostsTable.needsRevision,
        referenceLinks: contentPostsTable.referenceLinks,
        customProperties: contentPostsTable.customProperties,
        comments: contentPostsTable.comments,
        createdAt: contentPostsTable.createdAt,
      })
      .from(contentPostsTable)
      .leftJoin(clientsTable, eq(contentPostsTable.clientId, clientsTable.id));

    let filtered = rows;
    if (clientId) {
      filtered = filtered.filter((r) => r.clientId === clientId);
    }
    return res.json(filtered);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.clientId) delete body.clientId;
    if (!body.referenceUrl) delete body.referenceUrl;
    if (!body.description) delete body.description;
    const [row] = await db.insert(contentPostsTable).values(body).returning();
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(contentPostsTable)
      .set(req.body)
      .where(eq(contentPostsTable.id, req.params.id))
      .returning();
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(contentPostsTable).where(eq(contentPostsTable.id, req.params.id));
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

// ─── Share Calendar Routes ────────────────────────────────────

router.post("/shares", async (req, res) => {
  try {
    const { clientId, label, expiresAt } = req.body;
    const { randomUUID } = await import("crypto");
    const shareToken = randomUUID();

    const [share] = await db
      .insert(clientCalendarSharesTable)
      .values({
        clientId,
        shareToken,
        label: label ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    res.status(201).json(share);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shares", async (req, res) => {
  try {
    const { clientId } = req.query;
    const shares = await db
      .select()
      .from(clientCalendarSharesTable)
      .where(clientId ? eq(clientCalendarSharesTable.clientId, clientId as string) : undefined);
    res.json(shares);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
