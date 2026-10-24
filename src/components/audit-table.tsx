import type { AuditAction, AuditStatus } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type AuditItem = {
  id: string;
  action: AuditAction;
  status: AuditStatus;
  ipAddress: string;
  details: string | null;
  createdAt: Date;
  user: { name: string; email: string } | null;
  document: { name: string } | null;
};

export function AuditTable({ entries }: { entries: AuditItem[] }) {
  if (!entries.length) return <Card className="p-8 text-center text-sm text-muted">No audit events have been recorded yet.</Card>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Event</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Document</th><th className="px-5 py-3">IP address</th><th className="px-5 py-3">Time</th><th className="px-5 py-3">Result</th></tr></thead>
          <tbody className="divide-y divide-line">
            {entries.map((entry) => <tr key={entry.id}>
              <td className="px-5 py-4"><span className="font-semibold text-ink">{entry.action.replaceAll("_", " ")}</span>{entry.details && <span className="mt-1 block max-w-[240px] truncate text-xs text-muted" title={entry.details}>{entry.details}</span>}</td>
              <td className="px-5 py-4">{entry.user ? <><span className="block text-ink">{entry.user.name}</span><span className="text-xs text-muted">{entry.user.email}</span></> : <span className="text-muted">Unknown user</span>}</td>
              <td className="px-5 py-4 text-muted">{entry.document?.name ?? "—"}</td>
              <td className="px-5 py-4 font-mono text-xs text-muted">{entry.ipAddress}</td>
              <td className="px-5 py-4 whitespace-nowrap text-muted">{formatDate(entry.createdAt)}</td>
              <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.status === "SUCCESS" ? "bg-mint text-brand" : "bg-rose-50 text-rose-700"}`}>{entry.status}</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">Showing the most recent {entries.length} events. Entries are append-only from the application.</p>
    </Card>
  );
}
