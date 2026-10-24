"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { changeMemberRole, createMember } from "@/actions/members";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Member = { id: string; name: string; email: string; role: "ADMIN" | "MANAGER" | "VIEWER" };

export function TeamManagement({ members }: { members: Member[] }) {
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    startTransition(async () => {
      const result = await createMember(formData);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Member created. Share their organization slug and initial password securely.");
        (document.getElementById("member-form") as HTMLFormElement | null)?.reset();
      }
    });
  }

  function change(userId: string, role: string) {
    const data = new FormData();
    data.set("userId", userId);
    data.set("role", role);
    startTransition(async () => {
      const result = await changeMemberRole(data);
      if ("error" in result) toast.error(result.error);
      else toast.success("Member role updated.");
    });
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-4">
          <h2 className="font-semibold text-ink">Organization members</h2>
          <p className="mt-1 text-sm text-muted">Create member accounts and manage role permissions. Deliver initial passwords out-of-band.</p>
        </div>
        <form id="member-form" action={add} className="grid gap-3 rounded-xl bg-canvas p-4 md:grid-cols-2">
          <Input name="name" required minLength={2} maxLength={80} placeholder="Full name" aria-label="Member name" />
          <Input name="email" type="email" required maxLength={254} placeholder="Work email" aria-label="Member email" />
          <Input name="password" type="password" required minLength={12} maxLength={128} placeholder="Initial password (12+ characters)" aria-label="Initial password" />
          <div className="flex gap-2">
            <select name="role" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink" defaultValue="VIEWER" aria-label="New member role">
              <option value="VIEWER">Viewer</option><option value="MANAGER">Manager</option>
            </select>
            <Button disabled={pending}>{pending ? "Saving..." : "Add member"}</Button>
          </div>
        </form>
        <div className="mt-5 divide-y divide-line">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
              <div><p className="text-sm font-semibold text-ink">{member.name}</p><p className="text-xs text-muted">{member.email}</p></div>
              <select
                value={member.role}
                onChange={(event) => change(member.id, event.target.value)}
                disabled={pending}
                aria-label={`Role for ${member.name}`}
                className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink"
              >
                <option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="VIEWER">Viewer</option>
              </select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
