import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Printer, Check, Pencil } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
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
  complete: boolean;
};

function ClassAverageCell({
  schoolId, classId, subjectName, term, academicYear,
}: {
  schoolId: string; classId: string; subjectName: string; term: string; academicYear: string;
}) {
  const { data } = useQuery({
    queryKey: ["report-card-class-avg", schoolId, classId, subjectName, term, academicYear],
    queryFn: () => api.termGrades.classStats(schoolId, { classId, subjectName, term, academicYear }),
    enabled: !!classId && !!subjectName,
  });
  if (!data || data.average == null) return <span className="text-muted-foreground">—</span>;
  return <span className="tabular-nums text-muted-foreground">{Math.round(data.average)}</span>;
}

const HEAD_COMMENT_ROLES = new Set(["principal", "deputy_head", "hod", "school_admin", "super_admin"]);

function CommentSection({
  teacherComment, headComment, saving, onSave, canEditHead,
}: {
  teacherComment: string;
  headComment: string;
  saving: boolean;
  onSave: (tc: string, hc: string) => void;
  canEditHead: boolean;
}) {
  const [tc, setTc] = useState(teacherComment);
  const [hc, setHc] = useState(headComment);
  const [editingTc, setEditingTc] = useState(false);
  const [editingHc, setEditingHc] = useState(false);
  const tcRef = useRef<HTMLTextAreaElement>(null);
  const hcRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTc(teacherComment); }, [teacherComment]);
  useEffect(() => { setHc(headComment); }, [headComment]);

  useEffect(() => { if (editingTc) tcRef.current?.focus(); }, [editingTc]);
  useEffect(() => { if (editingHc) hcRef.current?.focus(); }, [editingHc]);

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
          <p className="text-xs font-semibold uppercase text-muted-foreground">Class teacher's comment</p>
          {!editingTc ? (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditingTc(true)}
            >
              <Pencil className="h-3 w-3" />Edit
            </button>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={() => save(tc, hc)}
              disabled={saving}
            >
              <Check className="h-3 w-3" />{saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
        {editingTc ? (
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
            className="mt-1 cursor-text rounded-md px-1 py-0.5 text-sm hover:bg-muted/50"
            onClick={() => setEditingTc(true)}
          >
            {tc || <span className="text-muted-foreground italic">No comment recorded — click to add</span>}
          </p>
        )}
      </div>

      {/* Head teacher */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Head teacher's comment</p>
          {!canEditHead ? null : !editingHc ? (
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setEditingHc(true)}
            >
              <Pencil className="h-3 w-3" />Edit
            </button>
          ) : (
            <button
              className="flex items-center gap-1 text-xs text-primary"
              onClick={() => save(tc, hc)}
              disabled={saving}
            >
              <Check className="h-3 w-3" />{saving ? "Saving…" : "Save"}
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
            {hc || <span className="text-muted-foreground italic">No comment recorded — click to add</span>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3">
        <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Class teacher signature</div>
        <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Head teacher signature</div>
        <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">School stamp</div>
      </div>
    </div>
  );
}   // CommentSection

const TERM_OPTIONS = [
  { value: "1", label: "Term 1" },
  { value: "2", label: "Term 2" },
  { value: "3", label: "Term 3" },
];

function ReportCardPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const teacherEmail = user?.role === "teacher" ? user.email : undefined;
  const canEditHead = !!user && HEAD_COMMENT_ROLES.has(user.role);
  const qc = useQueryClient();
  const { studentId: initialStudentId } = Route.useSearch();
  const [selectedId, setSelectedId] = useState(initialStudentId || "");
  const [selectedTerm, setSelectedTerm] = useState(String(active.currentTerm ?? "1"));
  const term = selectedTerm;
  const year = String(active.currentYear ?? new Date().getFullYear());

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", active.id, teacherEmail],
    queryFn: () => api.students.list(active.id, teacherEmail),
    enabled: !!active.id,
  });

  const { data: termGradeHistory = [] } = useQuery({
    queryKey: ["term-grades", active.id, selectedId, year],
    queryFn: () => api.termGrades.history(active.id, selectedId, year),
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
      void qc.invalidateQueries({ queryKey: ["report-comment", active.id, selectedId, term, year] });
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
  const studentName = backendStudent ? `${backendStudent.firstName} ${backendStudent.lastName}` : "";
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
        complete: g.complete,
      })),
    [termGrades],
  );

  const totalMarks = subjects.reduce((s, x) => s + x.total, 0);
  const avg = subjects.length > 0 ? (totalMarks / subjects.length).toFixed(1) : "0";

  const displayStudents = (students as any[]).map((s: any) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName}`,
    grade: s.className || s.grade || "",
  }));

  return (
    <AccessGuard module="report-card">
      <div className="space-y-6">
      <PageHeader
        title="Student Report Card"
        description={`Term ${selectedTerm} · ${year}`}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()}><Download className="mr-1 h-4 w-4" />PDF</Button>
            <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Label className="text-sm">Student</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-64"><SelectValue placeholder={isLoading ? "Loading…" : "Select student"} /></SelectTrigger>
          <SelectContent>
            {displayStudents.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}{s.grade ? ` — ${s.grade}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-sm">Term</Label>
        <Select value={selectedTerm} onValueChange={setSelectedTerm}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TERM_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="print-area rounded-xl border border-border bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <SchoolDocumentHeader
          title="Academic Report Card"
          subtitle={`Term ${selectedTerm} · ${year}`}
        />

        <div className="grid grid-cols-2 gap-4 border-b border-border p-6 text-sm sm:grid-cols-4">
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">CA %</TableHead>
              <TableHead className="text-right">Midterm %</TableHead>
              <TableHead className="text-right">Exam %</TableHead>
              <TableHead className="text-right">Weighted total</TableHead>
              <TableHead className="text-right">Class avg</TableHead>
              <TableHead>Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {selectedId ? "No term grades computed for this student and term yet." : "Select a student to view their report card."}
                </TableCell>
              </TableRow>
            ) : subjects.map((s, i) => (
              <TableRow key={s.name} className={i % 2 === 1 ? "bg-muted/30" : undefined}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right tabular-nums">{s.ca ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{s.midterm ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{s.exam ?? "—"}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {s.total}{!s.complete && <span className="ml-1 text-xs font-normal text-muted-foreground">(provisional)</span>}
                </TableCell>
                <TableCell className="text-right">
                  <ClassAverageCell schoolId={active.id} classId={s.classId} subjectName={s.name} term={selectedTerm} academicYear={year} />
                </TableCell>
                <TableCell>
                  <Badge className={gradeBadgeClass(s.grade)}>{s.grade}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid grid-cols-1 gap-4 border-t border-border p-6 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs uppercase text-muted-foreground">Total marks</p>
            <p className="mt-1 text-xl font-semibold">{totalMarks} / {subjects.length * 100}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs uppercase text-muted-foreground">Average</p>
            <p className="mt-1 text-xl font-semibold">{avg}%</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs uppercase text-muted-foreground">Position in class</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Not available</p>
          </div>
        </div>

        {selectedId && (
          <CommentSection
            teacherComment={savedComment?.teacherComment ?? ""}
            headComment={savedComment?.headComment ?? ""}
            saving={commentMut.isPending}
            onSave={(teacherComment, headComment) => commentMut.mutate({ teacherComment, headComment })}
            canEditHead={canEditHead}
          />
        )}
      </div>
    </div>
    </AccessGuard>
  );
}
