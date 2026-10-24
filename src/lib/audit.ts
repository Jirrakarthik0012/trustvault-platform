import type { AuditAction, AuditStatus } from "@prisma/client";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getRequestIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const candidate = (
    requestHeaders.get("x-real-ip") ??
    forwardedFor?.split(",")[0]?.trim() ??
    "unknown"
  ).slice(0, 64);
  return isIP(candidate) ? candidate : "unknown";
}

export async function writeAudit(input: {
  organizationId: string;
  userId?: string | null;
  documentId?: string | null;
  action: AuditAction;
  status: AuditStatus;
  details?: string;
  ipAddress?: string;
}) {
  return prisma.auditLog.create({
    data: {
      ...input,
      ipAddress: input.ipAddress ?? (await getRequestIp())
    }
  });
}
