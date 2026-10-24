import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { AuditTable } from "@/components/audit-table";

export const metadata: Metadata = { title: "Audit trail" };

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user || user.role === "VIEWER") redirect("/");
  const entries = await prisma.auditLog.findMany({
    where: { organizationId: user.organizationId },
    include: {
      user: { select: { name: true, email: true } },
      document: { select: { name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">Verifiable accountability</p><h1 className="text-3xl font-bold tracking-tight text-ink">Audit trail</h1><p className="mt-2 text-sm text-muted">Recent uploads, views, shares, revocations, and denied access attempts.</p></div>
      <AuditTable entries={entries} />
    </div>
  );
}
