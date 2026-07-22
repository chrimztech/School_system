import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Plus, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Box, Button, Chip, MenuItem, Tab, Tabs, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/facilities")({
  head: () => ({ meta: [{ title: "Facilities - SRMS" }] }),
  component: FacilitiesPage,
});

function FacilitiesPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState("work-orders");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    location: "",
    owner: "Facilities",
    priority: "Medium" as "High" | "Medium" | "Low",
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    workOrderType: "Repair",
    contractorAssigned: "",
    costEstimate: "",
    budgetCode: "",
    partsRequired: "",
    completionDate: "",
    description: "",
    safetyRisk: "no",
  });

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["facilities", active.id],
    queryFn: () => api.facilities.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.facilities.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["facilities", active.id] });
      toast.success("Work order logged");
      setOpen(false);
      setTab("work-orders");
      setForm({ title: "", location: "", owner: "Facilities", priority: "Medium", dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), workOrderType: "Repair", contractorAssigned: "", costEstimate: "", budgetCode: "", partsRequired: "", completionDate: "", description: "", safetyRisk: "no" });
    },
    onError: () => toast.error("Failed to create work order"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.facilities.update(active.id, id, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["facilities", active.id] }); },
    onError: () => toast.error("Failed to update status"),
  });

  const addWorkOrder = () => {
    if (!form.title.trim() || !form.location.trim()) { toast.error("Title and location are required"); return; }
    createMut.mutate({ title: form.title.trim(), location: form.location.trim(), owner: form.owner, priority: form.priority, status: "Open", dueDate: form.dueDate, workOrderType: form.workOrderType, contractorAssigned: form.contractorAssigned.trim() || null, costEstimate: Number(form.costEstimate) || null, budgetCode: form.budgetCode.trim() || null, partsRequired: form.partsRequired.trim() || null, completionDate: form.completionDate || null, description: form.description.trim() || null, safetyRisk: form.safetyRisk === "yes" });
  };

  const openOrders = (workOrders as any[]).filter((o: any) => o.status !== "Closed").length;
  const highPriority = (workOrders as any[]).filter((o: any) => o.priority === "High" && o.status !== "Closed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facilities & Maintenance"
        description="Coordinate work orders, asset readiness, and preventive maintenance across campus operations."
        actions={
          <>
            <Button component={Link} to="/incident-management" variant="outlined">Incident queue</Button>
            <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Log work order</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Log work order</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <TextField
                      label="Issue title *"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Repair leaking roof panel, Block A"
                      slotProps={{ htmlInput: { maxLength: 120 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <TextField
                    label="Location *"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. Form 2 Block, Lab 2"
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Work order type"
                    value={form.workOrderType}
                    onChange={(e) => setForm({ ...form, workOrderType: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Repair", "Inspection", "Installation", "Cleaning", "Safety check", "Electrical", "Plumbing"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label="Assigned to"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Facilities", "Maintenance", "Electrical team", "Safety officer", "Transport", "Contractor"].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Contractor / technician"
                    value={form.contractorAssigned}
                    onChange={(e) => setForm({ ...form, contractorAssigned: e.target.value })}
                    placeholder="Name or company if external"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Priority"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as "High" | "Medium" | "Low" })}
                    fullWidth
                    size="small"
                  >
                    {["High", "Medium", "Low"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label="Safety risk"
                    value={form.safetyRisk}
                    onChange={(e) => setForm({ ...form, safetyRisk: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="no">No immediate risk</MenuItem>
                    <MenuItem value="yes">Yes — area restricted</MenuItem>
                  </TextField>
                  <TextField
                    type="date"
                    label="Due date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="date"
                    label="Target completion date"
                    value={form.completionDate}
                    onChange={(e) => setForm({ ...form, completionDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Cost estimate (K)"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.costEstimate}
                    onChange={(e) => setForm({ ...form, costEstimate: e.target.value })}
                    placeholder="e.g. 4500"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Budget code"
                    value={form.budgetCode}
                    onChange={(e) => setForm({ ...form, budgetCode: e.target.value })}
                    placeholder="e.g. FAC-2026-MNT"
                    slotProps={{ htmlInput: { maxLength: 40 } }}
                    fullWidth
                    size="small"
                  />
                  <div className="col-span-2">
                    <TextField
                      label="Parts / materials required"
                      value={form.partsRequired}
                      onChange={(e) => setForm({ ...form, partsRequired: e.target.value })}
                      placeholder="e.g. 3× roof sheets, sealant, labour"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <div className="col-span-2">
                    <TextField
                      label="Description / fault details"
                      multiline
                      minRows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe the fault, extent of damage, and any interim measures taken"
                      slotProps={{ htmlInput: { maxLength: 500 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addWorkOrder} disabled={createMut.isPending}>Create work order</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open work orders" value={openOrders} accent="primary" icon={<Wrench className="h-4 w-4" />} />
        <StatCard label="High priority" value={highPriority} accent="destructive" icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatCard label="Preventive tasks" value={0} accent="warning" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Campus uptime" value="—" hint="Not tracked" accent="success" icon={<Building2 className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab value="work-orders" label="Work orders" />
        <Tab value="assets" label="Assets" />
        <Tab value="maintenance" label="Preventive maintenance" />
      </Tabs>

      {tab === "work-orders" && (
        <Box className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Issue</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Due date</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : (workOrders as any[]).map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.title}</div>
                      <div className="text-xs text-muted-foreground">{o.location}</div>
                    </TableCell>
                    <TableCell>{o.owner}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={o.priority}
                        sx={badgeSx(o.priority === "High" ? "destructive" : o.priority === "Medium" ? "warning" : "outline")}
                      />
                    </TableCell>
                    <TableCell>{o.dueDate}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        className="w-36"
                        value={o.status}
                        onChange={(e) => { updateMut.mutate({ id: o.id, status: e.target.value }); toast.success(`Updated to ${e.target.value}`); }}
                      >
                        {["Open", "Scheduled", "In progress", "Closed"].map((s) => (
                          <MenuItem key={s} value={s}>{s}</MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </Box>
      )}

      {tab === "assets" && (
        <Box className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </Box>
      )}

      {tab === "maintenance" && (
        <Box className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </Box>
      )}
      </Box>
    </div>
  );
}
