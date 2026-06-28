import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ClipboardCheck, Plus, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

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
            <Button variant="outline" asChild><Link to="/incident-management">Incident queue</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Log work order</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Log work order</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Issue title *</Label>
                    <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Repair leaking roof panel, Block A" maxLength={120} />
                  </div>
                  <div>
                    <Label>Location *</Label>
                    <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Form 2 Block, Lab 2" maxLength={80} />
                  </div>
                  <div>
                    <Label>Work order type</Label>
                    <Select value={form.workOrderType} onValueChange={(v) => setForm({ ...form, workOrderType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Repair", "Inspection", "Installation", "Cleaning", "Safety check", "Electrical", "Plumbing"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assigned to</Label>
                    <Select value={form.owner} onValueChange={(v) => setForm({ ...form, owner: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Facilities", "Maintenance", "Electrical team", "Safety officer", "Transport", "Contractor"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Contractor / technician</Label>
                    <Input className="mt-1" value={form.contractorAssigned} onChange={(e) => setForm({ ...form, contractorAssigned: e.target.value })} placeholder="Name or company if external" maxLength={100} />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as "High" | "Medium" | "Low" })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["High", "Medium", "Low"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Safety risk</Label>
                    <Select value={form.safetyRisk} onValueChange={(v) => setForm({ ...form, safetyRisk: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No immediate risk</SelectItem>
                        <SelectItem value="yes">Yes — area restricted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input className="mt-1" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Target completion date</Label>
                    <Input className="mt-1" type="date" value={form.completionDate} onChange={(e) => setForm({ ...form, completionDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cost estimate (K)</Label>
                    <Input className="mt-1" type="number" min={0} value={form.costEstimate} onChange={(e) => setForm({ ...form, costEstimate: e.target.value })} placeholder="e.g. 4500" />
                  </div>
                  <div>
                    <Label>Budget code</Label>
                    <Input className="mt-1" value={form.budgetCode} onChange={(e) => setForm({ ...form, budgetCode: e.target.value })} placeholder="e.g. FAC-2026-MNT" maxLength={40} />
                  </div>
                  <div className="col-span-2">
                    <Label>Parts / materials required</Label>
                    <Input className="mt-1" value={form.partsRequired} onChange={(e) => setForm({ ...form, partsRequired: e.target.value })} placeholder="e.g. 3× roof sheets, sealant, labour" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Description / fault details</Label>
                    <Textarea className="mt-1" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the fault, extent of damage, and any interim measures taken" maxLength={500} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addWorkOrder} disabled={createMut.isPending}>Create work order</Button>
                </DialogFooter>
              </DialogContent>
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="work-orders">Work orders</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="maintenance">Preventive maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="work-orders" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
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
                      <Badge variant={o.priority === "High" ? "destructive" : o.priority === "Medium" ? "warning" : "outline"}>{o.priority}</Badge>
                    </TableCell>
                    <TableCell>{o.dueDate}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => { updateMut.mutate({ id: o.id, status: v }); toast.success(`Updated to ${v}`); }}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Open", "Scheduled", "In progress", "Closed"].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
