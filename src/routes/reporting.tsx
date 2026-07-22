import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Clock3, Database, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import { Box, Button, MenuItem, Paper, Stack, TextField, Tooltip, Typography, alpha, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { api } from "@/lib/api";
import { useTenant } from "@/lib/tenant";
import { badgeSx } from "@/lib/utils";

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
  const scheduleBreakdown = Object.entries(mostCommonSchedule).sort((a, b) => b[1] - a[1]);
  const maxScheduleCount = Math.max(1, ...scheduleBreakdown.map(([, count]) => count));
  const draftReports = reports.length - activeReports;
  const activeRatePct = reports.length > 0 ? Math.round((activeReports / reports.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporting & BI"
        description="Create, schedule, and manage institutional reports with self-service analytics and export tools."
        actions={
          <>
          <Button variant="contained" onClick={() => setOpen(true)}>Build new report</Button>
          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Create scheduled report</DialogTitle>
            <DialogContent>
              <div className="grid gap-3">
                <TextField
                  label="Report name *"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Board governance pack"
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Owner"
                  value={form.owner}
                  onChange={(event) => setForm({ ...form, owner: event.target.value })}
                  fullWidth
                  size="small"
                >
                  {["Admin", "Finance", "Academic", "HR"].map((owner) => (
                    <MenuItem key={owner} value={owner}>{owner}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Schedule"
                  value={form.schedule}
                  onChange={(event) => setForm({ ...form, schedule: event.target.value })}
                  fullWidth
                  size="small"
                >
                  {["Daily", "Weekly", "Monthly", "Quarterly"].map((schedule) => (
                    <MenuItem key={schedule} value={schedule}>{schedule}</MenuItem>
                  ))}
                </TextField>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={addReport} disabled={createReportMutation.isPending}>Create report</Button>
            </DialogActions>
          </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scheduled reports" value={reports.length} hint="Saved in database" accent="primary" icon={<Clock3 className="h-4 w-4" />} />
        <StatCard label="Active reports" value={activeReports} hint="Published schedules" accent="accent" icon={<Database className="h-4 w-4" />} />
        <StatCard label="Report owners" value={distinctOwners} hint="Distinct teams" accent="success" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Draft reports" value={reports.filter((report) => report.status === "Draft").length} hint="Needs review" accent="warning" icon={<Settings2 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4, gridColumn: { lg: "span 2" } }}>
          <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Scheduling snapshot</Typography>
              <Typography variant="caption" color="text.secondary">
                Saved reports by cadence — {topSchedule} is the most common.
              </Typography>
            </Box>
            <Chip size="small" label="Live" sx={badgeSx("secondary")} />
          </Stack>

          {scheduleBreakdown.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No scheduled reports yet.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {scheduleBreakdown.map(([schedule, count]) => {
                const widthPct = Math.max(4, (count / maxScheduleCount) * 100);
                const isTop = schedule === topSchedule;
                return (
                  <Box key={schedule}>
                    <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: isTop ? 600 : 500, color: "text.primary" }}>
                        {schedule}
                      </Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary", fontVariantNumeric: "tabular-nums" }}>
                        {count}
                      </Typography>
                    </Stack>
                    <Tooltip title={`${schedule}: ${count} report${count === 1 ? "" : "s"}`} placement="top" arrow>
                      <Box sx={{ height: 10, borderRadius: 999, bgcolor: alpha("#2370bd", 0.14), overflow: "hidden" }}>
                        <Box
                          sx={{
                            height: "100%",
                            width: `${widthPct}%`,
                            borderRadius: 999,
                            bgcolor: "#2370bd",
                            transition: "width 300ms ease",
                          }}
                        />
                      </Box>
                    </Tooltip>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
          <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Coverage</Typography>
              <Typography variant="caption" color="text.secondary">
                Share of saved reports that are active.
              </Typography>
            </Box>
            <Chip size="small" label={reports.length === 0 ? "Empty" : "Tracked"} sx={badgeSx("outline")} />
          </Stack>

          <Typography sx={{ fontSize: 34, fontWeight: 600, lineHeight: 1, color: "text.primary" }}>
            {activeRatePct}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {activeReports} of {reports.length || 0} reports active
          </Typography>

          <Tooltip title={`${activeRatePct}% active`} placement="top" arrow>
            <Box sx={{ mt: 2, height: 10, borderRadius: 999, bgcolor: alpha("#40ae67", 0.16), overflow: "hidden" }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${activeRatePct}%`,
                  borderRadius: 999,
                  bgcolor: "#40ae67",
                  transition: "width 300ms ease",
                }}
              />
            </Box>
          </Tooltip>

          <Stack direction="row" spacing={2.5} sx={{ mt: 2.5 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Box sx={{ height: 8, width: 8, borderRadius: "50%", bgcolor: "#40ae67" }} />
              <Typography variant="caption" color="text.secondary">Active ({activeReports})</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Box sx={{ height: 8, width: 8, borderRadius: "50%", bgcolor: alpha("#40ae67", 0.16) }} />
              <Typography variant="caption" color="text.secondary">Draft ({draftReports})</Typography>
            </Stack>
          </Stack>
        </Paper>
      </div>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 4 }}>
        <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Saved reports</Typography>
            <Typography variant="caption" color="text.secondary">
              Manage report templates and schedules.
            </Typography>
          </Box>
          <Chip size="small" label={`${reports.length} total`} sx={badgeSx("outline")} />
        </Stack>
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Report</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
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
                  <Chip size="small" label={report.status} sx={badgeSx(report.status === "Active" ? "secondary" : "outline")} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </Paper>
    </div>
  );
}
