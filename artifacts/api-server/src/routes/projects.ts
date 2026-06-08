import { Router } from "express";
import { db } from "@workspace/db";
import { projects, clients, tasks } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/projects", requireAuth, async (req, res) => {
  try {
    const { clientId, status } = req.query as Record<string, string>;
    let conditions = [];
    if (clientId) conditions.push(eq(projects.clientId, clientId));
    if (status) conditions.push(eq(projects.status, status as any));

    const allProjects = await db.select().from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`updated_at desc`);

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;

    const taskCounts = await db.select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)`,
      completed: sql<number>`sum(case when status = 'DONE' then 1 else 0 end)`,
    }).from(tasks).groupBy(tasks.projectId);

    const taskCountMap: Record<string, { total: number; completed: number }> = {};
    for (const row of taskCounts) {
      if (row.projectId) taskCountMap[row.projectId] = { total: Number(row.total), completed: Number(row.completed) };
    }

    res.json(allProjects.map((p) => ({
      ...p,
      clientName: p.clientId ? clientMap[p.clientId] ?? null : null,
      taskCount: taskCountMap[p.id]?.total ?? 0,
      completedTaskCount: taskCountMap[p.id]?.completed ?? 0,
      createdAt: p.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/projects", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [project] = await db.insert(projects).values({
      id: createId(),
      name: data.name,
      description: data.description ?? null,
      clientId: data.clientId ?? null,
      type: data.type ?? "GENERAL",
      status: data.status ?? "NOT_STARTED",
      priority: data.priority ?? "MEDIUM",
      progress: data.progress ?? 0,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      budget: data.budget ?? null,
    }).returning();
    res.status(201).json({ ...project, clientName: null, taskCount: 0, completedTaskCount: 0, createdAt: project.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const project = await db.query.projects.findFirst({ where: eq(projects.id, (req.params.id as string)) });
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const allClients = await db.select({ id: clients.id, companyName: clients.companyName }).from(clients);
    const clientMap: Record<string, string> = {};
    for (const c of allClients) clientMap[c.id] = c.companyName;

    res.json({
      ...project,
      clientName: project.clientId ? clientMap[project.clientId] ?? null : null,
      taskCount: 0,
      completedTaskCount: 0,
      createdAt: project.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(projects).set({ ...req.body, updatedAt: new Date() })
      .where(eq(projects.id, (req.params.id as string))).returning();
    if (!updated) { res.status(404).json({ error: "Project not found" }); return; }
    res.json({ ...updated, clientName: null, taskCount: 0, completedTaskCount: 0, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(projects).where(eq(projects.id, (req.params.id as string)));
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
