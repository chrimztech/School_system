import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet, AlertCircle, TrendingUp, Plus, Download, Send, Loader2 } from "lucide-react";
import { useState } from "react";
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
import { downloadCsv } from "@/lib/utils";

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

  const reminderMutation = useMutation({
    mutationFn: () => api.communication.createAnnouncement(schoolId, {
      title: "Fee payment reminder",
      body: `This is a reminder that outstanding fee balances are due for Term ${active.currentTerm} ${active.currentYear}. Please make payment promptly to avoid disruption to your child's education. Contact the finance office for assistance.`,
      audience: "All parents",
      channels: "SMS, WhatsApp",
      publishDate: new Date().toISOString().slice(0, 10),
      active: true,
    }),
    onSuccess: () => {
      toast.success("Fee reminders queued — parents with outstanding balances will be notified");
      setReminderOpen(false);
    },
    onError: () => toast.error("Failed to queue reminders"),
  });

  const payMutation = useMutation({
    mutationFn: (data: any) => api.fees.recordPayment(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fees-payments", schoolId] });
      qc.invalidateQueries({ queryKey: ["fees-collected", schoolId] });
      toast.success(`Payment of K ${Number(form.amount).toLocaleString()} recorded`);
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
              <DialogContent>
                <DialogHeader><DialogTitle>Send fee reminders</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>This will send SMS/WhatsApp reminders to all guardians with outstanding fee balances via the configured integration channels.</p>
                  <div className="rounded-lg border border-border p-3 space-y-1">
                    <p className="font-medium text-foreground">Channels</p>
                    <p>• WhatsApp (if integration active)</p>
                    <p>• SMS fallback for non-smartphone guardians</p>
                    <p>• USSD for offline households</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setReminderOpen(false)}>Cancel</Button>
                  <Button onClick={() => reminderMutation.mutate()} disabled={reminderMutation.isPending}>
                    {reminderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Send className="mr-2 h-4 w-4" />Send now
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
                      setForm({ ...form, studentId: v, studentName: s ? `${s.firstName} ${s.lastName}` : "", grade: s ? `Grade ${s.grade} ${s.section}` : "" });
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {(students as any[]).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Collection vs outstanding · last 5 months</h2>
        <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments as any[]).map((p: any) => (
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
                    <Badge variant={(p.status ?? "completed") === "completed" ? "secondary" : "outline"}>{p.status ?? "completed"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(payments as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
