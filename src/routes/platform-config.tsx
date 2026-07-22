import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Layers3, ShieldAlert, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
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
import { appendApprovalItem, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx } from "@/lib/utils";

type RolloutState = "Enabled" | "Pilot" | "Disabled";
type Rollout = {
  id: string;
  name: string;
  audience: string;
  state: RolloutState;
  coverage: number;
  owner: string;
};

export const Route = createFileRoute("/platform-config")({
  head: () => ({ meta: [{ title: "Platform Config - SRMS" }] }),
  component: PlatformConfigPage,
});

function PlatformConfigPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("rollouts");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const [rollouts, setRollouts] = useState<Rollout[]>([]);
  const [security, setSecurity] = useState({
    mfaRequired: false,
    loginAlerts: false,
    ipAllowlist: false,
    sessionHours: "",
    passwordDays: "",
  });
  const [comms, setComms] = useState({
    banner: "",
    maintenanceWindow: "",
    releaseDigest: false,
    incidentDigest: false,
  });
  const [defaults, setDefaults] = useState({
    defaultPlan: "",
    approvalMode: "",
    archiveDays: "",
    ticketRouting: "",
  });

  useEffect(() => {
    if (workspace?.rollouts) {
      setRollouts(workspace.rollouts as Rollout[]);
    }
  }, [workspace?.rollouts]);

  useEffect(() => {
    if (workspace?.platformSecurity) {
      setSecurity({
        mfaRequired: Boolean(workspace.platformSecurity.mfaRequired),
        loginAlerts: Boolean(workspace.platformSecurity.loginAlerts),
        ipAllowlist: Boolean(workspace.platformSecurity.ipAllowlist),
        sessionHours: String(workspace.platformSecurity.sessionHours ?? ""),
        passwordDays: String(workspace.platformSecurity.passwordDays ?? ""),
      });
    }
  }, [workspace?.platformSecurity]);

  useEffect(() => {
    if (workspace?.platformCommunications) {
      setComms({
        banner: String(workspace.platformCommunications.banner ?? ""),
        maintenanceWindow: String(workspace.platformCommunications.maintenanceWindow ?? ""),
        releaseDigest: Boolean(workspace.platformCommunications.releaseDigest),
        incidentDigest: Boolean(workspace.platformCommunications.incidentDigest),
      });
    }
  }, [workspace?.platformCommunications]);

  useEffect(() => {
    if (workspace?.platformDefaults) {
      setDefaults({
        defaultPlan: String(workspace.platformDefaults.defaultPlan ?? ""),
        approvalMode: String(workspace.platformDefaults.approvalMode ?? ""),
        archiveDays: String(workspace.platformDefaults.archiveDays ?? ""),
        ticketRouting: String(workspace.platformDefaults.ticketRouting ?? ""),
      });
    }
  }, [workspace?.platformDefaults]);

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
    enabledFlags: rollouts.filter((rollout) => rollout.state === "Enabled").length,
    pilotFlags: rollouts.filter((rollout) => rollout.state === "Pilot").length,
    digestsEnabled: [comms.releaseDigest, comms.incidentDigest].filter(Boolean).length,
    hardenedPolicies: [security.mfaRequired, security.loginAlerts, security.ipAllowlist].filter(Boolean).length,
  }), [comms.incidentDigest, comms.releaseDigest, rollouts, security.ipAllowlist, security.loginAlerts, security.mfaRequired]);

  const cycleRollout = (rolloutId: string) => {
    const rollout = rollouts.find((item) => item.id === rolloutId);
    if (!rollout) return;
    let nextState: RolloutState = rollout.state;
    const nextRollouts: Rollout[] = rollouts.map((rollout) => {
      if (rollout.id !== rolloutId) return rollout;
      if (rollout.state === "Disabled") {
        nextState = "Pilot";
        return { ...rollout, state: "Pilot" as RolloutState, coverage: 25 };
      }
      if (rollout.state === "Pilot") {
        nextState = "Enabled";
        return { ...rollout, state: "Enabled" as RolloutState, coverage: 100 };
      }
      nextState = "Disabled";
      return { ...rollout, state: "Disabled" as RolloutState, coverage: 0 };
    });
    setRollouts(nextRollouts);
    saveWorkspace.mutate({
      rollouts: nextRollouts,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: rollout.id,
        tenantName: rollout.name,
        subject: `Coordinate rollout move to ${nextState}`,
        category: "Operations",
        priority: nextState === "Disabled" ? "High" : "Medium",
        owner: rollout.owner,
        article: "General knowledge base",
        slaHours: nextState === "Disabled" ? 6 : 24,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        severity: nextState === "Disabled" ? "Warning" : "Info",
        action: `Moved rollout ${rollout.name} from ${rollout.state} to ${nextState}`,
      }),
    });
    toast.success("Rollout state updated");
  };

  const publishBanner = () => {
    saveWorkspace.mutate({
      platformCommunications: comms,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-comms",
        tenantName: "Platform communications",
        subject: "Align support desk with published platform banner",
        category: "Communications",
        priority: "Medium",
        owner: "Platform desk",
        article: "Platform incident playbook",
        slaHours: 6,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Published platform banner and maintenance communications",
      }),
    });
    toast.success("Platform status banner published");
  };

  const saveSecurity = () => {
    saveWorkspace.mutate({
      platformSecurity: security,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-security",
        tenantName: "Security operations",
        subject: "Apply updated global admin security baseline",
        category: "Security",
        priority: security.ipAllowlist ? "High" : "Medium",
        owner: "Security ops",
        article: "General knowledge base",
        slaHours: 12,
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Plan exception",
        requester: user?.name ?? "System Administrator",
        school: "Platform security",
        summary: "Review updated admin security baseline rollout plan",
        status: "Pending",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Access",
        severity: security.ipAllowlist ? "Info" : "Warning",
        action: "Saved global admin security baseline settings",
      }),
    });
    toast.success("Global security policy saved");
  };

  const saveDefaults = () => {
    saveWorkspace.mutate({
      platformDefaults: defaults,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-defaults",
        tenantName: "Platform operations",
        subject: "Review new platform default routing and approval settings",
        category: "Operations",
        priority: "Medium",
        owner: "Platform desk",
        article: "General knowledge base",
        slaHours: 24,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Saved platform default commercial and workflow settings",
      }),
    });
    toast.success("Platform defaults saved");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Configuration"
        description="Control global defaults, release rollouts, security baselines, and tenant-wide communication settings."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/platform-ops">Open platform ops</Button>
            <Button onClick={publishBanner} startIcon={<BellRing className="h-4 w-4" />}>
              Publish banner
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Enabled flags" value={stats.enabledFlags} accent="success" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Pilot rollouts" value={stats.pilotFlags} accent="warning" icon={<Workflow className="h-4 w-4" />} />
        <StatCard label="Security controls" value={stats.hardenedPolicies} accent="primary" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Active digests" value={stats.digestsEnabled} accent="accent" icon={<BellRing className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="rollouts" label="Feature Rollouts" />
        <Tab value="security" label="Identity & Security" />
        <Tab value="communications" label="Communications" />
        <Tab value="defaults" label="Platform Defaults" />
      </Tabs>

      {tab === "rollouts" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Capability</TableCell>
                <TableCell>Audience</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Coverage</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rollouts.map((rollout) => (
                <TableRow key={rollout.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{rollout.name}</p>
                      <p className="text-xs text-muted-foreground">{rollout.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{rollout.audience}</TableCell>
                  <TableCell>{rollout.owner}</TableCell>
                  <TableCell className="w-44">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{rollout.coverage}%</span>
                        <span className="text-muted-foreground">{rollout.state}</span>
                      </div>
                      <LinearProgress variant="determinate" value={rollout.coverage} sx={{ height: 8, borderRadius: 999 }} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={rollout.state}
                      sx={badgeSx(rollout.state === "Enabled" ? "success" : rollout.state === "Pilot" ? "warning" : "secondary")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outlined" size="small" onClick={() => cycleRollout(rollout.id)}>
                      {rollout.state === "Disabled" ? "Start pilot" : rollout.state === "Pilot" ? "Enable globally" : "Disable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "security" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Baseline policies</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Require MFA for all admins</p>
                  <p className="text-sm text-muted-foreground">Applies to system admins and school admins.</p>
                </div>
                <Switch checked={security.mfaRequired} onChange={(e) => setSecurity((current) => ({ ...current, mfaRequired: e.target.checked }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Send login anomaly alerts</p>
                  <p className="text-sm text-muted-foreground">Notify security ops on suspicious access patterns.</p>
                </div>
                <Switch checked={security.loginAlerts} onChange={(e) => setSecurity((current) => ({ ...current, loginAlerts: e.target.checked }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Restrict system admin IP ranges</p>
                  <p className="text-sm text-muted-foreground">Only permit platform-admin login from approved networks.</p>
                </div>
                <Switch checked={security.ipAllowlist} onChange={(e) => setSecurity((current) => ({ ...current, ipAllowlist: e.target.checked }))} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Session controls</p>
            <div className="mt-4 grid gap-4">
              <TextField
                label="Admin session lifetime (hours)"
                value={security.sessionHours}
                onChange={(event) => setSecurity((current) => ({ ...current, sessionHours: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Password rotation (days)"
                value={security.passwordDays}
                onChange={(event) => setSecurity((current) => ({ ...current, passwordDays: event.target.value }))}
                fullWidth
                size="small"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={saveSecurity}>Save policy</Button>
              <Button variant="outlined" component={Link} to="/security">Open security ops</Button>
            </div>
          </div>
        </Box>
      )}

      {tab === "communications" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Status messaging</p>
            <div className="mt-4 grid gap-4">
              <TextField
                label="System banner"
                value={comms.banner}
                onChange={(event) => setComms((current) => ({ ...current, banner: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Maintenance window"
                value={comms.maintenanceWindow}
                onChange={(event) => setComms((current) => ({ ...current, maintenanceWindow: event.target.value }))}
                fullWidth
                size="small"
              />
            </div>
            <Button sx={{ mt: 2.5 }} onClick={publishBanner}>Publish update</Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Digest preferences</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Release digest</p>
                  <p className="text-sm text-muted-foreground">Send weekly change summaries to platform stakeholders.</p>
                </div>
                <Switch checked={comms.releaseDigest} onChange={(e) => setComms((current) => ({ ...current, releaseDigest: e.target.checked }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Incident digest</p>
                  <p className="text-sm text-muted-foreground">Summarise major incidents and tenant impact daily.</p>
                </div>
                <Switch checked={comms.incidentDigest} onChange={(e) => setComms((current) => ({ ...current, incidentDigest: e.target.checked }))} />
              </div>
            </div>
          </div>
        </Box>
      )}

      {tab === "defaults" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Commercial and workflow defaults</p>
            <div className="mt-4 grid gap-4">
              <TextField
                label="Default plan for new trials"
                value={defaults.defaultPlan}
                onChange={(event) => setDefaults((current) => ({ ...current, defaultPlan: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Approval model"
                value={defaults.approvalMode}
                onChange={(event) => setDefaults((current) => ({ ...current, approvalMode: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Default archive retention (days)"
                value={defaults.archiveDays}
                onChange={(event) => setDefaults((current) => ({ ...current, archiveDays: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Ticket routing strategy"
                value={defaults.ticketRouting}
                onChange={(event) => setDefaults((current) => ({ ...current, ticketRouting: event.target.value }))}
                fullWidth
                size="small"
              />
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={saveDefaults}>Save defaults</Button>
              <Button variant="outlined" component={Link} to="/plan-catalog">Open plan catalog</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers3 className="h-4 w-4" />
              Operational cross-links
            </div>
            <div className="mt-4 space-y-3">
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/tenant-lifecycle">Tenant lifecycle</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/platform-audit">Platform audit</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/support-desk">Support desk</Button>
            </div>
          </div>
        </Box>
      )}
    </div>
  );
}
