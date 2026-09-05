import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Activity, AlertCircle, CheckCircle2, Download, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button, Chip, MenuItem, TextField, InputAdornment } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx, downloadCsv } from "@/lib/utils";

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
  const [severity, setSeverity] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: log = [], isLoading } = useQuery({
    queryKey: ["audit", active.id],
    queryFn: () => api.audit.list(active.id),
  });

  const events = log as any[];
  const filtered = useMemo(() => events.filter((e) => {
    if (!`${e.actor} ${e.action} ${e.target}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (severity !== "all" && e.severity !== severity) return false;
    const ts = e.createdAt ?? e.ts;
    if (fromDate && ts && ts.slice(0, 10) < fromDate) return false;
    if (toDate && ts && ts.slice(0, 10) > toDate) return false;
    return true;
  }), [events, q, severity, fromDate, toDate]);

  const exportCsv = () => {
    downloadCsv(filtered.map((e) => ({
      Timestamp: e.createdAt ? new Date(e.createdAt).toLocaleString() : e.ts,
      Actor: e.actor, Role: e.role, Action: e.action, Target: e.target, Severity: e.severity,
    })), `audit-log-${active.slug ?? active.id}-${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Every meaningful action is recorded for 7 years (MoE requirement)"
        actions={
          <>
            <Button variant="outlined" startIcon={<Download className="h-4 w-4" />} disabled={filtered.length === 0} onClick={exportCsv}>Export CSV</Button>
            {isSystemAdmin && <Button variant="outlined" component={Link} to="/platform-audit">Open platform audit</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events today" value={events.length} accent="primary" icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Successes" value={events.filter((e) => e.severity === "success").length} accent="success" />
        <StatCard label="Warnings" value={events.filter((e) => e.severity === "warning").length} accent="warning" />
        <StatCard label="Reports archived" value="—" hint="Not tracked" accent="accent" icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-sm font-semibold">Activity stream</h2>
          <div className="flex flex-wrap items-center gap-2">
            <TextField
              size="small"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search actor or action"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
            />
            <TextField select size="small" label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} sx={{ minWidth: 120 }}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="success">Success</MenuItem>
            </TextField>
            <TextField type="date" size="small" label="From" value={fromDate} onChange={(e) => setFromDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField type="date" size="small" label="To" value={toDate} onChange={(e) => setToDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
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
                  <Chip size="small" label={e.role} sx={{ ...badgeSx("outline"), fontSize: 10, textTransform: "uppercase" }} />
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
