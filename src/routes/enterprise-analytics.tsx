import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/enterprise-analytics")({
  head: () => ({ meta: [{ title: "Enterprise Analytics — SRMS" }] }),
  component: EnterpriseAnalyticsPage,
});

function EnterpriseAnalyticsPage() {
  const { active: school } = useTenant();

  const { data: students = [] } = useQuery({ queryKey: ["students", school.id], queryFn: () => api.students.list(school.id), retry: false });
  const { data: staff = [] } = useQuery({ queryKey: ["hr-staff", school.id], queryFn: () => api.hr.staff(school.id), retry: false });
  const { data: feesData } = useQuery({ queryKey: ["fees-collected", school.id], queryFn: () => api.fees.collected(school.id), retry: false });
  const { data: complianceItems = [] } = useQuery({ queryKey: ["compliance", school.id], queryFn: () => api.compliance.list(school.id), retry: false });

  const totalStudents = (students as any[]).length;
  const totalStaff = (staff as any[]).length;
  const feesCollected = feesData ? `K ${(feesData.collected / 1000).toFixed(0)}K` : "—";
  const compliantCount = (complianceItems as any[]).filter((c: any) => c.status === "Compliant").length;
  const compliancePct = (complianceItems as any[]).length > 0 ? `${Math.round((compliantCount / (complianceItems as any[]).length) * 100)}%` : "—";

  const liveMetrics = [
    { label: "Total learners", value: totalStudents || "—", hint: `Enrolled this year`, accent: "primary" },
    { label: "Active staff", value: totalStaff || "—", hint: "HR staff on record", accent: "success" },
    { label: "Fees collected", value: feesCollected, hint: "Current term", accent: "accent" },
    { label: "Compliance health", value: compliancePct, hint: "Items compliant", accent: "success" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise analytics"
        description="Executive scorecards, spend management, risk signals and operational efficiency across your campus network."
        actions={<Button onClick={() => toast.success("Executive brief export queued")}>Export executive brief</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {liveMetrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            hint={metric.hint}
            accent={metric.accent as any}
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Budget performance</h2>
              <p className="text-xs text-muted-foreground">Planned vs actual funding use</p>
            </div>
            <Badge variant="secondary">{school.type} network</Badge>
          </div>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Platform adoption</h2>
              <p className="text-xs text-muted-foreground">Daily user engagement trend</p>
            </div>
            <Badge variant="outline">Digital maturity</Badge>
          </div>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Current initiatives</h2>
            <p className="text-xs text-muted-foreground">High-impact programs driving outcomes.</p>
          </div>
          <Button variant="outline" onClick={() => toast.info("Strategy roadmap opened")}>Review roadmap</Button>
        </div>
        <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
      </div>
    </div>
  );
}
