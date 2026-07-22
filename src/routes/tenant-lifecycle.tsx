import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRightCircle, Building2, ShieldAlert, Siren, Workflow, Wrench } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
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
import { appendApprovalItem, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { PLAN_CATALOG, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, type BadgeTone } from "@/lib/utils";

type LifecycleStage = "Trial" | "Implementation" | "Go-live" | "Live" | "Recovery" | "Suspended";

type LifecycleOverride = {
  stage?: LifecycleStage;
  owner?: string;
  readiness?: number;
  blocker?: string;
};

const implementationOwners = ["Implementation desk", "Platform team", "Onboarding desk"];

function inferStage(status: string, campuses: number): LifecycleStage {
  if (status === "suspended") return "Suspended";
  if (status === "past_due") return "Recovery";
  if (status === "trial") return campuses > 1 ? "Implementation" : "Trial";
  return campuses > 1 ? "Live" : "Go-live";
}

function stageTone(stage: LifecycleStage): BadgeTone {
  if (stage === "Live") return "success";
  if (stage === "Recovery" || stage === "Suspended") return "destructive";
  return "warning";
}

export const Route = createFileRoute("/tenant-lifecycle")({
  head: () => ({ meta: [{ title: "Tenant Lifecycle - SRMS" }] }),
  component: TenantLifecyclePage,
});

function TenantLifecyclePage() {
  const { user } = useAuth();
  const { tenants, updateTenant } = useTenant();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const overrides = (workspace?.tenantLifecycleOverrides ?? {}) as Record<string, LifecycleOverride>;
  const [tab, setTab] = useState("pipeline");

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button variant="outlined" component={Link} to="/">Go to dashboard</Button>
      </div>
    );
  }

  const lifecycle = useMemo(() => tenants.map((tenant, index) => {
    const override = overrides[tenant.id] ?? {};
    const stage = override.stage ?? inferStage(tenant.subscription.status, tenant.campuses.length);
    const readiness = override.readiness ?? (stage === "Live"
      ? 100
      : stage === "Go-live"
        ? 82
        : stage === "Implementation"
          ? 58
          : stage === "Trial"
            ? 35
            : stage === "Recovery"
              ? 44
              : 18);
    const blocker = override.blocker ?? (
      stage === "Recovery" ? "Billing risk on renewal" :
        stage === "Implementation" ? "Staff onboarding incomplete" :
          stage === "Trial" ? "Campus structure sign-off pending" :
            stage === "Suspended" ? "Contract suspended" :
              "No critical blockers"
    );
    const owner = override.owner ?? implementationOwners[index % implementationOwners.length];
    return { tenant, stage, readiness, blocker, owner };
  }), [overrides, tenants]);

  const stats = {
    activeRollouts: lifecycle.filter((record) => record.stage === "Implementation" || record.stage === "Go-live").length,
    liveTenants: lifecycle.filter((record) => record.stage === "Live").length,
    recoveryAccounts: lifecycle.filter((record) => record.stage === "Recovery").length,
    suspendedAccounts: lifecycle.filter((record) => record.stage === "Suspended").length,
  };

  const advanceStage = (tenantId: string) => {
    const existing = overrides[tenantId];
    const tenant = tenants.find((item) => item.id === tenantId);
    const stage = existing?.stage ?? inferStage(tenant?.subscription.status ?? "trial", tenant?.campuses.length ?? 1);
    const next: LifecycleStage =
      stage === "Trial" ? "Implementation" :
        stage === "Implementation" ? "Go-live" :
          stage === "Go-live" ? "Live" :
            stage === "Recovery" ? "Go-live" :
              stage;
    saveWorkspace.mutate({
      tenantLifecycleOverrides: {
        ...overrides,
        [tenantId]: {
          ...existing,
          stage: next,
          readiness: next === "Live" ? 100 : next === "Go-live" ? 85 : 60,
          blocker: next === "Live" ? "No critical blockers" : "Final rollout checks in progress",
        },
      },
      tenantHandoffs: appendTenantHandoff(workspace, {
        school: tenant?.name ?? "Tenant",
        owner: existing?.owner ?? implementationOwners[0],
        reason: `Lifecycle advanced to ${next}`,
      }),
      ...(tenant
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: tenant.id,
            tenantName: tenant.name,
            subject:
              next === "Implementation"
                ? "Kick off tenant implementation workplan"
                : next === "Go-live"
                  ? "Prepare go-live readiness and hypercare coverage"
                  : next === "Live"
                    ? "Start post-launch hypercare follow-up"
                    : `Coordinate lifecycle transition to ${next}`,
            category: "Lifecycle",
            priority: next === "Go-live" || next === "Live" ? "High" : "Medium",
            owner: existing?.owner ?? implementationOwners[0],
            article: "Renewal and success workflow",
            slaHours: next === "Go-live" || next === "Live" ? 8 : 24,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant?.name ?? "Tenant",
        area: "Lifecycle",
        action: `Advanced tenant lifecycle from ${stage} to ${next}`,
      }),
    });
    toast.success("Lifecycle stage advanced");
  };

  const setOwner = (tenantId: string, owner: string) => {
    const tenant = tenants.find((item) => item.id === tenantId);
    saveWorkspace.mutate({
      tenantLifecycleOverrides: {
        ...overrides,
        [tenantId]: { ...overrides[tenantId], owner },
      },
      tenantHandoffs: appendTenantHandoff(workspace, {
        school: tenant?.name ?? "Tenant",
        owner,
        reason: "Lifecycle owner reassigned",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant?.name ?? "Tenant",
        area: "Lifecycle",
        action: `Reassigned lifecycle owner to ${owner}`,
      }),
    });
    toast.success("Lifecycle owner updated");
  };

  const queueRecovery = (tenantId: string) => {
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) return;
    updateTenant(tenantId, { subscription: { status: "past_due" } });
    saveWorkspace.mutate({
      tenantLifecycleOverrides: {
        ...overrides,
        [tenantId]: {
          ...overrides[tenantId],
          stage: "Recovery",
          readiness: 42,
          blocker: "Renewal or billing intervention required",
        },
      },
      supportTickets: appendSupportTicket(workspace, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subject: "Recovery workflow started",
        category: "Billing",
        priority: "High",
        owner: overrides[tenantId]?.owner ?? implementationOwners[0],
        article: "Renewal and success workflow",
        slaHours: 6,
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Plan exception",
        requester: user?.name ?? "System Administrator",
        school: tenant.name,
        summary: "Review recovery intervention, concession, or phased reactivation path",
        status: "Pending",
      }),
      tenantHandoffs: appendTenantHandoff(workspace, {
        school: tenant.name,
        owner: overrides[tenantId]?.owner ?? implementationOwners[0],
        reason: "Recovery workflow started for billing intervention",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant.name,
        area: "Lifecycle",
        severity: "Warning",
        action: "Moved tenant into recovery workflow",
      }),
    });
    toast.warning("Recovery workflow started");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Lifecycle"
        description="Track onboarding, implementation, go-live readiness, recovery, and suspended accounts across the full school portfolio."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/onboarding">
              Open onboarding
            </Button>
            <Button variant="contained" component={Link} to="/tenant-success">
              Open tenant success
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Implementation & go-live" value={stats.activeRollouts} accent="warning" icon={<Workflow className="h-4 w-4" />} />
        <StatCard label="Live schools" value={stats.liveTenants} accent="success" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Recovery accounts" value={stats.recoveryAccounts} accent="destructive" icon={<Siren className="h-4 w-4" />} />
        <StatCard label="Suspended accounts" value={stats.suspendedAccounts} accent="accent" icon={<Wrench className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="pipeline" label="Pipeline" />
        <Tab value="launch" label="Launch readiness" />
        <Tab value="recovery" label="Recovery & suspension" />
      </Tabs>

      {tab === "pipeline" && (
        <div className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Readiness</TableCell>
                <TableCell>Blocker</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lifecycle.map((record) => (
                <TableRow key={record.tenant.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{record.tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{record.tenant.district} · {record.tenant.campuses.length} campuses</p>
                    </div>
                  </TableCell>
                  <TableCell className="w-52">
                    <TextField
                      select
                      value={record.owner}
                      onChange={(e) => setOwner(record.tenant.id, e.target.value)}
                      size="small"
                      fullWidth
                    >
                      {implementationOwners.map((owner) => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>{PLAN_CATALOG[record.tenant.subscription.planId].name}</TableCell>
                  <TableCell><Chip size="small" label={record.stage} sx={badgeSx(stageTone(record.stage))} /></TableCell>
                  <TableCell className="w-44">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{record.readiness}%</span>
                        <span className="text-muted-foreground">{record.stage}</span>
                      </div>
                      <LinearProgress variant="determinate" value={record.readiness} sx={{ height: 8, borderRadius: 999 }} />
                    </div>
                  </TableCell>
                  <TableCell>{record.blocker}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="small" variant="outlined" startIcon={<ArrowRightCircle size={16} />} onClick={() => advanceStage(record.tenant.id)}>
                        Advance
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => queueRecovery(record.tenant.id)}>Recovery</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {tab === "launch" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {lifecycle.filter((record) => record.stage === "Trial" || record.stage === "Implementation" || record.stage === "Go-live").map((record) => (
            <div key={record.tenant.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{record.tenant.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{record.owner}</p>
                </div>
                <Chip size="small" label={record.stage} sx={badgeSx(stageTone(record.stage))} />
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Launch readiness</span>
                  <span>{record.readiness}%</span>
                </div>
                <LinearProgress variant="determinate" value={record.readiness} sx={{ mt: 1, height: 8, borderRadius: 999 }} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Billing contact</p>
                  <p className="mt-2 text-sm font-medium">{record.tenant.subscription.billingContact || "Pending"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Academic levels</p>
                  <p className="mt-2 text-sm font-medium">{record.tenant.levels.length}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{record.blocker}</p>
              <div className="mt-4 flex gap-2">
                <Button size="small" variant="outlined" onClick={() => advanceStage(record.tenant.id)}>Advance stage</Button>
                <Button size="small" variant="contained" component={Link} to="/support-desk">
                  Open support
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "recovery" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {lifecycle.filter((record) => record.stage === "Recovery" || record.stage === "Suspended").map((record) => (
            <div key={record.tenant.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{record.tenant.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{record.owner}</p>
                </div>
                <Chip size="small" label={record.stage} sx={badgeSx(stageTone(record.stage))} />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subscription</span>
                  <span className="capitalize">{record.tenant.subscription.status.replace("_", " ")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Renewal</span>
                  <span>{record.tenant.subscription.renewalDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">MRR</span>
                  <span>K{record.tenant.subscription.amount.toLocaleString()}</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{record.blocker}</p>
              <div className="mt-4 flex gap-2">
                <Button size="small" variant="outlined" onClick={() => advanceStage(record.tenant.id)}>Re-activate path</Button>
                <Button size="small" variant="contained" component={Link} to="/tenant-success">
                  Open success
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
