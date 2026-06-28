import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileCheck2, Plus, Receipt, ShieldCheck } from "lucide-react";
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
import { AccessGuard } from "@/components/access-guard";

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
            <Button variant="outline" asChild><Link to="/vendor-management">Vendor hub</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New requisition</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Create requisition</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Requester *</Label>
                    <Input className="mt-1" value={form.requester} onChange={(event) => setForm({ ...form, requester: event.target.value })} placeholder="ICT Office" />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select value={form.department} onValueChange={(value) => setForm({ ...form, department: value })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Operations", "Technology", "Academics", "Finance", "Boarding"].map((department) => (
                          <SelectItem key={department} value={department}>{department}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Requested item *</Label>
                    <Input className="mt-1" value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} placeholder="Chromebook lab refresh" />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input className="mt-1" type="number" min={1} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder="25" />
                  </div>
                  <div>
                    <Label>Amount (K) *</Label>
                    <Input className="mt-1" type="number" min={1} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="50000" />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as (typeof PRIORITIES)[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Need-by date</Label>
                    <Input type="date" className="mt-1" value={form.needByDate} onChange={(event) => setForm({ ...form, needByDate: event.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Preferred vendor</Label>
                    <Input className="mt-1" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} placeholder="ZamTech Supplies" />
                  </div>
                  <div>
                    <Label>Budget code</Label>
                    <Input className="mt-1" value={form.budgetCode} onChange={(event) => setForm({ ...form, budgetCode: event.target.value })} placeholder="ICT-2026-LAB" />
                  </div>
                  <div>
                    <Label>Delivery point</Label>
                    <Input className="mt-1" value={form.deliveryPoint} onChange={(event) => setForm({ ...form, deliveryPoint: event.target.value })} placeholder="Science block store" />
                  </div>
                  <div className="col-span-2">
                    <Label>Business justification</Label>
                    <Textarea className="mt-1" rows={4} value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} placeholder="Why the purchase is required, who needs it, and what risk exists if delayed" maxLength={500} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addRequest} disabled={createMut.isPending}>Create requisition</Button>
                </DialogFooter>
              </DialogContent>
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="requisitions" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
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
                        <Badge variant={request.priority === "Critical" ? "destructive" : request.priority === "Standard" ? "secondary" : "outline"}>
                          {request.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={request.status} onValueChange={(value) => { updateMut.mutate({ id: request.id, status: value }); toast.success(`Updated to ${value}`); }}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Draft", "Pending approval", "Approved", "Ordered"].map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
