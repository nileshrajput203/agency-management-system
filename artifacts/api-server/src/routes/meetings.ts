import { Router } from "express";
import { db } from "@workspace/db";
import { meetings, meetingAttendees, notifications, users, clients, projects } from "@workspace/db/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";
import {
  requirePermission,
  canManageEnabledSection,
  canManageMeetingWorkspace,
} from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { isValidUUID } from "../lib/validation";
import { NotificationService } from "../services/notificationService";
import { meetingLogger } from "../lib/logger";

const router = Router();
router.use((req, res, next): void => {
  if (!canManageMeetingWorkspace(
    (req as any).userSystemRole,
    (req as any).userConfiguredModules,
  )) {
    res.status(403).json({ error: "Forbidden: Enable the Meetings section to continue" });
    return;
  }
  next();
});

// GET /meetings - List meetings with filters
router.get("/", requirePermission("meetings.view"), asyncHandler(async (req, res) => {
  const { clientId, projectId } = req.query as Record<string, string>;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;
  const configuredModules = (req as any).userConfiguredModules;
  const canViewClients = canManageEnabledSection(userRole, "clients", configuredModules);
  const canViewProjects = canManageEnabledSection(userRole, "projects", configuredModules);
  const canViewTeam = canManageEnabledSection(userRole, "team", configuredModules);

  const conditions = [];
  if (clientId) {
    if (!canViewClients) throw createError("Forbidden: Enable Clients to filter meetings by client", 403);
    if (!isValidUUID(clientId)) throw createError("Invalid clientId format", 400);
    conditions.push(eq(meetings.clientId, clientId));
  }
  if (projectId) {
    if (!canViewProjects) throw createError("Forbidden: Enable Projects to filter meetings by project", 403);
    if (!isValidUUID(projectId)) throw createError("Invalid projectId format", 400);
    conditions.push(eq(meetings.projectId, projectId));
  }

  const isPrivileged = canManageMeetingWorkspace(userRole, (req as any).userConfiguredModules);

  let allMeetings;
  if (isPrivileged) {
    allMeetings = await db.select().from(meetings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`start_time desc`);
  } else {
    // For regular employees, find meetings where they are organizer, creator, or attendee
    const attendeeMeetings = await db.select({ meetingId: meetingAttendees.meetingId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.userId, userId));
    const userMeetingIds = new Set(attendeeMeetings.map((a) => a.meetingId));

    const userOrConditions = [
      eq(meetings.organizerId, userId),
      eq(meetings.createdBy, userId),
    ];
    if (userMeetingIds.size > 0) {
      userOrConditions.push(inArray(meetings.id, Array.from(userMeetingIds)));
    }

    const userCondition = or(...userOrConditions)!;
    const finalConditions = conditions.length > 0 ? and(userCondition, ...conditions) : userCondition;

    allMeetings = await db.select().from(meetings)
      .where(finalConditions)
      .orderBy(sql`start_time desc`);
  }

  if (allMeetings.length === 0) {
    return res.json([]);
  }

  const meetingIds = allMeetings.map((m) => m.id);
  const attendeesList = await db.select().from(meetingAttendees)
    .where(inArray(meetingAttendees.meetingId, meetingIds));
  const participantIds = Array.from(new Set([
    ...allMeetings.map((meeting) => meeting.organizerId).filter(Boolean),
    ...attendeesList.map((attendee) => attendee.userId).filter(Boolean),
  ])) as string[];
  const relatedClientIds = Array.from(new Set(allMeetings.map((meeting) => meeting.clientId).filter(Boolean))) as string[];
  const relatedProjectIds = Array.from(new Set(allMeetings.map((meeting) => meeting.projectId).filter(Boolean))) as string[];
  const [allUsers, allClients, allProjects] = await Promise.all([
    participantIds.length
      ? db.select({ id: users.id, name: users.name, email: users.email }).from(users)
          .where(inArray(users.id, participantIds))
      : Promise.resolve([]),
    canViewClients && relatedClientIds.length
      ? db.select({ id: clients.id, companyName: clients.companyName }).from(clients)
          .where(inArray(clients.id, relatedClientIds))
      : Promise.resolve([]),
    canViewProjects && relatedProjectIds.length
      ? db.select({ id: projects.id, name: projects.name }).from(projects)
          .where(inArray(projects.id, relatedProjectIds))
      : Promise.resolve([]),
  ]);

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
  const clientMap = Object.fromEntries(allClients.map((c) => [c.id, c.companyName]));
  const projectMap = Object.fromEntries(allProjects.map((p) => [p.id, p.name]));

  const attendeesByMeeting: Record<string, any[]> = {};
  attendeesList.forEach((a) => {
    if (!attendeesByMeeting[a.meetingId]) attendeesByMeeting[a.meetingId] = [];
    const uInfo = a.userId ? userMap[a.userId] : null;
    attendeesByMeeting[a.meetingId].push({
      ...a,
      name: a.name || uInfo?.name || "Guest",
      email: canViewTeam ? a.email || uInfo?.email || "" : "",
    });
  });

  const result = allMeetings.map((m) => ({
    ...m,
    clientId: canViewClients ? m.clientId : null,
    projectId: canViewProjects ? m.projectId : null,
    clientName: m.clientId ? clientMap[m.clientId] ?? null : null,
    projectName: m.projectId ? projectMap[m.projectId] ?? null : null,
    organizerName: m.organizerId ? userMap[m.organizerId]?.name ?? "Admin" : "Admin",
    startTime: m.startTime.toISOString(),
    endTime: m.endTime.toISOString(),
    attendees: attendeesByMeeting[m.id] ?? [],
  }));

  return res.json(result);
}));

