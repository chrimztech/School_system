import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  School, TrendingUp, Users, CreditCard, Plus, Search,
  CheckCircle2, AlertTriangle, XCircle, Clock, ArrowUpRight,
  Building2, MoreHorizontal, Activity, LifeBuoy, Layers, FileCog, FileText, Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { appendExportJob, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { downloadCsv } from "@/lib/utils";
import {
  ACADEMIC_LEVEL_META, useTenant, PLAN_CATALOG, FEATURE_META, FEATURE_ORDER, buildFeatureFlags, planIncludesFeature,
  type PlanId, type SubscriptionStatus, type BillingCycle, type TenantFeatureFlags,
} from "@/lib/tenant";
import { PLAN_UI, STATUS_UI } from "@/lib/subscription";

export const Route = createFileRoute("/sys-admin")({
  head: () => ({ meta: [{ title: "System Administration — SRMS" }] }),
  component: SysAdminPage,
});

const PLAN_IDS: PlanId[] = ["core", "growth", "advanced", "enterprise"];
const STATUSES: SubscriptionStatus[] = ["active", "trial", "past_due", "suspended"];
const CYCLES: BillingCycle[] = ["monthly", "annual"];

function PlanBadge({ planId }: { planId: PlanId }) {
  const ui = PLAN_UI[planId];
  return <Badge className={ui.badgeClass}>{PLAN_CATALOG[planId].name}</Badge>;
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const ui = STATUS_UI[status];
  const icon = {
    active: <CheckCircle2 className="h-3 w-3" />,
    trial: <Clock className="h-3 w-3" />,
    past_due: <AlertTriangle className="h-3 w-3" />,
    suspended: <XCircle className="h-3 w-3" />,
  }[status];
  return <Badge className={`${ui.badgeClass} flex items-center gap-1`}>{icon}{ui.label}</Badge>;
}

type EditForm = {
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: string;
  renewalDate: string;
  billingContact: string;
  notes: string;
};

function SysAdminPage() {
  const { user, isSystemAdmin } = useAuth();
  const { tenants, updateTenant, setActive } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();

  const { data: gatewayBalance, isLoading: balanceLoading, isError: balanceError } = useQuery({
    queryKey: ["zynlepay-balance"],
    queryFn: () => api.platform.zynlepayBalance(),
    enabled: isSystemAdmin,
    retry: false,
  });

  const deleteSchool = useMutation({
    mutationFn: (id: string) => api.schools.delete(id),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ["platform-workspace"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("School deactivated");
    },
    onError: () => toast.error("Failed to deactivate school"),
  });

  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    planId: "core", status: "active", billingCycle: "monthly",
    amount: "", renewalDate: "", billingContact: "", notes: "",
  });
  const [editFeatures, setEditFeatures] = useState<TenantFeatureFlags>(buildFeatureFlags("core"));
  const [showFeatures, setShowFeatures] = useState(false);

  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold text-lg">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
      </div>
    );
  }

  // Platform-level stats
  const totalStudents = tenants.reduce((s, t) => s + t.totalStudents, 0);
  const totalCampuses = tenants.reduce((s, t) => s + t.campuses.length, 0);
  const activeSubs = tenants.filter((t) => ["active", "trial"].includes(t.subscription.status)).length;
  const mrr = tenants
    .filter((t) => t.subscription.status === "active")
    .reduce((s, t) => s + t.subscription.amount, 0);
  const pastDue = tenants.filter((t) => t.subscription.status === "past_due").length;

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return tenants.filter(
      (t) => !lq || t.name.toLowerCase().includes(lq) ||
        t.district.toLowerCase().includes(lq) ||
        t.shortCode.toLowerCase().includes(lq) ||
        t.campuses.some((campus) => campus.name.toLowerCase().includes(lq)),
    );
  }, [tenants, q]);

  const openEdit = (id: string) => {
    const t = tenants.find((x) => x.id === id);
    if (!t) return;
    setSelectedId(id);
    setEditForm({
      planId: t.subscription.planId,
      status: t.subscription.status,
      billingCycle: t.subscription.billingCycle,
      amount: String(t.subscription.amount),
      renewalDate: t.subscription.renewalDate,
      billingContact: t.subscription.billingContact,
      notes: t.subscription.notes ?? "",
    });
    setEditFeatures(t.features);
    setShowFeatures(false);
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!selectedId) return;
    const t = tenants.find((x) => x.id === selectedId);
    if (!t) return;
    const plan = PLAN_CATALOG[editForm.planId];
    const defaultAmount = editForm.billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    updateTenant(selectedId, {
      subscription: {
        planId: editForm.planId,
        status: editForm.status,
        billingCycle: editForm.billingCycle,
        amount: Number(editForm.amount) || defaultAmount,
        renewalDate: editForm.renewalDate || t.subscription.renewalDate,
        billingContact: editForm.billingContact,
        notes: editForm.notes || undefined,
        learnerLimit: plan.learnerLimit,
        smsQuota: plan.smsQuota,
        supportLevel: plan.supportLevel,
      },
      features: editFeatures,
    });
    saveWorkspace.mutate({
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: t.name,
        area: "Billing",
        action: `Updated subscription to ${PLAN_CATALOG[editForm.planId].name} on ${editForm.billingCycle} billing with status ${STATUS_UI[editForm.status].label}`,
      }),
    });
    toast.success("Subscription updated");
    setEditOpen(false);
  };

  const quickStatus = (id: string, status: SubscriptionStatus) => {
    const t = tenants.find((x) => x.id === id);
    if (!t) return;
    updateTenant(id, { subscription: { status } });
    saveWorkspace.mutate({
      ...(status === "past_due" || status === "suspended"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: t.id,
            tenantName: t.name,
            subject: status === "suspended" ? "Suspension review required" : "Past-due subscription follow-up",
            category: "Billing",
            priority: status === "suspended" ? "High" : "Medium",
            owner: status === "suspended" ? "Platform desk" : "Finance ops",
            article: status === "suspended" ? "Renewal and success workflow" : "Plan packaging guide",
            slaHours: status === "suspended" ? 4 : 24,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: t.name,
        area: "Billing",
        severity: status === "suspended" ? "Critical" : status === "past_due" ? "Warning" : "Info",
        action: `Set subscription status to ${STATUS_UI[status].label}`,
      }),
    });
    toast.success(`${t.name} — status set to ${STATUS_UI[status].label}`);
  };

  const exportSubscribers = () => {
    saveWorkspace.mutate({
      exportJobs: appendExportJob(workspace, {
        school: "Platform",
        scope: "Subscriber school portfolio export",
        requestedBy: user?.name ?? "System Administrator",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Queued subscriber school CSV export",
      }),
    });
    downloadCsv(tenants.map((t) => ({ School: t.name, District: t.district, Province: t.province, Plan: PLAN_CATALOG[t.subscription.planId].name, Status: t.subscription.status, "MRR (K)": t.subscription.amount, "Renewal Date": t.subscription.renewalDate, Students: t.totalStudents, Campuses: t.campuses.length, "Billing Contact": t.subscription.billingContact })), "subscriber-portfolio");
    toast.success("Portfolio export queued");
  };

  const openTenantWorkspace = (tenantId: string, destination: "/" | "/billing" | "/access") => {
    setActive(tenantId);
    navigate({ to: destination });
  };

  // Revenue per plan
  const revenueByPlan = PLAN_IDS.map((p) => {
    const schools = tenants.filter((t) => t.subscription.planId === p && t.subscription.status === "active");
    return { planId: p, count: schools.length, mrr: schools.reduce((s, t) => s + t.subscription.amount, 0) };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration"
        description="Manage all subscriber schools, plans, billing, and platform health."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/platform-ops"><Activity className="mr-2 h-4 w-4" />Platform ops</Link>
            </Button>
            <Button asChild>
              <Link to="/onboarding"><Plus className="mr-2 h-4 w-4" />Onboard school</Link>
            </Button>
          </>
        }
      />

      {/* Edit subscription dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit subscription — {tenants.find((t) => t.id === selectedId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan</Label>
                <Select value={editForm.planId} onValueChange={(v) => {
                  const p = v as PlanId;
                  setEditForm((f) => ({
                    ...f,
                    planId: p,
                    amount: String(f.billingCycle === "annual" ? PLAN_CATALOG[p].annualPrice : PLAN_CATALOG[p].monthlyPrice),
                  }));
                  setEditFeatures(buildFeatureFlags(p));
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_IDS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLAN_CATALOG[p].name} — K{PLAN_CATALOG[p].monthlyPrice.toLocaleString()}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as SubscriptionStatus })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_UI[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Billing cycle</Label>
                <Select value={editForm.billingCycle} onValueChange={(v) => {
                  const billingCycle = v as BillingCycle;
                  const plan = PLAN_CATALOG[editForm.planId];
                  setEditForm((current) => ({
                    ...current,
                    billingCycle,
                    amount: String(billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice),
                  }));
                }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CYCLES.map((c) => <SelectItem key={c} value={c}>{c === "monthly" ? "Monthly" : "Annual"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (ZMW)</Label>
                <Input type="number" min={0} className="mt-1" value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Renewal date</Label>
              <Input className="mt-1" value={editForm.renewalDate}
                onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })}
                placeholder="01 Jan 2027" maxLength={30} />
            </div>
            <div>
              <Label>Billing contact email</Label>
              <Input className="mt-1" value={editForm.billingContact}
                onChange={(e) => setEditForm({ ...editForm, billingContact: e.target.value })}
                placeholder="bursar@school.zm" maxLength={100} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input className="mt-1" value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional internal note" maxLength={200} />
            </div>
          </div>

          {/* Feature overrides */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowFeatures((v) => !v)}
              className="flex w-full items-center gap-2 text-sm font-medium"
            >
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showFeatures ? "rotate-180" : ""}`} />
              Feature overrides
              <span className="text-xs text-muted-foreground ml-1">
                ({FEATURE_ORDER.filter((fk) => editFeatures[fk] !== planIncludesFeature(editForm.planId, fk)).length} customised)
              </span>
            </button>
            {showFeatures && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border">
                {(["Communication", "Finance", "Operations", "Enterprise"] as const).map((cat) => {
                  const catFeatures = FEATURE_ORDER.filter((fk) => FEATURE_META[fk].category === cat);
                  return (
                    <div key={cat}>
                      <div className="border-b border-border bg-muted/40 px-3 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
                      </div>
                      {catFeatures.map((fk) => {
                        const meta = FEATURE_META[fk];
                        const inPlan = planIncludesFeature(editForm.planId, fk);
                        return (
                          <div key={fk} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0">
                            <Switch
                              checked={editFeatures[fk]}
                              onCheckedChange={(v) => setEditFeatures((f) => ({ ...f, [fk]: v }))}
                              disabled={!inPlan}
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{meta.label}</p>
                            </div>
                            {inPlan ? (
                              <span className="text-[9px] text-success font-medium shrink-0">In plan</span>
                            ) : (
                              <Badge className={`${PLAN_UI[meta.availableFrom].badgeClass} text-[9px] shrink-0`}>
                                {PLAN_CATALOG[meta.availableFrom].name}+
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="Subscriber schools" value={tenants.length} accent="primary" icon={<School className="h-4 w-4" />} />
        <StatCard label="Campuses" value={totalCampuses} accent="accent" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Active / trial" value={activeSubs} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Monthly revenue (MRR)" value={`K${mrr.toLocaleString()}`} accent="accent" icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Past-due accounts" value={pastDue} accent="warning" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {isSystemAdmin && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4" />ZynlePay merchant balance
          </div>
          {balanceLoading ? (
            <p className="text-sm text-muted-foreground">Checking balance…</p>
          ) : balanceError ? (
            <p className="text-sm text-muted-foreground">Unavailable — gateway credentials may not be configured yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Collection balance</p>
                <p className="mt-1 text-lg font-semibold">K {Number(gatewayBalance?.collectionBalance ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Disbursement balance</p>
                <p className="mt-1 text-lg font-semibold">K {Number(gatewayBalance?.disbursementBalance ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Merchant</p>
                <p className="mt-1 text-sm font-medium">{gatewayBalance?.merchantInformation || "—"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="schools">
        <TabsList>
          <TabsTrigger value="schools">Schools ({tenants.length})</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="plans">Plans & pricing</TabsTrigger>
        </TabsList>

        {/* SCHOOLS */}
        <TabsContent value="schools" className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search school name, district, or code" className="pl-9" />
            </div>
            <Button variant="outline" size="sm" onClick={exportSubscribers}>Export CSV</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Monthly fee</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead>Support</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className={t.subscription.status === "suspended" ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: t.primaryColor }}
                      >
                        {t.shortCode.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.district} · {t.province}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t.campuses.length} campus{t.campuses.length === 1 ? "" : "es"}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.levels.map((level) => ACADEMIC_LEVEL_META[level].label).join(", ")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell><PlanBadge planId={t.subscription.planId} /></TableCell>
                  <TableCell><StatusBadge status={t.subscription.status} /></TableCell>
                  <TableCell>
                    <span className={t.totalStudents > t.subscription.learnerLimit * 0.9 ? "text-warning font-medium" : ""}>
                      {t.totalStudents.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground"> / {t.subscription.learnerLimit.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="font-medium">K{t.subscription.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{t.subscription.renewalDate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.subscription.supportLevel}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openTenantWorkspace(t.id, "/")}>Open workspace</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openTenantWorkspace(t.id, "/billing")}>Open billing</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openTenantWorkspace(t.id, "/access")}>Manage users</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(t.id)}>Edit subscription</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {t.subscription.status !== "active" && (
                          <DropdownMenuItem onClick={() => quickStatus(t.id, "active")}>Activate</DropdownMenuItem>
                        )}
                        {t.subscription.status !== "past_due" && (
                          <DropdownMenuItem onClick={() => quickStatus(t.id, "past_due")}>Mark past due</DropdownMenuItem>
                        )}
                        {t.subscription.status !== "suspended" ? (
                          <DropdownMenuItem className="text-destructive" onClick={() => quickStatus(t.id, "suspended")}>Suspend</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => quickStatus(t.id, "active")}>Reactivate</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={deleteSchool.isPending}
                          onClick={() => {
                            if (window.confirm(`Deactivate school "${t.name}"? This action can be reversed by a platform admin.`)) {
                              deleteSchool.mutate(t.id);
                            }
                          }}
                        >
                          Deactivate school
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No schools match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* REVENUE */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* MRR by plan */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <p className="font-semibold">Revenue by plan (active MRR)</p>
              {revenueByPlan.map(({ planId, count, mrr: planMrr }) => (
                <div key={planId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <PlanBadge planId={planId} />
                      <span className="text-muted-foreground">{count} school{count !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="font-medium">K{planMrr.toLocaleString()}/mo</span>
                  </div>
                  <Progress value={mrr > 0 ? (planMrr / mrr) * 100 : 0} className="h-2" />
                </div>
              ))}
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="font-semibold">Total MRR</span>
                <span className="font-semibold text-lg">K{mrr.toLocaleString()}</span>
              </div>
            </div>

            {/* Projections & health */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="font-semibold">Platform metrics</p>
              {[
                { label: "Annual Recurring Revenue", value: `K${(mrr * 12).toLocaleString()}`, note: "MRR × 12" },
                { label: "Total learners served", value: totalStudents.toLocaleString(), note: "Across all schools" },
                { label: "Avg revenue per school", value: `K${activeSubs > 0 ? Math.round(mrr / activeSubs).toLocaleString() : 0}`, note: "Active only" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.note}</p>
                  </div>
                  <p className="text-xl font-bold">{m.value}</p>
                </div>
              ))}

              <p className="font-semibold pt-1">Accounts by status</p>
              <div className="grid grid-cols-2 gap-2">
                {STATUSES.map((s) => {
                  const count = tenants.filter((t) => t.subscription.status === s).length;
                  return (
                    <div key={s} className="rounded-lg border border-border px-3 py-2 flex items-center justify-between">
                      <StatusBadge status={s} />
                      <span className="font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Per-school revenue */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="font-semibold">Per-school revenue detail</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Annual (projected)</TableHead>
                  <TableHead>SMS quota used</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const smsPct = t.subscription.smsQuota > 0 ? Math.round((t.subscription.smsUsed / t.subscription.smsQuota) * 100) : 0;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell><PlanBadge planId={t.subscription.planId} /></TableCell>
                      <TableCell className="text-muted-foreground capitalize">{t.subscription.billingCycle}</TableCell>
                      <TableCell className="font-medium">K{t.subscription.amount.toLocaleString()}</TableCell>
                      <TableCell>K{(t.subscription.amount * 12).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={smsPct} className="h-1.5 w-16" />
                          <span className="text-xs text-muted-foreground">{smsPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={t.subscription.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PLANS */}
        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_IDS.map((planId) => {
              const plan = PLAN_CATALOG[planId];
              const ui = PLAN_UI[planId];
              const schoolCount = tenants.filter((t) => t.subscription.planId === planId).length;
              const planFeatures: Record<PlanId, string[]> = {
                core: ["Dashboard & student records", "Attendance & timetable", "Assessments & report cards", "Fees & mobile money", "Parent communication", "Offline mode"],
                growth: ["Everything in Core", "Library & transport", "Canteen management", "Lost & found", "ECZ integration", "USSD fallback", "Multi-currency"],
                advanced: ["Everything in Growth", "HR & payroll", "Hostel & boarding", "Procurement & vendors", "Staff development & CPD", "Compliance & risk", "Executive reporting"],
                enterprise: ["Everything in Advanced", "District-wide oversight", "Custom branding / white-label", "Dedicated support", "Multi-school roll-ups", "50,000 SMS quota"],
              };
              return (
                <div key={planId} className="rounded-xl border-2 bg-card p-5 space-y-4"
                  style={{ borderColor: schoolCount > 0 ? ui.color : "hsl(var(--border))" }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-lg">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.badge}</p>
                    </div>
                    <Badge className={ui.badgeClass}>{schoolCount} school{schoolCount !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">K{plan.monthlyPrice.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">per month · K{plan.annualPrice.toLocaleString()} annual</p>
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {planFeatures[planId].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted-foreground pt-1 border-t border-border space-y-0.5">
                    <p>Up to {plan.learnerLimit === 5000 ? "5,000+" : plan.learnerLimit.toLocaleString()} learners</p>
                    <p>{plan.smsQuota.toLocaleString()} SMS / month</p>
                    <p>{plan.supportLevel} support</p>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Onboard new school", icon: <Plus className="h-4 w-4" />, to: "/onboarding" },
          { label: "User management", icon: <Users className="h-4 w-4" />, to: "/user-management" },
          { label: "Enterprise analytics", icon: <TrendingUp className="h-4 w-4" />, to: "/enterprise-analytics" },
          { label: "District management", icon: <Building2 className="h-4 w-4" />, to: "/district-management" },
          { label: "Platform ops", icon: <Activity className="h-4 w-4" />, to: "/platform-ops" },
          { label: "Platform config", icon: <FileCog className="h-4 w-4" />, to: "/platform-config" },
          { label: "Platform audit", icon: <FileText className="h-4 w-4" />, to: "/platform-audit" },
          { label: "Approval center", icon: <CheckCircle2 className="h-4 w-4" />, to: "/approval-center" },
          { label: "Developer console", icon: <Activity className="h-4 w-4" />, to: "/developer-console" },
          { label: "Tenant workbench", icon: <Building2 className="h-4 w-4" />, to: "/tenant-workbench" },
          { label: "Tenant lifecycle", icon: <Building2 className="h-4 w-4" />, to: "/tenant-lifecycle" },
          { label: "Tenant success", icon: <TrendingUp className="h-4 w-4" />, to: "/tenant-success" },
          { label: "Revenue ops", icon: <CreditCard className="h-4 w-4" />, to: "/revenue-ops" },
          { label: "Data governance", icon: <Activity className="h-4 w-4" />, to: "/data-governance" },
          { label: "Partner management", icon: <Users className="h-4 w-4" />, to: "/partner-management" },
          { label: "Contract center", icon: <FileText className="h-4 w-4" />, to: "/contract-center" },
          { label: "Status center", icon: <AlertTriangle className="h-4 w-4" />, to: "/status-center" },
          { label: "Plan catalog", icon: <Layers className="h-4 w-4" />, to: "/plan-catalog" },
          { label: "Support desk", icon: <LifeBuoy className="h-4 w-4" />, to: "/support-desk" },
        ].map((link) => (
          <Button key={link.label} variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
            <Link to={link.to}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{link.icon}</span>
              <span className="text-xs text-center leading-tight">{link.label}</span>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
