import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendExportJob, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

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
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
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
            <Button variant="outline" asChild>
              <Link to="/contract-center">Open contract center</Link>
            </Button>
            <Button asChild>
              <Link to="/data-governance">Open data governance</Link>
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

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Badge className={item.status === "Escalated" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "Approved")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, item.status === "Escalated" ? "Rejected" : "Escalated")}>
                        {item.status === "Escalated" ? "Reject" : "Escalate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="policies" className="grid gap-4 lg:grid-cols-2">
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
                  onCheckedChange={(value) => updatePolicy(policy.key as keyof typeof policies, value)}
                />
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Badge className={item.status === "Approved" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"}>
                      {item.status === "Approved" ? "Approved" : "Rejected"}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.submittedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