// GET /meetings/:id - Get single meeting details
router.get("/:id", requirePermission("meetings.view"), asyncHandler(async (req, res) => {
  const id = String(req.params.id ?? "");
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;
  const configuredModules = (req as any).userConfiguredModules;
  const canViewClients = canManageEnabledSection(userRole, "clients", configuredModules);
  const canViewProjects = canManageEnabledSection(userRole, "projects", configuredModules);
  const canViewTeam = canManageEnabledSection(userRole, "team", configuredModules);

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);

  const [m] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!m) throw createError("Meeting not found", 404);

  const attendeesList = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
  const [currentUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  const isPrivileged = canManageMeetingWorkspace(userRole, (req as any).userConfiguredModules);
  const isAttendee = attendeesList.some((a) => a.userId === userId || (currentUser?.email && a.email === currentUser.email));
  const isOrganizer = m.organizerId === userId || m.createdBy === userId;

  if (!isPrivileged && !isAttendee && !isOrganizer) {
    throw createError("Forbidden: You do not have permission to view this meeting", 403);
  }

  const participantIds = Array.from(new Set([
    m.organizerId,
    ...attendeesList.map((attendee) => attendee.userId),
  ].filter(Boolean))) as string[];
  const [allUsers, allClients, allProjects] = await Promise.all([
    participantIds.length
      ? db.select({ id: users.id, name: users.name, email: users.email }).from(users)
          .where(inArray(users.id, participantIds))
      : Promise.resolve([]),
    canViewClients && m.clientId
      ? db.select({ id: clients.id, companyName: clients.companyName }).from(clients)
          .where(eq(clients.id, m.clientId))
      : Promise.resolve([]),
    canViewProjects && m.projectId
      ? db.select({ id: projects.id, name: projects.name }).from(projects)
          .where(eq(projects.id, m.projectId))
      : Promise.resolve([]),
  ]);

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
  const clientMap = Object.fromEntries(allClients.map((c) => [c.id, c.companyName]));
  const projectMap = Object.fromEntries(allProjects.map((p) => [p.id, p.name]));

  const attendees = attendeesList.map((a) => {
    const uInfo = a.userId ? userMap[a.userId] : null;
    return {
      ...a,
      name: a.name || uInfo?.name || "Guest",
      email: canViewTeam ? a.email || uInfo?.email || "" : "",
    };
  });

  return res.json({
    ...m,
    clientId: canViewClients ? m.clientId : null,
    projectId: canViewProjects ? m.projectId : null,
    clientName: m.clientId ? clientMap[m.clientId] ?? null : null,
    projectName: m.projectId ? projectMap[m.projectId] ?? null : null,
    organizerName: m.organizerId ? userMap[m.organizerId]?.name ?? "Admin" : "Admin",
    startTime: m.startTime.toISOString(),
    endTime: m.endTime.toISOString(),
    attendees,
  });
}));

