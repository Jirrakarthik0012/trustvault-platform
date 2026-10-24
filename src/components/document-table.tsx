import { FileText } from "lucide-react";
import type { getTenantDocuments } from "@/actions/documents";
import { formatBytes, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DocViewer } from "@/components/doc-viewer";
import { ShareModal } from "@/components/share-modal";

type Documents = Awaited<ReturnType<typeof getTenantDocuments>>;
type Recipient = { id: string; name: string; email: string; role: string };

export function DocumentTable({
  documents,
  recipients,
  currentUserId,
  currentUserRole
}: {
  documents: Documents;
  recipients: Recipient[];
  currentUserId: string;
  currentUserRole: string;
}) {
  if (!documents.length) {
    return (
      <Card>
        <CardContent className="grid justify-items-center py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-mint text-brand"><FileText size={25} /></span>
          <h2 className="mt-4 font-semibold text-ink">Your vault is ready</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">Upload a document to start sharing it securely with your organization.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-3 font-semibold">Document</th><th className="px-5 py-3 font-semibold">Owner</th><th className="px-5 py-3 font-semibold">Size</th><th className="px-5 py-3 font-semibold">Added</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {documents.map((document) => (
              <tr key={document.id} className="hover:bg-canvas/70">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-mint text-brand"><FileText size={17} /></span>
                    <div className="min-w-0"><p className="max-w-[240px] truncate font-semibold text-ink">{document.name}</p><p className="text-xs text-muted">{document.mimeType}</p></div>
                  </div>
                </td>
                <td className="px-5 py-4 text-muted">{document.owner.name}</td>
                <td className="px-5 py-4 text-muted">{formatBytes(document.size)}</td>
                <td className="px-5 py-4 text-muted">{formatDate(document.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <DocViewer documentId={document.id} documentName={document.name} />
                    {(currentUserRole !== "VIEWER" && (currentUserRole === "ADMIN" || currentUserRole === "MANAGER" || document.ownerId === currentUserId)) && <ShareModal documentId={document.id} recipients={recipients} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
