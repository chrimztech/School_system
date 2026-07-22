import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileCheck2, Plus, Receipt, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/procurement")({
  head: () => ({ meta: [{ title: "Procurement - SRMS" }] }),
  component: ProcurementPage,
});

const PRIORITIES = ["Critical", "Standard", "Low"] as const;

function createForm() {
  return {
    requester: "",
    department: "Operations",
    item: "",
    quantity: "1",
    amount: "",
    priority: "Standard" as (typeof PRIORITIES)[number],
    vendor: "",
    needByDate: "",
    budgetCode: "",
    deliveryPoint: "",
    justification: "",
  };
}

function buildRequisitionItem(form: ReturnType<typeof createForm>) {
  return form.item.trim();
}

function parseRequisitionItem(item: string | null | undefined) {
  const lines = (item ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    title: lines[0] ?? "",
    meta: lines.slice(1),
  };
}

function ProcurementPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState("requisitions");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createForm);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["procurement", active.id],
    queryFn: () => api.procurement.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.procurement.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["procurement", active.id] });
      toast.success("Requisition created and saved as draft");
      setOpen(false);
      setTab("requisitions");
      setForm(createForm());
    },
    onError: () => toast.error("Failed to create requisition"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.procurement.update(active.id, id, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["procurement", active.id] }); },
    onError: () => toast.error("Failed to update status"),
  });

  const addRequest = () => {
    if (!form.requester.trim() || !form.item.trim() || !form.amount) {
      toast.error("Requester, item, and amount are required");
      return;
    }

    createMut.mutate({
      requester: form.requester.trim(),
      department: form.department,
      item: buildRequisitionItem(form),
      quantity: Math.max(1, Number(form.quantity) || 1),
      amount: Number(form.amount),
      priority: form.priority,
      vendor: form.vendor.trim() || "Vendor pending",
      needByDate: form.needByDate || null,
      budgetCode: form.budgetCode.trim() || null,
      deliveryPoint: form.deliveryPoint.trim() || null,
      justification: form.justification.trim() || null,
      status: "Draft",
    });
  };

  const committedSpend = (requests as any[]).reduce((sum: number, request: any) => sum + (Number(request.amount) || 0), 0);

  return (
    <AccessGuard module="procurement">
      <div className="space-y-6">
      <PageHeader
        title="Procurement Hub"
        description="Run requisitions, approvals, and contract oversight from a single enterprise workflow."
        actions={
          <>
            <Button variant="outlined" component={Link} to="/vendor-management">Vendor hub</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>New requisition</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Create requisition</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Requester *" fullWidth size="small" value={form.requester} onChange={(event) => setForm({ ...form, requester: event.target.value })} placeholder="ICT Office" />
                  <TextField select label="Department" fullWidth size="small" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>
                    {["Operations", "Technology", "Academics", "Finance", "Boarding"].map((department) => (
                      <MenuItem key={department} value={department}>{department}</MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Requested item *" fullWidth size="small" className="col-span-2" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} placeholder="Chromebook lab refresh" />
                  <TextField label="Quantity" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1 } }} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="25" />
                  <TextField label="Amount (K) *" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1 } }} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="50000" />
                  <TextField select label="Priority" fullWidth size="small" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as (typeof PRIORITIES)[number] })}>
                    {PRIORITIES.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
                  </TextField>
                  <TextField type="date" label="Need-by date" fullWidth size="small" value={form.needByDate} onChange={(event) => setForm({ ...form, needByDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Preferred vendor" fullWidth size="small" className="col-span-2" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder="ZamTech Supplies" />
                  <TextField label="Budget code" fullWidth size="small" value={form.budgetCode} onChange={(event) => setForm({ ...form, budgetCode: event.target.value })} placeholder="ICT-2026-LAB" />
                  <TextField label="Delivery point" fullWidth size="small" value={form.deliveryPoint} onChange={(event) => setForm({ ...form, deliveryPoint: event.target.value })} placeholder="Science block store" />
                  <TextField label="Business justification" fullWidth size="small" multiline minRows={4} className="col-span-2" value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} placeholder="Why the purchase is required, who needs it, and what risk exists if delayed" slotProps={{ htmlInput: { maxLength: 500 } }} />
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={addRequest} disabled={createMut.isPending}>Create requisition</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open requisitions" value={(requests as any[]).filter((request: any) => request.status !== "Ordered").length} accent="primary" icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Pending approvals" value={(requests as any[]).filter((request: any) => request.status === "Pending approval").length} accent="warning" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Renewals due" value={0} accent="destructive" icon={<FileCheck2 className="h-4 w-4" />} />
        <StatCard label="Committed spend" value={`K ${committedSpend.toLocaleString()}`} accent="accent" icon={<Receipt className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab value="requisitions" label="Requisitions" />
        <Tab value="contracts" label="Contracts" />
        <Tab value="approvals" label="Approvals" />
      </Tabs>

      {tab === "requisitions" && (
        <Box className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Request</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (requests as any[]).map((request: any) => {
                  const details = parseRequisitionItem(request.item);
                  const quantity = request.quantity ?? details.meta.find((line) => line.startsWith("Qty:"))?.replace("Qty:", "").trim();
                  const needBy = request.needByDate ?? details.meta.find((line) => line.startsWith("Need by:"))?.replace("Need by:", "").trim();
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="font-medium">{details.title || request.item}</div>
                        <div className="text-xs text-muted-foreground">{[quantity ? `Qty ${quantity}` : "", needBy ? `Need by ${needBy}` : ""].filter(Boolean).join(" - ")}</div>
                        <div className="text-xs text-muted-foreground">{request.requester} - {request.vendor}</div>
                      </TableCell>
                      <TableCell>{request.department}</TableCell>
                      <TableCell>K {Number(request.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={request.priority}
                          sx={badgeSx(request.priority === "Critical" ? "destructive" : request.priority === "Standard" ? "secondary" : "outline")}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          className="w-40"
                          value={request.status}
                          onChange={(event) => { updateMut.mutate({ id: request.id, status: event.target.value }); toast.success(`Updated to ${event.target.value}`); }}
                        >
                          {["Draft", "Pending approval", "Approved", "Ordered"].map((status) => (
                            <MenuItem key={status} value={status}>{status}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </Box>
      )}

      {tab === "contracts" && (
        <Box className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </Box>
      )}

      {tab === "approvals" && (
        <Box className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </Box>
      )}
    </div>
    </AccessGuard>
  );
}
