import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { requirePermission } from "../middleware/auth";

const router = Router();

/**
 * GET /api/employees
 * Returns all employee records joined with their corresponding user details.
 */
router.get("/", requirePermission("users.view"), asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      id: employeesTable.id,
      userId: employeesTable.userId,
      employeeCode: employeesTable.employeeCode,
      designation: employeesTable.designation,
      joiningDate: employeesTable.joiningDate,
      salary: employeesTable.salary,
      managerId: employeesTable.managerId,
      emergencyContact: employeesTable.emergencyContact,
      createdAt: employeesTable.createdAt,
      updatedAt: employeesTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userRole: usersTable.role,
      userSystemRole: usersTable.systemRole,
      userDepartment: usersTable.department,
      userIsActive: usersTable.isActive,
    })
    .from(employeesTable)
    .innerJoin(usersTable, eq(employeesTable.userId, usersTable.id));

  return res.json(rows);
}));

/**
 * GET /api/employees/:id
 * Returns a specific employee record by ID or userId.
 */
router.get("/:id", requirePermission("users.view"), asyncHandler(async (req, res) => {
  const targetId = req.params.id as string;

  const [row] = await db
    .select({
      id: employeesTable.id,
      userId: employeesTable.userId,
      employeeCode: employeesTable.employeeCode,
      designation: employeesTable.designation,
      joiningDate: employeesTable.joiningDate,
      salary: employeesTable.salary,
      managerId: employeesTable.managerId,
      emergencyContact: employeesTable.emergencyContact,
      createdAt: employeesTable.createdAt,
      updatedAt: employeesTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userRole: usersTable.role,
      userSystemRole: usersTable.systemRole,
      userDepartment: usersTable.department,
      userIsActive: usersTable.isActive,
    })
    .from(employeesTable)
    .innerJoin(usersTable, eq(employeesTable.userId, usersTable.id))
    .where(eq(employeesTable.id, targetId));

  if (!row) {
    // Try searching by userId
    const [rowByUserId] = await db
      .select({
        id: employeesTable.id,
        userId: employeesTable.userId,
        employeeCode: employeesTable.employeeCode,
        designation: employeesTable.designation,
        joiningDate: employeesTable.joiningDate,
        salary: employeesTable.salary,
        managerId: employeesTable.managerId,
        emergencyContact: employeesTable.emergencyContact,
        createdAt: employeesTable.createdAt,
        updatedAt: employeesTable.updatedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userRole: usersTable.role,
        userSystemRole: usersTable.systemRole,
        userDepartment: usersTable.department,
        userIsActive: usersTable.isActive,
      })
      .from(employeesTable)
      .innerJoin(usersTable, eq(employeesTable.userId, usersTable.id))
      .where(eq(employeesTable.userId, targetId));

    if (!rowByUserId) {
      return res.status(404).json({ error: "Employee not found" });
    }
    return res.json(rowByUserId);
  }

  return res.json(row);
}));

export default router;
