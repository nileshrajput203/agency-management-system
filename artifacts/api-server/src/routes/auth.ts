import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import { signToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { authLogger } from "../lib/logger";
import { syncUserEmployeeAndRole } from "../services/userService";

function parseAllowedModules(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string" && val) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

const router = Router();

router.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw createError("Email and password are required", 400);

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
      allowedModules: usersTable.allowedModules,
      isActive: usersTable.isActive,
      password: usersTable.password,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) {
    authLogger.warn({ email }, "Login failure: User not found");
    throw createError("Invalid credentials", 401);
  }

  const valid = await compare(password, user.password || "");
  if (!valid) {
    authLogger.warn({ email, userId: user.id }, "Login failure: Invalid password");
    throw createError("Invalid credentials", 401);
  }

  if (!user.isActive) {
    authLogger.warn({ email, userId: user.id }, "Login failure: Account deactivated");
    throw createError(
      "Your account has been deactivated. Please contact your administrator.",
      403,
    );
  }

  const token = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  authLogger.info({ userId: user.id, email: user.email, role: user.role }, "Login success");

  return res.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
      allowedModules: parseAllowedModules(user.allowedModules),
    },
  });
}));

router.post("/auth/refresh", asyncHandler(async (req, res) => {
  let refreshToken = req.body?.refreshToken;

  if (!refreshToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      refreshToken = authHeader.slice(7);
    } else if (req.headers["x-refresh-token"]) {
      refreshToken = req.headers["x-refresh-token"] as string;
    }
  }

  if (!refreshToken || typeof refreshToken !== "string") {
    authLogger.warn("Token refresh failure: Missing refresh token");
    throw createError("Refresh token is required", 400);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err: any) {
    authLogger.warn(`Token refresh failure: ${err.message}`);
    throw createError("Invalid or expired refresh token", 401);
  }

  const userId = payload.sub;

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
      allowedModules: usersTable.allowedModules,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    authLogger.warn({ userId }, "Token refresh failure: User not found");
    throw createError("Invalid or expired refresh token", 401);
  }

  if (!user.isActive) {
    authLogger.warn({ userId, email: user.email }, "Token refresh failure: Account deactivated");
    throw createError(
      "Your account has been deactivated. Please contact your administrator.",
      403,
    );
  }

  const newToken = signToken(user.id);
  const newRefreshToken = signRefreshToken(user.id);

  authLogger.info({ userId: user.id, email: user.email }, "Token refresh success");

  return res.json({
    token: newToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
      allowedModules: parseAllowedModules(user.allowedModules),
    },
  });
}));

router.post("/auth/register", asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw createError("Name, email, and password are required", 400);
  }
  if (password.length < 6) {
    throw createError("Password must be at least 6 characters", 400);
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) throw createError("An account with this email already exists", 409);

  const passwordHash = await hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      password: passwordHash,
      role: "MANAGER",
      systemRole: "ACCOUNT_MANAGER",
      isActive: true,
    })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
    });

  await syncUserEmployeeAndRole(user);

  return res.status(201).json({
    message: "Account created successfully. You can now log in.",
    user,
  });
}));

export default router;


