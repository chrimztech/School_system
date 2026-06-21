import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { BadgeCheck, Globe2, Handshake, ShieldAlert, TrendingUp, Users2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

type PartnerTier = "Referral" | "Implementation" | "Strategic";
type PartnerStatus = "Active" | "Probation" | "Paused";
type DealStage = "Qualified" | "Proposal" | "Contracting" | "Won";

type Partner = {
  id: string;
  name: string;
  region: string;
  tier: PartnerTier;
  status: PartnerStatus;
  certifications: number;
  managedTenants: number;
  pipelineValue: number;
};

type Deal = {
  id: string;
  partnerId: string;
  partner: string;
  schoolLead: string;
  stage: DealStage;
  value: number;
  owner: string;
};

function tierTone(tier: PartnerTier) {
  if (tier === "Strategic") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (tier === "Implementation") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

function statusTone(status: PartnerStatus) {
  if (status === "Active") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (status === "Probation") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
}

function supportPriorityForStatus(status: PartnerStatus): "Low" | "Medium" | "High" | "Critical" {
  if (status === "Paused") return "High";
  if (status === "Probation") return "Medium";
  return "Low";
}

export const Route = createFileRoute("/partner-management")({
  head: () => ({ meta: [{ title: "Partner Management - SRMS" }] }),
  component: PartnerManagementPage,
});

function PartnerManagementPage() {
  const { user } = useAuth();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const partners = (workspace?.partners ?? []) as Partner[];
  const deals = (workspace?.partnerDeals ?? []) as Deal[];

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

  const stats = useMemo(() => ({
    activePartners: partners.filter((partner) => partner.status === "Active").length,
    totalPipeline: partners.reduce((sum, partner) => sum + partner.pipelineValue, 0),
    managedTenants: partners.reduce((sum, partner) => sum + partner.managedTenants, 0),
    certifiedUsers: partners.reduce((sum, partner) => sum + partner.certifications, 0),
  }), [partners]);

  const updatePartnerStatus = (partnerId: string, status: PartnerStatus) => {
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) return;
    const nextPartners = partners.map((partner) => (
      partner.id === partnerId ? { ...partner, status } : partner
    ));
    saveWorkspace.mutate({
      partners: nextPartners,
      ...(status !== "Active"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: partner.id,
            tenantName: partner.name,
            subject: status === "Paused" ? "Run partner pause recovery plan" : "Track partner probation coaching plan",
            category: "Commercial",
            priority: supportPriorityForStatus(status),
            owner: "Partner desk",
            article: status === "Paused" ? "Partner recovery playbook" : "Partner enablement checklist",
          }),
        }
        : {}),
      ...(status === "Paused"
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Partner",
            requester: user?.name ?? "System Administrator",
            school: "Platform",
            summary: `Review paused status and remediation terms for ${partner.name}`,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        severity: status === "Paused" ? "Warning" : "Info",
        action: `Changed partner ${partner.name} from ${partner.status} to ${status}`,
      }),
    });
    toast.success("Partner status updated");
  };

  const advanceDeal = (dealId: string) => {
    const deal = deals.find((item) => item.id === dealId);
    if (!deal) return;
    let nextStage: DealStage = deal.stage;
    const nextDeals = deals.map((deal) => {
      if (deal.id !== dealId) return deal;
      const stage: DealStage =
        deal.stage === "Qualified" ? "Proposal" :
          deal.stage === "Proposal" ? "Contracting" :
            deal.stage === "Contracting" ? "Won" :
              "Won";
      nextStage = stage;
      return { ...deal, stage };
    });
    saveWorkspace.mutate({
      partnerDeals: nextDeals,
      ...(nextStage === "Contracting"
        ? {
          approvalItems: appendApprovalItem(workspace, {
            type: "Commercial",
            requester: deal.owner,
            school: deal.schoolLead,
            summary: `Review commercial terms for partner deal ${deal.id}`,
          }),
        }
        : {}),
      ...(nextStage === "Won"
        ? {
          tenantHandoffs: appendTenantHandoff(workspace, {
            school: deal.schoolLead,
            owner: "Implementation desk",
            reason: `Partner deal won via ${deal.partner}; onboarding handoff required`,
          }),
          supportTickets: appendSupportTicket(workspace, {
            tenantId: `lead-${deal.id}`,
            tenantName: deal.schoolLead,
            subject: "Prepare onboarding handoff for won partner deal",
            category: "Commercial",
            priority: "Medium",
            owner: "Platform desk",
            article: "Plan packaging guide",
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: deal.schoolLead,
        area: "Operations",
        action: `Advanced partner deal ${deal.id} from ${deal.stage} to ${nextStage}`,
      }),
    });
    toast.success("Partner deal advanced");
  };

  const invitePartner = () => {
    saveWorkspace.mutate({
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "partner-ops",
        tenantName: "Partner operations",
        subject: "Prepare new partner enablement invite",
        category: "Commercial",
        priority: "Medium",
        owner: "Platform desk",
        article: "Plan packaging guide",
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Partner",
        requester: user?.name ?? "System Administrator",
        school: "Platform",
        summary: "Review diligence checklist for newly invited partner",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Queued partner enablement invite",
      }),
    });
    toast.success("Partner enablement invite sent");
  };

  const scheduleTraining = (partner: Partner) => {
    saveWorkspace.mutate({
      supportTickets: appendSupportTicket(workspace, {
        tenantId: partner.id,
        tenantName: partner.name,
        subject: "Prepare partner enablement session",
        category: "Commercial",
        priority: "Medium",
        owner: "Partner desk",
        article: "Partner enablement checklist",
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Scheduled enablement training for ${partner.name}`,
      }),
    });
    toast.success(`Training scheduled for ${partner.name}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner Management"
        description="Run reseller, implementation, and strategic partner relationships, pipeline, enablement, and tenant handoff quality."
        actions={(
          <>
            <Button variant="outline" asChild>
              <Link to="/contract-center">Open contract center</Link>
            </Button>
            <Button onClick={invitePartner}>
              <Handshake className="mr-2 h-4 w-4" />
              Invite partner
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active partners" value={stats.activePartners} accent="success" icon={<Handshake className="h-4 w-4" />} />
        <StatCard label="Pipeline value" value={`K${stats.totalPipeline.toLocaleString()}`} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Managed tenants" value={stats.managedTenants} accent="accent" icon={<Users2 className="h-4 w-4" />} />
        <StatCard label="Certified staff" value={stats.certifiedUsers} accent="warning" icon={<BadgeCheck className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="enablement">Enablement</TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{partner.name}</p>
                      <p className="text-xs text-muted-foreground">{partner.certifications} certified resources</p>
                    </div>
                  </TableCell>
                  <TableCell>{partner.region}</TableCell>
                  <TableCell><Badge className={tierTone(partner.tier)}>{partner.tier}</Badge></TableCell>
                  <TableCell className="w-44">
                    <Select value={partner.status} onValueChange={(value) => updatePartnerStatus(partner.id, value as PartnerStatus)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Probation">Probation</SelectItem>
                        <SelectItem value="Paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{partner.managedTenants}</TableCell>
                  <TableCell className="font-medium">K{partner.pipelineValue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={statusTone(partner.status)}>{partner.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="pipeline" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Advance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{deal.schoolLead}</p>
                      <p className="text-xs text-muted-foreground">{deal.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{deal.partner}</TableCell>
                  <TableCell>{deal.stage}</TableCell>
                  <TableCell>{deal.owner}</TableCell>
                  <TableCell className="font-medium">K{deal.value.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={deal.stage === "Won"} onClick={() => advanceDeal(deal.id)}>
                      {deal.stage === "Won" ? "Won" : "Advance"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="enablement" className="grid gap-4 lg:grid-cols-3">
          {partners.map((partner) => (
            <div key={partner.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{partner.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{partner.region}</p>
                </div>
                <Globe2 className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <span>{partner.tier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Certifications</span>
                  <span>{partner.certifications}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tenant portfolio</span>
                  <span>{partner.managedTenants}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => scheduleTraining(partner)}>Schedule training</Button>
                <Button size="sm" asChild>
                  <Link to="/tenant-lifecycle">View handoffs</Link>
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
