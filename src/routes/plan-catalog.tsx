import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CreditCard, Layers, Rocket, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendExportJob, appendPlatformAuditEvent, appendSupportTicket } from "@/lib/platform-workspace-actions";
import { type PlanId, type SupportLevel, useTenant } from "@/lib/tenant";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

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

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
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
            <Button variant="outline" asChild>
              <Link to="/billing">Open billing</Link>
            </Button>
            <Button onClick={publishCatalog}>
              <Rocket className="mr-2 h-4 w-4" />
              Publish catalog draft
            </Button>
          </>
        )}
      />

      <Dialog open={Boolean(editForm)} onOpenChange={(open) => {
        if (!open) {
          setSelectedPlanId(null);
          setEditForm(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit plan draft</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Monthly price</Label>
                  <Input className="mt-1" type="number" value={editForm.monthlyPrice} onChange={(event) => setEditForm({ ...editForm, monthlyPrice: Number(event.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Annual price</Label>
                  <Input className="mt-1" type="number" value={editForm.annualPrice} onChange={(event) => setEditForm({ ...editForm, annualPrice: Number(event.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Campus limit</Label>
                  <Input className="mt-1" type="number" value={editForm.campusLimit} onChange={(event) => setEditForm({ ...editForm, campusLimit: Number(event.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Learner limit</Label>
                  <Input className="mt-1" type="number" value={editForm.learnerLimit} onChange={(event) => setEditForm({ ...editForm, learnerLimit: Number(event.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SMS quota</Label>
                  <Input className="mt-1" type="number" value={editForm.smsQuota} onChange={(event) => setEditForm({ ...editForm, smsQuota: Number(event.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Support level</Label>
                  <Select value={editForm.supportLevel} onValueChange={(value) => setEditForm({ ...editForm, supportLevel: value as SupportLevel })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Priority">Priority</SelectItem>
                      <SelectItem value="Dedicated">Dedicated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedPlanId(null); setEditForm(null); }}>Cancel</Button>
            <Button onClick={savePlan}>Save draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active plans" value={plans.filter((plan) => plan.status === "Active").length} accent="primary" icon={<Layers className="h-4 w-4" />} />
        <StatCard label="Schools on trial pricing" value={trialSchools} accent="warning" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Trial to paid rate" value={`${trialToPaid}%`} accent="success" icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Average revenue per school" value={`K${avgRevenue.toLocaleString()}`} accent="accent" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {planUsage.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.badge}</p>
                </div>
                <Badge variant="outline">{plan.schools} schools</Badge>
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
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditor(plan.id)}>Edit draft</Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link to="/tenant-success">View tenants</Link>
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="addons" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Add-on</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Eligible plans</TableHead>
                <TableHead>Monthly price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Badge className={addOn.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                      {addOn.active ? "Active" : "Paused"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggleAddOn(addOn.id)}>
                      {addOn.active ? "Pause" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="promotions" className="grid gap-4 lg:grid-cols-3">
          {promotions.map((promotion) => (
            <div key={promotion.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{promotion.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{promotion.audience}</p>
                </div>
                <Badge className={promotion.status === "Active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                  {promotion.status}
                </Badge>
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
                <Button variant="outline" size="sm" className="flex-1" onClick={() => togglePromotion(promotion.id)}>
                  {promotion.status === "Active" ? "Pause" : "Activate"}
                </Button>
                <Button size="sm" className="flex-1" onClick={() => pushPromotionToSales(promotion)}>
                  Push to sales
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
