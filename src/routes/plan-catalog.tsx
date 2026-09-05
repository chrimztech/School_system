import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CreditCard, Layers, Plus, Rocket, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { appendAddOn, appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendPromotion, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { PLAN_CATALOG, type PlanId, type SupportLevel, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx } from "@/lib/utils";

type PlanDraft = {
  id: PlanId;
  name: string;
  badge: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  campusLimit: number;
  learnerLimit: number;
  smsQuota: number;
  supportLevel: SupportLevel;
  status: "Active" | "Draft";
};

type AddOn = {
  id: string;
  name: string;
  category: string;
  monthlyPrice: number;
  description: string;
  plans: string;
  active: boolean;
};

type Promotion = {
  id: string;
  name: string;
  audience: string;
  incentive: string;
  expiry: string;
  status: "Active" | "Paused";
};

const emptyAddOnDraft = { name: "", category: "", monthlyPrice: 0, description: "", plans: "" };
const emptyPromotionDraft = { name: "", audience: "", incentive: "", expiry: "" };

// The four real plan tiers (core/growth/advanced/enterprise) are hardcoded in
// `PLAN_CATALOG` (src/lib/tenant.tsx) — that's what actually gates a school's features,
// campus/learner limits, and the price `changePlan()`/`createTenantSubscription()` bill
// them at. `workspace.plans` here is a *separate*, freeform JSON blob with no link back
// to PLAN_CATALOG: nothing enforces the id/name/price a super-admin edits on this page to
// match reality, and saving a draft here does not change what a school is actually
// charged or which features unlock for them. When workspace.plans is empty (as it is on
// a fresh/wiped workspace) we seed the four cards below directly from PLAN_CATALOG so this
// page at least *starts* truthful; editing and saving a draft persists it into
// workspace.plans same as before, but that persisted copy still won't feed back into
// PLAN_CATALOG or actual billing without a further reconciliation pass (a real code change
// to tenant.tsx, or wiring PLAN_CATALOG to read from this same workspace blob) that is out
// of scope for this pass. Flagging this clearly per the audit brief.
function defaultPlanDraftsFromCatalog(): PlanDraft[] {
  return (Object.keys(PLAN_CATALOG) as PlanId[]).map((id) => {
    const def = PLAN_CATALOG[id];
    return {
      id,
      name: def.name,
      badge: def.badge,
      description: def.description,
      monthlyPrice: def.monthlyPrice,
      annualPrice: def.annualPrice,
      campusLimit: def.campusLimit,
      learnerLimit: def.learnerLimit,
      smsQuota: def.smsQuota,
      supportLevel: def.supportLevel,
      status: "Active" as const,
    };
  });
}

export const Route = createFileRoute("/plan-catalog")({
  head: () => ({ meta: [{ title: "Plan Catalog - SRMS" }] }),
  component: PlanCatalogPage,
});

function PlanCatalogPage() {
  const { user } = useAuth();
  const { tenants } = useTenant();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const storedPlans = (workspace?.plans ?? []) as PlanDraft[];
  const plans = storedPlans.length > 0 ? storedPlans : defaultPlanDraftsFromCatalog();
  const addOns = (workspace?.addOns ?? []) as AddOn[];
  const promotions = (workspace?.promotions ?? []) as Promotion[];
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);
  const [editForm, setEditForm] = useState<PlanDraft | null>(null);
  const [tab, setTab] = useState("plans");
  const [addOnDialogOpen, setAddOnDialogOpen] = useState(false);
  const [addOnDraft, setAddOnDraft] = useState(emptyAddOnDraft);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [promotionDraft, setPromotionDraft] = useState(emptyPromotionDraft);

  const activeSchools = tenants.filter((tenant) => tenant.subscription.status === "active").length;
  const trialSchools = tenants.filter((tenant) => tenant.subscription.status === "trial").length;
  const avgRevenue = activeSchools > 0
    ? Math.round(tenants.filter((tenant) => tenant.subscription.status === "active").reduce((sum, tenant) => sum + tenant.subscription.amount, 0) / activeSchools)
    : 0;
  const trialToPaid = activeSchools + trialSchools > 0 ? Math.round((activeSchools / (activeSchools + trialSchools)) * 100) : 0;

  const planUsage = useMemo(() => plans.map((plan) => ({
    ...plan,
    schools: tenants.filter((tenant) => tenant.subscription.planId === plan.id).length,
  })), [plans, tenants]);

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
      </div>
    );
  }

  const openEditor = (planId: PlanId) => {
    const plan = plans.find((entry) => entry.id === planId);
    if (!plan) return;
    setSelectedPlanId(planId);
    setEditForm({ ...plan });
  };

  const savePlan = () => {
    if (!selectedPlanId || !editForm) return;
    const nextPlans = plans.map((plan) => (plan.id === selectedPlanId ? editForm : plan));
    saveWorkspace.mutate({
      plans: nextPlans,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: `plan-${editForm.id}`,
        tenantName: editForm.name,
        subject: `Refresh commercial enablement for ${editForm.name}`,
        category: "Commercial",
        priority: "Medium",
        owner: "Finance ops",
        article: "Plan packaging guide",
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Billing",
        requester: user?.name ?? "System Administrator",
        school: "Platform",
        summary: `Approve pricing and capacity updates for ${editForm.name}`,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        action: `Updated plan draft ${editForm.name} pricing and capacity settings`,
      }),
    }, { onSuccess: () => toast.success("Plan draft updated") });
    setSelectedPlanId(null);
    setEditForm(null);
  };

  const toggleAddOn = (addOnId: string) => {
    const addOn = addOns.find((entry) => entry.id === addOnId);
    if (!addOn) return;
    const nextAddOns = addOns.map((addOn) => (
      addOn.id === addOnId ? { ...addOn, active: !addOn.active } : addOn
    ));
    saveWorkspace.mutate({
      addOns: nextAddOns,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: addOn.id,
        tenantName: addOn.name,
        subject: `${addOn.active ? "Pause" : "Activate"} add-on rollout readiness`,
        category: "Commercial",
        priority: addOn.category === "Brand" ? "High" : "Medium",
        owner: "Finance ops",
        article: "Plan packaging guide",
      }),
      ...(!addOn.active && addOn.category === "Brand"
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Commercial",
            requester: user?.name ?? "System Administrator",
            school: "Platform",
            summary: `Confirm delivery readiness before enabling ${addOn.name}`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        action: `${addOn.active ? "Paused" : "Activated"} add-on ${addOn.name}`,
      }),
    }, { onSuccess: () => toast.success("Add-on availability updated") });
  };

  const createAddOn = () => {
    if (!addOnDraft.name.trim()) return;
    saveWorkspace.mutate({
      addOns: appendAddOn(workspace, {
        name: addOnDraft.name.trim(),
        category: addOnDraft.category.trim() || "General",
        monthlyPrice: addOnDraft.monthlyPrice,
        description: addOnDraft.description.trim(),
        plans: addOnDraft.plans.trim() || "All plans",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        action: `Created add-on ${addOnDraft.name.trim()}`,
      }),
    }, { onSuccess: () => toast.success("Add-on created") });
    setAddOnDialogOpen(false);
    setAddOnDraft(emptyAddOnDraft);
  };

  const togglePromotion = (promotionId: string) => {
    const promotion = promotions.find((entry) => entry.id === promotionId);
    if (!promotion) return;
    const nextPromotions = promotions.map((promotion) => (
      promotion.id === promotionId
        ? { ...promotion, status: promotion.status === "Active" ? "Paused" : "Active" }
        : promotion
    ));
    saveWorkspace.mutate({
      promotions: nextPromotions,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: promotion.id,
        tenantName: promotion.name,
        subject: `${promotion.status === "Active" ? "Pause" : "Launch"} promotion playbook`,
        category: "Commercial",
        priority: promotion.id === "promo-recovery" ? "High" : "Medium",
        owner: "Finance ops",
        article: "Plan packaging guide",
      }),
      ...(promotion.status !== "Active"
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Billing",
            requester: user?.name ?? "System Administrator",
            school: "Platform",
            summary: `Approve launch controls for promotion ${promotion.name}`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        action: `${promotion.status === "Active" ? "Paused" : "Activated"} promotion ${promotion.name}`,
      }),
    }, { onSuccess: () => toast.success("Promotion status updated") });
  };

  const createPromotion = () => {
    if (!promotionDraft.name.trim()) return;
    saveWorkspace.mutate({
      promotions: appendPromotion(workspace, {
        name: promotionDraft.name.trim(),
        audience: promotionDraft.audience.trim() || "All schools",
        incentive: promotionDraft.incentive.trim(),
        expiry: promotionDraft.expiry.trim(),
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Billing",
        action: `Created promotion ${promotionDraft.name.trim()}`,
      }),
    }, { onSuccess: () => toast.success("Promotion created") });
    setPromotionDialogOpen(false);
    setPromotionDraft(emptyPromotionDraft);
  };

  const publishCatalog = () => {
    saveWorkspace.mutate({
      exportJobs: appendExportJob(workspace, {
        school: "Platform",
        scope: "Published pricing and plan catalog",
        requestedBy: user?.name ?? "System Administrator",
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "platform-commercial",
        tenantName: "Commercial workspace",
        subject: "Distribute updated pricing catalog",
        category: "Commercial",
        priority: "Medium",
        owner: "Finance ops",
        article: "Plan packaging guide",
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Billing",
        requester: user?.name ?? "System Administrator",
        school: "Platform",
        summary: "Final review for pricing and plan catalog publication",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Published pricing and plan catalog draft",
      }),
    }, { onSuccess: () => toast.success("Pricing and catalog draft published to commercial workspace") });
  };

  const pushPromotionToSales = (promotion: Promotion) => {
    saveWorkspace.mutate({
      supportTickets: appendSupportTicket(workspace, {
        tenantId: tenants[0]?.id ?? "platform-commercial",
        tenantName: tenants[0]?.name ?? "Commercial workspace",
        subject: `Sales rollout for ${promotion.name}`,
        category: "Commercial",
        priority: "Medium",
        owner: "Finance ops",
        article: "Plan packaging guide",
      }),
      ...(promotion.id === "promo-recovery"
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Commercial",
            requester: user?.name ?? "System Administrator",
            school: "Platform",
            summary: `Review concession guardrails for ${promotion.name}`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Pushed promotion ${promotion.name} to sales workflow`,
      }),
    }, { onSuccess: () => toast.success("Promotion attached to onboarding workflow") });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan Catalog"
        description="Manage plan packaging, add-ons, promotions, and commercial positioning for the multi-tenant subscription business."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/billing">Open billing</Button>
            <Button variant="contained" startIcon={<Rocket size={16} />} onClick={publishCatalog}>
              Publish catalog draft
            </Button>
          </>
        )}
      />

      <Dialog
        open={Boolean(editForm)}
        onClose={() => {
          setSelectedPlanId(null);
          setEditForm(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit plan draft</DialogTitle>
        <DialogContent>
          {editForm && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Monthly price"
                  type="number"
                  value={editForm.monthlyPrice}
                  onChange={(event) => setEditForm({ ...editForm, monthlyPrice: Number(event.target.value) || 0 })}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Annual price"
                  type="number"
                  value={editForm.annualPrice}
                  onChange={(event) => setEditForm({ ...editForm, annualPrice: Number(event.target.value) || 0 })}
                  fullWidth
                  size="small"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Campus limit"
                  type="number"
                  value={editForm.campusLimit}
                  onChange={(event) => setEditForm({ ...editForm, campusLimit: Number(event.target.value) || 0 })}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Learner limit"
                  type="number"
                  value={editForm.learnerLimit}
                  onChange={(event) => setEditForm({ ...editForm, learnerLimit: Number(event.target.value) || 0 })}
                  fullWidth
                  size="small"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="SMS quota"
                  type="number"
                  value={editForm.smsQuota}
                  onChange={(event) => setEditForm({ ...editForm, smsQuota: Number(event.target.value) || 0 })}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Support level"
                  value={editForm.supportLevel}
                  onChange={(event) => setEditForm({ ...editForm, supportLevel: event.target.value as SupportLevel })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="Standard">Standard</MenuItem>
                  <MenuItem value="Priority">Priority</MenuItem>
                  <MenuItem value="Dedicated">Dedicated</MenuItem>
                </TextField>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => { setSelectedPlanId(null); setEditForm(null); }}>Cancel</Button>
          <Button variant="contained" onClick={savePlan}>Save draft</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOnDialogOpen} onClose={() => setAddOnDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New add-on</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField
              label="Add-on name"
              value={addOnDraft.name}
              onChange={(event) => setAddOnDraft({ ...addOnDraft, name: event.target.value })}
              fullWidth
              size="small"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Category"
                value={addOnDraft.category}
                onChange={(event) => setAddOnDraft({ ...addOnDraft, category: event.target.value })}
                fullWidth
                size="small"
                placeholder="e.g. Brand, Analytics"
              />
              <TextField
                label="Monthly price"
                type="number"
                value={addOnDraft.monthlyPrice}
                onChange={(event) => setAddOnDraft({ ...addOnDraft, monthlyPrice: Number(event.target.value) || 0 })}
                fullWidth
                size="small"
              />
            </div>
            <TextField
              label="Eligible plans"
              value={addOnDraft.plans}
              onChange={(event) => setAddOnDraft({ ...addOnDraft, plans: event.target.value })}
              fullWidth
              size="small"
              placeholder="e.g. Growth, Advanced, Enterprise"
            />
            <TextField
              label="Description"
              value={addOnDraft.description}
              onChange={(event) => setAddOnDraft({ ...addOnDraft, description: event.target.value })}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAddOnDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!addOnDraft.name.trim()} onClick={createAddOn}>Create add-on</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={promotionDialogOpen} onClose={() => setPromotionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New promotion</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField
              label="Promotion name"
              value={promotionDraft.name}
              onChange={(event) => setPromotionDraft({ ...promotionDraft, name: event.target.value })}
              fullWidth
              size="small"
              autoFocus
            />
            <TextField
              label="Audience"
              value={promotionDraft.audience}
              onChange={(event) => setPromotionDraft({ ...promotionDraft, audience: event.target.value })}
              fullWidth
              size="small"
              placeholder="e.g. New signups, Past-due schools"
            />
            <TextField
              label="Incentive"
              value={promotionDraft.incentive}
              onChange={(event) => setPromotionDraft({ ...promotionDraft, incentive: event.target.value })}
              fullWidth
              size="small"
              placeholder="e.g. 2 months free on annual plans"
            />
            <TextField
              label="Expiry"
              value={promotionDraft.expiry}
              onChange={(event) => setPromotionDraft({ ...promotionDraft, expiry: event.target.value })}
              fullWidth
              size="small"
              placeholder="e.g. 31 Dec 2026"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setPromotionDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!promotionDraft.name.trim()} onClick={createPromotion}>Create promotion</Button>
        </DialogActions>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active plans" value={plans.filter((plan) => plan.status === "Active").length} accent="primary" icon={<Layers className="h-4 w-4" />} />
        <StatCard label="Schools on trial pricing" value={trialSchools} accent="warning" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Trial to paid rate" value={`${trialToPaid}%`} accent="success" icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Average revenue per school" value={`K${avgRevenue.toLocaleString()}`} accent="accent" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="plans" label="Plans" />
        <Tab value="addons" label="Add-ons" />
        <Tab value="promotions" label="Promotions" />
      </Tabs>

      {tab === "plans" && (
        <Box className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {planUsage.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.badge}</p>
                </div>
                <Chip size="small" label={`${plan.schools} schools`} sx={badgeSx("outline")} />
              </div>
              <p className="mt-4 text-3xl font-semibold">K{plan.monthlyPrice.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">monthly · K{plan.annualPrice.toLocaleString()} annual</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Campuses</span><span>{plan.campusLimit}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Learners</span><span>{plan.learnerLimit.toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">SMS quota</span><span>{plan.smsQuota.toLocaleString()}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Support</span><span>{plan.supportLevel}</span></div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-5 flex gap-2">
                <Button variant="outlined" size="small" sx={{ flex: 1 }} onClick={() => openEditor(plan.id)}>Edit draft</Button>
                <Button variant="contained" size="small" sx={{ flex: 1 }} component={Link} to="/tenant-success">View tenants</Button>
              </div>
            </div>
          ))}
        </Box>
      )}

      {tab === "addons" && (
        <Box className="space-y-3">
          <div className="flex justify-end">
            <Button size="small" variant="outlined" startIcon={<Plus size={14} />} onClick={() => setAddOnDialogOpen(true)}>
              New add-on
            </Button>
          </div>
          <Box className="rounded-xl border border-border bg-card">
            {addOns.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No add-ons yet"
                description="Add-ons let you sell optional capabilities on top of a plan. Create the first one to get started."
                action={{ label: "New add-on", onClick: () => setAddOnDialogOpen(true) }}
              />
            ) : (
              <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Add-on</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Eligible plans</TableCell>
                    <TableCell>Monthly price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {addOns.map((addOn) => (
                    <TableRow key={addOn.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{addOn.name}</p>
                          <p className="text-xs text-muted-foreground">{addOn.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>{addOn.category}</TableCell>
                      <TableCell>{addOn.plans}</TableCell>
                      <TableCell>K{addOn.monthlyPrice.toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={addOn.active ? "Active" : "Paused"}
                          sx={badgeSx(addOn.active ? "success" : "secondary")}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="small" variant="outlined" onClick={() => toggleAddOn(addOn.id)}>
                          {addOn.active ? "Pause" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      )}

      {tab === "promotions" && (
        <Box className="space-y-3">
          <div className="flex justify-end">
            <Button size="small" variant="outlined" startIcon={<Plus size={14} />} onClick={() => setPromotionDialogOpen(true)}>
              New promotion
            </Button>
          </div>
          {promotions.length === 0 ? (
            <Box className="rounded-xl border border-border bg-card">
              <EmptyState
                icon={Rocket}
                title="No promotions yet"
                description="Promotions drive trial conversion and win-back campaigns. Create the first one to get started."
                action={{ label: "New promotion", onClick: () => setPromotionDialogOpen(true) }}
              />
            </Box>
          ) : (
            <Box className="grid gap-4 lg:grid-cols-3">
              {promotions.map((promotion) => (
                <div key={promotion.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{promotion.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{promotion.audience}</p>
                    </div>
                    <Chip
                      size="small"
                      label={promotion.status}
                      sx={badgeSx(promotion.status === "Active" ? "success" : "secondary")}
                    />
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Offer</span>
                      <span>{promotion.incentive}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Expiry</span>
                      <span>{promotion.expiry}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-2">
                    <Button variant="outlined" size="small" sx={{ flex: 1 }} onClick={() => togglePromotion(promotion.id)}>
                      {promotion.status === "Active" ? "Pause" : "Activate"}
                    </Button>
                    <Button variant="contained" size="small" sx={{ flex: 1 }} onClick={() => pushPromotionToSales(promotion)}>
                      Push to sales
                    </Button>
                  </div>
                </div>
              ))}
            </Box>
          )}
        </Box>
      )}
    </div>
  );
}
