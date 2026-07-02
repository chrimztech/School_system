import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, AlertCircle, TrendingUp, Plus, Download, Send, Loader2, Bell, CheckCircle2, Users, Printer } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { downloadCsv } from "@/lib/utils";
import { SchoolDocumentHeader } from "@/components/school-document-header";

export const Route = createFileRoute("/fees")({
  head: () => ({ meta: [{ title: "Fees & Payments — SRMS" }] }),
  component: FeesPage,
});

const METHODS = ["MTN MoMo", "Airtel Money", "Zamtel Kwacha", "Bank Transfer", "Cash", "Cheque"];
const FEE_CATEGORIES = ["Tuition", "Transport levy", "Exam fee", "Boarding", "Uniform / books", "Sports levy", "ICT levy", "NAPSA contribution", "Miscellaneous"];
const TERMS = ["Term 1 · 2026", "Term 2 · 2026", "Term 3 · 2026", "Term 1 · 2027"];

function FeesPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    studentName: "",
    grade: "",
    amount: "",
    method: METHODS[0],
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNumber: "",
    receiptNumber: "",
    collectedBy: "Finance Office",
    status: "completed",
    feeCategory: FEE_CATEGORIES[0],
    termPeriod: TERMS[0],
    latePenaltyApplied: "no",
    penaltyAmount: "",
    description: "",
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["fees-payments", schoolId],
    queryFn: () => api.fees.payments(schoolId),
  });

  const { data: summary = { collected: 0, outstanding: 0, collectionRate: 0 } } = useQuery({
    queryKey: ["fees-collected", schoolId],
    queryFn: () => api.fees.collected(schoolId),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", schoolId],
    queryFn: () => api.students.list(schoolId),
  });

  const { data: bursaries = [] } = useQuery({
    queryKey: ["bursaries", schoolId],
    queryFn: () => api.bursaries.list(schoolId),
  });
  const activeBursaryCount = (bursaries as any[]).filter((b: any) => (b.status ?? "").toLowerCase() === "active").length;

  const debtors = useMemo(() =>
    (students as any[])
      .filter((s: any) => Number(s.feeBalance ?? 0) > 0)
      .sort((a: any, b: any) => Number(b.feeBalance) - Number(a.feeBalance)),
    [students]
  );

  const sendIndividualReminder = async (student: any) => {
    setSendingReminderId(student.id);
    try {
      await api.communication.createAnnouncement(schoolId, {
        title: "Fee payment reminder",
        body: `Dear parent/guardian of ${student.firstName} ${student.lastName}, this is a reminder that a fee balance of K ${Number(student.feeBalance).toLocaleString()} is outstanding for Term ${active.currentTerm} ${active.currentYear}. Please settle this balance promptly to avoid disruption to your child's education. Contact the finance office for assistance or payment plans.`,
        audience: "All parents",
        channels: "SMS, WhatsApp",
        publishDate: new Date().toISOString().slice(0, 10),
        active: true,
      });
      toast.success(`Reminder sent for ${student.firstName} ${student.lastName}`);
    } catch {
      toast.error("Failed to send reminder");
    } finally {
      setSendingReminderId(null);
    }
  };

  const reminderMutation = useMutation({
    mutationFn: () => api.communication.createAnnouncement(schoolId, {
      title: "Fee payment reminder",
      body: debtors.length > 0
        ? `Fee payment reminder — Term ${active.currentTerm} ${active.currentYear}: The following pupils have outstanding balances: ${debtors.map((s: any) => `${s.firstName} ${s.lastName} (K ${Number(s.feeBalance).toLocaleString()})`).join(", ")}. Please settle promptly. Contact the finance office for assistance.`
        : `This is a reminder that fee payments are now due for Term ${active.currentTerm} ${active.currentYear}. Please ensure all balances are settled promptly.`,
      audience: "All parents",
      channels: "SMS, WhatsApp",
      publishDate: new Date().toISOString().slice(0, 10),
      active: true,
    }),
    onSuccess: () => {
      toast.success(`Reminders sent to ${debtors.length} parent${debtors.length !== 1 ? "s" : ""} with outstanding balances`);
      setReminderOpen(false);
    },
    onError: () => toast.error("Failed to queue reminders"),
  });

  const [lastPayment, setLastPayment] = useState<{
    studentName: string; amount: number; newBalance: number;
    receiptNumber: string; referenceNumber: string; method: string;
    feeCategory: string; termPeriod: string; paymentDate: string;
    collectedBy: string; grade: string;
  } | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const payMutation = useMutation({
    mutationFn: (data: any) => api.fees.recordPayment(schoolId, data),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ["fees-payments", schoolId] });
      qc.invalidateQueries({ queryKey: ["fees-collected", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
      const student = (students as any[]).find((s: any) => s.id === vars.studentId);
      const prevBalance = Number(student?.feeBalance ?? 0);
      const newBalance = Math.max(0, prevBalance - Number(vars.amount));
      setLastPayment({
        studentName: vars.studentName, amount: Number(vars.amount), newBalance,
        receiptNumber: vars.receiptNumber ?? "", referenceNumber: vars.referenceNumber ?? "",
        method: vars.method ?? "", feeCategory: vars.feeCategory ?? "",
        termPeriod: vars.termPeriod ?? "", paymentDate: vars.paymentDate ?? "",
        collectedBy: vars.collectedBy ?? "", grade: vars.grade ?? "",
      });
      const msg = newBalance === 0
        ? `Account cleared — K ${Number(vars.amount).toLocaleString()} received from ${vars.studentName}`
        : `Payment of K ${Number(vars.amount).toLocaleString()} recorded · Remaining balance: K ${newBalance.toLocaleString()}`;
      toast.success(msg, { duration: 6000 });
      setForm({
        studentId: "",
        studentName: "",
        grade: "",
        amount: "",
        method: METHODS[0],
        paymentDate: new Date().toISOString().slice(0, 10),
        referenceNumber: "",
        receiptNumber: "",
        collectedBy: "Finance Office",
        status: "completed",
        feeCategory: FEE_CATEGORIES[0],
        termPeriod: TERMS[0],
        latePenaltyApplied: "no",
        penaltyAmount: "",
        description: "",
      });
      setOpen(false);
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const recheckMutation = useMutation({
    mutationFn: (paymentId: string) => api.fees.paymentStatus(schoolId, paymentId),
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["fees-payments", schoolId] });
      qc.invalidateQueries({ queryKey: ["fees-collected", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
      if (result?.status === "pending") {
        toast.info("Still pending — the gateway hasn't confirmed this payment yet");
      } else {
        toast.success(`Payment status updated: ${result?.status}`);
      }
    },
    onError: () => toast.error("Could not check payment status"),
  });

  const recordPayment = () => {
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    if (!form.studentId) { toast.error("Select a student"); return; }
    payMutation.mutate({
      studentId: form.studentId,
      studentName: form.studentName,
      grade: form.grade,
      amount: Number(form.amount),
      method: form.method,
      paymentDate: form.paymentDate,
      referenceNumber: form.referenceNumber.trim() || null,
      receiptNumber: form.receiptNumber.trim() || null,
      feeCategory: form.feeCategory,
      termPeriod: form.termPeriod,
      latePenaltyApplied: form.latePenaltyApplied === "yes",
      penaltyAmount: form.latePenaltyApplied === "yes" ? (Number(form.penaltyAmount) || 0) : 0,
      description: form.description.trim() || null,
      collectedBy: form.collectedBy.trim() || null,
      status: form.status,
    });
  };

  return (
    <AccessGuard module="fees">
      <div className="space-y-6">
      <PageHeader
        title="Fees & Payments"
        description="Multi-currency (ZMW, USD) · MoMo, Airtel Money, Zamtel Kwacha and bank"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/fee-structure">Fee structure</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/bursaries">Bursaries</Link>
            </Button>
            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Send className="mr-2 h-4 w-4" />Send reminders</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Send fee reminders</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {debtors.length === 0 ? (
                    <div className="rounded-lg bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                      No students with outstanding balances.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Reminders will be sent to <strong>{debtors.length}</strong> parent{debtors.length !== 1 ? "s" : ""} via SMS and WhatsApp.</span>
                      </div>
                      <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {debtors.map((s: any) => (
                              <TableRow key={s.id}>
                                <TableCell className="text-sm">{s.firstName} {s.lastName}</TableCell>
                                <TableCell className="text-right font-semibold text-destructive text-sm">K {Number(s.feeBalance).toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">Channels</p>
                        <p>• WhatsApp (if integration active)</p>
                        <p>• SMS fallback for non-smartphone guardians</p>
                        <p>• USSD for offline households</p>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
                  <Button onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending || debtors.length === 0}>
                    {reminderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />Send to {debtors.length} parent{debtors.length !== 1 ? "s" : ""}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Record payment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Student</Label>
                    <Select value={form.studentId} onValueChange={(v) => {
                      const s = (students as any[]).find((st: any) => st.id === v);
                      setForm({ ...form, studentId: v, studentName: s ? `${s.firstName} ${s.lastName}` : "", grade: s ? `Form ${s.grade} ${s.section ?? ""}`.trim() : "" });
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {(students as any[]).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.firstName} {s.lastName}
                            {Number(s.feeBalance ?? 0) > 0 && ` · owes K ${Number(s.feeBalance).toLocaleString()}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.studentId && (() => {
                      const s = (students as any[]).find((st: any) => st.id === form.studentId);
                      const bal = Number(s?.feeBalance ?? 0);
                      return bal > 0 ? (
                        <p className="mt-1.5 text-xs font-medium text-destructive">Outstanding balance: K {bal.toLocaleString()}</p>
                      ) : bal === 0 && s ? (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" />Account is cleared</p>
                      ) : null;
                    })()}
                  </div>
                  <div>
                    <Label>Fee category</Label>
                    <Select value={form.feeCategory} onValueChange={(v) => setForm({ ...form, feeCategory: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{FEE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term / period</Label>
                    <Select value={form.termPeriod} onValueChange={(v) => setForm({ ...form, termPeriod: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount (K) *</Label>
                    <Input type="number" className="mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="2500" min={1} />
                  </div>
                  <div>
                    <Label>Payment method</Label>
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Payment date</Label>
                    <Input type="date" className="mt-1" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Reference / transaction no.</Label>
                    <Input className="mt-1" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="MM-908712" maxLength={50} />
                  </div>
                  <div>
                    <Label>Receipt number</Label>
                    <Input className="mt-1" value={form.receiptNumber} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })} placeholder="RCP-2026-0041" maxLength={30} />
                  </div>
                  <div>
                    <Label>Collected by</Label>
                    <Input className="mt-1" value={form.collectedBy} onChange={(e) => setForm({ ...form, collectedBy: e.target.value })} placeholder="Finance Office" maxLength={80} />
                  </div>
                  <div>
                    <Label>Late penalty applied</Label>
                    <Select value={form.latePenaltyApplied} onValueChange={(v) => setForm({ ...form, latePenaltyApplied: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No penalty</SelectItem>
                        <SelectItem value="yes">Yes — penalty charged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.latePenaltyApplied === "yes" && (
                    <div>
                      <Label>Penalty amount (K)</Label>
                      <Input type="number" min={0} className="mt-1" value={form.penaltyAmount} onChange={(e) => setForm({ ...form, penaltyAmount: e.target.value })} placeholder="150" />
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label>Description / breakdown</Label>
                    <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Term 2 tuition, transport levy, exam fee" />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={recordPayment} disabled={payMutation.isPending}>
                    {payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Record payment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={() => {
              const rows = (payments as any[]);
              if (rows.length === 0) { toast.error("No payments to export"); return; }
              downloadCsv(rows.map((p: any) => ({
                Student: p.studentName ?? p.student ?? "",
                Grade: p.grade ?? "",
                Amount: p.amount ?? 0,
                Method: p.method ?? "",
                Category: p.feeCategory ?? "",
                "Term Period": p.termPeriod ?? "",
                "Payment Date": (p.paymentDate ?? p.date ?? "").slice(0, 10),
                Reference: p.referenceNumber ?? "",
                Status: p.status ?? "completed",
              })), `fee-ledger-${new Date().toISOString().slice(0, 10)}`);
            }}>
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Collected this term" value={`K ${Number(summary.collected ?? 0).toLocaleString()}`} accent="success" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Outstanding" value={`K ${Number(summary.outstanding ?? 0).toLocaleString()}`} accent="warning" icon={<AlertCircle className="h-4 w-4" />} />
        <StatCard label="Collection rate" value={`${summary.collectionRate ?? 0}%`} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Bursaries active" value={activeBursaryCount} accent="accent" />
      </div>

      {lastPayment && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              {lastPayment.newBalance === 0 ? "Account cleared" : "Payment recorded"}
            </p>
            <p className="text-emerald-700/80 dark:text-emerald-400/80">
              K {lastPayment.amount.toLocaleString()} received from {lastPayment.studentName}
              {lastPayment.newBalance === 0 ? " — fee balance fully settled." : ` · Remaining: K ${lastPayment.newBalance.toLocaleString()}`}
            </p>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-400"
            onClick={() => setReceiptOpen(true)}
          >
            <Printer className="h-3.5 w-3.5" />Print receipt
          </button>
          <button className="ml-1 text-emerald-600 hover:text-emerald-800" onClick={() => setLastPayment(null)}>✕</button>
        </div>
      )}

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-lg">
          <div id="fee-receipt" className="print-area divide-y divide-border text-sm print:rounded-none print:border-0 print:shadow-none">
            <SchoolDocumentHeader title="Official Fee Receipt" subtitle={lastPayment?.termPeriod ?? ""} />
            <div className="grid grid-cols-2 gap-3 p-6">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Student</p>
                <p className="mt-0.5 font-semibold">{lastPayment?.studentName}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Class</p>
                <p className="mt-0.5 font-semibold">{lastPayment?.grade || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Receipt no.</p>
                <p className="mt-0.5 font-mono font-semibold">{lastPayment?.receiptNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Reference</p>
                <p className="mt-0.5 font-mono">{lastPayment?.referenceNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Payment date</p>
                <p className="mt-0.5">{lastPayment?.paymentDate}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Method</p>
                <p className="mt-0.5">{lastPayment?.method}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Category</p>
                <p className="mt-0.5">{lastPayment?.feeCategory}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Collected by</p>
                <p className="mt-0.5">{lastPayment?.collectedBy || "Finance Office"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-6">
              <p className="text-xs uppercase text-muted-foreground">Amount paid</p>
              <p className="text-2xl font-bold">K {lastPayment?.amount.toLocaleString()}</p>
            </div>
            <div className="flex items-center justify-between px-6 py-3">
              <p className="text-xs text-muted-foreground">Remaining balance</p>
              <p className={`font-semibold text-sm ${lastPayment?.newBalance === 0 ? "text-emerald-600" : "text-destructive"}`}>
                {lastPayment?.newBalance === 0 ? "Cleared" : `K ${lastPayment?.newBalance.toLocaleString()}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6 pt-8">
              <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Cashier signature</div>
              <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">School stamp</div>
            </div>
          </div>
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>Close</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-semibold">Outstanding balances</h2>
            {debtors.length > 0 && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">{debtors.length}</span>
            )}
          </div>
          {debtors.length > 0 && (
            <button
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
              disabled={reminderMutation.isPending}
              onClick={() => setReminderOpen(true)}
            >
              <Bell className="h-3.5 w-3.5" />
              Send bulk reminders ({debtors.length})
            </button>
          )}
        </div>
        {debtors.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
            <p className="text-sm font-medium">No outstanding balances</p>
            <p className="text-xs">All enrolled students are paid up for the current term.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Balance due</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtors.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.firstName} {s.lastName}
                    {s.admissionNumber && <div className="text-xs text-muted-foreground">{s.admissionNumber}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.className || (s.grade ? `Form ${s.grade}${s.section ? s.section : ""}` : "—")}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    K {Number(s.feeBalance).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={sendingReminderId === s.id}
                        onClick={() => void sendIndividualReminder(s)}
                        title="Send reminder to parent"
                      >
                        {sendingReminderId === s.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Bell className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setForm((f) => ({ ...f, studentId: s.id, studentName: `${s.firstName} ${s.lastName}`, grade: s.className || `Grade ${s.grade}` }));
                          setOpen(true);
                        }}
                      >
                        Record payment
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Recent payments</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading payments…</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments as any[]).map((p: any) => {
                const status = p.status ?? "completed";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.studentName ?? p.student}
                      {p.referenceNumber && <div className="text-xs text-muted-foreground">{p.referenceNumber}</div>}
                    </TableCell>
                    <TableCell>{p.grade ?? "—"}</TableCell>
                    <TableCell>K {Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell className="text-muted-foreground">{(p.paymentDate ?? p.date ?? "").slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant={status === "completed" ? "secondary" : status === "failed" ? "destructive" : "outline"}>{status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === "pending" && p.gatewayProvider && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={recheckMutation.isPending && recheckMutation.variables === p.id}
                          onClick={() => recheckMutation.mutate(p.id)}
                        >
                          {recheckMutation.isPending && recheckMutation.variables === p.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          Recheck
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(payments as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
    </AccessGuard>
  );
}
