import { Router } from "express";
import { db } from "@workspace/db";
import { shootsTable, clientsTable, projectsTable, usersTable, contentPostsTable } from "@workspace/db/schema";
import { eq, desc, asc, and, or } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";
import { NotificationService } from "../services/notificationService";

const router = Router();

// GET /api/shoots — list scheduled production shoots
router.get("/", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const { clientId, status, month } = req.query as Record<string, string>;

  const conditions = [];
  if (clientId) conditions.push(eq(shootsTable.clientId, clientId));
  if (status) conditions.push(eq(shootsTable.status, status.toUpperCase()));
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { like } = await import("drizzle-orm");
    conditions.push(like(shootsTable.shootDate, `${month}%`));
  }

  const rows = await db
    .select({
      id: shootsTable.id,
      title: shootsTable.title,
      clientId: shootsTable.clientId,
      clientName: clientsTable.companyName,
      projectId: shootsTable.projectId,
      projectName: projectsTable.name,
      shootDate: shootsTable.shootDate,
      startTime: shootsTable.startTime,
      endTime: shootsTable.endTime,
      locationName: shootsTable.locationName,
      googleMapsUrl: shootsTable.googleMapsUrl,
      status: shootsTable.status,
      crewAssignees: shootsTable.crewAssignees,
      equipmentList: shootsTable.equipmentList,
      shotList: shootsTable.shotList,
      callSheetNotes: shootsTable.callSheetNotes,
      createdAt: shootsTable.createdAt,
    })
    .from(shootsTable)
    .leftJoin(clientsTable, eq(shootsTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(shootsTable.projectId, projectsTable.id))
    .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : (await import("drizzle-orm")).and(...conditions)) : undefined)
    .orderBy(asc(shootsTable.shootDate));

  return res.json(rows);
}));

// GET /api/shoots/:id — get shoot detail
router.get("/:id", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid shoot ID format", 400);

  const [shoot] = await db
    .select({
      id: shootsTable.id,
      title: shootsTable.title,
      clientId: shootsTable.clientId,
      clientName: clientsTable.companyName,
      projectId: shootsTable.projectId,
      projectName: projectsTable.name,
      shootDate: shootsTable.shootDate,
      startTime: shootsTable.startTime,
      endTime: shootsTable.endTime,
      locationName: shootsTable.locationName,
      googleMapsUrl: shootsTable.googleMapsUrl,
      status: shootsTable.status,
      crewAssignees: shootsTable.crewAssignees,
      equipmentList: shootsTable.equipmentList,
      shotList: shootsTable.shotList,
      callSheetNotes: shootsTable.callSheetNotes,
      createdAt: shootsTable.createdAt,
    })
    .from(shootsTable)
    .leftJoin(clientsTable, eq(shootsTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(shootsTable.projectId, projectsTable.id))
    .where(eq(shootsTable.id, id));

  if (!shoot) throw createError("Shoot not found", 404);
  return res.json(shoot);
}));

// POST /api/shoots — schedule a new shoot
router.post("/", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const {
    title,
    clientId,
    projectId,
    shootDate,
    startTime,
    endTime,
    locationName,
    googleMapsUrl,
    status = "PLANNED",
    crewAssignees = [],
    equipmentList = [],
    shotList = [],
    callSheetNotes,
  } = req.body || {};

  if (!title || typeof title !== "string") {
    throw createError("Shoot title is required", 400);
  }
  if (!shootDate) {
    throw createError("Shoot date (YYYY-MM-DD) is required", 400);
  }

  const [shoot] = await db
    .insert(shootsTable)
    .values({
      title: title.trim(),
      clientId: clientId || null,
      projectId: projectId || null,
      shootDate,
      startTime: startTime || "10:00",
      endTime: endTime || "18:00",
      locationName: locationName || "Studio A",
      googleMapsUrl: googleMapsUrl || null,
      status: ["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status) ? status : "PLANNED",
      crewAssignees: Array.isArray(crewAssignees) ? crewAssignees : [],
      equipmentList: Array.isArray(equipmentList) ? equipmentList : [],
      shotList: Array.isArray(shotList) ? shotList : [],
      callSheetNotes: callSheetNotes || null,
      createdBy: (req as any).userId,
    })
    .returning();

  // Notify assigned crew members
  if (Array.isArray(crewAssignees)) {
    for (const crew of crewAssignees) {
      if (crew.userId) {
        NotificationService.createNotification({
          userId: crew.userId,
          title: `🎬 Production Shoot Scheduled: ${shoot.title}`,
          message: `You are booked as ${crew.role || "Crew"} on ${shoot.shootDate} at ${shoot.locationName || "Studio"}.`,
          type: "CONTENT",
          priority: "HIGH",
          actionUrl: "/content",
        }).catch(() => {});
      }
    }
  }

  return res.status(201).json(shoot);
}));

