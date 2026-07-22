import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, Globe2, Handshake, ShieldAlert, TrendingUp, Users2 } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
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
import { appendApprovalItem, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, type BadgeTone } from "@/lib/utils";

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

function tierTone(tier: PartnerTier): BadgeTone {
  if (tier === "Strategic") return "success";
  if (tier === "Implementation") return "default";
  return "warning";
}

function statusTone(status: PartnerStatus): BadgeTone {
  if (status === "Active") return "success";
  if (status === "Probation") return "warning";
  return "secondary";
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
  const [tab, setTab] = useState("partners");
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
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
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
            <Button variant="outlined" component={Link} to="/contract-center">Open contract center</Button>
            <Button onClick={invitePartner} startIcon={<Handshake className="h-4 w-4" />}>
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

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="partners" label="Partners" />
        <Tab value="pipeline" label="Pipeline" />
        <Tab value="enablement" label="Enablement" />
      </Tabs>

      {tab === "partners" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Partner</TableCell>
                <TableCell>Region</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Tenants</TableCell>
                <TableCell>Pipeline</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
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
                  <TableCell><Chip size="small" label={partner.tier} sx={badgeSx(tierTone(partner.tier))} /></TableCell>
                  <TableCell className="w-44">
                    <TextField
                      select
                      value={partner.status}
                      onChange={(event) => updatePartnerStatus(partner.id, event.target.value as PartnerStatus)}
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { sx: { fontSize: 12 } } }}
                    >
                      <MenuItem value="Active">Active</MenuItem>
                      <MenuItem value="Probation">Probation</MenuItem>
                      <MenuItem value="Paused">Paused</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>{partner.managedTenants}</TableCell>
                  <TableCell className="font-medium">K{partner.pipelineValue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Chip size="small" label={partner.status} sx={badgeSx(statusTone(partner.status))} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "pipeline" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Opportunity</TableCell>
                <TableCell>Partner</TableCell>
                <TableCell>Stage</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Value</TableCell>
                <TableCell className="text-right">Advance</TableCell>
              </TableRow>
            </TableHead>
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
                    <Button size="small" variant="outlined" disabled={deal.stage === "Won"} onClick={() => advanceDeal(deal.id)}>
                      {deal.stage === "Won" ? "Won" : "Advance"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "enablement" && (
        <Box className="grid gap-4 lg:grid-cols-3">
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
                <Button size="small" variant="outlined" onClick={() => scheduleTraining(partner)}>Schedule training</Button>
                <Button size="small" component={Link} to="/tenant-lifecycle">View handoffs</Button>
              </div>
            </div>
          ))}
        </Box>
      )}
    </div>
  );
}
