"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">We couldn&apos;t load this page.</h1>
        <p className="mt-2 text-sm text-muted">Your documents remain protected. Try again, or contact your workspace administrator.</p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
