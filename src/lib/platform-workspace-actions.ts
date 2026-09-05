import type { BackendPlatformWorkspace, PlatformWorkspaceRecord } from "@/lib/api";

type AuditArea = "Access" | "Billing" | "Lifecycle" | "Support" | "Operations";
type AuditSeverity = "Info" | "Warning" | "Critical";
type ExportStatus = "Queued" | "Running" | "Ready";

function monthLabel(monthIndex: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex] ?? "Jan";
}

export function formatPlatformTimestamp(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthLabel(date.getMonth());
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

export function nextWorkspaceId(prefix: string) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function appendPlatformAuditEvent(
  workspace: BackendPlatformWorkspace | undefined,
  event: {
    actor: string;
    tenant: string;
    area: AuditArea;
    action: string;
    severity?: AuditSeverity;
    reviewed?: boolean;
  },
) {
  const events = (workspace?.platformAuditEvents ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("PA"),
      ts: formatPlatformTimestamp(),
      severity: event.severity ?? "Info",
      reviewed: event.reviewed ?? false,
      ...event,
    },
    ...events,
  ];
}

export function appendExportJob(
  workspace: BackendPlatformWorkspace | undefined,
  job: {
    school: string;
    scope: string;
    requestedBy: string;
    status?: ExportStatus;
  },
) {
  const jobs = (workspace?.exportJobs ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("EXP"),
      status: job.status ?? "Queued",
      ...job,
    },
    ...jobs,
  ];
}

export function appendSupportTicket(
  workspace: BackendPlatformWorkspace | undefined,
  ticket: {
    tenantId: string;
    tenantName: string;
    subject: string;
    category: string;
    priority: "Low" | "Medium" | "High" | "Critical";
    owner: string;
    article: string;
    slaHours?: number;
    ageHours?: number;
  },
) {
  const tickets = (workspace?.supportTickets ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("SUP"),
      status: "New",
      slaHours: ticket.slaHours ?? 24,
      ageHours: ticket.ageHours ?? 0,
      ...ticket,
    },
    ...tickets,
  ];
}

export function appendApprovalItem(
  workspace: BackendPlatformWorkspace | undefined,
  item: {
    type: string;
    requester: string;
    school: string;
    summary: string;
    status?: string;
    submittedAt?: string;
  },
) {
  const items = (workspace?.approvalItems ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("APR"),
      status: item.status ?? "Pending",
      submittedAt: item.submittedAt ?? formatPlatformTimestamp(),
      ...item,
    },
    ...items,
  ];
}

export function appendService(
  workspace: BackendPlatformWorkspace | undefined,
  service: {
    name: string;
    owner: string;
    region: string;
    dependency: string;
    uptime?: number;
    status?: "healthy" | "degraded" | "maintenance";
  },
) {
  const services = (workspace?.services ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("SVC"),
      uptime: service.uptime ?? 99.9,
      status: service.status ?? "healthy",
      ...service,
    },
    ...services,
  ];
}

export function appendQueue(
  workspace: BackendPlatformWorkspace | undefined,
  queue: {
    name: string;
    owner: string;
    backlog?: number;
    lagMinutes?: number;
    status?: "normal" | "warning" | "blocked";
  },
) {
  const queues = (workspace?.queues ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("QUE"),
      backlog: queue.backlog ?? 0,
      lagMinutes: queue.lagMinutes ?? 0,
      status: queue.status ?? "normal",
      ...queue,
    },
    ...queues,
  ];
}

export function appendOpsIncident(
  workspace: BackendPlatformWorkspace | undefined,
  incident: {
    title: string;
    severity: "Low" | "Medium" | "High";
    tenant: string;
    commander: string;
    status?: "Investigating" | "Monitoring" | "Mitigated";
  },
) {
  const incidents = (workspace?.opsIncidents ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("INC"),
      status: incident.status ?? "Investigating",
      ...incident,
    },
    ...incidents,
  ];
}

export function appendRelease(
  workspace: BackendPlatformWorkspace | undefined,
  release: {
    title: string;
    environment: "Sandbox" | "Staging" | "Production";
    owner: string;
    window: string;
    status?: "Awaiting approval" | "In validation" | "Approved" | "Scheduled";
  },
) {
  const releases = (workspace?.releases ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("REL"),
      status: release.status ?? "Awaiting approval",
      ...release,
    },
    ...releases,
  ];
}

export function appendDataRequest(
  workspace: BackendPlatformWorkspace | undefined,
  request: {
    tenantId: string;
    school: string;
    subject: string;
    type: "Access" | "Rectification" | "Deletion";
    status?: "New" | "Reviewing" | "Approved" | "Completed";
    dueDate?: string;
  },
) {
  const requests = (workspace?.dataRequests ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("DR"),
      status: request.status ?? "New",
      dueDate: request.dueDate ?? formatPlatformTimestamp(),
      ...request,
    },
    ...requests,
  ];
}

export function appendRetentionRule(
  workspace: BackendPlatformWorkspace | undefined,
  rule: {
    domain: string;
    days: string;
    archive?: boolean;
    legalHold?: boolean;
  },
) {
  const rules = (workspace?.retentionRules ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("RET"),
      archive: rule.archive ?? false,
      legalHold: rule.legalHold ?? false,
      ...rule,
    },
    ...rules,
  ];
}

export function appendStatusIncident(
  workspace: BackendPlatformWorkspace | undefined,
  incident: {
    title: string;
    level: "Minor" | "Major" | "Critical";
    audience: string;
    state?: "Monitoring" | "Investigating" | "Resolved";
  },
) {
  const incidents = (workspace?.statusIncidents ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("SI"),
      state: incident.state ?? "Investigating",
      updatedAt: formatPlatformTimestamp(),
      ...incident,
    },
    ...incidents,
  ];
}

