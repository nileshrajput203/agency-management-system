import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable,
  invoicesTable,
  projectsTable,
  clientLifecycleEventsTable,
  timeEntriesTable,
  purchaseOrdersTable,
  employeeExpensesTable,
  usersTable,
  contentPostsTable,
  tasksTable,
  projectMilestonesTable,
} from "@workspace/db/schema";
import { eq, ilike, or, and, inArray, desc, asc, sql, isNull } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import { requirePermission, isManagerRole } from "../middleware/auth";
import { canManageModuleSection, hasConfiguredModule } from "../middleware/moduleAccess";

function sanitizeClient(body: any, isUpdate = false) {
  if (body.assignedTo === "UNASSIGNED" || body.assignedTo === "") {
    body.assignedTo = null;
  }
  if (!isUpdate && (!body.companyName || typeof body.companyName !== "string" || body.companyName.trim() === "")) {
    throw createError("Company name is required", 400, undefined, "companyName");
  }
  if (isUpdate && body.companyName !== undefined) {
    if (typeof body.companyName !== "string" || body.companyName.trim() === "") {
      throw createError("Company name cannot be empty", 400, undefined, "companyName");
    }
  }
  return sanitizeAndValidate(body, {
    uuids: body.assignedTo ? ["assignedTo"] : [],
    dates: ["onboardingDate"],
    enums: {
      category: ["RETAINER", "ONE_TIME", "PARTNER", "LEAD", "INACTIVE", "CHURNED"],
      status: ["ACTIVE", "CONTRACT_PAUSED", "CONTRACT_CLOSED", "DORMANT"],
      health: ["GREEN", "YELLOW", "RED"],
      paymentBehavior: ["ON_TIME", "ONE_TIME_DELAYED", "FREQUENT_DELAYED"],
    }
  });
}

function calcHealthScore(invoices: { status: string | null; dueDate: string | null }[]): string {
  const now = new Date();
  const overdueInvs = invoices.filter(inv => inv.status === "OVERDUE");
  const sentWithPastDue = invoices.filter(inv => {
    if (inv.status !== "SENT" || !inv.dueDate) return false;
    return new Date(inv.dueDate) < now;
  });
  const allProblematic = [...overdueInvs, ...sentWithPastDue];

  if (allProblematic.length === 0) return "GREEN";

  const maxDaysOverdue = Math.max(
    ...allProblematic.map(inv => {
      if (!inv.dueDate) return 0;
      return Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    }),
  );

  const overdueRatio = allProblematic.length / Math.max(invoices.length, 1);

  if (maxDaysOverdue > 60 || overdueRatio > 0.5) return "RED";
  if (maxDaysOverdue > 15 || overdueRatio > 0.2) return "YELLOW";
  return "GREEN";
}

const router = Router();

function canManageClientSection(req: any): boolean {
  const role = req.userSystemRole || req.userRole;
  if (isManagerRole(role) || Boolean(req.userIsDelegatedAdmin)) return true;
  return canManageModuleSection(role, "clients", req.userConfiguredModules);
}

router.get("/", requirePermission("clients.view"), asyncHandler(async (req, res) => {
  const { search, category, status } = req.query as Record<string, string>;
  const userId = (req as any).userId;
  const userAllowedModules = (req as any).userAllowedModules ?? [];
  const userViewAllClients = (req as any).userViewAllClients;
  const role = (req as any).userSystemRole || (req as any).userRole;
  const isManager = isManagerRole(role) || Boolean((req as any).userIsDelegatedAdmin);
  const hasClientModuleAccess = canManageClientSection(req) || isManager;
  const hasFinanceModuleAccess =
    canManageModuleSection(role, "finance", req.userConfiguredModules) ||
    hasConfiguredModule(req.userConfiguredModules, "invoices") ||
    hasConfiguredModule(req.userConfiguredModules, "quotations") ||
    hasConfiguredModule(req.userConfiguredModules, "purchaseOrders") ||
    hasConfiguredModule(req.userConfiguredModules, "purchase_orders") ||
    hasConfiguredModule(req.userConfiguredModules, "finance");
  const canViewAllClients = hasClientModuleAccess || hasFinanceModuleAccess || Boolean(userViewAllClients) || isManager;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(clientsTable.companyName, `%${search}%`),
        ilike(clientsTable.contactPerson, `%${search}%`),
      ),
    );
  }
  if (category) conditions.push(eq(clientsTable.category, category));
  if (status) conditions.push(eq(clientsTable.status, status));

  if (!canViewAllClients && userId) {
    // Find client IDs associated with projects assigned to this user
    const assignedProjects = await db
      .select({ clientId: projectsTable.clientId })
      .from(projectsTable)
      .where(eq(projectsTable.assignedTo, userId));

    const assignedClientIds = assignedProjects
      .map(p => p.clientId)
      .filter((id): id is string => Boolean(id));

    if (assignedClientIds.length > 0) {
      conditions.push(
        or(
          eq(clientsTable.assignedTo, userId),
          inArray(clientsTable.id, assignedClientIds)
        )
      );
    } else {
      conditions.push(eq(clientsTable.assignedTo, userId));
    }
  }

  const rows = await db
    .select()
    .from(clientsTable)
    .where(conditions.length ? and(...conditions) : undefined);

  // If not privileged and not delegated admin, strip sensitive fields
  if (!hasClientModuleAccess) {
    const sanitizedRows = rows.map(client => ({
      ...client,
      budgetRange: undefined,
    }));
    return res.json(sanitizedRows);
  }

  return res.json(rows);
}));

