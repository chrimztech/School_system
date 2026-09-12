import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database, Download, ShieldAlert, Loader2, RotateCcw, Trash2, CheckCircle2, XCircle, Clock, Server, HardDrive, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";
import { Button, Chip, IconButton, Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText } from "@mui/material";

export const Route = createFileRoute("/system-backup")({
  head: () => ({ meta: [{ title: "System Backup - SRMS" }] }),
  component: SystemBackupPage,
});

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

const PLATFORM_SCOPE = "__PLATFORM__";

function scopeLabel(backup: any, schoolNames: Map<string, string>) {
  return backup.schoolId === PLATFORM_SCOPE ? "Platform tables" : (schoolNames.get(backup.schoolId) ?? backup.schoolId);
}

function SystemBackupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const canManage = user?.role === "super_admin";

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["platform-backups"],
    queryFn: () => api.platformBackup.list(),
    enabled: canManage,
    refetchInterval: (query) =>
      (query.state.data as any[] | undefined)?.some((b) => b.status === "IN_PROGRESS") ? 3000 : false,
  });

  const { data: schools = [] } = useQuery({
    queryKey: ["schools-for-backup-labels"],
    queryFn: () => api.schools.list(),
    enabled: canManage,
  });
  const schoolNames = new Map((schools as any[]).map((s) => [s.id, s.name]));

  const createMut = useMutation({
    mutationFn: () => api.platformBackup.createFull(),
    onSuccess: () => {
      toast.success("Full system backup started — one snapshot per active school, plus platform tables");
      void qc.invalidateQueries({ queryKey: ["platform-backups"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Backup failed to start"),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => api.platformBackup.restorePlatformTables(id),
    onSuccess: () => {
      toast.success("Platform tables restored");
      setRestoreTarget(null);
      void qc.invalidateQueries({ queryKey: ["platform-backups"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Restore failed");
      setRestoreTarget(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.platformBackup.remove(id),
    onSuccess: () => {
      toast.success("Backup deleted");
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ["platform-backups"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Delete failed");
      setDeleteTarget(null);
    },
  });

  const handleDownload = async (backup: any) => {
    setDownloading(backup.id);
    try {
      await api.platformBackup.download(backup.id, backup.fileName ?? `backup-${backup.id}.json.gz`);
    } catch {
      toast.error("Download failed — please try again");
    } finally {
      setDownloading(null);
    }
  };

  if (!canManage) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">Whole-system backup and restore is restricted to System Administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
      </div>
    );
  }

  const list = backups as any[];
  const schoolCount = new Set(list.filter((b) => b.schoolId !== PLATFORM_SCOPE).map((b) => b.schoolId)).size;
  const lastRun = list[0];
  const failedCount = list.filter((b) => b.status === "FAILED").length;
  const totalBytes = list.filter((b) => b.status === "COMPLETED").reduce((sum, b) => sum + (b.sizeBytes ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Backup"
        description="Whole-platform snapshots — every school's data plus platform-wide tables — in one operation."
        actions={
          <Button
            variant="contained"
            startIcon={createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database size={16} />}
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            Back up entire system now
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Clock size={18} />} label="Last run" value={lastRun ? new Date(lastRun.createdAt).toLocaleString() : "Never"} />
        <StatCard icon={<Server size={18} />} label="Schools covered (last run)" value={String(schoolCount)} />
        <StatCard icon={<HardDrive size={18} />} label="Total stored" value={formatBytes(totalBytes)} />
        <StatCard icon={<AlertTriangle size={18} />} label="Failed snapshots" value={String(failedCount)} accent={failedCount > 0 ? "destructive" : "primary"} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading snapshots…</span>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No system backups yet"
            description="Click “Back up entire system now” to take the first whole-platform snapshot — one backup per active school, plus a separate snapshot of platform-wide tables like accounts and billing plans."
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{scopeLabel(b, schoolNames)}</p>
                    {statusBadge(b.status)}
                    <Chip size="small" label={b.triggeredBy} sx={{ ...badgeSx("outline"), fontSize: 10, textTransform: "uppercase" }} />
                    {b.schoolId === PLATFORM_SCOPE && (
                      <Chip size="small" label="Platform-wide" sx={{ ...badgeSx("default"), fontSize: 10 }} />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString()} ·{" "}
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
                      onClick={() => handleDownload(b)}
                    >
                      Download
                    </Button>
                    {b.schoolId === PLATFORM_SCOPE ? (
                      <Button variant="outlined" size="small" startIcon={<RotateCcw size={12} />} onClick={() => setRestoreTarget(b)}>
                        Restore
                      </Button>
                    ) : (
                      <Button variant="outlined" size="small" component={Link} to="/backups">
                        Restore from school page
                      </Button>
                    )}
                    <IconButton size="small" aria-label="Delete backup" sx={{ color: "error.main" }} onClick={() => setDeleteTarget(b)}>
                      <Trash2 size={12} />
                    </IconButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 text-xs text-muted-foreground">
        <p>
          Each row here is one snapshot. A single “Back up entire system now” run creates several rows: one per active
          school (identical to that school's own “Backup now” on its Backups &amp; Data page) plus one “Platform-wide”
          row covering tables that aren't tied to any single school — accounts, platform billing plans, support tickets,
          integration credentials, and the rest of the platform workspace.
        </p>
        <p className="mt-2">
          Restoring an individual school's row is done from that school's own Backups &amp; Data page (use
          “Restore from school page” above to jump there). Restoring the platform-wide row is done here, since it
          isn't scoped to any one tenant.
        </p>
      </div>

      <Dialog open={!!restoreTarget} onClose={() => setRestoreTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Restore platform tables?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This replaces every current row in every platform-wide table (accounts, billing plans, support tickets,
            integration credentials, and the rest of the platform workspace) with the state captured on{" "}
            {restoreTarget && new Date(restoreTarget.createdAt).toLocaleString()}. It does not touch any school's own
            data. Anything created or changed since then will be lost. This cannot be undone.
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
