import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Heart, MessageSquare, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx, downloadCsv } from "@/lib/utils";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";

export const Route = createFileRoute("/student-welfare")({
  head: () => ({ meta: [{ title: "Student Welfare — SRMS" }] }),
  component: StudentWelfarePage,
});

const CASE_TYPES = ["Academic", "Emotional", "Social", "Family", "Medical"] as const;
const GRADES = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];


function StudentWelfarePage() {
  const { active } = useTenant();
  const qc = useQueryClient();

  const [tab, setTab] = useState("cases");
  const [caseOpen, setCaseOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [caseForm, setCaseForm] = useState({ student: "", grade: GRADES[0], type: "Academic", assignedTo: "" });
  const [sessionForm, setSessionForm] = useState({ student: "", counselor: "", date: "", type: "Individual", notes: "" });

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["welfare-cases", active.id],
    queryFn: () => api.welfare.cases(active.id),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["welfare-sessions", active.id],
    queryFn: () => api.welfare.sessions(active.id),
  });

  const dialogOpen = caseOpen || sessionOpen;
  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["welfare-picker-students", active.id],
    queryFn: () => api.students.list(active.id),
    enabled: dialogOpen,
  });
  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["welfare-picker-users", active.id],
    queryFn: () => api.users.list(active.id),
    enabled: dialogOpen,
  });
  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: s.className || s.grade,
  }));
  const staffOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));
  const findStudent = (id: string) => (pickerStudents as any[]).find((s) => s.id === id);

  const createCaseMut = useMutation({
    mutationFn: (data: any) => api.welfare.createCase(active.id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["welfare-cases", active.id] }); toast.success(`Welfare case opened`); setCaseOpen(false); },
    onError: () => toast.error("Failed to open case"),
  });

  const createSessionMut = useMutation({
    mutationFn: (data: any) => api.welfare.createSession(active.id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["welfare-sessions", active.id] }); toast.success("Session logged"); setSessionOpen(false); },
    onError: () => toast.error("Failed to log session"),
  });

  const resolveCaseMut = useMutation({
    mutationFn: ({ id }: { id: string; student: string }) => api.welfare.updateCase(active.id, id, { status: "Resolved" }),
    onSuccess: (_d, { student }) => { void qc.invalidateQueries({ queryKey: ["welfare-cases", active.id] }); toast.success(`Case for ${student} marked as resolved`); },
    onError: () => toast.error("Failed to resolve case"),
  });

  const logCase = () => {
    if (!caseForm.student.trim()) { toast.error("Student name is required"); return; }
    createCaseMut.mutate({ student: caseForm.student.trim(), grade: caseForm.grade, type: caseForm.type, assignedTo: caseForm.assignedTo, status: "Open", lastContact: new Date().toISOString().slice(0, 10) });
    setCaseForm({ student: "", grade: GRADES[0], type: "Academic", assignedTo: "" });
  };

  const logSession = () => {
    if (!sessionForm.student.trim() || !sessionForm.date.trim()) { toast.error("Student and date are required"); return; }
    createSessionMut.mutate({ student: sessionForm.student.trim(), counselor: sessionForm.counselor, sessionDate: sessionForm.date.trim(), sessionType: sessionForm.type, notes: sessionForm.notes.trim() });
    setSessionForm({ student: "", counselor: "", date: "", type: "Individual", notes: "" });
  };

  const openCases = (cases as any[]).filter((c: any) => c.status !== "Resolved").length;
  const resolvedCases = (cases as any[]).filter((c: any) => c.status === "Resolved").length;
  const highRisk = 0;

  return (
    <AccessGuard module="student-welfare">
      <div className="space-y-6">
      <PageHeader
        title="Student Welfare"
        description="Pastoral care cases, counseling sessions, and at-risk student monitoring."
        actions={<Button variant="outlined" onClick={() => { downloadCsv((cases as any[]).map((c: any) => ({ Student: c.student, Grade: c.grade, Type: c.type, "Assigned To": c.assignedTo, "Last Contact": c.lastContact, Status: c.status })), "welfare-report"); toast.success("Welfare report exported"); }}>Export report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open cases" value={openCases} accent="warning" icon={<Heart className="h-4 w-4" />} />
        <StatCard label="Sessions this term" value={(sessions as any[]).length} accent="primary" icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="High-risk alerts" value={highRisk} hint="Need urgent attention" accent="accent" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Resolved cases" value={resolvedCases} accent="success" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="cases" label="Welfare cases" />
        <Tab value="sessions" label="Counseling sessions" />
        <Tab value="atrisk" label="At-risk alerts" />
      </Tabs>

      {/* CASES */}
      {tab === "cases" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={() => setCaseOpen(true)}>New case</Button>
            <Dialog open={caseOpen} onClose={() => setCaseOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Open welfare case</DialogTitle>
              <DialogContent>
                <div className="grid gap-3">
                  <div>
                    <span className="mb-1 block text-sm font-medium leading-none">Find student</span>
                    <div className="mt-1">
                      <PersonCombobox
                        options={studentOptions}
                        loading={pickerStudentsLoading}
                        placeholder="Search enrolled students…"
                        emptyText="No students found."
                        onSelect={(option) => {
                          const student = findStudent(option.id);
                          if (!student) return;
                          setCaseForm((prev) => ({
                            ...prev,
                            student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
                            grade: student.className || student.grade || prev.grade,
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <TextField label="Student name *" fullWidth size="small" value={caseForm.student} onChange={(e) => setCaseForm({ ...caseForm, student: e.target.value })} placeholder="Chanda Mwape" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField select label="Grade" fullWidth size="small" value={caseForm.grade} onChange={(e) => setCaseForm({ ...caseForm, grade: e.target.value })}>
                      {GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                    <TextField select label="Case type" fullWidth size="small" value={caseForm.type} onChange={(e) => setCaseForm({ ...caseForm, type: e.target.value })}>
                      {CASE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </div>
                  <div>
                    <span className="mb-1 block text-sm font-medium leading-none">Assigned to</span>
                    <div className="mt-1 space-y-1.5">
                      <PersonCombobox
                        options={staffOptions}
                        loading={pickerUsersLoading}
                        placeholder="Search school staff…"
                        emptyText="No staff found."
                        onSelect={(option) => setCaseForm((prev) => ({ ...prev, assignedTo: option.label }))}
                      />
                      <TextField fullWidth size="small" value={caseForm.assignedTo} onChange={(e) => setCaseForm({ ...caseForm, assignedTo: e.target.value })} placeholder="Counselor / staff name" slotProps={{ htmlInput: { maxLength: 100 } }} />
                    </div>
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setCaseOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={logCase} disabled={createCaseMut.isPending}>Open case</Button>
              </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Student</TableCell><TableCell>Grade</TableCell><TableCell>Type</TableCell>
              <TableCell>Assigned to</TableCell><TableCell>Last contact</TableCell><TableCell>Status</TableCell>
              <TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {casesLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (cases as any[]).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.student}</TableCell>
                  <TableCell>{c.grade}</TableCell>
                  <TableCell><Chip size="small" label={c.type} sx={badgeSx("outline")} /></TableCell>
                  <TableCell className="text-muted-foreground">{c.assignedTo}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lastContact}</TableCell>
                  <TableCell>
                    <Chip size="small" label={c.status} sx={badgeSx(c.status === "Resolved" ? "secondary" : c.status === "Monitoring" ? "default" : "destructive")} />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {c.status !== "Resolved" ? (
                      <>
                        <Button size="small" variant="text" color="inherit" onClick={() => { createSessionMut.mutate({ student: c.student, counselor: c.assignedTo, sessionDate: new Date().toISOString().slice(0, 10), sessionType: "Individual", notes: "Follow-up session" }); }}>Log session</Button>
                        <Button size="small" variant="text" color="inherit" onClick={() => resolveCaseMut.mutate({ id: c.id, student: c.student })}>Resolve</Button>
                      </>
                    ) : <span className="text-xs text-muted-foreground">Closed</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {/* SESSIONS */}
      {tab === "sessions" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={() => setSessionOpen(true)}>Log session</Button>
            <Dialog open={sessionOpen} onClose={() => setSessionOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Log counseling session</DialogTitle>
              <DialogContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-sm font-medium leading-none">Find student</span>
                      <div className="mt-1">
                        <PersonCombobox
                          options={studentOptions}
                          loading={pickerStudentsLoading}
                          placeholder="Search students…"
                          emptyText="No students found."
                          onSelect={(option) => {
                            const student = findStudent(option.id);
                            if (!student) return;
                            setSessionForm((prev) => ({ ...prev, student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() }));
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="mb-1 block text-sm font-medium leading-none">Find counselor</span>
                      <div className="mt-1">
                        <PersonCombobox
                          options={staffOptions}
                          loading={pickerUsersLoading}
                          placeholder="Search school staff…"
                          emptyText="No staff found."
                          onSelect={(option) => setSessionForm((prev) => ({ ...prev, counselor: option.label }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Student name *" fullWidth size="small" value={sessionForm.student} onChange={(e) => setSessionForm({ ...sessionForm, student: e.target.value })} placeholder="Chanda Mwape" slotProps={{ htmlInput: { maxLength: 100 } }} />
                    <TextField label="Counselor" fullWidth size="small" value={sessionForm.counselor} onChange={(e) => setSessionForm({ ...sessionForm, counselor: e.target.value })} placeholder="Counselor / staff name" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField type="date" label="Date *" fullWidth size="small" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField select label="Session type" fullWidth size="small" value={sessionForm.type} onChange={(e) => setSessionForm({ ...sessionForm, type: e.target.value })}>
                      {(["Individual", "Group", "Parent"] as const).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </div>
                  <TextField label="Session notes" fullWidth size="small" multiline minRows={3} value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} placeholder="Key discussion points and follow-up actions..." slotProps={{ htmlInput: { maxLength: 500 } }} />
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setSessionOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={logSession} disabled={createSessionMut.isPending}>Log session</Button>
              </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Student</TableCell><TableCell>Counselor</TableCell><TableCell>Date</TableCell>
              <TableCell>Type</TableCell><TableCell>Notes</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {sessionsLoading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (sessions as any[]).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.student}</TableCell>
                  <TableCell className="text-muted-foreground">{s.counselor}</TableCell>
                  <TableCell className="text-muted-foreground">{s.sessionDate || s.date}</TableCell>
                  <TableCell><Chip size="small" label={s.sessionType || s.type} sx={badgeSx("secondary")} /></TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{s.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {/* AT-RISK */}
      {tab === "atrisk" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </Box>
      )}
    </div>
    </AccessGuard>
  );
}
