import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HardDrive, Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/backups")({
  head: () => ({ meta: [{ title: "Backups & Data - SRMS" }] }),
  component: BackupsPage,
});

function BackupsPage() {
  const [exports, setExports] = useState<Array<{ id: string; scope: string; rows: number; when: string }>>([]);
  const [auto, setAuto] = useState(true);
  const [encrypt, setEncrypt] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importForm, setImportForm] = useState({ dataset: "Student register", source: "CSV", fileName: "" });
  const [exportForm, setExportForm] = useState({ dataset: "Student register", format: "CSV", rows: "842" });

  const queueImport = () => {
    if (!importForm.fileName.trim()) {
      toast.error("Please provide the import file name");
      return;
    }
    toast.success(`${importForm.dataset} import queued from ${importForm.fileName}`);
    setImportForm({ dataset: "Student register", source: "CSV", fileName: "" });
    setImportOpen(false);
  };

  const queueExport = () => {
    const rows = Number(exportForm.rows);
    if (!Number.isFinite(rows) || rows <= 0) {
      toast.error("Rows must be a positive number");
      return;
    }
    setExports((prev) => [
      {
        id: `e${prev.length + 1}`,
        scope: `${exportForm.dataset} (${exportForm.format})`,
        rows,
        when: "Queued now",
      },
      ...prev,
    ]);
    toast.success(`${exportForm.dataset} export queued`);
    setExportForm({ dataset: "Student register", format: "CSV", rows: "842" });
    setExportOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups & Data"
        description="Encrypted snapshots, exports, imports, and disaster recovery."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Import</Button>
            <Button onClick={() => toast.success("Snapshot started - ETA 3 min")}><HardDrive className="mr-1 h-4 w-4" />Backup now</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Last backup" value="—" hint="Not configured" accent="success" />
        <StatCard label="Retention" value="—" hint="Not configured" accent="primary" />
        <StatCard label="Storage used" value="—" hint="Not configured" accent="accent" />
        <StatCard label="Recovery point" value="—" hint="Not configured" accent="warning" />
      </div>

      <Tabs defaultValue="snapshots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>

        <TabsContent value="exports" className="space-y-3">
          {exports.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-medium">{item.scope}</p>
                <p className="text-xs text-muted-foreground">{item.rows.toLocaleString()} rows · {item.when}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.success(`${item.scope} downloaded`)}><Download className="mr-1 h-3 w-3" />Download</Button>
            </div>
          ))}
          <Button onClick={() => setExportOpen(true)} className="w-full" variant="outline">
            Create custom export
          </Button>
        </TabsContent>

        <TabsContent value="policy" className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Nightly automatic backup</p>
              <p className="text-xs text-muted-foreground">Runs at 02:00 CAT daily.</p>
            </div>
            <Switch checked={auto} onCheckedChange={(value) => { setAuto(value); toast.success(`Auto-backup ${value ? "enabled" : "disabled"}`); }} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="font-medium">AES-256 encryption at rest</p>
              <p className="text-xs text-muted-foreground">Snapshots encrypted with tenant-specific keys.</p>
            </div>
            <Switch checked={encrypt} onCheckedChange={(value) => { setEncrypt(value); toast.success(`Encryption ${value ? "enabled" : "disabled"}`); }} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="font-medium">Cross-region replication</p>
              <p className="text-xs text-muted-foreground">Mirror snapshots to a second data centre.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.info("Upgrade required")}>Upgrade</Button>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Import dataset</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Dataset</Label>
              <Select value={importForm.dataset} onValueChange={(value) => setImportForm({ ...importForm, dataset: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Student register", "Fee ledger", "Attendance archive", "Inventory master"].map((dataset) => (
                    <SelectItem key={dataset} value={dataset}>{dataset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source format</Label>
              <Select value={importForm.source} onValueChange={(value) => setImportForm({ ...importForm, source: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CSV", "XLSX", "JSON"].map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File name</Label>
              <Input className="mt-1" value={importForm.fileName} onChange={(event) => setImportForm({ ...importForm, fileName: event.target.value })} placeholder="students_term2.csv" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={queueImport}>Queue import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create custom export</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Dataset</Label>
              <Select value={exportForm.dataset} onValueChange={(value) => setExportForm({ ...exportForm, dataset: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Student register", "Fee ledger", "Attendance archive", "Audit log"].map((dataset) => (
                    <SelectItem key={dataset} value={dataset}>{dataset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Export format</Label>
              <Select value={exportForm.format} onValueChange={(value) => setExportForm({ ...exportForm, format: value })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CSV", "XLSX", "PDF"].map((format) => (
                    <SelectItem key={format} value={format}>{format}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated rows</Label>
              <Input className="mt-1" type="number" min={1} value={exportForm.rows} onChange={(event) => setExportForm({ ...exportForm, rows: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={queueExport}>Queue export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
