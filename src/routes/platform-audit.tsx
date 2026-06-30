import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, FileText, Search, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { downloadCsv } from "@/lib/utils";

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

function severityTone(severity: AuditSeverity) {
  if (severity === "Info") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (severity === "Warning") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
}

export const Route = createFileRoute("/platform-audit")({
  head: () => ({ meta: [{ title: "Platform Audit - SRMS" }] }),
  component: PlatformAuditPage,
});

function PlatformAuditPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const events = (workspace?.platformAuditEvents ?? []) as AuditEvent[];

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
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
            <Button variant="outline" asChild>
              <Link to="/audit">School audit log</Link>
            </Button>
            <Button onClick={exportEvidence}>
              <FileText className="mr-2 h-4 w-4" />
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, tenant, area, action, or event id" />
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All events</TabsTrigger>
          <TabsTrigger value="access">Privileged access</TabsTrigger>
          <TabsTrigger value="commercial">Commercial & lifecycle</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                  <TableCell><Badge className={severityTone(event.severity)}>{event.severity}</Badge></TableCell>
                  <TableCell>{event.ts}</TableCell>
                  <TableCell>
                    <Badge className={event.reviewed ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}>
                      {event.reviewed ? "Reviewed" : "Pending review"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={event.reviewed} onClick={() => acknowledge(event.id)}>
                      {event.reviewed ? "Reviewed" : "Acknowledge"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="access" className="grid gap-4 lg:grid-cols-2">
          {filtered.filter((event) => event.area === "Access" || event.area === "Operations").map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{event.action}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.actor}</p>
                </div>
                <Badge className={severityTone(event.severity)}>{event.severity}</Badge>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Tenant</span><span>{event.tenant}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Area</span><span>{event.area}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Time</span><span>{event.ts}</span></div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => acknowledge(event.id)}>Mark reviewed</Button>
                <Button size="sm" asChild><Link to="/security">Open security</Link></Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="commercial" className="grid gap-4 lg:grid-cols-2">
          {filtered.filter((event) => event.area === "Billing" || event.area === "Lifecycle" || event.area === "Support").map((event) => (
            <div key={event.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{event.tenant}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.action}</p>
                </div>
                <Badge className={severityTone(event.severity)}>{event.area}</Badge>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{event.actor} · {event.ts}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => acknowledge(event.id)}>Review</Button>
                <Button size="sm" asChild><Link to={event.area === "Billing" ? "/billing" : event.area === "Lifecycle" ? "/tenant-lifecycle" : "/support-desk"}>Open workflow</Link></Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
