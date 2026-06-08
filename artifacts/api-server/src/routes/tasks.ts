import { Router } from "express";
import { db } from "@workspace/db";
import { tasks, users, projects } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const { projectId, assigneeId, status } = req.query as Record<string, string>;
    let conditions = [];
    if (projectId) conditions.push(eq(tasks.projectId, projectId));
    if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
    if (status) conditions.push(eq(tasks.status, status as any));

    const allTasks = await db.select().from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`created_at desc`);

    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const allProjects = await db.select({ id: projects.id, name: projects.name }).from(projects);
    const userMap: Record<string, string> = {};
    const projectMap: Record<string, string> = {};
    for (const u of allUsers) userMap[u.id] = u.name;
    for (const p of allProjects) projectMap[p.id] = p.name;

    res.json(allTasks.map((t) => ({
      ...t,
      assigneeName: t.assigneeId ? userMap[t.assigneeId] ?? null : null,
      projectName: t.projectId ? projectMap[t.projectId] ?? null : null,
      createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tasks", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [task] = await db.insert(tasks).values({
      id: createId(),
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      projectId: data.projectId ?? null,
      assigneeId: data.assigneeId ?? null,
      creatorId: req.user!.id,
      dueDate: data.dueDate ?? null,
    }).returning();
    res.status(201).json({ ...task, assigneeName: null, projectName: null, createdAt: task.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, (req.params.id as string)) });
    if (!task) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ ...task, assigneeName: null, projectName: null, createdAt: task.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(tasks).set({ ...req.body, updatedAt: new Date() })
      .where(eq(tasks.id, (req.params.id as string))).returning();
    if (!updated) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ ...updated, assigneeName: null, projectName: null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tasks/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(tasks).where(eq(tasks.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
