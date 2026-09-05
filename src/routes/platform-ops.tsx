import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRightLeft, CheckCircle2, Clock3, HardDrive,
  Plus, Rocket, Server, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import {
  appendOpsIncident, appendPlatformAuditEvent, appendQueue, appendRelease, appendService, appendSupportTicket,
} from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, type BadgeTone } from "@/lib/utils";

type ServiceStatus = "healthy" | "degraded" | "maintenance";
type QueueStatus = "normal" | "warning" | "blocked";
type IncidentStatus = "Investigating" | "Monitoring" | "Mitigated";
type ReleaseStatus = "Awaiting approval" | "In validation" | "Approved" | "Scheduled";

type Service = {
  id: string;
  name: string;
  owner: string;
  uptime: number;
  region: string;
  dependency: string;
  status: ServiceStatus;
};

type Queue = {
  id: string;
  name: string;
  owner: string;
  backlog: number;
  lagMinutes: number;
  status: QueueStatus;
};

type Incident = {
  id: string;
  title: string;
  severity: "Low" | "Medium" | "High";
  tenant: string;
  commander: string;
  status: IncidentStatus;
};

type Release = {
  id: string;
  title: string;
  environment: "Sandbox" | "Staging" | "Production";
  owner: string;
  window: string;
  status: ReleaseStatus;
};

function toneForStatus(status: ServiceStatus | QueueStatus | IncidentStatus | ReleaseStatus): BadgeTone {
  if (status === "healthy" || status === "normal" || status === "Mitigated" || status === "Approved" || status === "Scheduled") {
    return "success";
  }
  if (status === "degraded" || status === "warning" || status === "Monitoring" || status === "In validation") {
    return "warning";
  }
  return "destructive";
}

export const Route = createFileRoute("/platform-ops")({
  head: () => ({ meta: [{ title: "Platform Ops - SRMS" }] }),
  component: PlatformOpsPage,
});

function PlatformOpsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("services");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const services = (workspace?.services ?? []) as Service[];
  const queues = (workspace?.queues ?? []) as Queue[];
  const incidents = (workspace?.opsIncidents ?? []) as Incident[];
  const releases = (workspace?.releases ?? []) as Release[];

  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: "", owner: "", region: "", dependency: "" });
  const [addQueueOpen, setAddQueueOpen] = useState(false);
  const [queueForm, setQueueForm] = useState({ name: "", owner: "", backlog: "", lagMinutes: "" });
  const [addIncidentOpen, setAddIncidentOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ title: "", severity: "Medium" as Incident["severity"], tenant: "", commander: "" });
  const [addReleaseOpen, setAddReleaseOpen] = useState(false);
  const [releaseForm, setReleaseForm] = useState({ title: "", environment: "Staging" as Release["environment"], owner: "", window: "" });

  const stats = useMemo(() => {
    const healthyServices = services.filter((service) => service.status === "healthy").length;
    const blockedQueues = queues.filter((queue) => queue.status === "blocked").length;
    const openIncidents = incidents.filter((incident) => incident.status !== "Mitigated").length;
    const pendingReleases = releases.filter((release) => release.status === "Awaiting approval" || release.status === "In validation").length;
    const uptime = services.length === 0 ? null : services.reduce((sum, service) => sum + service.uptime, 0) / services.length;

    return {
      healthyServices,
      blockedQueues,
      openIncidents,
      pendingReleases,
      uptime,
    };
  }, [incidents, queues, releases, services]);

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

  const runHealthSweep = () => {
    if (services.length === 0 && queues.length === 0) {
      toast.info("Nothing to sweep yet — add a service or queue first.");
      return;
    }
    const nextServices = services.map((service) => ({
      ...service,
      status: service.status === "maintenance" ? service.status : "healthy",
      uptime: Math.min(99.99, Number((service.uptime + 0.08).toFixed(2))),
    }));
    const nextQueues = queues.map((queue) => ({
      ...queue,
      lagMinutes: Math.max(1, queue.lagMinutes - 1),
      status: queue.backlog > 500 ? queue.status : "normal",
    }));
    const degradedServices = nextServices.filter((service) => service.status !== "healthy").length;
    const constrainedQueues = nextQueues.filter((queue) => queue.status !== "normal").length;
    saveWorkspace.mutate({
      services: nextServices,
      queues: nextQueues,
      ...(degradedServices > 0 || constrainedQueues > 0
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: "platform-health-sweep",
            tenantName: "Platform operations",
            subject: `Health sweep follow-up for ${degradedServices} service and ${constrainedQueues} queue issue${degradedServices + constrainedQueues === 1 ? "" : "s"}`,
            category: "Operations",
            priority: degradedServices > 0 ? "High" : "Medium",
            owner: "Platform ops",
            article: "Platform incident playbook",
            slaHours: 8,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Completed platform health sweep across ${services.length} services and ${queues.length} queues`,
      }),
    }, {
      onSuccess: () => toast.success(`Health sweep completed across ${services.length} service${services.length === 1 ? "" : "s"} and ${queues.length} queue${queues.length === 1 ? "" : "s"}`),
    });
  };

  const toggleMaintenance = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    let nextStatus: ServiceStatus = service.status;
    const nextServices = services.map((service) => {
      if (service.id !== serviceId) return service;
      nextStatus = service.status === "maintenance" ? "healthy" : "maintenance";
      return { ...service, status: nextStatus };
    });
    saveWorkspace.mutate({
      services: nextServices,
      ...(nextStatus === "maintenance"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: service.id,
            tenantName: service.name,
            subject: `Coordinate maintenance coverage for ${service.name}`,
            category: "Maintenance",
            priority: "High",
            owner: service.owner,
            article: "Platform incident playbook",
            slaHours: 4,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        severity: nextStatus === "maintenance" ? "Warning" : "Info",
        action: `Changed service ${service.name} from ${service.status} to ${nextStatus}`,
      }),
    });
    toast.success("Service state updated");
  };

  const drainQueue = (queueId: string) => {
    const queue = queues.find((item) => item.id === queueId);
    if (!queue) return;
    const nextQueues = queues.map((queue) => {
      if (queue.id !== queueId) return queue;
      const backlog = Math.max(0, Math.round(queue.backlog * 0.45));
      const lagMinutes = Math.max(0, Math.round(queue.lagMinutes * 0.4));
      const status: QueueStatus = backlog > 800 ? "blocked" : backlog > 200 ? "warning" : "normal";
      return { ...queue, backlog, lagMinutes, status };
    });
    const nextQueue = nextQueues.find((item) => item.id === queueId) ?? queue;
    saveWorkspace.mutate({
      queues: nextQueues,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: queue.id,
        tenantName: queue.name,
        subject: `Follow queue recovery actions for ${queue.name}`,
        category: "Operations",
        priority: nextQueue.status === "blocked" ? "High" : "Medium",
        owner: queue.owner,
        article: "Platform incident playbook",
        slaHours: nextQueue.status === "blocked" ? 4 : 12,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        severity: nextQueue.status === "blocked" ? "Critical" : nextQueue.status === "warning" ? "Warning" : "Info",
        action: `Started recovery on queue ${queue.name}; backlog ${queue.backlog} -> ${nextQueue.backlog}`,
      }),
    });
    toast.success("Queue recovery workflow started");
  };

  const updateIncident = (incidentId: string) => {
    const incident = incidents.find((item) => item.id === incidentId);
    if (!incident) return;
    let nextStatus: IncidentStatus = incident.status;
    const nextIncidents = incidents.map((incident) => {
      if (incident.id !== incidentId) return incident;
      const status: IncidentStatus = incident.status === "Investigating" ? "Monitoring" : "Mitigated";
      nextStatus = status;
      return {
        ...incident,
        status,
        commander: status === "Mitigated" ? "Resolved by platform ops" : incident.commander,
      };
    });
    saveWorkspace.mutate({
      opsIncidents: nextIncidents,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: incident.id,
        tenantName: incident.tenant,
        subject: nextStatus === "Mitigated" ? `Closeout tenant comms for ${incident.id}` : `Coordinate response updates for ${incident.id}`,
        category: "Incident",
        priority: incident.severity === "High" ? "Critical" : incident.severity === "Medium" ? "High" : "Medium",
        owner: incident.commander,
        article: "Platform incident playbook",
        slaHours: incident.severity === "High" ? 2 : 6,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: incident.tenant,
        area: "Operations",
        severity: incident.severity === "High" ? "Critical" : incident.severity === "Medium" ? "Warning" : "Info",
        action: `Moved incident ${incident.id} from ${incident.status} to ${nextStatus}`,
      }),
    });
    toast.success("Incident status advanced");
  };

  const approveRelease = (releaseId: string) => {
    const release = releases.find((item) => item.id === releaseId);
    if (!release) return;
    const nextReleases = releases.map((release) => (
      release.id === releaseId ? { ...release, status: "Approved" } : release
    ));
    saveWorkspace.mutate({
      releases: nextReleases,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: release.id,
        tenantName: release.title,
        subject: `Prepare release communications for ${release.id}`,
        category: "Release",
        priority: release.environment === "Production" ? "High" : "Medium",
        owner: release.owner,
        article: "Platform incident playbook",
        slaHours: release.environment === "Production" ? 6 : 24,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Approved release ${release.id} for ${release.environment.toLowerCase()} deployment`,
      }),
    });
    toast.success("Release approved for deployment");
  };

  const submitAddService = () => {
    if (!serviceForm.name.trim() || !serviceForm.owner.trim()) { toast.error("Name and owner are required"); return; }
    saveWorkspace.mutate({
      services: appendService(workspace, {
        name: serviceForm.name.trim(),
        owner: serviceForm.owner.trim(),
        region: serviceForm.region.trim() || "Not set",
        dependency: serviceForm.dependency.trim() || "None",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Added service ${serviceForm.name.trim()} to platform monitoring`,
      }),
    }, {
      onSuccess: () => {
        toast.success(`${serviceForm.name} added`);
        setServiceForm({ name: "", owner: "", region: "", dependency: "" });
        setAddServiceOpen(false);
      },
    });
  };

  const submitAddQueue = () => {
    if (!queueForm.name.trim() || !queueForm.owner.trim()) { toast.error("Name and owner are required"); return; }
    saveWorkspace.mutate({
      queues: appendQueue(workspace, {
        name: queueForm.name.trim(),
        owner: queueForm.owner.trim(),
        backlog: Number(queueForm.backlog) || 0,
        lagMinutes: Number(queueForm.lagMinutes) || 0,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Added queue ${queueForm.name.trim()} to platform monitoring`,
      }),
    }, {
      onSuccess: () => {
        toast.success(`${queueForm.name} added`);
        setQueueForm({ name: "", owner: "", backlog: "", lagMinutes: "" });
        setAddQueueOpen(false);
      },
    });
  };

  const submitAddIncident = () => {
    if (!incidentForm.title.trim() || !incidentForm.commander.trim()) { toast.error("Title and commander are required"); return; }
    saveWorkspace.mutate({
      opsIncidents: appendOpsIncident(workspace, {
        title: incidentForm.title.trim(),
        severity: incidentForm.severity,
        tenant: incidentForm.tenant.trim() || "Platform",
        commander: incidentForm.commander.trim(),
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: incidentForm.tenant.trim() || "Platform",
        area: "Operations",
        severity: incidentForm.severity === "High" ? "Critical" : incidentForm.severity === "Medium" ? "Warning" : "Info",
        action: `Logged incident: ${incidentForm.title.trim()}`,
      }),
    }, {
      onSuccess: () => {
        toast.success("Incident logged");
        setIncidentForm({ title: "", severity: "Medium", tenant: "", commander: "" });
        setAddIncidentOpen(false);
      },
    });
  };

  const submitAddRelease = () => {
    if (!releaseForm.title.trim() || !releaseForm.owner.trim()) { toast.error("Title and owner are required"); return; }
    saveWorkspace.mutate({
      releases: appendRelease(workspace, {
        title: releaseForm.title.trim(),
        environment: releaseForm.environment,
        owner: releaseForm.owner.trim(),
        window: releaseForm.window.trim() || "Not scheduled",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Added release ${releaseForm.title.trim()} for ${releaseForm.environment.toLowerCase()}`,
      }),
    }, {
      onSuccess: () => {
        toast.success(`${releaseForm.title} added`);
        setReleaseForm({ title: "", environment: "Staging", owner: "", window: "" });
        setAddReleaseOpen(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Operations"
        description="Monitor core services, workload queues, incidents, and release readiness across the shared platform."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/support-desk">Open support desk</Button>
            <Button onClick={runHealthSweep} startIcon={<Activity className="h-4 w-4" />}>
              Run health sweep
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Healthy services" value={`${stats.healthyServices}/${services.length}`} accent="success" icon={<Server className="h-4 w-4" />} />
        <StatCard label="Average uptime" value={stats.uptime === null ? "—" : `${stats.uptime.toFixed(2)}%`} accent="primary" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Blocked queues" value={stats.blockedQueues} accent="warning" icon={<ArrowRightLeft className="h-4 w-4" />} />
        <StatCard label="Open incidents" value={stats.openIncidents} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Pending releases" value={stats.pendingReleases} accent="accent" icon={<Rocket className="h-4 w-4" />} />
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="services" label="Services" />
          <Tab value="queues" label="Queues" />
          <Tab value="incidents" label="Incidents" />
          <Tab value="releases" label="Releases" />
        </Tabs>
        {tab === "services" && <Button size="small" startIcon={<Plus size={16} />} onClick={() => setAddServiceOpen(true)}>Add service</Button>}
        {tab === "queues" && <Button size="small" startIcon={<Plus size={16} />} onClick={() => setAddQueueOpen(true)}>Add queue</Button>}
        {tab === "incidents" && <Button size="small" startIcon={<Plus size={16} />} onClick={() => setAddIncidentOpen(true)}>Log incident</Button>}
        {tab === "releases" && <Button size="small" startIcon={<Plus size={16} />} onClick={() => setAddReleaseOpen(true)}>Add release</Button>}
      </div>

      {tab === "services" && (
        services.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={Server} title="No services tracked yet" description="Add the platform's core services to monitor uptime and run health sweeps." />
          </div>
        ) : (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Dependency</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Uptime</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{service.owner}</TableCell>
                  <TableCell>{service.dependency}</TableCell>
                  <TableCell>{service.region}</TableCell>
                  <TableCell className="w-44">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{service.uptime.toFixed(2)}%</span>
                        <span className="text-muted-foreground">{service.status}</span>
                      </div>
                      <LinearProgress variant="determinate" value={service.uptime} sx={{ height: 8, borderRadius: 999 }} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={service.status} sx={badgeSx(toneForStatus(service.status))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outlined" size="small" onClick={() => toggleMaintenance(service.id)}>
                      {service.status === "maintenance" ? "Restore" : "Maintenance"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )
      )}

      {tab === "queues" && (
        queues.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={ArrowRightLeft} title="No queues tracked yet" description="Add a workload queue to monitor backlog and lag, and to run recovery actions." />
          </div>
        ) : (
        <Box className="grid gap-4 lg:grid-cols-2">
          {queues.map((queue) => (
            <div key={queue.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{queue.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{queue.owner}</p>
                </div>
                <Chip size="small" label={queue.status} sx={badgeSx(toneForStatus(queue.status))} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Backlog</p>
                  <p className="mt-2 text-2xl font-semibold">{queue.backlog}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Lag</p>
                  <p className="mt-2 text-2xl font-semibold">{queue.lagMinutes} min</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Queue recovery trims backlog and resets lag alarms.</p>
                <Button size="small" onClick={() => drainQueue(queue.id)}>Drain queue</Button>
              </div>
            </div>
          ))}
        </Box>
        )
      )}

      {tab === "incidents" && (
        incidents.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={AlertTriangle} title="No incidents logged" description="Log an incident to track its response status and tenant impact." />
          </div>
        ) : (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Incident</TableCell>
                <TableCell>Tenant impact</TableCell>
                <TableCell>Commander</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
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
                  <TableCell>{incident.tenant}</TableCell>
                  <TableCell>{incident.commander}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={incident.severity}
                      sx={badgeSx(incident.severity === "High" ? "destructive" : incident.severity === "Medium" ? "warning" : "secondary")}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={incident.status} sx={badgeSx(toneForStatus(incident.status))} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outlined" size="small" onClick={() => updateIncident(incident.id)}>
                      {incident.status === "Mitigated" ? "Reviewed" : incident.status === "Monitoring" ? "Mitigate" : "Acknowledge"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )
      )}

      {tab === "releases" && (
        releases.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState icon={Rocket} title="No releases scheduled" description="Add a release to track its approval status and deployment window." />
          </div>
        ) : (
        <Box className="grid gap-4 lg:grid-cols-3">
          {releases.map((release) => (
            <div key={release.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{release.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{release.id}</p>
                </div>
                <Chip size="small" label={release.status} sx={badgeSx(toneForStatus(release.status))} />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Environment</span>
                  <span>{release.environment}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Owner</span>
                  <span>{release.owner}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Window</span>
                  <span>{release.window}</span>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Change window tracked by platform ops
                </div>
                <Button size="small" variant="outlined" disabled={release.status === "Approved"} onClick={() => approveRelease(release.id)}>
                  {release.status === "Approved" ? "Approved" : "Approve"}
                </Button>
              </div>
            </div>
          ))}
        </Box>
        )
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium">
            <HardDrive className="h-4 w-4" />
            Recovery readiness
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Backups and failover procedures should be reviewed after every degraded service event.</p>
          <Button sx={{ mt: 2, width: "100%" }} variant="outlined" component={Link} to="/backups">Review backups & data</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Escalation path
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Keep tenant-facing issues aligned with support ownership and commercial risk.</p>
          <Button sx={{ mt: 2, width: "100%" }} variant="outlined" component={Link} to="/tenant-success">Open tenant success</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium">
            <ShieldAlert className="h-4 w-4" />
            Response desk
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Use the support desk to align incidents, ticket ownership, and knowledge articles.</p>
          <Button sx={{ mt: 2, width: "100%" }} component={Link} to="/support-desk">Go to support desk</Button>
        </div>
      </div>

      <Dialog open={addServiceOpen} onClose={() => setAddServiceOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add service</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField label="Service name *" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} fullWidth size="small" placeholder="e.g. Notifications API" />
            <TextField label="Owner *" value={serviceForm.owner} onChange={(e) => setServiceForm({ ...serviceForm, owner: e.target.value })} fullWidth size="small" placeholder="e.g. Platform team" />
            <TextField label="Region" value={serviceForm.region} onChange={(e) => setServiceForm({ ...serviceForm, region: e.target.value })} fullWidth size="small" placeholder="e.g. af-south-1" />
            <TextField label="Dependency" value={serviceForm.dependency} onChange={(e) => setServiceForm({ ...serviceForm, dependency: e.target.value })} fullWidth size="small" placeholder="e.g. Postgres primary" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAddServiceOpen(false)}>Cancel</Button>
          <Button onClick={submitAddService} disabled={saveWorkspace.isPending}>Add service</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addQueueOpen} onClose={() => setAddQueueOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add queue</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField label="Queue name *" value={queueForm.name} onChange={(e) => setQueueForm({ ...queueForm, name: e.target.value })} fullWidth size="small" placeholder="e.g. Report card generation" />
            <TextField label="Owner *" value={queueForm.owner} onChange={(e) => setQueueForm({ ...queueForm, owner: e.target.value })} fullWidth size="small" placeholder="e.g. Academic services" />
            <TextField type="number" label="Current backlog" value={queueForm.backlog} onChange={(e) => setQueueForm({ ...queueForm, backlog: e.target.value })} fullWidth size="small" slotProps={{ htmlInput: { min: 0 } }} />
            <TextField type="number" label="Lag (minutes)" value={queueForm.lagMinutes} onChange={(e) => setQueueForm({ ...queueForm, lagMinutes: e.target.value })} fullWidth size="small" slotProps={{ htmlInput: { min: 0 } }} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAddQueueOpen(false)}>Cancel</Button>
          <Button onClick={submitAddQueue} disabled={saveWorkspace.isPending}>Add queue</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addIncidentOpen} onClose={() => setAddIncidentOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log incident</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField label="Title *" value={incidentForm.title} onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })} fullWidth size="small" placeholder="e.g. Elevated API latency" />
            <TextField select label="Severity" value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value as Incident["severity"] })} fullWidth size="small">
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
            </TextField>
            <TextField label="Tenant impact" value={incidentForm.tenant} onChange={(e) => setIncidentForm({ ...incidentForm, tenant: e.target.value })} fullWidth size="small" placeholder="e.g. All schools, or a specific tenant" />
            <TextField label="Commander *" value={incidentForm.commander} onChange={(e) => setIncidentForm({ ...incidentForm, commander: e.target.value })} fullWidth size="small" placeholder="Who's leading the response" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAddIncidentOpen(false)}>Cancel</Button>
          <Button onClick={submitAddIncident} disabled={saveWorkspace.isPending}>Log incident</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addReleaseOpen} onClose={() => setAddReleaseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add release</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField label="Title *" value={releaseForm.title} onChange={(e) => setReleaseForm({ ...releaseForm, title: e.target.value })} fullWidth size="small" placeholder="e.g. Q3 report card engine" />
            <TextField select label="Environment" value={releaseForm.environment} onChange={(e) => setReleaseForm({ ...releaseForm, environment: e.target.value as Release["environment"] })} fullWidth size="small">
              <MenuItem value="Sandbox">Sandbox</MenuItem>
              <MenuItem value="Staging">Staging</MenuItem>
              <MenuItem value="Production">Production</MenuItem>
            </TextField>
            <TextField label="Owner *" value={releaseForm.owner} onChange={(e) => setReleaseForm({ ...releaseForm, owner: e.target.value })} fullWidth size="small" />
            <TextField label="Change window" value={releaseForm.window} onChange={(e) => setReleaseForm({ ...releaseForm, window: e.target.value })} fullWidth size="small" placeholder="e.g. Sat 02:00-04:00 CAT" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAddReleaseOpen(false)}>Cancel</Button>
          <Button onClick={submitAddRelease} disabled={saveWorkspace.isPending}>Add release</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
