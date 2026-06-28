import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, TrendingUp, TrendingDown, Scale, Plus, Download, FileText,
  Banknote, Building2, Receipt, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/accounting")({
  head: () => ({ meta: [{ title: "Accounting — SRMS" }] }),
  component: AccountingPage,
});

const k = (n: number) => `K ${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString()}`;

function AccountingPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [openJE, setOpenJE] = useState(false);
  const [openExp, setOpenExp] = useState(false);
  const [jeDebitAccount, setJeDebitAccount] = useState("1010");
  const [jeCreditAccount, setJeCreditAccount] = useState("4000");

  const { data: feesData } = useQuery({
    queryKey: ["fees-collected", active.id],
    queryFn: () => api.fees.collected(active.id),
  });
  const { data: feePayments = [] } = useQuery({
    queryKey: ["fees-payments", active.id],
    queryFn: () => api.fees.payments(active.id),
  });
  const { data: journalRaw = [] } = useQuery({
    queryKey: ["accounting-journal", active.id],
    queryFn: () => api.accounting.journalEntries(active.id),
  });
  const { data: expensesRaw = [] } = useQuery({
    queryKey: ["accounting-expenses", active.id],
    queryFn: () => api.accounting.expenses(active.id),
  });

  const createJEMutation = useMutation({
    mutationFn: (data: any) => api.accounting.createJournalEntry(active.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-journal", active.id] });
      toast.success("Journal entry created");
      setOpenJE(false);
    },
    onError: () => toast.error("Failed to create journal entry"),
  });

  const postJEMutation = useMutation({
    mutationFn: (id: string) => api.accounting.postJournalEntry(active.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-journal", active.id] });
      toast.success("Journal entry posted to GL");
    },
    onError: () => toast.error("Failed to post journal entry"),
  });

  const createExpMutation = useMutation({
    mutationFn: (data: any) => api.accounting.createExpense(active.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounting-expenses", active.id] });
      toast.success("Expense recorded");
      setOpenExp(false);
    },
    onError: () => toast.error("Failed to record expense"),
  });

  const journal = (journalRaw as any[]).map((je: any) => ({
    id: je.id ?? "",
    date: je.entryDate ?? je.date ?? "",
    ref: je.reference ?? je.ref ?? "JE",
    desc: je.description ?? je.desc ?? "",
    debit: je.debitAmount ?? je.debit ?? 0,
    credit: je.creditAmount ?? je.credit ?? 0,
    status: je.status === "POSTED" ? "Posted" : "Draft",
  }));

  const expenses = (expensesRaw as any[]).map((exp: any) => ({
    id: exp.id ?? "",
    date: exp.expenseDate ?? exp.date ?? "",
    vendor: exp.vendor ?? "",
    category: exp.category ?? "",
    amount: exp.amount ?? 0,
    method: exp.paymentMethod ?? exp.method ?? "",
    status: exp.status === "PAID" ? "Paid" : "Pending",
  }));

  const collectedFees = Number(feesData?.collected ?? 0);
  const outstandingFees = Number(feesData?.outstanding ?? 0);
  const collectionRate = Number(feesData?.collectionRate ?? 0);
  const postedJournalCount = journal.filter((entry) => entry.status === "Posted").length;
  const draftJournalCount = journal.length - postedJournalCount;
  const totalJournalValue = journal.reduce((sum, entry) => sum + Number(entry.debit ?? 0), 0);
  const totalRecordedExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const paidExpenses = expenses
    .filter((expense) => expense.status === "Paid")
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const pendingExpenses = Math.max(totalRecordedExpenses - paidExpenses, 0);
  const netSurplus = collectedFees - paidExpenses;
  const netCashMovement = collectedFees - totalRecordedExpenses;
  const hasFinanceRecords = feePayments.length > 0 || journal.length > 0 || expenses.length > 0;
  const surplusHint = collectedFees > 0
    ? `Margin ${((netSurplus / collectedFees) * 100).toFixed(1)}%`
    : "No revenue recorded yet";

  const onPost = (id: string) => postJEMutation.mutate(id);

  const onExport = (what: string) => toast.error(`${what} export is not available from the backend yet`);

  const addJE = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const amount = Number(fd.get("amount") || 0);
    createJEMutation.mutate({
      reference: String(fd.get("ref") || "JE"),
      debitAmount: amount,
      creditAmount: amount,
      description: String(fd.get("desc") || ""),
      debitAccount: jeDebitAccount,
      creditAccount: jeCreditAccount,
    });
  };

  const addExp = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    createExpMutation.mutate({
      vendor: String(fd.get("vendor") || ""),
      category: String(fd.get("category") || "Other"),
      amount: Number(fd.get("amount") || 0),
      paymentMethod: String(fd.get("method") || "Bank Transfer"),
    });
  };

  return (
    <AccessGuard module="accounting">
      <div className="space-y-6">
      <PageHeader
        title="Accounting"
        description={`Double-entry general ledger · ${active.currency ?? "ZMW"} · ZRA / NAPSA / NHIMA compliant`}
        actions={
          <>
            <Button variant="outline" disabled title="Accounting export endpoint is not available yet.">
              <Download className="mr-2 h-4 w-4" /> Export unavailable
            </Button>
            <Button variant="outline" asChild><Link to="/payroll"><Banknote className="mr-2 h-4 w-4" />Payroll</Link></Button>
            <Dialog open={openJE} onOpenChange={setOpenJE}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New journal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New journal entry</DialogTitle>
                  <DialogDescription>Debits must equal credits before posting.</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addJE(e.currentTarget); }} className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Reference</Label><Input name="ref" placeholder="INV-0232" required /></div>
                    <div><Label>Amount (K)</Label><Input name="amount" type="number" step="0.01" required /></div>
                  </div>
                  <div><Label>Description</Label><Input name="desc" placeholder="Narration" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Debit account</Label>
                      <Input name="debitAccount" value={jeDebitAccount} onChange={(e) => setJeDebitAccount(e.target.value)} placeholder="e.g. 1010" />
                    </div>
                    <div>
                      <Label>Credit account</Label>
                      <Input name="creditAccount" value={jeCreditAccount} onChange={(e) => setJeCreditAccount(e.target.value)} placeholder="e.g. 4000" />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={createJEMutation.isPending}>Save draft</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Fees collected (YTD)" value={k(collectedFees)} accent="success" icon={<TrendingUp className="h-4 w-4" />} hint={collectionRate > 0 ? `${collectionRate}% collection rate` : `${feePayments.length} payments recorded`} />
        <StatCard label="Outstanding fees" value={k(outstandingFees)} accent="warning" icon={<TrendingDown className="h-4 w-4" />} hint="Loaded from the fees endpoint" />
        <StatCard label="Net surplus" value={k(netSurplus)} accent="primary" icon={<Scale className="h-4 w-4" />} hint={surplusHint} />
        <StatCard label="Recorded expenses" value={k(totalRecordedExpenses)} accent="accent" icon={<Wallet className="h-4 w-4" />} hint={`${expenses.length} expense record${expenses.length === 1 ? "" : "s"}`} />
        <StatCard label="Pending expenses" value={k(pendingExpenses)} accent="destructive" icon={<Receipt className="h-4 w-4" />} hint={`${draftJournalCount} draft journal entr${draftJournalCount === 1 ? "y" : "ies"}`} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="assets">Fixed Assets</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="tax">Tax & Compliance</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold">Cash inflow vs outflow · 2026</h3>
              {!hasFinanceRecords ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No finance records are available from the backend yet.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActivityTile label="Fee payments" value={`${feePayments.length}`} helper="Payment records loaded from the fees endpoint." />
                  <ActivityTile label="Journal value" value={k(totalJournalValue)} helper={`${postedJournalCount} posted and ${draftJournalCount} draft journal entries.`} />
                  <ActivityTile label="Paid expenses" value={k(paidExpenses)} helper="Expense totals from the accounting expense ledger." />
                  <ActivityTile label="Net cash movement" value={k(netCashMovement)} helper="Collected fees minus all recorded expenses." />
                </div>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold">Recorded finance snapshot</h3>
              <dl className="space-y-3 text-sm">
                <Row label="Fees collected" value={k(collectedFees)} tone="text-emerald-600" />
                <Row label="Outstanding fees" value={k(outstandingFees)} tone="text-amber-600" />
                <Row label="Paid expenses" value={k(paidExpenses)} tone="text-rose-600" />
                <Row label="Pending expenses" value={k(pendingExpenses)} tone="text-orange-600" />
                <Row label="Posted journal entries" value={`${postedJournalCount}`} tone="text-blue-600" />
                <Row label="Draft journal entries" value={`${draftJournalCount}`} tone="text-muted-foreground" />
                <Row label="Net surplus" value={k(netSurplus)} tone={netSurplus >= 0 ? "text-emerald-600" : "text-destructive"} />
                <div className="border-t border-border pt-3">
                  <Row label="Balance check" value="—" tone="text-muted-foreground" />
                </div>
              </dl>
            </div>
          </div>
        </TabsContent>

        {/* COA */}
        <TabsContent value="coa">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </TabsContent>

        {/* Journal */}
        <TabsContent value="journal">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>Ref</TableHead>
                <TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {journal.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.id}</TableCell>
                    <TableCell>{j.date}</TableCell>
                    <TableCell className="font-mono text-xs">{j.ref}</TableCell>
                    <TableCell>{j.desc}</TableCell>
                    <TableCell className="text-right font-mono">{k(j.debit)}</TableCell>
                    <TableCell className="text-right font-mono">{k(j.credit)}</TableCell>
                    <TableCell><Badge variant={j.status === "Posted" ? "secondary" : "outline"}>{j.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {j.status === "Draft" && <Button size="sm" variant="ghost" onClick={() => onPost(j.id)}>Post</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {journal.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No journal entries recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openExp} onOpenChange={setOpenExp}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Record expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record expense</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addExp(e.currentTarget); }} className="grid gap-3">
                  <div><Label>Vendor</Label><Input name="vendor" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Category</Label>
                      <Select name="category" defaultValue="Utilities"><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["Utilities","Stationery","Internet","Transport/Fuel","Maintenance","Boarding","Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Amount (K)</Label><Input name="amount" type="number" required /></div>
                  </div>
                  <div><Label>Method</Label>
                    <Select name="method" defaultValue="Bank Transfer"><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Bank Transfer","Cash","MoMo","Fleet Card","Cheque"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button type="submit" disabled={createExpMutation.isPending}>Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell>{e.date}</TableCell>
                    <TableCell className="font-medium">{e.vendor}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-right font-mono">{k(e.amount)}</TableCell>
                    <TableCell>{e.method}</TableCell>
                    <TableCell><Badge variant={e.status === "Paid" ? "secondary" : "outline"}>{e.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No expenses recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Budgets */}
        <TabsContent value="budgets">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Budget vs actual · YTD</h3>
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </TabsContent>

        {/* Assets */}
        <TabsContent value="assets">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Trial Balance",       icon: Scale,      desc: "All accounts with running debit/credit" },
            { name: "Profit & Loss",       icon: TrendingUp, desc: "Income statement for current term" },
            { name: "Balance Sheet",       icon: Building2,  desc: "Statement of financial position" },
            { name: "Cash Flow Statement", icon: ArrowUpRight, desc: "Operating, investing, financing" },
            { name: "General Ledger",      icon: FileText,   desc: "Account-level transactions" },
            { name: "Aged Receivables",    icon: ArrowDownRight, desc: "Outstanding fees by age bucket" },
          ].map((r) => (
            <button key={r.name} onClick={() => onExport(r.name)} className="rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:bg-muted">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><r.icon className="h-4 w-4" /></div>
              <p className="font-medium">{r.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              <p className="mt-3 text-xs text-primary">Download CSV →</p>
            </button>
          ))}
        </TabsContent>

        {/* Tax */}
        <TabsContent value="tax" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold">No compliance ledger endpoint available</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tax filings and statutory remittances are no longer shown with placeholder balances or due dates.
              This tab will populate when the backend exposes dedicated compliance records.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ActivityTile label="Posted journals" value={`${postedJournalCount}`} helper="Available accounting records already synced from the journal endpoint." />
              <ActivityTile label="Expense records" value={`${expenses.length}`} helper="Operational spend entries currently available from the backend." />
              <ActivityTile label="Fee payments" value={`${feePayments.length}`} helper="Fee collection records currently available from the backend." />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-mono font-semibold ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}

function ActivityTile({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}
