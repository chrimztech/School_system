import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Building2, LifeBuoy, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { PLAN_CATALOG, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

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
            <Button variant="outline" asChild>
              <Link to="/tenant-success">Open tenant success</Link>
            </Button>
            <Button asChild>
              <Link to="/support-desk">Open support desk</Link>
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tenants" value={stats.totalTenants} accent="primary" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Trial schools" value={stats.trials} accent="warning" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="Past due" value={stats.pastDue} accent="destructive" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Open handoffs" value={stats.handoffs} accent="accent" icon={<LifeBuoy className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenant Directory</TabsTrigger>
          <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
          <TabsTrigger value="tools">Access Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campuses</TableHead>
                <TableHead>Students</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                      <Button size="sm" variant="outline" onClick={() => openWorkspace(tenant.id, "/")}>Open workspace</Button>
                      <Button size="sm" variant="outline" onClick={() => openWorkspace(tenant.id, "/billing")}>Billing</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="handoffs" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Advance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {handoffs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.school}</TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.reason}</TableCell>
                  <TableCell>
                    <Badge className={item.status === "Ready" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : item.status === "In progress" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={item.status === "Ready"} onClick={() => advanceHandoff(item.id)}>
                      {item.status === "Queued" ? "Start" : item.status === "In progress" ? "Ready" : "Closed"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tools" className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Support tools</p>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/support-desk">Open support desk</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/approval-center">Open approval center</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Lifecycle tools</p>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/tenant-lifecycle">Open lifecycle</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/contract-center">Open contracts</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="font-semibold">Platform tools</p>
            <div className="mt-4 space-y-3">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/platform-ops">Open platform ops</Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link to="/developer-console">Open developer console</Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
