import { Router } from "express";
import { db } from "@workspace/db";
import { meetings, meetingAttendees, notifications, users, clients, projects } from "@workspace/db/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";
import { requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { isValidUUID } from "../lib/validation";
import { NotificationService } from "../services/notificationService";
import { meetingLogger } from "../lib/logger";

const router = Router();

// GET /meetings - List meetings with filters
router.get("/", requirePermission("time.view"), asyncHandler(async (req, res) => {
  const { clientId, projectId } = req.query as Record<string, string>;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  const conditions = [];
  if (clientId) {
    if (!isValidUUID(clientId)) throw createError("Invalid clientId format", 400);
    conditions.push(eq(meetings.clientId, clientId));
  }
  if (projectId) {
    if (!isValidUUID(projectId)) throw createError("Invalid projectId format", 400);
    conditions.push(eq(meetings.projectId, projectId));
  }

  const isPrivileged = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(userRole);

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
  const [attendeesList, allUsers, allClients, allProjects] = await Promise.all([
    db.select().from(meetingAttendees).where(inArray(meetingAttendees.meetingId, meetingIds)),
    db.select({ id: users.id, name: users.name, email: users.email }).from(users),
    db.select({ id: clients.id, companyName: clients.companyName }).from(clients),
    db.select({ id: projects.id, name: projects.name }).from(projects),
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
      email: a.email || uInfo?.email || "",
    });
  });

  const result = allMeetings.map((m) => ({
    ...m,
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
router.get("/:id", requirePermission("time.view"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);

  const [m] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!m) throw createError("Meeting not found", 404);

  const attendeesList = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, id));
  const [currentUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  const isPrivileged = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(userRole);
  const isAttendee = attendeesList.some((a) => a.userId === userId || (currentUser?.email && a.email === currentUser.email));
  const isOrganizer = m.organizerId === userId || m.createdBy === userId;

  if (!isPrivileged && !isAttendee && !isOrganizer) {
    throw createError("Forbidden: You do not have permission to view this meeting", 403);
  }

  const [allUsers, allClients, allProjects] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email }).from(users),
    db.select({ id: clients.id, companyName: clients.companyName }).from(clients),
    db.select({ id: projects.id, name: projects.name }).from(projects),
  ]);

  const userMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
  const clientMap = Object.fromEntries(allClients.map((c) => [c.id, c.companyName]));
  const projectMap = Object.fromEntries(allProjects.map((p) => [p.id, p.name]));

  const attendees = attendeesList.map((a) => {
    const uInfo = a.userId ? userMap[a.userId] : null;
    return {
      ...a,
      name: a.name || uInfo?.name || "Guest",
      email: a.email || uInfo?.email || "",
    };
  });

  return res.json({
    ...m,
    clientName: m.clientId ? clientMap[m.clientId] ?? null : null,
    projectName: m.projectId ? projectMap[m.projectId] ?? null : null,
    organizerName: m.organizerId ? userMap[m.organizerId]?.name ?? "Admin" : "Admin",
    startTime: m.startTime.toISOString(),
    endTime: m.endTime.toISOString(),
    attendees,
  });
}));

// POST /meetings - Schedule a new meeting
router.post("/", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;

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

  if (!title || !startTime || !endTime) {
    throw createError("Title, start time, and end time are required", 400);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw createError("Invalid start or end time format", 400);
  }

  const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

  const meetingId = crypto.randomUUID();
  const [newMeeting] = await db.insert(meetings).values({
    id: meetingId,
    title,
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

  // Get active users for attendee selection and notification delivery
  const activeUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true));
  const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const creatorName = creator?.name || "A user";

  // Ensure creator/organizer is included in attendees
  const rawTargetIds: string[] = Array.isArray(attendeeUserIds) && attendeeUserIds.length > 0
    ? attendeeUserIds
    : activeUsers.map((u) => u.id);
  
  const attendeeUserSet = new Set<string>(rawTargetIds);
  attendeeUserSet.add(userId);
  const finalAttendeeIds = Array.from(attendeeUserSet);

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
    title: `📅 New Meeting: ${title}`,
    message: `${creatorName} invited you to "${title}" scheduled for ${formattedTime}.${meetingLink ? ` Link: ${meetingLink}` : ""}`,
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

  // 2. Always notify Admins and Managers about new meeting creations (if not already notified)
  const adminIds = await NotificationService.getAdminAndManagerUserIds();
  const unnotifiedAdmins = adminIds.filter((aId) => aId !== userId && !notifyUserIds.includes(aId));
  if (unnotifiedAdmins.length > 0) {
    await NotificationService.createNotificationsForUsers(unnotifiedAdmins, {
      ...notifPayload,
      title: `📅 New Meeting Created: ${title}`,
      message: `${creatorName} created meeting "${title}" scheduled for ${formattedTime}.`,
    });
  }

  meetingLogger.info(
    {
      meetingId,
      title,
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
router.put("/:id", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);

  const [existing] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!existing) throw createError("Meeting not found", 404);

  const isPrivileged = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(userRole);
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
      clientId: clientId || null,
      projectId: projectId || null,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(meetings.id, id))
    .returning();

  const [updater] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const updaterName = updater?.name || "A user";

  // If attendeeUserIds was provided in payload, sync attendees
  if (Array.isArray(attendeeUserIds)) {
    await db.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, id));

    const activeUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
    const finalIds = Array.from(new Set([...attendeeUserIds, userId]));

    const attendeesToInsert = finalIds.map((uId) => {
      const u = activeUsers.find((user) => user.id === uId);
      return {
        id: crypto.randomUUID(),
        meetingId: id,
        userId: uId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        status: uId === userId ? "ORGANIZER" : "INVITED",
      };
    });

    if (attendeesToInsert.length > 0) {
      await db.insert(meetingAttendees).values(attendeesToInsert);
    }

    const notifyUserIds = finalIds.filter((uId) => uId !== userId);
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
router.patch("/:id/status", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);
  if (!status) throw createError("Status is required", 400);

  const [existing] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!existing) throw createError("Meeting not found", 404);

  const isPrivileged = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(userRole);
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
router.delete("/:id", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = (req as any).userId;
  const userRole = (req as any).userSystemRole;

  if (!isValidUUID(id)) throw createError("Invalid ID format", 400);

  const [existing] = await db.select().from(meetings).where(eq(meetings.id, id));
  if (!existing) throw createError("Meeting not found", 404);

  const isPrivileged = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(userRole);
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