// POST /meetings - Schedule a new meeting
router.post("/", requirePermission("meetings.create"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;
  const configuredModules = (req as any).userConfiguredModules;
  const canViewClients = canManageEnabledSection(userRole, "clients", configuredModules);
  const canViewProjects = canManageEnabledSection(userRole, "projects", configuredModules);
  const canViewTeam = canManageEnabledSection(userRole, "team", configuredModules);

  const {
    title,
    description,
    meetingLink,
    startTime,
    endTime,
    location,
    clientId,
    projectId,
    attendeeUserIds = [],
  } = req.body;

  if (typeof title !== "string" || !title.trim() || title.trim().length > 200 || !startTime || !endTime) {
    throw createError("Title, start time, and end time are required", 400);
  }
  const cleanTitle = title.trim();

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw createError("Invalid start or end time format", 400);
  }
  if (end.getTime() <= start.getTime()) {
    throw createError("End time must be after start time", 400);
  }

  if (clientId && !canViewClients) {
    throw createError("Forbidden: Enable Clients to link a client to this meeting", 403);
  }
  if (projectId && !canViewProjects) {
    throw createError("Forbidden: Enable Projects to link a project to this meeting", 403);
  }
  if (clientId && !isValidUUID(clientId)) throw createError("Invalid clientId format", 400);
  if (projectId && !isValidUUID(projectId)) throw createError("Invalid projectId format", 400);
  if (clientId) {
    const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
    if (!client) throw createError("Client not found", 404);
  }
  if (projectId) {
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId));
    if (!project) throw createError("Project not found", 404);
  }

  if (!Array.isArray(attendeeUserIds)) {
    throw createError("attendeeUserIds must be an array", 400);
  }
  const finalAttendeeIds = Array.from(new Set([...attendeeUserIds, userId]));
  if (finalAttendeeIds.some((id) => typeof id !== "string" || !isValidUUID(id))) {
    throw createError("Invalid attendee ID", 400);
  }
  if (!canViewTeam && finalAttendeeIds.some((id) => id !== userId)) {
    throw createError("Forbidden: Enable Team to invite other users", 403);
  }
  const activeUsers = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
  }).from(users).where(and(
    eq(users.isActive, true),
    inArray(users.id, finalAttendeeIds),
  ));
  if (activeUsers.length !== finalAttendeeIds.length) {
    throw createError("One or more invitees are inactive or unavailable", 400);
  }
  const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const creatorName = creator?.name || "A user";

  const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

  const meetingId = crypto.randomUUID();
  const [newMeeting] = await db.insert(meetings).values({
    id: meetingId,
    title: cleanTitle,
    description: description ?? null,
    meetingLink: meetingLink ?? null,
    startTime: start,
    endTime: end,
    durationMinutes,
    location: location ?? null,
    organizerId: userId,
    clientId: clientId || null,
    projectId: projectId || null,
    createdBy: userId,
  }).returning();

  // Insert meeting attendees
  const attendeesToInsert = finalAttendeeIds.map((uId) => {
    const u = activeUsers.find((user) => user.id === uId);
    return {
      id: crypto.randomUUID(),
      meetingId,
      userId: uId,
      name: u?.name ?? null,
      email: u?.email ?? null,
      status: uId === userId ? "ORGANIZER" : "INVITED",
    };
  });

  if (attendeesToInsert.length > 0) {
    await db.insert(meetingAttendees).values(attendeesToInsert);
  }

  // Determine notify target user IDs (all invited except creator)
  const notifyUserIds = finalAttendeeIds.filter((id) => id !== userId);

  const formattedTime = start.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const notifPayload = {
    title: `📅 New Meeting: ${cleanTitle}`,
    message: `${creatorName} invited you to "${cleanTitle}" scheduled for ${formattedTime}.${meetingLink ? ` Link: ${meetingLink}` : ""}`,
    type: "MEETING",
    priority: "HIGH" as const,
    action: "MEETING_INVITED",
    actionUrl: `/meetings?id=${meetingId}`,
    referenceId: meetingId,
    referenceType: "MEETING",
    createdBy: userId,
  };

  // 1. Notify specific invited attendees
  if (notifyUserIds.length > 0) {
    await NotificationService.createNotificationsForUsers(notifyUserIds, notifPayload);
  }

  // Notify only root users and users explicitly granted the Meetings section.
  const candidates = await db.select({
    id: users.id,
    systemRole: users.systemRole,
    role: users.role,
    allowedModules: users.allowedModules,
  }).from(users).where(sql`(${users.isActive} IS TRUE OR ${users.isActive} IS NULL)`);
  const adminIds = candidates
    .filter((candidate) => canManageMeetingWorkspace(
      candidate.systemRole ?? candidate.role,
      candidate.allowedModules,
    ))
    .map((candidate) => candidate.id);
  const unnotifiedAdmins = adminIds.filter((aId) => aId !== userId && !notifyUserIds.includes(aId));
  if (unnotifiedAdmins.length > 0) {
    await NotificationService.createNotificationsForUsers(unnotifiedAdmins, {
      ...notifPayload,
      title: `📅 New Meeting Created: ${cleanTitle}`,
      message: `${creatorName} created meeting "${cleanTitle}" scheduled for ${formattedTime}.`,
    });
  }

  meetingLogger.info(
    {
      meetingId,
      title: cleanTitle,
      organizerId: userId,
      attendeesCount: attendeesToInsert.length,
      startTime: start,
      endTime: end,
    },
    "Meeting created"
  );

  return res.status(201).json({
    ...newMeeting,
    startTime: newMeeting.startTime.toISOString(),
    endTime: newMeeting.endTime.toISOString(),
    attendees: attendeesToInsert,
  });
}));

