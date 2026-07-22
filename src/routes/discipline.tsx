import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Chip, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/discipline")({
  head: () => ({ meta: [{ title: "Discipline — SRMS" }] }),
  component: DisciplinePage,
});

const ACTIONS = ["Verbal warning", "Written warning", "1-day suspension", "3-day suspension", "1-week suspension", "Expulsion", "Community service", "Detention", "Parent meeting", "Counselling referral"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const OFFENSE_CATEGORIES = ["Behaviour", "Academic dishonesty", "Bullying / harassment", "Physical altercation", "Substance abuse", "Property damage", "Truancy / absenteeism", "Cyberbullying", "Defiance of authority", "Other"];

function extractNoteValue(notes: string | null | undefined, label: string) {
  return (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${label}:`))
    ?.replace(`${label}:`, "")
    .trim();
}

function DisciplinePage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const teacherEmail = isTeacher ? user.email : undefined;
  // Teachers can log incidents but cannot escalate to expulsion/long suspension or resolve cases
  const availableActions = isTeacher
    ? ACTIONS.filter((a) => !["Expulsion", "1-week suspension", "3-day suspension"].includes(a))
    : ACTIONS;
  const qc = useQueryClient();

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", schoolId, teacherEmail], queryFn: () => api.classes.list(schoolId, teacherEmail) });
  const classList = (classesData as any[]).map((c: any) => c.name || c.className || c.id).filter(Boolean);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    studentName: "", grade: "", offense: "", offenseCategory: OFFENSE_CATEGORIES[0],
    severity: "Medium" as typeof SEVERITIES[number], action: ACTIONS[0],
    location: "", incidentDate: new Date().toISOString().slice(0, 10),
    incidentTime: "", witnessNames: "", reportedBy: "", followUpDate: "", notified: "yes",
    status: "Open", repeatCount: "1", notes: "",
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["discipline", schoolId],
    queryFn: () => api.discipline.list(schoolId),
  });

  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["discipline-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: open,
  });
  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["discipline-picker-users", schoolId],
    queryFn: () => api.users.list(schoolId),
    enabled: open,
  });
  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: s.className || s.grade,
  }));
  const reporterOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));
  const selectStudent = (option: PersonOption) => {
    const student = (pickerStudents as any[]).find((s) => s.id === option.id);
    if (!student) return;
    setForm((prev) => ({
      ...prev,
      studentName: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
      grade: student.className || student.grade || prev.grade,
    }));
  };
  const selectReporter = (option: PersonOption) => {
    setForm((prev) => ({ ...prev, reportedBy: option.label }));
  };

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.discipline.resolve(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["discipline", schoolId] });
      toast.success("Case resolved");
    },
    onError: () => toast.error("Failed to resolve case"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.discipline.create(schoolId, data),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["discipline", schoolId] });
      toast.success(`Incident logged for ${d.studentName}`);
      setForm({
        studentName: "",
        grade: "",
        offense: "",
        offenseCategory: OFFENSE_CATEGORIES[0],
        severity: "Medium",
        action: ACTIONS[0],
        location: "",
        incidentDate: new Date().toISOString().slice(0, 10),
        incidentTime: "",
        witnessNames: "",
        reportedBy: "",
        followUpDate: "",
        notified: "yes",
        status: "Open",
        repeatCount: "1",
        notes: "",
      });
      setOpen(false);
    },
    onError: () => toast.error("Failed to log incident"),
  });

  const logIncident = () => {
    if (!form.studentName.trim() || !form.offense.trim()) { toast.error("Student name and offence are required"); return; }
    createMutation.mutate({
      studentName: form.studentName.trim(),
      grade: form.grade,
      offense: form.offense.trim(),
      offenseCategory: form.offenseCategory,
      severity: form.severity,
      action: form.action,
      incidentDate: form.incidentDate,
      incidentTime: form.incidentTime || null,
      location: form.location.trim() || null,
      witnessNames: form.witnessNames.trim() || null,
      followUpDate: form.followUpDate || null,
      parentNotified: form.notified === "yes",
      reportedBy: form.reportedBy.trim(),
      status: form.status,
      repeatCount: Math.max(1, Number(form.repeatCount) || 1),
      notes: form.notes.trim() || null,
    });
  };

  const recs = records as any[];
  const openCases = recs.filter((r) => !r.action?.includes("Expulsion")).length;
  const suspensions = recs.filter((r) => r.action?.includes("suspension")).length;
  const repeats = recs.filter((r) => (r.repeats ?? r.repeatCount ?? 0) > 1).length;

  return (
    <AccessGuard module="discipline">
      <div className="space-y-6">
      <PageHeader
        title="Discipline"
        description="Log offences, take action, notify parents and track repeats"
        actions={
          <>
            <Button variant="outlined" component={Link} to="/student-welfare">Welfare cases</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Log incident</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Log disciplinary incident</DialogTitle>
                <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <span className="mb-1 block text-sm font-medium leading-none">Find student</span>
                    <div className="mt-1">
                      <PersonCombobox
                        options={studentOptions}
                        loading={pickerStudentsLoading}
                        placeholder="Search enrolled students…"
                        emptyText="No students found."
                        onSelect={selectStudent}
                      />
                    </div>
                  </div>
                  <TextField label="Student name *" fullWidth size="small" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Mwansa Tembo" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField select label="Class / grade" fullWidth size="small" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                    {classList.length === 0 ? <MenuItem value="" disabled>No classes yet</MenuItem> : classList.map((c: string) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField type="date" label="Incident date" fullWidth size="small" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="time" label="Incident time" fullWidth size="small" value={form.incidentTime} onChange={(e) => setForm({ ...form, incidentTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Location / venue" fullWidth size="small" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Classroom 8A, Playground" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField select label="Severity" fullWidth size="small" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as typeof SEVERITIES[number] })}>
                    {SEVERITIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                  <TextField select label="Offence category" fullWidth size="small" value={form.offenseCategory} onChange={(e) => setForm({ ...form, offenseCategory: e.target.value })}>
                    {OFFENSE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField select label="Action taken" fullWidth size="small" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                    {availableActions.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </TextField>
                  <TextField label="Offence description *" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.offense} onChange={(e) => setForm({ ...form, offense: e.target.value })} placeholder="Describe the incident in full detail" slotProps={{ htmlInput: { maxLength: 500 } }} />
                  <div>
                    <span className="mb-1 block text-sm font-medium leading-none">Reported by</span>
                    <div className="mt-1 space-y-1.5">
                      <PersonCombobox
                        options={reporterOptions}
                        loading={pickerUsersLoading}
                        placeholder="Search school staff…"
                        emptyText="No staff found."
                        onSelect={selectReporter}
                      />
                      <TextField fullWidth size="small" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} placeholder="Reporting teacher / staff name" slotProps={{ htmlInput: { maxLength: 100 } }} />
                    </div>
                  </div>
                  <TextField type="date" label="Follow-up date" fullWidth size="small" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField select label="Workflow status" fullWidth size="small" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {["Open", "Monitoring", "Resolved"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                  </TextField>
                  <TextField type="number" label="Repeat count" fullWidth size="small" slotProps={{ htmlInput: { min: 1 } }} value={form.repeatCount} onChange={(e) => setForm({ ...form, repeatCount: e.target.value })} />
                  <TextField label="Witness names (comma-separated)" fullWidth size="small" className="col-span-2" value={form.witnessNames} onChange={(e) => setForm({ ...form, witnessNames: e.target.value })} placeholder="e.g. Mr. Banda, Miss Mwale" slotProps={{ htmlInput: { maxLength: 200 } }} />
                  <TextField label="Internal notes / support actions" fullWidth size="small" multiline minRows={3} className="col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Restorative actions, counseling referral, parent commitments, or dean comments" slotProps={{ htmlInput: { maxLength: 400 } }} />
                  <TextField select label="Parent / guardian notified" fullWidth size="small" value={form.notified} onChange={(e) => setForm({ ...form, notified: e.target.value })}>
                    <MenuItem value="yes">Yes — notified</MenuItem>
                    <MenuItem value="no">Not yet — pending</MenuItem>
                  </TextField>
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={logIncident} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log incident
                  </Button>
                </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open cases this term" value={openCases} accent="warning" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Suspensions" value={suspensions} accent="destructive" />
        <StatCard label="Repeat offenders" value={repeats} accent="primary" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading records…</span>
          </div>
        ) : (
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Student</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Offence</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Repeats</TableCell>
                <TableCell>Parent notified</TableCell>
                {!isTeacher && <TableCell className="text-right">Resolve</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
                {recs.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{(d.date ?? d.incidentDate ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="font-medium">{d.studentName ?? d.student}</TableCell>
                    <TableCell>{d.grade}</TableCell>
                    <TableCell>
                      <div>{d.offense}</div>
                      <div className="text-xs text-muted-foreground">
                        {[d.offenseCategory ?? extractNoteValue(d.notes, "Category"), d.severity ?? extractNoteValue(d.notes, "Severity")].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={d.action} sx={badgeSx(d.action?.includes("suspension") || d.action === "Expulsion" ? "destructive" : "outline")} />
                    </TableCell>
                  <TableCell>{(d.repeats ?? d.repeatCount ?? 1)}×</TableCell>
                  <TableCell>
                    {(d.notified ?? d.parentNotified)
                      ? <Chip size="small" label="Sent" sx={badgeSx("secondary")} />
                      : <Chip size="small" label="Pending" sx={badgeSx("destructive")} />}
                  </TableCell>
                  {!isTeacher && <TableCell className="text-right">
                    {(d.status ?? "Open") === "Resolved" ? (
                      <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Resolved</span>
                    ) : (
                      <Button size="small" variant="text" color="inherit" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate(d.id)}>
                        {resolveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resolve"}
                      </Button>
                    )}
                  </TableCell>}
                </TableRow>
              ))}
              {recs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No disciplinary records.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </div>
    </div>
    </AccessGuard>
  );
}
