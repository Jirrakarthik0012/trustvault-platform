import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ShareManager } from "@/components/share-manager";

export const metadata: Metadata = { title: "Sharing" };

export default async function SharePage({
  searchParams
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { documentId } = await searchParams;
  const user = await getCurrentUser();
  if (!user || user.role === "VIEWER") redirect("/");
  const isManager = user.role === "ADMIN" || user.role === "MANAGER";
  const documentScope = {
    organizationId: user.organizationId,
    ...(isManager ? {} : { ownerId: user.id })
  };
  const [documents, users, shares] = await Promise.all([
    prisma.document.findMany({
      where: documentScope,
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId, id: { not: user.id } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" }
    }),
    prisma.documentShare.findMany({
      where: { document: documentScope },
      include: {
        document: { select: { name: true } },
        user: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">Access control</p><h1 className="text-3xl font-bold tracking-tight text-ink">Sharing</h1><p className="mt-2 text-sm text-muted">Grant access to a specific registered member, set an expiry, and revoke instantly.</p></div>
      <ShareManager documents={documents} users={users} shares={shares} selectedDocumentId={documentId} />
    </div>
  );
}
