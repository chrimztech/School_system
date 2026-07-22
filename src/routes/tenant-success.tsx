import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, HeartHandshake, ShieldAlert, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, LinearProgress, MenuItem, TextField, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { FEATURE_ORDER, PLAN_CATALOG, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, type BadgeTone } from "@/lib/utils";

type Risk = "Low" | "Medium" | "High";
type SuccessOverride = {
  owner?: string;
  nextReview?: string;
  lastTouchpoint?: string;
  escalated?: boolean;
  trialExtensions?: number;
};

const csmOwners = ["Portfolio Desk", "CSM team", "Platform desk"];
const DAY_MS = 24 * 60 * 60 * 1000;

function riskTone(risk: Risk): BadgeTone {
  if (risk === "Low") return "success";
  if (risk === "Medium") return "warning";
  return "destructive";
}

function parseDate(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function daysUntil(value: string) {
  const parsed = parseDate(value);
  if (!parsed) return Number.POSITIVE_INFINITY;
  return Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function deriveNextReviewDate(renewalDate: string, index: number) {
  const renewal = parseDate(renewalDate);
  if (renewal) {
    return formatDateLabel(addDays(renewal, -(14 - Math.min(index, 3) * 2)));
  }
  return formatDateLabel(addDays(new Date(), 7 + index * 7));
}

function deriveLastTouchpoint(nextReview: string) {
  const review = parseDate(nextReview);
  if (review) {
    return formatDateLabel(addDays(review, -7));
  }
  return formatDateLabel(addDays(new Date(), -3));
}

export const Route = createFileRoute("/tenant-success")({
  head: () => ({ meta: [{ title: "Tenant Success - SRMS" }] }),
  component: TenantSuccessPage,
});

function TenantSuccessPage() {
  const { user } = useAuth();
  const { tenants, updateTenant } = useTenant();
  const [query, setQuery] = useState("");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const overrides = (workspace?.tenantSuccessOverrides ?? {}) as Record<string, SuccessOverride>;
  const [tab, setTab] = useState("portfolio");

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

  const portfolio = useMemo(() => tenants.map((tenant, index) => {
    const override = overrides[tenant.id] ?? {};
    const learnerLoad = tenant.totalStudents / tenant.subscription.learnerLimit;
    const campusLoad = tenant.campuses.length / tenant.subscription.campusLimit;
    const smsLoad = tenant.subscription.smsQuota > 0 ? tenant.subscription.smsUsed / tenant.subscription.smsQuota : 0;
    const enabledFeatures = FEATURE_ORDER.filter((feature) => tenant.features[feature]).length;
    const adoptionScore = Math.round((enabledFeatures / FEATURE_ORDER.length) * 100);
    let healthScore = 95;

    if (tenant.subscription.status === "trial") healthScore -= 4;
    if (tenant.subscription.status === "past_due") healthScore -= 28;
    if (tenant.subscription.status === "suspended") healthScore -= 55;
    if (learnerLoad > 0.95) healthScore -= 8;
    if (campusLoad > 0.9) healthScore -= 6;
    if (smsLoad > 0.85) healthScore -= 5;
    if (tenant.subscription.supportLevel === "Dedicated") healthScore += 3;

    const clampedHealth = Math.max(32, Math.min(99, healthScore));
    const risk: Risk = clampedHealth < 60 || tenant.subscription.status === "past_due" || tenant.subscription.status === "suspended"
      ? "High"
      : clampedHealth < 80
        ? "Medium"
        : "Low";

    return {
      tenant,
      owner: override.owner ?? csmOwners[index % csmOwners.length],
      nextReview: override.nextReview ?? deriveNextReviewDate(tenant.subscription.renewalDate, index),
      lastTouchpoint: override.lastTouchpoint ?? deriveLastTouchpoint(override.nextReview ?? deriveNextReviewDate(tenant.subscription.renewalDate, index)),
      escalated: override.escalated ?? false,
      trialExtensions: override.trialExtensions ?? 0,
      healthScore: clampedHealth,
      adoptionScore,
      risk,
      learnerLoad,
      campusLoad,
      daysToRenewal: daysUntil(tenant.subscription.renewalDate),
    };
  }).filter((record) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
      record.tenant.name,
      record.tenant.district,
      record.owner,
      PLAN_CATALOG[record.tenant.subscription.planId].name,
    ].some((value) => value.toLowerCase().includes(q));
  }), [overrides, query, tenants]);

  const atRisk = portfolio.filter((record) => record.risk === "High").length;
  const renewingSoon = portfolio.filter((record) => record.daysToRenewal <= 45).length;
  const avgHealth = portfolio.length ? Math.round(portfolio.reduce((sum, record) => sum + record.healthScore, 0) / portfolio.length) : 0;
  const avgAdoption = portfolio.length ? Math.round(portfolio.reduce((sum, record) => sum + record.adoptionScore, 0) / portfolio.length) : 0;

  const supportPriorityForStatus = (status: string): "Low" | "Medium" | "High" | "Critical" => {
    if (status === "suspended") return "Critical";
    if (status === "past_due") return "High";
    if (status === "trial") return "Medium";
    return "Low";
  };

  const updateOwner = (tenantId: string, owner: string) => {
    const tenant = tenants.find((record) => record.id === tenantId);
    if (!tenant) return;
    saveWorkspace.mutate({
      tenantSuccessOverrides: {
        ...overrides,
        [tenantId]: { ...overrides[tenantId], owner },
      },
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant.name,
        area: "Lifecycle",
        action: `Reassigned tenant success owner to ${owner}`,
      }),
    });
    toast.success("Portfolio owner updated");
  };

  const scheduleReview = (tenantId: string) => {
    const tenant = tenants.find((record) => record.id === tenantId);
    if (!tenant) return;
    const nextReview = formatDateLabel(addDays(new Date(), 7));
    const lastTouchpoint = formatDateLabel(new Date());
    saveWorkspace.mutate({
      tenantSuccessOverrides: {
        ...overrides,
        [tenantId]: {
          ...overrides[tenantId],
          nextReview,
          lastTouchpoint,
        },
      },
      tenantHandoffs: appendTenantHandoff(workspace, {
        school: tenant.name,
        owner: overrides[tenantId]?.owner ?? "Portfolio Desk",
        reason: "Tenant success review scheduled",
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subject: "Prepare success review agenda and health notes",
        category: "Customer Success",
        priority: supportPriorityForStatus(tenant.subscription.status),
        owner: overrides[tenantId]?.owner ?? "Portfolio Desk",
        article: "Renewal and success workflow",
        slaHours: 24,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant.name,
        area: "Lifecycle",
        action: "Scheduled portfolio health review",
      }),
    });
    toast.success("Success review scheduled");
  };

  const extendTrial = (tenantId: string) => {
    const tenant = tenants.find((record) => record.id === tenantId);
    if (!tenant) return;
    if (tenant.subscription.status !== "trial") {
      toast.info("Trial extension is only available for trial schools");
      return;
    }
    const now = new Date();
    const currentRenewal = parseDate(tenant.subscription.renewalDate);
    const anchor = currentRenewal && currentRenewal.getTime() > now.getTime() ? currentRenewal : now;
    const extendedRenewal = formatDateLabel(addDays(anchor, 21));
    updateTenant(tenantId, { subscription: { renewalDate: extendedRenewal } });
    const currentExtensions = overrides[tenantId]?.trialExtensions ?? 0;
    saveWorkspace.mutate({
      tenantSuccessOverrides: {
        ...overrides,
        [tenantId]: {
          ...overrides[tenantId],
          trialExtensions: currentExtensions + 1,
        },
      },
      tenantHandoffs: appendTenantHandoff(workspace, {
        school: tenant.name,
        owner: overrides[tenantId]?.owner ?? "Portfolio Desk",
        reason: "Trial extension granted and follow-up coaching required",
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subject: "Deliver trial extension coaching and adoption follow-up",
        category: "Customer Success",
        priority: "Medium",
        owner: overrides[tenantId]?.owner ?? "Portfolio Desk",
        article: "Renewal and success workflow",
        slaHours: 24,
      }),
      ...(currentExtensions >= 1
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Plan exception",
            requester: user?.name ?? "System Administrator",
            school: tenant.name,
            summary: "Review repeated trial extension before next renewal checkpoint",
            status: "Pending",
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant.name,
        area: "Billing",
        action: `Extended trial renewal date to ${extendedRenewal}`,
      }),
    });
    toast.success(`Trial extended to ${extendedRenewal}`);
  };

  const escalateAccount = (tenantId: string) => {
    const tenant = tenants.find((record) => record.id === tenantId);
    if (!tenant) return;
    saveWorkspace.mutate({
      tenantSuccessOverrides: {
        ...overrides,
        [tenantId]: {
          ...overrides[tenantId],
          escalated: true,
        },
      },
      supportTickets: appendSupportTicket(workspace, {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subject: "Executive follow-up required",
        category: "Customer Success",
        priority: "High",
        owner: overrides[tenantId]?.owner ?? "Portfolio Desk",
        article: "Renewal and success workflow",
        slaHours: 8,
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Discount",
        requester: user?.name ?? "System Administrator",
        school: tenant.name,
        summary: "Review rescue offer, concession, or intervention for escalated account",
        status: "Pending",
      }),
      tenantHandoffs: appendTenantHandoff(workspace, {
        school: tenant.name,
        owner: overrides[tenantId]?.owner ?? "Portfolio Desk",
        reason: "Executive follow-up escalation opened",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant.name,
        area: "Lifecycle",
        severity: "Warning",
        action: "Flagged account for executive follow-up",
      }),
    });
    toast.warning("Account flagged for executive follow-up");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Success"
        description="Track school health, renewals, adoption, and expansion readiness across every subscribed tenant."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/support-desk">Open support desk</Button>
            <Button variant="contained" component={Link} to="/sys-admin">Open portfolio admin</Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average health" value={`${avgHealth}/100`} accent="success" icon={<HeartHandshake className="h-4 w-4" />} />
        <StatCard label="At-risk accounts" value={atRisk} accent="destructive" icon={<TriangleAlert className="h-4 w-4" />} />
        <StatCard label="Renewals in 45 days" value={renewingSoon} accent="warning" icon={<CalendarClock className="h-4 w-4" />} />
        <StatCard label="Average adoption" value={`${avgAdoption}%`} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search schools, district, owner, or plan"
          fullWidth
          size="small"
        />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="portfolio" label="Portfolio" />
        <Tab value="renewals" label="Renewals" />
        <Tab value="adoption" label="Adoption" />
      </Tabs>

      {tab === "portfolio" && (
        <div className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Health</TableCell>
                <TableCell>Adoption</TableCell>
                <TableCell>Renewal</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {portfolio.map((record) => (
                <TableRow key={record.tenant.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{record.tenant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {PLAN_CATALOG[record.tenant.subscription.planId].name} · {record.tenant.campuses.length} campuses
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="w-52">
                    <TextField
                      select
                      value={record.owner}
                      onChange={(e) => updateOwner(record.tenant.id, e.target.value)}
                      size="small"
                      fullWidth
                    >
                      {csmOwners.map((owner) => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell className="w-44">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{record.healthScore}/100</span>
                        <span className="text-muted-foreground">{record.lastTouchpoint}</span>
                      </div>
                      <LinearProgress variant="determinate" value={record.healthScore} sx={{ height: 8, borderRadius: 999 }} />
                    </div>
                  </TableCell>
                  <TableCell className="w-44">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{record.adoptionScore}%</span>
                        <span className="text-muted-foreground">{FEATURE_ORDER.filter((feature) => record.tenant.features[feature]).length} modules</span>
                      </div>
                      <LinearProgress variant="determinate" value={record.adoptionScore} sx={{ height: 8, borderRadius: 999 }} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{record.tenant.subscription.renewalDate}</p>
                      <p className="text-xs text-muted-foreground">Next review {record.nextReview}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Chip size="small" label={record.risk} sx={badgeSx(riskTone(record.risk))} />
                      {record.escalated && <p className="text-xs text-rose-600 dark:text-rose-300">Executive follow-up</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outlined" size="small" onClick={() => scheduleReview(record.tenant.id)}>Review</Button>
                      <Button variant="outlined" size="small" onClick={() => escalateAccount(record.tenant.id)}>Escalate</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {tab === "renewals" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {portfolio.map((record) => (
            <div key={record.tenant.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{record.tenant.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{record.tenant.subscription.billingContact}</p>
                </div>
                <Chip size="small" label={record.risk} sx={badgeSx(riskTone(record.risk))} />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Renewal date</span>
                  <span>{record.tenant.subscription.renewalDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Billing status</span>
                  <span className="capitalize">{record.tenant.subscription.status.replace("_", " ")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monthly value</span>
                  <span>K{record.tenant.subscription.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trial extensions</span>
                  <span>{record.trialExtensions}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="small" variant="outlined" onClick={() => scheduleReview(record.tenant.id)}>Schedule review</Button>
                <Button size="small" variant="outlined" onClick={() => extendTrial(record.tenant.id)}>Extend trial</Button>
                <Button size="small" variant="contained" onClick={() => escalateAccount(record.tenant.id)}>Flag escalation</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "adoption" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {portfolio.map((record) => (
            <div key={record.tenant.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{record.tenant.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{record.tenant.district} · {PLAN_CATALOG[record.tenant.subscription.planId].name}</p>
                </div>
                <Chip size="small" label={`${record.adoptionScore}% adoption`} sx={badgeSx("outline")} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Learner capacity</p>
                  <p className="mt-2 text-xl font-semibold">{Math.round(record.learnerLoad * 100)}%</p>
                  <p className="text-xs text-muted-foreground">{record.tenant.totalStudents}/{record.tenant.subscription.learnerLimit} learners</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Campus usage</p>
                  <p className="mt-2 text-xl font-semibold">{Math.round(record.campusLoad * 100)}%</p>
                  <p className="text-xs text-muted-foreground">{record.tenant.campuses.length}/{record.tenant.subscription.campusLimit} campuses</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium">Recommended motion</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {record.risk === "High"
                    ? "Prioritise billing resolution and operational support before expansion."
                    : record.adoptionScore < 70
                      ? "Drive enablement on included modules and schedule product coaching."
                      : "Position plan expansion and additional campus services."}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outlined" size="small" component={Link} to="/plan-catalog">Review plans</Button>
                <Button variant="contained" size="small" component={Link} to="/support-desk">Open support desk</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Wallet className="h-4 w-4" />
            Commercial alignment
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Use billing and plan controls together when renewal risk is tied to pricing or campus growth.</p>
          <Button sx={{ mt: 2, width: "100%" }} variant="outlined" component={Link} to="/billing">Open billing</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Expansion planning
          </div>
          <p className="mt-3 text-sm text-muted-foreground">High-adoption schools are the best candidates for additional campuses and advanced modules.</p>
          <Button sx={{ mt: 2, width: "100%" }} variant="outlined" component={Link} to="/plan-catalog">Open plan catalog</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium">
            <HeartHandshake className="h-4 w-4" />
            Support follow-through
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Escalated schools should have shared notes between support, success, and platform operations.</p>
          <Button sx={{ mt: 2, width: "100%" }} variant="contained" component={Link} to="/support-desk">Open support desk</Button>
        </div>
      </div>
    </div>
  );
}