router.post("/", requirePermission("clients.create"), asyncHandler(async (req, res) => {
  if (!canManageClientSection(req)) {
    throw createError("Forbidden: Employees cannot create clients", 403);
  }

  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeClient(body, false);
  const [row] = await db.insert(clientsTable).values(sanitized).returning();
  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("clients.view"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  const userViewAllClients = (req as any).userViewAllClients;
  const role = (req as any).userSystemRole || (req as any).userRole;
  const isManager = isManagerRole(role) || Boolean((req as any).userIsDelegatedAdmin);
  const canViewAllClients = canManageClientSection(req) || Boolean(userViewAllClients) || isManager;

  const [row] = await db.select().from(clientsTable).where(eq(clientsTable.id, (req.params.id as string)));
  if (!row) throw createError("Not found", 404);

  if (!canViewAllClients && userId) {
    // Check if client is assigned to user or associated with user's assigned project
    const assignedProjects = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(and(eq(projectsTable.clientId, row.id), eq(projectsTable.assignedTo, userId)));

    const isAssigned = row.assignedTo === userId || assignedProjects.length > 0;
    if (!isAssigned) {
      throw createError("Forbidden: You are not assigned to this client", 403);
    }

    return res.json({
      ...row,
      budgetRange: undefined,
    });
  }

  return res.json(row);
}));

router.patch("/:id", requirePermission("clients.edit"), asyncHandler(async (req, res) => {
  if (!canManageClientSection(req)) {
    throw createError("Forbidden: Employees cannot edit clients", 403);
  }

  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeClient(body, true);
  const [row] = await db
    .update(clientsTable)
    .set(sanitized)
    .where(eq(clientsTable.id, (req.params.id as string)))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("clients.delete"), asyncHandler(async (req, res) => {
  if (!canManageClientSection(req)) {
    throw createError("Forbidden: Employees cannot delete clients", 403);
  }

  await db.delete(clientsTable).where(eq(clientsTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

router.post("/:id/recalculate-health", requirePermission("clients.edit"), asyncHandler(async (req, res) => {
  if (!canManageClientSection(req)) {
    throw createError("Forbidden: Employees cannot perform health calculation", 403);
  }

  const clientId = req.params.id as string;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) throw createError("Not found", 404);

  const invoices = await db
    .select({ status: invoicesTable.status, dueDate: invoicesTable.dueDate })
    .from(invoicesTable)
    .where(eq(invoicesTable.clientId, clientId));

  const health = calcHealthScore(invoices);
  const [updated] = await db
    .update(clientsTable)
    .set({ health })
    .where(eq(clientsTable.id, clientId))
    .returning();

  return res.json({ health, client: updated });
}));

// Close or pause contract without deleting or dismissing the client
router.post("/:id/close-contract", requirePermission("clients.edit"), asyncHandler(async (req, res) => {
  if (!canManageClientSection(req)) {
    throw createError("Forbidden: You cannot modify client contracts", 403);
  }
  const clientId = req.params.id as string;
  const currentUserId = (req as any).userId;
  const { action, reason, targetRevivalDate, notes } = req.body;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) throw createError("Client not found", 404);

  const targetStatus = action === "PAUSE" ? "CONTRACT_PAUSED" : "CONTRACT_CLOSED";
  const now = new Date();

  // 1. Update client status and revival target
  const [updated] = await db
    .update(clientsTable)
    .set({
      status: targetStatus,
      statusChangedAt: now,
      closedAt: now,
      closeReason: reason || "Contract concluded / deal paused",
      targetRevivalDate: targetRevivalDate || null,
      contractNotes: notes || null,
      updatedAt: now,
    })
    .where(eq(clientsTable.id, clientId))
    .returning();

  // 2. Record lifecycle audit event
  await db.insert(clientLifecycleEventsTable).values({
    clientId,
    fromStatus: client.status,
    toStatus: targetStatus,
    effectiveDate: now.toISOString().split("T")[0],
    reason: reason || (action === "PAUSE" ? "Contract Paused" : "Contract Closed"),
    createdBy: currentUserId,
  });

  return res.json(updated);
}));

// Revive client back to ACTIVE
router.post("/:id/revive", requirePermission("clients.edit"), asyncHandler(async (req, res) => {
  if (!canManageClientSection(req)) {
    throw createError("Forbidden: You cannot revive client contracts", 403);
  }
  const clientId = req.params.id as string;
  const currentUserId = (req as any).userId;
  const { notes } = req.body || {};

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) throw createError("Client not found", 404);

  const now = new Date();

  // 1. Restore client status to ACTIVE, keeping all historical documents intact
  const [updated] = await db
    .update(clientsTable)
    .set({
      status: "ACTIVE",
      statusChangedAt: now,
      revivedAt: now,
      closedAt: null,
      closeReason: null,
      targetRevivalDate: null,
      contractNotes: notes ? `Revived: ${notes}` : client.contractNotes,
      updatedAt: now,
    })
    .where(eq(clientsTable.id, clientId))
    .returning();

  // 2. Record lifecycle audit event
  await db.insert(clientLifecycleEventsTable).values({
    clientId,
    fromStatus: client.status,
    toStatus: "ACTIVE",
    effectiveDate: now.toISOString().split("T")[0],
    reason: "Contract Revived / Deal Reactivated",
    createdBy: currentUserId,
  });

  return res.json(updated);
}));

// Get client lifecycle events history
router.get("/:id/lifecycle-history", requirePermission("clients.view"), asyncHandler(async (req, res) => {
  const clientId = req.params.id as string;
  const events = await db
    .select()
    .from(clientLifecycleEventsTable)
    .where(eq(clientLifecycleEventsTable.clientId, clientId))
    .orderBy(desc(clientLifecycleEventsTable.createdAt));
  return res.json(events);
}));

router.get(
  "/:id/contracts",
  requirePermission("clients.view"),
  requirePermission("invoices.view"),
  asyncHandler(async (req, res) => {
  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.clientId, (req.params.id as string)));
  const contracts = invoices.map((inv) => ({
    id: inv.id,
    title: `Invoice ${inv.number ?? inv.id.slice(0, 6)}`,
    status: inv.status,
    value: inv.total,
    startDate: inv.invoiceDate,
    endDate: inv.dueDate,
  }));
    return res.json(contracts);
  }),
);

// GET /api/clients/:id/profitability — unit economics, labor cost, vendor expenses & net margin
router.get("/:id/profitability", requirePermission("clients.view"), asyncHandler(async (req, res) => {
  const clientId = req.params.id as string;
  if (!isValidUUID(clientId)) throw createError("Invalid client ID format", 400);

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) throw createError("Client not found", 404);

  // 1. Invoiced and collected revenue
  const invoices = await db
    .select({ subtotal: invoicesTable.subtotal, total: invoicesTable.total, status: invoicesTable.status })
    .from(invoicesTable)
    .where(eq(invoicesTable.clientId, clientId));

  const invoicedRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.subtotal) || 0), 0);
  const collectedRevenue = invoices
    .filter(inv => inv.status === "PAID")
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

  // 2. Client projects & tasks
  const clientProjects = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.clientId, clientId));
  const projectIds = clientProjects.map(p => p.id);

  // 3. Labor cost from logged time entries
  let laborCost = 0;
  let totalHours = 0;
  if (projectIds.length > 0) {
    const timeEntries = await db
      .select({
        durationMin: timeEntriesTable.durationMin,
        hourlyRate: usersTable.hourlyCostRate,
      })
      .from(timeEntriesTable)
      .leftJoin(usersTable, eq(timeEntriesTable.userId, usersTable.id))
      .where(inArray(timeEntriesTable.projectId, projectIds));

    for (const te of timeEntries) {
      const hours = (Number(te.durationMin) || 0) / 60;
      const rate = Number(te.hourlyRate) || 500;
      laborCost += hours * rate;
      totalHours += hours;
    }
  }

  // 4. Vendor cost from Purchase Orders
  const purchaseOrders = await db
    .select({ subtotal: purchaseOrdersTable.subtotal })
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.clientId, clientId));

  const vendorCost = purchaseOrders.reduce((sum, po) => sum + (Number(po.subtotal) || 0), 0);

  // 5. Reimbursable & project expenses
  const expenses = await db
    .select({ amount: employeeExpensesTable.amount })
    .from(employeeExpensesTable)
    .where(eq(employeeExpensesTable.clientId, clientId));

  const expenseCost = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const totalCost = laborCost + vendorCost + expenseCost;
  const netMargin = invoicedRevenue - totalCost;
  const marginPercent = invoicedRevenue > 0 ? Math.round((netMargin / invoicedRevenue) * 100) : 0;

  return res.json({
    clientId,
    clientName: client.companyName,
    monthlyRetainer: Number(client.monthlyRetainer) || 0,
    invoicedRevenue: Math.round(invoicedRevenue),
    collectedRevenue: Math.round(collectedRevenue),
    laborCost: Math.round(laborCost),
    totalHours: Number(totalHours.toFixed(1)),
    vendorCost: Math.round(vendorCost),
    expenseCost: Math.round(expenseCost),
    totalCost: Math.round(totalCost),
    netMargin: Math.round(netMargin),
    marginPercent,
  });
}));

