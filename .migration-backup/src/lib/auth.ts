import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import type { SystemRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    systemRole: SystemRole;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      systemRole: SystemRole;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    systemRole: SystemRole;
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) {
          await prisma.loginHistory.create({
            data: {
              userId: user.id,
              success: false,
            },
          });
          return null;
        }

        await prisma.loginHistory.create({
          data: { userId: user.id, success: true },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          systemRole: user.systemRole,
        };
      },
    }),
  ],
});
