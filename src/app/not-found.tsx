import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div><p className="text-sm font-semibold text-brand">404 · Not found</p><h1 className="mt-2 text-2xl font-bold text-ink">That page is not available.</h1><p className="mt-2 text-sm text-muted">The link may be incorrect or you may not have access.</p><Link href="/"><Button className="mt-6">Return to overview</Button></Link></div>
    </main>
  );
}
