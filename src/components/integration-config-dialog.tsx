import { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Switch, FormControlLabel, Alert, Stack, Typography, Chip, Box,
} from "@mui/material";
import { KeyRound, Settings2, Link as LinkIcon } from "lucide-react";

import type { ProviderSchema, IntegrationField } from "@/lib/integration-providers";
import { badgeSx } from "@/lib/utils";

type ConfigView = {
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

function toFormValue(field: IntegrationField, raw: unknown): string {
  if (raw === undefined || raw === null) return field.defaultValue ?? "";
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw);
}

export function IntegrationConfigDialog({
  open, onClose, schema, current, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  schema: ProviderSchema;
  current: ConfigView | null;
  onSave: (payload: { enabled: boolean; configuration: Record<string, unknown>; credentials: Record<string, string> }) => void;
  saving: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [credentialInputs, setCredentialInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setEnabled(!!current?.enabled);
    const nextValues: Record<string, string> = {};
    for (const f of schema.fields) {
      nextValues[f.key] = toFormValue(f, current?.configuration?.[f.key]);
    }
    setValues(nextValues);
    setCredentialInputs({});
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
      if (credentialInputs[f.key]) credentials[f.key] = credentialInputs[f.key];
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
              {schema.credentialFields.map((f) => {
                const masked = current?.credentials?.[f.key];
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
              })}
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
