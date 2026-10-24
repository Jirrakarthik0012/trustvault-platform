import type { Metadata } from "next";
import { FileText, ShieldCheck } from "lucide-react";
import { getTenantDocuments } from "@/actions/documents";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { DocumentTable } from "@/components/document-table";
import { UploadModal } from "@/components/upload-modal";
import { isVercelBlobStorage } from "@/lib/storage";

export const metadata: Metadata = { title: "Documents" };
export const maxDuration = 60;

export default async function DocumentsPage() {
  const [documents, user] = await Promise.all([getTenantDocuments(), getCurrentUser()]);
  const recipients = user
    ? await prisma.user.findMany({
        where: { organizationId: user.organizationId, id: { not: user.id } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" }
      })
    : [];
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand"><FileText size={14} /> Document vault</div><h1 className="text-3xl font-bold tracking-tight text-ink">Documents</h1><p className="mt-2 text-sm text-muted">Private files, precise access, and a complete audit trail.</p></div>
        {user && user.role !== "VIEWER" && (
          <UploadModal
            organizationId={user.organizationId}
            useDirectUpload={isVercelBlobStorage()}
          />
        )}
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-brand/15 bg-mint/60 px-4 py-3 text-xs leading-5 text-brand-dark"><ShieldCheck className="mt-0.5 shrink-0" size={15} /><p>Files are stored outside the public web directory. Viewing requires an authenticated, short-lived signed link and a fresh access check.</p></div>
      {user && <DocumentTable documents={documents} recipients={recipients} currentUserId={user.id} currentUserRole={user.role} />}
    </div>
  );
}
