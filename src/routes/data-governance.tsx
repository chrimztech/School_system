import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, HardDrive, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Box, Chip, Switch, Button, Tab, Tabs, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, downloadCsv } from "@/lib/utils";

type RequestType = "Access" | "Rectification" | "Deletion";
type RequestStatus = "New" | "Reviewing" | "Approved" | "Completed";
type DataRequest = {
  id: string;
  tenantId: string;
  school: string;
  subject: string;
  type: RequestType;
  status: RequestStatus;
  dueDate: string;
};

type ExportJob = {
  id: string;
  school: string;
  scope: string;
  status: "Queued" | "Running" | "Ready";
  requestedBy: string;
};

type RetentionRule = {
  id: string;
  domain: string;
  days: string;
  archive: boolean;
  legalHold: boolean;
};

export const Route = createFileRoute("/data-governance")({
  head: () => ({ meta: [{ title: "Data Governance - SRMS" }] }),
  component: DataGovernancePage,
});

function DataGovernancePage() {
  const [tab, setTab] = useState("requests");
  const { user } = useAuth();
  const { tenants } = useTenant();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const requests = (workspace?.dataRequests ?? []) as DataRequest[];
  const exports = (workspace?.exportJobs ?? []) as ExportJob[];
  const retention = (workspace?.retentionRules ?? []) as RetentionRule[];
  const residency = (workspace?.residencySettings ?? {
    regionLock: false,
    deleteAfterExport: false,
    maskedSandbox: false,
    residencyRegion: "",
  }) as {
    regionLock: boolean;
    deleteAfterExport: boolean;
    maskedSandbox: boolean;
    residencyRegion: string;
    [key: string]: unknown;
  };

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

  const stats = useMemo(() => ({
    openRequests: requests.filter((request) => request.status !== "Completed").length,
    activeExports: exports.filter((job) => job.status !== "Ready").length,
    archivedDomains: retention.filter((rule) => rule.archive).length,
    legalHolds: retention.filter((rule) => rule.legalHold).length,
  }), [exports, requests, retention]);

  const advanceRequest = (requestId: string) => {
    const request = requests.find((entry) => entry.id === requestId);
    if (!request) return;
    let nextStatus: RequestStatus = request.status;
    const nextRequests = requests.map((request) => {
      if (request.id !== requestId) return request;
      const status: RequestStatus =
        request.status === "New" ? "Reviewing" :
          request.status === "Reviewing" ? "Approved" :
            request.status === "Approved" ? "Completed" :
              "Completed";
      nextStatus = status;
      return { ...request, status };
    });
    const downstreamPatch =
      nextStatus === "Approved" && request.type === "Access"
        ? {
          exportJobs: appendExportJob(workspace, {
            school: request.school,
            scope: `Subject access export for ${request.subject}`,
            requestedBy: user?.name ?? "System Administrator",
          }),
        }
        : nextStatus === "Approved" && request.type === "Deletion"
          ? {
            approvalItems: appendApprovalItem(workspace, {
              type: "Deletion",
              requester: user?.name ?? "System Administrator",
              school: request.school,
              summary: `Execution approval for ${request.subject}`,
              status: "Pending",
            }),
          }
          : nextStatus === "Completed"
            ? {
              supportTickets: appendSupportTicket(workspace, {
                tenantId: request.tenantId,
                tenantName: request.school,
                subject: `Confirm delivery for ${request.type.toLowerCase()} request ${request.id}`,
                category: "Governance",
                priority: request.type === "Deletion" ? "High" : "Medium",
                owner: "Platform desk",
                article: "General knowledge base",
                slaHours: 12,
              }),
            }
            : {};
    saveWorkspace.mutate({
      dataRequests: nextRequests,
      ...downstreamPatch,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: request.school,
        area: "Operations",
        severity: request.type === "Deletion" ? "Warning" : "Info",
        action: `Moved ${request.type.toLowerCase()} request ${request.id} from ${request.status} to ${nextStatus}`,
      }),
    });
    toast.success("Data request advanced");
  };

  const queueExport = () => {
    saveWorkspace.mutate({
      exportJobs: appendExportJob(workspace, {
        school: tenants[0]?.name ?? "Platform tenant",
        scope: "Compliance evidence pack",
        requestedBy: user?.name ?? "System Administrator",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Queued governance compliance evidence export",
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-governance",
        tenantName: "Platform governance",
        subject: "Track compliance evidence export completion",
        category: "Governance",
        priority: "Medium",
        owner: "Platform desk",
        article: "General knowledge base",
        slaHours: 24,
      }),
    });
    downloadCsv(exports.map((job) => ({ ID: job.id, School: job.school, Scope: job.scope, Status: job.status, "Requested By": job.requestedBy })), "governance-export-jobs");
    toast.success("Export job queued");
  };

  const updateRule = (ruleId: string, patch: Partial<RetentionRule>) => {
    const nextRules = retention.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
    saveWorkspace.mutate({ retentionRules: nextRules });
  };

  const savePolicies = () => {
    saveWorkspace.mutate({
      retentionRules: retention,
      residencySettings: residency,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Saved governance retention and residency policy settings",
      }),
    });
    toast.success("Governance policies saved");
  };

  const runExportSweep = () => {
    let queuedToRunning = 0;
    let runningToReady = 0;
    const nextExports = exports.map((job) => ({
      ...job,
      status: job.status === "Queued"
        ? (() => {
          queuedToRunning += 1;
          return "Running";
        })()
        : job.status === "Running"
          ? (() => {
            runningToReady += 1;
            return "Ready";
          })()
          : "Ready",
    }));
    saveWorkspace.mutate({
      exportJobs: nextExports,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Ran export sweep (${queuedToRunning} queued to running, ${runningToReady} running to ready)`,
      }),
    });
    downloadCsv(nextExports.map((job) => ({ ID: job.id, School: job.school, Scope: job.scope, Status: job.status, "Requested By": job.requestedBy })), "governance-export-sweep");
    toast.success("Export sweep executed");
  };

  const reviewDeletionQueue = () => {
    saveWorkspace.mutate({
      approvalItems: appendApprovalItem(workspace, {
        type: "Deletion",
        requester: user?.name ?? "System Administrator",
        school: "Platform governance",
        summary: "Review pending deletion safeguards and protected dataset queue",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Queued deletion safeguard review in approval center",
      }),
    });
    toast.warning("Deletion approval queue reviewed");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Governance"
        description="Manage cross-tenant privacy requests, export workflows, retention rules, and residency controls for the platform."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/compliance">
              Open compliance
            </Button>
            <Button variant="contained" startIcon={<Download size={16} />} onClick={queueExport}>
              Queue export
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open privacy requests" value={stats.openRequests} accent="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Active export jobs" value={stats.activeExports} accent="primary" icon={<Download className="h-4 w-4" />} />
        <StatCard label="Archived domains" value={stats.archivedDomains} accent="success" icon={<HardDrive className="h-4 w-4" />} />
        <StatCard label="Legal holds" value={stats.legalHolds} accent="accent" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="requests" label="Requests" />
        <Tab value="retention" label="Retention" />
        <Tab value="exports" label="Exports & Residency" />
      </Tabs>

      {tab === "requests" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>School</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.subject}</p>
                      <p className="text-xs text-muted-foreground">{request.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{request.school}</TableCell>
                  <TableCell>{request.type}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={request.status}
                      sx={badgeSx(request.status === "Completed" ? "success" : request.status === "Approved" ? "default" : "warning")}
                    />
                  </TableCell>
                  <TableCell>{request.dueDate}</TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" disabled={request.status === "Completed"} onClick={() => advanceRequest(request.id)}>
                      {request.status === "New" ? "Review" : request.status === "Reviewing" ? "Approve" : request.status === "Approved" ? "Complete" : "Closed"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "retention" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Retention schedule</p>
            <div className="mt-4 space-y-4">
              {retention.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{rule.domain}</p>
                      <p className="text-sm text-muted-foreground">Retention window in days</p>
                    </div>
                    <TextField size="small" className="w-28" value={rule.days} onChange={(event) => updateRule(rule.id, { days: event.target.value })} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.archive} onChange={(event) => updateRule(rule.id, { archive: event.target.checked })} />
                      <span className="text-sm">Archive after expiry</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.legalHold} onChange={(event) => updateRule(rule.id, { legalHold: event.target.checked })} />
                      <span className="text-sm">Legal hold eligible</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="contained" className="mt-5" onClick={savePolicies}>Save retention rules</Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Deletion safeguards</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Protected datasets</p>
                <p className="mt-2 text-sm">Billing records and audit logs remain preserved under legal hold and statutory policy.</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Temporary data</p>
                <p className="mt-2 text-sm">Sandbox exports and staging copies are cleared automatically after the retention window.</p>
              </div>
            </div>
            <Button fullWidth className="mt-5" variant="outlined" startIcon={<Trash2 size={16} />} onClick={reviewDeletionQueue}>
              Review deletion queue
            </Button>
          </div>
        </Box>
      )}

      {tab === "exports" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Export jobs</p>
              <Button size="small" variant="outlined" startIcon={<RefreshCw size={16} />} onClick={runExportSweep}>
                Run sweep
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {exports.map((job) => (
                <div key={job.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{job.school}</p>
                      <p className="text-sm text-muted-foreground">{job.scope}</p>
                    </div>
                    <Chip
                      size="small"
                      label={job.status}
                      sx={badgeSx(job.status === "Ready" ? "success" : job.status === "Running" ? "default" : "warning")}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{job.id} · requested by {job.requestedBy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Residency controls</p>
            <div className="mt-4 grid gap-4">
              <TextField
                label="Regional residency policy"
                fullWidth
                size="small"
                value={residency.residencyRegion}
                onChange={(event) => saveWorkspace.mutate({ residencySettings: { ...residency, residencyRegion: event.target.value } })}
              />
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Enforce region lock</p>
                  <p className="text-sm text-muted-foreground">Prevents cross-region storage for tenant data.</p>
                </div>
                <Switch
                  checked={residency.regionLock}
                  onChange={(event) => saveWorkspace.mutate({ residencySettings: { ...residency, regionLock: event.target.checked } })}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Delete exports after download</p>
                  <p className="text-sm text-muted-foreground">Clears temporary export artifacts automatically.</p>
                </div>
                <Switch
                  checked={residency.deleteAfterExport}
                  onChange={(event) => saveWorkspace.mutate({ residencySettings: { ...residency, deleteAfterExport: event.target.checked } })}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Mask sandbox data</p>
                  <p className="text-sm text-muted-foreground">Uses redacted copies for staging and training environments.</p>
                </div>
                <Switch
                  checked={residency.maskedSandbox}
                  onChange={(event) => saveWorkspace.mutate({ residencySettings: { ...residency, maskedSandbox: event.target.checked } })}
                />
              </div>
            </div>
            <Button variant="contained" className="mt-5" onClick={savePolicies}>Save residency policy</Button>
          </div>
        </Box>
      )}
      </Box>
    </div>
  );
}
