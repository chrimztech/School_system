import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Switch, FormControlLabel, Alert, Stack, Typography, Chip, Box, IconButton,
} from "@mui/material";
import { KeyRound, Settings2, Link as LinkIcon, History, BarChart3, Upload, CheckCircle2, XCircle, Plus, Pencil, Trash2, Send } from "lucide-react";

import type { ProviderSchema, IntegrationField } from "@/lib/integration-providers";
import { badgeSx } from "@/lib/utils";

type ConfigView = {
  id?: string | null;
  enabled?: boolean;
  configuration?: Record<string, unknown>;
  credentials?: Record<string, string | null>;
  callbackUrl?: string | null;
  connectionStatus?: string;
  lastTestedAt?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastErrorMessage?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export type IntegrationEvent = {
  id: string;
  eventType: string;
  success: boolean;
  message?: string | null;
  createdAt: string;
};

export type PowerBiReportInput = {
  id?: string;
  workspaceId: string;
  reportId: string;
  datasetId: string;
  capacityId?: string;
  displayName: string;
  reportType?: string;
  rowLevelSecurityRole?: string;
  refreshSchedule?: string;
  enabled?: boolean;
  lastRefreshAt?: string | null;
};

function toFormValue(field: IntegrationField, raw: unknown): string {
  if (raw === undefined || raw === null) return field.defaultValue ?? "";
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

const EMPTY_REPORT: PowerBiReportInput = {
  workspaceId: "", reportId: "", datasetId: "", capacityId: "", displayName: "", reportType: "published", rowLevelSecurityRole: "", refreshSchedule: "manual",
};

export function IntegrationConfigDialog({
  open, onClose, schema, current, onSave, saving,
  events, onUploadFile, uploadingField,
  reports, onSaveReport, onDeleteReport, onPublishReport, savingReport, publishingReportId,
}: {
  open: boolean;
  onClose: () => void;
  schema: ProviderSchema;
  current: ConfigView | null;
  onSave: (payload: { enabled: boolean; configuration: Record<string, unknown>; credentials: Record<string, string> }) => void;
  saving: boolean;
  events?: IntegrationEvent[];
  onUploadFile?: (fieldKey: string, file: File) => void;
  uploadingField?: string | null;
  reports?: PowerBiReportInput[];
  onSaveReport?: (report: PowerBiReportInput) => void;
  onDeleteReport?: (id: string) => void;
  onPublishReport?: (id: string) => void;
  savingReport?: boolean;
  publishingReportId?: string | null;
}) {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});
  const [reportForm, setReportForm] = useState<PowerBiReportInput | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setEnabled(!!current?.enabled);
    const nextValues: Record<string, string> = {};
    for (const f of schema.fields) {
      nextValues[f.key] = toFormValue(f, current?.configuration?.[f.key]);
    }
    setValues(nextValues);
    setCredentialInputs({});
    setReportForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schema.code]);

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));
  const setCred = (key: string, v: string) => setCredentialInputs((prev) => ({ ...prev, [key]: v }));

  const save = () => {
    const configuration: Record<string, unknown> = {};
    for (const f of schema.fields) {
      const raw = values[f.key] ?? "";
      if (f.type === "toggle") {
        configuration[f.key] = raw === "true";
      } else if (f.type === "multiselect") {
        configuration[f.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (f.type === "number") {
        configuration[f.key] = raw === "" ? null : Number(raw);
      } else {
        configuration[f.key] = raw;
      }
    }
    const environmentField = schema.fields.find((f) => f.key === "environment");
    if (environmentField) configuration.environment = values.environment ?? "";

    const credentials: Record<string, string> = {};
    for (const f of schema.credentialFields) {
      if (f.type !== "file" && credentialInputs[f.key]) credentials[f.key] = credentialInputs[f.key];
    }
    onSave({ enabled, configuration, credentials });
  };

  const renderField = (f: IntegrationField) => {
    const value = values[f.key] ?? "";
    if (f.type === "toggle") {
      return (
        <FormControlLabel
          key={f.key}
          control={<Switch checked={value === "true"} onChange={(e) => set(f.key, e.target.checked ? "true" : "false")} />}
          label={<span className="text-sm">{f.label}{f.hint ? <span className="ml-1 text-xs text-muted-foreground">({f.hint})</span> : null}</span>}
        />
      );
    }
    if (f.type === "select") {
      return (
        <TextField
          key={f.key} select label={f.label} value={value || ""} required={f.required}
          onChange={(e) => set(f.key, e.target.value)} fullWidth size="small" helperText={f.hint}
        >
          {(f.options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
      );
    }
    if (f.type === "textarea") {
      return (
        <TextField
          key={f.key} label={f.label} value={value} required={f.required} multiline minRows={3}
          onChange={(e) => set(f.key, e.target.value)} fullWidth size="small" helperText={f.hint}
          className="sm:col-span-2"
        />
      );
    }
    return (
      <TextField
        key={f.key}
        label={f.label}
        type={f.type === "number" ? "number" : "text"}
        value={value}
        required={f.required}
        placeholder={f.placeholder}
        helperText={f.hint}
        onChange={(e) => set(f.key, e.target.value)}
        fullWidth
        size="small"
      />
    );
  };

  const renderCredentialField = (f: IntegrationField) => {
    const masked = current?.credentials?.[f.key];
    if (f.type === "file") {
      const uploading = uploadingField === f.key;
      return (
        <div key={f.key} className="flex items-center gap-2">
          <input
            ref={(el) => { fileInputRefs.current[f.key] = el; }}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onUploadFile) onUploadFile(f.key, file);
              e.target.value = "";
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<Upload size={14} />}
            disabled={uploading}
            onClick={() => fileInputRefs.current[f.key]?.click()}
          >
            {uploading ? "Uploading…" : masked ? "Replace file" : "Upload file"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {masked ? `Currently set (${masked})` : f.hint || "Not set"}
          </span>
        </div>
      );
    }
    return (
      <TextField
        key={f.key}
        type="password"
        label={f.label}
        value={credentialInputs[f.key] ?? ""}
        required={f.required && !masked}
        placeholder={masked ? `Currently set (${masked}) — leave blank to keep it` : (f.hint || "Not set")}
        onChange={(e) => setCred(f.key, e.target.value)}
        fullWidth
        size="small"
      />
    );
  };

  const statusTone = current?.connectionStatus === "HEALTHY" ? "success" : current?.connectionStatus === "DEGRADED" ? "destructive" : "outline";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <span>Configure {schema.name}</span>
          {current?.connectionStatus && (
            <Chip size="small" label={current.connectionStatus.replace("_", " ")} sx={badgeSx(statusTone as any)} />
          )}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <div className="space-y-5">
          {schema.warning && (
            <Alert severity="warning" sx={{ borderRadius: "10px" }}>{schema.warning}</Alert>
          )}

          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
            label={<span className="text-sm font-medium">Enabled</span>}
          />

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuration</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {schema.fields.map(renderField)}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credentials</p>
            </div>
            <div className="grid gap-3">
              {schema.credentialFields.map(renderCredentialField)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Stored encrypted. Never shown again in full after saving — only the last 4 characters, so you can confirm which value is on file.
            </p>
          </div>

          {schema.hasCallbackUrl && current?.callbackUrl && (
            <Box className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <LinkIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Callback URL</p>
                <p className="truncate text-xs">{current.callbackUrl}</p>
              </div>
            </Box>
          )}

          {(current?.lastTestedAt || current?.updatedAt) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {current?.lastTestedAt && <span>Last tested: {new Date(current.lastTestedAt).toLocaleString()}</span>}
              {current?.lastSuccessAt && <span>Last success: {new Date(current.lastSuccessAt).toLocaleString()}</span>}
              {current?.lastFailureAt && <span>Last failure: {new Date(current.lastFailureAt).toLocaleString()}</span>}
              {current?.updatedBy && <span>Updated by: {current.updatedBy}</span>}
              {current?.lastErrorMessage && <span className="col-span-2 truncate">Last error: {current.lastErrorMessage}</span>}
            </div>
          )}

          {schema.hasReports && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reports</p>
                </div>
                {!reportForm && (
                  <Button size="small" startIcon={<Plus size={14} />} onClick={() => setReportForm(EMPTY_REPORT)}>
                    Add report
                  </Button>
                )}
              </div>

              {!current?.id && (
                <p className="mb-2 text-xs text-muted-foreground">Save the connection-level credentials above before adding a report.</p>
              )}

              <div className="space-y-2">
                {(reports ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Dataset {r.datasetId}{r.lastRefreshAt ? ` · last published ${new Date(r.lastRefreshAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <IconButton size="small" onClick={() => onPublishReport?.(r.id!)} disabled={publishingReportId === r.id} aria-label="Publish snapshot">
                        <Send size={14} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setReportForm(r)} aria-label="Edit report">
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton size="small" onClick={() => onDeleteReport?.(r.id!)} sx={{ color: "error.main" }} aria-label="Delete report">
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>

              {reportForm && (
                <div className="mt-3 space-y-2 rounded-md border border-border bg-card p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextField size="small" label="Display name" value={reportForm.displayName} onChange={(e) => setReportForm({ ...reportForm, displayName: e.target.value })} fullWidth />
                    <TextField size="small" label="Workspace ID" value={reportForm.workspaceId} onChange={(e) => setReportForm({ ...reportForm, workspaceId: e.target.value })} fullWidth />
                    <TextField size="small" label="Report ID" value={reportForm.reportId} onChange={(e) => setReportForm({ ...reportForm, reportId: e.target.value })} fullWidth />
                    <TextField size="small" label="Dataset ID" value={reportForm.datasetId} onChange={(e) => setReportForm({ ...reportForm, datasetId: e.target.value })} fullWidth />
                    <TextField size="small" label="Capacity ID" value={reportForm.capacityId ?? ""} onChange={(e) => setReportForm({ ...reportForm, capacityId: e.target.value })} fullWidth />
                    <TextField size="small" select label="Report type" value={reportForm.reportType ?? "published"} onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })} fullWidth>
                      <MenuItem value="embedded">Embedded</MenuItem>
                      <MenuItem value="published">Published</MenuItem>
                    </TextField>
                    <TextField size="small" label="Row-level security role" value={reportForm.rowLevelSecurityRole ?? ""} onChange={(e) => setReportForm({ ...reportForm, rowLevelSecurityRole: e.target.value })} fullWidth />
                    <TextField size="small" select label="Refresh schedule" value={reportForm.refreshSchedule ?? "manual"} onChange={(e) => setReportForm({ ...reportForm, refreshSchedule: e.target.value })} fullWidth>
                      <MenuItem value="manual">Manual only</MenuItem>
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="hourly">Hourly</MenuItem>
                    </TextField>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="small" color="inherit" onClick={() => setReportForm(null)}>Cancel</Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={savingReport}
                      onClick={() => { onSaveReport?.(reportForm); setReportForm(null); }}
                    >
                      Save report
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {events && events.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</p>
              </div>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-2">
                    {e.success ? <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-success" /> : <XCircle size={13} className="mt-0.5 flex-shrink-0 text-destructive" />}
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      <span className="font-medium text-foreground">{e.eventType}</span> — {e.message || (e.success ? "Succeeded" : "Failed")}
                    </span>
                    <span className="flex-shrink-0 text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Typography variant="caption" className="text-muted-foreground">
            This form is only visible to System Administrators.
          </Typography>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>Save settings</Button>
      </DialogActions>
    </Dialog>
  );
}
