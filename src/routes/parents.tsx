import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import {
  Search, Mail, Phone, MessageSquare, CreditCard,
  FileText, Receipt, GraduationCap, Printer, Download,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/utils";
import { SchoolDocumentHeader } from "@/components/school-document-header";

export const Route = createFileRoute("/parents")({
  head: () => ({ meta: [{ title: "Parents — SRMS" }] }),
  component: ParentsPage,
});

type GuardianRecord = {
  name: string;
  relationship: string;
  phone: string;
  altPhone: string;
  email: string;
  children: any[];
};

type ChildBalance = {
  child: any;
  structure: any | null;
  termFee: number;
  paid: number;
  outstanding: number;
  payments: any[];
};

const PAYMENT_METHODS = ["Cash", "Mobile Money", "Bank Transfer", "Cheque"];

function gradeNum(grade: any): number {
  if (typeof grade === "number") return grade;
  const m = String(grade ?? "").match(/\d+/);
  return m ? parseInt(m[0]) : 0;
}

function fmtK(n: number) {
  return `K ${n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function ParentsPage() {
  const { active } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedParent, setSelectedParent] = useState<GuardianRecord | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", active.id],
    queryFn: () => api.students.list(active.id),
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ["school-users", active.id],
    queryFn: () => api.users.list(active.id),
  });
  const userEmails = new Set((appUsers as any[]).map((u: any) => (u.email ?? "").toLowerCase()));

  const createLoginMutation = useMutation({
    mutationFn: ({ name, email }: { name: string; email: string }) =>
      api.users.create(active.id, { name, email, role: "PARENT" }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["school-users", active.id] });
      toast.success(`Login created — ${vars.email} / password123`);
    },
    onError: () => toast.error("Could not create login — email may already be registered"),
  });

  const { data: structures = [] } = useQuery({
    queryKey: ["fee-structures", active.id],
    queryFn: () => api.fees.structures(active.id),
  });

  const guardianMap = new Map<string, GuardianRecord>();
  for (const student of students as any[]) {
    const guardianName: string = student.guardian || student.guardianName || "";
    if (!guardianName) continue;
    const phone: string = student.guardianPhone || "";
    const altPhone: string = student.guardianAltPhone || "";
    const email: string = student.guardianEmail || "";
    const relationship: string = student.guardianRelationship || "";
    if (guardianMap.has(guardianName)) {
      const existing = guardianMap.get(guardianName)!;
      existing.children.push(student);
      if (!existing.relationship && relationship) existing.relationship = relationship;
      if (!existing.altPhone && altPhone) existing.altPhone = altPhone;
      if (!existing.email && email) existing.email = email;
    } else {
      guardianMap.set(guardianName, { name: guardianName, relationship, phone, altPhone, email, children: [student] });
    }
  }

  const parents = Array.from(guardianMap.values());
  const filtered = parents.filter((p) =>
    `${p.name} ${p.relationship} ${p.phone} ${p.email} ${p.children.map((c) => `${c.firstName} ${c.lastName}`).join(" ")}`
      .toLowerCase().includes(q.toLowerCase())
  );
  const phoneOnlyCount = parents.filter((p) => !p.email).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents & Guardians"
        description="Contacts, fee balances, payments, invoices and report card access"
        actions={
          <>
            <Button variant="outline" onClick={() => {
              if (parents.length === 0) { toast.error("No guardian records to export"); return; }
              downloadCsv(parents.map((p) => ({
                "Guardian Name": p.name,
                Relationship: p.relationship,
                Phone: p.phone,
                "Alt Phone": p.altPhone,
                Email: p.email,
                "Number of Children": p.children.length,
                Children: p.children.map((c: any) => `${c.firstName} ${c.lastName} (${c.className || c.grade || ""})`).join("; "),
              })), `guardians-${new Date().toISOString().slice(0, 10)}`);
            }}>
              <Download className="mr-1 h-4 w-4" />Export contacts
            </Button>
            <Button onClick={() => toast.success("Communication hub coming soon")}>
              <MessageSquare className="mr-1 h-4 w-4" />Send message
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total guardians" value={parents.length} accent="primary" />
        <StatCard label="With phone" value={parents.filter((p) => p.phone).length} accent="success" />
        <StatCard label="Phone only" value={phoneOnlyCount} accent="accent" />
        <StatCard label="Students enrolled" value={(students as any[]).length} accent="warning" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, email or child" className="pl-9" />
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} of {parents.length}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guardian</TableHead>
              <TableHead>Children</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No guardian records found.</TableCell></TableRow>
            ) : filtered.map((parent, index) => (
              <TableRow
                key={`${parent.name}-${index}`}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => setSelectedParent(parent)}
              >
                <TableCell>
                  <div className="font-medium">{parent.name}</div>
                  {parent.relationship && <div className="text-xs text-muted-foreground">{parent.relationship}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-xs">
                    {parent.children.map((c) => (
                      <span key={c.id}>{c.firstName} {c.lastName} ({c.className || c.grade || ""})</span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {parent.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{parent.phone}</span>}
                    {parent.altPhone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{parent.altPhone} (alt)</span>}
                    {parent.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{parent.email}</span>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{parent.email ? "Email + phone" : "Phone"}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {parent.email && !userEmails.has(parent.email.toLowerCase()) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={createLoginMutation.isPending}
                        onClick={() => createLoginMutation.mutate({ name: parent.name, email: parent.email })}
                      >
                        Create login
                      </Button>
                    )}
                    {parent.email && userEmails.has(parent.email.toLowerCase()) && (
                      <Badge variant="secondary" className="text-xs">Has login</Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => toast.success(`Message draft opened for ${parent.name}`)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedParent && (
        <ParentPortalSheet
          parent={selectedParent}
          structures={structures as any[]}
          school={active}
          onClose={() => setSelectedParent(null)}
          onViewReportCard={(studentId) => {
            setSelectedParent(null);
            void navigate({ to: "/report-card", search: { studentId } });
          }}
        />
      )}
    </div>
  );
}

function ParentPortalSheet({
  parent, structures, school, onClose, onViewReportCard,
}: {
  parent: GuardianRecord;
  structures: any[];
  school: any;
  onClose: () => void;
  onViewReportCard: (studentId: string) => void;
}) {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("fees");
  const [payForm, setPayForm] = useState({
    studentId: parent.children[0]?.id ?? "",
    amount: "",
    method: "Cash",
    reference: "",
    description: `Term ${school.currentTerm} school fees`,
    paymentDate: todayStr(),
  });
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);
  const [paymentCleared, setPaymentCleared] = useState<{ studentName: string; amount: number } | null>(null);

  const paymentQueries = useQueries({
    queries: parent.children.map((child) => ({
      queryKey: ["student-payments", active.id, child.id],
      queryFn: () => api.fees.studentPayments(active.id, child.id),
    })),
  });

  const childBalances: ChildBalance[] = parent.children.map((child, idx) => {
    const payments: any[] = (paymentQueries[idx]?.data ?? []) as any[];
    const grade = child.className || child.grade || "";
    const n = gradeNum(grade);
    const structure = structures.find((s: any) => s.active && s.gradeFrom <= n && n <= s.gradeTo) ?? null;
    const termFee = structure?.termFee ?? 0;
    const paid = payments
      .filter((p: any) => p.status === "completed")
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    const outstanding = Math.max(termFee - paid, 0);
    return { child, structure, termFee, paid, outstanding, payments };
  });

  const totalOutstanding = childBalances.reduce((s, b) => s + b.outstanding, 0);
  const isLoadingPayments = paymentQueries.some((q) => q.isLoading);

  const payMut = useMutation({
    mutationFn: (data: any) => api.fees.recordPayment(active.id, data),
    onSuccess: (payment: any, vars: any) => {
      parent.children.forEach((c) => {
        void qc.invalidateQueries({ queryKey: ["student-payments", active.id, c.id] });
      });
      void qc.invalidateQueries({ queryKey: ["students", active.id] });
      const child = parent.children.find((c) => c.id === vars.studentId);
      const childBalance = childBalances.find((b) => b.child.id === vars.studentId);
      const remaining = childBalance ? Math.max(0, childBalance.outstanding - Number(vars.amount)) : null;
      if (remaining === 0) {
        setPaymentCleared({ studentName: `${child?.firstName ?? ""} ${child?.lastName ?? ""}`.trim(), amount: Number(vars.amount) });
        toast.success(`Account cleared — K ${Number(vars.amount).toLocaleString()} received`, { duration: 6000 });
      } else {
        toast.success(
          remaining != null
            ? `Payment of K ${Number(vars.amount).toLocaleString()} recorded · Remaining: K ${remaining.toLocaleString()}`
            : "Payment recorded",
          { duration: 5000 }
        );
      }
      setActiveTab("history");
      setReceiptPayment(payment);
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const submitPayment = () => {
    if (!payForm.studentId) { toast.error("Select a student"); return; }
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    const child = parent.children.find((c) => c.id === payForm.studentId);
    const receiptNo = `RCP-${active.id.slice(0, 6).toUpperCase()}-${Date.now()}`;
    payMut.mutate({
      schoolId: active.id,
      studentId: payForm.studentId,
      studentName: child ? `${child.firstName} ${child.lastName}` : "",
      grade: child?.className || child?.grade || "",
      amount: amt,
      method: payForm.method,
      referenceNumber: payForm.reference.trim() || null,
      description: payForm.description,
      paymentDate: payForm.paymentDate,
      feeCategory: "SCHOOL_FEES",
      receiptNumber: receiptNo,
      status: "completed",
      collectedBy: "Admin",
    });
  };

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="flex w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border px-6 py-5 shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-lg">{parent.name}</SheetTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {parent.relationship && `${parent.relationship} · `}
                  {parent.children.length} child{parent.children.length !== 1 ? "ren" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Total outstanding</p>
                <p className={`mt-0.5 text-xl font-bold ${totalOutstanding > 0 ? "text-destructive" : "text-green-600"}`}>
                  {fmtK(totalOutstanding)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {parent.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{parent.phone}</span>}
              {parent.altPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{parent.altPhone} (alt)</span>}
              {parent.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{parent.email}</span>}
            </div>
            {!isLoadingPayments && totalOutstanding > 0 && (
              <div className="mt-3 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive">Fee balance outstanding</p>
                  <p className="text-xs text-destructive/80 mt-0.5">
                    {fmtK(totalOutstanding)} is due for Term {school.currentTerm}, {school.currentYear}.
                    {childBalances.filter((b) => b.outstanding > 0).map((b) => ` ${b.child.firstName}: ${fmtK(b.outstanding)}`).join(" ·")}
                  </p>
                </div>
                <Button size="sm" className="h-7 shrink-0 text-xs" onClick={() => setActiveTab("pay")}>
                  Pay now
                </Button>
              </div>
            )}
            {!isLoadingPayments && totalOutstanding === 0 && childBalances.length > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">All fee accounts are cleared for this term</p>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 pt-4">
              <TabsList className="mb-4">
                <TabsTrigger value="fees">Fee Summary</TabsTrigger>
                <TabsTrigger value="pay">Record Payment</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="reports">Report Cards</TabsTrigger>
              </TabsList>

              {/* FEE SUMMARY */}
              <TabsContent value="fees" className="space-y-4 pb-6">
                {isLoadingPayments ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Loading balances…</p>
                ) : childBalances.map(({ child, structure, termFee, paid, outstanding }) => (
                  <div key={child.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {child.className || child.grade || "—"} · Adm: {child.admissionNumber || child.admissionNo || "—"}
                        </p>
                      </div>
                      <Badge variant={outstanding > 0 ? "destructive" : "secondary"}>
                        {outstanding > 0 ? "Balance due" : "Paid up"}
                      </Badge>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Term fee</p>
                        <p className="mt-0.5 font-medium">{structure ? fmtK(termFee) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Paid</p>
                        <p className="mt-0.5 font-medium text-green-600">{fmtK(paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
                        <p className={`mt-0.5 font-bold ${outstanding > 0 ? "text-destructive" : "text-green-600"}`}>{fmtK(outstanding)}</p>
                      </div>
                    </div>
                    {structure ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {structure.name} · Due: {structure.dueDate || "—"}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-600">No active fee structure found for this grade.</p>
                    )}
                    {outstanding > 0 && (
                      <div className="mt-3">
                        <Button size="sm" onClick={() => { setPayForm((f) => ({ ...f, studentId: child.id })); setActiveTab("pay"); }}>
                          <CreditCard className="mr-1 h-3.5 w-3.5" />Pay now
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setInvoiceOpen(true)}>
                    <FileText className="mr-1 h-4 w-4" />Generate invoice
                  </Button>
                </div>
              </TabsContent>

              {/* RECORD PAYMENT */}
              <TabsContent value="pay" className="pb-6">
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="font-semibold">Record payment</h3>
                  <div>
                    <Label>Student *</Label>
                    <Select value={payForm.studentId} onValueChange={(v) => setPayForm((f) => ({ ...f, studentId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {parent.children.map((c) => {
                          const bal = childBalances.find((b) => b.child.id === c.id);
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              {c.firstName} {c.lastName} ({c.className || c.grade || ""})
                              {bal && bal.outstanding > 0 ? ` — owes ${fmtK(bal.outstanding)}` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {payForm.studentId && (() => {
                      const bal = childBalances.find((b) => b.child.id === payForm.studentId);
                      if (!bal) return null;
                      return bal.outstanding > 0 ? (
                        <p className="mt-1.5 text-xs font-medium text-destructive">
                          Outstanding: {fmtK(bal.outstanding)} · Due {bal.structure?.dueDate || `Term ${school.currentTerm}`}
                        </p>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />Account is cleared for this term
                        </p>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Amount (K) *</Label>
                      <Input
                        type="number" className="mt-1" min={0.01} step={0.01}
                        value={payForm.amount} placeholder="0.00"
                        onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Method</Label>
                      <Select value={payForm.method} onValueChange={(v) => setPayForm((f) => ({ ...f, method: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input
                        type="date" className="mt-1" value={payForm.paymentDate}
                        onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Reference / transaction ID</Label>
                      <Input
                        className="mt-1" value={payForm.reference} placeholder="e.g. MTN-XXXX"
                        onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Description</Label>
                      <Input
                        className="mt-1" value={payForm.description}
                        onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setActiveTab("fees")}>Cancel</Button>
                    <Button onClick={submitPayment} disabled={payMut.isPending}>
                      {payMut.isPending ? "Saving…" : "Record & generate receipt"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* PAYMENT HISTORY */}
              <TabsContent value="history" className="pb-6 space-y-4">
                {paymentCleared && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Account cleared!</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                        K {paymentCleared.amount.toLocaleString()} received for {paymentCleared.studentName} — balance is fully settled for this term.
                      </p>
                    </div>
                    <button className="text-emerald-600 text-sm hover:text-emerald-800" onClick={() => setPaymentCleared(null)}>✕</button>
                  </div>
                )}
                {isLoadingPayments ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
                ) : childBalances.map(({ child, payments }) => (
                  <div key={child.id}>
                    <p className="mb-2 text-sm font-semibold">{child.firstName} {child.lastName}</p>
                    {payments.length === 0 ? (
                      <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No payments recorded yet.</p>
                    ) : (
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((p: any) => (
                              <TableRow key={p.id}>
                                <TableCell className="text-xs">{p.paymentDate || "—"}</TableCell>
                                <TableCell className="text-xs">{p.description || "—"}</TableCell>
                                <TableCell className="text-xs">{p.method || "—"}</TableCell>
                                <TableCell className="text-right font-semibold tabular-nums text-sm">{fmtK(p.amount)}</TableCell>
                                <TableCell>
                                  <Badge variant={p.status === "completed" ? "default" : "secondary"} className="text-xs capitalize">{p.status}</Badge>
                                </TableCell>
                                <TableCell>
                                  {p.status === "completed" && (
                                    <Button size="sm" variant="ghost" title="View receipt" onClick={() =>
                                      setReceiptPayment({
                                        ...p,
                                        studentName: `${child.firstName} ${child.lastName}`,
                                        grade: child.className || child.grade || "",
                                      })
                                    }>
                                      <Receipt className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </TabsContent>

              {/* REPORT CARDS */}
              <TabsContent value="reports" className="pb-6 space-y-3">
                {parent.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {child.className || child.grade || "—"} · Term {school.currentTerm}, {school.currentYear}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => onViewReportCard(child.id)}>
                      View report card
                    </Button>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {invoiceOpen && (
        <InvoiceDialog
          parent={parent}
          childBalances={childBalances}
          school={school}
          onClose={() => setInvoiceOpen(false)}
        />
      )}

      {receiptPayment && (
        <ReceiptDialog
          payment={receiptPayment}
          parent={parent}
          school={school}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </>
  );
}

function InvoiceDialog({
  parent, childBalances, school, onClose,
}: {
  parent: GuardianRecord;
  childBalances: ChildBalance[];
  school: any;
  onClose: () => void;
}) {
  const invoiceNo = `INV-${school.id.slice(0, 6).toUpperCase()}-${Date.now()}`;
  const today = new Date().toLocaleDateString("en-ZM", { day: "2-digit", month: "long", year: "numeric" });
  const totalDue = childBalances.reduce((s, b) => s + b.outstanding, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="print:hidden">
          <DialogTitle>Invoice · {invoiceNo}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-1">
        <div className="print-area space-y-4 text-sm print:text-black">
          <SchoolDocumentHeader title="INVOICE" subtitle={`${invoiceNo} · ${today} · Term ${school.currentTerm}, ${school.currentYear}`} />

          {/* Bill to */}
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To</p>
            <p className="mt-1 font-semibold">{parent.name}</p>
            {parent.relationship && <p className="text-xs text-muted-foreground">{parent.relationship}</p>}
            {parent.phone && <p className="text-xs text-muted-foreground">{parent.phone}</p>}
            {parent.email && <p className="text-xs text-muted-foreground">{parent.email}</p>}
          </div>

          {/* Per-child line items */}
          {childBalances.map(({ child, structure, termFee, paid, outstanding }) => (
            <div key={child.id} className="rounded-lg border border-border p-3">
              <p className="font-semibold">{child.firstName} {child.lastName}</p>
              <p className="mb-2 text-xs text-muted-foreground">
                {child.className || child.grade || "—"} · Adm: {child.admissionNumber || child.admissionNo || "—"}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>{structure?.name || "Term fee"} (Term {school.currentTerm})</span>
                  <span className="font-mono">{fmtK(termFee)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Payments received</span>
                  <span className="font-mono">− {fmtK(paid)}</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-semibold">
                  <span>Balance due</span>
                  <span className={`font-mono ${outstanding > 0 ? "text-destructive" : "text-green-600"}`}>{fmtK(outstanding)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="flex justify-end">
            <div className="rounded-lg bg-muted/50 px-6 py-3 text-right">
              <p className="text-xs uppercase text-muted-foreground">Total amount due</p>
              <p className={`mt-0.5 text-3xl font-bold ${totalDue > 0 ? "text-destructive" : "text-green-600"}`}>{fmtK(totalDue)}</p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Please present this invoice when making payment. Payments can be made at the school bursar's office.<br />
            Thank you for your continued support of {school.name}.
          </p>
        </div>
        </div>

        <DialogFooter className="mt-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print invoice</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  payment, parent, school, onClose,
}: {
  payment: any;
  parent: GuardianRecord;
  school: any;
  onClose: () => void;
}) {
  const dateStr = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString("en-ZM", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-ZM", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="print:hidden">
          <DialogTitle>Receipt · {payment.receiptNumber || "—"}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-1">
        <div className="print-area space-y-4 text-sm">
          <SchoolDocumentHeader title="OFFICIAL RECEIPT" subtitle={dateStr} />

          {/* Details */}
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Receipt no.</span>
              <span className="font-mono text-xs font-semibold">{payment.receiptNumber || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Date</span>
              <span className="text-xs">{dateStr}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Received from</span>
              <span className="text-xs font-medium">{parent.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Student</span>
              <span className="text-xs">{payment.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Grade</span>
              <span className="text-xs">{payment.grade}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">For</span>
              <span className="text-xs">{payment.description || "School fees"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Method</span>
              <span className="text-xs">{payment.method}</span>
            </div>
            {payment.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Reference</span>
                <span className="font-mono text-xs">{payment.referenceNumber}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Amount paid</span>
              <span className="text-2xl font-bold text-green-600">{fmtK(payment.amount)}</span>
            </div>
          </div>

          {/* Paid stamp */}
          <div className="rounded-lg border-2 border-green-500/40 bg-green-500/10 p-3 text-center">
            <p className="text-lg font-bold tracking-widest text-green-600">✓ PAID</p>
            <p className="text-xs text-muted-foreground">This receipt is official proof of payment</p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {school.name} · {school.district}, {school.province}
          </p>
        </div>
        </div>

        <DialogFooter className="mt-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
