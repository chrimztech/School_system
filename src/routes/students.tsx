import { createFileRoute, Link, useNavigate, Outlet, useChildMatches } from "@tanstack/react-router";
import { Plus, Filter, Download, Search, X, Loader2, ChevronRight, ChevronLeft, Check, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button, Chip, IconButton, InputAdornment, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { useTenant, formatGrade } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { downloadCsv, badgeSx } from "@/lib/utils";
import { ImportDialog, type ImportResult } from "@/components/import-dialog";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [{ title: "Students - SRMS" }] }),
  component: StudentsPage,
});

const SECTIONS = ["A", "B", "C", "1A", "2A", "3A", "4A", "5A"];
const GENDERS = ["Male", "Female"];
const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Aunt", "Uncle", "Grandparent", "Sibling", "Other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CHANNEL_STATUSES = ["active", "inactive", "transferred", "graduated"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createInitialForm() {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    preferredName: "",
    grade: "1",
    section: "A",
    admissionDate: todayIso(),
    dateOfBirth: "",
    gender: "Male",
    nationality: "Zambian",
    nationalId: "",
    birthCertificateNo: "",
    studentPhone: "",
    studentEmail: "",
    religion: "",
    bloodGroup: "",
    medicalConditions: "",
    allergies: "",
    address: "",
    city: "",
    guardian: "",
    guardianRelationship: "Mother",
    guardianPhone: "",
    guardianAltPhone: "",
    guardianEmail: "",
    guardianOccupation: "",
    guardianWorkplace: "",
    guardianNationalId: "",
    guardianAddress: "",
    emergencyContactName: "",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "",
    status: "active",
  };
}

