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
