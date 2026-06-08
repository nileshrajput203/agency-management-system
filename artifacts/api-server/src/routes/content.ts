import { Router } from "express";
import { db } from "@workspace/db";
import { contentPostsTable, clientsTable } from "@workspace/db/schema";
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
        scheduledAt: contentPostsTable.scheduledAt,
        clientId: contentPostsTable.clientId,
        clientName: clientsTable.companyName,
      })
      .from(contentPostsTable)
      .leftJoin(clientsTable, eq(contentPostsTable.clientId, clientsTable.id));

    let filtered = rows;
    if (clientId) {
      filtered = filtered.filter((r) => r.clientId === clientId);
    }
    return res.json(filtered);
  } catch {
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
  } catch {
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
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(contentPostsTable).where(eq(contentPostsTable.id, req.params.id));
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
