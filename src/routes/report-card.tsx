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

export const Route = createFileRoute("/report-card")({
  head: () => ({ meta: [{ title: "Report Card — SRMS" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    studentId: (search.studentId as string) || "",
  }),
  component: ReportCardPage,
});

type SubjectResult = { name: string; ca: number; exam: number; total: number; grade: string; remark: string };

function CommentSection({
  teacherComment, headComment, saving, onSave,
}: {
  teacherComment: string;
  headComment: string;
  saving: boolean;
  onSave: (tc: string, hc: string) => void;
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
          {!editingHc ? (
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
        {editingHc ? (
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
            className="mt-1 cursor-text rounded-md px-1 py-0.5 text-sm hover:bg-muted/50"
            onClick={() => setEditingHc(true)}
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

function deriveGrade(total: number): string {
  if (total >= 90) return "A+";
  if (total >= 80) return "A";
  if (total >= 70) return "B";
  if (total >= 60) return "C";
  if (total >= 50) return "D";
  return "F";
}

const CA_TYPES = new Set(["cat", "project", "homework", "quiz", "practical"]);

function ReportCardPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const teacherEmail = user?.role === "teacher" ? user.email : undefined;
  const qc = useQueryClient();
  const { studentId: initialStudentId } = Route.useSearch();
  const [selectedId, setSelectedId] = useState(initialStudentId || "");
  const term = String(active.currentTerm ?? "1");
  const year = String(active.currentYear ?? new Date().getFullYear());

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", active.id, teacherEmail],
    queryFn: () => api.students.list(active.id, teacherEmail),
    enabled: !!active.id,
  });

  const { data: allAssessments = [] } = useQuery({
    queryKey: ["assessments", active.id],
    queryFn: () => api.assessments.list(active.id),
    enabled: !!active.id,
  });

  const { data: studentResults = [] } = useQuery({
    queryKey: ["student-results", active.id, selectedId],
    queryFn: () => api.assessments.studentResults(active.id, selectedId),
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

  const subjects: SubjectResult[] = useMemo(() => {
    if (!(studentResults as any[]).length || !(allAssessments as any[]).length) return [];

    const assessmentMap = new Map((allAssessments as any[]).map((a: any) => [a.id, a]));
    const bySubject = new Map<string, { ca: number; caMax: number; exam: number; examMax: number; grade: string; remark: string }>();

    for (const result of studentResults as any[]) {
      if (result.absent) continue;
      const assessment = assessmentMap.get(result.assessmentId);
      if (!assessment?.subjectName) continue;

      const subj: string = assessment.subjectName;
      if (!bySubject.has(subj)) {
        bySubject.set(subj, { ca: 0, caMax: 0, exam: 0, examMax: 0, grade: result.grade || "", remark: result.remarks || "" });
      }
      const entry = bySubject.get(subj)!;

      if (assessment.type === "exam") {
        entry.exam += result.score;
        entry.examMax += assessment.maxScore || 60;
      } else if (CA_TYPES.has(assessment.type)) {
        entry.ca += result.score;
        entry.caMax += assessment.maxScore || 40;
      }
      if (result.grade) entry.grade = result.grade;
      if (result.remarks) entry.remark = result.remarks;
    }

    return Array.from(bySubject.entries()).map(([name, { ca, caMax, exam, examMax, grade: g, remark }]) => {
      const caScaled = caMax > 0 ? Math.min(Math.round((ca / caMax) * 40), 40) : 0;
      const examScaled = examMax > 0 ? Math.min(Math.round((exam / examMax) * 60), 60) : 0;
      const total = caScaled + examScaled;
      return {
        name,
        ca: caScaled,
        exam: examScaled,
        total,
        grade: g || deriveGrade(total),
        remark,
      };
    });
  }, [studentResults, allAssessments]);

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
        description={`Term ${active.currentTerm} · ${active.currentYear}`}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("PDF downloaded")}><Download className="mr-1 h-4 w-4" />PDF</Button>
            <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
          </>
        }
      />

      <div className="flex items-center gap-3">
        <Label className="text-sm">Student</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-64"><SelectValue placeholder={isLoading ? "Loading…" : "Select student"} /></SelectTrigger>
          <SelectContent>
            {displayStudents.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}{s.grade ? ` — ${s.grade}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <SchoolDocumentHeader
          title="Academic Report Card"
          subtitle={`Term ${active.currentTerm} · ${active.currentYear}`}
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
              <TableHead className="text-right">CA (40)</TableHead>
              <TableHead className="text-right">Exam (60)</TableHead>
              <TableHead className="text-right">Total (100)</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Teacher remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {selectedId ? "No assessment results recorded for this student yet." : "Select a student to view their report card."}
                </TableCell>
              </TableRow>
            ) : subjects.map((s) => (
              <TableRow key={s.name}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right tabular-nums">{s.ca}</TableCell>
                <TableCell className="text-right tabular-nums">{s.exam}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{s.total}</TableCell>
                <TableCell>
                  <Badge variant={s.grade.startsWith("A") ? "default" : "secondary"}>{s.grade}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.remark || "—"}</TableCell>
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
            <p className="mt-1 text-xl font-semibold">—</p>
          </div>
        </div>

        {selectedId && (
          <CommentSection
            teacherComment={savedComment?.teacherComment ?? ""}
            headComment={savedComment?.headComment ?? ""}
            saving={commentMut.isPending}
            onSave={(teacherComment, headComment) => commentMut.mutate({ teacherComment, headComment })}
          />
        )}
      </div>
    </div>
    </AccessGuard>
  );
}
