import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, Megaphone, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent, appendSupportTicket, formatPlatformTimestamp } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, type BadgeTone } from "@/lib/utils";

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

function levelTone(level: IncidentLevel): BadgeTone {
  if (level === "Critical") return "destructive";
  if (level === "Major") return "warning";
  return "default";
}

export const Route = createFileRoute("/status-center")({
  head: () => ({ meta: [{ title: "Status Center - SRMS" }] }),
  component: StatusCenterPage,
});

function StatusCenterPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("incidents");
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
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
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
            <Button variant="outlined" component={Link} to="/platform-ops">Open platform ops</Button>
            <Button variant="contained" startIcon={<Megaphone size={16} />} onClick={broadcastUpdate}>
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
            onChange={(e) => toggleStatusPage(e.target.checked)}
          />
        </div>
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="incidents" label="Incidents" />
        <Tab value="maintenance" label="Maintenance" />
        <Tab value="audiences" label="Audience targeting" />
      </Tabs>

      {tab === "incidents" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Incident</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Level</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell className="text-right">Advance</TableCell>
              </TableRow>
            </TableHead>
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
                  <TableCell><Chip size="small" label={incident.level} sx={badgeSx(levelTone(incident.level))} /></TableCell>
                  <TableCell>{incident.state}</TableCell>
                  <TableCell>{incident.updatedAt}</TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" disabled={incident.state === "Resolved"} onClick={() => advanceIncident(incident.id)}>
                      {incident.state === "Investigating" ? "Monitor" : incident.state === "Monitoring" ? "Resolve" : "Resolved"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "maintenance" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          {maintenance.map((window) => (
            <div key={window.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{window.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{window.window}</p>
                </div>
                <Chip
                  size="small"
                  label={window.published ? "Published" : "Draft"}
                  sx={badgeSx(window.published ? "success" : "secondary")}
                />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Audience: {window.audience}</p>
              <div className="mt-4 flex gap-2">
                <Button size="small" variant="outlined" onClick={() => toggleMaintenance(window.id)}>
                  {window.published ? "Unpublish" : "Publish"}
                </Button>
                <Button size="small" variant="contained" component={Link} to="/support-desk">Coordinate support</Button>
              </div>
            </div>
          ))}
        </Box>
      )}

      {tab === "audiences" && (
        <Box className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "All schools", note: "Use for broad outages and maintenance affecting every tenant." },
            { label: "District tenants", note: "Use for analytics rollups, district exports, and oversight modules." },
            { label: "Finance admins", note: "Use for billing, statements, fee channels, and subscription updates." },
          ].map((audience) => (
            <div key={audience.label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="font-semibold">{audience.label}</p>
              <p className="mt-2 text-sm text-muted-foreground">{audience.note}</p>
              <Button sx={{ mt: 2, width: "100%" }} variant="outlined" onClick={() => loadAudience(audience.label)}>
                Load segment
              </Button>
            </div>
          ))}
        </Box>
      )}
    </div>
  );
}
