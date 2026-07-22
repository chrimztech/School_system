import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, CheckCircle2, Lock, Zap, ArrowRight, RefreshCw, Loader2, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Button, Chip, IconButton, LinearProgress, MenuItem, TextField,
  Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import {
  useTenant, PLAN_CATALOG, FEATURE_META, FEATURE_ORDER,
  planIncludesFeature, type PlanId, type BillingCycle,
} from "@/lib/tenant";
import { PLAN_UI, STATUS_UI } from "@/lib/subscription";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing & Subscription — SRMS" }] }),
  component: BillingPage,
});

const PLAN_IDS: PlanId[] = ["core", "growth", "advanced", "enterprise"];

type Invoice = {
  id: string; date: string; description: string; amount: number; status: "paid" | "open" | "overdue";
};

function BillingPage() {
  const { active, activePlan, changePlan, isFeatureIncluded } = useTenant();
  const schoolId = active.id;
  const sub = active.subscription;
  const planUi = PLAN_UI[activePlan.id];
  const statusUi = STATUS_UI[sub.status];
  const qc = useQueryClient();

  const [tab, setTab] = useState("features");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanId>(activePlan.id);
  const [targetCycle, setTargetCycle] = useState<BillingCycle>(sub.billingCycle);
  const [invoicePreview, setInvoicePreview] = useState<Invoice | null>(null);

  const { data: invoicesData = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["billing-invoices", schoolId],
    queryFn: () => api.billingInvoices.list(schoolId),
  });
  const invoices = invoicesData as Invoice[];

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.billingInvoices.markPaid(schoolId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billing-invoices", schoolId] }); toast.success("Invoice marked as paid"); },
    onError: () => toast.error("Failed to update invoice"),
  });

  const smsPct = sub.smsQuota > 0 ? Math.round((sub.smsUsed / sub.smsQuota) * 100) : 0;
  const campusPct = sub.campusLimit > 0 ? Math.round((active.campuses.length / sub.campusLimit) * 100) : 0;
  const learnerPct = sub.learnerLimit > 0 ? Math.round((active.totalStudents / sub.learnerLimit) * 100) : 0;

  const previewAmount = targetPlan
    ? (targetCycle === "annual" ? PLAN_CATALOG[targetPlan].annualPrice : PLAN_CATALOG[targetPlan].monthlyPrice)
    : 0;

  const confirmChange = () => {
    if (targetPlan === activePlan.id && targetCycle === sub.billingCycle) {
      toast.error("No changes to apply");
      return;
    }
    changePlan(targetPlan, targetCycle);
    toast.success(`Plan changed to ${PLAN_CATALOG[targetPlan].name} — features updated`);
    setUpgradeOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your school's subscription plan, features, and payment history."
        actions={
          <>
            <Button startIcon={<Zap className="h-4 w-4" />} onClick={() => setUpgradeOpen(true)}>Change plan</Button>
            <Dialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Change subscription plan</DialogTitle>
              <DialogContent>
              <div className="space-y-4">
                <div className="grid gap-3">
                  <TextField
                    select
                    label="New plan"
                    value={targetPlan}
                    onChange={(e) => setTargetPlan(e.target.value as PlanId)}
                    fullWidth
                    size="small"
                  >
                    {PLAN_IDS.map((p) => (
                      <MenuItem key={p} value={p}>
                        {PLAN_CATALOG[p].name} — K{PLAN_CATALOG[p].monthlyPrice.toLocaleString()}/mo
                        {p === activePlan.id ? " (current)" : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Billing cycle"
                    value={targetCycle}
                    onChange={(e) => setTargetCycle(e.target.value as BillingCycle)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="monthly">Monthly</MenuItem>
                    <MenuItem value="annual">Annual (save ~17%)</MenuItem>
                  </TextField>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                  <p className="font-medium">{PLAN_CATALOG[targetPlan].name} plan summary</p>
                  <p className="text-sm text-muted-foreground">{PLAN_CATALOG[targetPlan].description}</p>
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-sm">Amount due ({targetCycle})</span>
                    <span className="font-bold text-lg">K{previewAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Up to {PLAN_CATALOG[targetPlan].campusLimit} campus{PLAN_CATALOG[targetPlan].campusLimit === 1 ? "" : "es"}</p>
                    <p>Up to {PLAN_CATALOG[targetPlan].learnerLimit.toLocaleString()} learners</p>
                    <p>{PLAN_CATALOG[targetPlan].smsQuota.toLocaleString()} SMS / month</p>
                    <p>{PLAN_CATALOG[targetPlan].supportLevel} support</p>
                  </div>
                </div>
              </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setUpgradeOpen(false)}>Cancel</Button>
                <Button onClick={confirmChange} startIcon={<ArrowRight className="h-4 w-4" />}>Confirm change</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      {/* Current plan hero card */}
      <div className="rounded-xl border-2 bg-card p-6 space-y-4" style={{ borderColor: planUi.color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Chip size="small" label={activePlan.name} className={planUi.badgeClass} sx={{ height: "auto", "& .MuiChip-label": { px: 1.25, py: 0.4 } }} />
              <Chip size="small" label={statusUi.label} className={statusUi.badgeClass} sx={{ height: "auto", "& .MuiChip-label": { px: 1.25, py: 0.4 } }} />
            </div>
            <p className="text-2xl font-bold">
              K{sub.amount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground"> / {sub.billingCycle}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">{activePlan.description}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground space-y-0.5">
            {sub.billingContact && (
              <p>Billing contact: <span className="font-medium text-foreground">{sub.billingContact}</span></p>
            )}
            <p>Next invoice: <span className="font-medium text-foreground">{sub.nextInvoiceDate}</span></p>
            <p>Renewal: <span className="font-medium text-foreground">{sub.renewalDate}</span></p>
            <p>Support: <span className="font-medium text-foreground">{sub.supportLevel}</span></p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Campuses used</span>
              <span className={campusPct > 90 ? "font-semibold text-warning" : "font-medium"}>
                {active.campuses.length} / {sub.campusLimit}
              </span>
            </div>
            <LinearProgress variant="determinate" value={campusPct} sx={{ height: 8, borderRadius: 999 }} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Learners used</span>
              <span className={learnerPct > 90 ? "font-semibold text-warning" : "font-medium"}>
                {active.totalStudents.toLocaleString()} / {sub.learnerLimit.toLocaleString()}
              </span>
            </div>
            <LinearProgress variant="determinate" value={learnerPct} sx={{ height: 8, borderRadius: 999 }} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">SMS quota used</span>
              <span className={smsPct > 80 ? "font-semibold text-warning" : "font-medium"}>
                {sub.smsUsed.toLocaleString()} / {sub.smsQuota.toLocaleString()}
              </span>
            </div>
            <LinearProgress variant="determinate" value={smsPct} sx={{ height: 8, borderRadius: 999 }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current plan" value={activePlan.name} accent="primary" icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Campus allowance" value={`${active.campuses.length}/${sub.campusLimit}`} accent="accent" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Learner limit" value={sub.learnerLimit.toLocaleString()} accent="accent" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="SMS remaining" value={(sub.smsQuota - sub.smsUsed).toLocaleString()} accent="success" icon={<RefreshCw className="h-4 w-4" />} />
        <StatCard label="Support tier" value={sub.supportLevel} accent="warning" icon={<Zap className="h-4 w-4" />} />
      </div>

      <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="features" label="Included features" />
          <Tab value="compare" label="Compare plans" />
          <Tab value="invoices" label="Invoices" />
        </Tabs>

        {/* FEATURES */}
        {tab === "features" && (
        <Box className="space-y-3">
          {(["Communication", "Finance", "Operations", "Enterprise"] as const).map((cat) => {
            const catFeatures = FEATURE_ORDER.filter((fk) => FEATURE_META[fk].category === cat);
            return (
              <div key={cat} className="rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="font-semibold text-sm">{cat}</p>
                </div>
                <div className="divide-y divide-border">
                  {catFeatures.map((fk) => {
                    const meta = FEATURE_META[fk];
                    const included = isFeatureIncluded(fk);
                    return (
                      <div key={fk} className={`flex items-center gap-3 px-4 py-3 ${!included ? "opacity-60" : ""}`}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          {included
                            ? <CheckCircle2 className="h-4 w-4 text-success" />
                            : <Lock className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.description}</p>
                        </div>
                        {included ? (
                          <Chip size="small" label="Included" sx={{ ...badgeSx("success"), fontSize: 10 }} />
                        ) : (
                          <Chip
                            size="small"
                            label={`${PLAN_CATALOG[meta.availableFrom].name}+`}
                            className={PLAN_UI[meta.availableFrom].badgeClass}
                            sx={{ height: "auto", fontSize: 10, "& .MuiChip-label": { px: 1, py: 0.3 } }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </Box>
        )}

        {/* COMPARE PLANS */}
        {tab === "compare" && (
        <Box>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell className="w-52">Feature</TableCell>
                  {PLAN_IDS.map((p) => (
                    <TableCell key={p} className="text-center">
                      <div>
                        <Chip size="small" label={PLAN_CATALOG[p].name} className={PLAN_UI[p].badgeClass} sx={{ height: "auto", "& .MuiChip-label": { px: 1.25, py: 0.4 } }} />
                        {p === activePlan.id && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">current</p>
                        )}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">Monthly price</TableCell>
                  {PLAN_IDS.map((p) => (
                    <TableCell key={p} className="text-center font-semibold">
                      K{PLAN_CATALOG[p].monthlyPrice.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">Annual price</TableCell>
                  {PLAN_IDS.map((p) => (
                    <TableCell key={p} className="text-center text-muted-foreground">
                      K{PLAN_CATALOG[p].annualPrice.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">Campuses</TableCell>
                  {PLAN_IDS.map((p) => (
                    <TableCell key={p} className="text-center text-muted-foreground">
                      {PLAN_CATALOG[p].campusLimit}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">Learners</TableCell>
                  {PLAN_IDS.map((p) => (
                    <TableCell key={p} className="text-center text-muted-foreground">
                      {PLAN_CATALOG[p].learnerLimit.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">SMS / month</TableCell>
                  {PLAN_IDS.map((p) => (
                    <TableCell key={p} className="text-center text-muted-foreground">
                      {PLAN_CATALOG[p].smsQuota.toLocaleString()}
                    </TableCell>
                  ))}
                </TableRow>
                {FEATURE_ORDER.map((fk) => (
                  <TableRow key={fk}>
                    <TableCell className="text-sm">{FEATURE_META[fk].label}</TableCell>
                    {PLAN_IDS.map((p) => (
                      <TableCell key={p} className="text-center">
                        {planIncludesFeature(p, fk)
                          ? <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </Box>
        )}

        {/* INVOICES */}
        {tab === "invoices" && (
        <Box className="rounded-xl border border-border bg-card">
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading invoices…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell className="text-right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber ?? inv.id}</TableCell>
                    <TableCell className="text-muted-foreground">{(inv.createdAt ?? inv.date ?? "").slice(0, 10)}</TableCell>
                    <TableCell>{inv.description}</TableCell>
                    <TableCell className="font-medium">K{(inv.amount ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.dueDate ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={(inv.status ?? "open").charAt(0).toUpperCase() + (inv.status ?? "open").slice(1)}
                        sx={badgeSx({
                          paid: "success" as const,
                          open: "default" as const,
                          overdue: "destructive" as const,
                        }[(inv.status ?? "open") as "paid" | "open" | "overdue"] ?? "secondary")}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== "paid" && (
                          <Button size="small" variant="outlined" disabled={markPaidMutation.isPending} onClick={() => markPaidMutation.mutate(inv.id)}>
                            Mark paid
                          </Button>
                        )}
                        <IconButton size="small" aria-label="Download invoice" onClick={() => setInvoicePreview(inv)}>
                          <Download className="h-3 w-3" />
                        </IconButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No invoices yet. Invoices are created when a subscription payment is due.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
        )}
      </Box>

      <Dialog open={!!invoicePreview} onClose={() => setInvoicePreview(null)} maxWidth="sm" fullWidth>
        <DialogTitle className="print:hidden">Invoice · {invoicePreview?.id}</DialogTitle>
        <DialogContent>
          {invoicePreview && (
            <div className="print-area space-y-4 rounded-xl border border-border bg-card p-6 text-sm print:rounded-none print:border-0 print:shadow-none">
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <p className="text-lg font-bold">SRMS</p>
                  <p className="text-xs text-muted-foreground">School Records Management System</p>
                  <p className="text-xs text-muted-foreground">support@srms.zm · +260 211 000 000</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">INVOICE</p>
                  <p className="font-mono text-xs">{invoicePreview.id}</p>
                  <p className="text-xs text-muted-foreground">{(invoicePreview.date ?? "").slice(0, 10)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To</p>
                <p className="mt-1 font-semibold">{active.name}</p>
                <p className="text-xs text-muted-foreground">{[active.district, active.province].filter(Boolean).join(", ")}</p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="font-medium">{invoicePreview.description}</p>
                  <p className="text-xs text-muted-foreground">SRMS subscription — {activePlan.name}</p>
                </div>
                <p className="font-mono text-lg font-bold">K{invoicePreview.amount.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs uppercase text-muted-foreground">Status</span>
                <Chip
                  size="small"
                  label={invoicePreview.status.charAt(0).toUpperCase() + invoicePreview.status.slice(1)}
                  sx={badgeSx({
                    paid: "success" as const,
                    open: "default" as const,
                    overdue: "destructive" as const,
                  }[invoicePreview.status as "paid" | "open" | "overdue"] ?? "secondary")}
                />
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions className="print:hidden">
          <Button variant="outlined" color="inherit" onClick={() => setInvoicePreview(null)}>Close</Button>
          <Button onClick={() => window.print()} startIcon={<Printer className="h-4 w-4" />}>Print / Save as PDF</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
