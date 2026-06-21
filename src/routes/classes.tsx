import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users, Loader2, Trash2, BookOpen, UserCog, Search } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant, gradeRangeForType } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/classes")({
  head: () => ({ meta: [{ title: "Classes — SRMS" }] }),
  component: ClassesPage,
});

function gradeLabel(grade: number | string | undefined, phase?: string): string {
  const g = Number(grade);
  if (!g) return "—";
  if (phase === "olevel" || phase === "alevel") return `Form ${g}`;
  if (phase === "primary") return `Grade ${g}`;
  // legacy secondary stored as 8-12
  return g >= 8 ? `Grade ${g}` : `Grade ${g}`;
}

function blankClassForm(year: string, defaultPhase = "") {
  return {
    name: "", grade: "", section: "", teacherId: "", teacherName: "", capacity: "30",
    room: "", academicYear: year, phase: defaultPhase, languageOfInstruction: "English",
    assessmentStream: "ECZ", notes: "",
  };
}

// ── Class detail sheet ────────────────────────────────────────────
function ClassDetailSheet({ cls, schoolId, onClose }: { cls: any; schoolId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [enrollSearch, setEnrollSearch] = useState("");
  const [teacherDialog, setTeacherDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [teacherForm, setTeacherForm] = useState({ teacherId: "", teacherName: "", subjectId: "", subjectName: "" });

  // Reset teacher form when dialog opens and auto-select first teacher + first subject
  useEffect(() => {
    if (!teacherDialog) { setTeacherForm({ teacherId: "", teacherName: "", subjectId: "", subjectName: "" }); return; }
    const firstT = (allTeachers as any[])[0];
    const firstS = (allSubjects as any[])[0];
    setTeacherForm({
      teacherId: firstT?.id ?? "",
      teacherName: firstT ? `${firstT.firstName} ${firstT.lastName}` : "",
      subjectId: firstS?.id ?? "",
      subjectName: firstS?.name ?? "",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherDialog]);

  const { data: enrolmentsRaw = [], isLoading: enrolLoading } = useQuery({
    queryKey: ["class-enrolments", schoolId, cls.id],
    queryFn: () => api.classes.enrolments(schoolId, cls.id),
  });

  const { data: classTeachersRaw = [], isLoading: teachersLoading } = useQuery({
    queryKey: ["class-teachers", schoolId, cls.id],
    queryFn: () => api.classes.classTeachers(schoolId, cls.id),
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["students", schoolId],
    queryFn: () => api.students.list(schoolId),
  });

  const { data: allTeachers = [] } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: () => api.subjects.list(schoolId),
  });

  const enrolments = enrolmentsRaw as any[];
  const classTeachers = classTeachersRaw as any[];
  const enrolledIds = new Set(enrolments.map((e: any) => e.studentId));

  // Students not yet enrolled in this class
  const availableStudents = useMemo(() => {
    const q = enrollSearch.toLowerCase();
    return (allStudents as any[]).filter((s: any) => {
      if (enrolledIds.has(s.id)) return false;
      if (!q) return true;
      const name = `${s.firstName ?? ""} ${s.lastName ?? ""}`.toLowerCase();
      return name.includes(q) || (s.admissionNumber ?? "").toLowerCase().includes(q) || (s.grade ?? "").toLowerCase().includes(q);
    });
  }, [allStudents, enrolledIds, enrollSearch]);

  // Mutations
  const enrolMut = useMutation({
    mutationFn: (s: any) => api.classes.enrolStudent(schoolId, cls.id, {
      studentId: s.id,
      studentName: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
      grade: s.grade ?? "",
      academicYear: cls.academicYear ?? String(new Date().getFullYear()),
    }),
    onSuccess: (_, s) => {
      void qc.invalidateQueries({ queryKey: ["class-enrolments", schoolId, cls.id] });
      void qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      toast.success(`${s.firstName} ${s.lastName} enrolled in ${cls.name}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to enrol student"),
  });

  const removeEnrolMut = useMutation({
    mutationFn: (id: string) => api.classes.removeEnrolment(schoolId, cls.id, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["class-enrolments", schoolId, cls.id] });
      void qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      toast.success("Student removed from class");
    },
    onError: () => toast.error("Failed to remove student"),
  });

  const assignTeacherMut = useMutation({
    mutationFn: (data: any) => api.classes.assignTeacher(schoolId, cls.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["class-teachers", schoolId, cls.id] });
      toast.success("Teacher assigned");
      setTeacherForm({ teacherId: "", teacherName: "", subjectId: "", subjectName: "" });
      setTeacherDialog(false);
    },
    onError: () => toast.error("Failed to assign teacher"),
  });

  const removeTeacherMut = useMutation({
    mutationFn: (id: string) => api.classes.removeTeacher(schoolId, cls.id, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["class-teachers", schoolId, cls.id] });
      toast.success("Assignment removed");
    },
    onError: () => toast.error("Failed to remove assignment"),
  });

  const submitTeacher = () => {
    if (!teacherForm.teacherId) { toast.error("Select a teacher"); return; }
    if (!teacherForm.subjectName.trim()) { toast.error("Select or enter a subject"); return; }
    assignTeacherMut.mutate({
      teacherId: teacherForm.teacherId,
      teacherName: teacherForm.teacherName,
      subjectId: teacherForm.subjectId || null,
      subjectName: teacherForm.subjectName,
      className: cls.name,
      academicYear: cls.academicYear ?? String(new Date().getFullYear()),
    });
  };

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg">{cls.name}</SheetTitle>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{gradeLabel(cls.grade, cls.phase)}{cls.section ? ` · ${cls.section}` : ""}</span>
            {cls.room && <span>Room {cls.room}</span>}
            {cls.academicYear && <span>{cls.academicYear}</span>}
            <span className="font-medium text-foreground">Class teacher: {cls.classTeacherName ?? cls.classTeacher ?? "—"}</span>
          </div>
        </SheetHeader>

        <Tabs defaultValue="pupils" className="flex flex-1 flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 w-auto self-start">
            <TabsTrigger value="pupils"><Users className="mr-1.5 h-3.5 w-3.5" />Pupils ({enrolments.length})</TabsTrigger>
            <TabsTrigger value="teachers"><BookOpen className="mr-1.5 h-3.5 w-3.5" />Subject teachers ({classTeachers.length})</TabsTrigger>
          </TabsList>

          {/* PUPILS TAB */}
          <TabsContent value="pupils" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <p className="text-sm text-muted-foreground">
                {enrolments.length} / {cls.capacity ?? "—"} enrolled
              </p>
              <Dialog open={enrollDialog} onOpenChange={setEnrollDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Enrol pupils</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Enrol pupils into {cls.name}</DialogTitle>
                    <p className="text-sm text-muted-foreground">Select admitted students to add to this class.</p>
                  </DialogHeader>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search by name, admission no. or grade" value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)} />
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                    {availableStudents.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        {enrollSearch ? "No students match your search." : "All admitted students are already in this class."}
                      </p>
                    ) : availableStudents.map((s: any) => {
                      const name = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.name || "—";
                      return (
                        <div key={s.id} className="flex items-center justify-between border-b border-border px-4 py-2.5 last:border-0">
                          <div>
                            <div className="text-sm font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground">{s.admissionNumber} · {s.grade ? gradeLabel(s.grade) : "—"}</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => enrolMut.mutate(s)} disabled={enrolMut.isPending}>
                            Enrol
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setEnrollDialog(false); setEnrollSearch(""); }}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto">
              {enrolLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span>Loading pupils…</span>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow></TableHeader>
                  <TableBody>
                    {enrolments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No pupils enrolled yet. Use "Enrol pupils" to add students.
                      </TableCell></TableRow>
                    ) : enrolments.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.studentName}</TableCell>
                        <TableCell className="text-muted-foreground">{e.grade || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{e.academicYear}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "ACTIVE" ? "secondary" : "outline"} className="capitalize">{(e.status ?? "ACTIVE").toLowerCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeEnrolMut.mutate(e.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* SUBJECT TEACHERS TAB */}
          <TabsContent value="teachers" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <p className="text-sm text-muted-foreground">Teachers assigned to teach subjects in this class</p>
              <Dialog open={teacherDialog} onOpenChange={setTeacherDialog}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserCog className="mr-1 h-3.5 w-3.5" />Assign teacher</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Assign subject teacher to {cls.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Teacher *</Label>
                      <Select
                        value={teacherForm.teacherId}
                        onValueChange={(v) => {
                          const t = (allTeachers as any[]).find((x: any) => x.id === v);
                          setTeacherForm({ ...teacherForm, teacherId: v, teacherName: t ? `${t.firstName} ${t.lastName}` : "" });
                        }}
                      >
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                        <SelectContent>
                          {(allTeachers as any[]).map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.firstName} {t.lastName}{t.subject ? ` · ${t.subject}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Subject *</Label>
                      {(allSubjects as any[]).length > 0 ? (
                        <Select
                          value={teacherForm.subjectId || "__custom__"}
                          onValueChange={(v) => {
                            if (v === "__custom__") {
                              setTeacherForm({ ...teacherForm, subjectId: "", subjectName: "" });
                            } else {
                              const sub = (allSubjects as any[]).find((s: any) => s.id === v);
                              setTeacherForm({ ...teacherForm, subjectId: v, subjectName: sub?.name ?? "" });
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                          <SelectContent>
                            {(allSubjects as any[]).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">Other / type below</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                      {((allSubjects as any[]).length === 0 || !teacherForm.subjectId) && (
                        <Input className="mt-1" placeholder="e.g. Mathematics, English Language" value={teacherForm.subjectName} onChange={(e) => setTeacherForm({ ...teacherForm, subjectName: e.target.value, subjectId: "" })} />
                      )}
                    </div>
                  </div>
                  <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => setTeacherDialog(false)}>Cancel</Button>
                    <Button onClick={submitTeacher} disabled={assignTeacherMut.isPending}>
                      {assignTeacherMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto">
              {teachersLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span>Loading assignments…</span>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead className="w-10" />
                  </TableRow></TableHeader>
                  <TableBody>
                    {classTeachers.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No subject teachers assigned yet. Use "Assign teacher" above.
                      </TableCell></TableRow>
                    ) : classTeachers.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.teacherName}</TableCell>
                        <TableCell>{t.subjectName}</TableCell>
                        <TableCell className="text-muted-foreground">{t.academicYear}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeTeacherMut.mutate(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────
function ClassesPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const currentYear = String(active.currentYear ?? new Date().getFullYear());
  const showPrimary = ["PRIMARY", "COMBINED", "FULL", "NURSERY"].includes(active.type);
  const showSecondary = ["SECONDARY", "COMBINED", "FULL"].includes(active.type);
  const defaultPhase = showPrimary && !showSecondary ? "primary" : !showPrimary && showSecondary ? "olevel" : "";

  const [createOpen, setCreateOpen] = useState(false);
  const [detailClass, setDetailClass] = useState<any | null>(null);
  const [form, setForm] = useState(() => blankClassForm(currentYear, defaultPhase));

  const { data: classesRaw = [], isLoading } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => api.classes.list(schoolId),
  });

  const { data: teachersRaw = [] } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.classes.create(schoolId, data),
    onSuccess: (c: any) => {
      void qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      toast.success(`${c.name} created`);
      setForm(blankClassForm(currentYear, defaultPhase));
      setCreateOpen(false);
    },
    onError: () => toast.error("Failed to create class"),
  });

  const classList = (classesRaw as any[]).map((c: any) => {
    const numericGrade = Number(c.grade ?? 0);
    return {
      ...c,
      phase: c.phase ?? (numericGrade > 0 && numericGrade <= 6 ? "primary" : "secondary"),
      classTeacher: c.classTeacher ?? c.classTeacherName ?? c.teacher ?? "",
      learners: c.learners ?? c.currentEnrolment ?? c.learnerCount ?? 0,
    };
  });

  const isSecondaryPhase = (p: string) => p === "secondary" || p === "olevel" || p === "alevel";
  const list = classList.filter((c: any) =>
    (c.phase === "primary" && showPrimary) ||
    (isSecondaryPhase(c.phase) && showSecondary) ||
    (!c.phase),
  );

  const createClass = () => {
    if (!form.name.trim()) { toast.error("Class name is required"); return; }
    if (!form.grade || Number(form.grade) <= 0) { toast.error("Grade is required"); return; }
    const teacher = (teachersRaw as any[]).find((t: any) => t.id === form.teacherId);
    createMutation.mutate({
      name: form.name.trim(),
      grade: Number(form.grade),
      section: form.section.trim() || null,
      classTeacherId: teacher?.id ?? null,
      classTeacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : form.teacherName.trim() || null,
      capacity: Number(form.capacity) || 30,
      room: form.room.trim() || null,
      academicYear: form.academicYear.trim() || currentYear,
      phase: form.phase || null,
      languageOfInstruction: form.languageOfInstruction,
      assessmentStream: form.assessmentStream,
      notes: form.notes.trim() || null,
      active: true,
    });
  };

  const ClassCard = ({ c }: { c: any }) => {
    const cap = c.capacity ?? 30;
    const fill = Math.round((c.learners / cap) * 100);
    return (
      <button
        onClick={() => setDetailClass(c)}
        className="rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold">{c.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {c.room ? `Room ${c.room} · ` : ""}{c.classTeacher || "No class teacher"}
            </p>
          </div>
          {c.phase && (
            <Badge variant={c.phase === "primary" ? "secondary" : "default"}>
              {c.phase === "olevel" ? "O-Level" : c.phase === "alevel" ? "A-Level" : c.phase === "primary" ? "Primary" : "Secondary"}
            </Badge>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" />Pupils</span>
            <span className="font-medium">{c.learners} / {cap}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${fill > 90 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(fill, 100)}%` }} />
          </div>
        </div>
        <p className="mt-3 text-xs text-primary underline-offset-2 hover:underline">Click to manage pupils &amp; teachers →</p>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description={`${gradeRangeForType(active.type)} · ${active.name}. Create classes, enrol pupils and assign subject teachers.`}
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Create class</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Create new class</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Class name *</Label>
                  <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Form 1 Blue / Grade 3A" maxLength={50} />
                </div>
                <div>
                  <Label>Academic year</Label>
                  <Input className="mt-1" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} placeholder="2026" maxLength={10} />
                </div>
                <div>
                  <Label>Grade / Form *</Label>
                  <Select
                    disabled={showPrimary && showSecondary && !form.phase}
                    value={form.grade}
                    onValueChange={(v) => setForm({ ...form, grade: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={showPrimary && showSecondary && !form.phase ? "Select phase first" : "Select grade or form"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.phase === "primary" || (!showSecondary && !form.phase)) &&
                        [1,2,3,4,5,6].map((g) => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
                      {(form.phase === "olevel" || (!showPrimary && !form.phase)) &&
                        [1,2,3,4].map((g) => <SelectItem key={g} value={String(g)}>Form {g} (O-Level)</SelectItem>)}
                      {(form.phase === "olevel" || form.phase === "alevel") && form.phase === "alevel" &&
                        [5,6].map((g) => <SelectItem key={g} value={String(g)}>Form {g} (A-Level)</SelectItem>)}
                      {!showPrimary && !form.phase &&
                        [5,6].map((g) => <SelectItem key={`al-${g}`} value={String(g)}>Form {g} (A-Level)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Section / stream</Label>
                  <Input className="mt-1" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A, Blue, Science" maxLength={20} />
                </div>
                <div>
                  <Label>Class teacher</Label>
                  <Select
                    value={form.teacherId || "__none__"}
                    onValueChange={(v) => {
                      const t = (teachersRaw as any[]).find((x: any) => x.id === v);
                      setForm({ ...form, teacherId: v === "__none__" ? "" : v, teacherName: t ? `${t.firstName} ${t.lastName}` : "" });
                    }}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Assign later</SelectItem>
                      {(teachersRaw as any[]).map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}{t.subject ? ` · ${t.subject}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Room</Label>
                  <Input className="mt-1" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="P-105" maxLength={20} />
                </div>
                <div>
                  <Label>Capacity</Label>
                  <Input className="mt-1" type="number" min={1} max={60} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </div>
                <div>
                  <Label>Phase</Label>
                  <Select value={form.phase || "__auto__"} onValueChange={(v) => setForm({ ...form, phase: v === "__auto__" ? "" : v, grade: "" })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select phase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">Auto-detect</SelectItem>
                      {showPrimary && <SelectItem value="primary">Primary (Grade 1-6)</SelectItem>}
                      {showSecondary && <SelectItem value="olevel">O-Level Secondary (Form 1-4)</SelectItem>}
                      {showSecondary && <SelectItem value="alevel">A-Level Secondary (Form 5-6)</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Language of instruction</Label>
                  <Select value={form.languageOfInstruction} onValueChange={(v) => setForm({ ...form, languageOfInstruction: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["English", "Nyanja", "Bemba", "Tonga", "Lozi"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assessment stream</Label>
                  <Select value={form.assessmentStream} onValueChange={(v) => setForm({ ...form, assessmentStream: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["ECZ", "IGCSE", "IB", "Internal only"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Double period Tuesdays, shared lab Thursdays…" maxLength={200} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={createClass} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create class
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total classes" value={list.length} accent="primary" />
        <StatCard label="Total pupils" value={list.reduce((s: number, c: any) => s + (c.learners ?? 0), 0)} accent="success" />
        <StatCard label="Avg class size" value={Math.round(list.reduce((s: number, c: any) => s + (c.learners ?? 0), 0) / Math.max(list.length, 1))} accent="accent" />
        <StatCard label="At capacity" value={list.filter((c: any) => ((c.learners ?? 0) / (c.capacity ?? 30)) > 0.9).length} accent="warning" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span>Loading classes…</span>
        </div>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({list.length})</TabsTrigger>
            {showPrimary && <TabsTrigger value="primary">Primary</TabsTrigger>}
            {showSecondary && <TabsTrigger value="secondary">Secondary</TabsTrigger>}
          </TabsList>
          <TabsContent value="all" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c: any) => <ClassCard key={c.id} c={c} />)}
            {list.length === 0 && <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">No classes yet. Create the first class above.</p>}
          </TabsContent>
          {showPrimary && (
            <TabsContent value="primary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.filter((c: any) => c.phase === "primary").map((c: any) => <ClassCard key={c.id} c={c} />)}
            </TabsContent>
          )}
          {showSecondary && (
            <TabsContent value="secondary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.filter((c: any) => isSecondaryPhase(c.phase)).map((c: any) => <ClassCard key={c.id} c={c} />)}
            </TabsContent>
          )}
        </Tabs>
      )}

      {detailClass && (
        <ClassDetailSheet
          cls={detailClass}
          schoolId={schoolId}
          onClose={() => setDetailClass(null)}
        />
      )}
    </div>
  );
}
