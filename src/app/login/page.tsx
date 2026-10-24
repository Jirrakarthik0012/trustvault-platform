import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand"><LockKeyhole size={21} /></span><span className="text-xl font-bold">TrustVault</span></Link>
        <div className="max-w-lg"><p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Built around trust</p><h1 className="text-5xl font-bold leading-tight tracking-tight">Your documents.<br />Your rules.</h1><p className="mt-5 max-w-md leading-7 text-white/65">Secure sharing, Smarter Access, Verifiable Accountability. Control every document with precise permissions and a dependable audit trail.</p></div>
        <p className="text-xs text-white/40">Private by design · Organization scoped</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 flex items-center justify-center gap-2 font-bold text-ink lg:hidden"><LockKeyhole className="text-brand" size={20} /> TrustVault</Link>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Sign in to your vault</h2>
          <p className="mb-7 mt-2 text-sm text-muted">Enter the organization slug and credentials for your workspace.</p>
          <AuthForm mode="login" />
          <p className="mt-8 text-center text-xs leading-5 text-muted">Access is isolated to the organization identified by your workspace slug.</p>
        </div>
      </section>
    </main>
  );
}
