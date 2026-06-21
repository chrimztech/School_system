import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Clock3, Megaphone, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent, appendSupportTicket, formatPlatformTimestamp } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

type IncidentLevel = "Minor" | "Major" | "Critical";
type IncidentState = "Monitoring" | "Investigating" | "Resolved";

type StatusIncident = {
  id: string;
  title: string;
  level: IncidentLevel;
  state: IncidentState;
  audience: string;
  updatedAt: string;
};

type MaintenanceWindow = {
  id: string;
  title: string;
  window: string;
  audience: string;
  published: boolean;
};

function levelTone(level: IncidentLevel) {
  if (level === "Critical") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (level === "Major") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
}

export const Route = createFileRoute("/status-center")({
  head: () => ({ meta: [{ title: "Status Center - SRMS" }] }),
  component: StatusCenterPage,
});

function StatusCenterPage() {
  const { user } = useAuth();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const incidents = (workspace?.statusIncidents ?? []) as StatusIncident[];
  const maintenance = (workspace?.maintenanceWindows ?? []) as MaintenanceWindow[];
  const statusPageEnabled = Boolean(workspace?.statusSettings?.statusPageEnabled ?? true);

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

  const stats = useMemo(() => ({
    openIncidents: incidents.filter((incident) => incident.state !== "Resolved").length,
    publishedMaintenance: maintenance.filter((window) => window.published).length,
    publicStatus: statusPageEnabled ? "Live" : "Hidden",
  }), [incidents, maintenance, statusPageEnabled]);

  const advanceIncident = (incidentId: string) => {
    const incident = incidents.find((entry) => entry.id === incidentId);
    if (!incident) return;
    let nextState: IncidentState = incident.state;
    const nextIncidents = incidents.map((incident) => {
      if (incident.id !== incidentId) return incident;
      const state: IncidentState =
        incident.state === "Investigating" ? "Monitoring" :
          incident.state === "Monitoring" ? "Resolved" :
            "Resolved";
      nextState = state;
      return { ...incident, state, updatedAt: formatPlatformTimestamp() };
    });
    saveWorkspace.mutate({
      statusIncidents: nextIncidents,
      ...(nextState !== "Resolved"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: incident.id,
            tenantName: incident.audience,
            subject: `Coordinate public comms for ${incident.title}`,
            category: "Incident",
            priority: incident.level === "Critical" ? "Critical" : incident.level === "Major" ? "High" : "Medium",
            owner: "Platform desk",
            article: "Platform incident playbook",
            slaHours: incident.level === "Critical" ? 2 : 6,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Support",
        severity: incident.level === "Critical" ? "Critical" : incident.level === "Major" ? "Warning" : "Info",
        action: `Moved incident ${incident.id} from ${incident.state} to ${nextState}`,
      }),
    });
    toast.success("Status incident updated");
  };

  const toggleMaintenance = (windowId: string) => {
    const window = maintenance.find((entry) => entry.id === windowId);
    if (!window) return;
    const nextMaintenance = maintenance.map((window) => (
      window.id === windowId ? { ...window, published: !window.published } : window
    ));
    saveWorkspace.mutate({
      maintenanceWindows: nextMaintenance,
      ...(!window.published
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: window.id,
            tenantName: window.audience,
            subject: `Coordinate support coverage for ${window.title}`,
            category: "Maintenance",
            priority: "Medium",
            owner: "Platform desk",
            article: "Platform incident playbook",
            slaHours: 12,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Support",
        action: `${window.published ? "Unpublished" : "Published"} maintenance notice ${window.id}`,
      }),
    });
    toast.success("Maintenance notice updated");
  };

  const broadcastUpdate = () => {
    saveWorkspace.mutate({
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "status-broadcast",
        tenantName: "Platform communications",
        subject: "Align support desk after platform status broadcast",
        category: "Communications",
        priority: "Medium",
        owner: "Platform desk",
        article: "Platform incident playbook",
        slaHours: 6,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Support",
        action: "Broadcast platform status update to tenant audience",
      }),
    });
    toast.success("Status update broadcast queued");
  };

  const toggleStatusPage = (value: boolean) => {
    saveWorkspace.mutate({
      statusSettings: {
        ...workspace?.statusSettings,
        statusPageEnabled: value,
      },
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Support",
        action: `${value ? "Enabled" : "Disabled"} public platform status page visibility`,
      }),
    });
  };

  const loadAudience = (label: string) => {
    saveWorkspace.mutate({
      statusSettings: {
        ...workspace?.statusSettings,
        lastAudienceSegment: label,
        lastAudienceLoadedAt: formatPlatformTimestamp(),
      },
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Support",
        action: `Loaded audience segment ${label} for platform communications`,
      }),
    });
    toast.success(`Audience segment ${label} loaded`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status Center"
        description="Manage incident communication, planned maintenance notices, and the platform-facing service status narrative."
        actions={(
          <>
            <Button variant="outline" asChild>
              <Link to="/platform-ops">Open platform ops</Link>
            </Button>
            <Button onClick={broadcastUpdate}>
              <Megaphone className="mr-2 h-4 w-4" />
              Broadcast update
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open incidents" value={stats.openIncidents} accent="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Published maintenance" value={stats.publishedMaintenance} accent="accent" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Public status page" value={stats.publicStatus} accent="primary" icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label="Comms cadence" value="—" hint="Not configured" accent="success" icon={<Clock3 className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Public status visibility</p>
            <p className="mt-1 text-sm text-muted-foreground">Toggle whether schools can view the shared platform status experience.</p>
          </div>
          <Switch
            checked={statusPageEnabled}
            onCheckedChange={toggleStatusPage}
          />
        </div>
      </div>

      <Tabs defaultValue="incidents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="audiences">Audience targeting</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Advance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{incident.title}</p>
                      <p className="text-xs text-muted-foreground">{incident.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{incident.audience}</TableCell>
                  <TableCell><Badge className={levelTone(incident.level)}>{incident.level}</Badge></TableCell>
                  <TableCell>{incident.state}</TableCell>
                  <TableCell>{incident.updatedAt}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={incident.state === "Resolved"} onClick={() => advanceIncident(incident.id)}>
                      {incident.state === "Investigating" ? "Monitor" : incident.state === "Monitoring" ? "Resolve" : "Resolved"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="maintenance" className="grid gap-4 lg:grid-cols-2">
          {maintenance.map((window) => (
            <div key={window.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{window.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{window.window}</p>
                </div>
                <Badge className={window.published ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                  {window.published ? "Published" : "Draft"}
                </Badge>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Audience: {window.audience}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleMaintenance(window.id)}>
                  {window.published ? "Unpublish" : "Publish"}
                </Button>
                <Button size="sm" asChild>
                  <Link to="/support-desk">Coordinate support</Link>
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="audiences" className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "All schools", note: "Use for broad outages and maintenance affecting every tenant." },
            { label: "District tenants", note: "Use for analytics rollups, district exports, and oversight modules." },
            { label: "Finance admins", note: "Use for billing, statements, fee channels, and subscription updates." },
          ].map((audience) => (
            <div key={audience.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="font-semibold">{audience.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{audience.note}</p>
              <Button className="mt-4 w-full" variant="outline" onClick={() => loadAudience(audience.label)}>
                Load segment
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
