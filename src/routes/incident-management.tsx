import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";

export const Route = createFileRoute("/incident-management")({
  head: () => ({ meta: [{ title: "Incident Management — SRMS" }] }),
  component: IncidentManagementPage,
});

const OWNERS = ["Health officer", "Security", "Finance", "Operations", "Academic dean", "IT support", "Admin", "Transport"];
const SEVERITIES = ["High", "Medium", "Low"] as const;
const STATUSES = ["Open", "In progress", "Review", "Resolved"] as const;
const TYPES = ["Safety", "Security", "Financial", "Academic", "Infrastructure", "Behavioral"] as const;

function IncidentManagementPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "Medium" as typeof SEVERITIES[number],
    type: "Safety" as typeof TYPES[number],
    reportedBy: OWNERS[0],
    location: "",
    incidentDate: new Date().toISOString().slice(0, 10),
    incidentTime: "",
    injuryOccurred: "no",
    injuredParty: "",
    investigationAssignedTo: "",
    rootCauseAnalysis: "",
    preventiveAction: "",
    notifyParent: "no",
    evidenceRef: "",
  });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents", active.id],
    queryFn: () => api.incidents.list(active.id),
  });

  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["incident-picker-students", active.id],
    queryFn: () => api.students.list(active.id),
    enabled: open,
  });
  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["incident-picker-users", active.id],
    queryFn: () => api.users.list(active.id),
    enabled: open,
  });
  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: s.className || s.grade,
  }));
  const staffOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));

  const createMut = useMutation({
    mutationFn: (data: any) => api.incidents.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["incidents", active.id] });
      toast.success("Incident logged");
      setOpen(false);
      setForm({ title: "", description: "", severity: "Medium", type: "Safety", reportedBy: OWNERS[0], location: "", incidentDate: new Date().toISOString().slice(0, 10), incidentTime: "", injuryOccurred: "no", injuredParty: "", investigationAssignedTo: "", rootCauseAnalysis: "", preventiveAction: "", notifyParent: "no", evidenceRef: "" });
    },
    onError: () => toast.error("Failed to log incident"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.incidents.update(active.id, id, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["incidents", active.id] }); },
    onError: () => toast.error("Failed to update status"),
  });

  const logIncident = () => {
    if (!form.title.trim()) { toast.error("Incident title is required"); return; }
    createMut.mutate({
      title: form.title,
      description: form.description,
      severity: form.severity,
      type: form.type,
      reportedBy: form.reportedBy,
      location: form.location,
      incidentDate: form.incidentDate,
      incidentTime: form.incidentTime || null,
      injuryOccurred: form.injuryOccurred === "yes",
      injuredParty: form.injuredParty.trim() || null,
      investigationAssignedTo: form.investigationAssignedTo.trim() || null,
      rootCauseAnalysis: form.rootCauseAnalysis.trim() || null,
      preventiveAction: form.preventiveAction.trim() || null,
      parentNotified: form.notifyParent === "yes",
      evidenceRef: form.evidenceRef.trim() || null,
      status: "Open",
    });
  };

  const openCount = (incidents as any[]).filter((i: any) => i.status === "Open" || i.status === "In progress").length;
  const resolvedCount = (incidents as any[]).filter((i: any) => i.status === "Resolved").length;

  return (
    <AccessGuard module="incident-management">
      <div className="space-y-6">
      <PageHeader
        title="Incident management"
        description="Track incidents, coordinate response, and keep audit-ready records for school safety and operations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Log new incident</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Log new incident</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Incident title *</Label>
                  <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief description of the incident" maxLength={120} />
                </div>
                <div>
                  <Label>Incident date</Label>
                  <Input type="date" className="mt-1" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
                </div>
                <div>
                  <Label>Incident time</Label>
                  <Input type="time" className="mt-1" value={form.incidentTime} onChange={(e) => setForm({ ...form, incidentTime: e.target.value })} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof TYPES[number] })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as typeof SEVERITIES[number] })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reported by</Label>
                  <Select value={form.reportedBy} onValueChange={(v) => setForm({ ...form, reportedBy: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location / venue</Label>
                  <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Sports field, Block C" maxLength={80} />
                </div>
                <div>
                  <Label>Injury occurred</Label>
                  <Select value={form.injuryOccurred} onValueChange={(v) => setForm({ ...form, injuryOccurred: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No injury</SelectItem>
                      <SelectItem value="yes">Yes — injury reported</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Injured party</Label>
                  <div className="mt-1 space-y-1.5">
                    <PersonCombobox
                      options={studentOptions}
                      loading={pickerStudentsLoading}
                      placeholder="Search students…"
                      emptyText="No students found."
                      disabled={form.injuryOccurred !== "yes"}
                      onSelect={(option) => setForm((prev) => ({ ...prev, injuredParty: option.label }))}
                    />
                    <Input value={form.injuredParty} onChange={(e) => setForm({ ...form, injuredParty: e.target.value })} placeholder="Name(s) if injury occurred" maxLength={120} disabled={form.injuryOccurred !== "yes"} />
                  </div>
                </div>
                <div>
                  <Label>Investigation assigned to</Label>
                  <div className="mt-1 space-y-1.5">
                    <PersonCombobox
                      options={staffOptions}
                      loading={pickerUsersLoading}
                      placeholder="Search school staff…"
                      emptyText="No staff found."
                      onSelect={(option) => setForm((prev) => ({ ...prev, investigationAssignedTo: option.label }))}
                    />
                    <Input value={form.investigationAssignedTo} onChange={(e) => setForm({ ...form, investigationAssignedTo: e.target.value })} placeholder="e.g. Deputy Head, Security" maxLength={100} />
                  </div>
                </div>
                <div>
                  <Label>Evidence / case reference</Label>
                  <Input className="mt-1" value={form.evidenceRef} onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })} placeholder="e.g. CCTV footage #, police ref" maxLength={100} />
                </div>
                <div>
                  <Label>Notify parent / guardian</Label>
                  <Select value={form.notifyParent} onValueChange={(v) => setForm({ ...form, notifyParent: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Not required</SelectItem>
                      <SelectItem value="yes">Yes — notify parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Incident details</Label>
                  <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Full context, people involved, sequence of events..." maxLength={600} />
                </div>
                <div className="col-span-2">
                  <Label>Root cause analysis</Label>
                  <Textarea className="mt-1" rows={2} value={form.rootCauseAnalysis} onChange={(e) => setForm({ ...form, rootCauseAnalysis: e.target.value })} placeholder="Identify contributing factors and systemic causes" maxLength={400} />
                </div>
                <div className="col-span-2">
                  <Label>Preventive / corrective action</Label>
                  <Textarea className="mt-1" rows={2} value={form.preventiveAction} onChange={(e) => setForm({ ...form, preventiveAction: e.target.value })} placeholder="Steps taken or recommended to prevent recurrence" maxLength={400} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={logIncident} disabled={createMut.isPending}>Log incident</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open incidents" value={openCount} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Resolved this period" value={resolvedCount} accent="success" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Average resolution" value="—" hint="Not tracked" accent="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Safety score" value="—" hint="Not tracked" accent="primary" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Active incident queue</h2>
              <p className="text-xs text-muted-foreground">Open issues with assigned owners and severity.</p>
            </div>
            <Badge variant="destructive">Priority</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Reported by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (incidents as any[]).map((incident: any) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{incident.title}</div>
                    {incident.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{incident.description}</div>}
                    {incident.location && <div className="text-xs text-muted-foreground">{incident.location}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={incident.severity === "High" ? "destructive" : incident.severity === "Medium" ? "warning" : "outline"}>
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{incident.reportedBy}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{incident.incidentDate || incident.date}</TableCell>
                  <TableCell>
                    <Select value={incident.status} onValueChange={(v) => { updateMut.mutate({ id: incident.id, status: v }); toast.success(`Incident status updated to ${v}`); }}>
                      <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Response readiness</h2>
              <p className="text-xs text-muted-foreground">Incident playbooks and escalation steps.</p>
            </div>
            <Badge variant="secondary">Audit ready</Badge>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="font-medium text-foreground">Safety playbooks</p>
              <p className="mt-2 text-sm text-muted-foreground">Comprehensive guidance for campus incidents.</p>
            </div>
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="font-medium text-foreground">Incident review</p>
              <p className="mt-2 text-sm text-muted-foreground">All reports logged and ready for review.</p>
            </div>
            <Button variant="outline" asChild><Link to="/risk-register">Escalate to risk register</Link></Button>
          </div>
        </div>
      </div>
    </div>
    </AccessGuard>
  );
}
