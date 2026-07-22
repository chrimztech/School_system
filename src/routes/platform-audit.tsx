import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, FileText, Search, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, InputAdornment, TextField, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, downloadCsv, type BadgeTone } from "@/lib/utils";

type AuditSeverity = "Info" | "Warning" | "Critical";
type AuditEvent = {
  id: string;
  ts: string;
  actor: string;
  tenant: string;
  area: "Access" | "Billing" | "Lifecycle" | "Support" | "Operations";
  action: string;
  severity: AuditSeverity;
  reviewed: boolean;
};

function severityTone(severity: AuditSeverity): BadgeTone {
  if (severity === "Info") return "default";
  if (severity === "Warning") return "warning";
  return "destructive";
}

export const Route = createFileRoute("/platform-audit")({
  head: () => ({ meta: [{ title: "Platform Audit - SRMS" }] }),
  component: PlatformAuditPage,
});

function PlatformAuditPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const events = (workspace?.platformAuditEvents ?? []) as AuditEvent[];

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
      </div>
    );
  }

  const filtered = useMemo(() => events.filter((event) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [event.actor, event.tenant, event.area, event.action, event.id].some((value) => value.toLowerCase().includes(q));
  }), [events, query]);

  const acknowledge = (id: string) => {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    const nextEvents = events.map((event) => (event.id === id ? { ...event, reviewed: true } : event));
    saveWorkspace.mutate({
      ...(event.severity === "Critical"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: event.id,
            tenantName: event.tenant,
            subject: `Post-incident follow-up for ${event.id}`,
            category: "Operations",
            priority: "High",
            owner: "Platform desk",
            article: "Incident response runbook",
          }),
        }
        : {}),
      ...(event.area === "Access"
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Access",
            requester: user?.name ?? "System Administrator",
            school: event.tenant,
            summary: `Review privileged access controls after ${event.id}`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(
        { ...workspace, platformAuditEvents: nextEvents as any },
        {
          actor: user?.name ?? "System Administrator",
          tenant: event.tenant,
          area: "Operations",
          action: `Reviewed audit event ${event.id}`,
          reviewed: true,
        },
      ),
    });
    toast.success("Audit event acknowledged");
  };

  const exportEvidence = () => {
    const pendingCritical = events.filter((event) => event.severity === "Critical" && !event.reviewed).length;
    saveWorkspace.mutate({
      exportJobs: appendExportJob(workspace, {
        school: "Platform",
        scope: "Platform audit evidence pack",
        requestedBy: user?.name ?? "System Administrator",
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-audit",
        tenantName: "Platform audit",
        subject: "Prepare platform audit evidence package",
        category: "Operations",
        priority: pendingCritical > 0 ? "High" : "Medium",
        owner: "Compliance desk",
        article: "Security and availability schedule",
      }),
      ...(pendingCritical > 0
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Operations",
            requester: user?.name ?? "System Administrator",
            school: "Platform",
            summary: `Review ${pendingCritical} critical audit event(s) before evidence release`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Queued platform audit evidence export",
      }),
    });
    downloadCsv(events.map((event) => ({ ID: event.id, Time: event.ts, Actor: event.actor, Tenant: event.tenant, Area: event.area, Action: event.action, Severity: event.severity, Reviewed: event.reviewed ? "Yes" : "No" })), "platform-audit-export");
    toast.success("Audit export queued");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Audit"
        description="Review cross-tenant administrative actions, commercial mutations, operational events, and privileged changes."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/audit">School audit log</Button>
            <Button onClick={exportEvidence} startIcon={<FileText className="h-4 w-4" />}>
              Export evidence
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Events in scope" value={events.length} accent="primary" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Privileged access" value={events.filter((event) => event.area === "Access").length} accent="success" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Billing mutations" value={events.filter((event) => event.area === "Billing").length} accent="warning" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Critical events" value={events.filter((event) => event.severity === "Critical").length} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="relative">
          <TextField
            fullWidth
            size="small"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actor, tenant, area, action, or event id"
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
          />
        </div>
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="all" label="All events" />
        <Tab value="access" label="Privileged access" />
        <Tab value="commercial" label="Commercial & lifecycle" />
      </Tabs>

      {tab === "all" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Event</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Area</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{event.action}</p>
                      <p className="text-xs text-muted-foreground">{event.id} · {event.actor}</p>
                    </div>
                  </TableCell>
                  <TableCell>{event.tenant}</TableCell>
                  <TableCell>{event.area}</TableCell>
                  <TableCell><Chip size="small" label={event.severity} sx={badgeSx(severityTone(event.severity))} /></TableCell>
                  <TableCell>{event.ts}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={event.reviewed ? "Reviewed" : "Pending review"}
                      sx={badgeSx(event.reviewed ? "success" : "warning")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" disabled={event.reviewed} onClick={() => acknowledge(event.id)}>
                      {event.reviewed ? "Reviewed" : "Acknowledge"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "access" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          {filtered.filter((event) => event.area === "Access" || event.area === "Operations").map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{event.action}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.actor}</p>
                </div>
                <Chip size="small" label={event.severity} sx={badgeSx(severityTone(event.severity))} />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Tenant</span><span>{event.tenant}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Area</span><span>{event.area}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Time</span><span>{event.ts}</span></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="small" variant="outlined" onClick={() => acknowledge(event.id)}>Mark reviewed</Button>
                <Button size="small" component={Link} to="/security">Open security</Button>
              </div>
            </div>
          ))}
        </Box>
      )}

      {tab === "commercial" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          {filtered.filter((event) => event.area === "Billing" || event.area === "Lifecycle" || event.area === "Support").map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{event.tenant}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.action}</p>
                </div>
                <Chip size="small" label={event.area} sx={badgeSx(severityTone(event.severity))} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{event.actor} · {event.ts}</p>
              <div className="mt-4 flex gap-2">
                <Button size="small" variant="outlined" onClick={() => acknowledge(event.id)}>Review</Button>
                <Button size="small" component={Link} to={event.area === "Billing" ? "/billing" : event.area === "Lifecycle" ? "/tenant-lifecycle" : "/support-desk"}>Open workflow</Button>
              </div>
            </div>
          ))}
        </Box>
      )}
    </div>
  );
}
