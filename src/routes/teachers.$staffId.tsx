import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Mail, Phone, BookOpen, CalendarCheck, Users, Loader2, Pencil } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

const QUALIFICATIONS = ["BSc Ed. (UNZA)", "BA Ed. (CBU)", "BSc Ed.", "BA Ed.", "Diploma Ed.", "BSc Computing", "MA Ed.", "MEd."];
const GENDERS = ["Male", "Female"];

export const Route = createFileRoute("/teachers/$staffId")({
  head: () => ({ meta: [{ title: "Teacher Profile - SRMS" }] }),
  component: TeacherProfilePage,
});

type ClassAssignment = {
  id: string;
  name: string;
  grade: string;
  section: string;
  subjectId?: string;
  subjectName?: string;
};

function emptyEditForm() {
  return {
    firstName: "", lastName: "", subject: "", department: "", qualification: QUALIFICATIONS[0],
    gender: GENDERS[0], email: "", phone: "", nationalId: "", dateJoined: "", salary: "",
    status: "active", professionalLicenseNo: "", teachingExperienceYears: "",
    bankName: "", bankAccount: "", address: "",
  };
}

function EditTeacherDialog({
  open, onClose, teacher, departments, onSave, isPending,
}: {
  open: boolean;
  onClose: () => void;
  teacher: any;
  departments: any[];
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(emptyEditForm);

  useEffect(() => {
    if (!open || !teacher) return;
    setForm({
      firstName: teacher.firstName ?? "",
      lastName: teacher.lastName ?? "",
      subject: teacher.subject ?? "",
      department: teacher.department ?? "",
      qualification: teacher.qualification ?? QUALIFICATIONS[0],
      gender: teacher.gender ?? GENDERS[0],
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
      nationalId: teacher.nationalId ?? "",
      dateJoined: teacher.dateJoined ?? "",
      salary: teacher.salary != null ? String(teacher.salary) : "",
      status: teacher.status ?? "active",
      professionalLicenseNo: teacher.professionalLicenseNo ?? "",
      teachingExperienceYears: teacher.teachingExperienceYears != null ? String(teacher.teachingExperienceYears) : "",
      bankName: teacher.bankName ?? "",
      bankAccount: teacher.bankAccount ?? "",
      address: teacher.address ?? "",
    });
  }, [open, teacher]);

  const save = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error("First name and last name are required"); return; }
    onSave({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      subject: form.subject.trim(),
      department: form.department,
      qualification: form.qualification,
      gender: form.gender,
      email: form.email.trim(),
      phone: form.phone.trim(),
      nationalId: form.nationalId.trim(),
      dateJoined: form.dateJoined,
      salary: Number(form.salary) || 0,
      status: form.status,
      professionalLicenseNo: form.professionalLicenseNo.trim() || null,
      teachingExperienceYears: Number(form.teachingExperienceYears) || null,
      bankName: form.bankName.trim() || null,
      bankAccount: form.bankAccount.trim() || null,
      address: form.address.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Edit teacher</DialogTitle></DialogHeader>
        <div className="overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name *</Label>
              <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} maxLength={60} />
            </div>
            <div>
              <Label>Last name *</Label>
              <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} maxLength={60} />
            </div>
            <div className="col-span-2">
              <Label>Subjects (comma-separated)</Label>
              <Input className="mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathematics, Physics" />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department || "__none__"} onValueChange={(v) => setForm({ ...form, department: v === "__none__" ? "" : v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Qualification</Label>
              <Select value={form.qualification} onValueChange={(v) => setForm({ ...form, qualification: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">On duty</SelectItem>
                  <SelectItem value="on_leave">On leave</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={100} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
            </div>
            <div>
              <Label>National ID / NRC</Label>
              <Input className="mt-1" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} maxLength={30} />
            </div>
            <div>
              <Label>Date joined</Label>
              <Input type="date" className="mt-1" value={form.dateJoined} onChange={(e) => setForm({ ...form, dateJoined: e.target.value })} />
            </div>
            <div>
              <Label>Base salary (K)</Label>
              <Input type="number" min={0} className="mt-1" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            </div>
            <div>
              <Label>Teaching licence / ECZ no.</Label>
              <Input className="mt-1" value={form.professionalLicenseNo} onChange={(e) => setForm({ ...form, professionalLicenseNo: e.target.value })} maxLength={40} />
            </div>
            <div>
              <Label>Years of teaching experience</Label>
              <Input type="number" min={0} className="mt-1" value={form.teachingExperienceYears} onChange={(e) => setForm({ ...form, teachingExperienceYears: e.target.value })} />
            </div>
            <div>
              <Label>Bank name</Label>
              <Input className="mt-1" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} maxLength={60} />
            </div>
            <div>
              <Label>Bank account no.</Label>
              <Input className="mt-1" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} maxLength={40} />
            </div>
            <div className="col-span-2">
              <Label>Residential address</Label>
              <Input className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} />
            </div>
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeacherProfilePage() {
  const { staffId } = Route.useParams();
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState("classes");
  const [editOpen, setEditOpen] = useState(false);

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher", schoolId, staffId],
    queryFn: () => api.teachers.get(schoolId, staffId),
  });

  const { data: rawDepts = [] } = useQuery({
    queryKey: ["departments", schoolId],
    queryFn: () => api.departments.list(schoolId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.teachers.update(schoolId, staffId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teacher", schoolId, staffId] });
      void qc.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast.success("Teacher updated");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update teacher"),
  });

  const { data: rawAssignments = [] } = useQuery({
    queryKey: ["class-teachers-all", schoolId, staffId],
    queryFn: () => {
      const classes = api.classes.list(schoolId);
      return classes.then((allClasses: any[]) => {
        const classIds = (allClasses as any[]).map((c: any) => c.id);
        return Promise.all(
          classIds.map((cid: string) =>
            api.classes.classTeachers(schoolId, cid).then((teachers: any[]) => ({
              classId: cid,
              className: (allClasses as any[]).find((c: any) => c.id === cid)?.name ?? "",
              classGrade: (allClasses as any[]).find((c: any) => c.id === cid)?.grade ?? "",
              classSection: (allClasses as any[]).find((c: any) => c.id === cid)?.section ?? "",
              teachers,
            }))
          )
        ).then((results: any[]) => {
          const assigned: ClassAssignment[] = [];
          for (const r of results) {
            const match = (r.teachers as any[]).find(
              (t: any) => t.teacherId === staffId || t.teacherId === teacher?.id
            );
            if (match) {
              assigned.push({
                id: r.classId,
                name: r.className,
                grade: r.classGrade,
                section: r.classSection,
                subjectName: match.subjectName,
              });
            }
          }
          return assigned;
        });
      });
    },
    enabled: !!staffId && !!teacher,
    retry: false,
  });

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ["teacher-attendance", schoolId, staffId],
    queryFn: () => api.attendance.byDate(schoolId, new Date().toISOString().slice(0, 10)),
    retry: false,
  });

  const assignments = rawAssignments as ClassAssignment[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-6 w-6 animate-spin" /><span>Loading teacher profile...</span>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/teachers"><ArrowLeft className="mr-1 h-4 w-4" />Teachers</Link>
        </Button>
        <p className="text-center text-muted-foreground">Teacher not found.</p>
      </div>
    );
  }

  const record = teacher as any;
  const teacherName = `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim();
  const subjects = String(record.subject ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const status = String(record.status ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/teachers"><ArrowLeft className="mr-1 h-4 w-4" />Teachers</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm" style={{ background: `linear-gradient(135deg, ${active.primaryColor}08, transparent)` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ backgroundColor: active.primaryColor }}>
              {teacherName.split(" ").map((n: string) => n[0]).slice(-1)[0] ?? "T"}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{teacherName}</h1>
              <p className="font-mono text-sm text-muted-foreground">{record.staffNumber}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={status === "active" ? "secondary" : "outline"}>
                  {status === "active" ? "On duty" : status === "on_leave" ? "On leave" : "Inactive"}
                </Badge>
                <span className="text-sm text-muted-foreground">{record.qualification}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" />Edit
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/timetable"><BookOpen className="mr-1 h-4 w-4" />View timetable</Link>
            </Button>
          </div>
        </div>
      </div>

      <EditTeacherDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        teacher={record}
        departments={rawDepts as any[]}
        onSave={(data) => updateMutation.mutate(data)}
        isPending={updateMutation.isPending}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Class assignments · Term {active.currentTerm}</h2>
          {assignments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No class assignments recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Subject</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.grade ? `Grade ${a.grade}` : "—"}</TableCell>
                    <TableCell>{a.section || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.subjectName || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="details">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Personal & professional */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 text-sm">
              <h2 className="font-semibold">Personal & professional</h2>
              {[
                ["Staff no.", record.staffNumber],
                ["Qualification", record.qualification],
                ["Department", record.department ?? "General"],
                ["Date joined", record.dateJoined],
                ["Gender", record.gender],
                ["National ID", record.nationalId],
                ["Professional licence", record.professionalLicenseNo],
                ["Teaching experience", record.teachingExperienceYears != null ? `${record.teachingExperienceYears} year${record.teachingExperienceYears !== 1 ? "s" : ""}` : null],
              ].map(([label, value]) => value ? (
                <div key={label as string} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ) : null)}
              <div>
                <p className="text-muted-foreground mb-1">Subjects</p>
                <div className="flex flex-wrap gap-1">
                  {subjects.length > 0 ? subjects.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  )) : <span className="text-muted-foreground">No subject allocation</span>}
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 text-sm">
              <h2 className="font-semibold">Contact details</h2>
              <div className="space-y-2">
                {record.email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" />{record.email}</p>}
                {record.phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" />{record.phone}</p>}
                {record.address && <p className="text-muted-foreground pt-1">{record.address}</p>}
              </div>
              {(record.emergencyContactName || record.emergencyContactPhone) && (
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Emergency contact</p>
                  <p className="font-medium">{record.emergencyContactName || "—"}</p>
                  {record.emergencyContactPhone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{record.emergencyContactPhone}</p>}
                </div>
              )}
            </div>

            {/* Bank / payroll */}
            {(record.bankName || record.bankAccount || record.salary) && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3 text-sm">
                <h2 className="font-semibold">Payroll</h2>
                {[
                  ["Salary (K)", record.salary != null ? Number(record.salary).toLocaleString() : null],
                  ["Bank", record.bankName],
                  ["Account no.", record.bankAccount],
                ].map(([label, value]) => value ? (
                  <div key={label as string} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium font-mono">{value}</span>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Attendance history</h2>
          {attendanceHistory.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No attendance records found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(attendanceHistory as any[]).slice(0, 30).map((a: any) => {
                  const status = (a.status ?? "present").toLowerCase();
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground">{a.date ?? (a.createdAt ?? "").slice(0, 10)}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${status === "present" ? "bg-emerald-500/15 text-emerald-700" : status === "late" ? "bg-amber-500/15 text-amber-700" : "bg-destructive/15 text-destructive"}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.className ?? a.classId ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.remarks ?? ""}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Recent assessments</h2>
          <div className="py-12 text-center text-muted-foreground text-sm">No assessment records yet.</div>
        </div>
      </div>
    </div>
  );
}
