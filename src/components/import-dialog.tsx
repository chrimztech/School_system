import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, IconButton, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";

import { badgeSx, downloadCsv } from "@/lib/utils";

export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
};

export type ImportResult = {
  imported: number;
  errors: Array<{ row: number; error: string }>;
};

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityName: string;
  columns: ImportColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onDone?: () => void;
}

// Strips whitespace, a trailing "*" (the template marks required columns "Guardian Name *"
// — a user who types their header by hand often copies that literally), and a leading UTF-8
// BOM (Excel prepends one to "CSV UTF-8" exports; it survives FileReader.readAsText and would
// otherwise glue itself to the very first header, e.g. "﻿First Name").
function normalizeHeaderKey(h: string): string {
  return h.replace(/﻿/g, "").trim().replace(/\s*\*\s*$/, "").toLowerCase();
}

// Excel's "Save As CSV" delimiter follows the OS list-separator setting, which is a comma
// only in some locales — many regional Windows installs (including common Southern African
// locale settings) default to semicolon. A semicolon-delimited file parsed as comma-delimited
// produces exactly one giant "column" per line, which is why a wrong delimiter shows up as
// *every* required column missing at once, not just one. Tab is included for completeness
// (some spreadsheet "Save As" text-export options use it). Picks whichever candidate appears
// most often in the header line, outside quotes; falls back to comma if none appear at all.
function detectDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const delimiter of candidates) {
    let count = 0;
    let inQ = false;
    for (let i = 0; i < headerLine.length; i++) {
      if (headerLine[i] === '"') inQ = !inQ;
      else if (!inQ && headerLine[i] === delimiter) count++;
    }
    if (count > bestCount) { bestCount = count; best = delimiter; }
  }
  return best;
}

function parseCsvText(text: string, columns: ImportColumn[]): Record<string, string>[] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  // Snap each raw header to the column's canonical label whenever it's a case/whitespace/"*"
  // -insensitive match, so a user's own capitalization doesn't break either the required-
  // column check or downstream code that reads rows by the exact label (e.g. row["Guardian
  // Name"]). Left as-is when it doesn't match anything recognized.
  const labelByNormalized = new Map(columns.map((c) => [normalizeHeaderKey(c.label), c.label]));
  const headers = rawHeaders.map((h) => labelByNormalized.get(normalizeHeaderKey(h)) ?? h);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()]));
  });
}

function splitCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (line[i] === delimiter && !inQ) {
      result.push(cur);
      cur = "";
    } else {
      cur += line[i];
    }
  }
  result.push(cur);
  return result;
}

export function ImportDialog({ open, onOpenChange, title, entityName, columns, onImport, onDone }: ImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const requiredCols = columns.filter((c) => c.required).map((c) => c.label);
  const presentHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  const missingRequired = requiredCols.filter((r) => !presentHeaders.includes(r));

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a .csv file"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result ?? "") as string;
      const parsed = parseCsvText(text, columns);
      if (parsed.length === 0) { toast.error("File is empty or has no data rows"); return; }
      setRows(parsed);
      setFileName(file.name);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const header = columns.map((c) => `${c.label}${c.required ? " *" : ""}`);
    const example = columns.map((c) => c.example ?? "");
    const csv = [header.join(","), example.join(",")].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `${entityName.toLowerCase().replace(/\s+/g, "-")}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function runImport() {
    if (rows.length === 0 || missingRequired.length > 0) return;
    setImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`${res.imported} ${entityName.toLowerCase()}${res.imported !== 1 ? "s" : ""} imported`);
        onDone?.();
      }
      if (res.errors.length > 0 && res.imported === 0) {
        toast.error("Import failed — see error details below");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const previewRows = rows.slice(0, 5);
  const previewHeaders = rows.length > 0 ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <Dialog
      open={open}
      onClose={() => { if (!importing) { onOpenChange(false); reset(); } }}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <div className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
          {/* Template download */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Step 1 — Download the template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fill in the spreadsheet and save as CSV (File → Save As → CSV).
                  Columns marked <span className="font-semibold">*</span> are required.
                </p>
              </div>
              <Button variant="outlined" size="small" startIcon={<Download size={14} />} onClick={downloadTemplate} sx={{ flexShrink: 0 }}>
                Template
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <Chip
                  key={c.key}
                  size="small"
                  label={`${c.label}${c.required ? " *" : ""}`}
                  sx={{ ...badgeSx(c.required ? "default" : "outline"), fontSize: 10 }}
                />
              ))}
            </div>
          </div>

          {/* File upload */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium mb-3">Step 2 — Upload your completed CSV</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {fileName ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{rows.length} data row{rows.length !== 1 ? "s" : ""} parsed</p>
                </div>
                <IconButton aria-label="Remove file" size="small" onClick={reset}><X className="h-4 w-4" /></IconButton>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-card py-8 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <Upload className="h-8 w-8 opacity-40" />
                <span>Click to select a CSV file</span>
              </button>
            )}
          </div>

          {/* Missing required columns warning */}
          {fileName && missingRequired.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Missing required column{missingRequired.length !== 1 ? "s" : ""}</p>
                <p className="text-xs mt-0.5">{missingRequired.join(", ")}</p>
              </div>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  Preview{rows.length > 5 ? ` (showing the first ${previewRows.length} of ${rows.length} rows)` : ""}
                </p>
                {rows.length > 5 && (
                  <Chip
                    size="small"
                    label={`All ${rows.length} rows will be imported`}
                    sx={{ ...badgeSx("success"), fontSize: 11 }}
                  />
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {previewHeaders.map((h) => <TableCell key={h} className="text-xs">{h}</TableCell>)}
                      {Object.keys(rows[0]).length > 6 && <TableCell className="text-xs text-muted-foreground">+{Object.keys(rows[0]).length - 6} more</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {previewHeaders.map((h) => <TableCell key={h} className="py-1.5 text-xs">{row[h] || <span className="text-muted-foreground/50">—</span>}</TableCell>)}
                        {Object.keys(rows[0]).length > 6 && <TableCell className="py-1.5 text-xs text-muted-foreground">…</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              </div>
              {rows.length > 5 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  … and {rows.length - 5} more row{rows.length - 5 !== 1 ? "s" : ""} not shown here, but still included when you import.
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <p className="text-sm font-medium">{result.imported} record{result.imported !== 1 ? "s" : ""} imported successfully</p>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-destructive">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} failed:</p>
                  {result.errors.slice(0, 10).map(({ row, error }) => (
                    <p key={row} className="text-xs text-muted-foreground">Row {row}: {error}</p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-xs text-muted-foreground">… and {result.errors.length - 10} more errors</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
      <DialogActions className="mt-2">
        <Button variant="outlined" color="inherit" onClick={() => { onOpenChange(false); reset(); }} disabled={importing}>
          {result ? "Done" : "Cancel"}
        </Button>
        {!result && (
          <Button
            onClick={runImport}
            disabled={rows.length === 0 || missingRequired.length > 0 || importing}
            startIcon={importing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Import {rows.length > 0 ? `${rows.length} row${rows.length !== 1 ? "s" : ""}` : ""}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
