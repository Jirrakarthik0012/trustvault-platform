"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { shareDocument, revokeShare } from "@/actions/shares";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DocumentOption = { id: string; name: string };
type UserOption = { id: string; name: string; email: string; role: string };
type ShareRecord = {
  id: string;
  documentId: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  document: { name: string };
  user: { name: string; email: string };
};

export function ShareManager({
  documents,
  users,
  shares,
  selectedDocumentId
}: {
  documents: DocumentOption[];
  users: UserOption[];
  shares: ShareRecord[];
  selectedDocumentId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const canRevoke = (share: ShareRecord) => !share.revokedAt;

  function submit(formData: FormData) {
    setError("");
    const expiry = formData.get("expiresAt");
    if (typeof expiry === "string" && expiry) {
      const date = new Date(expiry);
      if (Number.isFinite(date.getTime())) formData.set("expiresAt", date.toISOString());
    }
    startTransition(async () => {
      const result = await shareDocument(formData);
      if ("error" in result) {
        const message = result.error ?? "Unable to grant access.";
        setError(message);
        toast.error(message);
      } else {
        toast.success("Access granted.");
        (document.getElementById("share-form") as HTMLFormElement | null)?.reset();
      }
    });
  }

  function revoke(shareId: string) {
    const formData = new FormData();
    formData.set("shareId", shareId);
    startTransition(async () => {
      const result = await revokeShare(formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Access revoked immediately.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="mb-4">
            <h2 className="font-semibold text-ink">Grant document access</h2>
            <p className="mt-1 text-sm text-muted">Recipients must be registered members of your organization.</p>
          </div>
          {documents.length === 0 || users.length === 0 ? (
            <p className="rounded-lg bg-canvas p-4 text-sm text-muted">
              {documents.length === 0 ? "Upload a document before sharing." : "No other registered users are available in this organization."}
            </p>
          ) : (
            <form id="share-form" action={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="space-y-1.5 text-xs font-semibold text-muted">Document
                <select name="documentId" defaultValue={selectedDocumentId ?? ""} required className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand">
                  <option value="" disabled>Select document</option>
                  {documents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-muted">Registered user
                <select name="targetUserId" required defaultValue="" className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand">
                  <option value="" disabled>Select recipient</option>
                  {users.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-muted">Access expires (optional)
                <Input name="expiresAt" type="datetime-local" className="text-xs" />
              </label>
              <div className="flex items-end"><Button disabled={pending}>{pending ? "Saving..." : "Grant access"}</Button></div>
            </form>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-ink">Access grants</h2>
          <p className="mt-1 text-sm text-muted">Revoke a grant at any time; open viewer links are re-authorized on every request.</p>
        </div>
        {shares.length === 0 ? <p className="p-6 text-sm text-muted">No document access grants yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Document</th><th className="px-5 py-3">Recipient</th><th className="px-5 py-3">Expiration</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-line">
                {shares.map((share) => {
                  const expired = share.expiresAt && share.expiresAt <= new Date();
                  const status = share.revokedAt ? "Revoked" : expired ? "Expired" : "Active";
                  return <tr key={share.id}>
                    <td className="px-5 py-4 font-medium text-ink">{share.document.name}</td>
                    <td className="px-5 py-4"><span className="block text-ink">{share.user.name}</span><span className="text-xs text-muted">{share.user.email}</span></td>
                    <td className="px-5 py-4 text-muted">{share.expiresAt ? formatDate(share.expiresAt) : "No expiration"}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Active" ? "bg-mint text-brand" : "bg-slate-100 text-slate-500"}`}>{status}</span></td>
                    <td className="px-5 py-4 text-right">{canRevoke(share) && <Button size="small" variant="danger" disabled={pending} onClick={() => revoke(share.id)}>Revoke</Button>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
