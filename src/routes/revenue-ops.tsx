import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CreditCard, Download, RefreshCw, ShieldAlert, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, LinearProgress, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendExportJob, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { PLAN_CATALOG, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, downloadCsv, type BadgeTone } from "@/lib/utils";

type CollectionStatus = "Scheduled" | "In progress" | "Promised" | "Resolved";
type CollectionCase = {
  id: string;
  tenantId: string;
  school: string;
  amount: number;
  owner: string;
  status: CollectionStatus;
  nextAction: string;
};

const collectionOwners = ["Finance ops", "Portfolio desk", "Revenue ops"];

function revenueRisk(status: string, learnerPct: number, campusPct: number): "Low" | "Medium" | "High" {
  if (status === "past_due" || status === "suspended") return "High";
  if (learnerPct > 95 || campusPct > 90) return "Medium";
  return "Low";
}

function riskTone(risk: "Low" | "Medium" | "High"): BadgeTone {
  if (risk === "Low") return "success";
  if (risk === "Medium") return "warning";
  return "destructive";
}

function daysUntil(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24));
}

export const Route = createFileRoute("/revenue-ops")({
  head: () => ({ meta: [{ title: "Revenue Ops - SRMS" }] }),
  component: RevenueOpsPage,
});

function RevenueOpsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("portfolio");
  const { tenants } = useTenant();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const cases = (workspace?.revenueCases ?? tenants.map((tenant, index) => ({
    id: `REV-${index + 101}`,
    tenantId: tenant.id,
    school: tenant.name,
    amount: Math.round(tenant.subscription.amount * (tenant.subscription.status === "past_due" ? 1.4 : 1)),
    owner: collectionOwners[index % collectionOwners.length],
    status: (tenant.subscription.status === "past_due" ? "In progress" : tenant.subscription.status === "trial" ? "Scheduled" : "Promised") as CollectionStatus,
    nextAction: tenant.subscription.status === "past_due" ? "Call bursar" : tenant.subscription.status === "trial" ? "Convert before renewal" : "Review campus uplift",
  })).slice(0, Math.max(3, tenants.length))) as CollectionCase[];

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

  const portfolio = useMemo(() => tenants.map((tenant) => {
    const learnerPct = tenant.subscription.learnerLimit > 0 ? Math.round((tenant.totalStudents / tenant.subscription.learnerLimit) * 100) : 0;
    const campusPct = tenant.subscription.campusLimit > 0 ? Math.round((tenant.campuses.length / tenant.subscription.campusLimit) * 100) : 0;
    const risk = revenueRisk(tenant.subscription.status, learnerPct, campusPct);
    const daysToRenewal = daysUntil(tenant.subscription.renewalDate);
    const expansion = tenant.subscription.status === "active" && (campusPct > 80 || learnerPct > 90);
    return { tenant, learnerPct, campusPct, risk, daysToRenewal, expansion };
  }), [tenants]);

  const mrr = portfolio.filter((record) => record.tenant.subscription.status === "active").reduce((sum, record) => sum + record.tenant.subscription.amount, 0);
  const arr = mrr * 12;
  const atRiskRevenue = portfolio.filter((record) => record.risk === "High").reduce((sum, record) => sum + record.tenant.subscription.amount, 0);
  const renewalsWindow = portfolio.filter((record) => record.daysToRenewal <= 60).reduce((sum, record) => sum + record.tenant.subscription.amount, 0);

  const advanceCase = (caseId: string) => {
    const currentCase = cases.find((item) => item.id === caseId);
    if (!currentCase) return;
    const tenant = tenants.find((item) => item.id === currentCase.tenantId);
    let nextStatus: CollectionStatus = currentCase.status;
    const nextCases = cases.map((item) => {
      if (item.id !== caseId) return item;
      const status: CollectionStatus =
        item.status === "Scheduled" ? "In progress" :
          item.status === "In progress" ? "Promised" :
            item.status === "Promised" ? "Resolved" :
              "Resolved";
      nextStatus = status;
      return { ...item, status, nextAction: status === "Resolved" ? "Closed" : status === "Promised" ? "Await payment" : "Escalate reminder" };
    });
    const downstreamPatch =
      nextStatus === "In progress"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: currentCase.tenantId,
            tenantName: currentCase.school,
            subject: `Collections follow-up started for ${currentCase.id}`,
            category: "Billing",
            priority: tenant?.subscription.status === "past_due" ? "High" : "Medium",
            owner: currentCase.owner,
            article: "Renewal and success workflow",
            slaHours: 12,
          }),
        }
        : nextStatus === "Promised"
          ? {
            tenantHandoffs: appendTenantHandoff(workspace, {
              school: currentCase.school,
              owner: "Portfolio desk",
              reason: `Payment promise recorded on ${currentCase.id}; track renewal confidence`,
              status: "In progress",
            }),
          }
          : nextStatus === "Resolved"
            ? {
              supportTickets: appendSupportTicket(workspace, {
                tenantId: currentCase.tenantId,
                tenantName: currentCase.school,
                subject: `Confirm recovery outcome for ${currentCase.id}`,
                category: "Customer Success",
                priority: "Medium",
                owner: "Portfolio desk",
                article: "Renewal and success workflow",
                slaHours: 24,
              }),
            }
            : {};
    saveWorkspace.mutate({
      revenueCases: nextCases,
      ...downstreamPatch,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: currentCase.school,
        area: "Billing",
        severity: nextStatus === "Resolved" ? "Info" : "Warning",
        action: `Moved revenue case ${currentCase.id} from ${currentCase.status} to ${nextStatus}`,
      }),
    });
    toast.success("Revenue case updated");
  };

  const runDunning = () => {
    const nextCases = cases.map((item) => item.status === "Scheduled" ? { ...item, status: "In progress", nextAction: "Reminder sent" } : item);
    const affected = cases.filter((item) => item.status === "Scheduled").length;
    saveWorkspace.mutate({
      revenueCases: nextCases,
      ...(affected > 0
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: "platform-revenue",
            tenantName: "Revenue operations",
            subject: `Follow up ${affected} dunning case${affected === 1 ? "" : "s"} after reminder run`,
            category: "Billing",
            priority: "High",
            owner: "Finance ops",
            article: "Renewal and success workflow",
            slaHours: 8,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        severity: affected > 0 ? "Warning" : "Info",
        action: affected > 0
          ? `Triggered dunning run for ${affected} scheduled collection case${affected === 1 ? "" : "s"}`
          : "Triggered dunning run with no scheduled collection cases",
      }),
    });
    toast.success("Dunning run triggered");
  };

  const exportForecast = () => {
    saveWorkspace.mutate({
      exportJobs: appendExportJob(workspace, {
        school: "Platform",
        scope: "Revenue forecast workbook",
        requestedBy: user?.name ?? "System Administrator",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        action: "Queued revenue forecast export",
      }),
    });
    downloadCsv(portfolio.map((record) => ({ School: record.tenant.name, Plan: PLAN_CATALOG[record.tenant.subscription.planId].name, Status: record.tenant.subscription.status, MRR: record.tenant.subscription.amount, "Learner %": record.learnerPct, "Campus %": record.campusPct, "Renewal Date": record.tenant.subscription.renewalDate, "Days to Renewal": record.daysToRenewal, Risk: record.risk })), "revenue-forecast");
    toast.success("Forecast export queued");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Ops"
        description="Monitor MRR, renewals, collections, expansion signals, and portfolio-level revenue risk across subscribed schools."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/billing">Open billing</Button>
            <Button onClick={runDunning} startIcon={<RefreshCw className="h-4 w-4" />}>
              Run dunning
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly recurring revenue" value={`K${mrr.toLocaleString()}`} accent="primary" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Annual recurring revenue" value={`K${arr.toLocaleString()}`} accent="success" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Revenue at risk" value={`K${atRiskRevenue.toLocaleString()}`} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="60-day renewals" value={`K${renewalsWindow.toLocaleString()}`} accent="accent" icon={<CreditCard className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="portfolio" label="Portfolio" />
        <Tab value="forecast" label="Forecast" />
        <Tab value="collections" label="Collections" />
      </Tabs>

      {tab === "portfolio" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>MRR</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell>Renewal</TableCell>
                <TableCell>Risk</TableCell>
                <TableCell className="text-right">Expansion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {portfolio.map((record) => (
                <TableRow key={record.tenant.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{record.tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{record.tenant.campuses.length} campuses · {record.tenant.totalStudents} learners</p>
                    </div>
                  </TableCell>
                  <TableCell>{PLAN_CATALOG[record.tenant.subscription.planId].name}</TableCell>
                  <TableCell className="capitalize">{record.tenant.subscription.status.replace("_", " ")}</TableCell>
                  <TableCell className="font-medium">K{record.tenant.subscription.amount.toLocaleString()}</TableCell>
                  <TableCell className="w-48">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>{record.learnerPct}% learners</span>
                        <span className="text-muted-foreground">{record.campusPct}% campuses</span>
                      </div>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(record.learnerPct, record.campusPct)}
                        sx={{ height: 8, borderRadius: 999 }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{record.tenant.subscription.renewalDate}</p>
                      <p className="text-xs text-muted-foreground">{record.daysToRenewal} days</p>
                    </div>
                  </TableCell>
                  <TableCell><Chip size="small" label={record.risk} sx={badgeSx(riskTone(record.risk))} /></TableCell>
                  <TableCell className="text-right">
                    {record.expansion ? (
                      <Button size="small" variant="outlined" component={Link} to="/plan-catalog">Upsell path</Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Stable</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "forecast" && (
        <Box className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Renewal concentration</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "0-30 days", value: portfolio.filter((record) => record.daysToRenewal <= 30).reduce((sum, record) => sum + record.tenant.subscription.amount, 0) },
                { label: "31-60 days", value: portfolio.filter((record) => record.daysToRenewal > 30 && record.daysToRenewal <= 60).reduce((sum, record) => sum + record.tenant.subscription.amount, 0) },
                { label: "61-90 days", value: portfolio.filter((record) => record.daysToRenewal > 60 && record.daysToRenewal <= 90).reduce((sum, record) => sum + record.tenant.subscription.amount, 0) },
              ].map((bucket) => (
                <div key={bucket.label} className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
                  <p className="mt-2 text-2xl font-semibold">K{bucket.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Plan mix</p>
            <div className="mt-4 space-y-3">
              {Object.keys(PLAN_CATALOG).map((planId) => {
                const count = portfolio.filter((record) => record.tenant.subscription.planId === planId).length;
                return (
                  <div key={planId} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span>{PLAN_CATALOG[planId as keyof typeof PLAN_CATALOG].name}</span>
                    <Chip size="small" label={`${count} schools`} sx={badgeSx("outline")} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Actions</p>
            <div className="mt-4 space-y-3">
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/tenant-success">Review health-driven renewals</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/plan-catalog">Review pricing and offers</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} onClick={exportForecast} startIcon={<Download className="h-4 w-4" />}>
                Export forecast
              </Button>
            </div>
          </div>
        </Box>
      )}

      {tab === "collections" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Case</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next action</TableCell>
                <TableCell className="text-right">Update</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.school}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell className="font-medium">K{item.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={badgeSx(item.status === "Resolved" ? "success" : item.status === "Promised" ? "default" : "warning")}
                    />
                  </TableCell>
                  <TableCell>{item.nextAction}</TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" disabled={item.status === "Resolved"} onClick={() => advanceCase(item.id)}>
                      {item.status === "Scheduled" ? "Start" : item.status === "In progress" ? "Promise" : item.status === "Promised" ? "Resolve" : "Closed"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}
    </div>
  );
}
