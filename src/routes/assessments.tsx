import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, FileText, Loader2, ClipboardList, Users, CheckCircle2, X, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/assessments")({
  head: () => ({ meta: [{ title: "Assessments — SRMS" }] }),
  component: AssessmentsPage,
});

const typeColor: Record<string, "secondary" | "outline" | "destructive"> = {
  exam: "destructive",
  midterm: "destructive",
  cat: "secondary",
  quiz: "secondary",
  project: "outline",
  homework: "outline",
  practical: "outline",
};

const TYPES = ["cat", "quiz", "practical", "project", "homework", "midterm", "exam"] as const;
const TERM_OPTIONS = [
  { value: "1", label: "Term 1" },
  { value: "2", label: "Term 2" },
  { value: "3", label: "Term 3" },
];
const SUBJECTS = ["Mathematics", "English Language", "Science", "Social Studies", "Civic Education", "Religious Education", "Physical Education", "French", "History", "Geography", "Biology", "Chemistry", "Physics", "Computer Studies", "Commerce", "Accounts", "Literature", "Art", "Music"];
const EMPTY_ITEMS: any[] = [];

// Matches the backend's GradeThresholds — keep in sync.
function computeGrade(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

function gradeColor(grade: string) {
  if (grade === "A+" || grade === "A") return "text-emerald-600";
  if (grade === "B") return "text-blue-600";
  if (grade === "C") return "text-amber-600";
  if (grade === "D") return "text-orange-500";
  return "text-destructive";
}

// ---------- Results Recording Sheet ----------

interface ResultRow {
  studentId: string;
  studentName: string;
  score: string;
  absent: boolean;
  grade: string;
}

function ResultsSheet({
  assessment,
  schoolId,
  classes,
  open,
  onClose,
}: {
  assessment: any;
  schoolId: string;
  classes: any[];
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ResultRow[]>([]);

  // Assessment.classId is stored as the class's display name (or occasionally its real id) —
  // resolve it to the real SchoolClass id before looking up enrolments.
  const resolvedClassId = useMemo(() => {
    const target = assessment?.classId ?? assessment?.class;
    if (!target) return undefined;
    const match = classes.find((c: any) => c.id === target || c.name === target || c.className === target);
    return match?.id ?? target;
  }, [assessment, classes]);

  const enrolmentsQuery = useQuery({
    queryKey: ["class-enrolments", schoolId, resolvedClassId],
    queryFn: () => api.classes.enrolments(schoolId, resolvedClassId),
    enabled: open && !!resolvedClassId,
  });

  const resultsQuery = useQuery({
    queryKey: ["assessment-results", schoolId, assessment?.id],
    queryFn: () => api.assessments.results(schoolId, assessment.id),
    enabled: open && !!assessment?.id,
  });
  const enrolments = (enrolmentsQuery.data ?? EMPTY_ITEMS) as any[];
  const existingResults = (resultsQuery.data ?? EMPTY_ITEMS) as any[];
  const studentsLoading = enrolmentsQuery.isLoading;
  const resultsLoading = resultsQuery.isLoading;

  // Build rows from the class's actual enrolment roster
  useEffect(() => {
    if (!open || !assessment) return;

    const resultsMap: Record<string, any> = {};
    (existingResults as any[]).forEach((r: any) => { resultsMap[r.studentId] = r; });

    setRows(enrolments.map((e: any) => {
      const existing = resultsMap[e.studentId];
      const score = existing ? String(existing.score ?? "") : "";
      const absent = existing?.absent ?? false;
      const grade = absent ? "—" : existing?.grade ?? (score !== "" ? computeGrade(Number(score), assessment.maxScore) : "");
      return {
        studentId: e.studentId,
        studentName: e.studentName || e.studentId,
        score,
        absent,
        grade,
      };
    }));
  }, [open, assessment, enrolments, existingResults]);

  const updateRow = (studentId: string, field: "score" | "absent", value: string | boolean) => {
    setRows((prev) => prev.map((r) => {
      if (r.studentId !== studentId) return r;
      if (field === "absent") {
        return { ...r, absent: value as boolean, score: value ? "" : r.score, grade: value ? "—" : r.score !== "" ? computeGrade(Number(r.score), assessment.maxScore) : "" };
      }
      const score = value as string;
      const grade = score !== "" ? computeGrade(Number(score), assessment.maxScore) : "";
      return { ...r, score, grade };
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any[]) => api.assessments.saveResults(schoolId, assessment.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessment-results", schoolId, assessment?.id] });
      qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success("Results saved successfully");
      onClose();
    },
    onError: () => toast.error("Failed to save results"),
  });

  const handleSave = () => {
    const payload = rows.map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      score: r.absent ? 0 : Number(r.score) || 0,
      absent: r.absent,
      grade: r.absent ? "ABS" : r.grade,
      remarks: "",
    }));
    saveMutation.mutate(payload);
  };

  // Stats derived from current rows
  const stats = useMemo(() => {
    const marked = rows.filter((r) => r.absent || r.score !== "");
    const scored = rows.filter((r) => !r.absent && r.score !== "");
    const avg = scored.length > 0 ? scored.reduce((s, r) => s + Number(r.score), 0) / scored.length : 0;
    const passCount = scored.filter((r) => r.grade !== "F" && r.grade !== "").length;
    const passRate = scored.length > 0 ? Math.round((passCount / scored.length) * 100) : 0;

    const byGrade: Record<string, number> = { "A+": 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    scored.forEach((r) => { if (r.grade && r.grade !== "—") byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1; });

    return { marked: marked.length, total: rows.length, avg, passRate, byGrade };
  }, [rows]);

  const isLoading = studentsLoading || resultsLoading;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle className="text-base leading-snug">{assessment?.title}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assessment?.classId ?? assessment?.class} · {assessment?.subjectName ?? assessment?.subject} · Max {assessment?.maxScore} marks
              </p>
            </div>
            <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors shrink-0"><X className="h-4 w-4" /></button>
          </div>
          {rows.length > 0 && (
            <div className="flex gap-5 mt-3 pt-3 border-t border-border">
              <div>
                <p className="text-lg font-bold">{stats.marked}/{stats.total}</p>
                <p className="text-[11px] text-muted-foreground">Marked</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-600">{stats.avg > 0 ? stats.avg.toFixed(1) : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Avg score</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${stats.passRate >= 70 ? "text-emerald-600" : stats.passRate >= 50 ? "text-amber-600" : "text-destructive"}`}>{stats.marked > 0 ? `${stats.passRate}%` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Pass rate</p>
              </div>
              {stats.marked > 0 && (
                <div className="ml-auto flex items-end gap-1">
                  {Object.entries(stats.byGrade).map(([g, count]) => count > 0 && (
                    <div key={g} className="text-center">
                      <div className="text-xs font-bold">{count}</div>
                      <div className={`text-[10px] font-semibold ${gradeColor(g)}`}>{g}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading students…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">No students found for class "{assessment?.classId ?? assessment?.class}"</p>
              <p className="text-xs opacity-60">Make sure students are enrolled in this class</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="w-28">Score /{assessment?.maxScore}</TableHead>
                  <TableHead className="w-16 text-center">Grade</TableHead>
                  <TableHead className="w-16 text-center">Absent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.studentId} className={r.absent ? "opacity-40" : ""}>
                    <TableCell className="text-center text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{r.studentName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={assessment?.maxScore}
                        value={r.score}
                        disabled={r.absent}
                        onChange={(e) => updateRow(r.studentId, "score", e.target.value)}
                        className="h-8 w-24 text-sm"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-bold ${gradeColor(r.grade)}`}>{r.grade || "—"}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={r.absent}
                        onCheckedChange={(checked) => updateRow(r.studentId, "absent", !!checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {rows.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Save results
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Compute & Publish Term Grades ----------

function ComputeGradesDialog({ schoolId, classList }: { schoolId: string; classList: string[] }) {
  const qc = useQueryClient();
  const { active } = useTenant();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classList[0] ?? "");
  const [subjectName, setSubjectName] = useState(SUBJECTS[0]);
  const [term, setTerm] = useState(String(active.currentTerm ?? "1"));
  const [results, setResults] = useState<any[] | null>(null);

  useEffect(() => {
    if (!classId && classList[0]) setClassId(classList[0]);
  }, [classList, classId]);

  const academicYear = String(active.currentYear ?? new Date().getFullYear());

  const computeMutation = useMutation({
    mutationFn: () => api.termGrades.compute(schoolId, { classId, subjectName, term, academicYear }),
    onSuccess: (rows) => {
      setResults(rows);
      toast.success(`Computed term grades for ${rows.length} student${rows.length === 1 ? "" : "s"}`);
    },
    onError: () => toast.error("Failed to compute term grades"),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.termGrades.publish(schoolId, id),
    onSuccess: (updated) => {
      setResults((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
      qc.invalidateQueries({ queryKey: ["term-grades"] });
    },
    onError: () => toast.error("Failed to publish"),
  });

  const publishAll = () => {
    (results ?? []).filter((r) => !r.published).forEach((r) => publishMutation.mutate(r.id));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResults(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><ClipboardList className="mr-2 h-4 w-4" /> Term grades</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Compute &amp; publish term grades</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Combines each student's continuous assessment, mid-term test, and exam scores for the selected class,
          subject, and term into a weighted overall grade.
        </p>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={subjectName} onValueChange={setSubjectName}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{TERM_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <Button onClick={() => computeMutation.mutate()} disabled={!classId || computeMutation.isPending}>
            {computeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Compute
          </Button>
        </div>

        {results && (
          <div className="mt-4 space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">CA %</TableHead>
                  <TableHead className="text-right">Midterm %</TableHead>
                  <TableHead className="text-right">Exam %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.studentName || r.studentId}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.caPercent != null ? Math.round(r.caPercent) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.midtermPercent != null ? Math.round(r.midtermPercent) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.examPercent != null ? Math.round(r.examPercent) : "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{Math.round(r.weightedTotal)}</TableCell>
                    <TableCell><span className={`text-sm font-bold ${gradeColor(r.letterGrade)}`}>{r.letterGrade}</span></TableCell>
                    <TableCell>
                      {r.published ? (
                        <Badge variant="secondary">Published</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => publishMutation.mutate(r.id)} disabled={publishMutation.isPending}>
                          Publish
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No enrolled students with assessment results found for this class/subject/term.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {results.some((r) => !r.published) && (
              <div className="flex justify-end">
                <Button onClick={publishAll} disabled={publishMutation.isPending}>Publish all</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Page ----------

function AssessmentsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isHOD = user?.role === "hod";
  const teacherEmail = isTeacher ? user.email : undefined;
  const loggedInTeacherName = (isTeacher || isHOD) ? (user?.name ?? "") : "";
  const qc = useQueryClient();

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", schoolId, teacherEmail], queryFn: () => api.classes.list(schoolId, teacherEmail) });
  const classList = (classesData as any[]).map((c: any) => c.name || c.className || c.id).filter(Boolean);

  const [open, setOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);

  const [form, setForm] = useState({
    title: "", classId: "", type: "cat" as typeof TYPES[number],
    subject: SUBJECTS[0], teacherAssigned: loggedInTeacherName, term: String(active.currentTerm ?? "1"),
    maxScore: "40", passMark: "20", weight: "10",
    date: new Date().toISOString().slice(0, 10), totalStudents: "32",
    rubricDescription: "", submissionMode: "Written",
    durationMinutes: "60", syllabusReference: "", gradingScheme: "Points",
    retakeAllowed: "no", markingCompletedBy: "",
  });

  const firstClass = classList[0] as string | undefined;
  useEffect(() => {
    if (firstClass) setForm((prev) => prev.classId === "" ? { ...prev, classId: firstClass } : prev);
  }, [firstClass]);
  useEffect(() => {
    if (loggedInTeacherName) setForm((prev) => prev.teacherAssigned === "" ? { ...prev, teacherAssigned: loggedInTeacherName } : prev);
  }, [loggedInTeacherName]);

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["assessments", schoolId],
    queryFn: () => api.assessments.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.assessments.create(schoolId, data),
    onSuccess: (a: any) => {
      qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success(`Assessment "${a.title}" created`);
      setForm({ title: "", classId: firstClass ?? "", type: "cat", subject: SUBJECTS[0], teacherAssigned: loggedInTeacherName, term: String(active.currentTerm ?? "1"), maxScore: "40", passMark: "20", weight: "10", date: new Date().toISOString().slice(0, 10), totalStudents: "32", rubricDescription: "", submissionMode: "Written", durationMinutes: "60", syllabusReference: "", gradingScheme: "Points", retakeAllowed: "no", markingCompletedBy: "" });
      setOpen(false);
    },
    onError: () => toast.error("Failed to create assessment"),
  });

  const addAssessment = () => {
    if (!form.title.trim()) { toast.error("Assessment title is required"); return; }
    createMutation.mutate({
      title: form.title, classId: form.classId, type: form.type,
      subjectName: form.subject, teacherAssigned: form.teacherAssigned.trim() || null,
      term: form.term, academicYear: String(active.currentYear ?? new Date().getFullYear()),
      maxScore: Number(form.maxScore) || 40,
      passMark: Number(form.passMark) || 20, weight: Number(form.weight) || 10,
      date: form.date, totalStudents: Number(form.totalStudents) || 32,
      rubricDescription: form.rubricDescription.trim() || null,
      submissionMode: form.submissionMode,
      durationMinutes: Number(form.durationMinutes) || null,
      syllabusReference: form.syllabusReference.trim() || null,
      gradingScheme: form.gradingScheme,
      retakeAllowed: form.retakeAllowed === "yes",
      markingCompletedBy: form.markingCompletedBy.trim() || null,
    });
  };

  const assessmentList = assessments as any[];

  return (
    <AccessGuard module="assessments">
      <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="CATs, homework, projects and exams · click a row to record results"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/report-card" search={{ studentId: "" }}><FileText className="mr-2 h-4 w-4" /> Report cards</Link>
            </Button>
            <ComputeGradesDialog schoolId={schoolId} classList={classList} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add assessment</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create assessment</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="col-span-2">
                    <Label>Assessment title *</Label>
                    <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Form 3A — Term 1 Maths CAT" maxLength={120} />
                  </div>
                  <div>
                    <Label>Class</Label>
                    <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>{classList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TERM_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Teacher assigned</Label>
                    <Input
                      className="mt-1"
                      value={form.teacherAssigned}
                      onChange={(e) => setForm({ ...form, teacherAssigned: e.target.value })}
                      placeholder="Teacher name"
                      readOnly={isTeacher}
                      title={isTeacher ? "Auto-filled from your account" : undefined}
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input className="mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Max score</Label>
                    <Input className="mt-1" type="number" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} min={1} max={200} />
                  </div>
                  <div>
                    <Label>Pass mark</Label>
                    <Input className="mt-1" type="number" value={form.passMark} onChange={(e) => setForm({ ...form, passMark: e.target.value })} min={0} />
                  </div>
                  <div>
                    <Label>Weight (%)</Label>
                    <Input className="mt-1" type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} min={0} max={100} />
                  </div>
                  <div>
                    <Label>Duration (min)</Label>
                    <Input className="mt-1" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} min={0} />
                  </div>
                  <div>
                    <Label>Grading scheme</Label>
                    <Select value={form.gradingScheme} onValueChange={(v) => setForm({ ...form, gradingScheme: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Points", "Percentage", "Letter grade", "Pass / Fail", "Distinction / Credit / Pass / Fail"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Retake allowed</Label>
                    <Select value={form.retakeAllowed} onValueChange={(v) => setForm({ ...form, retakeAllowed: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes — one retake</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Marking completed by</Label>
                    <Input className="mt-1" value={form.markingCompletedBy} onChange={(e) => setForm({ ...form, markingCompletedBy: e.target.value })} placeholder="Mrs. Phiri" maxLength={80} />
                  </div>
                  <div className="col-span-2">
                    <Label>Syllabus reference / topic coverage</Label>
                    <Input className="mt-1" value={form.syllabusReference} onChange={(e) => setForm({ ...form, syllabusReference: e.target.value })} placeholder="e.g. ECZ Maths Syl. 4024 · Topics: Algebra, Simultaneous equations" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Rubric / marking scheme description</Label>
                    <Input className="mt-1" value={form.rubricDescription} onChange={(e) => setForm({ ...form, rubricDescription: e.target.value })} placeholder="e.g. Section A: 20 marks (MCQ), Section B: 20 marks (structured)" maxLength={250} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addAssessment} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create assessment
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* Grading scale cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Primary scale</p>
          <p className="mt-2 text-lg font-semibold">A · B · C · D · E · F</p>
          <p className="text-xs text-muted-foreground">A = 80–100, F = 0–39</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Secondary scale</p>
          <p className="mt-2 text-lg font-semibold">1 · 2 · 3 · 4 · 5 · 6</p>
          <p className="text-xs text-muted-foreground">1 = Distinction, 6 = Fail</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase text-muted-foreground">Nursery</p>
          <p className="mt-2 text-lg font-semibold">Qualitative</p>
          <p className="text-xs text-muted-foreground">Excellent · Good · Developing</p>
        </div>
      </div>

      {/* Assessment list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading assessments…</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessmentList.map((a: any) => {
                const submitted = a.submittedCount ?? a.submitted ?? 0;
                const total = a.totalStudents ?? a.total ?? 0;
                const hasResults = submitted > 0;
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedAssessment(a)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {a.title}
                        {hasResults && <ClipboardList className="h-3 w-3 text-muted-foreground shrink-0" />}
                      </div>
                    </TableCell>
                    <TableCell>{a.classId ?? a.class}</TableCell>
                    <TableCell><Badge variant={typeColor[a.type] ?? "outline"}>{a.type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.subjectName ?? a.subject}</TableCell>
                    <TableCell>{a.maxScore}</TableCell>
                    <TableCell>{a.weight}%</TableCell>
                    <TableCell className="text-muted-foreground">{(a.date ?? "").slice(0, 10)}</TableCell>
                    <TableCell>
                      {hasResults ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{submitted}/{total || submitted}</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-emerald-500" style={{ width: `${total > 0 ? Math.min((submitted / total) * 100, 100) : 100}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not recorded</span>
                      )}
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                );
              })}
              {assessmentList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">No assessments created yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
      </div>

      {selectedAssessment && (
        <ResultsSheet
          assessment={selectedAssessment}
          schoolId={schoolId}
          classes={classesData as any[]}
          open={!!selectedAssessment}
          onClose={() => setSelectedAssessment(null)}
        />
      )}
    </AccessGuard>
  );
}
