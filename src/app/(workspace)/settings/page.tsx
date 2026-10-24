import type { Metadata } from "next";
import { Building2, KeyRound, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { TeamManagement } from "@/components/team-management";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [organization, members] = await Promise.all([prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true, slug: true, createdAt: true }
  }), prisma.user.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" }
  })]);
  return (
    <div className="space-y-6">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">Workspace profile</p><h1 className="text-3xl font-bold tracking-tight text-ink">Settings</h1><p className="mt-2 text-sm text-muted">Your account and organization access details.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardContent>
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-brand"><Building2 size={19} /></span><div><h2 className="font-semibold text-ink">Organization</h2><p className="text-xs text-muted">Use the workspace slug when signing in.</p></div></div>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-xs font-medium text-muted">Workspace name</dt><dd className="mt-1 font-semibold text-ink">{organization?.name}</dd></div>
            <div><dt className="text-xs font-medium text-muted">Organization slug</dt><dd className="mt-1 select-all rounded-md bg-canvas px-3 py-2 font-mono text-xs text-ink">{organization?.slug}</dd></div>
            <div><dt className="text-xs font-medium text-muted">Created</dt><dd className="mt-1 text-ink">{organization?.createdAt.toLocaleDateString()}</dd></div>
          </dl>
        </CardContent></Card>
        <Card><CardContent>
          <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><KeyRound size={19} /></span><div><h2 className="font-semibold text-ink">Your account</h2><p className="text-xs text-muted">Authenticated organization-scoped identity.</p></div></div>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-xs font-medium text-muted">Name</dt><dd className="mt-1 font-semibold text-ink">{user.name}</dd></div>
            <div><dt className="text-xs font-medium text-muted">Email</dt><dd className="mt-1 text-ink">{user.email}</dd></div>
            <div><dt className="text-xs font-medium text-muted">Role</dt><dd className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-brand"><ShieldCheck size={13} />{user.role}</dd></div>
          </dl>
        </CardContent></Card>
      </div>
      <Card><CardContent>
        <h2 className="font-semibold text-ink">Role permissions</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl bg-canvas p-4"><p className="font-semibold text-ink">ADMIN</p><p className="mt-1 text-xs leading-5 text-muted">Full organization access, document upload, and sharing administration.</p></div>
          <div className="rounded-xl bg-canvas p-4"><p className="font-semibold text-ink">MANAGER</p><p className="mt-1 text-xs leading-5 text-muted">Manage all organization documents and their access grants.</p></div>
          <div className="rounded-xl bg-canvas p-4"><p className="font-semibold text-ink">VIEWER</p><p className="mt-1 text-xs leading-5 text-muted">View owned or explicitly shared documents; cannot upload or share.</p></div>
        </div>
      </CardContent></Card>
      {user.role === "ADMIN" && <TeamManagement members={members} />}
    </div>
  );
}