// PUT /meetings/:id - Update an existing meeting
router.put("/:id", requirePermission("meetings.edit"), asyncHandler(async (req, res) => {
  const id = String(req.params.id ?? "");
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;
  const configuredModules = (req as any).userConfiguredModules;
  const canViewClients = canManageEnabledSection(userRole, "clients", configuredModules);
  const canViewProjects = canManageEnabledSection(userRole, "projects", configuredModules);
  const canViewTeam = canManageEnabledSection(userRole, "team", configuredModules);

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);

  const [existing] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!existing) throw createError("Meeting not found", 404);

  const isPrivileged = canManageMeetingWorkspace(userRole, (req as any).userConfiguredModules);
  if (!isPrivileged && existing.organizerId !== userId && existing.createdBy !== userId) {
    throw createError("Forbidden: You do not have permission to edit this meeting", 403);
  }

  const {
    title,
    description,
    meetingLink,
    startTime,
    endTime,
    location,
    status,
    clientId,
    projectId,
    attendeeUserIds,
  } = req.body;

  if (!title || !startTime || !endTime) {
    throw createError("Title, start time, and end time are required", 400);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw createError("Invalid start or end time format", 400);
  }

  if (end.getTime() <= start.getTime()) {
    throw createError("End time must be after start time", 400);
  }
  if (status != null && !["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status)) {
    throw createError("Invalid meeting status", 400);
  }

  if (!canViewClients && clientId) {
    throw createError("Forbidden: Enable Clients to link a client to this meeting", 403);
  }
  if (!canViewProjects && projectId) {
    throw createError("Forbidden: Enable Projects to link a project to this meeting", 403);
  }
  const nextClientId = canViewClients && clientId !== undefined
    ? clientId || null
    : existing.clientId;
  const nextProjectId = canViewProjects && projectId !== undefined
    ? projectId || null
    : existing.projectId;
  if (nextClientId && !isValidUUID(nextClientId)) throw createError("Invalid clientId format", 400);
  if (nextProjectId && !isValidUUID(nextProjectId)) throw createError("Invalid projectId format", 400);
  if (nextClientId) {
    const [client] = await db.select({ id: clients.id }).from(clients)
      .where(eq(clients.id, nextClientId));
    if (!client) throw createError("Client not found", 404);
  }
  if (nextProjectId) {
    const [project] = await db.select({ id: projects.id }).from(projects)
      .where(eq(projects.id, nextProjectId));
    if (!project) throw createError("Project not found", 404);
  }

  let attendeesToInsert: Array<{
    id: string;
    meetingId: string;
    userId: string;
    name: string | null;
    email: string | null;
    status: string;
  }> | undefined;
  if (attendeeUserIds !== undefined) {
    if (!Array.isArray(attendeeUserIds)) {
      throw createError("attendeeUserIds must be an array", 400);
    }
    if (!canViewTeam) {
      throw createError("Forbidden: Enable Team to update meeting invitees", 403);
    }
    const finalIds = Array.from(new Set([...attendeeUserIds, userId]));
    if (finalIds.some((inviteeId) => typeof inviteeId !== "string" || !isValidUUID(inviteeId))) {
      throw createError("Invalid attendee ID", 400);
    }
    const activeUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users).where(and(
      eq(users.isActive, true),
      inArray(users.id, finalIds),
    ));
    if (activeUsers.length !== finalIds.length) {
      throw createError("One or more invitees are inactive or unavailable", 400);
    }
    attendeesToInsert = finalIds.map((inviteeId) => {
      const invitee = activeUsers.find((candidate) => candidate.id === inviteeId)!;
      return {
        id: crypto.randomUUID(),
        meetingId: id,
        userId: inviteeId,
        name: invitee.name,
        email: invitee.email,
        status: inviteeId === userId ? "ORGANIZER" : "INVITED",
      };
    });
  }

  const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

  const [updatedMeeting] = await db.update(meetings)
    .set({
      title,
      description: description ?? null,
      meetingLink: meetingLink ?? null,
      startTime: start,
      endTime: end,
      durationMinutes,
      location: location ?? null,
      status: status || existing.status,
      clientId: nextClientId,
      projectId: nextProjectId,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, id))
    .returning();

  const [updater] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const updaterName = updater?.name || "A user";

  // If attendeeUserIds was provided in payload, sync attendees
  if (attendeesToInsert) {
    await db.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
    await db.insert(meetingAttendees).values(attendeesToInsert);

    const notifyUserIds = attendeesToInsert
      .map((attendee) => attendee.userId)
      .filter((attendeeId) => attendeeId !== userId);
    const formattedTime = start.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    if (notifyUserIds.length > 0) {
      await NotificationService.createNotificationsForUsers(notifyUserIds, {
        title: `📝 Updated Meeting: ${title}`,
        message: `${updaterName} updated meeting details for "${title}" scheduled for ${formattedTime}.${meetingLink ? ` Link: ${meetingLink}` : ""}`,
        type: "MEETING",
        priority: "MEDIUM",
        action: "MEETING_UPDATED",
        actionUrl: `/meetings?id=${id}`,
        referenceId: id,
        referenceType: "MEETING",
        createdBy: userId,
      });
    }
  }

  meetingLogger.info({ meetingId: id, title, updatedBy: userId }, "Meeting updated");

  return res.json({
    ...updatedMeeting,
    startTime: updatedMeeting.startTime.toISOString(),
    endTime: updatedMeeting.endTime.toISOString(),
  });
}));

