import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, History, ShieldCheck, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [documentCount, activeShares, eventCount, recent] = await Promise.all([
    prisma.document.count({ where: { organizationId: user.organizationId } }),
    prisma.documentShare.count({
      where: {
        document: { organizationId: user.organizationId },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    }),
    prisma.auditLog.count({ where: { organizationId: user.organizationId } }),
    prisma.auditLog.findMany({
      where: { organizationId: user.organizationId },
      include: { user: { select: { name: true } }, document: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);
  const metrics = [
    { label: "Documents in vault", value: documentCount, icon: FileText, color: "bg-mint text-brand" },
    { label: "Active access grants", value: activeShares, icon: Users, color: "bg-amber/20 text-amber-600" },
    { label: "Audit events", value: eventCount, icon: History, color: "bg-sky-100 text-sky-700" }
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-ink px-6 py-8 text-white sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100"><ShieldCheck size={14} /> Your organization, protected</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {user.name.split(" ")[0]}.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">Secure sharing, Smarter Access, Verifiable Accountability. Keep every document and access decision in one trusted place.</p>
          <Link href="/documents" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint">Open document vault <ArrowRight size={16} /></Link>
        </div>
        <div className="absolute -right-8 -top-20 h-72 w-72 rounded-full border-[45px] border-white/5" />
        <div className="absolute -bottom-36 right-36 h-64 w-64 rounded-full border-[35px] border-emerald-300/10" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="flex items-center justify-between">
            <div><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-ink">{value}</p></div>
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${color}`}><Icon size={20} /></span>
          </CardContent></Card>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-ink">Recent activity</h2><p className="mt-1 text-sm text-muted">A live record of document access and sharing.</p></div>
          <Link href="/audit-logs" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">View audit trail <ArrowRight size={14} /></Link>
        </div>
        <Card className="divide-y divide-line">
          {recent.length === 0 ? <p className="p-6 text-sm text-muted">Your audit history will appear here.</p> : recent.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{event.action.replaceAll("_", " ")}{event.document ? ` · ${event.document.name}` : ""}</p>
                <p className="mt-1 text-xs text-muted">{event.user?.name ?? "Unknown user"} · {event.status.toLowerCase()}</p>
              </div>
              <time className="shrink-0 text-xs text-muted">{formatDate(event.createdAt)}</time>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
