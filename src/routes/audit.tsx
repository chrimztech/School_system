import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Activity, AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log — SRMS" }] }),
  component: AuditPage,
});

type Severity = "info" | "warning" | "success";

const sevIcon = (s: Severity) => s === "warning" ? <AlertCircle className="h-4 w-4 text-warning-foreground" /> : s === "success" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Activity className="h-4 w-4 text-muted-foreground" />;

function AuditPage() {
  const { isSystemAdmin } = useAuth();
  const { active } = useTenant();
  const [q, setQ] = useState("");

  const { data: log = [], isLoading } = useQuery({
    queryKey: ["audit", active.id],
    queryFn: () => api.audit.list(active.id),
  });

  const events = log as any[];
  const filtered = events.filter((e) => `${e.actor} ${e.action} ${e.target}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Every meaningful action is recorded for 7 years (MoE requirement)"
        actions={isSystemAdmin ? (
          <Button variant="outline" asChild>
            <Link to="/platform-audit">Open platform audit</Link>
          </Button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events today" value={events.length} accent="primary" icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Successes" value={events.filter((e) => e.severity === "success").length} accent="success" />
        <StatCard label="Warnings" value={events.filter((e) => e.severity === "warning").length} accent="warning" />
        <StatCard label="Reports archived" value="—" hint="Not tracked" accent="accent" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold">Activity stream</h2>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor or action" className="pl-9" />
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading audit log…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {events.length === 0 ? "No audit events recorded yet." : "No events match your search."}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((e: any) => (
              <li key={e.id} className="flex items-start gap-3 p-4">
                <div className="mt-0.5">{sevIcon(e.severity as Severity)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{e.actor}</span>
                    <span className="text-muted-foreground"> · {e.action}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.target}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-[10px] uppercase">{e.role}</Badge>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {e.createdAt ? new Date(e.createdAt).toLocaleString() : e.ts}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
