import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  School, TrendingUp, Users, CreditCard, Plus, Search,
  CheckCircle2, AlertTriangle, XCircle, Clock, ArrowUpRight,
  Building2, MoreHorizontal, Activity, LifeBuoy, Layers, FileCog, FileText, Wallet,
  Star, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Chip, IconButton, InputAdornment, LinearProgress, MenuItem, Switch, TextField,
  Dialog, DialogContent, DialogActions, DialogTitle, Menu, Divider, Tabs, Tab,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
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
  return <Chip size="small" label={PLAN_CATALOG[planId].name} className={ui.badgeClass} sx={{ height: "auto", "& .MuiChip-label": { px: 1.25, py: 0.4 } }} />;
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const ui = STATUS_UI[status];
  const icon = {
    active: <CheckCircle2 className="h-3 w-3" />,
    trial: <Clock className="h-3 w-3" />,
    past_due: <AlertTriangle className="h-3 w-3" />,
    suspended: <XCircle className="h-3 w-3" />,
  }[status];
  return <Chip size="small" icon={icon} label={ui.label} className={ui.badgeClass} sx={{ height: "auto", "& .MuiChip-label": { px: 1.25, py: 0.4 } }} />;
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

  const [testimonialOpen, setTestimonialOpen] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState({ authorName: "", authorRole: "", schoolName: "", quote: "", rating: 5 });

  const { data: testimonials = [], isLoading: testimonialsLoading } = useQuery({
    queryKey: ["platform-testimonials"],
    queryFn: () => api.testimonials.adminList(),
    enabled: isSystemAdmin,
  });

  const createTestimonialMutation = useMutation({
    mutationFn: (data: any) => api.testimonials.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-testimonials"] });
      toast.success("Testimonial added");
      setTestimonialForm({ authorName: "", authorRole: "", schoolName: "", quote: "", rating: 5 });
      setTestimonialOpen(false);
    },
    onError: () => toast.error("Failed to add testimonial"),
  });

  const toggleTestimonialApprovalMutation = useMutation({
    mutationFn: ({ id, testimonial, approved }: { id: string; testimonial: any; approved: boolean }) =>
      api.testimonials.update(id, { ...testimonial, approved }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-testimonials"] });
      qc.invalidateQueries({ queryKey: ["public-testimonials"] });
    },
    onError: () => toast.error("Failed to update testimonial"),
  });

  const deleteTestimonialMutation = useMutation({
    mutationFn: (id: string) => api.testimonials.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-testimonials"] });
      toast.success("Testimonial removed");
    },
    onError: () => toast.error("Failed to remove testimonial"),
  });

  const deleteSchool = useMutation({
    mutationFn: (id: string) => api.schools.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["platform-workspace"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      // Tenants aren't react-query-managed — force TenantProvider to refetch /api/schools
      // so the deleted school actually disappears from this page without a manual refresh.
      if (typeof window !== "undefined") window.dispatchEvent(new Event("srms-session-changed"));
      toast.success("School permanently deleted");
      setDeleteTarget(null);
      setDeleteConfirmText("");
    },
    onError: () => toast.error("Failed to delete school"),
  });

  const [q, setQ] = useState("");
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuTenantId, setRowMenuTenantId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; shortCode: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    planId: "core", status: "active", billingCycle: "monthly",
    amount: "", renewalDate: "", billingContact: "", notes: "",
  });
  const [editFeatures, setEditFeatures] = useState<TenantFeatureFlags>(buildFeatureFlags("core"));
  const [showFeatures, setShowFeatures] = useState(false);
  const [tab, setTab] = useState("schools");

  if (user?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold text-lg">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
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
            <Button variant="outlined" component={Link} to="/platform-ops" startIcon={<Activity size={16} />}>Platform ops</Button>
            <Button variant="contained" component={Link} to="/onboarding" startIcon={<Plus size={16} />}>Onboard school</Button>
          </>
        }
      />

      {/* Edit subscription dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit subscription — {tenants.find((t) => t.id === selectedId)?.name}</DialogTitle>
        <DialogContent>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                select
                label="Plan"
                value={editForm.planId}
                onChange={(e) => {
                  const p = e.target.value as PlanId;
                  setEditForm((f) => ({
                    ...f,
                    planId: p,
                    amount: String(f.billingCycle === "annual" ? PLAN_CATALOG[p].annualPrice : PLAN_CATALOG[p].monthlyPrice),
                  }));
                  setEditFeatures(buildFeatureFlags(p));
                }}
                fullWidth
                size="small"
              >
                {PLAN_IDS.map((p) => (
                  <MenuItem key={p} value={p}>
                    {PLAN_CATALOG[p].name} — K{PLAN_CATALOG[p].monthlyPrice.toLocaleString()}/mo
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Status"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as SubscriptionStatus })}
                fullWidth
                size="small"
              >
                {STATUSES.map((s) => <MenuItem key={s} value={s}>{STATUS_UI[s].label}</MenuItem>)}
              </TextField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                select
                label="Billing cycle"
                value={editForm.billingCycle}
                onChange={(e) => {
                  const billingCycle = e.target.value as BillingCycle;
                  const plan = PLAN_CATALOG[editForm.planId];
                  setEditForm((current) => ({
                    ...current,
                    billingCycle,
                    amount: String(billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice),
                  }));
                }}
                fullWidth
                size="small"
              >
                {CYCLES.map((c) => <MenuItem key={c} value={c}>{c === "monthly" ? "Monthly" : "Annual"}</MenuItem>)}
              </TextField>
              <TextField
                type="number"
                label="Amount (ZMW)"
                slotProps={{ htmlInput: { min: 0 } }}
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                fullWidth
                size="small"
              />
            </div>
            <TextField
              label="Renewal date"
              value={editForm.renewalDate}
              onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })}
              placeholder="01 Jan 2027"
              slotProps={{ htmlInput: { maxLength: 30 } }}
              fullWidth
              size="small"
            />
            <TextField
              label="Billing contact email"
              value={editForm.billingContact}
              onChange={(e) => setEditForm({ ...editForm, billingContact: e.target.value })}
              placeholder="bursar@school.zm"
              slotProps={{ htmlInput: { maxLength: 100 } }}
              fullWidth
              size="small"
            />
            <TextField
              label="Notes"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Optional internal note"
              slotProps={{ htmlInput: { maxLength: 200 } }}
              fullWidth
              size="small"
            />
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
                              onChange={(e) => setEditFeatures((f) => ({ ...f, [fk]: e.target.checked }))}
                              disabled={!inPlan}
                              className="shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{meta.label}</p>
                            </div>
                            {inPlan ? (
                              <span className="text-[9px] text-success font-medium shrink-0">In plan</span>
                            ) : (
                              <Chip
                                size="small"
                                label={`${PLAN_CATALOG[meta.availableFrom].name}+`}
                                className={PLAN_UI[meta.availableFrom].badgeClass}
                                sx={{ height: "auto", flexShrink: 0, "& .MuiChip-label": { px: 1, py: 0.2, fontSize: 9 } }}
                              />
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
        </DialogContent>
        <DialogActions className="mt-2">
          <Button variant="outlined" color="inherit" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>Save changes</Button>
        </DialogActions>
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

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="schools" label={`Schools (${tenants.length})`} />
        <Tab value="revenue" label="Revenue" />
        <Tab value="plans" label="Plans & pricing" />
        <Tab value="testimonials" label="Testimonials" />
      </Tabs>

      {/* SCHOOLS */}
      {tab === "schools" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <div className="flex-1">
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search school name, district, or code"
                fullWidth
                size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
              />
            </div>
            <Button variant="outlined" size="small" onClick={exportSubscribers}>Export CSV</Button>
          </div>
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Structure</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Students</TableCell>
                <TableCell>Monthly fee</TableCell>
                <TableCell>Renewal</TableCell>
                <TableCell>Support</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className={t.subscription.status === "suspended" ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: t.primaryColor }}
                      >
                        {t.logoUrl ? (
                          <img src={t.logoUrl} alt={t.shortCode} className="h-full w-full object-contain" />
                        ) : (
                          t.shortCode.slice(0, 2)
                        )}
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
                    <IconButton
                      size="small"
                      aria-label={`Actions for ${t.name}`}
                      onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTenantId(t.id); }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </IconButton>
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
          </TableContainer>
        </div>
      )}

      <Menu
          anchorEl={rowMenuAnchor}
          open={Boolean(rowMenuAnchor)}
          onClose={() => { setRowMenuAnchor(null); setRowMenuTenantId(null); }}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {(() => {
            const t = tenants.find((x) => x.id === rowMenuTenantId);
            if (!t) return null;
            const closeMenu = () => { setRowMenuAnchor(null); setRowMenuTenantId(null); };
            return [
              <MenuItem key="workspace" onClick={() => { openTenantWorkspace(t.id, "/"); closeMenu(); }}>Open workspace</MenuItem>,
              <MenuItem key="billing" onClick={() => { openTenantWorkspace(t.id, "/billing"); closeMenu(); }}>Open billing</MenuItem>,
              <MenuItem key="access" onClick={() => { openTenantWorkspace(t.id, "/access"); closeMenu(); }}>Manage users</MenuItem>,
              <Divider key="d1" />,
              <MenuItem key="edit" onClick={() => { openEdit(t.id); closeMenu(); }}>Edit subscription</MenuItem>,
              <Divider key="d2" />,
              ...(t.subscription.status !== "active"
                ? [<MenuItem key="activate" onClick={() => { quickStatus(t.id, "active"); closeMenu(); }}>Activate</MenuItem>]
                : []),
              ...(t.subscription.status !== "past_due"
                ? [<MenuItem key="pastdue" onClick={() => { quickStatus(t.id, "past_due"); closeMenu(); }}>Mark past due</MenuItem>]
                : []),
              t.subscription.status !== "suspended" ? (
                <MenuItem key="suspend" className="text-destructive" onClick={() => { quickStatus(t.id, "suspended"); closeMenu(); }}>Suspend</MenuItem>
              ) : (
                <MenuItem key="reactivate" onClick={() => { quickStatus(t.id, "active"); closeMenu(); }}>Reactivate</MenuItem>
              ),
              <Divider key="d3" />,
              <MenuItem
                key="delete"
                className="text-destructive"
                onClick={() => { setDeleteTarget({ id: t.id, name: t.name, shortCode: t.shortCode }); setDeleteConfirmText(""); closeMenu(); }}
              >
                Delete school permanently
              </MenuItem>,
            ];
          })()}
        </Menu>

        <Dialog open={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeleteConfirmText(""); }} maxWidth="sm" fullWidth>
          <DialogTitle className="text-destructive">Delete school permanently</DialogTitle>
          <DialogContent>
            <div className="space-y-3 text-sm">
              <p>
                This permanently erases <strong>{deleteTarget?.name}</strong> and every record tied to
                it — students, teachers, classes, fees, attendance, everything. There is no undo and
                no way for a platform admin to recover it afterwards.
              </p>
              <TextField
                label={<>Type <span className="font-mono font-semibold">{deleteTarget?.shortCode}</span> to confirm</>}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                fullWidth
                size="small"
                slotProps={{ htmlInput: { className: "font-mono" } }}
              />
            </div>
          </DialogContent>
          <DialogActions className="mt-2">
            <Button variant="outlined" color="inherit" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={deleteSchool.isPending || deleteConfirmText !== deleteTarget?.shortCode}
              onClick={() => deleteTarget && deleteSchool.mutate(deleteTarget.id)}
            >
              {deleteSchool.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete permanently
            </Button>
          </DialogActions>
      </Dialog>

      {/* REVENUE */}
      {tab === "revenue" && (
        <div className="space-y-4">
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
                  <LinearProgress variant="determinate" value={mrr > 0 ? (planMrr / mrr) * 100 : 0} sx={{ height: 8, borderRadius: 999 }} />
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
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>School</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Cycle</TableCell>
                  <TableCell>Monthly</TableCell>
                  <TableCell>Annual (projected)</TableCell>
                  <TableCell>SMS quota used</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
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
                          <LinearProgress variant="determinate" value={smsPct} sx={{ height: 6, width: 64, borderRadius: 999 }} />
                          <span className="text-xs text-muted-foreground">{smsPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={t.subscription.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </div>
      )}

      {/* PLANS */}
      {tab === "plans" && (
        <div className="space-y-4">
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
                    <Chip size="small" label={`${schoolCount} school${schoolCount !== 1 ? "s" : ""}`} className={ui.badgeClass} sx={{ height: "auto", "& .MuiChip-label": { px: 1.25, py: 0.4 } }} />
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
        </div>
      )}

      {/* TESTIMONIALS */}
      {tab === "testimonials" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Shown on the login page — only approved testimonials are public.</p>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setTestimonialOpen(true)}>Add testimonial</Button>
            <Dialog open={testimonialOpen} onClose={() => setTestimonialOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Add testimonial</DialogTitle>
              <DialogContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Author name *" value={testimonialForm.authorName} onChange={(e) => setTestimonialForm({ ...testimonialForm, authorName: e.target.value })} placeholder="Beatrice N." fullWidth size="small" />
                    <TextField label="Role" value={testimonialForm.authorRole} onChange={(e) => setTestimonialForm({ ...testimonialForm, authorRole: e.target.value })} placeholder="Head Teacher" fullWidth size="small" />
                  </div>
                  <TextField label="School" value={testimonialForm.schoolName} onChange={(e) => setTestimonialForm({ ...testimonialForm, schoolName: e.target.value })} placeholder="Combined School, Lusaka" fullWidth size="small" />
                  <TextField label="Quote *" multiline minRows={3} value={testimonialForm.quote} onChange={(e) => setTestimonialForm({ ...testimonialForm, quote: e.target.value })} placeholder="SRMS transformed how we manage our learners..." fullWidth size="small" />
                  <div>
                    <p className="text-sm font-medium mb-1">Rating</p>
                    <div className="mt-1 flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => setTestimonialForm({ ...testimonialForm, rating: n })}>
                          <Star className={`h-5 w-5 ${n <= testimonialForm.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setTestimonialOpen(false)}>Cancel</Button>
                <Button
                  variant="contained"
                  disabled={createTestimonialMutation.isPending}
                  onClick={() => {
                    if (!testimonialForm.authorName.trim() || !testimonialForm.quote.trim()) {
                      toast.error("Author name and quote are required");
                      return;
                    }
                    createTestimonialMutation.mutate(testimonialForm);
                  }}
                >
                  Add testimonial
                </Button>
              </DialogActions>
            </Dialog>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Author</TableCell>
                  <TableCell>Quote</TableCell>
                  <TableCell>Rating</TableCell>
                  <TableCell>Approved</TableCell>
                  <TableCell className="text-right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(testimonials as any[]).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.authorName}</p>
                      <p className="text-xs text-muted-foreground">{[t.authorRole, t.schoolName].filter(Boolean).join(" · ")}</p>
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-sm text-muted-foreground">{t.quote}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < t.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={t.approved}
                        onChange={(e) => toggleTestimonialApprovalMutation.mutate({ id: t.id, testimonial: t, approved: e.target.checked })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <IconButton
                        size="small"
                        aria-label={`Remove testimonial from ${t.authorName}`}
                        onClick={() => {
                          if (window.confirm(`Remove testimonial from ${t.authorName}?`)) deleteTestimonialMutation.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!testimonialsLoading && (testimonials as any[]).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No testimonials yet. Add one to show it on the login page.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </div>
      )}

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
          <Button
            key={link.label}
            variant="outlined"
            component={Link}
            to={link.to}
            sx={{ height: "auto", flexDirection: "column", gap: 1, py: 2 }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{link.icon}</span>
            <span className="text-xs text-center leading-tight">{link.label}</span>
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          </Button>
        ))}
      </div>
    </div>
  );
}
