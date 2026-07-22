import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, LifeBuoy, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";

import { Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { PLAN_CATALOG, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx } from "@/lib/utils";

type HandoffStatus = "Queued" | "In progress" | "Ready";
type HandoffRecord = {
  id: string;
  school: string;
  owner: string;
  reason: string;
  status: HandoffStatus;
};

export const Route = createFileRoute("/tenant-workbench")({
  head: () => ({ meta: [{ title: "Tenant Workbench - SRMS" }] }),
  component: TenantWorkbenchPage,
});

function TenantWorkbenchPage() {
  const { user } = useAuth();
  const { tenants, setActive } = useTenant();
  const navigate = useNavigate();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const handoffs = (workspace?.tenantHandoffs ?? []) as HandoffRecord[];
  const [tab, setTab] = useState("tenants");

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
    totalTenants: tenants.length,
    trials: tenants.filter((tenant) => tenant.subscription.status === "trial").length,
    pastDue: tenants.filter((tenant) => tenant.subscription.status === "past_due").length,
    handoffs: handoffs.filter((item) => item.status !== "Ready").length,
  }), [handoffs, tenants]);

  const openWorkspace = (tenantId: string, destination: "/" | "/billing" | "/support-desk") => {
    const tenant = tenants.find((item) => item.id === tenantId);
    setActive(tenantId);
    saveWorkspace.mutate({
      ...(destination === "/support-desk"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId,
            tenantName: tenant?.name ?? tenantId,
            subject: "Operator switched into tenant support context",
            category: "Support",
            priority: "Medium",
            owner: "Platform desk",
            article: "General knowledge base",
            slaHours: 12,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: tenant?.name ?? tenantId,
        area: "Access",
        action: `Switched into tenant workspace and opened ${destination}`,
      }),
    });
    toast.success("Tenant context switched");
    navigate({ to: destination });
  };

  const advanceHandoff = (id: string) => {
    const handoff = handoffs.find((item) => item.id === id);
    if (!handoff) return;
    let nextStatus: HandoffStatus = handoff.status;
    const nextHandoffs = handoffs.map((item) => {
      if (item.id !== id) return item;
      const status: HandoffStatus = item.status === "Queued" ? "In progress" : "Ready";
      nextStatus = status;
      return { ...item, status };
    });
    saveWorkspace.mutate({
      tenantHandoffs: nextHandoffs,
      ...(nextStatus === "Ready"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: handoff.id,
            tenantName: handoff.school,
            subject: `Confirm closure of handoff ${handoff.id}`,
            category: "Lifecycle",
            priority: "Medium",
            owner: handoff.owner,
            article: "Renewal and success workflow",
            slaHours: 24,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: handoff.school,
        area: "Lifecycle",
        action: `Moved tenant handoff ${handoff.id} from ${handoff.status} to ${nextStatus}`,
      }),
    });
    toast.success("Handoff updated");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Workbench"
        description="Use a shared operator workbench to jump into tenant context, run support actions, and coordinate platform handoffs."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/tenant-success">Open tenant success</Button>
            <Button component={Link} to="/support-desk">Open support desk</Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tenants" value={stats.totalTenants} accent="primary" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Trial schools" value={stats.trials} accent="warning" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Past due" value={stats.pastDue} accent="destructive" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Open handoffs" value={stats.handoffs} accent="accent" icon={<LifeBuoy className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="tenants" label="Tenant Directory" />
        <Tab value="handoffs" label="Handoffs" />
        <Tab value="tools" label="Access Tools" />
      </Tabs>

      {tab === "tenants" && (
        <div className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Campuses</TableCell>
                <TableCell>Students</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground">{tenant.district}</p>
                    </div>
                  </TableCell>
                  <TableCell>{PLAN_CATALOG[tenant.subscription.planId].name}</TableCell>
                  <TableCell className="capitalize">{tenant.subscription.status.replace("_", " ")}</TableCell>
                  <TableCell>{tenant.campuses.length}</TableCell>
                  <TableCell>{tenant.totalStudents}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="small" variant="outlined" onClick={() => openWorkspace(tenant.id, "/")}>Open workspace</Button>
                      <Button size="small" variant="outlined" onClick={() => openWorkspace(tenant.id, "/billing")}>Billing</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {tab === "handoffs" && (
        <div className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Advance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {handoffs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.school}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.reason}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={badgeSx(item.status === "Ready" ? "success" : item.status === "In progress" ? "default" : "warning")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" disabled={item.status === "Ready"} onClick={() => advanceHandoff(item.id)}>
                      {item.status === "Queued" ? "Start" : item.status === "In progress" ? "Ready" : "Closed"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {tab === "tools" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Support tools</p>
            <div className="mt-4 space-y-3">
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/support-desk">Open support desk</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/approval-center">Open approval center</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Lifecycle tools</p>
            <div className="mt-4 space-y-3">
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/tenant-lifecycle">Open lifecycle</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/contract-center">Open contracts</Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Platform tools</p>
            <div className="mt-4 space-y-3">
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/platform-ops">Open platform ops</Button>
              <Button sx={{ width: "100%", justifyContent: "flex-start" }} variant="outlined" component={Link} to="/developer-console">Open developer console</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
