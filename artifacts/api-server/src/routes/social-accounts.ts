import { Router } from "express";
import { db } from "@workspace/db";
import { clientSocialAccountsTable, contentPostsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    const rows = clientId
      ? await db.select().from(clientSocialAccountsTable).where(eq(clientSocialAccountsTable.clientId, clientId))
      : await db.select().from(clientSocialAccountsTable);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { clientId, platform, handle, pageId, profileUrl, accessToken } = req.body;
    if (!clientId || !platform) {
      res.status(400).json({ error: "clientId and platform are required" });
      return;
    }
    const [row] = await db
      .insert(clientSocialAccountsTable)
      .values({ clientId, platform, handle, pageId, profileUrl, accessToken })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { handle, pageId, profileUrl, accessToken, isActive } = req.body;
    const [row] = await db
      .update(clientSocialAccountsTable)
      .set({ handle, pageId, profileUrl, accessToken, isActive })
      .where(eq(clientSocialAccountsTable.id, req.params.id!))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.delete(clientSocialAccountsTable).where(eq(clientSocialAccountsTable.id, req.params.id!));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ignite", async (req, res) => {
  try {
    const { clientId, caption, platforms, scheduledAt, title } = req.body as {
      clientId: string;
      caption: string;
      platforms: string[];
      scheduledAt?: string;
      title?: string;
    };
    if (!clientId || !caption || !platforms?.length) {
      res.status(400).json({ error: "clientId, caption and platforms required" });
      return;
    }
    const rows = await db
      .insert(contentPostsTable)
      .values(
        platforms.map((platform) => ({
          clientId,
          platform,
          caption,
          title: title || undefined,
          scheduledAt: scheduledAt || undefined,
          status: "SCHEDULED",
          contentType: "POST",
        })),
      )
      .returning();
    res.status(201).json({ created: rows.length, posts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