function fullStudentName(student: Record<string, unknown>) {
  return [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
}

function StudentsListPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user?.role === "teacher";
  const isHOD = user?.role === "hod";
  const teacherEmail = isTeacher ? user.email : undefined;
  const qc = useQueryClient();

  const isSecondary = ["SECONDARY", "COMBINED", "FULL"].includes(active.type);
  const isPrimary   = ["PRIMARY", "COMBINED", "FULL", "NURSERY"].includes(active.type);

  const gradeLabel = (g: number | string) => formatGrade(g, active.type);

  const gradeOptions: { value: string; label: string }[] =
    isSecondary && !isPrimary
      ? [1,2,3,4,5,6].map((n) => ({ value: String(n), label: `Form ${n}` }))
      : isPrimary && !isSecondary
      ? [1,2,3,4,5,6].map((n) => ({ value: String(n), label: `Grade ${n}` }))
      : [
          ...([1,2,3,4,5,6].map((n) => ({ value: String(n), label: `Grade ${n}` }))),
          ...([7,8,9,10,11,12].map((n) => ({ value: String(n), label: `Form ${n - 6}` }))),
        ];

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(createInitialForm);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", schoolId, teacherEmail],
    queryFn: () => api.students.list(schoolId, teacherEmail),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.students.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["students", schoolId, teacherEmail] });
      toast.success("Student record removed");
    },
    onError: () => toast.error("Failed to remove student record"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.students.create(schoolId, data),
    onSuccess: (student: any) => {
      qc.invalidateQueries({ queryKey: ["students", schoolId, teacherEmail] });
      toast.success(`${student.firstName} ${student.lastName} admitted (${student.admissionNumber}) — enrol them in a class on the Classes page`);

      // Auto-create parent/guardian login if email is provided
      const guardianEmail = (student.guardianEmail ?? "").trim();
      const guardianName = (student.guardian ?? student.guardianName ?? "").trim();
      if (guardianEmail) {
        void api.users.create(schoolId, {
          name: guardianName || "Guardian",
          email: guardianEmail,
          role: "PARENT",
        }).then(() => {
          void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
          toast.info(`Parent login created — email: ${guardianEmail} · password: password123`);
        }).catch(() => { /* login already exists for this guardian */ });
      }

      setForm(createInitialForm());
      setStep(1);
      setOpen(false);
    },
    onError: () => toast.error("Failed to enrol student"),
  });

  const nextStep = () => {
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        toast.error("First name and last name are required"); return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!form.guardian.trim() || !form.guardianPhone.trim()) {
        toast.error("Guardian name and phone are required"); return;
      }
      setStep(3);
    }
  };

  const enrol = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required"); setStep(1); return;
    }
    if (!form.guardian.trim() || !form.guardianPhone.trim()) {
      toast.error("Guardian name and phone are required"); setStep(2); return;
    }
    createMutation.mutate({
      ...form,
      grade: Number(form.grade),
      bloodGroup: form.bloodGroup || null,
    });
  };

  const filtered = useMemo(() => (students as any[]).filter((student) => {
    const name = fullStudentName(student);
    const matchQ = `${name} ${student.admissionNumber} ${student.guardian ?? ""}`.toLowerCase().includes(q.toLowerCase());
    const matchStatus = statusFilter === "all" || (student.status ?? "").toLowerCase() === statusFilter;
    const matchGrade = gradeFilter === "all" || String(student.grade) === gradeFilter;
    return matchQ && matchStatus && matchGrade;
  }), [students, q, statusFilter, gradeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Admitted student register. To enrol a student into a class, open the Classes page and use Enrol pupils."
        actions={
          <>
            <Button variant="outlined" startIcon={<Download className="h-4 w-4" />} onClick={() => {
              if (filtered.length === 0) { toast.error("No students to export"); return; }
              downloadCsv(filtered.map((s: any) => ({
                "Admission No": s.admissionNumber ?? "",
                "First Name": s.firstName ?? "",
                "Middle Name": s.middleName ?? "",
                "Last Name": s.lastName ?? "",
                "Preferred Name": s.preferredName ?? "",
                Grade: s.grade ?? "",
                Section: s.section ?? "",
                Gender: s.gender ?? "",
                "Date of Birth": s.dateOfBirth ?? "",
                Nationality: s.nationality ?? "",
                "National ID": s.nationalId ?? "",
                "Birth Certificate No": s.birthCertificateNo ?? "",
                Religion: s.religion ?? "",
                "Blood Group": s.bloodGroup ?? "",
                "Medical Conditions": s.medicalConditions ?? "",
                Allergies: s.allergies ?? "",
                "Student Phone": s.studentPhone ?? "",
                "Student Email": s.studentEmail ?? "",
                Address: s.address ?? "",
                City: s.city ?? "",
                "Admission Date": s.admissionDate ?? "",
                Status: s.status ?? "active",
                "Guardian Name": s.guardian ?? s.guardianName ?? "",
                "Guardian Relationship": s.guardianRelationship ?? "",
                "Guardian Phone": s.guardianPhone ?? "",
                "Guardian Alt Phone": s.guardianAltPhone ?? "",
                "Guardian Email": s.guardianEmail ?? "",
                "Guardian Occupation": s.guardianOccupation ?? "",
                "Guardian Workplace": s.guardianWorkplace ?? "",
                "Guardian National ID": s.guardianNationalId ?? "",
                "Guardian Address": s.guardianAddress ?? "",
                "Emergency Contact Name": s.emergencyContactName ?? "",
                "Emergency Contact Relationship": s.emergencyContactRelationship ?? "",
                "Emergency Contact Phone": s.emergencyContactPhone ?? "",
              })), `students-${new Date().toISOString().slice(0, 10)}`);
            }}>
              Export
            </Button>
            {!isTeacher && !isHOD && (
              <Button variant="outlined" startIcon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
                Import
              </Button>
            )}
            {!isTeacher && !isHOD && <>
              <Button variant="contained" startIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Register student</Button>
              <Dialog open={open} onClose={() => { setOpen(false); setForm(createInitialForm()); setStep(1); }} maxWidth="lg" fullWidth>
                <DialogTitle>Register new student</DialogTitle>
                <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>Records the student's personal details. Class enrolment is done separately on the Classes page.</DialogContentText>
                <div className="overflow-y-auto flex-1 pr-1">

                {/* Step indicator */}
                <div className="flex items-center gap-0">
                  {(["Learner profile", "Parent / guardian", "Welfare & safety"] as const).map((label, i) => {
                    const n = i + 1;
                    const done = step > n;
                    const active = step === n;
                    return (
                      <div key={label} className="flex flex-1 items-center">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-sm font-medium disabled:pointer-events-none"
                          onClick={() => setStep(n)}
                          disabled={n > step}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold
                            ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {done ? <Check className="h-3.5 w-3.5" /> : n}
                          </span>
                          <span className={active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"}>
                            {label}
                          </span>
                        </button>
                        {i < 2 && <div className={`mx-3 h-px flex-1 ${step > n ? "bg-primary" : "bg-border"}`} />}
                      </div>
                    );
                  })}
                </div>

                {/* Step 1  -  Learner profile */}
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Chanda" fullWidth size="small" />
                    <TextField label="Middle name" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} placeholder="Mubanga" fullWidth size="small" />
                    <TextField label="Last name *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Mwale" fullWidth size="small" />
                    <TextField label="Preferred name" value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} placeholder="Chichi" fullWidth size="small" />
                    <TextField
                      select
                      label={isSecondary && !isPrimary ? "Form" : "Grade"}
                      value={form.grade}
                      onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {gradeOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Section / stream"
                      value={form.section}
                      onChange={(e) => setForm({ ...form, section: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {SECTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <TextField
                      type="date"
                      label="Admission date"
                      value={form.admissionDate}
                      onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      type="date"
                      label="Date of birth"
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Gender"
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                    <TextField label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Zambian" fullWidth size="small" />
                    <TextField label="Birth certificate no." value={form.birthCertificateNo} onChange={(e) => setForm({ ...form, birthCertificateNo: e.target.value })} placeholder="BC-2020-001245" fullWidth size="small" />
                    <TextField label="National ID / NRC" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" fullWidth size="small" />
                    <TextField label="Learner phone" value={form.studentPhone} onChange={(e) => setForm({ ...form, studentPhone: e.target.value })} placeholder="+260 977 123 456" fullWidth size="small" />
                    <TextField type="email" label="Learner email" value={form.studentEmail} onChange={(e) => setForm({ ...form, studentEmail: e.target.value })} placeholder="learner@example.com" fullWidth size="small" />
                  </div>
                )}

                {/* Step 2  -  Parent / guardian */}
                {step === 2 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <TextField label="Primary parent / guardian *" value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} placeholder="Joseph Mwale" fullWidth size="small" />
                    </div>
                    <TextField
                      select
                      label="Relationship"
                      value={form.guardianRelationship}
                      onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {RELATIONSHIPS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </TextField>
                    <TextField label="Primary phone *" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} placeholder="+260 977 123 456" fullWidth size="small" />
                    <TextField label="Alternate phone" value={form.guardianAltPhone} onChange={(e) => setForm({ ...form, guardianAltPhone: e.target.value })} placeholder="+260 966 123 456" fullWidth size="small" />
                    <TextField type="email" label="Email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} placeholder="guardian@example.com" fullWidth size="small" />
                    <TextField label="Occupation" value={form.guardianOccupation} onChange={(e) => setForm({ ...form, guardianOccupation: e.target.value })} placeholder="Teacher" fullWidth size="small" />
                    <TextField label="Workplace" value={form.guardianWorkplace} onChange={(e) => setForm({ ...form, guardianWorkplace: e.target.value })} placeholder="Ministry of Education" fullWidth size="small" />
                    <TextField label="National ID / NRC" value={form.guardianNationalId} onChange={(e) => setForm({ ...form, guardianNationalId: e.target.value })} placeholder="654321/12/1" fullWidth size="small" />
                    <div className="col-span-2">
                      <TextField
                        label="Parent / guardian address"
                        multiline
                        minRows={3}
                        value={form.guardianAddress}
                        onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })}
                        placeholder="Plot 12, Ibex Hill, Lusaka"
                        fullWidth
                        size="small"
                      />
                    </div>
                    <TextField label="Emergency contact" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Mary Mwale" fullWidth size="small" />
                    <TextField
                      select
                      label="Emergency relationship"
                      value={form.emergencyContactRelationship}
                      onChange={(e) => setForm({ ...form, emergencyContactRelationship: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {RELATIONSHIPS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </TextField>
                    <TextField label="Emergency phone" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 955 123 456" fullWidth size="small" />
                  </div>
                )}

                {/* Step 3  -  Welfare & safety */}
                {step === 3 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <TextField
                        label="Residential address"
                        multiline
                        minRows={3}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Plot 10, Kafue Road, Lusaka"
                        fullWidth
                        size="small"
                      />
                    </div>
                    <TextField label="Town / city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lusaka" fullWidth size="small" />
                    <TextField label="Religion / faith" value={form.religion} onChange={(e) => setForm({ ...form, religion: e.target.value })} placeholder="Christianity" fullWidth size="small" />
                    <TextField
                      select
                      label="Blood group"
                      value={form.bloodGroup || "__none__"}
                      onChange={(e) => setForm({ ...form, bloodGroup: e.target.value === "__none__" ? "" : e.target.value })}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="__none__">Not captured</MenuItem>
                      {BLOOD_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Status"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {CHANNEL_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <div className="col-span-2">
                      <TextField
                        label="Medical conditions"
                        multiline
                        minRows={3}
                        value={form.medicalConditions}
                        onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })}
                        placeholder="Asthma, medication schedule, chronic conditions"
                        fullWidth
                        size="small"
                      />
                    </div>
                    <div className="col-span-2">
                      <TextField
                        label="Allergies / dietary alerts"
                        multiline
                        minRows={3}
                        value={form.allergies}
                        onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                        placeholder="Peanuts, dust, lactose intolerance"
                        fullWidth
                        size="small"
                      />
                    </div>
                  </div>
                )}
                </div>
                </DialogContent>
                <DialogActions sx={{ justifyContent: "space-between" }}>
                  <div>
                    {step > 1 && (
                      <Button variant="outlined" color="inherit" onClick={() => setStep(step - 1)} startIcon={<ChevronLeft className="h-4 w-4" />}>
                        Back
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="text" color="inherit" onClick={() => { setOpen(false); setForm(createInitialForm()); setStep(1); }}>Cancel</Button>
                    {step < 3 ? (
                      <Button variant="contained" onClick={nextStep} endIcon={<ChevronRight className="h-4 w-4" />}>
                        Next
                      </Button>
                    ) : (
                      <Button variant="contained" onClick={enrol} disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register student
                      </Button>
                    )}
                  </div>
                </DialogActions>
              </Dialog>
            </>}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="max-w-sm flex-1">
          <TextField
            size="small"
            fullWidth
            placeholder="Search by name, admission # or guardian"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
          />
        </div>
        <Button variant="outlined" size="small" startIcon={<Filter className="h-4 w-4" />} onClick={() => setShowFilters((value) => !value)}>
          Filters
          {(statusFilter !== "all" || gradeFilter !== "all") && (
            <Chip
              size="small"
              label={(statusFilter !== "all" ? 1 : 0) + (gradeFilter !== "all" ? 1 : 0)}
              sx={{
                ...badgeSx("destructive"),
                ml: 1,
                height: 16,
                width: 16,
                fontSize: 10,
                "& .MuiChip-label": { px: 0 },
              }}
            />
          )}
        </Button>
        {(statusFilter !== "all" || gradeFilter !== "all") && (
          <Button variant="text" color="inherit" size="small" startIcon={<X className="h-4 w-4" />} onClick={() => { setStatusFilter("all"); setGradeFilter("all"); }}>
            Clear filters
          </Button>
        )}
        <p className="ml-auto text-sm text-muted-foreground">{filtered.length} of {(students as any[]).length} students</p>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <TextField
            select
            label="Status"
            size="small"
            className="w-32"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField
            select
            label={isSecondary && !isPrimary ? "Form" : "Grade"}
            size="small"
            className="w-36"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <MenuItem value="all">All {isSecondary && !isPrimary ? "forms" : "grades"}</MenuItem>
            {gradeOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading students...</span>
          </div>
        ) : (
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Admission #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Parent / guardian</TableCell>
                <TableCell>Phone</TableCell>
                {!isTeacher && !isHOD && <TableCell>Fee balance</TableCell>}
                <TableCell>Status</TableCell>
                {!isTeacher && !isHOD && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((student: any) => (
                <TableRow
                  key={student.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => void navigate({ to: "/students/$studentId", params: { studentId: student.id } })}
                >
                  <TableCell className="font-mono text-xs">{student.admissionNumber}</TableCell>
                  <TableCell className="font-medium">
                    {fullStudentName(student)}
                    {student.preferredName && (
                      <p className="text-xs text-muted-foreground">Prefers {student.preferredName}</p>
                    )}
                  </TableCell>
                  <TableCell>{gradeLabel(student.grade)} {student.section}</TableCell>
                  <TableCell>
                    <div className="font-medium">{student.guardian}</div>
                    {student.guardianRelationship && (
                      <div className="text-xs text-muted-foreground">{student.guardianRelationship}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.guardianPhone ?? student.studentPhone ?? "-"}</TableCell>
                  {!isTeacher && !isHOD && <TableCell>
                    {student.feeBalance > 0 ? (
                      <span className="text-destructive">K {Number(student.feeBalance).toLocaleString()}</span>
                    ) : (
                      <span className="text-success">Cleared</span>
                    )}
                  </TableCell>}
                  <TableCell>
                    <Chip
                      size="small"
                      label={(student.status ?? "").toLowerCase()}
                      sx={badgeSx((student.status ?? "").toLowerCase() === "active" ? "secondary" : "outline")}
                    />
                  </TableCell>
                  {!isTeacher && !isHOD && <TableCell onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      aria-label={`Remove ${fullStudentName(student)} from student records`}
                      color="error"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        const name = fullStudentName(student);
                        if (window.confirm(`Remove ${name} (${student.admissionNumber}) from student records? This cannot be undone.`))
                          deleteMutation.mutate(student.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </TableCell>}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No students match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import students"
        entityName="student"
        columns={[
          { key: "firstName", label: "First Name", required: true, example: "Mwansa" },
          { key: "lastName", label: "Last Name", required: true, example: "Tembo" },
          { key: "middleName", label: "Middle Name", example: "Joseph" },
          { key: "grade", label: "Grade", required: true, example: "8" },
          { key: "section", label: "Section", example: "A" },
          { key: "gender", label: "Gender", required: true, example: "Male" },
          { key: "dateOfBirth", label: "Date of Birth", example: "2010-06-15" },
          { key: "admissionDate", label: "Admission Date", example: "2025-01-10" },
          { key: "nationality", label: "Nationality", example: "Zambian" },
          { key: "bloodGroup", label: "Blood Group", example: "O+" },
          { key: "medicalConditions", label: "Medical Conditions", example: "Asthma" },
          { key: "allergies", label: "Allergies", example: "Peanuts" },
          { key: "studentPhone", label: "Student Phone", example: "+260 977 000001" },
          { key: "studentEmail", label: "Student Email", example: "mwansa@example.com" },
          { key: "address", label: "Address", example: "12 Kalingalinga, Lusaka" },
          { key: "guardian", label: "Guardian Name", required: true, example: "Chanda Tembo" },
          { key: "guardianRelationship", label: "Guardian Relationship", example: "Father" },
          { key: "guardianPhone", label: "Guardian Phone", required: true, example: "+260 966 000001" },
          { key: "guardianAltPhone", label: "Guardian Alt Phone", example: "+260 955 000001" },
          { key: "guardianEmail", label: "Guardian Email", example: "chanda@example.com" },
          { key: "guardianOccupation", label: "Guardian Occupation", example: "Teacher" },
          { key: "emergencyContactName", label: "Emergency Contact Name", example: "Bwalya Tembo" },
          { key: "emergencyContactPhone", label: "Emergency Contact Phone", example: "+260 978 000001" },
          { key: "status", label: "Status", example: "active" },
        ]}
        onDone={() => void qc.invalidateQueries({ queryKey: ["students", schoolId, teacherEmail] })}
        onImport={async (rows) => {
          const result: ImportResult = { imported: 0, errors: [] };
          const valid: { row: number; dto: any }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row["First Name"]?.trim() || !row["Last Name"]?.trim()) {
              result.errors.push({ row: i + 2, error: "First Name and Last Name are required" });
              continue;
            }
            if (!row["Grade"]?.trim()) {
              result.errors.push({ row: i + 2, error: "Grade is required" });
              continue;
            }
            if (!row["Guardian Name"]?.trim() || !row["Guardian Phone"]?.trim()) {
              result.errors.push({ row: i + 2, error: "Guardian Name and Guardian Phone are required" });
              continue;
            }
            valid.push({
              row: i + 2,
              dto: {
                firstName: row["First Name"].trim(),
                middleName: row["Middle Name"]?.trim() || null,
                lastName: row["Last Name"].trim(),
                grade: Number(row["Grade"]) || 1,
                section: row["Section"]?.trim() || "A",
                gender: row["Gender"]?.trim() || "Male",
                dateOfBirth: row["Date of Birth"]?.trim() || null,
                admissionDate: row["Admission Date"]?.trim() || new Date().toISOString().slice(0, 10),
                nationality: row["Nationality"]?.trim() || "Zambian",
                bloodGroup: row["Blood Group"]?.trim() || null,
                medicalConditions: row["Medical Conditions"]?.trim() || null,
                allergies: row["Allergies"]?.trim() || null,
                studentPhone: row["Student Phone"]?.trim() || null,
                studentEmail: row["Student Email"]?.trim() || null,
                address: row["Address"]?.trim() || null,
                guardian: row["Guardian Name"].trim(),
                guardianRelationship: row["Guardian Relationship"]?.trim() || null,
                guardianPhone: row["Guardian Phone"].trim(),
                guardianAltPhone: row["Guardian Alt Phone"]?.trim() || null,
                guardianEmail: row["Guardian Email"]?.trim() || null,
                guardianOccupation: row["Guardian Occupation"]?.trim() || null,
                emergencyContactName: row["Emergency Contact Name"]?.trim() || null,
                emergencyContactPhone: row["Emergency Contact Phone"]?.trim() || null,
                status: row["Status"]?.trim() || "active",
              },
            });
          }
          if (valid.length > 0) {
            try {
              const bulk = await api.students.bulkCreate(schoolId, valid.map((v) => v.dto));
              result.imported += bulk.imported;
              bulk.errors.forEach((e) => result.errors.push({ row: valid[e.row]?.row ?? -1, error: e.error }));
            } catch (e: any) {
              valid.forEach((v) => result.errors.push({ row: v.row, error: e?.response?.data?.message ?? e?.message ?? "Unknown error" }));
            }
          }
          result.errors.sort((a, b) => a.row - b.row);
          return result;
        }}
      />
    </div>
  );
}

function StudentsPage() {
  const children = useChildMatches();
  if (children.length > 0) return <Outlet />;
  return <StudentsListPage />;
}
