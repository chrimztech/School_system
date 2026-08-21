import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Plus, ShieldCheck, FileSearch } from "lucide-react";

import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";

import { PageHeader } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/compliance")({
  head: () => ({ meta: [{ title: "Compliance — SRMS" }] }),
  component: CompliancePage,
});

const CATEGORIES = ["Regulatory", "Policy", "Health & Safety", "HR", "Finance"];
const STATUSES = ["Compliant", "Pending", "Non-compliant", "Exempt"];

function createForm() {
  return { title: "", category: CATEGORIES[0], status: "Pending", owner: "", dueDate: "", notes: "" };
}

function CompliancePage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createForm());

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["compliance", active.id],
    queryFn: () => api.compliance.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.compliance.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["compliance", active.id] });
      toast.success("Compliance item added");
      setForm(createForm());
      setOpen(false);
    },
    onError: () => toast.error("Failed to add compliance item"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.compliance.update(active.id, id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["compliance", active.id] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const addItem = () => {
    if (!form.title.trim() || !form.owner.trim()) { toast.error("Title and owner are required"); return; }
    createMut.mutate({ ...form, title: form.title.trim(), owner: form.owner.trim(), notes: form.notes.trim() || null });
  };

  const compliantCount = (items as any[]).filter((i: any) => i.status === "Compliant").length;
  const totalCount = (items as any[]).length;
  const healthPct = totalCount ? Math.round((compliantCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance management"
        description="Track policies, audits, regulatory readiness, and control status across your institution."
        actions={
          <>
            <Button variant="outlined" component={Link} to="/policy-library">Review compliance plan</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Add compliance item</Button>
          </>
        }
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add compliance item</DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <TextField
              label="Title *"
              fullWidth
              size="small"
              className="col-span-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Fire safety certification renewal"
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            <TextField select label="Category" fullWidth size="small" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label="Status" fullWidth size="small" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField
              label="Owner *"
              fullWidth
              size="small"
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="e.g. Facilities, Finance"
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <TextField
              type="date"
              label="Due date"
              fullWidth
              size="small"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Notes"
              fullWidth
              size="small"
              multiline
              minRows={2}
              className="col-span-2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 400 } }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={addItem} disabled={createMut.isPending} startIcon={createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
            Add item
          </Button>
        </DialogActions>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4" />
            Compliance health
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {totalCount > 0
              ? `${healthPct}% of compliance controls are meeting their target schedule.`
              : "No compliance data loaded yet. Start by adding compliance items."}
          </p>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-muted/70 px-4 py-3">
              <p className="text-sm font-medium">Audit readiness</p>
              <Chip
                size="small"
                label={totalCount > 0 ? (compliantCount / totalCount >= 0.8 ? "Ready" : "Review needed") : "Pending"}
                sx={badgeSx(totalCount > 0 ? (compliantCount / totalCount >= 0.8 ? "success" : "warning") : "secondary")}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/70 px-4 py-3">
              <p className="text-sm font-medium">Policy coverage</p>
              <Chip
                size="small"
                label={totalCount > 0 ? `Strong (${totalCount} items)` : "Pending"}
                sx={badgeSx(totalCount > 0 ? "success" : "secondary")}
              />
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
            <Button variant="outlined" component={Link} to="/policy-library">Open policy dashboard</Button>
            <Button variant="outlined" component={Link} to="/audit">Start audit checklist</Button>
            <Button variant="outlined" component={Link} to="/risk-register">Review risk register</Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Regulatory status</h2>
            <p className="text-xs text-muted-foreground">Current status for key regulatory areas.</p>
          </div>
          <Chip size="small" label={isLoading ? "Loading…" : `${totalCount} items`} sx={badgeSx("secondary")} />
        </div>
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Due date</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
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
                  <TextField
                    select
                    size="small"
                    value={STATUSES.includes(item.status) ? item.status : "Pending"}
                    onChange={(e) => updateMut.mutate({ id: item.id, status: e.target.value })}
                    sx={{ minWidth: 140 }}
                  >
                    {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </div>
    </div>
  );
}