// PATCH /meetings/:id/status - Quick status change (e.g. COMPLETED, CANCELLED)
router.patch("/:id/status", requirePermission("meetings.edit"), asyncHandler(async (req, res) => {
  const id = String(req.params.id ?? "");
  const { status } = req.body;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);
  if (!status) throw createError("Status is required", 400);

  const [existing] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!existing) throw createError("Meeting not found", 404);

  const isPrivileged = canManageMeetingWorkspace(userRole, (req as any).userConfiguredModules);
  if (!isPrivileged && existing.organizerId !== userId && existing.createdBy !== userId) {
    throw createError("Forbidden: You do not have permission to modify this meeting", 403);
  }

  const [updated] = await db.update(meetings)
    .set({
      status,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, id))
    .returning();

  const [updater] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const updaterName = updater?.name || "A user";

  // Notify all attendees
  const attendeesList = await db.select({ userId: meetingAttendees.userId }).from(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
  const notifyUserIds = Array.from(new Set(attendeesList.map((a) => a.userId).filter(Boolean))).filter((uId) => uId !== userId) as string[];

  let statusTitle = "🔄 Meeting Status Updated";
  if (status === "CANCELLED") statusTitle = "❌ Meeting Cancelled";
  if (status === "COMPLETED") statusTitle = "✅ Meeting Completed";

  if (notifyUserIds.length > 0) {
    await NotificationService.createNotificationsForUsers(notifyUserIds, {
      title: statusTitle,
      message: `${updaterName} updated status of meeting "${existing.title}" to ${status}.`,
      type: "MEETING",
      priority: "HIGH",
      action: "MEETING_STATUS_CHANGED",
      actionUrl: `/meetings?id=${id}`,
      referenceId: id,
      referenceType: "MEETING",
      createdBy: userId,
    });
  }

  meetingLogger.info({ meetingId: id, status, updatedBy: userId }, "Meeting status updated");

  return res.json({
    ...updated,
    startTime: updated.startTime.toISOString(),
    endTime: updated.endTime.toISOString(),
  });
}));