// PATCH /api/shoots/:id — update shoot & shot list
router.patch("/:id", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid shoot ID format", 400);

  const {
    title,
    clientId,
    projectId,
    shootDate,
    startTime,
    endTime,
    locationName,
    googleMapsUrl,
    status,
    crewAssignees,
    equipmentList,
    shotList,
    callSheetNotes,
  } = req.body || {};

  const [shoot] = await db
    .update(shootsTable)
    .set({
      ...(title !== undefined && { title }),
      ...(clientId !== undefined && { clientId }),
      ...(projectId !== undefined && { projectId }),
      ...(shootDate !== undefined && { shootDate }),
      ...(startTime !== undefined && { startTime }),
      ...(endTime !== undefined && { endTime }),
      ...(locationName !== undefined && { locationName }),
      ...(googleMapsUrl !== undefined && { googleMapsUrl }),
      ...(status !== undefined && { status }),
      ...(crewAssignees !== undefined && { crewAssignees }),
      ...(equipmentList !== undefined && { equipmentList }),
      ...(shotList !== undefined && { shotList }),
      ...(callSheetNotes !== undefined && { callSheetNotes }),
      updatedAt: new Date(),
    })
    .where(eq(shootsTable.id, id))
    .returning();

  if (!shoot) throw createError("Shoot not found", 404);
  return res.json(shoot);
}));

// DELETE /api/shoots/:id — delete shoot
router.delete("/:id", requirePermission("content.delete"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid shoot ID format", 400);

  const [deleted] = await db.delete(shootsTable).where(eq(shootsTable.id, id)).returning({ id: shootsTable.id });
  if (!deleted) throw createError("Shoot not found", 404);
  return res.status(204).send();
}));

