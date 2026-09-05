import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BadgeCheck, Globe2, Handshake, Plus, ShieldAlert, TrendingUp, Users2 } from "lucide-react";
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
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";

import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { appendApprovalItem, appendPartner, appendPartnerDeal, appendPlatformAuditEvent, appendSupportTicket, appendTenantHandoff } from "@/lib/platform-workspace-actions";
import { useTenant } from "@/lib/tenant";
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

const partnerTiers: PartnerTier[] = ["Referral", "Implementation", "Strategic"];
const dealOwners = ["Partner desk", "Platform desk", "Implementation desk"];

const emptyPartnerDraft = { name: "", region: "", tier: "Referral" as PartnerTier };
const emptyDealDraft = { partnerId: "", schoolLead: "", value: 0, owner: dealOwners[0] };

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
  const { tenants } = useTenant();
  const [tab, setTab] = useState("partners");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const partners = (workspace?.partners ?? []) as Partner[];
  const deals = (workspace?.partnerDeals ?? []) as Deal[];
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [partnerDraft, setPartnerDraft] = useState(emptyPartnerDraft);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealDraft, setDealDraft] = useState(emptyDealDraft);

  const stats = useMemo(() => ({
    activePartners: partners.filter((partner) => partner.status === "Active").length,
    totalPipeline: partners.reduce((sum, partner) => sum + partner.pipelineValue, 0),
    managedTenants: partners.reduce((sum, partner) => sum + partner.managedTenants, 0),
    certifiedUsers: partners.reduce((sum, partner) => sum + partner.certifications, 0),
  }), [partners]);

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
    }, { onSuccess: () => toast.success("Partner status updated") });
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
    }, { onSuccess: () => toast.success("Partner deal advanced") });
  };

  // Previously "Invite partner" only filed a support ticket + approval item recording the
  // intent to invite someone — it never actually added a row to `workspace.partners`. That
  // made the button a near no-op from the Partners table's point of view: no matter how
  // many times it was clicked, the table (and therefore every other action on this page —
  // status changes, deals, training) stayed permanently empty with nothing to act on. This
  // now opens a real form and appends an actual partner record via `appendPartner`, while
  // keeping the original ticket/approval trail for the human follow-up.
  const createPartner = () => {
    if (!partnerDraft.name.trim()) return;
    saveWorkspace.mutate({
      partners: appendPartner(workspace, {
        name: partnerDraft.name.trim(),
        region: partnerDraft.region.trim() || "Unspecified",
        tier: partnerDraft.tier,
      }),
      supportTickets: appendSupportTicket(workspace, {
        tenantId: "partner-ops",
        tenantName: "Partner operations",
        subject: `Complete enablement invite for ${partnerDraft.name.trim()}`,
        category: "Commercial",
        priority: "Medium",
        owner: "Platform desk",
        article: "Plan packaging guide",
      }),
      approvalItems: appendApprovalItem(workspace, {
        type: "Partner",
        requester: user?.name ?? "System Administrator",
        school: "Platform",
        summary: `Review diligence checklist for newly invited partner ${partnerDraft.name.trim()}`,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Invited new partner ${partnerDraft.name.trim()}`,
      }),
    }, { onSuccess: () => toast.success("Partner invited") });
    setPartnerDialogOpen(false);
    setPartnerDraft(emptyPartnerDraft);
  };

  const createDeal = () => {
    const partner = partners.find((item) => item.id === dealDraft.partnerId);
    if (!partner || !dealDraft.schoolLead.trim()) return;
    saveWorkspace.mutate({
      partnerDeals: appendPartnerDeal(workspace, {
        partnerId: partner.id,
        partner: partner.name,
        schoolLead: dealDraft.schoolLead.trim(),
        value: dealDraft.value,
        owner: dealDraft.owner,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: dealDraft.schoolLead.trim(),
        area: "Operations",
        action: `Logged new partner deal via ${partner.name} for ${dealDraft.schoolLead.trim()}`,
      }),
    }, { onSuccess: () => toast.success("Partner deal logged") });
    setDealDialogOpen(false);
    setDealDraft(emptyDealDraft);
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
    }, { onSuccess: () => toast.success(`Training scheduled for ${partner.name}`) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partner Management"
        description="Run reseller, implementation, and strategic partner relationships, pipeline, enablement, and tenant handoff quality."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/contract-center">Open contract center</Button>
            <Button onClick={() => setPartnerDialogOpen(true)} startIcon={<Handshake className="h-4 w-4" />}>
              New partner
            </Button>
          </>
        )}
      />

      <Dialog open={partnerDialogOpen} onClose={() => setPartnerDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New partner</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField
              label="Partner name"
              value={partnerDraft.name}
              onChange={(event) => setPartnerDraft({ ...partnerDraft, name: event.target.value })}
              fullWidth
              size="small"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Region"
                value={partnerDraft.region}
                onChange={(event) => setPartnerDraft({ ...partnerDraft, region: event.target.value })}
                fullWidth
                size="small"
                placeholder="e.g. Lusaka, Copperbelt"
              />
              <TextField
                select
                label="Tier"
                value={partnerDraft.tier}
                onChange={(event) => setPartnerDraft({ ...partnerDraft, tier: event.target.value as PartnerTier })}
                fullWidth
                size="small"
              >
                {partnerTiers.map((tier) => (
                  <MenuItem key={tier} value={tier}>{tier}</MenuItem>
                ))}
              </TextField>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setPartnerDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!partnerDraft.name.trim()} onClick={createPartner}>Invite partner</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dealDialogOpen} onClose={() => setDealDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New partner deal</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField
              select
              label="Partner"
              value={dealDraft.partnerId}
              onChange={(event) => setDealDraft({ ...dealDraft, partnerId: event.target.value })}
              fullWidth
              size="small"
              autoFocus
            >
              {partners.map((partner) => (
                <MenuItem key={partner.id} value={partner.id}>{partner.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="School lead"
              value={dealDraft.schoolLead}
              onChange={(event) => setDealDraft({ ...dealDraft, schoolLead: event.target.value })}
              fullWidth
              size="small"
              placeholder="e.g. an onboarded school name, or a prospective lead"
              helperText={tenants.length === 0 ? "No onboarded schools yet — type a prospective lead name." : "Pick an onboarded school below, or type a prospective lead name."}
            />
            {tenants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tenants.map((tenant) => (
                  <Chip
                    key={tenant.id}
                    size="small"
                    label={tenant.name}
                    variant={dealDraft.schoolLead === tenant.name ? "filled" : "outlined"}
                    onClick={() => setDealDraft({ ...dealDraft, schoolLead: tenant.name })}
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Deal value (K)"
                type="number"
                value={dealDraft.value}
                onChange={(event) => setDealDraft({ ...dealDraft, value: Number(event.target.value) || 0 })}
                fullWidth
                size="small"
              />
              <TextField
                select
                label="Owner"
                value={dealDraft.owner}
                onChange={(event) => setDealDraft({ ...dealDraft, owner: event.target.value })}
                fullWidth
                size="small"
              >
                {dealOwners.map((owner) => (
                  <MenuItem key={owner} value={owner}>{owner}</MenuItem>
                ))}
              </TextField>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setDealDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!dealDraft.partnerId || !dealDraft.schoolLead.trim()} onClick={createDeal}>Log deal</Button>
        </DialogActions>
      </Dialog>

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
        partners.length === 0 ? (
          <Box className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={Handshake}
              title="No partners yet"
              description="Invite a reseller, implementation, or strategic partner to start tracking their portfolio here."
              action={{ label: "New partner", onClick: () => setPartnerDialogOpen(true) }}
            />
          </Box>
        ) : (
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
        )
      )}

      {tab === "pipeline" && (
        <Box className="space-y-3">
          <div className="flex justify-end">
            <Button size="small" variant="outlined" startIcon={<Plus size={14} />} disabled={partners.length === 0} onClick={() => setDealDialogOpen(true)}>
              New deal
            </Button>
          </div>
          <Box className="rounded-xl border border-border bg-card">
            {deals.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No pipeline deals yet"
                description={partners.length === 0 ? "Invite a partner first, then log their deals here." : "Log a partner-sourced deal to start tracking it through to close."}
                action={partners.length > 0 ? { label: "New deal", onClick: () => setDealDialogOpen(true) } : undefined}
              />
            ) : (
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
            )}
          </Box>
        </Box>
      )}

      {tab === "enablement" && (
        partners.length === 0 ? (
          <Box className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={Globe2}
              title="No partners to enable yet"
              description="Once a partner is invited, schedule and track their certification training here."
              action={{ label: "New partner", onClick: () => setPartnerDialogOpen(true) }}
            />
          </Box>
        ) : (
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
        )
      )}
    </div>
  );
}
