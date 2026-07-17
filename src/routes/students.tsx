import { createFileRoute, Link, useNavigate, Outlet, useChildMatches } from "@tanstack/react-router";
import { Plus, Filter, Download, Search, X, Loader2, ChevronRight, ChevronLeft, Check, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/utils";
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

  // Zambia 2025: Primary uses Grade 1-6; Secondary uses Form 1-6 (O-Level 1-4, A-Level 5-6)
  const gradeLabel = (g: number | string) => {
    const n = Number(g);
    if (!n) return "—";
    if (isSecondary && !isPrimary) return `Form ${n}`;
    return `Grade ${n}`;
  };

  const gradeOptions: { value: string; label: string }[] =
    isSecondary && !isPrimary
      ? [1,2,3,4,5,6].map((n) => ({ value: String(n), label: `Form ${n}` }))
      : isPrimary && !isSecondary
      ? [1,2,3,4,5,6].map((n) => ({ value: String(n), label: `Grade ${n}` }))
      : [
          ...([1,2,3,4,5,6].map((n) => ({ value: String(n), label: `Grade ${n}` }))),
          ...([7,8,9,10,11,12].map((n) => ({ value: String(n), label: `Grade ${n}` }))),
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
            <Button variant="outline" onClick={() => {
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
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            {!isTeacher && !isHOD && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />Import
              </Button>
            )}
            {!isTeacher && !isHOD && <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(createInitialForm()); setStep(1); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Register student</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Register new student</DialogTitle>
                  <p className="text-sm text-muted-foreground">Records the student's personal details. Class enrolment is done separately on the Classes page.</p>
                </DialogHeader>
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
                    <div>
                      <Label>First name *</Label>
                      <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Chanda" />
                    </div>
                    <div>
                      <Label>Middle name</Label>
                      <Input className="mt-1" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} placeholder="Mubanga" />
                    </div>
                    <div>
                      <Label>Last name *</Label>
                      <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Mwale" />
                    </div>
                    <div>
                      <Label>Preferred name</Label>
                      <Input className="mt-1" value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} placeholder="Chichi" />
                    </div>
                    <div>
                      <Label>{isSecondary && !isPrimary ? "Form" : "Grade"}</Label>
                      <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{gradeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Section / stream</Label>
                      <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Admission date</Label>
                      <Input type="date" className="mt-1" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} />
                    </div>
                    <div>
                      <Label>Date of birth</Label>
                      <Input type="date" className="mt-1" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Nationality</Label>
                      <Input className="mt-1" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Zambian" />
                    </div>
                    <div>
                      <Label>Birth certificate no.</Label>
                      <Input className="mt-1" value={form.birthCertificateNo} onChange={(e) => setForm({ ...form, birthCertificateNo: e.target.value })} placeholder="BC-2020-001245" />
                    </div>
                    <div>
                      <Label>National ID / NRC</Label>
                      <Input className="mt-1" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" />
                    </div>
                    <div>
                      <Label>Learner phone</Label>
                      <Input className="mt-1" value={form.studentPhone} onChange={(e) => setForm({ ...form, studentPhone: e.target.value })} placeholder="+260 977 123 456" />
                    </div>
                    <div>
                      <Label>Learner email</Label>
                      <Input type="email" className="mt-1" value={form.studentEmail} onChange={(e) => setForm({ ...form, studentEmail: e.target.value })} placeholder="learner@example.com" />
                    </div>
                  </div>
                )}

                {/* Step 2  -  Parent / guardian */}
                {step === 2 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Primary parent / guardian *</Label>
                      <Input className="mt-1" value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} placeholder="Joseph Mwale" />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Select value={form.guardianRelationship} onValueChange={(v) => setForm({ ...form, guardianRelationship: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Primary phone *</Label>
                      <Input className="mt-1" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} placeholder="+260 977 123 456" />
                    </div>
                    <div>
                      <Label>Alternate phone</Label>
                      <Input className="mt-1" value={form.guardianAltPhone} onChange={(e) => setForm({ ...form, guardianAltPhone: e.target.value })} placeholder="+260 966 123 456" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" className="mt-1" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} placeholder="guardian@example.com" />
                    </div>
                    <div>
                      <Label>Occupation</Label>
                      <Input className="mt-1" value={form.guardianOccupation} onChange={(e) => setForm({ ...form, guardianOccupation: e.target.value })} placeholder="Teacher" />
                    </div>
                    <div>
                      <Label>Workplace</Label>
                      <Input className="mt-1" value={form.guardianWorkplace} onChange={(e) => setForm({ ...form, guardianWorkplace: e.target.value })} placeholder="Ministry of Education" />
                    </div>
                    <div>
                      <Label>National ID / NRC</Label>
                      <Input className="mt-1" value={form.guardianNationalId} onChange={(e) => setForm({ ...form, guardianNationalId: e.target.value })} placeholder="654321/12/1" />
                    </div>
                    <div className="col-span-2">
                      <Label>Parent / guardian address</Label>
                      <Textarea className="mt-1 min-h-20" value={form.guardianAddress} onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })} placeholder="Plot 12, Ibex Hill, Lusaka" />
                    </div>
                    <div>
                      <Label>Emergency contact</Label>
                      <Input className="mt-1" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Mary Mwale" />
                    </div>
                    <div>
                      <Label>Emergency relationship</Label>
                      <Select value={form.emergencyContactRelationship} onValueChange={(v) => setForm({ ...form, emergencyContactRelationship: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Emergency phone</Label>
                      <Input className="mt-1" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 955 123 456" />
                    </div>
                  </div>
                )}

                {/* Step 3  -  Welfare & safety */}
                {step === 3 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Residential address</Label>
                      <Textarea className="mt-1 min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Plot 10, Kafue Road, Lusaka" />
                    </div>
                    <div>
                      <Label>Town / city</Label>
                      <Input className="mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lusaka" />
                    </div>
                    <div>
                      <Label>Religion / faith</Label>
                      <Input className="mt-1" value={form.religion} onChange={(e) => setForm({ ...form, religion: e.target.value })} placeholder="Christianity" />
                    </div>
                    <div>
                      <Label>Blood group</Label>
                      <Select value={form.bloodGroup || "__none__"} onValueChange={(v) => setForm({ ...form, bloodGroup: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select group" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not captured</SelectItem>
                          {BLOOD_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHANNEL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Medical conditions</Label>
                      <Textarea className="mt-1 min-h-20" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} placeholder="Asthma, medication schedule, chronic conditions" />
                    </div>
                    <div className="col-span-2">
                      <Label>Allergies / dietary alerts</Label>
                      <Textarea className="mt-1 min-h-20" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="Peanuts, dust, lactose intolerance" />
                    </div>
                  </div>
                )}
                </div>

                <DialogFooter className="mt-4 flex items-center justify-between sm:justify-between">
                  <div>
                    {step > 1 && (
                      <Button variant="outline" onClick={() => setStep(step - 1)}>
                        <ChevronLeft className="mr-1 h-4 w-4" />Back
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => { setOpen(false); setForm(createInitialForm()); setStep(1); }}>Cancel</Button>
                    {step < 3 ? (
                      <Button onClick={nextStep}>
                        Next<ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button onClick={enrol} disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register student
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, admission # or guardian" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((value) => !value)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {(statusFilter !== "all" || gradeFilter !== "all") && (
            <Badge variant="destructive" className="ml-2 flex h-4 w-4 items-center justify-center p-0 text-[10px]">
              {(statusFilter !== "all" ? 1 : 0) + (gradeFilter !== "all" ? 1 : 0)}
            </Badge>
          )}
        </Button>
        {(statusFilter !== "all" || gradeFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setGradeFilter("all"); }}>
            <X className="mr-1 h-4 w-4" /> Clear filters
          </Button>
        )}
        <p className="ml-auto text-sm text-muted-foreground">{filtered.length} of {(students as any[]).length} students</p>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">{isSecondary && !isPrimary ? "Form" : "Grade"}</Label>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {isSecondary && !isPrimary ? "forms" : "grades"}</SelectItem>
                {gradeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading students...</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admission #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Parent / guardian</TableHead>
                <TableHead>Phone</TableHead>
                {!isTeacher && !isHOD && <TableHead>Fee balance</TableHead>}
                <TableHead>Status</TableHead>
                {!isTeacher && !isHOD && <TableHead />}
              </TableRow>
            </TableHeader>
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
                    <Badge variant={(student.status ?? "").toLowerCase() === "active" ? "secondary" : "outline"}>
                      {(student.status ?? "").toLowerCase()}
                    </Badge>
                  </TableCell>
                  {!isTeacher && !isHOD && <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        const name = fullStudentName(student);
                        if (window.confirm(`Remove ${name} (${student.admissionNumber}) from student records? This cannot be undone.`))
                          deleteMutation.mutate(student.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
