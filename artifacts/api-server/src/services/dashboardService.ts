import { db } from "@workspace/db";
import {
  clientsTable, projectsTable, leadsTable, tasksTable, invoicesTable,
  quotationsTable, purchaseOrdersTable, leaveRequestsTable, usersTable,
} from "@workspace/db/schema";
import { eq, gte, sql, and } from "drizzle-orm";
import { isTaskManagerRole } from "../middleware/auth";

function toIso(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getDashboardStatsService(userId: string) {
  const [user] = await db
    .select({
      name: usersTable.name,
      systemRole: usersTable.systemRole,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const now = new Date();

  if (!isTaskManagerRole(user?.systemRole)) {
    // 1. Employee Work Summary
    const employeeTasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        projectId: tasksTable.projectId,
        approvalStatus: tasksTable.approvalStatus,
        requestedBy: tasksTable.requestedBy,
        rejectionReason: tasksTable.rejectionReason,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        approvedAt: tasksTable.approvedAt,
      })
      .from(tasksTable)
      .where(eq(tasksTable.assigneeId, userId));

    const employeeTaskRequests = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        projectId: tasksTable.projectId,
        approvalStatus: tasksTable.approvalStatus,
        requestedBy: tasksTable.requestedBy,
        rejectionReason: tasksTable.rejectionReason,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        requestedAt: tasksTable.requestedAt,
        approvedAt: tasksTable.approvedAt,
      })
      .from(tasksTable)
      .where(eq(tasksTable.requestedBy, userId));

    const activeEmployeeTasks = employeeTasks.filter((t) =>
      t.approvalStatus === "APPROVED" ||
      t.approvalStatus === "MODIFIED" ||
      !t.approvalStatus
    );

    const allProjects = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        status: projectsTable.status,
        priority: projectsTable.priority,
        dueDate: projectsTable.dueDate,
        createdBy: projectsTable.createdBy,
        assignedTo: projectsTable.assignedTo,
        assignmentStatus: projectsTable.assignmentStatus,
        assignmentDescription: projectsTable.assignmentDescription,
        rejectionReason: projectsTable.rejectionReason,
        assignmentActionAt: projectsTable.assignmentActionAt,
        createdAt: projectsTable.createdAt,
      })
      .from(projectsTable);

    const assignedProjectIds = Array.from(new Set(activeEmployeeTasks.map((t) => t.projectId).filter(Boolean))) as string[];
    const myProjects = allProjects.filter((p) => p.createdBy === userId || p.assignedTo === userId || assignedProjectIds.includes(p.id));

    const allProjectTasks = await db
      .select({
        id: tasksTable.id,
        status: tasksTable.status,
        projectId: tasksTable.projectId,
      })
      .from(tasksTable)
      .where(sql`${tasksTable.projectId} is not null`);

    const myProjectsWithCompletion = myProjects.map((p) => {
      const projectTasks = allProjectTasks.filter((t) => t.projectId === p.id);
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter((t) => t.status === "COMPLETED" || t.status === "DONE").length;
      const completion = p.status === "COMPLETED" ? 100 : totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        dueDate: toIso(p.dueDate),
        assignedTo: p.assignedTo,
        assignmentStatus: p.assignmentStatus,
        assignmentDescription: p.assignmentDescription,
        rejectionReason: p.rejectionReason,
        assignmentActionAt: toIso(p.assignmentActionAt),
        completion,
      };
    });

    const totalAssignedTasks = activeEmployeeTasks.length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tasksDueTodayCount = activeEmployeeTasks.filter((t) => {
      if (t.status === "COMPLETED" || t.status === "DONE" || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= todayStart && d <= todayEnd;
    }).length;

    const overdueTasksCount = activeEmployeeTasks.filter((t) => {
      if (t.status === "COMPLETED" || t.status === "DONE" || !t.dueDate) return false;
      return new Date(t.dueDate) < now;
    }).length;

    const projectsAssignedToMeCount = myProjects.length;

    const pendingTaskRequestsCount = employeeTaskRequests.filter(
      (t) => t.approvalStatus === "PENDING"
    ).length;

    const approvedRequestsCount = employeeTaskRequests.filter(
      (t) => t.approvalStatus === "APPROVED"
    ).length;

    const rejectedRequestsCount = employeeTaskRequests.filter(
      (t) => t.approvalStatus === "REJECTED"
    ).length;

    // Upcoming Deadlines
    const upcomingDeadlines: any[] = [];
    for (const t of activeEmployeeTasks) {
      if (t.dueDate && t.status !== "COMPLETED" && t.status !== "DONE") {
        const iso = toIso(t.dueDate);
        if (iso) {
          upcomingDeadlines.push({
            id: `task-${t.id}`,
            type: "task",
            title: t.title,
            date: iso,
            status: t.status,
            overdue: new Date(t.dueDate) < now,
            extraInfo: `Priority: ${t.priority}`,
          });
        }
      }
    }

    for (const p of myProjectsWithCompletion) {
      if (p.dueDate && p.status !== "COMPLETED") {
        upcomingDeadlines.push({
          id: `project-${p.id}`,
          type: "project",
          title: p.name,
          date: p.dueDate,
          status: p.status,
          overdue: new Date(p.dueDate) < now,
          extraInfo: `Status: ${p.status}`,
        });
      }
    }

    const myLeaves = await db
      .select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.userId, userId));

    for (const lv of myLeaves) {
      if (lv.startDate) {
        const startIso = toIso(lv.startDate);
        if (startIso) {
          upcomingDeadlines.push({
            id: `leave-${lv.id}`,
            type: "leave",
            title: `Personal Leave Request`,
            date: startIso,
            status: lv.status,
            overdue: new Date(lv.startDate) < now && lv.status === "PENDING",
            extraInfo: `${lv.type} (${lv.status})`,
          });
        }
      }
    }

    upcomingDeadlines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // My Tasks
    const myTasksList = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        projectId: tasksTable.projectId,
        approvalStatus: tasksTable.approvalStatus,
        rejectionReason: tasksTable.rejectionReason,
      })
      .from(tasksTable)
      .where(eq(tasksTable.assigneeId, userId));

    const approvedMyTasks = myTasksList.filter((t) =>
      t.approvalStatus === "APPROVED" || t.approvalStatus === "MODIFIED" || !t.approvalStatus
    );

    const formattedMyTasks = approvedMyTasks.map((t) => {
      const proj = allProjects.find((p) => p.id === t.projectId);
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: toIso(t.dueDate),
        projectName: proj ? proj.name : "Direct Assignment",
      };
    });

    const formattedTaskRequests = employeeTaskRequests.map((tr) => {
      const proj = allProjects.find((p) => p.id === tr.projectId);
      return {
        id: tr.id,
        title: tr.title,
        status: tr.status,
        priority: tr.priority,
        dueDate: toIso(tr.dueDate),
        approvalStatus: tr.approvalStatus,
        rejectionReason: tr.rejectionReason,
        requestedAt: toIso(tr.requestedAt) || toIso(tr.createdAt),
        approvedAt: toIso(tr.approvedAt),
        projectName: proj ? proj.name : "Direct Request",
      };
    });

    return {
      isEmployee: true,
      employeeSummary: {
        totalAssignedTasks,
        tasksDueToday: tasksDueTodayCount,
        overdueTasks: overdueTasksCount,
        projectsAssignedToMe: projectsAssignedToMeCount,
        pendingTaskRequests: pendingTaskRequestsCount,
        approvedRequests: approvedRequestsCount,
        rejectedRequests: rejectedRequestsCount,
      },
      assignedProjects: myProjectsWithCompletion,
      myTasks: formattedMyTasks,
      myTaskRequests: formattedTaskRequests,
      upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    };
  }

  // Super Admin view calculations
  const [
    clients,
    projects,
    leads,
    tasks,
    invoices,
    quotations,
    purchaseOrders,
  ] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(projectsTable),
    db.select().from(leadsTable),
    db.select().from(tasksTable),
    db.select().from(invoicesTable),
    db.select().from(quotationsTable),
    db.select().from(purchaseOrdersTable),
  ]);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Revenue metrics
  const getInvoicePaidDate = (i: typeof invoices[number]) => {
    if ((i as any).paidAt) return new Date((i as any).paidAt);
    if (i.updatedAt) return new Date(i.updatedAt);
    if (i.invoiceDate) return new Date(i.invoiceDate);
    if (i.createdAt) return new Date(i.createdAt);
    return new Date();
  };

  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const currentMonthPaid = paidInvoices.filter((i) => getInvoicePaidDate(i) >= startOfMonth);
  const monthlyRevenue = currentMonthPaid.reduce((sum, i) => sum + (i.total ?? 0), 0);
  const totalCollected = paidInvoices.reduce((sum, i) => sum + (i.total ?? 0), 0);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const prevMonthPaid = paidInvoices.filter((i) => {
    const d = getInvoicePaidDate(i);
    return d >= prevMonthStart && d <= prevMonthEnd;
  });
  const prevMonthRevenue = prevMonthPaid.reduce((sum, i) => sum + (i.total ?? 0), 0);

  const pendingInvoices = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE" || i.status === "PARTIALLY_PAID");
  const outstanding = pendingInvoices.reduce((sum, i) => sum + (i.total ?? 0), 0);

  const quotationValue = quotations.reduce((sum, q) => sum + (q.total ?? 0), 0);

  const poTotal = purchaseOrders.length;
  const poPending = purchaseOrders.filter((p) => p.status === "PENDING" || p.status === "SUBMITTED" || p.status === "SENT" || p.status === "ORDERED").length;
  const poApproved = purchaseOrders.filter((p) => p.status === "APPROVED").length;
  const poCompleted = purchaseOrders.filter((p) => p.status === "RECEIVED" || p.status === "COMPLETED").length;

  // Business summary metrics
  const totalClients = clients.length;
  const activeClients = clients.filter((c: any) => !c.deletedAt && (c.status ? c.status === "ACTIVE" : true)).length;
  const newClientsThisMonth = clients.filter((c) => c.createdAt && new Date(c.createdAt) >= startOfMonth).length;

  const totalProjects = projects.length;
  const runningProjects = projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "PLANNING").length;
  const completedProjects = projects.filter((p) => p.status === "COMPLETED").length;
  const startedProjectsThisMonth = projects.filter((p) => p.createdAt && new Date(p.createdAt) >= startOfMonth).length;
  const overdueProjects = projects.filter((p) => p.status !== "COMPLETED" && p.dueDate && new Date(p.dueDate) < now).length;

  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === "TODO").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdueTasks = tasks.filter((t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const tasksDueToday = tasks.filter((t) => {
    if (t.status === "COMPLETED" || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= todayStart && d <= todayEnd;
  }).length;

  // Project health analytics
  const projectTasksMap: Record<string, { total: number; incomplete: number }> = {};
  for (const t of tasks) {
    if (t.projectId) {
      if (!projectTasksMap[t.projectId]) {
        projectTasksMap[t.projectId] = { total: 0, incomplete: 0 };
      }
      projectTasksMap[t.projectId].total++;
      if (t.status !== "COMPLETED") {
        projectTasksMap[t.projectId].incomplete++;
      }
    }
  }

  let projectHealthOnTrack = 0;
  let projectHealthAtRisk = 0;
  let projectHealthDelayed = 0;
  let projectHealthCompleted = 0;

  const projectHealthProjects = projects;
  for (const p of projectHealthProjects) {
    const status = p.status ?? "";
    if (status === "COMPLETED") {
      projectHealthCompleted++;
      continue;
    }
    if (status === "CANCELLED" || status === "ON_HOLD") {
      projectHealthDelayed++;
      continue;
    }

    const dueDate = p.dueDate ? new Date(p.dueDate) : null;
    const taskInfo = projectTasksMap[p.id] || { total: 0, incomplete: 0 };
    const hasIncompleteTasks = taskInfo.incomplete > 0;

    if (dueDate) {
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0 || (diffDays <= 7 && hasIncompleteTasks)) {
        projectHealthAtRisk++;
      } else {
        projectHealthOnTrack++;
      }
    } else {
      projectHealthOnTrack++;
    }
  }

  // Invoices breakdown
  const invoicesAnalytics = {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === "DRAFT").length,
    sent: invoices.filter((i) => i.status === "SENT").length,
    paid: invoices.filter((i) => i.status === "PAID").length,
    overdue: invoices.filter((i) => i.status === "OVERDUE").length,
    partiallyPaid: invoices.filter((i) => i.status === "PARTIALLY_PAID").length,
    cancelled: invoices.filter((i) => i.status === "CANCELLED").length,
    totalValue: invoices.reduce((sum, i) => sum + (i.total ?? 0), 0),
  };

  const quotationsAnalytics = {
    total: quotations.length,
    draft: quotations.filter((q) => q.status === "DRAFT").length,
    sent: quotations.filter((q) => q.status === "SENT").length,
    accepted: quotations.filter((q) => q.status === "ACCEPTED").length,
    rejected: quotations.filter((q) => q.status === "REJECTED").length,
    expired: quotations.filter((q) => q.status === "EXPIRED").length,
    converted: quotations.filter((q) => q.status === "CONVERTED").length,
    totalValue: quotationValue,
  };

  const purchaseOrderAnalytics = {
    total: poTotal,
    draft: purchaseOrders.filter((p) => p.status === "DRAFT").length,
    pending: poPending,
    approved: poApproved,
    rejected: purchaseOrders.filter((p) => p.status === "REJECTED").length,
    completed: poCompleted,
    cancelled: purchaseOrders.filter((p) => p.status === "CANCELLED").length,
    totalValue: purchaseOrders.reduce((sum, p) => sum + (p.total ?? 0), 0),
  };

  // Lead Pipeline Stage Breakdown
  const pipelineStagesMap: Record<string, { stage: string; label: string; value: number; count: number }> = {
    LEAD: { stage: "LEAD", label: "New Lead", value: 0, count: 0 },
    CONTACTED: { stage: "CONTACTED", label: "Contacted", value: 0, count: 0 },
    DEMO_GIVEN: { stage: "DEMO_GIVEN", label: "Demo Given", value: 0, count: 0 },
    PROPOSAL_SENT: { stage: "PROPOSAL_SENT", label: "Proposal Sent", value: 0, count: 0 },
    NEGOTIATION: { stage: "NEGOTIATION", label: "Negotiation", value: 0, count: 0 },
    WON: { stage: "WON", label: "Won", value: 0, count: 0 },
    LOST: { stage: "LOST", label: "Lost", value: 0, count: 0 },
  };

  let totalPipelineValue = 0;
  for (const l of leads) {
    const val = l.value ?? 0;
    totalPipelineValue += val;
    const stageStr = ((l as any).stage ?? (l as any).status ?? "LEAD").toUpperCase();
    if (pipelineStagesMap[stageStr]) {
      pipelineStagesMap[stageStr].value += val;
      pipelineStagesMap[stageStr].count++;
    } else if (stageStr === "NEW" || stageStr === "NEW_LEAD") {
      pipelineStagesMap.LEAD.value += val;
      pipelineStagesMap.LEAD.count++;
    } else if (stageStr === "PROPOSAL") {
      pipelineStagesMap.PROPOSAL_SENT.value += val;
      pipelineStagesMap.PROPOSAL_SENT.count++;
    } else {
      pipelineStagesMap.LEAD.value += val;
      pipelineStagesMap.LEAD.count++;
    }
  }

  const pipelineStages = Object.values(pipelineStagesMap);

  // Monthly comparison indicators
  const projectsCompletedThisMonth = projects.filter((p) => p.status === "COMPLETED" && p.updatedAt && new Date(p.updatedAt) >= startOfMonth).length;
  const invoicesGeneratedThisMonth = invoices.filter((i) => i.createdAt && new Date(i.createdAt) >= startOfMonth).length;
  const quotationsGeneratedThisMonth = quotations.filter((q) => q.createdAt && new Date(q.createdAt) >= startOfMonth).length;
  const purchaseOrdersCreatedThisMonth = purchaseOrders.filter((po) => po.createdAt && new Date(po.createdAt) >= startOfMonth).length;
  const tasksCompletedThisMonth = tasks.filter((t) => t.status === "COMPLETED" && t.updatedAt && new Date(t.updatedAt) >= startOfMonth).length;

  // Upcoming Deadlines
  const upcomingDeadlines: any[] = [];
    for (const p of projects) {
      if (p.dueDate && p.status !== "COMPLETED") {
        const d = new Date(p.dueDate);
        if (!isNaN(d.getTime())) {
          upcomingDeadlines.push({
            id: `project-${p.id}`,
            type: "project",
            title: p.name,
            date: d.toISOString(),
            status: p.status,
            overdue: d < now,
            extraInfo: `Client ID: ${p.clientId ?? "Internal"}`,
          });
        }
      }
    }

    for (const t of tasks) {
      if (t.dueDate && t.status !== "COMPLETED") {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime())) {
          upcomingDeadlines.push({
            id: `task-${t.id}`,
            type: "task",
            title: t.title,
            date: d.toISOString(),
            status: t.status,
            overdue: d < now,
            extraInfo: `Priority: ${t.priority}`,
          });
        }
      }
    }

    for (const i of invoices) {
      if (i.dueDate && i.status !== "PAID" && i.status !== "CANCELLED") {
        const d = new Date(i.dueDate);
        if (!isNaN(d.getTime())) {
          upcomingDeadlines.push({
            id: `invoice-${i.id}`,
            type: "invoice",
            title: `Invoice #${i.number ?? i.id}`,
            date: d.toISOString(),
            status: i.status,
            overdue: d < now,
            extraInfo: `Amount: $${i.total ?? 0}`,
          });
        }
      }
    }

  upcomingDeadlines.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
  });

  // Quick Insights Generation
  const quickInsights: string[] = [];
  if (overdueProjects > 0) {
    quickInsights.push(`Attention required: ${overdueProjects} project(s) are currently overdue.`);
  } else {
    quickInsights.push("All active projects are progressing on schedule.");
  }

  if (invoicesAnalytics.overdue > 0) {
    quickInsights.push(`Follow-up needed: ${invoicesAnalytics.overdue} invoice(s) are overdue.`);
  }

  if (overdueTasks > 0) {
    quickInsights.push(`Workload alert: ${overdueTasks} task(s) are overdue.`);
  } else {
    quickInsights.push("No tasks are overdue.");
  }

  if (monthlyRevenue > prevMonthRevenue) {
    if (prevMonthRevenue > 0) {
      const pct = Math.round(((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
      quickInsights.push(`Revenue increased by ${pct}% compared to last month!`);
    } else if (monthlyRevenue > 0) {
      quickInsights.push("Revenue increased compared to last month!");
    }
  } else if (monthlyRevenue < prevMonthRevenue && monthlyRevenue > 0) {
    quickInsights.push("Revenue is currently tracking lower than last month's performance.");
  }

  return {
    isEmployee: false,
    revenueCollected: {
      currentMonth: monthlyRevenue,
      totalCollected: totalCollected,
    },
    outstandingRevenue: outstanding,
    quotationValue: quotationValue,
    purchaseOrders: {
      total: poTotal,
      pending: poPending,
      approved: poApproved,
      completed: poCompleted,
    },
    projectHealth: {
      onTrack: projectHealthOnTrack,
      atRisk: projectHealthAtRisk,
      delayed: projectHealthDelayed,
      completed: projectHealthCompleted,
      total: projectHealthProjects.length,
    },
    businessSummary: {
      clients: {
        total: totalClients,
        active: activeClients,
        newThisMonth: newClientsThisMonth,
      },
      projects: {
        total: totalProjects,
        running: runningProjects,
        completed: completedProjects,
        startedThisMonth: startedProjectsThisMonth,
        overdue: overdueProjects,
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        dueToday: tasksDueToday,
      }
    },
    invoiceAnalytics: invoicesAnalytics,
    quotationAnalytics: quotationsAnalytics,
    purchaseOrderAnalytics: purchaseOrderAnalytics,
    leadPipeline: {
      stages: pipelineStages,
      totalValue: totalPipelineValue,
    },
    thisMonthOverview: {
      projectsCreated: startedProjectsThisMonth,
      projectsCompleted: projectsCompletedThisMonth,
      clientsAdded: newClientsThisMonth,
      invoicesGenerated: invoicesGeneratedThisMonth,
      quotationsGenerated: quotationsGeneratedThisMonth,
      purchaseOrdersCreated: purchaseOrdersCreatedThisMonth,
      tasksCompleted: tasksCompletedThisMonth,
      revenueCollected: monthlyRevenue,
    },
    upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    quickInsights,
  };
}