// GET /api/shoots/:id/call-sheet-pdf — printable call sheet view
router.get("/:id/call-sheet-pdf", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid shoot ID format", 400);

  const [shoot] = await db
    .select({
      id: shootsTable.id,
      title: shootsTable.title,
      clientId: shootsTable.clientId,
      clientName: clientsTable.companyName,
      projectId: shootsTable.projectId,
      projectName: projectsTable.name,
      shootDate: shootsTable.shootDate,
      startTime: shootsTable.startTime,
      endTime: shootsTable.endTime,
      locationName: shootsTable.locationName,
      googleMapsUrl: shootsTable.googleMapsUrl,
      status: shootsTable.status,
      crewAssignees: shootsTable.crewAssignees,
      equipmentList: shootsTable.equipmentList,
      shotList: shootsTable.shotList,
      callSheetNotes: shootsTable.callSheetNotes,
      createdAt: shootsTable.createdAt,
    })
    .from(shootsTable)
    .leftJoin(clientsTable, eq(shootsTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(shootsTable.projectId, projectsTable.id))
    .where(eq(shootsTable.id, id));

  if (!shoot) throw createError("Shoot not found", 404);

  const crew = Array.isArray(shoot.crewAssignees) ? (shoot.crewAssignees as any[]) : [];
  const equipment = Array.isArray(shoot.equipmentList) ? (shoot.equipmentList as string[]) : [];
  const shots = Array.isArray(shoot.shotList) ? (shoot.shotList as any[]) : [];

  function esc(s: any): string {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Production Call Sheet — ${esc(shoot.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 32px; background: #fff; }
    .header { border-bottom: 3px solid #7c3aed; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    .badge { background: #f3e8ff; color: #6b21a8; font-weight: 700; padding: 4px 12px; border-radius: 9999px; font-size: 12px; text-transform: uppercase; }
    h1 { margin: 0 0 6px 0; font-size: 24px; color: #0f172a; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .meta-item label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .meta-item span { font-size: 14px; font-weight: 600; color: #1e293b; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin: 24px 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 8px 12px; border: 1px solid #e2e8f0; }
    td { font-size: 13px; padding: 8px 12px; border: 1px solid #e2e8f0; }
    .notes-box { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; margin-top: 16px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
    <button onclick="window.print()" style="background: #7c3aed; color: #fff; font-weight: 600; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer;">🖨️ Print Call Sheet</button>
  </div>

  <div class="header">
    <div>
      <div style="font-size: 12px; font-weight: 700; color: #7c3aed; letter-spacing: 0.1em; text-transform: uppercase;">Blink Beyond Media • Production Studio</div>
      <h1>${esc(shoot.title)}</h1>
      <div style="font-size: 14px; color: #64748b;">Client: <strong>${esc(shoot.clientName || "Direct / Internal")}</strong> &bull; Project: ${esc(shoot.projectName || "Studio Shoot")}</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">${esc(shoot.status)}</span>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><label>Shoot Date</label><span>📅 ${esc(shoot.shootDate)}</span></div>
    <div class="meta-item"><label>Call Time</label><span>⏰ ${esc(shoot.startTime)} – ${esc(shoot.endTime)}</span></div>
    <div class="meta-item"><label>Location</label><span>📍 ${esc(shoot.locationName || "Studio")}</span></div>
    <div class="meta-item"><label>Map Direction</label><span>${shoot.googleMapsUrl ? `<a href="${esc(shoot.googleMapsUrl)}" target="_blank" style="color: #7c3aed; text-decoration: underline;">Open Google Maps</a>` : "On Site"}</span></div>
  </div>

  <div class="section-title">👥 Crew & Production Cast</div>
  <table>
    <thead><tr><th>Role</th><th>Assignee</th><th>Contact / Status</th></tr></thead>
    <tbody>
      ${crew.length > 0 ? crew.map(c => `<tr><td><strong>${esc(c.role || "Crew")}</strong></td><td>${esc(c.userName || c.userId || "Assigned Crew")}</td><td>Confirmed</td></tr>`).join("") : '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No specific crew assignees attached</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">🎬 Shot List & Scene Schedule</div>
  <table>
    <thead><tr><th style="width: 60px;">Scene #</th><th>Action / Description</th><th style="width: 100px;">Format</th><th style="width: 80px;">Est. Sec</th><th style="width: 80px;">Status</th></tr></thead>
    <tbody>
      ${shots.length > 0 ? shots.map(s => `<tr><td style="font-weight: 700;">#${esc(s.sceneNo || 1)}</td><td>${esc(s.description)}</td><td>${esc(s.format || "Reel / 9:16")}</td><td>${esc(s.durationSec || 15)}s</td><td>${s.isShot ? "✅ Shot" : "⏳ Planned"}</td></tr>`).join("") : '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No shots recorded yet</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">🎥 Equipment & Gear Checklist</div>
  <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
    ${equipment.length > 0 ? equipment.map(e => `<span style="background: #e2e8f0; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 4px;">☑ ${esc(e)}</span>`).join("") : '<span style="color: #94a3b8; font-size: 13px;">Standard studio equipment package</span>'}
  </div>

  ${shoot.callSheetNotes ? `
  <div class="section-title">📋 Director & Production Notes</div>
  <div class="notes-box">
    ${esc(shoot.callSheetNotes).replace(/\n/g, "<br/>")}
  </div>
  ` : ""}
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  return res.send(html);
}));

export default router;

