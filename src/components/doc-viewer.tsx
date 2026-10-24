"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { toast } from "sonner";
import { createViewerLink } from "@/actions/documents";
import { Button } from "@/components/ui/button";

export function DocViewer({ documentId, documentName }: { documentId: string; documentName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState("");

  function open() {
    startTransition(async () => {
      const result = await createViewerLink(documentId);
      if ("error" in result) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      setUrl(result.url);
    });
  }

  return (
    <>
      <Button size="small" variant="secondary" onClick={open} disabled={pending}>
        <Eye size={14} /> {pending ? "Checking..." : "View"}
      </Button>
      {url && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/70 p-3 sm:p-8" role="presentation">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-t-xl bg-white px-4 py-3">
            <p className="truncate pr-4 text-sm font-semibold text-ink">{documentName}</p>
            <button onClick={() => setUrl("")} className="rounded-lg p-2 text-muted hover:bg-canvas" aria-label="Close viewer"><X size={19} /></button>
          </div>
          <iframe
            title={`Secure preview: ${documentName}`}
            src={url}
            className="mx-auto min-h-0 w-full max-w-6xl flex-1 rounded-b-xl bg-white"
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </>
  );
}
