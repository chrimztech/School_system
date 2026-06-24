import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, CheckCircle2, Lock, Zap, ArrowRight, RefreshCw, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useTenant, PLAN_CATALOG, FEATURE_META, FEATURE_ORDER,
  planIncludesFeature, type PlanId, type BillingCycle,
} from "@/lib/tenant";
import { PLAN_UI, STATUS_UI } from "@/lib/subscription";
import { api } from "@/lib/api";

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

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [targetPlan, setTargetPlan] = useState<PlanId>(activePlan.id);
  const [targetCycle, setTargetCycle] = useState<BillingCycle>(sub.billingCycle);

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
          <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
            <DialogTrigger asChild>
              <Button><Zap className="mr-2 h-4 w-4" />Change plan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Change subscription plan</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div>
                    <Label>New plan</Label>
                    <Select value={targetPlan} onValueChange={(v) => setTargetPlan(v as PlanId)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLAN_IDS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PLAN_CATALOG[p].name} — K{PLAN_CATALOG[p].monthlyPrice.toLocaleString()}/mo
                            {p === activePlan.id ? " (current)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Billing cycle</Label>
                    <Select value={targetCycle} onValueChange={(v) => setTargetCycle(v as BillingCycle)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual (save ~17%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setUpgradeOpen(false)}>Cancel</Button>
                <Button onClick={confirmChange}>
                  <ArrowRight className="mr-2 h-4 w-4" />Confirm change
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Current plan hero card */}
      <div className="rounded-xl border-2 bg-card p-6 space-y-4" style={{ borderColor: planUi.color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={planUi.badgeClass}>{activePlan.name}</Badge>
              <Badge className={statusUi.badgeClass}>{statusUi.label}</Badge>
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
            <Progress value={campusPct} className="h-2" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Learners used</span>
              <span className={learnerPct > 90 ? "font-semibold text-warning" : "font-medium"}>
                {active.totalStudents.toLocaleString()} / {sub.learnerLimit.toLocaleString()}
              </span>
            </div>
            <Progress value={learnerPct} className="h-2" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">SMS quota used</span>
              <span className={smsPct > 80 ? "font-semibold text-warning" : "font-medium"}>
                {sub.smsUsed.toLocaleString()} / {sub.smsQuota.toLocaleString()}
              </span>
            </div>
            <Progress value={smsPct} className="h-2" />
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

      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features">Included features</TabsTrigger>
          <TabsTrigger value="compare">Compare plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* FEATURES */}
        <TabsContent value="features" className="space-y-3">
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
                          <Badge className="bg-success/15 text-success text-[10px]">Included</Badge>
                        ) : (
                          <Badge className={`${PLAN_UI[meta.availableFrom].badgeClass} text-[10px]`}>
                            {PLAN_CATALOG[meta.availableFrom].name}+
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* COMPARE PLANS */}
        <TabsContent value="compare">
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-52">Feature</TableHead>
                  {PLAN_IDS.map((p) => (
                    <TableHead key={p} className="text-center">
                      <div>
                        <Badge className={PLAN_UI[p].badgeClass}>{PLAN_CATALOG[p].name}</Badge>
                        {p === activePlan.id && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">current</p>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
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
          </div>
        </TabsContent>

        {/* INVOICES */}
        <TabsContent value="invoices" className="rounded-xl border border-border bg-card">
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading invoices…</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber ?? inv.id}</TableCell>
                    <TableCell className="text-muted-foreground">{(inv.createdAt ?? inv.date ?? "").slice(0, 10)}</TableCell>
                    <TableCell>{inv.description}</TableCell>
                    <TableCell className="font-medium">K{(inv.amount ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.dueDate ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={{
                        paid: "bg-success/15 text-success",
                        open: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                        overdue: "bg-destructive/15 text-destructive",
                      }[(inv.status ?? "open") as "paid" | "open" | "overdue"] ?? "bg-muted text-muted-foreground"}>
                        {(inv.status ?? "open").charAt(0).toUpperCase() + (inv.status ?? "open").slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== "paid" && (
                          <Button size="sm" variant="outline" disabled={markPaidMutation.isPending} onClick={() => markPaidMutation.mutate(inv.id)}>
                            Mark paid
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toast.info("PDF download requires a billing integration. Contact support.")}>
                          <Download className="h-3 w-3" />
                        </Button>
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
