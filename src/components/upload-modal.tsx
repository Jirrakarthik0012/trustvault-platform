"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import {
  discardUnregisteredUpload,
  registerUploadedDocument,
  uploadDocument
} from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UploadModal({
  organizationId,
  useDirectUpload
}: {
  organizationId: string;
  useDirectUpload: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      let storageKey: string | undefined;
      try {
        const file = formData.get("file");
        if (useDirectUpload) {
          if (!(file instanceof File)) {
            toast.error("Choose a file to upload.");
            return;
          }
          const blob = await upload(
            `trustvault/${organizationId}/${crypto.randomUUID()}`,
            file,
            {
              access: "private",
              contentType: file.type,
              handleUploadUrl: "/api/documents/upload"
            }
          );
          storageKey = blob.pathname;
          const metadata = new FormData();
          metadata.set("storageKey", blob.pathname);
          metadata.set("name", file.name);
          metadata.set("mimeType", file.type);
          metadata.set("size", String(file.size));
          const result = await registerUploadedDocument(metadata);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
        } else {
          const result = await uploadDocument(formData);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
        }
        toast.success("Document uploaded securely.");
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } catch (error) {
        if (storageKey) {
          try {
            const cleanup = await discardUnregisteredUpload(storageKey);
            if ("error" in cleanup) console.error("TrustVault unfinished upload cleanup was rejected.");
          } catch (cleanupError) {
            console.error("TrustVault unfinished upload cleanup failed.", cleanupError);
          }
        }
        console.error("TrustVault upload failed.", error);
        toast.error("The file could not be uploaded securely. Please try again.");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}><FileUp size={16} /> Upload document</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pending) setOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="upload-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 id="upload-title" className="text-lg font-bold text-ink">Upload a document</h2>
                <p className="mt-1 text-sm text-muted">Stored privately and accessible only to approved users.</p>
              </div>
              <button onClick={() => setOpen(false)} disabled={pending} aria-label="Close upload dialog" className="rounded-lg p-1.5 text-muted hover:bg-canvas"><X size={18} /></button>
            </div>
            <form ref={formRef} action={submit} className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm font-medium text-ink">
                Choose file
                <Input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,application/pdf,image/jpeg,image/png,image/webp,text/plain" className="file:mr-3 file:rounded-md file:border-0 file:bg-mint file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand" />
              </label>
              <p className="text-xs text-muted">PDF, JPEG, PNG, WebP, or TXT. Maximum 10 MB.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button disabled={pending}>{pending ? "Uploading..." : "Upload securely"}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
