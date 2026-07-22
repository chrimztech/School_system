import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendExportJob, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx } from "@/lib/utils";

type ApprovalType = "Discount" | "Deletion" | "Plan exception" | "Partner onboarding" | "Contract redline";
type ApprovalStatus = "Pending" | "Escalated" | "Approved" | "Rejected";

type ApprovalItem = {
  id: string;
  type: ApprovalType;
  requester: string;
  school: string;
  summary: string;
  submittedAt: string;
  status: ApprovalStatus;
};

export const Route = createFileRoute("/approval-center")({
  head: () => ({ meta: [{ title: "Approval Center - SRMS" }] }),
  component: ApprovalCenterPage,
});

function ApprovalCenterPage() {
  const [tab, setTab] = useState("queue");
  const { user } = useAuth();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const items = (workspace?.approvalItems ?? []) as ApprovalItem[];
  const policies = workspace?.approvalPolicies ?? {
    discountApproval: true,
    deletionDualControl: true,
    contractLegalReview: true,
    partnerTierReview: true,
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

  const pending = items.filter((item) => item.status === "Pending" || item.status === "Escalated");
  const completed = items.filter((item) => item.status === "Approved" || item.status === "Rejected");

  const stats = useMemo(() => ({
    pending: pending.length,
    escalated: items.filter((item) => item.status === "Escalated").length,
    completed: completed.length,
    policies: Object.values(policies).filter(Boolean).length,
  }), [completed.length, items, pending.length, policies]);

  const updateStatus = (id: string, status: ApprovalStatus) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const nextItems = items.map((item) => (item.id === id ? { ...item, status } : item));
    const downstreamPatch =
      status === "Approved" && (item.type === "Discount" || item.type === "Plan exception")
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: `approval-${item.id}`,
            tenantName: item.school,
            subject: `Apply approved ${item.type.toLowerCase()} for ${item.school}`,
            category: "Commercial",
            priority: "Medium",
            owner: item.type === "Discount" ? "Finance ops" : "Platform desk",
            article: "Plan packaging guide",
            slaHours: 12,
          }),
        }
        : status === "Approved" && item.type === "Deletion"
          ? {
            exportJobs: appendExportJob(workspace, {
              school: item.school,
              scope: `Deletion evidence pack for ${item.id}`,
              requestedBy: user?.name ?? "System Administrator",
            }),
            supportTickets: appendSupportTicket(workspace, {
              tenantId: `approval-${item.id}`,
              tenantName: item.school,
              subject: `Execute approved deletion workflow ${item.id}`,
              category: "Governance",
              priority: "High",
              owner: "Platform desk",
              article: "General knowledge base",
              slaHours: 8,
            }),
          }
          : status === "Approved" && item.type === "Partner onboarding"
            ? {
              tenantHandoffs: appendTenantHandoff(workspace, {
                school: item.school,
                owner: "Platform enablement",
                reason: `Approved partner onboarding request ${item.id}`,
                status: "Queued",
              }),
            }
            : status === "Approved" && item.type === "Contract redline"
              ? {
                supportTickets: appendSupportTicket(workspace, {
                  tenantId: `approval-${item.id}`,
                  tenantName: item.school,
                  subject: `Issue revised contract after approval ${item.id}`,
                  category: "Commercial",
                  priority: "Medium",
                  owner: "Legal desk",
                  article: "General knowledge base",
                  slaHours: 24,
                }),
              }
              : status === "Escalated"
                ? {
                  supportTickets: appendSupportTicket(workspace, {
                    tenantId: `approval-${item.id}`,
                    tenantName: item.school,
                    subject: `Escalated approval decision required for ${item.id}`,
                    category: "Operations",
                    priority: "High",
                    owner: "Platform desk",
                    article: "General knowledge base",
                    slaHours: 6,
                  }),
                }
                : {};
    saveWorkspace.mutate({
      approvalItems: nextItems,
      ...downstreamPatch,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: item.school,
        area: "Operations",
        severity: status === "Rejected" || status === "Escalated" ? "Warning" : "Info",
        action: `${status} approval ${item.id} for ${item.type.toLowerCase()} request`,
      }),
    });
    toast.success(`Approval ${status.toLowerCase()}`);
  };

  const updatePolicy = (key: keyof typeof policies, value: boolean) => {
    saveWorkspace.mutate({
      approvalPolicies: {
        ...policies,
        [key]: value,
      },
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `${value ? "Enabled" : "Disabled"} approval policy ${key}`,
      }),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Center"
        description="Run platform-level approvals for pricing exceptions, data actions, partner tiers, contracts, and policy-controlled changes."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/contract-center">
              Open contract center
            </Button>
            <Button variant="contained" component={Link} to="/data-governance">
              Open data governance
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending approvals" value={stats.pending} accent="warning" icon={<Clock3 className="h-4 w-4" />} />
        <StatCard label="Escalated items" value={stats.escalated} accent="destructive" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Completed today" value={stats.completed} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Active policies" value={stats.policies} accent="accent" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="queue" label="Queue" />
        <Tab value="policies" label="Policies" />
        <Tab value="completed" label="Completed" />
      </Tabs>

      {tab === "queue" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Requester</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pending.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.school}</p>
                      <p className="text-xs text-muted-foreground">{item.id} · {item.summary}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.requester}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.submittedAt}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={badgeSx(item.status === "Escalated" ? "destructive" : "warning")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="small" variant="outlined" onClick={() => updateStatus(item.id, "Approved")}>Approve</Button>
                      <Button size="small" variant="outlined" onClick={() => updateStatus(item.id, item.status === "Escalated" ? "Rejected" : "Escalated")}>
                        {item.status === "Escalated" ? "Reject" : "Escalate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "policies" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          {[
            { key: "discountApproval", label: "Discounts above plan list price require approval" },
            { key: "deletionDualControl", label: "Deletion requests require dual control" },
            { key: "contractLegalReview", label: "Contract redlines require legal review" },
            { key: "partnerTierReview", label: "Strategic partner promotions require review" },
          ].map((policy) => (
            <div key={policy.key} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{policy.label}</p>
                <Switch
                  checked={policies[policy.key as keyof typeof policies]}
                  onChange={(e) => updatePolicy(policy.key as keyof typeof policies, e.target.checked)}
                />
              </div>
            </div>
          ))}
        </Box>
      )}

      {tab === "completed" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Request</TableCell>
                <TableCell>Outcome</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Submitted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {completed.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.school}</p>
                      <p className="text-xs text-muted-foreground">{item.summary}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status === "Approved" ? "Approved" : "Rejected"}
                      sx={badgeSx(item.status === "Approved" ? "success" : "destructive")}
                    />
                  </TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.submittedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}
      </Box>
    </div>
  );
}
