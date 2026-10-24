"use client";

import { useState, useTransition } from "react";
import { Share2, X } from "lucide-react";
import { toast } from "sonner";
import { shareDocument } from "@/actions/shares";
import { Button } from "@/components/ui/button";

type Recipient = { id: string; name: string; email: string; role: string };

export function ShareModal({
  documentId,
  recipients
}: {
  documentId: string;
  recipients: Recipient[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(data: FormData) {
    data.set("documentId", documentId);
    const expiry = data.get("expiresAt");
    if (typeof expiry === "string" && expiry) {
      const date = new Date(expiry);
      if (Number.isFinite(date.getTime())) data.set("expiresAt", date.toISOString());
    }
    startTransition(async () => {
      const result = await shareDocument(data);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Access granted.");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button size="small" variant="secondary" onClick={() => setOpen(true)}><Share2 size={14} /> Share</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) setOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`share-title-${documentId}`} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><h2 id={`share-title-${documentId}`} className="text-lg font-bold text-ink">Share document</h2><p className="mt-1 text-sm text-muted">Grant access to a registered organization member.</p></div>
              <button onClick={() => setOpen(false)} disabled={pending} aria-label="Close sharing dialog" className="rounded-lg p-1.5 text-muted hover:bg-canvas"><X size={18} /></button>
            </div>
            {recipients.length === 0 ? <p className="mt-5 rounded-lg bg-canvas p-4 text-sm text-muted">There are no other members in this organization yet.</p> : (
              <form action={submit} className="mt-5 space-y-4">
                <label className="block space-y-1.5 text-sm font-medium text-ink">Recipient
                  <select name="targetUserId" required defaultValue="" className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand">
                    <option value="" disabled>Choose a member</option>
                    {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} ({recipient.role}) — {recipient.email}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-ink">Expires at (optional)
                  <input name="expiresAt" type="datetime-local" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-brand" />
                </label>
                <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button><Button disabled={pending}>{pending ? "Saving..." : "Grant access"}</Button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