export function appendMaintenanceWindow(
  workspace: BackendPlatformWorkspace | undefined,
  entry: {
    title: string;
    window: string;
    audience: string;
    published?: boolean;
  },
) {
  const windows = (workspace?.maintenanceWindows ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("MW"),
      published: entry.published ?? false,
      ...entry,
    },
    ...windows,
  ];
}

/**
 * Creates a developer API key record. `secretHint` must already be a masked
 * representation (e.g. "sk_live_****ab12") -- the raw secret is generated and shown
 * to the caller exactly once, client-side, and must never be passed in here or
 * persisted into the shared platform-workspace blob. See developer-console.tsx.
 */
export function appendDeveloperApiKey(
  workspace: BackendPlatformWorkspace | undefined,
  key: {
    client: string;
    scope: string;
    secretHint: string;
    status?: "Active" | "Rotating" | "Paused";
    lastUsed?: string;
  },
) {
  const keys = (workspace?.developerApiKeys ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("KEY"),
      status: key.status ?? "Active",
      lastUsed: key.lastUsed ?? "Never",
      ...key,
    },
    ...keys,
  ];
}

export function appendDeveloperWebhook(
  workspace: BackendPlatformWorkspace | undefined,
  webhook: {
    endpoint: string;
    owner: string;
    failures?: number;
    status?: "Healthy" | "Retrying" | "Paused";
  },
) {
  const webhooks = (workspace?.developerWebhooks ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("WHK"),
      failures: webhook.failures ?? 0,
      status: webhook.status ?? "Healthy",
      ...webhook,
    },
    ...webhooks,
  ];
}

export function appendTenantHandoff(
  workspace: BackendPlatformWorkspace | undefined,
  handoff: {
    school: string;
    owner: string;
    reason: string;
    status?: "Queued" | "In progress" | "Ready";
  },
) {
  const handoffs = (workspace?.tenantHandoffs ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("HOF"),
      status: handoff.status ?? "Queued",
      ...handoff,
    },
    ...handoffs,
  ];
}

export function appendAddOn(
  workspace: BackendPlatformWorkspace | undefined,
  addOn: {
    name: string;
    category: string;
    monthlyPrice: number;
    description: string;
    plans: string;
    active?: boolean;
  },
) {
  const addOns = (workspace?.addOns ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("ADD"),
      active: addOn.active ?? true,
      ...addOn,
    },
    ...addOns,
  ];
}

export function appendPromotion(
  workspace: BackendPlatformWorkspace | undefined,
  promotion: {
    name: string;
    audience: string;
    incentive: string;
    expiry: string;
    status?: "Active" | "Paused";
  },
) {
  const promotions = (workspace?.promotions ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("PROMO"),
      status: promotion.status ?? "Active",
      ...promotion,
    },
    ...promotions,
  ];
}

export function appendRevenueCase(
  workspace: BackendPlatformWorkspace | undefined,
  revenueCase: {
    tenantId: string;
    school: string;
    amount: number;
    owner: string;
    status?: "Scheduled" | "In progress" | "Promised" | "Resolved";
    nextAction?: string;
  },
) {
  const cases = (workspace?.revenueCases ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("REVC"),
      status: revenueCase.status ?? "Scheduled",
      nextAction: revenueCase.nextAction ?? "Review account",
      ...revenueCase,
    },
    ...cases,
  ];
}

export function appendContract(
  workspace: BackendPlatformWorkspace | undefined,
  contract: {
    tenantId: string;
    school: string;
    type: "MSA" | "Order Form" | "DPA" | "SOW";
    value: number;
    expiresOn: string;
    owner: string;
    status?: "Draft" | "Awaiting signature" | "Active" | "Renewal due";
  },
) {
  const contracts = (workspace?.contracts ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("CTR"),
      status: contract.status ?? "Draft",
      ...contract,
    },
    ...contracts,
  ];
}

export function appendPartner(
  workspace: BackendPlatformWorkspace | undefined,
  partner: {
    name: string;
    region: string;
    tier: "Referral" | "Implementation" | "Strategic";
    status?: "Active" | "Probation" | "Paused";
    certifications?: number;
    managedTenants?: number;
    pipelineValue?: number;
  },
) {
  const partners = (workspace?.partners ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("PTR"),
      status: partner.status ?? "Active",
      certifications: partner.certifications ?? 0,
      managedTenants: partner.managedTenants ?? 0,
      pipelineValue: partner.pipelineValue ?? 0,
      ...partner,
    },
    ...partners,
  ];
}

export function appendPartnerDeal(
  workspace: BackendPlatformWorkspace | undefined,
  deal: {
    partnerId: string;
    partner: string;
    schoolLead: string;
    value: number;
    owner: string;
    stage?: "Qualified" | "Proposal" | "Contracting" | "Won";
  },
) {
  const deals = (workspace?.partnerDeals ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("DEAL"),
      stage: deal.stage ?? "Qualified",
      ...deal,
    },
    ...deals,
  ];
}

export function appendRollout(
  workspace: BackendPlatformWorkspace | undefined,
  rollout: {
    name: string;
    audience: string;
    owner: string;
    state?: "Enabled" | "Pilot" | "Disabled";
    coverage?: number;
  },
) {
  const rollouts = (workspace?.rollouts ?? []) as PlatformWorkspaceRecord[];
  return [
    {
      id: nextWorkspaceId("FLG"),
      state: rollout.state ?? "Disabled",
      coverage: rollout.coverage ?? 0,
      ...rollout,
    },
    ...rollouts,
  ];
}
