import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestIp, writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  organizationSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1)
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        organizationSlug: { label: "Organization slug", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const requestIp = await getRequestIp();
        const suppliedEmail =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase().slice(0, 254)
            : "";
        const organizationSlug =
          typeof credentials?.organizationSlug === "string"
            ? credentials.organizationSlug.trim().toLowerCase().slice(0, 80)
            : "";
        const ipLimit = await checkRateLimit("login-ip", [requestIp]);
        const accountLimit = suppliedEmail
          ? await checkRateLimit("login-account", [`${organizationSlug}:${suppliedEmail}`])
          : { allowed: true as const };
        if (!ipLimit.allowed || !accountLimit.allowed) {
          const unavailable =
            (!ipLimit.allowed && ipLimit.reason === "unavailable") ||
            (!accountLimit.allowed && accountLimit.reason === "unavailable");
          throw new Error(
            unavailable
              ? "Sign-in is temporarily unavailable. Please try again later."
              : "Too many sign-in attempts. Please try again later."
          );
        }

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.trim().toLowerCase();
        const user = await prisma.user.findFirst({
          where: {
            email,
            organization: { slug: parsed.data.organizationSlug.trim().toLowerCase() }
          },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            organizationId: true,
            role: true
          }
        });
        if (!user) return null;
        if (!(await compare(parsed.data.password, user.passwordHash))) {
          await writeAudit({
            organizationId: user.organizationId,
            userId: user.id,
            action: "LOGIN",
            status: "FAILURE",
            details: "Incorrect credentials."
          });
          return null;
        }
        await writeAudit({
          organizationId: user.organizationId,
          userId: user.id,
          action: "LOGIN",
          status: "SUCCESS"
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = user.organizationId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.organizationId = token.organizationId;
        session.user.role = token.role;
      }
      return session;
    }
  }
};
