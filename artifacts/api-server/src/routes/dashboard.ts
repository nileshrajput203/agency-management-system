import { Router } from "express";
import { db } from "@workspace/db";
import {
  projects,
  clients,
  leads,
  tasks,
  attendance,
  users,
  invoices,
  contentPosts,
} from "@workspace/db/schema";
import { eq, inArray, notInArray, and, gte, lte, sql, not, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/stats", requireAuth, async (_req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekFromNow = new Date(Date.now() + 7 * 86400000);

    const [
      activeProjectsRows,
      totalClientsRows,
      openLeadsRows,
      allUsers,
      allInvoices,
      contentPublished,
      todayAttendance,
      tasksDueRows,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(projects).where(
        inArray(projects.status, ["IN_PROGRESS", "UNDER_REVIEW"])
      ),
      db.select({ count: sql<number>`count(*)` }).from(clients).where(
        ne(clients.category, "CHURNED")
      ),
      db.select({ count: sql<number>`count(*)`, totalValue: sql<number>`coalesce(sum(value), 0)` })
        .from(leads)
        .where(notInArray(leads.stage, ["WON", "LOST"])),
      db.select().from(users).where(eq(users.isActive, true)),
      db.select({ status: invoices.status, total: invoices.total }).from(invoices),
      db.select({ count: sql<number>`count(*)` }).from(contentPosts).where(
        and(
          eq(contentPosts.status, "PUBLISHED"),
          sql`published_at >= ${monthStart.toISOString()}`
        )
      ),
      db.select({ count: sql<number>`count(*)` }).from(attendance).where(
        and(
          gte(attendance.checkInAt, today),
          sql`check_out_at IS NULL`
        )
      ),
      db.select({ count: sql<number>`count(*)` }).from(tasks).where(
        and(
          not(eq(tasks.status, "DONE")),
          sql`due_date <= ${weekFromNow.toISOString()}`
        )
      ),
    ]);

    const revenuePaid = allInvoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + (i.total ?? 0), 0);
    const outstanding = allInvoices
      .filter((i) => ["SENT", "VIEWED", "OVERDUE"].includes(i.status))
      .reduce((s, i) => s + (i.total ?? 0), 0);

    res.json({
      activeProjects: Number(activeProjectsRows[0]?.count ?? 0),
      totalClients: Number(totalClientsRows[0]?.count ?? 0),
      openLeads: Number(openLeadsRows[0]?.count ?? 0),
      pipelineValue: Number(openLeadsRows[0]?.totalValue ?? 0),
      tasksDue: Number(tasksDueRows[0]?.count ?? 0),
      checkedInToday: Number(todayAttendance[0]?.count ?? 0),
      totalEmployees: allUsers.length,
      publishedContent: Number(contentPublished[0]?.count ?? 0),
      revenuePaid,
      outstanding,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/revenue-chart", requireAuth, async (_req, res) => {
  try {
    const allInvoices = await db.select({
      total: invoices.total,
      status: invoices.status,
      invoiceDate: invoices.invoiceDate,
    }).from(invoices);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const revenueMap: Record<string, number> = {};

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      revenueMap[label] = 0;
    }

    for (const inv of allInvoices) {
      if (inv.status !== "PAID") continue;
      const d = new Date(inv.invoiceDate);
      const label = `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      if (label in revenueMap) {
        revenueMap[label] += inv.total ?? 0;
      }
    }

    res.json(Object.entries(revenueMap).map(([month, amount]) => ({ month, amount })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", requireAuth, async (_req, res) => {
  try {
    const [recentTasks, recentLeads, recentClients] = await Promise.all([
      db.select().from(tasks).orderBy(sql`created_at desc`).limit(5),
      db.select().from(leads).orderBy(sql`created_at desc`).limit(5),
      db.select().from(clients).orderBy(sql`created_at desc`).limit(3),
    ]);

    const activity = [
      ...recentTasks.map((t) => ({
        id: `task-${t.id}`,
        type: "task",
        message: `Task "${t.title}" created`,
        createdAt: t.createdAt.toISOString(),
        userName: null,
      })),
      ...recentLeads.map((l) => ({
        id: `lead-${l.id}`,
        type: "lead",
        message: `Lead "${l.title}" moved to ${l.stage}`,
        createdAt: l.createdAt.toISOString(),
        userName: null,
      })),
      ...recentClients.map((c) => ({
        id: `client-${c.id}`,
        type: "client",
        message: `Client "${c.companyName}" added`,
        createdAt: c.createdAt.toISOString(),
        userName: null,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    res.json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
