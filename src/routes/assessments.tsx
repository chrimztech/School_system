import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, FileText, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
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
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/assessments")({
  head: () => ({ meta: [{ title: "Assessments — SRMS" }] }),
  component: AssessmentsPage,
});

const typeColor: Record<string, "secondary" | "outline" | "destructive"> = {
  exam: "destructive",
  cat: "secondary",
  project: "outline",
  homework: "outline",
};

const TYPES = ["cat", "exam", "project", "homework"] as const;
const TERMS = ["Term 1", "Term 2", "Term 3"] as const;
const SUBJECTS = ["Mathematics", "English Language", "Science", "Social Studies", "Civic Education", "Religious Education", "Physical Education", "French", "History", "Geography", "Biology", "Chemistry", "Physics", "Computer Studies", "Commerce", "Accounts", "Literature", "Art", "Music"];

function AssessmentsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", schoolId], queryFn: () => api.classes.list(schoolId) });
  const classList = (classesData as any[]).map((c: any) => c.name || c.className || c.id).filter(Boolean);

  const [open, setOpen] = useState(false);

  const firstClass = classList[0] as string | undefined;
  useEffect(() => {
    if (firstClass) setForm((prev) => prev.classId === "" ? { ...prev, classId: firstClass } : prev);
  }, [firstClass]);
  const [form, setForm] = useState({
    title: "", classId: "", type: "cat" as typeof TYPES[number],
    subject: SUBJECTS[0], teacherAssigned: "", term: "Term 1" as typeof TERMS[number],
    maxScore: "40", passMark: "20", weight: "10",
    date: new Date().toISOString().slice(0, 10), totalStudents: "32",
    rubricDescription: "", submissionMode: "Written",
    durationMinutes: "60", syllabusReference: "", gradingScheme: "Points",
    retakeAllowed: "no", markingCompletedBy: "",
  });

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["assessments", schoolId],
    queryFn: () => api.assessments.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.assessments.create(schoolId, data),
    onSuccess: (a: any) => {
      qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success(`Assessment "${a.title}" created`);
      setForm({ title: "", classId: "", type: "cat", subject: SUBJECTS[0], teacherAssigned: "", term: "Term 1", maxScore: "40", passMark: "20", weight: "10", date: new Date().toISOString().slice(0, 10), totalStudents: "32", rubricDescription: "", submissionMode: "Written", durationMinutes: "60", syllabusReference: "", gradingScheme: "Points", retakeAllowed: "no", markingCompletedBy: "" });
      setOpen(false);
    },
    onError: () => toast.error("Failed to create assessment"),
  });

  const addAssessment = () => {
    if (!form.title.trim()) { toast.error("Assessment title is required"); return; }
    createMutation.mutate({
      title: form.title, classId: form.classId, type: form.type,
      subject: form.subject, teacherAssigned: form.teacherAssigned.trim() || null,
      term: form.term, maxScore: Number(form.maxScore) || 40,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="CATs, homework, projects and exams · grading scale auto-applied per phase"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/report-card" search={{ studentId: "" }}><FileText className="mr-2 h-4 w-4" /> Report cards</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New assessment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>New assessment</DialogTitle></DialogHeader>
                <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Title *</Label>
                    <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mid-term Mathematics CAT" maxLength={100} />
                  </div>
                  <div>
                    <Label>Class</Label>
                    <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{classList.length === 0 ? <SelectItem value="__empty__" disabled>No classes yet</SelectItem> : classList.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof TYPES[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v as typeof TERMS[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" className="mt-1" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Teacher assigned</Label>
                    <Input className="mt-1" value={form.teacherAssigned} onChange={(e) => setForm({ ...form, teacherAssigned: e.target.value })} placeholder="Mr. Phiri" maxLength={80} />
                  </div>
                  <div>
                    <Label>Max score</Label>
                    <Input type="number" className="mt-1" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} min={1} />
                  </div>
                  <div>
                    <Label>Pass mark</Label>
                    <Input type="number" className="mt-1" value={form.passMark} onChange={(e) => setForm({ ...form, passMark: e.target.value })} min={0} />
                  </div>
                  <div>
                    <Label>Weight %</Label>
                    <Input type="number" className="mt-1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} min={1} max={100} />
                  </div>
                  <div>
                    <Label>Total pupils</Label>
                    <Input type="number" className="mt-1" value={form.totalStudents} onChange={(e) => setForm({ ...form, totalStudents: e.target.value })} min={1} />
                  </div>
                  <div>
                    <Label>Submission mode</Label>
                    <Select value={form.submissionMode} onValueChange={(v) => setForm({ ...form, submissionMode: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Written", "Oral", "Practical", "Portfolio", "Online"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input type="number" className="mt-1" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} min={5} placeholder="60" />
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
                <TableHead>Max</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assessments as any[]).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{a.classId ?? a.class}</TableCell>
                  <TableCell><Badge variant={typeColor[a.type] ?? "outline"}>{a.type}</Badge></TableCell>
                  <TableCell>{a.maxScore}</TableCell>
                  <TableCell>{a.weight}%</TableCell>
                  <TableCell className="text-muted-foreground">{(a.date ?? "").slice(0, 10)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{a.submittedCount ?? a.submitted ?? 0}/{a.totalStudents ?? a.total ?? 0}</span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-accent" style={{ width: `${((a.submittedCount ?? a.submitted ?? 0) / Math.max(a.totalStudents ?? a.total ?? 1, 1)) * 100}%` }} />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(assessments as any[]).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No assessments created yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
