"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guard";
import { getRequestIp, writeAudit } from "@/lib/audit";

const shareSchema = z.object({
  documentId: z.string().min(1).max(64),
  targetUserId: z.string().min(1).max(64),
  expiresAt: z.string().max(64).optional()
});

export async function shareDocument(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to share a document." };
  const parsed = shareSchema.safeParse({
    documentId: formData.get("documentId"),
    targetUserId: formData.get("targetUserId"),
    expiresAt: formData.get("expiresAt") || undefined
  });
  if (!parsed.success) return { error: "Select a document and a registered user." };

  const { documentId, targetUserId, expiresAt } = parsed.data;
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: user.organizationId },
    select: { id: true, ownerId: true }
  });
  const mayShare =
    document &&
    (user.role === "ADMIN" || user.role === "MANAGER" || document.ownerId === user.id);
  if (!mayShare) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      documentId: document?.id ?? null,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: `Share denied: not authorized for document ${documentId}.`
    });
    return { error: "You do not have permission to share this document." };
  }
  const recipient = await prisma.user.findFirst({
    where: { id: targetUserId, organizationId: user.organizationId },
    select: { id: true }
  });
  if (!recipient) return { error: "Recipient must be a registered user in your organization." };
  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= new Date())) {
    return { error: "Choose a future expiration date." };
  }
  if (recipient.id === document.ownerId) return { error: "The document owner already has access." };

  await prisma.$transaction(async (tx) => {
    await tx.documentShare.upsert({
      where: { documentId_userId: { documentId, userId: recipient.id } },
      create: { documentId, userId: recipient.id, expiresAt: expiry },
      update: { expiresAt: expiry, revokedAt: null }
    });
    await tx.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        documentId,
        action: "SHARE",
        status: "SUCCESS",
        ipAddress: await getRequestIp(),
        details: `Access granted to user ${recipient.id}${expiry ? ` until ${expiry.toISOString()}` : ""}.`
      }
    });
  });
  revalidatePath("/share");
  revalidatePath("/documents");
  revalidatePath("/audit-logs");
  return { success: true };
}

export async function revokeShare(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to revoke access." };
  const shareId = formData.get("shareId");
  if (typeof shareId !== "string" || !shareId || shareId.length > 64) return { error: "Invalid share." };

  const share = await prisma.documentShare.findFirst({
    where: {
      id: shareId,
      document: { organizationId: user.organizationId },
      revokedAt: null
    },
    select: { id: true, documentId: true, document: { select: { ownerId: true } } }
  });
  const mayRevoke =
    share &&
    (user.role === "ADMIN" || user.role === "MANAGER" || share.document.ownerId === user.id);
  if (!mayRevoke) {
    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCESS_DENIED",
      status: "FAILURE",
      details: "Revoke denied: share not found or caller lacks permission."
    });
    return { error: "You do not have permission to revoke this share." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentShare.update({
      where: { id: share.id },
      data: { revokedAt: new Date() }
    });
    await tx.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        documentId: share.documentId,
        action: "REVOKE",
        status: "SUCCESS",
        ipAddress: await getRequestIp(),
        details: `Share ${share.id} revoked.`
      }
    });
  });
  revalidatePath("/share");
  revalidatePath("/documents");
  revalidatePath("/audit-logs");
  return { success: true };
}
