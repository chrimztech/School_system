import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, AlertTriangle, Lock, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Security — SRMS" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const { active } = useTenant();

  const { data: riskItems = [] } = useQuery({ queryKey: ["risk-register", active.id], queryFn: () => api.riskRegister.list(active.id), retry: false });
  const { data: incidents = [] } = useQuery({ queryKey: ["incidents", active.id], queryFn: () => api.incidents.list(active.id), retry: false });
  const { data: complianceItems = [] } = useQuery({ queryKey: ["compliance", active.id], queryFn: () => api.compliance.list(active.id), retry: false });
  const { data: users = [] } = useQuery({ queryKey: ["users", active.id], queryFn: () => api.users.list(active.id), retry: false });

  const openRisks = (riskItems as any[]).filter((r: any) => (r.status ?? "").toLowerCase() === "open").length;
  const openIncidents = (incidents as any[]).filter((i: any) => (i.status ?? "").toLowerCase() !== "resolved").length;
  const compliantCount = (complianceItems as any[]).filter((c: any) => c.status === "Compliant").length;
  const compliancePct = (complianceItems as any[]).length > 0 ? Math.round((compliantCount / (complianceItems as any[]).length) * 100) : 0;

  return (
    <AccessGuard module="security">
      <div className="space-y-6">
      <PageHeader
        title="Security operations"
        description="Manage access, incident signals and platform security posture from one secure operations dashboard."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/risk-register">Risk register</Link></Button>
            <Button onClick={() => toast.info("Security assessment queued")}>Run security assessment</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Risk items open" value={openRisks} accent="warning" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Open incidents" value={openIncidents} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Compliance health" value={complianceItems.length > 0 ? `${compliancePct}%` : "—"} hint={complianceItems.length > 0 ? `${compliantCount}/${complianceItems.length} controls` : "Load data"} accent="primary" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Users on file" value={users.length} accent="accent" icon={<UserCheck className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Incidents</h2>
              <p className="text-xs text-muted-foreground">Security and safety incidents requiring attention.</p>
            </div>
            <Badge variant={openIncidents > 0 ? "destructive" : "secondary"}>{openIncidents} open</Badge>
          </div>
          {incidents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No incidents recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(incidents as any[]).slice(0, 10).map((inc: any) => (
                  <TableRow key={inc.id}>
                    <TableCell className="font-medium">{inc.title ?? inc.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={inc.severity === "High" ? "destructive" : inc.severity === "Medium" ? "warning" : "secondary"}>{inc.severity ?? "—"}</Badge>
                    </TableCell>
                    <TableCell>{inc.status ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{inc.incidentDate ?? inc.createdAt?.slice(0, 10)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Risk register</h2>
              <p className="text-xs text-muted-foreground">Top risks requiring mitigation.</p>
            </div>
            <Badge variant={openRisks > 0 ? "destructive" : "secondary"}>{openRisks} open</Badge>
          </div>
          {riskItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No risk items recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Likelihood</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(riskItems as any[]).slice(0, 10).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title ?? r.description ?? "—"}</TableCell>
                    <TableCell>{r.likelihood ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={(r.status ?? "").toLowerCase() === "open" ? "destructive" : "secondary"}>{r.status ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <Lock className="h-4 w-4" />
            Password hygiene
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{users.length} active accounts. Password policies and access controls are enforced server-side via JWT authentication.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" asChild><Link to="/policy-library">Review password policy</Link></Button>
            <Button variant="outline" asChild><Link to="/access">Audit role assignments</Link></Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <UserCheck className="h-4 w-4" />
            Role privileges
          </div>
          <p className="mt-3 text-sm text-muted-foreground">User privileges are aligned to current role-based access controls.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" asChild><Link to="/access">Review role assignments</Link></Button>
            <Button variant="outline" asChild><Link to="/user-management">Global user management</Link></Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4" />
            Incident readiness
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Incident playbooks available for data breach, fraud, and safety events.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" asChild><Link to="/incident-management">Open response centre</Link></Button>
            <Button variant="outline" asChild><Link to="/audit">View audit log</Link></Button>
          </div>
        </div>
      </div>
    </div>
    </AccessGuard>
  );
}
