import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookText, LifeBuoy, ShieldAlert, Siren, Ticket, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

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

function priorityTone(priority: TicketPriority) {
  if (priority === "Critical") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (priority === "High") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (priority === "Medium") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
}

export const Route = createFileRoute("/support-desk")({
  head: () => ({ meta: [{ title: "Support Desk - SRMS" }] }),
  component: SupportDeskPage,
});

function SupportDeskPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const tickets = (workspace?.supportTickets ?? []) as DeskTicket[];

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
            <Button variant="outline" asChild>
              <Link to="/knowledge-base">Open knowledge base</Link>
            </Button>
            <Button onClick={runSlaSweep}>
              <LifeBuoy className="mr-2 h-4 w-4" />
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
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticket ID, school, category, owner, or subject" />
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge links</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Knowledge</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Select value={ticket.owner} onValueChange={(value) => updateOwner(ticket.id, value)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {owners.map((owner) => <SelectItem key={owner} value={owner}>{owner}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="w-36">
                    <Select value={ticket.priority} onValueChange={(value) => updatePriority(ticket.id, value as TicketPriority)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Low", "Medium", "High", "Critical"] as TicketPriority[]).map((priority) => (
                          <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge className={ticket.status === "Resolved" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : ticket.status === "Escalated" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}>
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-52">
                    <Select value={ticket.article} onValueChange={(value) => attachArticle(ticket.id, value)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {knowledgeRoutes.map((route) => <SelectItem key={route.label} value={route.label}>{route.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => advanceTicket(ticket.id)}>
                      {ticket.status === "Resolved" ? "Closed" : ticket.status === "New" ? "Start" : "Resolve"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="escalations" className="grid gap-4 lg:grid-cols-3">
          {filtered.filter((ticket) => ticket.priority === "Critical" || ticket.ageHours > ticket.slaHours).map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{ticket.tenantName}</p>
                </div>
                <Badge className={priorityTone(ticket.priority)}>{ticket.priority}</Badge>
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
                <Button variant="outline" size="sm" className="flex-1" onClick={() => advanceTicket(ticket.id)}>Update</Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link to="/platform-ops">Open platform ops</Link>
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="knowledge" className="grid gap-4 lg:grid-cols-2">
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
                    <Button size="sm" variant="outline" asChild>
                      <Link to={route.route}>Open</Link>
                    </Button>
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
                <Button className="mt-4 w-full" variant="outline" asChild>
                  <Link to="/tenant-success">Open tenant success</Link>
                </Button>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                <p className="font-medium">Commercial packaging questions</p>
                <p className="mt-1 text-sm text-muted-foreground">Link plan comparisons and add-on pricing when a school asks for expansion or discounts.</p>
                <Button className="mt-4 w-full" variant="outline" asChild>
                  <Link to="/plan-catalog">Open plan catalog</Link>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
