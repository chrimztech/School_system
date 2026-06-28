import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DollarSign, Layers, Tag, CalendarDays, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/fee-structure")({
  head: () => ({ meta: [{ title: "Fee Structure - SRMS" }] }),
  component: FeeStructurePage,
});

type FeeItem = { id: string; category: string; grade: string; amount: number; frequency: "Per term" | "Annual" | "Once-off"; status: "Active" | "Inactive" };
type Levy = { id: string; name: string; amount: number; grade: string; mandatory: boolean };
type Discount = { id: string; name: string; type: "Percentage" | "Fixed"; value: number; condition: string; active: boolean };
type BillingRule = { id: string; term: string; dueDate: string; lateFee: number; reminderDays: number };

// Zambia 2025: Secondary uses Form 1-6 (O-Level Form 1-4, A-Level Form 5-6); Primary Grade 1-6
const GRADES = ["All forms", "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
const FEE_CATEGORIES = ["Tuition", "Boarding", "Exam registration", "Sport", "ICT", "Library", "Uniform", "Other"];

function FeeStructurePage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();
  const emptyBillingForm = { term: "Term 1", dueDate: "", lateFee: "", reminderDays: "7", gracePeriodDays: "0", lateFeeMethod: "Fixed amount", maxPenalty: "" };

  const { data: structuresData = [], isLoading: feesLoading } = useQuery({
    queryKey: ["fee-structures", schoolId],
    queryFn: () => api.fees.structures(schoolId),
  });
  const { data: leviesRaw = [] } = useQuery({
    queryKey: ["fee-levies", schoolId],
    queryFn: () => api.fees.levies(schoolId),
  });
  const { data: discountsRaw = [] } = useQuery({
    queryKey: ["fee-discounts", schoolId],
    queryFn: () => api.fees.discounts(schoolId),
  });
  const { data: billingRaw = [] } = useQuery({
    queryKey: ["fee-billing-rules", schoolId],
    queryFn: () => api.fees.billingRules(schoolId),
  });

  const createFeeMutation = useMutation({
    mutationFn: (data: any) => api.fees.createStructure(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fee-structures", schoolId] });
      toast.success(`Fee item added`);
      setFeeForm({ category: FEE_CATEGORIES[0], customCategory: "", grade: GRADES[1], amount: "", frequency: "Per term", academicYear: "2026", term: "Term 2", dueDate: "", latePenaltyAmount: "", penaltyGraceDays: "7", notes: "" });
      setFeeOpen(false);
    },
    onError: () => toast.error("Failed to add fee item"),
  });
  const updateFeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.fees.updateStructure(schoolId, id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["fee-structures", schoolId] }),
  });
  const createLevyMutation = useMutation({
    mutationFn: (data: any) => api.fees.createLevy(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fee-levies", schoolId] });
      toast.success("Levy added");
      setLevyForm({ name: "", amount: "", grade: GRADES[0], mandatory: true, description: "", applicableTo: "All students", effectiveFrom: "" });
      setLevyOpen(false);
    },
    onError: () => toast.error("Failed to add levy"),
  });
  const deleteLevyMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.fees.deleteLevy(schoolId, id),
    onSuccess: (_: any, { name }: { id: string; name: string }) => {
      void qc.invalidateQueries({ queryKey: ["fee-levies", schoolId] });
      toast.success(`${name} removed`);
    },
    onError: () => toast.error("Failed to remove levy"),
  });
  const createDiscountMutation = useMutation({
    mutationFn: (data: any) => api.fees.createDiscount(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fee-discounts", schoolId] });
      toast.success("Discount rule added");
      setDiscountForm({ name: "", type: "Percentage", value: "", condition: "", maxBeneficiaries: "", validFrom: "", validTo: "", requiresBoardApproval: "no" });
      setDiscountOpen(false);
    },
    onError: () => toast.error("Failed to add discount rule"),
  });
  const updateDiscountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.fees.updateDiscount(schoolId, id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["fee-discounts", schoolId] }),
  });
  const createBillingRuleMutation = useMutation({
    mutationFn: (data: any) => api.fees.createBillingRule(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fee-billing-rules", schoolId] });
      toast.success("Billing rule added");
      setBillingForm(emptyBillingForm);
      setEditingBillingId(null);
      setBillingOpen(false);
    },
    onError: () => toast.error("Failed to add billing rule"),
  });
  const updateBillingRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.fees.updateBillingRule(schoolId, id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fee-billing-rules", schoolId] });
      toast.success("Billing rule updated");
      setBillingForm(emptyBillingForm);
      setEditingBillingId(null);
      setBillingOpen(false);
    },
    onError: () => toast.error("Failed to update billing rule"),
  });

  const rawFees = structuresData as any[];
  const fees: FeeItem[] = rawFees.map((f: any) => {
    const grade = f.gradeFrom === f.gradeTo
      ? (f.gradeFrom <= 6 ? `Form ${f.gradeFrom}` : `Grade ${f.gradeFrom}`)
      : f.gradeFrom === 1 && f.gradeTo === 6 ? "All forms" : `Form ${f.gradeFrom}-${f.gradeTo}`;
    return {
      id: f.id,
      category: f.name ?? f.category ?? "Tuition",
      grade: f.grade ?? grade,
      amount: f.termFee ?? f.amount ?? 0,
      frequency: "Per term" as FeeItem["frequency"],
      status: (f.active === false ? "Inactive" : "Active") as FeeItem["status"],
    };
  });

  const levies: Levy[] = (leviesRaw as any[]).map((levy) => ({
    id: levy.id,
    name: levy.name ?? "",
    amount: Number(levy.amount ?? 0),
    grade: levy.grade ?? "All grades",
    mandatory: levy.mandatory !== false,
  }));
  const discounts: Discount[] = (discountsRaw as any[]).map((discount) => ({
    id: discount.id,
    name: discount.name ?? "",
    type: (discount.type ?? "Percentage") as Discount["type"],
    value: Number(discount.value ?? 0),
    condition: discount.condition ?? "-",
    active: discount.active !== false,
  }));
  const billing: BillingRule[] = (billingRaw as any[]).map((rule) => ({
    id: rule.id,
    term: rule.term ?? "",
    dueDate: rule.dueDate ?? "",
    lateFee: Number(rule.lateFee ?? 0),
    reminderDays: Number(rule.reminderDays ?? 0),
  }));
  const billingPolicy = (billingRaw as any[])[0] ?? null;

  const [feeOpen, setFeeOpen] = useState(false);
  const [levyOpen, setLevyOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [editingBillingId, setEditingBillingId] = useState<string | null>(null);

  const [feeForm, setFeeForm] = useState({ category: FEE_CATEGORIES[0], customCategory: "", grade: GRADES[1], amount: "", frequency: "Per term" as FeeItem["frequency"], academicYear: "2026", term: "Term 2", dueDate: "", latePenaltyAmount: "", penaltyGraceDays: "7", notes: "" });
  const [levyForm, setLevyForm] = useState({ name: "", amount: "", grade: GRADES[0], mandatory: true, description: "", applicableTo: "All students", effectiveFrom: "" });
  const [discountForm, setDiscountForm] = useState({ name: "", type: "Percentage" as Discount["type"], value: "", condition: "", maxBeneficiaries: "", validFrom: "", validTo: "", requiresBoardApproval: "no" });
  const [billingForm, setBillingForm] = useState(emptyBillingForm);

  const activeCount = fees.filter((f) => f.status === "Active").length;
  const avgTermFee = Math.round(fees.filter((f) => f.category === "Tuition" && f.status === "Active").reduce((s, f) => s + f.amount, 0) / Math.max(1, fees.filter((f) => f.category === "Tuition" && f.status === "Active").length));

  const addFee = () => {
    if (!feeForm.amount || Number(feeForm.amount) <= 0) { toast.error("Amount must be a positive number"); return; }
    const cat = feeForm.category === "__other__"
      ? feeForm.customCategory.trim()
      : feeForm.category;
    if (!cat) { toast.error("Please enter a custom category name"); return; }
    const gradeNum = parseInt(feeForm.grade.replace(/\D/g, ""), 10) || 1;
    const isAllGrades = feeForm.grade === "All forms";
    createFeeMutation.mutate({
      name: `${feeForm.grade} ${cat}`,
      gradeFrom: isAllGrades ? 1 : gradeNum,
      gradeTo: isAllGrades ? 6 : gradeNum,
      termFee: Number(feeForm.amount),
      annualFee: Number(feeForm.amount) * 3,
      term: feeForm.term,
      academicYear: Number(feeForm.academicYear) || 2026,
      dueDate: feeForm.dueDate || null,
      latePenaltyAmount: Number(feeForm.latePenaltyAmount) || null,
      penaltyGraceDays: Number(feeForm.penaltyGraceDays) || 7,
      notes: feeForm.notes.trim() || null,
      active: true,
    });
  };

  const addLevy = () => {
    if (!levyForm.name.trim() || !levyForm.amount || Number(levyForm.amount) <= 0) { toast.error("Name and a valid amount are required"); return; }
    createLevyMutation.mutate({
      name: levyForm.name.trim(),
      amount: Number(levyForm.amount),
      grade: levyForm.grade,
      mandatory: levyForm.mandatory,
      description: levyForm.description.trim() || null,
      applicableTo: levyForm.applicableTo,
      effectiveFrom: levyForm.effectiveFrom || null,
    });
  };

  const addDiscount = () => {
    if (!discountForm.name.trim() || !discountForm.value || Number(discountForm.value) <= 0) { toast.error("Name and a valid value are required"); return; }
    createDiscountMutation.mutate({
      name: discountForm.name.trim(),
      type: discountForm.type,
      value: Number(discountForm.value),
      condition: discountForm.condition.trim() || null,
      active: true,
      maxBeneficiaries: Number(discountForm.maxBeneficiaries) || null,
      validFrom: discountForm.validFrom || null,
      validTo: discountForm.validTo || null,
      requiresBoardApproval: discountForm.requiresBoardApproval === "yes",
    });
  };

  const toggleFeeStatus = (id: string) => {
    const fee = fees.find((f) => f.id === id);
    if (!fee) return;
    const nextActive = fee.status !== "Active";
    updateFeeMutation.mutate({ id, data: { active: nextActive } });
    toast.success(`Fee ${nextActive ? "activated" : "deactivated"}`);
  };

  const toggleDiscount = (id: string) => {
    const discount = discounts.find((item) => item.id === id);
    if (!discount) return;
    updateDiscountMutation.mutate({ id, data: { active: !discount.active } });
    toast.success(`${discount.name} ${discount.active ? "deactivated" : "activated"}`);
  };

  const openBillingDialog = (rule?: BillingRule) => {
    if (!rule) {
      setEditingBillingId(null);
      setBillingForm(emptyBillingForm);
    } else {
      const rawRule = (billingRaw as any[]).find((item) => item.id === rule.id);
      setEditingBillingId(rule.id);
      setBillingForm({
        term: rule.term || "Term 1",
        dueDate: rule.dueDate || "",
        lateFee: `${rule.lateFee || 0}`,
        reminderDays: `${rule.reminderDays || 0}`,
        gracePeriodDays: `${rawRule?.gracePeriodDays ?? 0}`,
        lateFeeMethod: rawRule?.lateFeeMethod ?? "Fixed amount",
        maxPenalty: rawRule?.maxPenalty != null ? `${rawRule.maxPenalty}` : "",
      });
    }
    setBillingOpen(true);
  };

  const saveBillingRule = () => {
    if (!billingForm.term.trim() || !billingForm.dueDate.trim()) {
      toast.error("Term and due date are required");
      return;
    }

    const payload = {
      term: billingForm.term.trim(),
      dueDate: billingForm.dueDate.trim(),
      lateFee: Number(billingForm.lateFee) || 0,
      reminderDays: Number(billingForm.reminderDays) || 0,
      gracePeriodDays: Number(billingForm.gracePeriodDays) || 0,
      lateFeeMethod: billingForm.lateFeeMethod,
      maxPenalty: billingForm.maxPenalty ? Number(billingForm.maxPenalty) : null,
    };

    if (editingBillingId) {
      updateBillingRuleMutation.mutate({ id: editingBillingId, data: payload });
      return;
    }
    createBillingRuleMutation.mutate(payload);
  };

  return (
    <AccessGuard module="fee-structure">
      <div className="space-y-6">
      <PageHeader
        title="Fee Structure"
        description="Configure tuition tariffs, levies, discount rules, and term billing schedules."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/fees">Collections</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/bursaries">Bursaries</Link>
            </Button>
            <Button variant="outline" onClick={() => toast.success("Fee schedule exported to PDF")}>Export schedule</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active fee items" value={activeCount} accent="primary" icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Levy types" value={levies.length} accent="accent" icon={<Layers className="h-4 w-4" />} />
        <StatCard label="Avg tuition / term" value={`K ${avgTermFee.toLocaleString()}`} hint="Across all grades" accent="success" icon={<Tag className="h-4 w-4" />} />
        <StatCard label="Discount rules" value={discounts.filter((d) => d.active).length} hint="Active" accent="warning" icon={<CalendarDays className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="tariff">
        <TabsList>
          <TabsTrigger value="tariff">Tariff schedule</TabsTrigger>
          <TabsTrigger value="levies">Levies</TabsTrigger>
          <TabsTrigger value="discounts">Discounts & bursaries</TabsTrigger>
          <TabsTrigger value="billing">Billing schedule</TabsTrigger>
        </TabsList>

        {/* TARIFF */}
        <TabsContent value="tariff" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Add fee</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add fee item</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select value={feeForm.category} onValueChange={(v) => setFeeForm({ ...feeForm, category: v, customCategory: "" })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FEE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="__other__">Other (custom)…</SelectItem>
                      </SelectContent>
                    </Select>
                    {feeForm.category === "__other__" && (
                      <Input
                        className="mt-2"
                        placeholder="e.g. Development fund"
                        value={feeForm.customCategory}
                        onChange={(e) => setFeeForm({ ...feeForm, customCategory: e.target.value })}
                        maxLength={60}
                        autoFocus
                      />
                    )}
                  </div>
                  <div>
                    <Label>Grade</Label>
                    <Select value={feeForm.grade} onValueChange={(v) => setFeeForm({ ...feeForm, grade: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (K) *</Label>
                    <Input className="mt-1" type="number" min={1} value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} placeholder="3200" />
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Select value={feeForm.frequency} onValueChange={(v) => setFeeForm({ ...feeForm, frequency: v as FeeItem["frequency"] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Per term", "Annual", "Once-off"] as const).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Academic year</Label>
                    <Input className="mt-1" value={feeForm.academicYear} onChange={(e) => setFeeForm({ ...feeForm, academicYear: e.target.value })} placeholder="2026" maxLength={4} />
                  </div>
                  <div>
                    <Label>Applicable term</Label>
                    <Select value={feeForm.term} onValueChange={(v) => setFeeForm({ ...feeForm, term: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Term 1", "Term 2", "Term 3", "All terms"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payment due date</Label>
                    <Input type="date" className="mt-1" value={feeForm.dueDate} onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Late penalty (K)</Label>
                    <Input type="number" min={0} className="mt-1" value={feeForm.latePenaltyAmount} onChange={(e) => setFeeForm({ ...feeForm, latePenaltyAmount: e.target.value })} placeholder="250" />
                  </div>
                  <div>
                    <Label>Penalty grace period (days)</Label>
                    <Input type="number" min={0} className="mt-1" value={feeForm.penaltyGraceDays} onChange={(e) => setFeeForm({ ...feeForm, penaltyGraceDays: e.target.value })} placeholder="7" />
                  </div>
                  <div className="col-span-2">
                    <Label>Notes / conditions</Label>
                    <Input className="mt-1" value={feeForm.notes} onChange={(e) => setFeeForm({ ...feeForm, notes: e.target.value })} placeholder="e.g. Waived for bursary holders; boarding fee inclusive of meals" maxLength={200} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setFeeOpen(false)}>Cancel</Button>
                  <Button onClick={addFee} disabled={createFeeMutation.isPending}>
                    {createFeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add fee
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {feesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading fee structure…</span>
            </div>
          ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Category</TableHead><TableHead>Grade</TableHead><TableHead>Amount</TableHead>
              <TableHead>Frequency</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {fees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.category}</TableCell>
                  <TableCell>{f.grade}</TableCell>
                  <TableCell>K {f.amount.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary">{f.frequency}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={f.status === "Active" ? "default" : "outline"}>{f.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleFeeStatus(f.id)}>
                      {f.status === "Active" ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {fees.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No fee items configured.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </TabsContent>

        {/* LEVIES */}
        <TabsContent value="levies" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={levyOpen} onOpenChange={setLevyOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Add levy</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add levy</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Levy name *</Label>
                    <Input className="mt-1" value={levyForm.name} onChange={(e) => setLevyForm({ ...levyForm, name: e.target.value })} placeholder="Environmental sanitation levy" maxLength={80} />
                  </div>
                  <div>
                    <Label>Amount (K) *</Label>
                    <Input className="mt-1" type="number" min={1} value={levyForm.amount} onChange={(e) => setLevyForm({ ...levyForm, amount: e.target.value })} placeholder="100" />
                  </div>
                  <div>
                    <Label>Applies to</Label>
                    <Select value={levyForm.grade} onValueChange={(v) => setLevyForm({ ...levyForm, grade: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Applicable to</Label>
                    <Select value={levyForm.applicableTo} onValueChange={(v) => setLevyForm({ ...levyForm, applicableTo: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["All students", "Boarding students", "Day scholars", "Sport participants", "ICT users", "Library members"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Effective from</Label>
                    <Input type="date" className="mt-1" value={levyForm.effectiveFrom} onChange={(e) => setLevyForm({ ...levyForm, effectiveFrom: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Description / purpose</Label>
                    <Input className="mt-1" value={levyForm.description} onChange={(e) => setLevyForm({ ...levyForm, description: e.target.value })} placeholder="Describe what this levy covers and how funds are used" maxLength={200} />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Mandatory</p>
                      <p className="text-xs text-muted-foreground">Cannot be waived by parents</p>
                    </div>
                    <Switch checked={levyForm.mandatory} onCheckedChange={(v) => setLevyForm({ ...levyForm, mandatory: v })} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setLevyOpen(false)}>Cancel</Button>
                  <Button onClick={addLevy}>Add levy</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Levy name</TableHead><TableHead>Amount</TableHead><TableHead>Applies to</TableHead>
              <TableHead>Mandatory</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {levies.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>K {l.amount.toLocaleString()}</TableCell>
                  <TableCell>{l.grade}</TableCell>
                  <TableCell>
                    <Badge variant={l.mandatory ? "default" : "secondary"}>{l.mandatory ? "Mandatory" : "Optional"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => deleteLevyMutation.mutate({ id: l.id, name: l.name })}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* DISCOUNTS */}
        <TabsContent value="discounts" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Add discount rule</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add discount rule</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Rule name *</Label>
                    <Input className="mt-1" value={discountForm.name} onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })} placeholder="Orphan & vulnerable child bursary" maxLength={80} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={discountForm.type} onValueChange={(v) => setDiscountForm({ ...discountForm, type: v as Discount["type"] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Percentage", "Fixed"] as const).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value {discountForm.type === "Percentage" ? "(%)" : "(K)"} *</Label>
                    <Input className="mt-1" type="number" min={1} max={discountForm.type === "Percentage" ? 100 : undefined} value={discountForm.value} onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })} placeholder="10" />
                  </div>
                  <div>
                    <Label>Max beneficiaries</Label>
                    <Input type="number" min={0} className="mt-1" value={discountForm.maxBeneficiaries} onChange={(e) => setDiscountForm({ ...discountForm, maxBeneficiaries: e.target.value })} placeholder="Unlimited if blank" />
                  </div>
                  <div>
                    <Label>Board approval required</Label>
                    <Select value={discountForm.requiresBoardApproval} onValueChange={(v) => setDiscountForm({ ...discountForm, requiresBoardApproval: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No - automatic on eligibility</SelectItem>
                        <SelectItem value="yes">Yes - requires board sign-off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valid from</Label>
                    <Input type="date" className="mt-1" value={discountForm.validFrom} onChange={(e) => setDiscountForm({ ...discountForm, validFrom: e.target.value })} />
                  </div>
                  <div>
                    <Label>Valid to</Label>
                    <Input type="date" className="mt-1" value={discountForm.validTo} onChange={(e) => setDiscountForm({ ...discountForm, validTo: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Condition / eligibility criteria</Label>
                    <Input className="mt-1" value={discountForm.condition} onChange={(e) => setDiscountForm({ ...discountForm, condition: e.target.value })} placeholder="Verified by school management; must provide documentary proof" maxLength={200} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancel</Button>
                  <Button onClick={addDiscount}>Add rule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Rule</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead>
              <TableHead>Condition</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Toggle</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {discounts.map((d) => (
                <TableRow key={d.id} className={!d.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="outline">{d.type}</Badge></TableCell>
                  <TableCell className="font-mono">{d.type === "Percentage" ? `${d.value}%` : `K ${d.value.toLocaleString()}`}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{d.condition}</TableCell>
                  <TableCell>
                    <Badge variant={d.active ? "default" : "secondary"}>{d.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch checked={d.active} onCheckedChange={() => toggleDiscount(d.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* BILLING SCHEDULE */}
        <TabsContent value="billing" className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-xs text-muted-foreground">Term billing rules determine fee due dates, late payment penalties, and automated reminder schedules sent to parents.</p>
            <Dialog open={billingOpen} onOpenChange={(open) => {
              setBillingOpen(open);
              if (!open) {
                setEditingBillingId(null);
                setBillingForm(emptyBillingForm);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => openBillingDialog()}><Plus className="mr-1 h-3.5 w-3.5" />Add billing rule</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>{editingBillingId ? "Edit billing rule" : "Add billing rule"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Term *</Label>
                    <Select value={billingForm.term} onValueChange={(v) => setBillingForm({ ...billingForm, term: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Term 1", "Term 2", "Term 3", "All terms"].map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due date *</Label>
                    <Input className="mt-1" value={billingForm.dueDate} onChange={(e) => setBillingForm({ ...billingForm, dueDate: e.target.value })} placeholder="2026-04-28" />
                  </div>
                  <div>
                    <Label>Late fee (K)</Label>
                    <Input type="number" min={0} className="mt-1" value={billingForm.lateFee} onChange={(e) => setBillingForm({ ...billingForm, lateFee: e.target.value })} />
                  </div>
                  <div>
                    <Label>Reminder days</Label>
                    <Input type="number" min={0} className="mt-1" value={billingForm.reminderDays} onChange={(e) => setBillingForm({ ...billingForm, reminderDays: e.target.value })} />
                  </div>
                  <div>
                    <Label>Grace period days</Label>
                    <Input type="number" min={0} className="mt-1" value={billingForm.gracePeriodDays} onChange={(e) => setBillingForm({ ...billingForm, gracePeriodDays: e.target.value })} />
                  </div>
                  <div>
                    <Label>Late fee method</Label>
                    <Select value={billingForm.lateFeeMethod} onValueChange={(v) => setBillingForm({ ...billingForm, lateFeeMethod: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Fixed amount", "Percentage", "Compound"].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Maximum penalty (K)</Label>
                    <Input type="number" min={0} className="mt-1" value={billingForm.maxPenalty} onChange={(e) => setBillingForm({ ...billingForm, maxPenalty: e.target.value })} placeholder="Optional cap per term" />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setBillingOpen(false)}>Cancel</Button>
                  <Button onClick={saveBillingRule} disabled={createBillingRuleMutation.isPending || updateBillingRuleMutation.isPending}>
                    {editingBillingId ? "Save changes" : "Add billing rule"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Term</TableHead><TableHead>Due date</TableHead><TableHead>Late fee (K)</TableHead>
              <TableHead>Reminder (days before)</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {billing.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.term}</TableCell>
                  <TableCell>{b.dueDate}</TableCell>
                  <TableCell>K {b.lateFee.toLocaleString()}</TableCell>
                  <TableCell>{b.reminderDays} days</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openBillingDialog(b)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
              {billing.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No billing rules configured.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="border-t border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Late fee policy</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { label: "Grace period", value: billingPolicy?.gracePeriodDays ? `${billingPolicy.gracePeriodDays} days after due date` : "Not configured" },
                { label: "Late fee method", value: billingPolicy?.lateFeeMethod ?? "Not configured" },
                { label: "Maximum penalties", value: billingPolicy?.maxPenalty ? `Capped at K ${Number(billingPolicy.maxPenalty).toLocaleString()} / term` : "Not configured" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
