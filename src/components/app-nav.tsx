import Link from "next/link";
import {
  Activity,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Settings,
  Share2
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";

const navigation = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/share", label: "Sharing", icon: Share2 },
  { href: "/audit-logs", label: "Audit trail", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings }
];

export async function AppNav() {
  const user = await getCurrentUser();
  if (!user) return null;
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true }
  });

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-white px-5 py-6 lg:flex">
        <Link href="/" className="mb-9 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">
            <LockKeyhole size={21} />
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight text-ink">TrustVault</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">Secure document access</span>
          </span>
        </Link>
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</div>
        <nav className="space-y-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-mint hover:text-brand"
            >
              <Icon size={17} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-canvas p-4">
          <p className="truncate text-sm font-semibold text-ink">{organization?.name ?? "Organization"}</p>
          <p className="mt-1 text-xs text-muted">{user.role.toLowerCase()} workspace</p>
          <div className="mt-4 border-t border-line pt-3">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="font-bold tracking-tight text-ink">TrustVault</Link>
        <nav className="flex items-center gap-1">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} title={label} className="rounded-lg p-2 text-muted hover:bg-mint hover:text-brand">
              <Icon size={18} />
            </Link>
          ))}
          <SignOutButton compact />
        </nav>
      </header>
    </>
  );
}
