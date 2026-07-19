import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Download,
  FileCheck2,
  GraduationCap,
  LineChart,
  Loader2,
  LockKeyhole,
  Pencil,
  Printer,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { gradingBandForPercentage, useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { SchoolDocumentHeader } from "@/components/school-document-header";
import { gradeBadgeClass } from "@/lib/utils";

export const Route = createFileRoute("/report-card")({
  head: () => ({ meta: [{ title: "Report Card — SRMS" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    studentId: (search.studentId as string) || "",
  }),
  component: ReportCardPage,
});

type SubjectResult = {
  name: string;
  classId: string;
  ca: number | null;
  midterm: number | null;
  exam: number | null;
  total: number;
  grade: string;
  description: string;
  points: number | null;
  complete: boolean;
};

function ClassAverageCell({
  schoolId,
  classId,
  subjectName,
  term,
  academicYear,
  reportingPeriod,
}: {
  schoolId: string;
  classId: string;
  subjectName: string;
  term: string;
  academicYear: string;
  reportingPeriod: "MIDTERM" | "END_TERM" | "COMBINED";
}) {
  const { data } = useQuery({
    queryKey: [
      "report-card-class-avg",
      schoolId,
      classId,
      subjectName,
      term,
      academicYear,
      reportingPeriod,
    ],
    queryFn: () =>
      api.termGrades.classStats(schoolId, {
        classId,
        subjectName,
        term,
        academicYear,
        reportingPeriod,
      }),
    enabled: !!classId && !!subjectName,
  });
  if (!data || data.average == null) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums text-muted-foreground">{Math.round(data.average)}</span>;
}

const HEAD_COMMENT_ROLES = new Set([
  "principal",
  "deputy_head",
  "hod",
  "school_admin",
  "super_admin",
]);
const TEACHER_COMMENT_ROLES = new Set([
  "teacher",
  "principal",
  "deputy_head",
  "school_admin",
  "super_admin",
]);

function CommentSection({
  teacherComment,
  headComment,
  saving,
  onSave,
  canEditHead,
  canEditTeacher,
}: {
  teacherComment: string;
  headComment: string;
  saving: boolean;
  onSave: (tc: string, hc: string) => void;
  canEditHead: boolean;
  canEditTeacher: boolean;
}) {
  const [tc, setTc] = useState(teacherComment);
  const [hc, setHc] = useState(headComment);
  const [editingTc, setEditingTc] = useState(false);
  const [editingHc, setEditingHc] = useState(false);
  const tcRef = useRef<HTMLTextAreaElement>(null);
  const hcRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTc(teacherComment);
  }, [teacherComment]);
  useEffect(() => {
    setHc(headComment);
  }, [headComment]);

  useEffect(() => {
    if (editingTc) tcRef.current?.focus();
  }, [editingTc]);
  useEffect(() => {
    if (editingHc) hcRef.current?.focus();
  }, [editingHc]);

  const save = (nextTc = tc, nextHc = hc) => {
    setEditingTc(false);
    setEditingHc(false);
    onSave(nextTc, nextHc);
  };

  return (
    <div className="space-y-4 border-t border-border p-6 text-sm">
      {/* Class teacher */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Class teacher's comment
          </p>
          {!canEditTeacher ? null : !editingTc ? (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditingTc(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={() => save(tc, hc)}
              disabled={saving}
            >
              <Check className="h-3 w-3" />
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        {canEditTeacher && editingTc ? (
          <Textarea
            ref={tcRef}
            className="mt-1"
            rows={3}
            value={tc}
            onChange={(e) => setTc(e.target.value)}
            onBlur={() => save(tc, hc)}
            placeholder="Enter class teacher's comment…"
            maxLength={500}
          />
        ) : (
          <p
            className={`mt-1 rounded-md px-1 py-0.5 text-sm ${canEditTeacher ? "cursor-text hover:bg-muted/50" : ""}`}
            onClick={canEditTeacher ? () => setEditingTc(true) : undefined}
          >
            {tc || <span className="text-muted-foreground italic">No comment recorded</span>}
          </p>
        )}
      </div>

      {/* Head teacher */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Head teacher's comment
          </p>
          {!canEditHead ? null : !editingHc ? (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditingHc(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={() => save(tc, hc)}
              disabled={saving}
            >
              <Check className="h-3 w-3" />
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        {canEditHead && editingHc ? (
          <Textarea
            ref={hcRef}
            className="mt-1"
            rows={3}
            value={hc}
            onChange={(e) => setHc(e.target.value)}
            onBlur={() => save(tc, hc)}
            placeholder="Enter head teacher's comment…"
            maxLength={500}
          />
        ) : (
          <p
            className={`mt-1 rounded-md px-1 py-0.5 text-sm ${canEditHead ? "cursor-text hover:bg-muted/50" : ""}`}
            onClick={canEditHead ? () => setEditingHc(true) : undefined}
          >
            {hc || (
              <span className="text-muted-foreground italic">
                No comment recorded — click to add
              </span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3">
        <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
          Class teacher signature
        </div>
        <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
          Head teacher signature
        </div>
        <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">
          School stamp
        </div>
      </div>
    </div>
  );
} // CommentSection

const TERM_OPTIONS = [
  { value: "1", label: "Term 1" },
  { value: "2", label: "Term 2" },
  { value: "3", label: "Term 3" },
];

function ReportCardPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const teacherEmail = user?.role === "teacher" ? user.email : undefined;
  const canEditHead = !!user && HEAD_COMMENT_ROLES.has(user.role);
  const canEditTeacher = !!user && TEACHER_COMMENT_ROLES.has(user.role);
  const qc = useQueryClient();
  const { studentId: initialStudentId } = Route.useSearch();
  const [selectedId, setSelectedId] = useState(initialStudentId || "");
  const [selectedTerm, setSelectedTerm] = useState(String(active.currentTerm ?? "1"));
  const [reportingPeriod, setReportingPeriod] = useState<"MIDTERM" | "END_TERM" | "COMBINED">(
    active.resultPublicationMode === "COMBINED" ? "COMBINED" : "END_TERM",
  );
  const term = selectedTerm;
  const year = String(active.currentYear ?? new Date().getFullYear());

  // Parents only ever see their own children — never the school's full roster.
  const { data: students = [], isLoading } = useQuery({
    queryKey: isParent
      ? ["guardian-children", active.id, user?.email]
      : ["students", active.id, teacherEmail],
    queryFn: () =>
      isParent
        ? api.students.listByGuardian(active.id, user!.email)
        : api.students.list(active.id, teacherEmail),
    enabled: !!active.id && (!isParent || !!user?.email),
  });

  const { data: termGradeHistory = [], isLoading: termGradesLoading } = useQuery({
    queryKey: ["published-term-grades", active.id, selectedId, year, reportingPeriod],
    queryFn: () => api.termGrades.publishedHistory(active.id, selectedId, year, reportingPeriod),
    enabled: !!active.id && !!selectedId,
  });

  const { data: savedComment } = useQuery({
    queryKey: ["report-comment", active.id, selectedId, term, year],
    queryFn: () => api.reportComments.get(active.id, selectedId, term, year),
    enabled: !!active.id && !!selectedId,
  });

  const commentMut = useMutation({
    mutationFn: (data: { teacherComment: string; headComment: string }) =>
      api.reportComments.upsert(active.id, selectedId, term, year, data),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["report-comment", active.id, selectedId, term, year],
      });
      toast.success("Comment saved");
    },
    onError: () => toast.error("Failed to save comment"),
  });

  useEffect(() => {
    if ((students as any[]).length > 0 && !selectedId) {
      setSelectedId(initialStudentId || (students as any[])[0].id);
    }
  }, [students, selectedId, initialStudentId]);

  const backendStudent = (students as any[]).find((s: any) => s.id === selectedId);
  const studentName = backendStudent
    ? `${backendStudent.firstName} ${backendStudent.lastName}`
    : "";
  const admissionNo = backendStudent?.admissionNumber || backendStudent?.admissionNo || "—";
  const grade = backendStudent?.className || backendStudent?.grade || "—";
  const classTeacher = backendStudent?.classTeacher || active.headTeacher || "—";

  const termGrades = useMemo(
    () => (termGradeHistory as any[]).filter((g) => g.term === selectedTerm),
    [termGradeHistory, selectedTerm],
  );

  const subjects: SubjectResult[] = useMemo(
    () =>
      termGrades.map((g) => ({
        name: g.subjectName,
        classId: g.classId,
        ca: g.caPercent != null ? Math.round(g.caPercent) : null,
        midterm: g.midtermPercent != null ? Math.round(g.midtermPercent) : null,
        exam: g.examPercent != null ? Math.round(g.examPercent) : null,
        total: Math.round(g.weightedTotal),
        grade: g.letterGrade,
        description: g.gradeDescription ?? "",
        points: g.gradePoints ?? null,
        complete: true,
      })),
    [termGrades],
  );

  const totalMarks = subjects.reduce((s, x) => s + x.total, 0);
  const averageValue = subjects.length > 0 ? totalMarks / subjects.length : 0;
  const avg = averageValue.toFixed(1);
  const overallBand = gradingBandForPercentage(active.gradingBands, averageValue);
  const reportLabel =
    reportingPeriod === "MIDTERM"
      ? "Mid-term"
      : reportingPeriod === "END_TERM"
        ? "End-of-term"
        : "Combined term";
  const reportIsLoading = termGradesLoading && !!selectedId;
  const reportIsPublished = !reportIsLoading && subjects.length > 0;

  const displayStudents = (students as any[]).map((s: any) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName}`,
    grade: s.className || s.grade || "",
  }));

  return (
    <AccessGuard module="report-card">
      <div className="space-y-6">
        <PageHeader
          title="Academic Report Cards"
          description="Review the exact published record shared with learners and their families."
          actions={
            <div className="flex items-center gap-2 print:hidden">
              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={!selectedId || subjects.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Save as PDF
              </Button>
              <Button onClick={() => window.print()} disabled={!selectedId || subjects.length === 0}>
                <Printer className="mr-2 h-4 w-4" />
                Print report
              </Button>
            </div>
          }
        />

        <section className="surface-card print:hidden rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpenCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Report viewer</p>
                  <p className="text-xs text-muted-foreground">
                    Only Careers Guidance-published results are available here.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Learner
                </Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="mt-1 w-full bg-background sm:w-64">
                    <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder={isLoading ? "Loading…" : "Select learner"} />
                  </SelectTrigger>
                  <SelectContent>
                    {displayStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                        {s.grade ? ` — ${s.grade}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Academic term
                </Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger className="mt-1 w-full bg-background sm:w-36">
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {active.resultPublicationMode === "SEPARATE" && (
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Release
                  </Label>
                  <Select
                    value={reportingPeriod}
                    onValueChange={(value) => setReportingPeriod(value as "MIDTERM" | "END_TERM")}
                  >
                    <SelectTrigger className="mt-1 w-full bg-background sm:w-40">
                      <FileCheck2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIDTERM">Mid-term</SelectItem>
                      <SelectItem value="END_TERM">End-of-term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="print-area overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-medium)] print:rounded-none print:border-0 print:shadow-none">
          <SchoolDocumentHeader
            title="Academic Report Card"
            subtitle={`${reportLabel} · Term ${selectedTerm} · ${year}`}
          />

          <div
            className={`flex flex-col gap-4 border-b border-border bg-gradient-to-r px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${reportIsLoading ? "from-primary/[0.06] to-transparent" : reportIsPublished ? "from-emerald-500/[0.08] via-primary/[0.04] to-transparent" : "from-amber-500/[0.08] to-transparent"}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${reportIsLoading ? "bg-primary/10 text-primary" : reportIsPublished ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
              >
                {reportIsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : reportIsPublished ? (
                  <FileCheck2 className="h-5 w-5" />
                ) : (
                  <LockKeyhole className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {reportIsLoading ? "Loading published record" : reportIsPublished ? "Published academic record" : "Awaiting publication"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reportIsLoading
                    ? "Checking the latest Careers Guidance release for this reporting cycle."
                    : reportIsPublished
                    ? "Verified by the HOD and released by Careers Guidance."
                    : "This report remains private until Careers Guidance releases the complete cycle."}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`w-fit gap-1.5 ${reportIsLoading ? "border-primary/30 bg-primary/5 text-primary" : reportIsPublished ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"}`}
            >
              {reportIsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <LockKeyhole className="h-3 w-3" />}
              {reportIsLoading ? "Checking…" : reportIsPublished ? "Locked snapshot" : "Not yet released"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-5 border-b border-border p-6 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Student</p>
              <p className="mt-0.5 font-medium">{studentName || "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Admission no.</p>
              <p className="mt-0.5 font-medium">{admissionNo}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Class</p>
              <p className="mt-0.5 font-medium">{grade}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Class teacher</p>
              <p className="mt-0.5 font-medium">{classTeacher}</p>
            </div>
          </div>

          <div className="overflow-x-auto" role="region" aria-label="Subject results" tabIndex={0}>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">CA %</TableHead>
                <TableHead className="text-right">Midterm %</TableHead>
                <TableHead className="text-right">Exam %</TableHead>
                <TableHead className="text-right">Weighted total</TableHead>
                <TableHead className="text-right">Class avg</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {reportIsLoading
                      ? "Loading the latest published results…"
                      : selectedId
                      ? "Results for this reporting cycle have not been published by Careers Guidance yet."
                      : "Select a student to view their report card."}
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((s, i) => (
                  <TableRow key={s.name} className={i % 2 === 1 ? "bg-muted/30" : undefined}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.ca ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.midterm ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.exam ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {s.total}
                      {!s.complete && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (provisional)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ClassAverageCell
                        schoolId={active.id}
                        classId={s.classId}
                        subjectName={s.name}
                        term={selectedTerm}
                        academicYear={year}
                        reportingPeriod={reportingPeriod}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className={gradeBadgeClass(s.grade)}>{s.grade}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.description || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border bg-muted/20 p-6 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <GraduationCap className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Overall grade
                </p>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-2xl font-semibold">
                  {subjects.length > 0 ? overallBand.grade : "—"}
                </span>
                {subjects.length > 0 && (
                  <span className="pb-1 text-xs text-muted-foreground">
                    {overallBand.description}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <LineChart className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Average</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {subjects.length > 0 ? `${avg}%` : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <BookOpenCheck className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Subjects reported
                </p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{subjects.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                  Total points
                </p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {subjects.length > 0
                  ? subjects.reduce((sum, subject) => sum + (subject.points ?? 0), 0)
                  : "—"}
              </p>
            </div>
          </div>

          {selectedId && subjects.length > 0 && (
            <CommentSection
              teacherComment={savedComment?.teacherComment ?? ""}
              headComment={savedComment?.headComment ?? ""}
              saving={commentMut.isPending}
              onSave={(teacherComment, headComment) =>
                commentMut.mutate({ teacherComment, headComment })
              }
              canEditHead={canEditHead}
              canEditTeacher={canEditTeacher}
            />
          )}
        </div>
      </div>
    </AccessGuard>
  );
}
