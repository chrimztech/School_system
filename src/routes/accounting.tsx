import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, TrendingUp, TrendingDown, Scale, Plus, Download, FileText,
  Banknote, Building2, Receipt, ArrowUpRight, ArrowDownRight, Printer,
} from "lucide-react";
import { toast } from "sonner";

import {
  Box, Chip, Button, MenuItem, TextField,
  Dialog, DialogContent, DialogContentText, DialogActions, DialogTitle,
  Tabs, Tab, TableContainer, Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx, downloadCsv } from "@/lib/utils";
import { SchoolDocumentHeader } from "@/components/school-document-header";

export const Route = createFileRoute("/accounting")({
  head: () => ({ meta: [{ title: "Accounting — SRMS" }] }),
  component: AccountingPage,
});

const k = (n: number) => `K ${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString()}`;
const isNumericLike = (v: unknown) => typeof v === "string" && v.trim() !== "" && !isNaN(Number(v));

function AccountingPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [openJE, setOpenJE] = useState(false);
  const [openExp, setOpenExp] = useState(false);
  const [jeDebitAccount, setJeDebitAccount] = useState("1010");
  const [jeCreditAccount, setJeCreditAccount] = useState("4000");
  const [reportPreview, setReportPreview] = useState<{ title: string; filename: string; rows: Record<string, unknown>[] } | null>(null);

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
  const { data: studentsRaw = [] } = useQuery({
    queryKey: ["students", active.id],
    queryFn: () => api.students.list(active.id),
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
    debitAccount: je.debitAccount ?? "",
    creditAccount: je.creditAccount ?? "",
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

  const openReport = (title: string, filename: string, rows: Record<string, unknown>[] | null) => {
    if (!rows) return; // the builder already toasted why there's nothing to show
    setReportPreview({ title, filename, rows });
  };

  const buildTrialBalance = (): Record<string, unknown>[] | null => {
    const posted = journal.filter((j) => j.status === "Posted");
    if (posted.length === 0) { toast.error("No posted journal entries to build a trial balance from"); return null; }
    const byAccount = new Map<string, { debit: number; credit: number }>();
    posted.forEach((j) => {
      if (j.debitAccount) {
        const acc = byAccount.get(j.debitAccount) ?? { debit: 0, credit: 0 };
        acc.debit += Number(j.debit);
        byAccount.set(j.debitAccount, acc);
      }
      if (j.creditAccount) {
        const acc = byAccount.get(j.creditAccount) ?? { debit: 0, credit: 0 };
        acc.credit += Number(j.credit);
        byAccount.set(j.creditAccount, acc);
      }
    });
    const rows = Array.from(byAccount.entries()).map(([account, v]) => ({
      Account: account, Debit: v.debit.toFixed(2), Credit: v.credit.toFixed(2),
    }));
    const totalDebit = Array.from(byAccount.values()).reduce((s, v) => s + v.debit, 0);
    const totalCredit = Array.from(byAccount.values()).reduce((s, v) => s + v.credit, 0);
    rows.push({ Account: "TOTAL", Debit: totalDebit.toFixed(2), Credit: totalCredit.toFixed(2) });
    return rows;
  };

  const buildGeneralLedger = (): Record<string, unknown>[] | null => {
    if (journal.length === 0) { toast.error("No journal entries recorded yet"); return null; }
    return journal.map((j) => ({
      Date: j.date, Reference: j.ref, Description: j.desc,
      "Debit account": j.debitAccount || "—", "Credit account": j.creditAccount || "—",
      Debit: Number(j.debit).toFixed(2), Credit: Number(j.credit).toFixed(2), Status: j.status,
    }));
  };

  const buildProfitAndLoss = (): Record<string, unknown>[] | null => {
    const completedPayments = (feePayments as any[]).filter((p) => (p.status ?? "completed") === "completed");
    if (completedPayments.length === 0 && expenses.length === 0) { toast.error("No income or expense records yet"); return null; }
    const incomeByCategory = new Map<string, number>();
    completedPayments.forEach((p) => {
      const cat = p.feeCategory || "Fees";
      incomeByCategory.set(cat, (incomeByCategory.get(cat) ?? 0) + Number(p.amount));
    });
    const expenseByCategory = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || "Other";
      expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) + Number(e.amount));
    });
    const rows: Record<string, unknown>[] = [{ Section: "INCOME", Category: "", Amount: "" }];
    let totalIncome = 0;
    incomeByCategory.forEach((amt, cat) => { rows.push({ Section: "", Category: cat, Amount: amt.toFixed(2) }); totalIncome += amt; });
    rows.push({ Section: "", Category: "Total income", Amount: totalIncome.toFixed(2) });
    rows.push({ Section: "EXPENSES", Category: "", Amount: "" });
    let totalExpense = 0;
    expenseByCategory.forEach((amt, cat) => { rows.push({ Section: "", Category: cat, Amount: amt.toFixed(2) }); totalExpense += amt; });
    rows.push({ Section: "", Category: "Total expenses", Amount: totalExpense.toFixed(2) });
    rows.push({ Section: "", Category: "Net surplus / (deficit)", Amount: (totalIncome - totalExpense).toFixed(2) });
    return rows;
  };

  const buildCashFlow = (): Record<string, unknown>[] | null => {
    const inflows = (feePayments as any[])
      .filter((p) => (p.status ?? "completed") === "completed")
      .map((p) => ({ date: String(p.paymentDate ?? "").slice(0, 10), desc: `Fee payment — ${p.studentName ?? "Unknown"}`, amount: Number(p.amount) }));
    const outflows = expenses.map((e) => ({ date: e.date, desc: `${e.category || "Expense"} — ${e.vendor}`, amount: -Number(e.amount) }));
    const combined = [...inflows, ...outflows].filter((t) => t.date).sort((a, b) => a.date.localeCompare(b.date));
    if (combined.length === 0) { toast.error("No cash transactions recorded yet"); return null; }
    let running = 0;
    return combined.map((t) => {
      running += t.amount;
      return {
        Date: t.date, Description: t.desc,
        "Cash in": t.amount > 0 ? t.amount.toFixed(2) : "",
        "Cash out": t.amount < 0 ? Math.abs(t.amount).toFixed(2) : "",
        "Running balance": running.toFixed(2),
      };
    });
  };

  const buildOutstandingFees = (): Record<string, unknown>[] | null => {
    const withBalance = (studentsRaw as any[]).filter((s) => Number(s.feeBalance ?? 0) > 0);
    if (withBalance.length === 0) { toast.error("No students have an outstanding balance"); return null; }
    return withBalance
      .slice()
      .sort((a, b) => Number(b.feeBalance) - Number(a.feeBalance))
      .map((s) => ({
        Student: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
        "Admission No.": s.admissionNumber ?? "",
        Grade: s.grade ?? "",
        "Outstanding balance": Number(s.feeBalance).toFixed(2),
      }));
  };

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
            <Button variant="outlined" disabled startIcon={<Download size={16} />} title="Accounting export endpoint is not available yet.">
              Export unavailable
            </Button>
            <Button variant="outlined" component={Link} to="/payroll" startIcon={<Banknote size={16} />}>Payroll</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpenJE(true)}>New journal</Button>
            <Dialog open={openJE} onClose={() => setOpenJE(false)} maxWidth="sm" fullWidth>
              <DialogTitle>New journal entry</DialogTitle>
              <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>Debits must equal credits before posting.</DialogContentText>
                <form onSubmit={(e) => { e.preventDefault(); addJE(e.currentTarget); }} className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField name="ref" label="Reference" placeholder="INV-0232" required fullWidth size="small" />
                    <TextField name="amount" type="number" label="Amount (K)" slotProps={{ htmlInput: { step: "0.01" } }} required fullWidth size="small" />
                  </div>
                  <TextField name="desc" label="Description" placeholder="Narration" required fullWidth size="small" />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      name="debitAccount"
                      label="Debit account"
                      value={jeDebitAccount}
                      onChange={(e) => setJeDebitAccount(e.target.value)}
                      placeholder="e.g. 1010"
                      fullWidth
                      size="small"
                    />
                    <TextField
                      name="creditAccount"
                      label="Credit account"
                      value={jeCreditAccount}
                      onChange={(e) => setJeCreditAccount(e.target.value)}
                      placeholder="e.g. 4000"
                      fullWidth
                      size="small"
                    />
                  </div>
                  <DialogActions sx={{ px: 0 }}><Button type="submit" variant="contained" disabled={createJEMutation.isPending}>Save draft</Button></DialogActions>
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

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab value="overview" label="Overview" />
        <Tab value="coa" label="Chart of Accounts" />
        <Tab value="journal" label="Journal" />
        <Tab value="expenses" label="Expenses" />
        <Tab value="budgets" label="Budgets" />
        <Tab value="assets" label="Fixed Assets" />
        <Tab value="reports" label="Reports" />
        <Tab value="tax" label="Tax & Compliance" />
      </Tabs>

      {/* Overview */}
      {tab === "overview" && (
        <Box className="space-y-4">
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
        </Box>
      )}

      {/* COA */}
      {tab === "coa" && (
        <Box>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </Box>
      )}

      {/* Journal */}
      {tab === "journal" && (
        <Box>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>ID</TableCell><TableCell>Date</TableCell><TableCell>Ref</TableCell>
                <TableCell>Description</TableCell><TableCell>Debit a/c</TableCell><TableCell>Credit a/c</TableCell>
                <TableCell className="text-right">Debit</TableCell>
                <TableCell className="text-right">Credit</TableCell><TableCell>Status</TableCell><TableCell></TableCell>
              </TableRow></TableHead>
              <TableBody>
                {journal.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-mono text-xs">{j.id}</TableCell>
                    <TableCell>{j.date}</TableCell>
                    <TableCell className="font-mono text-xs">{j.ref}</TableCell>
                    <TableCell>{j.desc}</TableCell>
                    <TableCell className="font-mono text-xs">{j.debitAccount || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{j.creditAccount || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{k(j.debit)}</TableCell>
                    <TableCell className="text-right font-mono">{k(j.credit)}</TableCell>
                    <TableCell><Chip size="small" label={j.status} sx={badgeSx(j.status === "Posted" ? "secondary" : "outline")} /></TableCell>
                    <TableCell className="text-right">
                      {j.status === "Draft" && <Button size="small" variant="text" color="inherit" onClick={() => onPost(j.id)}>Post</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {journal.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                      No journal entries recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </Box>
      )}

      {/* Expenses */}
      {tab === "expenses" && (
        <Box className="space-y-4">
          <div className="flex justify-end">
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpenExp(true)}>Record expense</Button>
            <Dialog open={openExp} onClose={() => setOpenExp(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Record expense</DialogTitle>
              <DialogContent>
                <form onSubmit={(e) => { e.preventDefault(); addExp(e.currentTarget); }} className="grid gap-3">
                  <TextField name="vendor" label="Vendor" required fullWidth size="small" />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField select name="category" label="Category" defaultValue="Utilities" fullWidth size="small">
                      {["Utilities", "Stationery", "Internet", "Transport/Fuel", "Maintenance", "Boarding", "Other"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                    <TextField name="amount" type="number" label="Amount (K)" required fullWidth size="small" />
                  </div>
                  <TextField select name="method" label="Method" defaultValue="Bank Transfer" fullWidth size="small">
                    {["Bank Transfer", "Cash", "MoMo", "Fleet Card", "Cheque"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <DialogActions sx={{ px: 0 }}><Button type="submit" variant="contained" disabled={createExpMutation.isPending}>Save</Button></DialogActions>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>ID</TableCell><TableCell>Date</TableCell><TableCell>Vendor</TableCell>
                <TableCell>Category</TableCell><TableCell className="text-right">Amount</TableCell>
                <TableCell>Method</TableCell><TableCell>Status</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell>{e.date}</TableCell>
                    <TableCell className="font-medium">{e.vendor}</TableCell>
                    <TableCell>{e.category}</TableCell>
                    <TableCell className="text-right font-mono">{k(e.amount)}</TableCell>
                    <TableCell>{e.method}</TableCell>
                    <TableCell><Chip size="small" label={e.status} sx={badgeSx(e.status === "Paid" ? "secondary" : "outline")} /></TableCell>
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
            </TableContainer>
          </div>
        </Box>
      )}

      {/* Budgets */}
      {tab === "budgets" && (
        <Box>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold">Budget vs actual · YTD</h3>
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </Box>
      )}

      {/* Assets */}
      {tab === "assets" && (
        <Box>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </Box>
      )}

      {/* Reports */}
      {tab === "reports" && (
        <Box className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Trial Balance",       icon: Scale,      desc: "Posted journal entries grouped by account code", action: () => openReport("Trial Balance", `trial-balance-${active.shortCode}`, buildTrialBalance()) },
            { name: "Profit & Loss",       icon: TrendingUp, desc: "Fee income by category vs. recorded expenses", action: () => openReport("Profit & Loss", `profit-and-loss-${active.shortCode}`, buildProfitAndLoss()) },
            {
              name: "Balance Sheet", icon: Building2, desc: "Requires a chart of accounts (assets/liabilities/equity) — not yet configured",
              action: () => toast.error("Balance Sheet needs a chart of accounts, which isn't set up yet"), disabled: true,
            },
            { name: "Cash Flow Statement", icon: ArrowUpRight, desc: "Chronological cash in/out with running balance", action: () => openReport("Cash Flow Statement", `cash-flow-${active.shortCode}`, buildCashFlow()) },
            { name: "General Ledger",      icon: FileText,   desc: "All journal entries with account codes", action: () => openReport("General Ledger", `general-ledger-${active.shortCode}`, buildGeneralLedger()) },
            { name: "Outstanding Fees",    icon: ArrowDownRight, desc: "Students with a fee balance, highest first", action: () => openReport("Outstanding Fees", `outstanding-fees-${active.shortCode}`, buildOutstandingFees()) },
          ].map((r) => (
            <button
              key={r.name}
              onClick={r.action}
              disabled={r.disabled}
              className={`rounded-xl border border-border bg-card p-5 text-left shadow-sm transition ${r.disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted"}`}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><r.icon className="h-4 w-4" /></div>
              <p className="font-medium">{r.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              {!r.disabled && <p className="mt-3 text-xs text-primary">View report →</p>}
            </button>
          ))}
        </Box>
      )}

      {/* Tax */}
      {tab === "tax" && (
        <Box className="space-y-4">
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
        </Box>
      )}

      <Dialog open={!!reportPreview} onClose={() => setReportPreview(null)} maxWidth="lg" fullWidth>
        <DialogTitle className="print:hidden">{reportPreview?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText className="print:hidden" sx={{ mb: 2 }}>Preview the report below, then print it to PDF or download it as a spreadsheet.</DialogContentText>
          {reportPreview && (
            <div className="print-area max-h-[65vh] overflow-y-auto rounded-xl border border-border bg-card print:max-h-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
              <SchoolDocumentHeader
                title={reportPreview.title}
                subtitle={`Generated ${new Date().toLocaleDateString()} · Term ${active.currentTerm} ${active.currentYear}`}
              />
              <div className="overflow-x-auto p-4">
                <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {Object.keys(reportPreview.rows[0] ?? {}).map((col) => (
                        <TableCell key={col}>{col}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportPreview.rows.map((row, i) => (
                      <TableRow key={i} className={i % 2 === 1 ? "bg-muted/30" : undefined}>
                        {Object.values(row).map((val, j) => (
                          <TableCell key={j} className={isNumericLike(val) ? "text-right font-mono" : undefined}>{String(val)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions className="print:hidden">
          <Button variant="outlined" color="inherit" startIcon={<Download size={16} />} onClick={() => reportPreview && downloadCsv(reportPreview.rows, reportPreview.filename)}>
            CSV
          </Button>
          <Button variant="contained" startIcon={<Printer size={16} />} onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </DialogActions>
      </Dialog>
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
