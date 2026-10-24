import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getCurrentUser } from "@/lib/auth-guard";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">{children}</div>
      </main>
    </div>
  );
}
