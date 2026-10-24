"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-guard";
import { getRequestIp } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const createMemberSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["MANAGER", "VIEWER"])
});

export async function createMember(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return { error: "Only an organization admin can add members." };
  const parsed = createMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role")
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the member details." };
  const { name, password, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { organizationId: actor.organizationId, email },
    select: { id: true }
  });
  if (existing) return { error: "That email is already a member of this organization." };
  const passwordHash = await hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const member = await tx.user.create({
      data: {
        organizationId: actor.organizationId,
        email,
        name,
        passwordHash,
        role
      }
    });
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        action: "MEMBER_CREATE",
        status: "SUCCESS",
        ipAddress: await getRequestIp(),
        details: `Created ${role} account for ${member.email}.`
      }
    });
  });
  revalidatePath("/settings");
  revalidatePath("/share");
  revalidatePath("/audit-logs");
  return { success: true };
}

export async function changeMemberRole(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return { error: "Only an organization admin can change member roles." };
  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof userId !== "string" || !userId || (role !== "ADMIN" && role !== "MANAGER" && role !== "VIEWER")) {
    return { error: "Choose a valid member and role." };
  }
  const member = await prisma.user.findFirst({
    where: { id: userId, organizationId: actor.organizationId },
    select: { id: true, role: true, email: true }
  });
  if (!member) return { error: "Member not found." };
  if (member.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { organizationId: actor.organizationId, role: "ADMIN" }
    });
    if (adminCount <= 1) return { error: "The organization must retain at least one administrator." };
  }
  if (member.role === role) return { success: true };
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: member.id }, data: { role } });
    await tx.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.id,
        action: "ROLE_CHANGE",
        status: "SUCCESS",
        ipAddress: await getRequestIp(),
        details: `Changed ${member.email} from ${member.role} to ${role}.`
      }
    });
  });
  revalidatePath("/settings");
  revalidatePath("/audit-logs");
  return { success: true };
}
