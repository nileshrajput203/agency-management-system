import type { Request, Response, NextFunction } from "express";
import { signToken as jwtSignToken, verifyToken as jwtVerifyToken } from "./jwt";
import { db } from "@workspace/db";
import { sessions, users } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  systemRole: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: string): string {
  return jwtSignToken(userId);
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwtVerifyToken(token);
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date())
    ),
  });

  if (!session) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
  };

  next();
}
