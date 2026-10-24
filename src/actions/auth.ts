"use server";

import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  organization: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(128)
});

export async function registerOrganization(formData: FormData) {
  const rateLimit = await checkRateLimit("register", [await getRequestIp()]);
  if (!rateLimit.allowed) {
    return {
      error:
        rateLimit.reason === "limited"
          ? "Too many workspace registration attempts. Please try again later."
          : "Workspace registration is temporarily unavailable."
    };
  }

  const parsed = registrationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    organization: formData.get("organization"),
    password: formData.get("password")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };

  const { name, organization, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const slugBase =
    organization
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "workspace";
  const passwordHash = await hash(password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.organization.create({
      data: { name: organization, slug: `${slugBase}-${randomUUID().slice(0, 8)}` }
    });
    const user = await tx.user.create({
      data: {
        organizationId: tenant.id,
        email,
        name,
        passwordHash,
        role: "ADMIN"
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: tenant.id,
        userId: user.id,
        action: "REGISTER",
        status: "SUCCESS",
        ipAddress: await getRequestIp()
      }
    });
    return { user, organizationSlug: tenant.slug };
  });
  return { success: true, email: result.user.email, organizationSlug: result.organizationSlug };
}
