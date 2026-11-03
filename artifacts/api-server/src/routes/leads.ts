import { Router } from "express";
import { db } from "@workspace/db";
import {
  leadsTable,
  clientsTable,
  projectsTable,
  tasksTable,
  quotationsTable,
  invoicesTable,
  auditLogsTable,
  usersTable,
} from "@workspace/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { canManageEnabledSection, requirePermission } from "../middleware/auth";
import { NotificationService } from "../services/notificationService";

const router = Router();

const STAGES = ["LEAD", "CONTACTED", "DEMO_GIVEN", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"];

function sanitizeLead(body: any, isUpdate = false) {
  if (!isUpdate && (!body.title || typeof body.title !== "string" || body.title.trim() === "")) {
    throw createError("Lead title is required", 400);
  }
  return sanitizeAndValidate(body, {
    dates: ["expectedCloseDate", "stageChangedAt", "nextCallDate"],
    numbers: ["value", "probability"],
    enums: {
      stage: STAGES,
    }
  });
}

router.get("/", requirePermission("sales.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const canViewWorkspace = canManageEnabledSection(
    (req as any).userSystemRole,
    "sales",
    (req as any).userConfiguredModules,
  );
  const rows = await db
    .select()
    .from(leadsTable)
    .where(canViewWorkspace ? undefined : eq(leadsTable.createdBy, requesterId))
    .orderBy(desc(leadsTable.createdAt));
  const now = Date.now();
  const result = rows.map((lead) => ({
    ...lead,
    daysInStage: lead.stageChangedAt
      ? Math.floor((now - new Date(lead.stageChangedAt).getTime()) / 86400000)
      : 0,
  }));
  return res.json(result);
}));

router.get("/pipeline-summary", requirePermission("sales.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const canViewWorkspace = canManageEnabledSection(
    (req as any).userSystemRole,
    "sales",
    (req as any).userConfiguredModules,
  );
  const allLeads = await db
    .select({
      stage: leadsTable.stage,
      value: leadsTable.value,
    })
    .from(leadsTable)
    .where(canViewWorkspace ? undefined : eq(leadsTable.createdBy, requesterId));

  const stageCounts: Record<string, number> = {};
  const stageValues: Record<string, number> = {};

  for (const lead of allLeads) {
    if (lead.stage) {
      stageCounts[lead.stage] = (stageCounts[lead.stage] || 0) + 1;
      stageValues[lead.stage] = (stageValues[lead.stage] || 0) + (Number(lead.value) || 0);
    }
  }

  const summary = STAGES.map((stage) => ({
    stage,
    count: stageCounts[stage] ?? 0,
    totalValue: stageValues[stage] ?? 0,
  }));
  return res.json(summary);
}));

router.post("/", requirePermission("sales.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeLead(body, false);
  const requesterId = (req as any).userId;
  const [row] = await db
    .insert(leadsTable)
    .values({ ...sanitized, createdBy: requesterId, updatedBy: requesterId, stageChangedAt: new Date() })
    .returning();
  return res.status(201).json(row);
}));

router.patch("/:id", requirePermission("sales.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeLead(body, true);
  const requesterId = (req as any).userId;
  const canManageWorkspace = canManageEnabledSection(
    (req as any).userSystemRole,
    "sales",
    (req as any).userConfiguredModules,
  );
  if (!canManageWorkspace) {
    const [ownedLead] = await db.select({ id: leadsTable.id })
      .from(leadsTable)
      .where(and(
        eq(leadsTable.id, req.params.id as string),
        eq(leadsTable.createdBy, requesterId),
      ));
    if (!ownedLead) throw createError("Not found", 404);
  }
  const updates: Record<string, unknown> = { ...sanitized, updatedBy: requesterId };
  if (sanitized.stage) updates.stageChangedAt = new Date();
  const [row] = await db
    .update(leadsTable)
    .set(updates)
    .where(eq(leadsTable.id, (req.params.id as string)))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("sales.delete"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const canManageWorkspace = canManageEnabledSection(
    (req as any).userSystemRole,
    "sales",
    (req as any).userConfiguredModules,
  );
  const whereClause = canManageWorkspace
    ? eq(leadsTable.id, req.params.id as string)
    : and(
        eq(leadsTable.id, req.params.id as string),
        eq(leadsTable.createdBy, requesterId),
      );
  const [deleted] = await db.delete(leadsTable).where(whereClause).returning({ id: leadsTable.id });
  if (!deleted) throw createError("Not found", 404);
  return res.status(204).send();
}));

