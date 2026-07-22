import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookText, LifeBuoy, ShieldAlert, Siren, Ticket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx, type BadgeTone } from "@/lib/utils";

type TicketPriority = "Low" | "Medium" | "High" | "Critical";
type TicketStatus = "New" | "Investigating" | "Waiting on school" | "Escalated" | "Resolved";

type DeskTicket = {
  id: string;
  tenantId: string;
  tenantName: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  owner: string;
  slaHours: number;
  ageHours: number;
  article: string;
};

const owners = ["Unassigned", "Platform desk", "Finance ops", "Support team"];
const knowledgeRoutes = [
  { label: "Platform incident playbook", route: "/platform-ops" },
  { label: "Renewal and success workflow", route: "/tenant-success" },
  { label: "Plan packaging guide", route: "/plan-catalog" },
  { label: "General knowledge base", route: "/knowledge-base" },
];

function priorityTone(priority: TicketPriority): BadgeTone {
  if (priority === "Critical") return "destructive";
  if (priority === "High") return "warning";
  if (priority === "Medium") return "default";
  return "secondary";
}

export const Route = createFileRoute("/support-desk")({
  head: () => ({ meta: [{ title: "Support Desk - SRMS" }] }),
  component: SupportDeskPage,
});

function SupportDeskPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("queue");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const tickets = (workspace?.supportTickets ?? []) as DeskTicket[];

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

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
      ticket.id,
      ticket.subject,
      ticket.category,
      ticket.owner,
      ticket.tenantName,
    ].some((value) => value.toLowerCase().includes(q));
  }), [query, tickets]);

  const breached = filtered.filter((ticket) => ticket.status !== "Resolved" && ticket.ageHours > ticket.slaHours).length;
  const awaitingSchool = filtered.filter((ticket) => ticket.status === "Waiting on school").length;
  const critical = filtered.filter((ticket) => ticket.priority === "Critical" && ticket.status !== "Resolved").length;
  const open = filtered.filter((ticket) => ticket.status !== "Resolved").length;

  const updateOwner = (ticketId: string, owner: string) => {
    const ticket = tickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;
    const nextTickets = tickets.map((ticket) => (
      ticket.id === ticketId ? { ...ticket, owner } : ticket
    ));
    saveWorkspace.mutate({
      supportTickets: nextTickets,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: ticket.tenantName,
        area: "Support",
        action: `Reassigned ticket ${ticket.id} to ${owner}`,
      }),
    });
    toast.success("Ticket owner updated");
  };

  const updatePriority = (ticketId: string, priority: TicketPriority) => {
    const ticket = tickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;
    const nextTickets = tickets.map((ticket) => (
      ticket.id === ticketId ? { ...ticket, priority } : ticket
    ));
    saveWorkspace.mutate({
      supportTickets: nextTickets,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: ticket.tenantName,
        area: "Support",
        severity: priority === "Critical" ? "Critical" : priority === "High" ? "Warning" : "Info",
        action: `Changed ticket ${ticket.id} priority from ${ticket.priority} to ${priority}`,
      }),
    });
    toast.success("Ticket priority updated");
  };

  const attachArticle = (ticketId: string, article: string) => {
    const ticket = tickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;
    const nextTickets = tickets.map((ticket) => (
      ticket.id === ticketId ? { ...ticket, article } : ticket
    ));
    saveWorkspace.mutate({
      supportTickets: nextTickets,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: ticket.tenantName,
        area: "Support",
        action: `Linked knowledge article "${article}" to ticket ${ticket.id}`,
      }),
    });
    toast.success("Knowledge article linked");
  };

  const advanceTicket = (ticketId: string) => {
    const ticket = tickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;
    let nextStatus: TicketStatus = ticket.status;
    const nextTickets = tickets.map((ticket) => {
      if (ticket.id !== ticketId) return ticket;
      const status: TicketStatus =
        ticket.status === "New" ? "Investigating" :
          ticket.status === "Investigating" ? "Resolved" :
            ticket.status === "Escalated" ? "Investigating" :
              "Resolved";
      nextStatus = status;
      return { ...ticket, status };
    });
    saveWorkspace.mutate({
      supportTickets: nextTickets,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: ticket.tenantName,
        area: "Support",
        severity: nextStatus === "Resolved" ? "Info" : "Warning",
        action: `Moved ticket ${ticket.id} from ${ticket.status} to ${nextStatus}`,
      }),
    });
    toast.success("Ticket status updated");
  };

  const runSlaSweep = () => {
    let escalatedCount = 0;
    const nextTickets = tickets.map((ticket) => (
      ticket.status !== "Resolved" && ticket.ageHours > ticket.slaHours
        ? (() => {
          escalatedCount += ticket.status === "Escalated" ? 0 : 1;
          return { ...ticket, status: "Escalated", owner: ticket.owner === "Unassigned" ? "Platform desk" : ticket.owner };
        })()
        : ticket
    ));
    saveWorkspace.mutate({
      supportTickets: nextTickets,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Support",
        severity: escalatedCount > 0 ? "Warning" : "Info",
        action: escalatedCount > 0
          ? `Ran SLA sweep and escalated ${escalatedCount} overdue support ticket${escalatedCount === 1 ? "" : "s"}`
          : "Ran SLA sweep with no overdue escalations",
      }),
    });
    toast.warning(escalatedCount > 0 ? "SLA sweep escalated overdue tickets" : "SLA sweep completed with no new escalations");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Desk"
        description="Run the shared support queue for tenant incidents, commercial requests, onboarding blockers, and escalations."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/knowledge-base">Open knowledge base</Button>
            <Button onClick={runSlaSweep} startIcon={<LifeBuoy className="h-4 w-4" />}>
              Run SLA sweep
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tickets" value={open} accent="primary" icon={<Ticket className="h-4 w-4" />} />
        <StatCard label="Breached SLAs" value={breached} accent="destructive" icon={<TriangleAlert className="h-4 w-4" />} />
        <StatCard label="Awaiting school reply" value={awaitingSchool} accent="warning" icon={<LifeBuoy className="h-4 w-4" />} />
        <StatCard label="Critical escalations" value={critical} accent="accent" icon={<Siren className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <TextField fullWidth size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticket ID, school, category, owner, or subject" />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="queue" label="Queue" />
        <Tab value="escalations" label="Escalations" />
        <Tab value="knowledge" label="Knowledge links" />
      </Tabs>

      {tab === "queue" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ticket</TableCell>
                <TableCell>School</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Knowledge</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">{ticket.id} · {ticket.category}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{ticket.tenantName}</p>
                      <p className="text-xs text-muted-foreground">Age {ticket.ageHours}h / SLA {ticket.slaHours}h</p>
                    </div>
                  </TableCell>
                  <TableCell className="w-48">
                    <TextField select size="small" fullWidth value={ticket.owner} onChange={(event) => updateOwner(ticket.id, event.target.value)}>
                      {owners.map((owner) => <MenuItem key={owner} value={owner}>{owner}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell className="w-36">
                    <TextField select size="small" fullWidth value={ticket.priority} onChange={(event) => updatePriority(ticket.id, event.target.value as TicketPriority)}>
                      {(["Low", "Medium", "High", "Critical"] as TicketPriority[]).map((priority) => (
                        <MenuItem key={priority} value={priority}>{priority}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ticket.status}
                      sx={badgeSx(ticket.status === "Resolved" ? "success" : ticket.status === "Escalated" ? "destructive" : "warning")}
                    />
                  </TableCell>
                  <TableCell className="w-52">
                    <TextField select size="small" fullWidth value={ticket.article} onChange={(event) => attachArticle(ticket.id, event.target.value)}>
                      {knowledgeRoutes.map((route) => <MenuItem key={route.label} value={route.label}>{route.label}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" onClick={() => advanceTicket(ticket.id)}>
                      {ticket.status === "Resolved" ? "Closed" : ticket.status === "New" ? "Start" : "Resolve"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "escalations" && (
        <Box className="grid gap-4 lg:grid-cols-3">
          {filtered.filter((ticket) => ticket.priority === "Critical" || ticket.ageHours > ticket.slaHours).map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{ticket.tenantName}</p>
                </div>
                <Chip size="small" label={ticket.priority} sx={badgeSx(priorityTone(ticket.priority))} />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Owner</span>
                  <span>{ticket.owner}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{ticket.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">SLA delta</span>
                  <span>{Math.max(0, ticket.ageHours - ticket.slaHours)}h overdue</span>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button variant="outlined" size="small" sx={{ flex: 1 }} onClick={() => advanceTicket(ticket.id)}>Update</Button>
                <Button size="small" sx={{ flex: 1 }} component={Link} to="/platform-ops">Open platform ops</Button>
              </div>
            </div>
          ))}
        </Box>
      )}

      {tab === "knowledge" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookText className="h-4 w-4" />
              Support playbooks
            </div>
            <div className="mt-4 space-y-3">
              {knowledgeRoutes.map((route) => (
                <div key={route.label} className="rounded-lg border border-border/70 bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{route.label}</p>
                      <p className="text-sm text-muted-foreground">Open the linked operational workflow.</p>
                    </div>
                    <Button size="small" variant="outlined" component={Link} to={route.route}>Open</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <LifeBuoy className="h-4 w-4" />
              Coordination notes
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="font-medium">Support + success handoff</p>
                <p className="mt-1 text-sm text-muted-foreground">Use this when a billing or adoption issue could influence renewal confidence.</p>
                <Button sx={{ mt: 2, width: "100%" }} variant="outlined" component={Link} to="/tenant-success">Open tenant success</Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="font-medium">Commercial packaging questions</p>
                <p className="mt-1 text-sm text-muted-foreground">Link plan comparisons and add-on pricing when a school asks for expansion or discounts.</p>
                <Button sx={{ mt: 2, width: "100%" }} variant="outlined" component={Link} to="/plan-catalog">Open plan catalog</Button>
              </div>
            </div>
          </div>
        </Box>
      )}
    </div>
  );
}
