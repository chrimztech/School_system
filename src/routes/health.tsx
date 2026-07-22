import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartPulse, Syringe, Pill, AlertTriangle, Plus, Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Chip, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Health & Clinic — SRMS" }] }),
  component: HealthPage,
});

function HealthPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState("visits");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    student: "", grade: "", complaint: "", treatment: "",
    visitDate: new Date().toISOString().slice(0, 10),
    visitTime: new Date().toTimeString().slice(0, 5),
    temperature: "", weight: "", bloodPressure: "",
    diagnosis: "", medicationPrescribed: "", dosage: "",
    followUpRequired: "no", followUpDate: "",
    referralRequired: "no", referralHospital: "",
    attendingNurse: "School Nurse",
  });

  const { data: visitsData = [], isLoading } = useQuery({
    queryKey: ["health-visits", schoolId],
    queryFn: () => api.health.visits(schoolId),
  });

  const { data: recordsData = [] } = useQuery({
    queryKey: ["health-records", schoolId],
    queryFn: () => api.health.records(schoolId),
  });

  const [recOpen, setRecOpen] = useState(false);

  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["health-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: open || recOpen,
  });
  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["health-picker-users", schoolId],
    queryFn: () => api.users.list(schoolId),
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
  const findPickerStudent = (id: string) => (pickerStudents as any[]).find((s) => s.id === id);
  const [recForm, setRecForm] = useState({
    studentName: "", grade: "", bloodGroup: "", allergies: "",
    chronicConditions: "", emergencyContact: "", emergencyPhone: "",
    lastCheckupDate: "", vaccinationStatus: "", notes: "",
  });

  const createRecordMut = useMutation({
    mutationFn: (data: any) => api.health.createRecord(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["health-records", schoolId] });
      toast.success("Health record saved");
      setRecForm({ studentName: "", grade: "", bloodGroup: "", allergies: "", chronicConditions: "", emergencyContact: "", emergencyPhone: "", lastCheckupDate: "", vaccinationStatus: "", notes: "" });
      setRecOpen(false);
    },
    onError: () => toast.error("Failed to save health record"),
  });

  const COMPLETE_STATUSES = ["complete", "completed", "up to date", "up-to-date", "fully vaccinated"];
  const records = recordsData as any[];
  const allergyRecords = records.filter((r) => (r.allergies || "").trim());
  const immunisationDue = records.filter((r) => r.vaccinationStatus && !COMPLETE_STATUSES.includes((r.vaccinationStatus as string).toLowerCase()));

  const createMutation = useMutation({
    mutationFn: (data: any) => api.health.createVisit(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-visits", schoolId] });
      toast.success("Visit recorded · parent SMS queued");
      setForm({ student: "", grade: "", complaint: "", treatment: "", visitDate: new Date().toISOString().slice(0, 10), visitTime: new Date().toTimeString().slice(0, 5), temperature: "", weight: "", bloodPressure: "", diagnosis: "", medicationPrescribed: "", dosage: "", followUpRequired: "no", followUpDate: "", referralRequired: "no", referralHospital: "", attendingNurse: "School Nurse" });
      setOpen(false);
    },
    onError: () => toast.error("Failed to record visit"),
  });

  const rawVisits = visitsData as any[];
  const visits = rawVisits.map((v: any) => ({
    ...v,
    student: v.studentName ?? v.student ?? "",
    grade: v.grade ?? v.class ?? "—",
    date: v.visitDate ?? v.date ?? v.createdAt ?? "",
    complaint: v.complaint ?? "",
    treatment: v.treatment ?? v.treatmentGiven ?? "",
    nurse: v.attendedBy ?? v.nurse ?? v.nurseName ?? "On duty",
  }));
  const todayVisits = visits.filter((v) => {
    const d = String(v.date);
    return d.includes("Today") || d.slice(0, 10) === new Date().toISOString().slice(0, 10);
  });

  return (
    <AccessGuard module="health">
      <div className="space-y-6">
      <PageHeader
        title="Health & Clinic"
        description="School clinic visits, immunisation records, allergies, and medical alerts."
        actions={
          <>
            <Button component={Link} to="/student-welfare" variant="outlined">
              Welfare cases
            </Button>
            <Button variant="outlined" startIcon={<Download size={16} />} onClick={() => { window.print(); toast.success("Health register exported (PDF)"); }}>
              Export register
            </Button>
            <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>New visit</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Record clinic visit</DialogTitle>
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
                        onSelect={(option) => {
                          const student = findPickerStudent(option.id);
                          if (!student) return;
                          setForm((prev) => ({ ...prev, student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(), grade: student.className || student.grade || prev.grade }));
                        }}
                      />
                    </div>
                  </div>
                  <TextField label="Student name *" fullWidth size="small" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} placeholder="Full name" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField label="Class / grade" fullWidth size="small" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Form 1A" slotProps={{ htmlInput: { maxLength: 30 } }} />
                  <TextField type="date" label="Visit date" fullWidth size="small" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="time" label="Visit time" fullWidth size="small" value={form.visitTime} onChange={(e) => setForm({ ...form, visitTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="number" label="Temperature (°C)" fullWidth size="small" slotProps={{ htmlInput: { step: 0.1, min: 34, max: 42 } }} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="e.g. 37.2" />
                  <TextField type="number" label="Weight (kg)" fullWidth size="small" slotProps={{ htmlInput: { step: 0.1, min: 0 } }} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 42.5" />
                  <TextField label="Blood pressure (mmHg)" fullWidth size="small" value={form.bloodPressure} onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })} placeholder="e.g. 120/80" slotProps={{ htmlInput: { maxLength: 20 } }} />
                  <div>
                    <span className="mb-1 block text-sm font-medium leading-none">Attending nurse / staff</span>
                    <div className="mt-1 space-y-1.5">
                      <PersonCombobox
                        options={staffOptions}
                        loading={pickerUsersLoading}
                        placeholder="Search school staff…"
                        emptyText="No staff found."
                        onSelect={(option) => setForm((prev) => ({ ...prev, attendingNurse: option.label }))}
                      />
                      <TextField fullWidth size="small" value={form.attendingNurse} onChange={(e) => setForm({ ...form, attendingNurse: e.target.value })} placeholder="School Nurse" slotProps={{ htmlInput: { maxLength: 80 } }} />
                    </div>
                  </div>
                  <TextField label="Complaint / presenting symptoms *" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} placeholder="Describe presenting complaint" slotProps={{ htmlInput: { maxLength: 300 } }} />
                  <TextField label="Diagnosis" fullWidth size="small" className="col-span-2" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Clinical diagnosis or working diagnosis" slotProps={{ htmlInput: { maxLength: 200 } }} />
                  <TextField label="Treatment given" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Describe treatment administered" slotProps={{ htmlInput: { maxLength: 300 } }} />
                  <TextField label="Medication prescribed" fullWidth size="small" value={form.medicationPrescribed} onChange={(e) => setForm({ ...form, medicationPrescribed: e.target.value })} placeholder="e.g. Paracetamol 500mg" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField label="Dosage / instructions" fullWidth size="small" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 1 tablet every 6 hrs for 3 days" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField select label="Follow-up required" fullWidth size="small" value={form.followUpRequired} onChange={(e) => setForm({ ...form, followUpRequired: e.target.value })}>
                    <MenuItem value="no">No</MenuItem>
                    <MenuItem value="yes">Yes</MenuItem>
                  </TextField>
                  <TextField type="date" label="Follow-up date" fullWidth size="small" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} disabled={form.followUpRequired !== "yes"} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField select label="Referral required" fullWidth size="small" value={form.referralRequired} onChange={(e) => setForm({ ...form, referralRequired: e.target.value })}>
                    <MenuItem value="no">No</MenuItem>
                    <MenuItem value="yes">Yes — refer to hospital</MenuItem>
                  </TextField>
                  <TextField label="Referral hospital / facility" fullWidth size="small" value={form.referralHospital} onChange={(e) => setForm({ ...form, referralHospital: e.target.value })} placeholder="e.g. UTH, Levy Hospital" slotProps={{ htmlInput: { maxLength: 100 } }} disabled={form.referralRequired !== "yes"} />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="text" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    if (!form.student.trim()) return toast.error("Student name required");
                    const diagnosisSummary = [
                      form.diagnosis.trim(),
                      form.temperature ? `Temp ${form.temperature}°C` : "",
                      form.weight ? `Weight ${form.weight}kg` : "",
                      form.bloodPressure.trim() ? `BP ${form.bloodPressure.trim()}` : "",
                    ].filter(Boolean).join(" | ");
                    const treatmentSummary = [
                      form.treatment.trim(),
                      form.medicationPrescribed.trim() ? `Medication: ${form.medicationPrescribed.trim()}` : "",
                      form.dosage.trim() ? `Dosage: ${form.dosage.trim()}` : "",
                      form.referralRequired === "yes" && form.referralHospital.trim() ? `Referral: ${form.referralHospital.trim()}` : "",
                    ].filter(Boolean).join("\n");
                    createMutation.mutate({
                      studentName: form.student.trim(), grade: form.grade || "—",
                      complaint: form.complaint,
                      treatment: treatmentSummary || form.treatment,
                      visitDate: form.visitDate,
                      diagnosis: diagnosisSummary || form.diagnosis.trim(),
                      followUpDate: form.followUpDate || null,
                      referredToHospital: form.referralRequired === "yes",
                      attendedBy: form.attendingNurse.trim() || "School Nurse",
                    });
                  }} disabled={createMutation.isPending} startIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
                    Save visit
                  </Button>
                </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visits today" value={todayVisits.length} accent="primary" icon={<HeartPulse className="h-4 w-4" />} />
        <StatCard label="Immunisations pending" value={immunisationDue.length} hint={immunisationDue.length === 0 ? "All up to date" : "Check immunisation tab"} accent="warning" icon={<Syringe className="h-4 w-4" />} />
        <StatCard label="Known allergies" value={allergyRecords.length} hint={allergyRecords.length === 0 ? "None on file" : "Students on file"} accent="warning" icon={<Pill className="h-4 w-4" />} />
        <StatCard label="Health records" value={records.length} hint="Students on file" accent="accent" icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      <Box>
        <div className="flex items-center justify-between">
          <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
            <Tab value="visits" label="Clinic visits" />
            <Tab value="imm" label="Immunisation" />
            <Tab value="allergies" label="Allergies & alerts" />
            <Tab value="stock" label="Medicine stock" />
          </Tabs>
          <button
            onClick={() => setRecOpen(true)}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />Add health record
          </button>
          <Dialog open={recOpen} onClose={() => setRecOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Add student health record</DialogTitle>
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
                      onSelect={(option) => {
                        const student = findPickerStudent(option.id);
                        if (!student) return;
                        setRecForm((prev) => ({ ...prev, studentName: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(), grade: student.className || student.grade || prev.grade }));
                      }}
                    />
                  </div>
                </div>
                <TextField label="Student name *" fullWidth size="small" value={recForm.studentName} onChange={(e) => setRecForm({ ...recForm, studentName: e.target.value })} placeholder="Full name" slotProps={{ htmlInput: { maxLength: 100 } }} />
                <TextField label="Class / grade" fullWidth size="small" value={recForm.grade} onChange={(e) => setRecForm({ ...recForm, grade: e.target.value })} placeholder="e.g. Form 2A" slotProps={{ htmlInput: { maxLength: 30 } }} />
                <TextField select label="Blood group" fullWidth size="small" value={recForm.bloodGroup || "__none__"} onChange={(e) => setRecForm({ ...recForm, bloodGroup: e.target.value === "__none__" ? "" : e.target.value })}>
                  <MenuItem value="__none__">Unknown</MenuItem>
                  {["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
                <TextField label="Vaccination status" fullWidth size="small" value={recForm.vaccinationStatus} onChange={(e) => setRecForm({ ...recForm, vaccinationStatus: e.target.value })} placeholder="e.g. Up to date / BCG due" slotProps={{ htmlInput: { maxLength: 100 } }} />
                <TextField type="date" label="Last checkup date" fullWidth size="small" value={recForm.lastCheckupDate} onChange={(e) => setRecForm({ ...recForm, lastCheckupDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Emergency contact" fullWidth size="small" value={recForm.emergencyContact} onChange={(e) => setRecForm({ ...recForm, emergencyContact: e.target.value })} placeholder="Name" slotProps={{ htmlInput: { maxLength: 80 } }} />
                <TextField label="Emergency phone" fullWidth size="small" className="col-span-2" value={recForm.emergencyPhone} onChange={(e) => setRecForm({ ...recForm, emergencyPhone: e.target.value })} placeholder="+260 9X XXX XXXX" slotProps={{ htmlInput: { maxLength: 30 } }} />
                <TextField label="Allergies" fullWidth size="small" multiline minRows={2} className="col-span-2" value={recForm.allergies} onChange={(e) => setRecForm({ ...recForm, allergies: e.target.value })} placeholder="List known allergies, separated by commas" slotProps={{ htmlInput: { maxLength: 500 } }} />
                <TextField label="Chronic conditions" fullWidth size="small" multiline minRows={2} className="col-span-2" value={recForm.chronicConditions} onChange={(e) => setRecForm({ ...recForm, chronicConditions: e.target.value })} placeholder="e.g. Asthma, Epilepsy, Diabetes" slotProps={{ htmlInput: { maxLength: 500 } }} />
                <TextField label="Notes" fullWidth size="small" multiline minRows={2} className="col-span-2" value={recForm.notes} onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })} placeholder="Any additional health notes" slotProps={{ htmlInput: { maxLength: 500 } }} />
              </div>
              </DialogContent>
              <DialogActions>
                <Button variant="text" color="inherit" onClick={() => setRecOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!recForm.studentName.trim()) return toast.error("Student name required");
                  createRecordMut.mutate({
                    studentName: recForm.studentName.trim(), grade: recForm.grade || "—",
                    bloodGroup: recForm.bloodGroup || null,
                    allergies: recForm.allergies.trim() || null,
                    chronicConditions: recForm.chronicConditions.trim() || null,
                    emergencyContact: recForm.emergencyContact.trim() || null,
                    emergencyPhone: recForm.emergencyPhone.trim() || null,
                    lastCheckupDate: recForm.lastCheckupDate || null,
                    vaccinationStatus: recForm.vaccinationStatus.trim() || null,
                    notes: recForm.notes.trim() || null,
                  });
                }} disabled={createRecordMut.isPending} startIcon={createRecordMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
                  Save record
                </Button>
              </DialogActions>
          </Dialog>
        </div>

        {tab === "visits" && (
        <Box className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading visits…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Time</TableCell><TableCell>Student</TableCell><TableCell>Class</TableCell>
                <TableCell>Complaint</TableCell><TableCell>Treatment</TableCell><TableCell>Nurse</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No clinic visits recorded.</TableCell></TableRow>
                ) : visits.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-muted-foreground">{String(v.date).slice(0, 16).replace("T", " ")}</TableCell>
                    <TableCell className="font-medium">{v.student}</TableCell>
                    <TableCell>{v.grade}</TableCell>
                    <TableCell>{v.complaint}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.treatment}</TableCell>
                    <TableCell>{v.nurse}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
        )}

        {tab === "imm" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Student</TableCell><TableCell>Grade</TableCell>
              <TableCell>Vaccination status</TableCell><TableCell>Last checkup</TableCell><TableCell>Notes</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {records.filter((r) => r.vaccinationStatus).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No immunisation records on file. Use "Add health record" to add one.</TableCell></TableRow>
              ) : records.filter((r) => r.vaccinationStatus).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell>{r.grade || "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={r.vaccinationStatus}
                      sx={badgeSx(COMPLETE_STATUSES.includes((r.vaccinationStatus || "").toLowerCase()) ? "secondary" : "destructive")}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.lastCheckupDate || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )}

        {tab === "allergies" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Student</TableCell><TableCell>Grade</TableCell>
              <TableCell>Allergies</TableCell><TableCell>Chronic conditions</TableCell><TableCell>Emergency contact</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {allergyRecords.length === 0 && records.filter((r) => r.chronicConditions).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No allergy or condition records on file.</TableCell></TableRow>
              ) : records.filter((r) => (r.allergies || "").trim() || (r.chronicConditions || "").trim()).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell>{r.grade || "—"}</TableCell>
                  <TableCell>
                    {r.allergies
                      ? <span className="flex items-center gap-1 text-destructive text-xs"><AlertTriangle className="h-3 w-3 shrink-0" />{r.allergies}</span>
                      : <span className="text-xs text-muted-foreground">None</span>}
                  </TableCell>
                  <TableCell className="text-xs">{r.chronicConditions || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.emergencyContact ? `${r.emergencyContact}${r.emergencyPhone ? ` · ${r.emergencyPhone}` : ""}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )}

        {tab === "stock" && (
        <Box className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Pill className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Medicine stock tracking not yet configured</p>
            <p className="text-sm text-muted-foreground">Contact your system administrator to enable clinic inventory management.</p>
          </div>
        </Box>
        )}
      </Box>
    </div>
    </AccessGuard>
  );
}
