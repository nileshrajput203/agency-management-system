import { Router } from "express";
import { db } from "@workspace/db";
import { contentPosts, clients, users, contentContracts } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/content", requireAuth, async (req, res) => {
  try {
    const { clientId, month } = req.query as Record<string, string>;
    let conditions = [];
    if (clientId) conditions.push(eq(contentPosts.clientId, clientId));
    if (month) {
      const [year, mo] = month.split("-").map(Number);
      const start = new Date(year, mo - 1, 1);
      const end = new Date(year, mo, 0, 23, 59, 59);
      conditions.push(sql`created_at >= ${start.toISOString()} AND created_at <= ${end.toISOString()}`);
    }

    const allPosts = await db.select().from(contentPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`created_at desc`);

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const clientMap: Record<string, string> = {};
    const userMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;
    for (const u of allUsers) userMap[u.id] = u.name;

    res.json(allPosts.map((p) => ({
      ...p,
      clientName: clientMap[p.clientId] ?? null,
      assigneeName: p.assigneeId ? userMap[p.assigneeId] ?? null : null,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/content", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [post] = await db.insert(contentPosts).values({
      id: createId(),
      clientId: data.clientId,
      platform: data.platform,
      contentType: data.contentType,
      caption: data.caption ?? null,
      hashtags: data.hashtags ?? null,
      status: data.status ?? "IDEA",
      scheduledAt: data.scheduledAt ?? null,
      publishedAt: data.publishedAt ?? null,
      assigneeId: data.assigneeId ?? null,
      notes: data.notes ?? null,
    }).returning();
    res.status(201).json({ ...post, clientName: null, assigneeName: null, createdAt: post.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/content/quota/:clientId/:month", requireAuth, async (req, res) => {
  try {
    const { clientId, month } = req.params as Record<string, string>;
    const [year, mo] = month.split("-").map(Number);
    const start = new Date(year, mo - 1, 1);
    const end = new Date(year, mo, 0, 23, 59, 59);

    const [contract] = await db.select().from(contentContracts)
      .where(eq(contentContracts.clientId, clientId))
      .limit(1);

    const posts = await db.select().from(contentPosts).where(
      and(
        eq(contentPosts.clientId, clientId),
        sql`created_at >= ${start.toISOString()} AND created_at <= ${end.toISOString()}`
      )
    );

    const countByType = (type: string) =>
      posts.filter((p) => p.contentType.toLowerCase() === type.toLowerCase() && ["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(p.status)).length;

    res.json({
      clientId,
      month,
      postsTarget: contract?.postsPerMonth ?? 0,
      postsCompleted: countByType("post"),
      reelsTarget: contract?.reelsPerMonth ?? 0,
      reelsCompleted: countByType("reel"),
      storiesTarget: contract?.storiesPerMonth ?? 0,
      storiesCompleted: countByType("story"),
      carouselsTarget: contract?.carouselsPerMonth ?? 0,
      carouselsCompleted: countByType("carousel"),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/content/:id", requireAuth, async (req, res) => {
  try {
    const post = await db.query.contentPosts.findFirst({ where: eq(contentPosts.id, (req.params.id as string)) });
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ ...post, clientName: null, assigneeName: null, createdAt: post.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/content/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(contentPosts).set({ ...req.body, updatedAt: new Date() })
      .where(eq(contentPosts.id, (req.params.id as string))).returning();
    if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ ...updated, clientName: null, assigneeName: null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/content/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(contentPosts).where(eq(contentPosts.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
