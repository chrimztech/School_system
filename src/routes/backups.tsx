import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HardDrive, Download, ShieldAlert, Loader2, RotateCcw, Trash2, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { downloadCsv, badgeSx } from "@/lib/utils";
import { Button, Chip, IconButton, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText, Box, Tabs, Tab } from "@mui/material";

export const Route = createFileRoute("/backups")({
  head: () => ({ meta: [{ title: "Backups & Data - SRMS" }] }),
  component: BackupsPage,
});

const ADMIN_ROLES = new Set(["super_admin", "school_admin", "principal", "deputy_head"]);

type ExportItem = { id: string; scope: string; rows: number; when: string; dataset: string };

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function statusBadge(status: string) {
  if (status === "COMPLETED") {
    return <Chip size="small" icon={<CheckCircle2 size={12} />} label="Completed" sx={badgeSx("success")} />;
  }
  if (status === "FAILED") {
    return <Chip size="small" icon={<XCircle size={12} />} label="Failed" sx={badgeSx("destructive")} />;
  }
  return <Chip size="small" icon={<Clock size={12} />} label="In progress" sx={badgeSx("outline")} />;
}

function BackupsPage() {
  const { user } = useAuth();
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState("snapshots");
  const [exports, setExports] = useState<ExportItem[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportForm, setExportForm] = useState({ dataset: "Student register", format: "CSV", rows: "842" });
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const canManage = !!user && ADMIN_ROLES.has(user.role);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backups", schoolId],
    queryFn: () => api.backup.list(schoolId),
    enabled: !!schoolId && canManage,
    refetchInterval: (query) =>
      (query.state.data as any[] | undefined)?.some((b) => b.status === "IN_PROGRESS") ? 3000 : false,
  });

  const createMut = useMutation({
    mutationFn: () => api.backup.create(schoolId),
    onSuccess: () => {
      toast.success("Backup started");
      void qc.invalidateQueries({ queryKey: ["backups", schoolId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Backup failed to start"),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.backup.restore(schoolId, id),
    onSuccess: () => {
      toast.success("Restore complete");
      setRestoreTarget(null);
      void qc.invalidateQueries({ queryKey: ["backups", schoolId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Restore failed");
      setRestoreTarget(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.backup.remove(schoolId, id),
    onSuccess: () => {
      toast.success("Backup deleted");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["backups", schoolId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Delete failed");
      setDeleteTarget(null);
    },
  });

  const handleSnapshotDownload = async (backup: any) => {
    setDownloading(backup.id);
    try {
      await api.backup.download(schoolId, backup.id, backup.fileName ?? `backup-${backup.id}.json.gz`);
    } catch {
      toast.error("Download failed — please try again");
    } finally {
      setDownloading(null);
    }
  };

  const queueExport = () => {
    const rows = Number(exportForm.rows);
    if (!Number.isFinite(rows) || rows <= 0) {
      toast.error("Rows must be a positive number");
      return;
    }
    setExports((prev) => [
      { id: `e${prev.length + 1}`, scope: `${exportForm.dataset} (${exportForm.format})`, rows, when: "Ready", dataset: exportForm.dataset },
      ...prev,
    ]);
    toast.success(`${exportForm.dataset} export ready — click Download`);
    setExportForm({ dataset: "Student register", format: "CSV", rows: "842" });
    setExportOpen(false);
  };

  const handleDownload = async (item: ExportItem) => {
    setDownloading(item.id);
    const date = new Date().toISOString().slice(0, 10);
    const fname = `${item.dataset.toLowerCase().replace(/\s+/g, "-")}-${date}`;
    try {
      let rows: Record<string, unknown>[] = [];

      if (item.dataset === "Student register") {
        const data = await api.students.list(schoolId);
        rows = (data as any[]).map((s) => ({
          "ID": s.id, "First Name": s.firstName || "", "Last Name": s.lastName || "",
          "Class": s.className || s.class || s.currentClass || "",
          "Gender": s.gender || "", "Date of Birth": s.dateOfBirth || "",
          "Guardian Name": s.guardianName || s.parentName || "",
          "Guardian Phone": s.guardianPhone || s.parentPhone || "",
          "Status": s.status || "active",
        }));
      } else if (item.dataset === "Fee ledger") {
        const data = await api.fees.payments(schoolId);
        rows = (data as any[]).map((p) => ({
          "ID": p.id, "Student": p.studentName || p.student || "",
          "Amount": p.amount || 0, "Type": p.feeType || p.type || "",
          "Date": p.paidDate || p.date || "", "Method": p.paymentMethod || p.method || "",
          "Reference": p.reference || p.receiptNo || "", "Status": p.status || "",
        }));
      } else if (item.dataset === "Attendance archive") {
        const data = await api.attendance.list(schoolId);
        rows = (data as any[]).map((r) => ({
          "Date": r.date || "", "Student": r.studentName || r.student || "",
          "Class": r.className || r.class || "", "Status": r.status || "",
          "Remarks": r.remarks || "",
        }));
      } else if (item.dataset === "Audit log") {
        const data = await api.audit.list(schoolId);
        rows = (data as any[]).map((a) => ({
          "ID": a.id, "Action": a.action || a.title || "",
          "User": a.actor || a.user || a.performedBy || "",
          "Date": a.createdAt || a.date || "",
          "Details": a.target || a.details || a.description || "",
        }));
      }

      if (rows.length === 0) {
        toast.info("No records found for this dataset");
        return;
      }
      downloadCsv(rows, fname);
      toast.success(`${item.dataset} downloaded — ${rows.length} records`);
    } catch {
      toast.error("Export failed — please try again");
    } finally {
      setDownloading(null);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">Backups and data management are restricted to school administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
      </div>
    );
  }

  const list = backups as any[];
  const lastCompleted = list.find((b) => b.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups & Data"
        description="Tenant-scoped snapshots, restore, and ad-hoc exports."
        actions={
          <Button
            variant="contained"
            startIcon={createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive size={16} />}
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            Backup now
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        {lastCompleted ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Last successful backup</p>
              <p className="mt-1 text-sm font-medium">{new Date(lastCompleted.completedAt ?? lastCompleted.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="mt-1 text-sm font-medium">{formatBytes(lastCompleted.sizeBytes)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tables covered</p>
              <p className="mt-1 text-sm font-medium">{lastCompleted.tableCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rows captured</p>
              <p className="mt-1 text-sm font-medium">{Number(lastCompleted.rowCount).toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={HardDrive}
            title={isLoading ? "Loading backup status…" : "No backups yet"}
            description="Click “Backup now” to take the first snapshot, or wait for the nightly automatic run at 02:00."
            className="py-6"
          />
        )}
      </div>

      <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="snapshots" label="Snapshots" />
          <Tab value="exports" label="Exports" />
          <Tab value="policy" label="Policy" />
        </Tabs>

        {tab === "snapshots" && (
        <Box className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading snapshots…</span>
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={HardDrive}
              title="No snapshots yet"
              description="Backup snapshots will be listed here once the first one completes."
            />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{new Date(b.createdAt).toLocaleString()}</p>
                      {statusBadge(b.status)}
                      <Chip size="small" label={b.triggeredBy} sx={{ ...badgeSx("outline"), fontSize: 10, textTransform: "uppercase" }} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {b.status === "COMPLETED"
                        ? `${formatBytes(b.sizeBytes)} · ${b.tableCount} tables · ${Number(b.rowCount).toLocaleString()} rows · by ${b.createdBy ?? "System"}`
                        : b.status === "FAILED"
                          ? b.errorMessage ?? "Backup failed"
                          : "In progress…"}
                    </p>
                  </div>
                  {b.status === "COMPLETED" && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={downloading === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download size={12} />}
                        disabled={downloading === b.id}
                        onClick={() => handleSnapshotDownload(b)}
                      >
                        Download
                      </Button>
                      <Button variant="outlined" size="small" startIcon={<RotateCcw size={12} />} onClick={() => setRestoreTarget(b)}>
                        Restore
                      </Button>
                      <IconButton size="small" aria-label="Delete backup" sx={{ color: "error.main" }} onClick={() => setDeleteTarget(b)}>
                        <Trash2 size={12} />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Box>
        )}

        {tab === "exports" && (
        <Box className="space-y-3">
          {exports.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-medium">{item.scope}</p>
                <p className="text-xs text-muted-foreground">{item.rows.toLocaleString()} rows · {item.when}</p>
              </div>
              <Button
                variant="outlined"
                size="small"
                startIcon={downloading === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download size={12} />}
                disabled={downloading === item.id}
                onClick={() => handleDownload(item)}
              >
                Download
              </Button>
            </div>
          ))}
          <Button onClick={() => setExportOpen(true)} sx={{ width: "100%" }} variant="outlined">
            Create custom export
          </Button>
        </Box>
        )}

        {tab === "policy" && (
        <Box className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Nightly automatic backup</p>
              <p className="text-xs text-muted-foreground">Runs for every active school at 02:00 CAT. The most recent 14 completed backups are kept per school; older ones are pruned automatically.</p>
            </div>
            <Chip size="small" icon={<CheckCircle2 size={12} />} label="Active" sx={badgeSx("success")} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="font-medium">Encryption at rest</p>
              <p className="text-xs text-muted-foreground">Not yet available — snapshot files are stored unencrypted on the application server's disk.</p>
            </div>
            <Chip size="small" label="Not available" sx={badgeSx("outline")} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="font-medium">Cross-region replication</p>
              <p className="text-xs text-muted-foreground">Mirror snapshots to a second data centre.</p>
            </div>
            <Button size="small" variant="outlined" onClick={() => toast.info("Upgrade required")}>Upgrade</Button>
          </div>
        </Box>
        )}
      </Box>

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create custom export</DialogTitle>
        <DialogContent>
          <div className="grid gap-3">
            <TextField
              select
              label="Dataset"
              value={exportForm.dataset}
              onChange={(event) => setExportForm({ ...exportForm, dataset: event.target.value })}
              fullWidth
              size="small"
            >
              {["Student register", "Fee ledger", "Attendance archive", "Audit log"].map((dataset) => (
                <MenuItem key={dataset} value={dataset}>{dataset}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Export format"
              value={exportForm.format}
              onChange={(event) => setExportForm({ ...exportForm, format: event.target.value })}
              fullWidth
              size="small"
            >
              {["CSV"].map((format) => (
                <MenuItem key={format} value={format}>{format}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Estimated rows"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              value={exportForm.rows}
              onChange={(event) => setExportForm({ ...exportForm, rows: event.target.value })}
              fullWidth
              size="small"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={queueExport}>Queue export</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!restoreTarget} onClose={() => setRestoreTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Restore this snapshot?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This replaces every current record for this school with the state captured on{" "}
            {restoreTarget && new Date(restoreTarget.createdAt).toLocaleString()}. Anything created or
            changed since then will be lost. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" disabled={restoreMut.isPending} onClick={() => setRestoreTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={restoreMut.isPending}
            onClick={() => restoreTarget && restoreMut.mutate(restoreTarget.id)}
          >
            {restoreMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete this backup?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The snapshot file and its record will be permanently removed. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" disabled={deleteMut.isPending} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMut.isPending}
            onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
          >
            {deleteMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
