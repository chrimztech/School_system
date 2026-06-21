import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Clock3, Database, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useTenant } from "@/lib/tenant";

type SavedReport = {
  id: string;
  name: string;
  schedule: string;
  owner: string;
  status: "Active" | "Draft";
};

export const Route = createFileRoute("/reporting")({
  head: () => ({ meta: [{ title: "Reporting - SRMS" }] }),
  component: ReportingPage,
});

function ReportingPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", owner: "Admin", schedule: "Weekly" });

  const { data: reportsRaw = [], isLoading } = useQuery({
    queryKey: ["saved-reports", schoolId],
    queryFn: () => api.reporting.list(schoolId),
  });

  const createReportMutation = useMutation({
    mutationFn: (data: any) => api.reporting.create(schoolId, data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["saved-reports", schoolId] });
      toast.success(`${vars.name} added to the report library`);
      setForm({ name: "", owner: "Admin", schedule: "Weekly" });
      setOpen(false);
    },
    onError: () => toast.error("Failed to create report"),
  });

  const reports: SavedReport[] = (reportsRaw as any[]).map((report) => ({
    id: report.id,
    name: report.name ?? "Untitled report",
    schedule: report.schedule ?? "Unscheduled",
    owner: report.owner ?? "Unassigned",
    status: (report.status ?? "Draft") as SavedReport["status"],
  }));

  const addReport = () => {
    if (!form.name.trim()) {
      toast.error("Report name is required");
      return;
    }

    createReportMutation.mutate({
      name: form.name.trim(),
      owner: form.owner,
      schedule: form.schedule,
      status: "Draft",
    });
  };

  const activeReports = reports.filter((report) => report.status === "Active").length;
  const distinctOwners = new Set(reports.map((report) => report.owner).filter(Boolean)).size;
  const mostCommonSchedule = reports.reduce<Record<string, number>>((counts, report) => {
    counts[report.schedule] = (counts[report.schedule] ?? 0) + 1;
    return counts;
  }, {});
  const topSchedule = Object.entries(mostCommonSchedule).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporting & BI"
        description="Create, schedule, and manage institutional reports with self-service analytics and export tools."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Build new report</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create scheduled report</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Report name *</Label>
                  <Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Board governance pack" />
                </div>
                <div>
                  <Label>Owner</Label>
                  <Select value={form.owner} onValueChange={(value) => setForm({ ...form, owner: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Admin", "Finance", "Academic", "HR"].map((owner) => (
                        <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Schedule</Label>
                  <Select value={form.schedule} onValueChange={(value) => setForm({ ...form, schedule: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Daily", "Weekly", "Monthly", "Quarterly"].map((schedule) => (
                        <SelectItem key={schedule} value={schedule}>{schedule}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addReport} disabled={createReportMutation.isPending}>Create report</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scheduled reports" value={reports.length} hint="Saved in database" accent="primary" icon={<Clock3 className="h-4 w-4" />} />
        <StatCard label="Active reports" value={activeReports} hint="Published schedules" accent="accent" icon={<Database className="h-4 w-4" />} />
        <StatCard label="Report owners" value={distinctOwners} hint="Distinct teams" accent="success" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Draft reports" value={reports.filter((report) => report.status === "Draft").length} hint="Needs review" accent="warning" icon={<Settings2 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Scheduling snapshot</h2>
              <p className="text-xs text-muted-foreground">Most common schedule currently saved for this school.</p>
            </div>
            <Badge variant="secondary">Live</Badge>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Top cadence</p>
            <p className="mt-1 text-lg font-semibold">{topSchedule}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Coverage</h2>
              <p className="text-xs text-muted-foreground">Current saved-report mix by status.</p>
            </div>
            <Badge variant="outline">{reports.length === 0 ? "Empty" : "Tracked"}</Badge>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="mt-1 text-sm font-medium">{activeReports}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Draft</p>
              <p className="mt-1 text-sm font-medium">{reports.filter((report) => report.status === "Draft").length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Saved reports</h2>
            <p className="text-xs text-muted-foreground">Manage report templates and schedules.</p>
          </div>
          <Badge variant="outline">{reports.length} total</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading reports...</TableCell></TableRow>
            ) : reports.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No saved reports found in the database.</TableCell></TableRow>
            ) : reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>{report.name}</TableCell>
                <TableCell>{report.schedule}</TableCell>
                <TableCell>{report.owner}</TableCell>
                <TableCell>
                  <Badge variant={report.status === "Active" ? "secondary" : "outline"}>{report.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
