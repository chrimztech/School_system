import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DollarSign, Layers, Tag, CalendarDays, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Box, Button, Chip, Switch, MenuItem, Tab, Tabs, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx } from "@/lib/utils";

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
  const [tab, setTab] = useState("tariff");

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
            <Button variant="outlined" component={Link} to="/fees">Collections</Button>
            <Button variant="outlined" component={Link} to="/bursaries">Bursaries</Button>
            <Button variant="outlined" onClick={() => { window.print(); toast.success("Fee schedule exported to PDF"); }}>Export schedule</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active fee items" value={activeCount} accent="primary" icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Levy types" value={levies.length} accent="accent" icon={<Layers className="h-4 w-4" />} />
        <StatCard label="Avg tuition / term" value={`K ${avgTermFee.toLocaleString()}`} hint="Across all grades" accent="success" icon={<Tag className="h-4 w-4" />} />
        <StatCard label="Discount rules" value={discounts.filter((d) => d.active).length} hint="Active" accent="warning" icon={<CalendarDays className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="tariff" label="Tariff schedule" />
        <Tab value="levies" label="Levies" />
        <Tab value="discounts" label="Discounts & bursaries" />
        <Tab value="billing" label="Billing schedule" />
      </Tabs>

      {/* TARIFF */}
      {tab === "tariff" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setFeeOpen(true)}>Add fee</Button>
            <Dialog open={feeOpen} onClose={() => setFeeOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Add fee item</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <TextField
                      select
                      label="Category"
                      value={feeForm.category}
                      onChange={(e) => setFeeForm({ ...feeForm, category: e.target.value, customCategory: "" })}
                      fullWidth
                      size="small"
                    >
                      {FEE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      <MenuItem value="__other__">Other (custom)…</MenuItem>
                    </TextField>
                    {feeForm.category === "__other__" && (
                      <TextField
                        className="mt-2"
                        placeholder="e.g. Development fund"
                        value={feeForm.customCategory}
                        onChange={(e) => setFeeForm({ ...feeForm, customCategory: e.target.value })}
                        slotProps={{ htmlInput: { maxLength: 60 } }}
                        autoFocus
                        fullWidth
                        size="small"
                      />
                    )}
                  </div>
                  <TextField
                    select
                    label="Grade"
                    value={feeForm.grade}
                    onChange={(e) => setFeeForm({ ...feeForm, grade: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="number"
                    label="Amount (K) *"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={feeForm.amount}
                    onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })}
                    placeholder="3200"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Frequency"
                    value={feeForm.frequency}
                    onChange={(e) => setFeeForm({ ...feeForm, frequency: e.target.value as FeeItem["frequency"] })}
                    fullWidth
                    size="small"
                  >
                    {(["Per term", "Annual", "Once-off"] as const).map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Academic year"
                    value={feeForm.academicYear}
                    onChange={(e) => setFeeForm({ ...feeForm, academicYear: e.target.value })}
                    placeholder="2026"
                    slotProps={{ htmlInput: { maxLength: 4 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Applicable term"
                    value={feeForm.term}
                    onChange={(e) => setFeeForm({ ...feeForm, term: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Term 1", "Term 2", "Term 3", "All terms"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="date"
                    label="Payment due date"
                    value={feeForm.dueDate}
                    onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Late penalty (K)"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={feeForm.latePenaltyAmount}
                    onChange={(e) => setFeeForm({ ...feeForm, latePenaltyAmount: e.target.value })}
                    placeholder="250"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Penalty grace period (days)"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={feeForm.penaltyGraceDays}
                    onChange={(e) => setFeeForm({ ...feeForm, penaltyGraceDays: e.target.value })}
                    placeholder="7"
                    fullWidth
                    size="small"
                  />
                  <div className="col-span-2">
                    <TextField
                      label="Notes / conditions"
                      value={feeForm.notes}
                      onChange={(e) => setFeeForm({ ...feeForm, notes: e.target.value })}
                      placeholder="e.g. Waived for bursary holders; boarding fee inclusive of meals"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setFeeOpen(false)}>Cancel</Button>
                <Button onClick={addFee} disabled={createFeeMutation.isPending}>
                  {createFeeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add fee
                </Button>
              </DialogActions>
            </Dialog>
          </div>
          {feesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading fee structure…</span>
            </div>
          ) : (
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Category</TableCell><TableCell>Grade</TableCell><TableCell>Amount</TableCell>
              <TableCell>Frequency</TableCell><TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {fees.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.category}</TableCell>
                  <TableCell>{f.grade}</TableCell>
                  <TableCell>K {f.amount.toLocaleString()}</TableCell>
                  <TableCell><Chip size="small" label={f.frequency} sx={badgeSx("secondary")} /></TableCell>
                  <TableCell>
                    <Chip size="small" label={f.status} sx={badgeSx(f.status === "Active" ? "default" : "outline")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" onClick={() => toggleFeeStatus(f.id)}>
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
          </TableContainer>
          )}
        </Box>
      )}

      {/* LEVIES */}
      {tab === "levies" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setLevyOpen(true)}>Add levy</Button>
            <Dialog open={levyOpen} onClose={() => setLevyOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Add levy</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <TextField
                      label="Levy name *"
                      value={levyForm.name}
                      onChange={(e) => setLevyForm({ ...levyForm, name: e.target.value })}
                      placeholder="Environmental sanitation levy"
                      slotProps={{ htmlInput: { maxLength: 80 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <TextField
                    type="number"
                    label="Amount (K) *"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={levyForm.amount}
                    onChange={(e) => setLevyForm({ ...levyForm, amount: e.target.value })}
                    placeholder="100"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Applies to"
                    value={levyForm.grade}
                    onChange={(e) => setLevyForm({ ...levyForm, grade: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label="Applicable to"
                    value={levyForm.applicableTo}
                    onChange={(e) => setLevyForm({ ...levyForm, applicableTo: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["All students", "Boarding students", "Day scholars", "Sport participants", "ICT users", "Library members"].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="date"
                    label="Effective from"
                    value={levyForm.effectiveFrom}
                    onChange={(e) => setLevyForm({ ...levyForm, effectiveFrom: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <div className="col-span-2">
                    <TextField
                      label="Description / purpose"
                      value={levyForm.description}
                      onChange={(e) => setLevyForm({ ...levyForm, description: e.target.value })}
                      placeholder="Describe what this levy covers and how funds are used"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">Mandatory</p>
                      <p className="text-xs text-muted-foreground">Cannot be waived by parents</p>
                    </div>
                    <Switch checked={levyForm.mandatory} onChange={(e) => setLevyForm({ ...levyForm, mandatory: e.target.checked })} />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setLevyOpen(false)}>Cancel</Button>
                <Button onClick={addLevy}>Add levy</Button>
              </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Levy name</TableCell><TableCell>Amount</TableCell><TableCell>Applies to</TableCell>
              <TableCell>Mandatory</TableCell><TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {levies.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>K {l.amount.toLocaleString()}</TableCell>
                  <TableCell>{l.grade}</TableCell>
                  <TableCell>
                    <Chip size="small" label={l.mandatory ? "Mandatory" : "Optional"} sx={badgeSx(l.mandatory ? "default" : "secondary")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" onClick={() => deleteLevyMutation.mutate({ id: l.id, name: l.name })}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {/* DISCOUNTS */}
      {tab === "discounts" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setDiscountOpen(true)}>Add discount rule</Button>
            <Dialog open={discountOpen} onClose={() => setDiscountOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Add discount rule</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <TextField
                      label="Rule name *"
                      value={discountForm.name}
                      onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                      placeholder="Orphan & vulnerable child bursary"
                      slotProps={{ htmlInput: { maxLength: 80 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <TextField
                    select
                    label="Type"
                    value={discountForm.type}
                    onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value as Discount["type"] })}
                    fullWidth
                    size="small"
                  >
                    {(["Percentage", "Fixed"] as const).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="number"
                    label={`Value ${discountForm.type === "Percentage" ? "(%)" : "(K)"} *`}
                    slotProps={{ htmlInput: { min: 1, max: discountForm.type === "Percentage" ? 100 : undefined } }}
                    value={discountForm.value}
                    onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                    placeholder="10"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Max beneficiaries"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={discountForm.maxBeneficiaries}
                    onChange={(e) => setDiscountForm({ ...discountForm, maxBeneficiaries: e.target.value })}
                    placeholder="Unlimited if blank"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Board approval required"
                    value={discountForm.requiresBoardApproval}
                    onChange={(e) => setDiscountForm({ ...discountForm, requiresBoardApproval: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="no">No - automatic on eligibility</MenuItem>
                    <MenuItem value="yes">Yes - requires board sign-off</MenuItem>
                  </TextField>
                  <TextField
                    type="date"
                    label="Valid from"
                    value={discountForm.validFrom}
                    onChange={(e) => setDiscountForm({ ...discountForm, validFrom: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="date"
                    label="Valid to"
                    value={discountForm.validTo}
                    onChange={(e) => setDiscountForm({ ...discountForm, validTo: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <div className="col-span-2">
                    <TextField
                      label="Condition / eligibility criteria"
                      value={discountForm.condition}
                      onChange={(e) => setDiscountForm({ ...discountForm, condition: e.target.value })}
                      placeholder="Verified by school management; must provide documentary proof"
                      slotProps={{ htmlInput: { maxLength: 200 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setDiscountOpen(false)}>Cancel</Button>
                <Button onClick={addDiscount}>Add rule</Button>
              </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Rule</TableCell><TableCell>Type</TableCell><TableCell>Value</TableCell>
              <TableCell>Condition</TableCell><TableCell>Active</TableCell><TableCell className="text-right">Toggle</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {discounts.map((d) => (
                <TableRow key={d.id} className={!d.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Chip size="small" label={d.type} sx={badgeSx("outline")} /></TableCell>
                  <TableCell className="font-mono">{d.type === "Percentage" ? `${d.value}%` : `K ${d.value.toLocaleString()}`}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{d.condition}</TableCell>
                  <TableCell>
                    <Chip size="small" label={d.active ? "Active" : "Inactive"} sx={badgeSx(d.active ? "default" : "secondary")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch checked={d.active} onChange={() => toggleDiscount(d.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {/* BILLING SCHEDULE */}
      {tab === "billing" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-xs text-muted-foreground">Term billing rules determine fee due dates, late payment penalties, and automated reminder schedules sent to parents.</p>
            <Button size="small" onClick={() => openBillingDialog()} startIcon={<Plus className="h-3.5 w-3.5" />}>Add billing rule</Button>
            <Dialog
              open={billingOpen}
              onClose={() => {
                setBillingOpen(false);
                setEditingBillingId(null);
                setBillingForm(emptyBillingForm);
              }}
              maxWidth="lg"
              fullWidth
            >
              <DialogTitle>{editingBillingId ? "Edit billing rule" : "Add billing rule"}</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    select
                    label="Term *"
                    value={billingForm.term}
                    onChange={(e) => setBillingForm({ ...billingForm, term: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Term 1", "Term 2", "Term 3", "All terms"].map((term) => <MenuItem key={term} value={term}>{term}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Due date *"
                    value={billingForm.dueDate}
                    onChange={(e) => setBillingForm({ ...billingForm, dueDate: e.target.value })}
                    placeholder="2026-04-28"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Late fee (K)"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={billingForm.lateFee}
                    onChange={(e) => setBillingForm({ ...billingForm, lateFee: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Reminder days"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={billingForm.reminderDays}
                    onChange={(e) => setBillingForm({ ...billingForm, reminderDays: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="number"
                    label="Grace period days"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={billingForm.gracePeriodDays}
                    onChange={(e) => setBillingForm({ ...billingForm, gracePeriodDays: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Late fee method"
                    value={billingForm.lateFeeMethod}
                    onChange={(e) => setBillingForm({ ...billingForm, lateFeeMethod: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Fixed amount", "Percentage", "Compound"].map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
                  </TextField>
                  <div className="col-span-2">
                    <TextField
                      type="number"
                      label="Maximum penalty (K)"
                      slotProps={{ htmlInput: { min: 0 } }}
                      value={billingForm.maxPenalty}
                      onChange={(e) => setBillingForm({ ...billingForm, maxPenalty: e.target.value })}
                      placeholder="Optional cap per term"
                      fullWidth
                      size="small"
                    />
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setBillingOpen(false)}>Cancel</Button>
                <Button onClick={saveBillingRule} disabled={createBillingRuleMutation.isPending || updateBillingRuleMutation.isPending}>
                  {editingBillingId ? "Save changes" : "Add billing rule"}
                </Button>
              </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Term</TableCell><TableCell>Due date</TableCell><TableCell>Late fee (K)</TableCell>
              <TableCell>Reminder (days before)</TableCell><TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {billing.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.term}</TableCell>
                  <TableCell>{b.dueDate}</TableCell>
                  <TableCell>K {b.lateFee.toLocaleString()}</TableCell>
                  <TableCell>{b.reminderDays} days</TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" onClick={() => openBillingDialog(b)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
              {billing.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No billing rules configured.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
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
        </Box>
      )}
      </Box>
    </div>
    </AccessGuard>
  );
}
