import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ShieldCheck, FileSearch } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/compliance")({
  head: () => ({ meta: [{ title: "Compliance — SRMS" }] }),
  component: CompliancePage,
});

function CompliancePage() {
  const { active } = useTenant();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["compliance", active.id],
    queryFn: () => api.compliance.list(active.id),
  });

  const compliantCount = (items as any[]).filter((i: any) => i.status === "Compliant").length;
  const totalCount = (items as any[]).length;
  const healthPct = totalCount ? Math.round((compliantCount / totalCount) * 100) : 87;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance management"
        description="Track policies, audits, regulatory readiness, and control status across your institution."
        actions={<Button asChild><Link to="/policy-library">Review compliance plan</Link></Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4" />
            Compliance health
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{healthPct}% of compliance controls are meeting their target schedule.</p>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/70 px-4 py-3">
              <p className="text-sm font-medium">Audit readiness</p>
              <Badge variant="secondary">Ready</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/70 px-4 py-3">
              <p className="text-sm font-medium">Policy coverage</p>
              <Badge variant="success">Strong</Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileSearch className="h-4 w-4" />
            Controls & approvals
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Review the most recent compliance control checks.</p>
          <div className="mt-5">
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ClipboardCheck className="h-4 w-4" />
            Compliance actions
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Maintain documentation, incident logs and policy approvals.</p>
          <div className="mt-5 space-y-3">
            <Button variant="outline" asChild><Link to="/policy-library">Open policy dashboard</Link></Button>
            <Button variant="outline" asChild><Link to="/audit">Start audit checklist</Link></Button>
            <Button variant="outline" asChild><Link to="/risk-register">Review risk register</Link></Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Regulatory status</h2>
            <p className="text-xs text-muted-foreground">Current status for key regulatory areas.</p>
          </div>
          <Badge variant="secondary">{isLoading ? "Loading…" : `${totalCount} items`}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (items as any[]).map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell className="text-muted-foreground">{item.owner}</TableCell>
                <TableCell className="text-muted-foreground">{item.dueDate || "—"}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "Compliant" ? "secondary" : item.status === "Action needed" ? "destructive" : "warning"}>{item.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
