import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/vendor-management")({
  head: () => ({ meta: [{ title: "Vendor Management — SRMS" }] }),
  component: VendorManagementPage,
});

function VendorManagementPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "IT & equipment",
    contractExpiry: "2026-12-31",
    contractStartDate: new Date().toISOString().slice(0, 10),
    status: "Active",
    contactPerson: "",
    phone: "",
    email: "",
    tpin: "",
    registrationNumber: "",
    vendorAddress: "",
    bankName: "",
    bankAccount: "",
    paymentTerms: "30 days",
    serviceSpecializations: "",
    slaResponseTime: "",
  });

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", active.id],
    queryFn: () => api.vendors.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.vendors.create(active.id, data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["vendors", active.id] });
      toast.success(`${vars.name} added to vendor management`);
      setOpen(false);
      setForm({
        name: "",
        category: "IT & equipment",
        contractExpiry: "2026-12-31",
        contractStartDate: new Date().toISOString().slice(0, 10),
        status: "Active",
        contactPerson: "",
        phone: "",
        email: "",
        tpin: "",
        registrationNumber: "",
        vendorAddress: "",
        bankName: "",
        bankAccount: "",
        paymentTerms: "30 days",
        serviceSpecializations: "",
        slaResponseTime: "",
      });
    },
    onError: () => toast.error("Failed to add vendor"),
  });

  const addVendor = () => {
    if (!form.name.trim()) { toast.error("Vendor name is required"); return; }
    createMut.mutate({
      name: form.name.trim(),
      category: form.category,
      contractExpiry: form.contractExpiry,
      contractStartDate: form.contractStartDate,
      status: form.status,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      tpin: form.tpin.trim(),
      registrationNumber: form.registrationNumber.trim() || null,
      vendorAddress: form.vendorAddress.trim() || null,
      bankName: form.bankName.trim() || null,
      bankAccount: form.bankAccount.trim() || null,
      paymentTerms: form.paymentTerms,
      serviceSpecializations: form.serviceSpecializations.trim() || null,
      slaResponseTime: form.slaResponseTime.trim() || null,
    });
  };

  const activeCount = (vendors as any[]).filter((v: any) => v.status === "Active").length;
  const expiringCount = (vendors as any[]).filter((v: any) => v.status !== "Active").length;

  return (
    <AccessGuard module="vendor-management">
      <div className="space-y-6">
      <PageHeader
        title="Vendor management"
        description="Manage suppliers, contracts, service level compliance and procurement efficiency for enterprise operations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New vendor</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add vendor</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vendor name *</Label>
                  <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Northwind Supplies Ltd" maxLength={120} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["IT & equipment", "Transport services", "Training & consultancy", "Catering", "Maintenance", "Stationery & supplies", "Security", "Utilities"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contact person</Label>
                  <Input className="mt-1" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="John Mwale" maxLength={100} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" maxLength={20} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" maxLength={100} />
                </div>
                <div>
                  <Label>TPIN (ZRA)</Label>
                  <Input className="mt-1" value={form.tpin} onChange={(e) => setForm({ ...form, tpin: e.target.value })} placeholder="1001234567" maxLength={12} />
                </div>
                <div>
                  <Label>Company registration no.</Label>
                  <Input className="mt-1" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="PACRA / ZPPA reg. no." maxLength={40} />
                </div>
                <div>
                  <Label>Payment terms</Label>
                  <Select value={form.paymentTerms} onValueChange={(v) => setForm({ ...form, paymentTerms: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Immediate", "7 days", "14 days", "30 days", "45 days", "60 days", "On delivery"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contract start date</Label>
                  <Input type="date" className="mt-1" value={form.contractStartDate} onChange={(e) => setForm({ ...form, contractStartDate: e.target.value })} />
                </div>
                <div>
                  <Label>Contract expiry date</Label>
                  <Input type="date" className="mt-1" value={form.contractExpiry} onChange={(e) => setForm({ ...form, contractExpiry: e.target.value })} />
                </div>
                <div>
                  <Label>Bank name</Label>
                  <Input className="mt-1" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. ZANACO, Stanbic, FNB" maxLength={60} />
                </div>
                <div>
                  <Label>Bank account number</Label>
                  <Input className="mt-1" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Account no." maxLength={40} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Active", "Under review", "Blacklisted"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>SLA response time</Label>
                  <Input className="mt-1" value={form.slaResponseTime} onChange={(e) => setForm({ ...form, slaResponseTime: e.target.value })} placeholder="e.g. 24 hours, 48 hours, 5 business days" maxLength={60} />
                </div>
                <div className="col-span-2">
                  <Label>Vendor address</Label>
                  <Input className="mt-1" value={form.vendorAddress} onChange={(e) => setForm({ ...form, vendorAddress: e.target.value })} placeholder="Physical / postal address" maxLength={200} />
                </div>
                <div className="col-span-2">
                  <Label>Service specialisations</Label>
                  <Input className="mt-1" value={form.serviceSpecializations} onChange={(e) => setForm({ ...form, serviceSpecializations: e.target.value })} placeholder="Key products, certifications, or specialisation areas" maxLength={200} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addVendor} disabled={createMut.isPending}>Add vendor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Approved vendors" value={activeCount} accent="primary" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Contracts expiring" value={expiringCount} accent="warning" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="SLA compliance" value="—" hint="Not tracked" accent="success" icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Procurement savings" value="—" hint="Not tracked" accent="accent" icon={<Truck className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Key suppliers</h2>
              <p className="text-xs text-muted-foreground">Supplier risk, contract status and category.</p>
            </div>
            <Badge variant="secondary">{isLoading ? "…" : `${(vendors as any[]).length} vendors`}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (vendors as any[]).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.category}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.contactPerson && <div>{v.contactPerson}</div>}
                    {v.phone && <div>{v.phone}</div>}
                    {v.email && <div>{v.email}</div>}
                    {v.tpin && <div>TPIN {v.tpin}</div>}
                  </TableCell>
                  <TableCell>{v.contractExpiry || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === "Active" ? "secondary" : v.status === "Review" ? "warning" : "destructive"}>{v.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ClipboardList className="h-4 w-4" />
            Contract diligence
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Keep contracts, compliance documents and SLAs centralized in one place.</p>
          <div className="mt-5 space-y-3">
            <Button variant="outline" asChild><Link to="/procurement">Review expiring contracts</Link></Button>
            <Button variant="outline" asChild><Link to="/procurement">Approve supplier risk</Link></Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Procurement overview</h2>
            <p className="text-xs text-muted-foreground">Committed spend and vendor collaboration status.</p>
          </div>
          <Badge variant="success">Live</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Committed spend</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">K 1.8M</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">On-time delivery</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">96%</p>
          </div>
        </div>
      </div>
    </div>
    </AccessGuard>
  );
}