// GET /api/clients/:id/monthly-report-pdf?month=YYYY-MM — comprehensive ROI & deliverables client report
router.get("/:id/monthly-report-pdf", asyncHandler(async (req, res) => {
  const clientId = req.params.id as string;
  const targetMonth = (req.query.month as string) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) throw createError("Client not found", 404);

  // Fetch content posts for this client in month
  const { like } = await import("drizzle-orm");
  const posts = await db
    .select()
    .from(contentPostsTable)
    .where(and(eq(contentPostsTable.clientId, clientId), like(contentPostsTable.scheduledAt, `${targetMonth}%`)))
    .orderBy(asc(contentPostsTable.scheduledAt));

  // Fetch client projects & completed tasks
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.clientId, clientId));
  const projectIds = projects.map(p => p.id);

  let tasks: any[] = [];
  let milestones: any[] = [];
  if (projectIds.length > 0) {
    tasks = await db.select().from(tasksTable).where(inArray(tasksTable.projectId, projectIds));
    milestones = await db.select().from(projectMilestonesTable).where(inArray(projectMilestonesTable.projectId, projectIds));
  }

  // Quota calculation
  const quotas = Array.isArray(client.deliverableQuotas) ? (client.deliverableQuotas as any[]) : [];
  const quotaSummary = quotas.map(q => {
    const delivered = posts.filter(p => {
      const fmt = (p.format || p.contentType || "").toUpperCase();
      if (q.type === "REEL") return fmt.includes("REEL") || fmt.includes("SHORT") || fmt.includes("VIDEO");
      if (q.type === "CAROUSEL") return fmt.includes("CAROUSEL");
      return fmt.includes("POST") || fmt.includes("STATIC") || fmt.includes("IMAGE");
    }).length;
    const target = Number(q.monthlyQuota) || 10;
    const pct = target > 0 ? Math.min(100, Math.round((delivered / target) * 100)) : 100;
    return { ...q, delivered, target, percentage: pct };
  });

  const completedTasksCount = tasks.filter(t => ["COMPLETED", "DONE"].includes(t.status)).length;
  const completedMilestones = milestones.filter(m => m.status === "COMPLETED");

  function esc(s: any): string {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Client Performance & ROI Report — ${esc(client.companyName)} (${targetMonth})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; }
    .header { border-bottom: 3px solid #7c3aed; padding-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    h1 { margin: 0 0 6px 0; font-size: 26px; color: #0f172a; }
    .subtitle { font-size: 14px; color: #64748b; font-weight: 500; }
    .grid-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .card-metric { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .card-metric label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .card-metric .val { font-size: 22px; font-weight: 800; color: #7c3aed; }
    .section-title { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin: 32px 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .quota-item { margin-bottom: 12px; }
    .quota-header { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
    .progress-bar-bg { width: 100%; height: 8px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; }
    .progress-bar-fill { height: 100%; background: #7c3aed; border-radius: 9999px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 8px 12px; border: 1px solid #e2e8f0; }
    td { font-size: 13px; padding: 8px 12px; border: 1px solid #e2e8f0; }
    .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
    <button onclick="window.print()" style="background: #7c3aed; color: #fff; font-weight: 600; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer;">🖨️ Download / Print Report</button>
  </div>

  <div class="header">
    <div>
      <div style="font-size: 12px; font-weight: 700; color: #7c3aed; letter-spacing: 0.1em; text-transform: uppercase;">Blink Beyond &bull; Executive Performance Report</div>
      <h1>${esc(client.companyName)}</h1>
      <div class="subtitle">Reporting Cycle: <strong>${esc(targetMonth)}</strong> &bull; Retainer: ₹${(Number(client.monthlyRetainer) || 0).toLocaleString()}/mo</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 12px; color: #64748b;">Account Health</div>
      <div style="font-size: 14px; font-weight: 700; color: #16a34a;">🟢 Excellent Engagement</div>
    </div>
  </div>

  <div class="grid-metrics">
    <div class="card-metric"><label>Content Published</label><div class="val">${posts.length}</div></div>
    <div class="card-metric"><label>Tasks Completed</label><div class="val">${completedTasksCount} / ${tasks.length}</div></div>
    <div class="card-metric"><label>Milestones Hit</label><div class="val">${completedMilestones.length}</div></div>
    <div class="card-metric"><label>Active Projects</label><div class="val">${projects.length}</div></div>
  </div>

  <div class="section-title">📊 Retainer Deliverable Quotas & Completion</div>
  <div style="margin-top: 16px;">
    ${quotaSummary.length > 0 ? quotaSummary.map(q => `
      <div class="quota-item">
        <div class="quota-header">
          <span>${esc(q.label || q.type)}</span>
          <span>${q.delivered} / ${q.target} delivered (${q.percentage}%)</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${q.percentage}%;"></div>
        </div>
      </div>
    `).join("") : '<div style="color: #64748b; font-size: 13px;">No deliverable quotas configured for this client workspace.</div>'}
  </div>

  <div class="section-title">📱 Published Content Highlights (${targetMonth})</div>
  <table>
    <thead><tr><th>Date</th><th>Platform</th><th>Format</th><th>Title / Hook</th><th>Status</th></tr></thead>
    <tbody>
      ${posts.length > 0 ? posts.map(p => `
        <tr>
          <td>${esc(p.scheduledAt || "-")}</td>
          <td><strong>${esc(p.platform)}</strong></td>
          <td>${esc(p.format || p.contentType || "Post")}</td>
          <td>${esc(p.title || p.caption?.slice(0, 40) || "Post")}</td>
          <td><span style="font-weight: 600; color: #16a34a;">${esc(p.status)}</span></td>
        </tr>
      `).join("") : '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No content published in this period</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">🚀 Project Deliverables & Milestones Achieved</div>
  <table>
    <thead><tr><th>Project</th><th>Milestone / Task</th><th>Completed Date</th><th>Status</th></tr></thead>
    <tbody>
      ${completedMilestones.length > 0 ? completedMilestones.map(m => `
        <tr>
          <td><strong>Milestone</strong></td>
          <td>${esc(m.title)}</td>
          <td>${m.completedAt ? new Date(m.completedAt).toLocaleDateString() : "This Cycle"}</td>
          <td><span style="color: #16a34a; font-weight: 600;">✅ Achieved</span></td>
        </tr>
      `).join("") : '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Milestones tracked in project management pipeline</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Compiled with precision by Blink Beyond Media &bull; Confidential and prepared exclusively for ${esc(client.companyName)}.
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  return res.send(html);
}));

export default router;
