import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CreditCard, Layers, Rocket, ShieldAlert, Sparkles, Wallet } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { type PlanId, type SupportLevel, useTenant } from "@/lib/tenant";
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

export const Route = createFileRoute("/plan-catalog")({
  head: () => ({ meta: [{ title: "Plan Catalog - SRMS" }] }),
  component: PlanCatalogPage,
});

function PlanCatalogPage() {
  const { user } = useAuth();
  const { tenants } = useTenant();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const plans = (workspace?.plans ?? []) as PlanDraft[];
  const addOns = (workspace?.addOns ?? []) as AddOn[];
  const promotions = (workspace?.promotions ?? []) as Promotion[];
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);
  const [editForm, setEditForm] = useState<PlanDraft | null>(null);
  const [tab, setTab] = useState("plans");

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
    });
    setSelectedPlanId(null);
    setEditForm(null);
    toast.success("Plan draft updated");
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
    });
    toast.success("Add-on availability updated");
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
    });
    toast.success("Promotion status updated");
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
    });
    toast.success("Pricing and catalog draft published to commercial workspace");
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
    });
    toast.success("Promotion attached to onboarding workflow");
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
        <Box className="rounded-xl border border-border bg-card">
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
        </Box>
      )}

      {tab === "promotions" && (
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
    </div>
  );
}
