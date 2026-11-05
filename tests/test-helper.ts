import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "../artifacts/api-server/src/lib/jwt";

let cachedToken: string | null = null;
let cachedAdminId: string | null = null;

export async function getTestAdmin(): Promise<{ token: string; id: string }> {
  if (cachedToken && cachedAdminId) {
    return { token: cachedToken, id: cachedAdminId };
  }
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.systemRole, "SUPER_ADMIN"))
    .limit(1);

  if (!admin) {
    throw new Error("No SUPER_ADMIN user found in database for integration tests");
  }

  cachedAdminId = admin.id;
  cachedToken = signToken(admin.id);
  return { token: cachedToken, id: cachedAdminId };
}
