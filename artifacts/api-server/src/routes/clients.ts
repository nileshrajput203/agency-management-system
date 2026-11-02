import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, invoicesTable, projectsTable, clientLifecycleEventsTable } from "@workspace/db/schema";
import { eq, ilike, or, and, inArray, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

function sanitizeClient(body: any, isUpdate = false) {
  if (!isUpdate && (!body.companyName || typeof body.companyName !== "string" || body.companyName.trim() === "")) {
    throw createError("Company name is required", 400, undefined, "companyName");
  }
  if (isUpdate && body.companyName !== undefined) {
    if (typeof body.companyName !== "string" || body.companyName.trim() === "") {
      throw createError("Company name cannot be empty", 400, undefined, "companyName");
    }
  }
  return sanitizeAndValidate(body, {
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
  return req.userSystemRole === "SUPER_ADMIN" ||
    (Array.isArray(req.userConfiguredModules) && req.userConfiguredModules.includes("clients"));
}

router.get("/", requirePermission("clients.view"), asyncHandler(async (req, res) => {
  const { search, category, status } = req.query as Record<string, string>;
  const userId = (req as any).userId;
  const userAllowedModules = (req as any).userAllowedModules ?? [];
  const userViewAllClients = (req as any).userViewAllClients;
  const hasClientModuleAccess = canManageClientSection(req);
  const canViewAllClients = hasClientModuleAccess || Boolean(userViewAllClients);

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
  const canViewAllClients = canManageClientSection(req) || Boolean(userViewAllClients);

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
    notes: notes || null,
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
    notes: notes || null,
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

export default router;
