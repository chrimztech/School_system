import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

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
          <>
            <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Log new incident</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Log new incident</DialogTitle>
              <DialogContent>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Incident title *" fullWidth size="small" className="col-span-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief description of the incident" slotProps={{ htmlInput: { maxLength: 120 } }} />
                <TextField type="date" label="Incident date" fullWidth size="small" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="time" label="Incident time" fullWidth size="small" value={form.incidentTime} onChange={(e) => setForm({ ...form, incidentTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField select label="Type" fullWidth size="small" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof TYPES[number] })}>
                  {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <TextField select label="Severity" fullWidth size="small" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as typeof SEVERITIES[number] })}>
                  {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField select label="Reported by" fullWidth size="small" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })}>
                  {OWNERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
                <TextField label="Location / venue" fullWidth size="small" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Sports field, Block C" slotProps={{ htmlInput: { maxLength: 80 } }} />
                <TextField select label="Injury occurred" fullWidth size="small" value={form.injuryOccurred} onChange={(e) => setForm({ ...form, injuryOccurred: e.target.value })}>
                  <MenuItem value="no">No injury</MenuItem>
                  <MenuItem value="yes">Yes — injury reported</MenuItem>
                </TextField>
                <div>
                  <span className="mb-1 block text-sm font-medium leading-none">Injured party</span>
                  <div className="mt-1 space-y-1.5">
                    <PersonCombobox
                      options={studentOptions}
                      loading={pickerStudentsLoading}
                      placeholder="Search students…"
                      emptyText="No students found."
                      disabled={form.injuryOccurred !== "yes"}
                      onSelect={(option) => setForm((prev) => ({ ...prev, injuredParty: option.label }))}
                    />
                    <TextField fullWidth size="small" value={form.injuredParty} onChange={(e) => setForm({ ...form, injuredParty: e.target.value })} placeholder="Name(s) if injury occurred" slotProps={{ htmlInput: { maxLength: 120 } }} disabled={form.injuryOccurred !== "yes"} />
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-sm font-medium leading-none">Investigation assigned to</span>
                  <div className="mt-1 space-y-1.5">
                    <PersonCombobox
                      options={staffOptions}
                      loading={pickerUsersLoading}
                      placeholder="Search school staff…"
                      emptyText="No staff found."
                      onSelect={(option) => setForm((prev) => ({ ...prev, investigationAssignedTo: option.label }))}
                    />
                    <TextField fullWidth size="small" value={form.investigationAssignedTo} onChange={(e) => setForm({ ...form, investigationAssignedTo: e.target.value })} placeholder="e.g. Deputy Head, Security" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  </div>
                </div>
                <TextField label="Evidence / case reference" fullWidth size="small" value={form.evidenceRef} onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })} placeholder="e.g. CCTV footage #, police ref" slotProps={{ htmlInput: { maxLength: 100 } }} />
                <TextField select label="Notify parent / guardian" fullWidth size="small" value={form.notifyParent} onChange={(e) => setForm({ ...form, notifyParent: e.target.value })}>
                  <MenuItem value="no">Not required</MenuItem>
                  <MenuItem value="yes">Yes — notify parent</MenuItem>
                </TextField>
                <TextField label="Incident details" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Full context, people involved, sequence of events..." slotProps={{ htmlInput: { maxLength: 600 } }} />
                <TextField label="Root cause analysis" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.rootCauseAnalysis} onChange={(e) => setForm({ ...form, rootCauseAnalysis: e.target.value })} placeholder="Identify contributing factors and systemic causes" slotProps={{ htmlInput: { maxLength: 400 } }} />
                <TextField label="Preventive / corrective action" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.preventiveAction} onChange={(e) => setForm({ ...form, preventiveAction: e.target.value })} placeholder="Steps taken or recommended to prevent recurrence" slotProps={{ htmlInput: { maxLength: 400 } }} />
              </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={logIncident} disabled={createMut.isPending}>Log incident</Button>
              </DialogActions>
            </Dialog>
          </>
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
            <Chip size="small" label="Priority" sx={badgeSx("destructive")} />
          </div>
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Issue</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Reported by</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
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
                    <Chip
                      size="small"
                      label={incident.severity}
                      sx={badgeSx(incident.severity === "High" ? "destructive" : incident.severity === "Medium" ? "warning" : "outline")}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{incident.reportedBy}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{incident.incidentDate || incident.date}</TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      className="w-32"
                      value={incident.status}
                      onChange={(e) => { updateMut.mutate({ id: incident.id, status: e.target.value }); toast.success(`Incident status updated to ${e.target.value}`); }}
                    >
                      {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Response readiness</h2>
              <p className="text-xs text-muted-foreground">Incident playbooks and escalation steps.</p>
            </div>
            <Chip size="small" label="Audit ready" sx={badgeSx("secondary")} />
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
            <Button component={Link} to="/risk-register" variant="outlined">Escalate to risk register</Button>
          </div>
        </div>
      </div>
    </div>
    </AccessGuard>
  );
}
