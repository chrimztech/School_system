import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, Layers3, ShieldAlert, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

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
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
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
            <Button variant="outline" asChild>
              <Link to="/platform-ops">Open platform ops</Link>
            </Button>
            <Button onClick={publishBanner}>
              <BellRing className="mr-2 h-4 w-4" />
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

      <Tabs defaultValue="rollouts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rollouts">Feature Rollouts</TabsTrigger>
          <TabsTrigger value="security">Identity & Security</TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
          <TabsTrigger value="defaults">Platform Defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="rollouts" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Capability</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                      <Progress value={rollout.coverage} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={rollout.state === "Enabled" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : rollout.state === "Pilot" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                      {rollout.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => cycleRollout(rollout.id)}>
                      {rollout.state === "Disabled" ? "Start pilot" : rollout.state === "Pilot" ? "Enable globally" : "Disable"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="security" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Baseline policies</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Require MFA for all admins</p>
                  <p className="text-sm text-muted-foreground">Applies to system admins and school admins.</p>
                </div>
                <Switch checked={security.mfaRequired} onCheckedChange={(value) => setSecurity((current) => ({ ...current, mfaRequired: value }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Send login anomaly alerts</p>
                  <p className="text-sm text-muted-foreground">Notify security ops on suspicious access patterns.</p>
                </div>
                <Switch checked={security.loginAlerts} onCheckedChange={(value) => setSecurity((current) => ({ ...current, loginAlerts: value }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Restrict system admin IP ranges</p>
                  <p className="text-sm text-muted-foreground">Only permit platform-admin login from approved networks.</p>
                </div>
                <Switch checked={security.ipAllowlist} onCheckedChange={(value) => setSecurity((current) => ({ ...current, ipAllowlist: value }))} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Session controls</p>
            <div className="mt-4 grid gap-4">
              <div>
                <Label>Admin session lifetime (hours)</Label>
                <Input className="mt-1" value={security.sessionHours} onChange={(event) => setSecurity((current) => ({ ...current, sessionHours: event.target.value }))} />
              </div>
              <div>
                <Label>Password rotation (days)</Label>
                <Input className="mt-1" value={security.passwordDays} onChange={(event) => setSecurity((current) => ({ ...current, passwordDays: event.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={saveSecurity}>Save policy</Button>
              <Button variant="outline" asChild>
                <Link to="/security">Open security ops</Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="communications" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Status messaging</p>
            <div className="mt-4 grid gap-4">
              <div>
                <Label>System banner</Label>
                <Input className="mt-1" value={comms.banner} onChange={(event) => setComms((current) => ({ ...current, banner: event.target.value }))} />
              </div>
              <div>
                <Label>Maintenance window</Label>
                <Input className="mt-1" value={comms.maintenanceWindow} onChange={(event) => setComms((current) => ({ ...current, maintenanceWindow: event.target.value }))} />
              </div>
            </div>
            <Button className="mt-5" onClick={publishBanner}>Publish update</Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Digest preferences</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Release digest</p>
                  <p className="text-sm text-muted-foreground">Send weekly change summaries to platform stakeholders.</p>
                </div>
                <Switch checked={comms.releaseDigest} onCheckedChange={(value) => setComms((current) => ({ ...current, releaseDigest: value }))} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Incident digest</p>
                  <p className="text-sm text-muted-foreground">Summarise major incidents and tenant impact daily.</p>
                </div>
                <Switch checked={comms.incidentDigest} onCheckedChange={(value) => setComms((current) => ({ ...current, incidentDigest: value }))} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="defaults" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Commercial and workflow defaults</p>
            <div className="mt-4 grid gap-4">
              <div>
                <Label>Default plan for new trials</Label>
                <Input className="mt-1" value={defaults.defaultPlan} onChange={(event) => setDefaults((current) => ({ ...current, defaultPlan: event.target.value }))} />
              </div>
              <div>
                <Label>Approval model</Label>
                <Input className="mt-1" value={defaults.approvalMode} onChange={(event) => setDefaults((current) => ({ ...current, approvalMode: event.target.value }))} />
              </div>
              <div>
                <Label>Default archive retention (days)</Label>
                <Input className="mt-1" value={defaults.archiveDays} onChange={(event) => setDefaults((current) => ({ ...current, archiveDays: event.target.value }))} />
              </div>
              <div>
                <Label>Ticket routing strategy</Label>
                <Input className="mt-1" value={defaults.ticketRouting} onChange={(event) => setDefaults((current) => ({ ...current, ticketRouting: event.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={saveDefaults}>Save defaults</Button>
              <Button variant="outline" asChild>
                <Link to="/plan-catalog">Open plan catalog</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Layers3 className="h-4 w-4" />
              Operational cross-links
            </div>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/tenant-lifecycle">Tenant lifecycle</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/platform-audit">Platform audit</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/support-desk">Support desk</Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