// DELETE /meetings/:id - Delete / cancel meeting
router.delete("/:id", requirePermission("meetings.delete"), asyncHandler(async (req, res) => {
  const id = String(req.params.id ?? "");
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);

  const [existing] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!existing) throw createError("Meeting not found", 404);

  const isPrivileged = canManageMeetingWorkspace(userRole, (req as any).userConfiguredModules);
  if (!isPrivileged && existing.organizerId !== userId && existing.createdBy !== userId) {
    throw createError("Forbidden: You do not have permission to delete this meeting", 403);
  }

  const [deleter] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const deleterName = deleter?.name || "A user";

  const attendeesList = await db.select({ userId: meetingAttendees.userId }).from(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
  const notifyUserIds = Array.from(new Set(attendeesList.map((a) => a.userId).filter(Boolean))).filter((uId) => uId !== userId) as string[];

  await db.delete(meetings).where(eq(meetings.id, id));

  if (notifyUserIds.length > 0) {
    await NotificationService.createNotificationsForUsers(notifyUserIds, {
      title: "🗑️ Meeting Deleted",
      message: `${deleterName} deleted the meeting "${existing.title}".`,
      type: "MEETING",
      priority: "HIGH",
      action: "MEETING_DELETED",
      actionUrl: "/meetings",
      referenceId: id,
      referenceType: "MEETING",
      createdBy: userId,
    });
  }

  meetingLogger.info({ meetingId: id, title: existing.title, deletedBy: userId }, "Meeting cancelled/deleted");

  return res.json({ success: true, message: "Meeting cancelled" });
}));

export default router;