// Returns leads with a nextCallDate that is today or overdue (for Sales Tasks tab)
router.get("/scheduled-calls", requirePermission("sales.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const canViewWorkspace = canManageEnabledSection(
    (req as any).userSystemRole,
    "sales",
    (req as any).userConfiguredModules,
  );
  const rows = await db.select().from(leadsTable)
    .where(canViewWorkspace ? undefined : eq(leadsTable.createdBy, requesterId));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scheduled = rows
    .filter((l) => l.nextCallDate && new Date(l.nextCallDate) <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30))
    .map((lead) => {
      const callDate = new Date(lead.nextCallDate!);
      const isOverdue = callDate < todayStart;
      const isToday = callDate >= todayStart && callDate < new Date(todayStart.getTime() + 86400000);
      return {
        ...lead,
        daysInStage: lead.stageChangedAt
          ? Math.floor((Date.now() - new Date(lead.stageChangedAt).getTime()) / 86400000)
          : 0,
        callStatus: isOverdue ? "OVERDUE" : isToday ? "TODAY" : "UPCOMING",
      };
    })
    .sort((a, b) => new Date(a.nextCallDate!).getTime() - new Date(b.nextCallDate!).getTime());
  return res.json(scheduled);
}));

// POST /api/leads/:id/convert — 1-Click Convert Won Lead to Client + Project + SOP Tasks + Document
router.post("/:id/convert", requirePermission("sales.edit"), asyncHandler(async (req, res) => {
  const leadId = req.params.id as string;
  const requesterId = (req as any).userId;

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!lead) throw createError("Lead not found", 404);

  const {
    createClient = true,
    monthlyRetainer,
    createProject = true,
    projectTemplate = "SOCIAL_MEDIA",
    createDocument = "NONE", // "QUOTATION" | "INVOICE" | "NONE"
  } = req.body || {};

  // 1. Mark lead as WON
  await db.update(leadsTable).set({
    stage: "WON",
    probability: 100,
    stageChangedAt: new Date(),
  }).where(eq(leadsTable.id, leadId));

  let createdClient: any = null;
  let createdProject: any = null;
  const createdTasks: any[] = [];
  let createdDocument: any = null;

  // 2. Create Client
  if (createClient) {
    const retainerAmount = Number(monthlyRetainer ?? lead.value ?? 0);
    const clientCompany = lead.companyName || lead.title || "New Client";
    const portalToken = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    const [client] = await db.insert(clientsTable).values({
      companyName: clientCompany,
      contactPerson: lead.contactName || lead.companyName || lead.title,
      email: lead.email || null,
      phone: lead.phone || null,
      category: "RETAINER",
      status: "ACTIVE",
      monthlyRetainer: retainerAmount,
      assignedTo: (lead as any).assignedTo || requesterId || null,
      notes: lead.notes ? `Converted from Lead: ${lead.title}\n\n${lead.notes}` : `Converted from Lead: ${lead.title}`,
      portalToken,
      deliverableQuotas: [
        { type: "REEL", label: "Reels / Shorts", monthlyQuota: 12 },
        { type: "CAROUSEL", label: "Carousels", monthlyQuota: 8 },
        { type: "STATIC", label: "Static Posts", monthlyQuota: 10 },
      ],
      brandKit: {},
    }).returning();

    createdClient = client;

    // 3. Create Project & SOP Tasks
    if (createProject) {
      const templateNames: Record<string, string> = {
        SOCIAL_MEDIA: "Social Media Management & Growth",
        WEBSITE: "Website Design & Development",
        PERFORMANCE_ADS: "Performance Marketing & Paid Ads",
        BRANDING: "Brand Identity & Visual Guidelines",
      };

      const [proj] = await db.insert(projectsTable).values({
        name: `${clientCompany} — ${templateNames[projectTemplate] || "Client Onboarding"}`,
        clientId: client.id,
        status: "IN_PROGRESS",
        priority: "HIGH",
        description: `Client onboarding project auto-generated upon winning lead "${lead.title}".`,
        startDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        assignedTo: (lead as any).assignedTo || requesterId || null,
        createdBy: requesterId,
      }).returning();

      createdProject = proj;

      // SOP Task Definitions
      const sopSchedules: Record<string, Array<{ title: string; daysOffset: number; desc: string; priority: string }>> = {
        SOCIAL_MEDIA: [
          { title: "Brand Kit & Visual Assets Collection", daysOffset: 1, desc: "Collect high-res logos, typography, brand guidelines, and product imagery.", priority: "HIGH" },
          { title: "Social Handles Access & Account Audit", daysOffset: 2, desc: "Obtain Instagram, Facebook, LinkedIn access and conduct full bio & profile optimization.", priority: "HIGH" },
          { title: "Competitor & Audience Analysis", daysOffset: 3, desc: "Research top 5 competitors, benchmark viral formats, and finalize ICP persona.", priority: "MEDIUM" },
          { title: "Monthly Content Pillars & Calendar Strategy", daysOffset: 5, desc: "Establish 4 core pillars and draft full month content schedule.", priority: "HIGH" },
          { title: "First Batch (6 Reels/Posts) Scripting & Hooks", daysOffset: 7, desc: "Write scripts with viral hooks, visual directions, and audio recommendations.", priority: "MEDIUM" },
          { title: "First Batch Creative Design & Video Editing", daysOffset: 10, desc: "Produce visuals and cut videos according to approved scripts.", priority: "MEDIUM" },
          { title: "Client Content Review & Approval", daysOffset: 12, desc: "Share secure portal link with client for one-click approval or timestamped revisions.", priority: "HIGH" },
          { title: "Schedule First Batch Posts & Launch Campaign", daysOffset: 14, desc: "Queue approved posts across Instagram, Facebook, and LinkedIn.", priority: "HIGH" },
        ],
        WEBSITE: [
          { title: "Requirements Gathering & Information Architecture", daysOffset: 2, desc: "Map website goals, target audience, conversion paths, and full sitemap.", priority: "HIGH" },
          { title: "Content, Copywriting & Brand Asset Intake", daysOffset: 4, desc: "Collect copy for home, about, services, testimonials, and contact pages.", priority: "MEDIUM" },
          { title: "UX Wireframing & User Journey Mapping", daysOffset: 6, desc: "Create low-fidelity wireframes for desktop and mobile layouts.", priority: "HIGH" },
          { title: "High-Fidelity UI Design (Figma)", daysOffset: 9, desc: "Build responsive, modern UI design conforming to client brand guidelines.", priority: "HIGH" },
          { title: "Client Design Review & Signoff", daysOffset: 11, desc: "Conduct design walkthrough call and collect feedback before development.", priority: "HIGH" },
          { title: "Frontend & Responsive Web Development", daysOffset: 16, desc: "Code responsive web pages with clean HTML/CSS/Tailwind and fast load times.", priority: "HIGH" },
          { title: "Forms, Integrations & CMS Setup", daysOffset: 19, desc: "Hook up lead capture forms, CRM webhooks, and analytics tracking.", priority: "MEDIUM" },
          { title: "Cross-Device QA & Production Launch", daysOffset: 22, desc: "Perform speed tests, SEO checks, SSL & DNS setup, and go live.", priority: "HIGH" },
        ],
        PERFORMANCE_ADS: [
          { title: "Meta Pixel, GA4 & Ad Accounts Integration", daysOffset: 1, desc: "Verify Meta Business Manager access, install tracking pixel and conversion API.", priority: "URGENT" },
          { title: "Audience Segmentation & Offer Architecture", daysOffset: 3, desc: "Define warm retargeting, lookalikes, and interest-based cold audience buckets.", priority: "HIGH" },
          { title: "Ad Copywriting & Angle Variations", daysOffset: 5, desc: "Write 5 problem/solution, social proof, and urgency ad copy variations.", priority: "MEDIUM" },
          { title: "Static & Video Ad Creatives Production", daysOffset: 8, desc: "Produce 3 motion graphics video ads and 4 high-CTR static image carousels.", priority: "HIGH" },
          { title: "Campaign Structure & Bid Strategy Setup", daysOffset: 10, desc: "Configure CBO/ABO campaigns, UTM parameters, and custom conversion events.", priority: "HIGH" },
          { title: "Client Review & Campaign Launch", daysOffset: 12, desc: "Client final approval followed by publishing campaigns live.", priority: "HIGH" },
          { title: "Day 3 Optimization & Creative Pruning", daysOffset: 15, desc: "Review initial CTR, CPC, and CPA metrics. Kill losing ads and scale winning angles.", priority: "MEDIUM" },
        ],
        BRANDING: [
          { title: "Brand Discovery Questionnaire & Strategy Call", daysOffset: 1, desc: "Deep dive into company vision, core values, market positioning, and tone.", priority: "HIGH" },
          { title: "Moodboard & Aesthetic Directions", daysOffset: 3, desc: "Curate 2 distinct visual moodboards (colors, vibes, photography style).", priority: "MEDIUM" },
          { title: "Logo Concepts Exploration (3 Directions)", daysOffset: 7, desc: "Develop 3 unique vector logo marks with real-world mockups.", priority: "HIGH" },
          { title: "Client Feedback Round 1", daysOffset: 9, desc: "Present concepts to stakeholders and gather revision notes.", priority: "HIGH" },
          { title: "Color Palette & Typography System", daysOffset: 12, desc: "Standardize primary, secondary colors, web fonts, and heading hierarchy.", priority: "MEDIUM" },
          { title: "Brand Identity Guidelines Deck", daysOffset: 15, desc: "Compile complete 20-page Brand Guidelines PDF with usage rules.", priority: "HIGH" },
          { title: "Final Vector Asset Package Delivery", daysOffset: 18, desc: "Export logo files in SVG, PNG, EPS, PDF and hand off to client.", priority: "MEDIUM" },
        ],
      };

      const selectedSOP = sopSchedules[projectTemplate] || sopSchedules.SOCIAL_MEDIA;
      for (const t of selectedSOP) {
        const [task] = await db.insert(tasksTable).values({
          title: t.title,
          projectId: proj.id,
          assigneeId: (lead as any).assignedTo || requesterId || null,
          status: "TODO",
          priority: t.priority,
          description: t.desc,
          dueDate: new Date(Date.now() + t.daysOffset * 86400000),
          createdBy: requesterId,
        }).returning();
        createdTasks.push(task);
      }
    }

    // 4. Create Pre-Filled Document (Quotation or Invoice)
    if (createDocument === "QUOTATION") {
      const qNum = `Q-${Date.now().toString().slice(-6)}`;
      const subtotal = Number(monthlyRetainer ?? lead.value ?? 0);
      const taxAmount = Math.round(subtotal * 0.18);
      const total = subtotal + taxAmount;

      const [quotation] = await db.insert(quotationsTable).values({
        number: qNum,
        clientId: client.id,
        clientName: clientCompany,
        clientEmail: lead.email || null,
        clientPhone: lead.phone || null,
        quotationDate: new Date().toISOString().split("T")[0],
        status: "DRAFT",
        currency: "INR",
        subtotal,
        taxAmount,
        total,
        notes: `Retainer quotation generated from won lead ${lead.title}`,
        termsAndConditions: "1. 50% advance payment required to commence onboarding.\n2. Invoices are payable within 7 days of issue.\n3. GST @ 18% applicable on all agency services.",
      }).returning();
      createdDocument = quotation;
    } else if (createDocument === "INVOICE") {
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      const subtotal = Number(monthlyRetainer ?? lead.value ?? 0);
      const taxAmount = Math.round(subtotal * 0.18);
      const total = subtotal + taxAmount;

      const [invoice] = await db.insert(invoicesTable).values({
        number: invNum,
        clientId: client.id,
        invoiceDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
        status: "DRAFT",
        paymentStatus: "PENDING",
        currency: "INR",
        subtotal,
        taxAmount,
        total,
        notes: `Initial retainer invoice generated from won lead ${lead.title}`,
      }).returning();
      createdDocument = invoice;
    }
  }

  // Audit Log
  try {
    await db.insert(auditLogsTable as any).values({
      userId: requesterId,
      action: "CONVERT_LEAD",
      entity: "lead",
      entityId: leadId,
      metadata: {
        leadTitle: lead.title,
        clientId: createdClient?.id,
        projectId: createdProject?.id,
        tasksCreated: createdTasks.length,
        documentType: createDocument,
      },
    });
  } catch (_) {}

  // Notify Admins
  try {
    await NotificationService.notifyAdminsAndManagers({
      type: "LEAD_CONVERTED",
      title: `🎉 Lead Won & Converted: ${lead.title}`,
      message: `Converted to client "${createdClient?.companyName || lead.title}" with ${createdTasks.length} onboarding SOP tasks created.`,
      actionUrl: createdClient ? `/clients/${createdClient.id}` : "/sales",
    }, requesterId);
  } catch (_) {}

  return res.status(200).json({
    success: true,
    lead: { ...lead, stage: "WON" },
    client: createdClient,
    project: createdProject,
    tasksCreated: createdTasks.length,
    document: createdDocument,
  });
}));

export default router;
