import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, AlertTriangle, Lock, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Security — SRMS" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security operations"
        description="Manage access, incident signals and platform security posture from one secure operations dashboard."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/risk-register">Risk register</Link></Button>
            <Button onClick={() => toast.success("Security assessment scheduled")}>Run security assessment</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Policy coverage" value="—" accent="primary" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="MFA adoption" value="—" accent="success" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Incident response" value="—" hint="Mean time to respond" accent="warning" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Identity reviews" value="—" accent="accent" icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Risk alerts</h2>
              <p className="text-xs text-muted-foreground">Top security incidents requiring attention.</p>
            </div>
          </div>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Access controls</h2>
              <p className="text-xs text-muted-foreground">Review current protective workflows.</p>
            </div>
            <Badge variant="secondary">Identity</Badge>
          </div>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <Lock className="h-4 w-4" />
            Password hygiene
          </div>
          <p className="mt-3 text-sm text-muted-foreground">90% of active accounts have MFA and password policies are enforced.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" asChild><Link to="/policy-library">Review password policy</Link></Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <UserCheck className="h-4 w-4" />
            Role privileges
          </div>
          <p className="mt-3 text-sm text-muted-foreground">User privileges are aligned to current school and finance roles.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" asChild><Link to="/access">Audit role assignments</Link></Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4" />
            Incident readiness
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Incident playbooks are available for data breach, fraud, and safety events.</p>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="outline" asChild><Link to="/incident-management">Open response centre</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
