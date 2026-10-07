import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, FileDown, Loader2, Plus, Printer, Sparkles, Trash2, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField } from "@mui/material";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";
import { SchoolDocumentHeader } from "@/components/school-document-header";
import { buildLessonDocxBlob, buildSchemeDocxBlob, downloadBlob } from "@/lib/curriculum-documents";

export const Route = createFileRoute("/curriculum-planning")({
  head: () => ({ meta: [{ title: "Schemes & Lesson Plans - SRMS" }] }),
  component: CurriculumPlanningPage,
});

const REVIEWER_ROLES = new Set(["super_admin", "school_admin", "principal", "deputy_head", "hod"]);
const AUTHOR_ROLES = new Set([...REVIEWER_ROLES, "teacher"]);
const TERMS = ["1", "2", "3"];

function fmtSize(bytes?: number | null) {
  if (!bytes) return "—";
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`;
}

function statusChip(status: string) {
  const tone: Record<string, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
    APPROVED: "success", FINAL: "success", SUBMITTED: "warning", REJECTED: "destructive", DRAFT: "outline",
  };
  return <Chip size="small" label={status.charAt(0) + status.slice(1).toLowerCase()} sx={badgeSx(tone[status] ?? "outline")} />;
}

function CurriculumPlanningPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const schoolId = active.id;
  const role = user?.role ?? "";
  const canAuthor = AUTHOR_ROLES.has(role);
  const canReview = REVIEWER_ROLES.has(role);
  const [tab, setTab] = useState(0);

  if (!canAuthor) {
    return (
      <div className="space-y-6">
        <PageHeader title="Schemes & Lesson Plans" description="Available to teaching and leadership staff." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schemes & Lesson Plans"
        description="Upload each subject's syllabus, plan the term week by week as a scheme of work, and generate lesson plans from approved schemes."
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
        <Tab label="Syllabus & topics" />
        <Tab label="Schemes of work" />
        <Tab label="Lesson plans" />
      </Tabs>
      {tab === 0 && <SyllabusTab schoolId={schoolId} canManage={canReview} />}
      {tab === 1 && <SchemesTab schoolId={schoolId} canReview={canReview} role={role} userId={user?.id ?? ""} userEmail={user?.email ?? ""} userName={user?.name ?? ""} />}
      {tab === 2 && <LessonPlansTab schoolId={schoolId} role={role} userId={user?.id ?? ""} userEmail={user?.email ?? ""} userName={user?.name ?? ""} />}
    </div>
  );
}

// MUI's Select clones each direct JSX child to wire up selection, so the options must be a flat
// array of <MenuItem> elements inline in the TextField — a wrapper component as the child (as
// this used to be) swallows the props MUI injects and the menu becomes unclickable.
function useSubjectNames(schoolId: string): string[] {
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects", schoolId], queryFn: () => api.subjects.list(schoolId), enabled: !!schoolId });
  return (subjects as any[]).map((s) => s.name ?? s.subjectName);
}

// Shared by every list/dialog that needs to resolve a class's name for display or filtering.
// Teachers get back only their own classes (same scoping Assessments uses); everyone else gets
// the full roster.
function useClasses(schoolId: string, isTeacher: boolean, teacherEmail: string) {
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-for-curriculum", schoolId, isTeacher ? teacherEmail : ""],
    queryFn: () => api.classes.list(schoolId, isTeacher ? teacherEmail : undefined),
    enabled: !!schoolId,
  });
  return classes as any[];
}

// A plain teacher is restricted to the class/subject combinations they're personally assigned
// to teach (TeacherClassSubject) — the backend enforces this on every write; this mirrors it in
// the UI so a teacher only ever sees choices that will actually be accepted.
function useTeacherAssignments(schoolId: string, isTeacher: boolean, teacherEmail: string) {
  const { data: assignments = [] } = useQuery({
    queryKey: ["teacher-assignments", schoolId, teacherEmail],
    queryFn: () => api.classes.assignments(schoolId, teacherEmail),
    enabled: isTeacher && !!teacherEmail,
  });
  return assignments as any[];
}

// ---------------------------------------------------------------- Printable documents

function DocumentPreviewDialog({ open, onClose, title, onDownloadWord, children }: {
  open: boolean; onClose: () => void; title: string; onDownloadWord: () => void; children: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="print:hidden">{title}</DialogTitle>
      <DialogContent>
        <div className="print-area overflow-hidden rounded-xl border border-border bg-card print:rounded-none print:border-0">
          {children}
        </div>
      </DialogContent>
      <DialogActions className="print:hidden">
        <Button color="inherit" onClick={onClose}>Close</Button>
        <Button variant="outlined" startIcon={<FileDown className="h-4 w-4" />} onClick={onDownloadWord}>Download Word</Button>
        <Button variant="contained" startIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Save as PDF</Button>
      </DialogActions>
    </Dialog>
  );
}

function SchemePrintView({ scheme, weeks, authorName }: { scheme: any; weeks: any[]; authorName: string }) {
  return (
    <div>
      <SchoolDocumentHeader title="Scheme of Work" subtitle={`${scheme.subjectName} · ${scheme.className} · Term ${scheme.term} ${scheme.academicYear}`} />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><span className="font-semibold">Prepared by:</span> {authorName || "—"}</p>
          <p><span className="font-semibold">Status:</span> {scheme.status}</p>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border p-2 text-left">Wk</th>
              <th className="border border-border p-2 text-left">Topic &amp; Content</th>
              <th className="border border-border p-2 text-left">Objectives</th>
              <th className="border border-border p-2 text-left">T/L Activities</th>
              <th className="border border-border p-2 text-left">T/L Resources</th>
              <th className="border border-border p-2 text-left">Evaluation</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.id}>
                <td className="border border-border p-2 align-top">{w.weekNumber}</td>
                <td className="border border-border p-2 align-top">{[w.topic, w.subTopics].filter(Boolean).join(" — ")}</td>
                <td className="border border-border p-2 align-top">{w.objectives || "—"}</td>
                <td className="border border-border p-2 align-top">{w.activities || "—"}</td>
                <td className="border border-border p-2 align-top">{w.resources || "—"}</td>
                <td className="border border-border p-2 align-top">{w.assessment || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const LESSON_PRINT_SECTIONS: [string, string][] = [
  ["Previous Knowledge", "previousKnowledge"],
  ["Objectives", "objectives"],
  ["Teaching / Learning Materials", "materials"],
  ["Introduction", "introduction"],
  ["Development", "development"],
  ["Conclusion", "conclusion"],
  ["Evaluation", "evaluation"],
  ["Homework / Follow-up Work", "homework"],
  ["Teacher's Remarks", "teacherRemarks"],
];

function LessonPrintView({ plan, className, authorName }: { plan: any; className: string; authorName: string }) {
  return (
    <div>
      <SchoolDocumentHeader title="Lesson Plan" subtitle={`${plan.subjectName} · ${plan.lessonDate ?? ""}`} />
      <div className="space-y-3 p-6 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <p><span className="font-semibold">Class:</span> {className || "—"}</p>
          <p><span className="font-semibold">Date:</span> {plan.lessonDate || "—"}</p>
          <p><span className="font-semibold">Duration:</span> {plan.durationMinutes} minutes</p>
          <p><span className="font-semibold">Teacher:</span> {authorName || "—"}</p>
        </div>
        <p><span className="font-semibold">Topic:</span> {plan.topic}</p>
        {LESSON_PRINT_SECTIONS.map(([label, key]) => (
          <div key={key}>
            <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
            <p className="whitespace-pre-wrap">{plan[key] || "—"}</p>
          </div>
        ))}
        <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-muted-foreground">
          <p>Teacher's signature: ___________________ &nbsp; Date: _______</p>
          <p>HOD/Head's signature: ___________________ &nbsp; Date: _______</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Syllabus & topics

function SyllabusTab({ schoolId, canManage }: { schoolId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const subjectNames = useSubjectNames(schoolId);
  const year = String(new Date().getFullYear());
  const [subjectName, setSubjectName] = useState("");
  const [grade, setGrade] = useState("1");
  const [academicYear, setAcademicYear] = useState(year);
  const [file, setFile] = useState<File | null>(null);
  const [term, setTerm] = useState("1");
  const [topicRows, setTopicRows] = useState<any[]>([]);
  const [topicsLoadedKey, setTopicsLoadedKey] = useState("");

  const { data: documents = [] } = useQuery({ queryKey: ["curriculum-docs", schoolId], queryFn: () => api.curriculum.documents(schoolId) });

  const topicKey = `${subjectName}|${grade}|${term}`;
  const { data: savedTopics = [], isFetching: topicsLoading } = useQuery({
    queryKey: ["curriculum-topics", schoolId, subjectName, grade, term],
    queryFn: () => api.curriculum.topics(schoolId, subjectName, Number(grade), term),
    enabled: !!subjectName,
  });
  if (subjectName && topicsLoadedKey !== topicKey && !topicsLoading) {
    setTopicRows((savedTopics as any[]).map((t) => ({ ...t })));
    setTopicsLoadedKey(topicKey);
  }

  const uploadMut = useMutation({
    mutationFn: () => api.curriculum.uploadDocument(schoolId, { subjectName, grade: Number(grade), academicYear, file: file as File }),
    onSuccess: (doc: any) => {
      toast.success(`Syllabus uploaded as version ${doc.version}`);
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["curriculum-docs", schoolId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Upload failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.curriculum.deleteDocument(schoolId, id),
    onSuccess: () => { toast.success("Syllabus file removed"); void qc.invalidateQueries({ queryKey: ["curriculum-docs", schoolId] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not remove file"),
  });

  const saveTopicsMut = useMutation({
    mutationFn: () => api.curriculum.saveTopics(schoolId, {
      subjectName, grade: Number(grade), term,
      topics: topicRows.filter((r) => r.topic?.trim()).map((r) => ({
        topic: r.topic, subTopics: r.subTopics, objectives: r.objectives,
        activities: r.activities, resources: r.resources, assessment: r.assessment,
      })),
    }),
    onSuccess: (rows: any[]) => {
      toast.success(`${rows.length} topic${rows.length === 1 ? "" : "s"} saved`);
      setTopicRows(rows);
      void qc.invalidateQueries({ queryKey: ["curriculum-topics", schoolId, subjectName, grade, term] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not save topics"),
  });

  const updateRow = (i: number, key: string, value: string) =>
    setTopicRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  return (
    <div className="space-y-6">
      {canManage && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">1. Upload a syllabus</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <TextField select label="Subject" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} size="small">
              {subjectNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            <TextField label="Grade" type="number" value={grade} onChange={(e) => setGrade(e.target.value)} size="small" slotProps={{ htmlInput: { min: 1, max: 12 } }} />
            <TextField label="Academic year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} size="small" />
            <div className="flex items-center gap-2">
              <Button component="label" variant="outlined" size="small" startIcon={<Upload className="h-4 w-4" />}>
                {file ? file.name : "Choose file"}
                <input hidden type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">PDF, Word or text, up to 10 MB. Uploading a new file for the same subject, grade and year creates a new version.</p>
            <Button variant="contained" disabled={!subjectName || !file || uploadMut.isPending} onClick={() => uploadMut.mutate()}
              startIcon={uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
              Upload
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Syllabus files</p>
        </div>
        {(documents as any[]).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No syllabus files uploaded yet.</p>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Subject</TableCell><TableCell>Grade</TableCell><TableCell>Year</TableCell><TableCell>Version</TableCell><TableCell>File</TableCell><TableCell>Size</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {(documents as any[]).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.subjectName}</TableCell>
                    <TableCell>{d.grade}</TableCell>
                    <TableCell>{d.academicYear}</TableCell>
                    <TableCell>v{d.version}</TableCell>
                    <TableCell>{d.fileName}</TableCell>
                    <TableCell>{fmtSize(d.sizeBytes)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Download" onClick={() => void api.curriculum.downloadDocument(schoolId, d.id, d.fileName).catch(() => toast.error("Download failed"))}>
                        <Download className="h-4 w-4" />
                      </IconButton>
                      {canManage && (
                        <IconButton size="small" aria-label="Remove" onClick={() => { if (window.confirm(`Remove ${d.fileName}?`)) deleteMut.mutate(d.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-sm font-semibold">{canManage ? "2." : ""} Topics for a term</h2>
          <TextField select label="Subject" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} size="small" sx={{ minWidth: 180 }}>
            {subjectNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
          </TextField>
          <TextField label="Grade" type="number" value={grade} onChange={(e) => setGrade(e.target.value)} size="small" sx={{ width: 90 }} />
          <TextField select label="Term" value={term} onChange={(e) => setTerm(e.target.value)} size="small" sx={{ width: 110 }}>
            {TERMS.map((t) => <MenuItem key={t} value={t}>Term {t}</MenuItem>)}
          </TextField>
        </div>
        {!subjectName ? (
          <p className="text-sm text-muted-foreground">Choose a subject to see or enter its topics.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Topics are taught in order. Each one becomes a week when you populate a scheme of work.
            </p>
            <div className="space-y-3">
              {topicRows.map((row, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-12">
                  <span className="text-xs font-semibold text-muted-foreground md:col-span-12">Topic {i + 1}</span>
                  <TextField className="md:col-span-4" label="Topic" size="small" value={row.topic ?? ""} disabled={!canManage} onChange={(e) => updateRow(i, "topic", e.target.value)} />
                  <TextField className="md:col-span-4" label="Sub-topics" size="small" value={row.subTopics ?? ""} disabled={!canManage} onChange={(e) => updateRow(i, "subTopics", e.target.value)} />
                  <TextField className="md:col-span-4" label="Objectives" size="small" value={row.objectives ?? ""} disabled={!canManage} onChange={(e) => updateRow(i, "objectives", e.target.value)} />
                  <TextField className="md:col-span-4" label="Activities" size="small" value={row.activities ?? ""} disabled={!canManage} onChange={(e) => updateRow(i, "activities", e.target.value)} />
                  <TextField className="md:col-span-4" label="Resources" size="small" value={row.resources ?? ""} disabled={!canManage} onChange={(e) => updateRow(i, "resources", e.target.value)} />
                  <TextField className="md:col-span-4" label="Assessment" size="small" value={row.assessment ?? ""} disabled={!canManage} onChange={(e) => updateRow(i, "assessment", e.target.value)} />
                  {canManage && (
                    <div className="md:col-span-12 flex justify-end">
                      <Button size="small" color="inherit" onClick={() => setTopicRows((rows) => rows.filter((_, idx) => idx !== i))}>Remove topic</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2">
              {canManage ? (
                <Button size="small" startIcon={<Plus className="h-4 w-4" />} onClick={() => setTopicRows((rows) => [...rows, { topic: "" }])}>Add topic</Button>
              ) : <span />}
              {canManage && (
                <Button variant="contained" disabled={saveTopicsMut.isPending} onClick={() => saveTopicsMut.mutate()}>
                  {saveTopicsMut.isPending ? "Saving…" : "Save topics"}
                </Button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Schemes of work

function SchemesTab({ schoolId, canReview, role, userId, userEmail, userName }: { schoolId: string; canReview: boolean; role: string; userId: string; userEmail: string; userName: string }) {
  const qc = useQueryClient();
  const subjectNames = useSubjectNames(schoolId);
  const isTeacher = role === "teacher";
  const classes = useClasses(schoolId, isTeacher, userEmail);
  const teacherAssignments = useTeacherAssignments(schoolId, isTeacher, userEmail);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [printId, setPrintId] = useState<string | null>(null);
  const [form, setForm] = useState({ classId: "", subjectName: "", term: "1", academicYear: String(new Date().getFullYear()) });
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: schemes = [] } = useQuery({ queryKey: ["schemes", schoolId], queryFn: () => api.curriculum.schemes(schoolId) });
  const filteredSchemes = (schemes as any[]).filter((s) =>
    (!filterClass || s.className === filterClass) && (!filterSubject || s.subjectName === filterSubject) && (!filterStatus || s.status === filterStatus));

  // A teacher may only create a scheme for a class/subject they're personally assigned to teach
  // (the backend enforces this; this just keeps the form from offering a choice it would reject).
  // Matched on classId, not className: an assignment's className is only ever populated when
  // whoever created it happened to send one, while classId is always set server-side.
  const subjectOptionsForClass = (classId: string): string[] => {
    if (!isTeacher) return subjectNames;
    return Array.from(new Set(teacherAssignments.filter((a) => !classId || a.classId === classId).map((a) => a.subjectName).filter(Boolean)));
  };

  const createMut = useMutation({
    mutationFn: () => api.curriculum.createScheme(schoolId, form),
    onSuccess: (s: any) => {
      toast.success("Scheme created — add the weeks next");
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ["schemes", schoolId] });
      setOpenId(s.id);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not create scheme"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TextField select label="Class" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} size="small" sx={{ minWidth: 140 }}>
          <MenuItem value="">All classes</MenuItem>
          {(classes as any[]).map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
        </TextField>
        <TextField select label="Subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} size="small" sx={{ minWidth: 160 }}>
          <MenuItem value="">All subjects</MenuItem>
          {subjectNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
        <TextField select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} size="small" sx={{ minWidth: 140 }}>
          <MenuItem value="">All statuses</MenuItem>
          {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((s) => <MenuItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</MenuItem>)}
        </TextField>
        <Button variant="contained" className="ml-auto" startIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm({ classId: "", subjectName: "", term: "1", academicYear: String(new Date().getFullYear()) }); setCreateOpen(true); }}>
          New scheme of work
        </Button>
      </div>
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {filteredSchemes.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {(schemes as any[]).length === 0 ? "No schemes of work yet. Create one for a class, subject and term." : "No schemes match these filters."}
          </p>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Class</TableCell><TableCell>Subject</TableCell><TableCell>Term</TableCell><TableCell>Year</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {filteredSchemes.map((s) => (
                  <TableRow key={s.id} hover sx={{ cursor: "pointer" }}>
                    <TableCell onClick={() => setOpenId(s.id)}>{s.className}</TableCell>
                    <TableCell onClick={() => setOpenId(s.id)}>{s.subjectName}</TableCell>
                    <TableCell onClick={() => setOpenId(s.id)}>Term {s.term}</TableCell>
                    <TableCell onClick={() => setOpenId(s.id)}>{s.academicYear}</TableCell>
                    <TableCell onClick={() => setOpenId(s.id)}>{statusChip(s.status)}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      {s.status === "APPROVED" && (
                        <IconButton size="small" aria-label="Download" onClick={() => setPrintId(s.id)}>
                          <Download className="h-4 w-4" />
                        </IconButton>
                      )}
                      <Button size="small" onClick={() => setOpenId(s.id)}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New scheme of work</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-2">
            <TextField select label="Class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, subjectName: "" })} size="small" fullWidth>
              {(classes as any[]).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Subject" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} size="small" fullWidth disabled={isTeacher && !form.classId}>
              {subjectOptionsForClass(form.classId).map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            {isTeacher && form.classId && subjectOptionsForClass(form.classId).length === 0 && (
              <p className="text-xs text-destructive">You aren't assigned to teach any subject for this class yet — ask a school admin to add the assignment.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <TextField select label="Term" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} size="small">
                {TERMS.map((t) => <MenuItem key={t} value={t}>Term {t}</MenuItem>)}
              </TextField>
              <TextField label="Academic year" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} size="small" />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.classId || !form.subjectName || createMut.isPending} onClick={() => createMut.mutate()}>Create</Button>
        </DialogActions>
      </Dialog>

      {openId && (
        <SchemeEditor schoolId={schoolId} schemeId={openId} canReview={canReview} userId={userId} userName={userName} onClose={() => setOpenId(null)} />
      )}
      {printId && (
        <SchemePrintDialog schoolId={schoolId} schemeId={printId} userId={userId} userName={userName} onClose={() => setPrintId(null)} />
      )}
    </div>
  );
}

function SchemePrintDialog({ schoolId, schemeId, userId, userName, onClose }: { schoolId: string; schemeId: string; userId: string; userName: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["scheme", schoolId, schemeId], queryFn: () => api.curriculum.scheme(schoolId, schemeId) });
  const { active } = useTenant();
  const scheme = data?.scheme as any;
  const weeks = (data?.weeks as any[]) ?? [];
  const authorName = scheme?.createdBy === userId ? userName : "";

  return (
    <DocumentPreviewDialog
      open onClose={onClose}
      title={scheme ? `${scheme.subjectName} · ${scheme.className}` : "Scheme of work"}
      onDownloadWord={async () => {
        const blob = await buildSchemeDocxBlob({
          schoolName: active.name, authorName, subjectName: scheme.subjectName, className: scheme.className,
          term: scheme.term, academicYear: scheme.academicYear, status: scheme.status, weeks,
        });
        downloadBlob(blob, `Scheme of Work - ${scheme.subjectName} - ${scheme.className}.docx`);
      }}
    >
      {!scheme ? <div className="p-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : <SchemePrintView scheme={scheme} weeks={weeks} authorName={authorName} />}
    </DocumentPreviewDialog>
  );
}

const EMPTY_WEEK = { topic: "", subTopics: "", objectives: "", activities: "", resources: "", assessment: "", remarks: "" };

function SchemeEditor({ schoolId, schemeId, canReview, userId, userName, onClose }: { schoolId: string; schemeId: string; canReview: boolean; userId: string; userName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({ queryKey: ["scheme", schoolId, schemeId], queryFn: () => api.curriculum.scheme(schoolId, schemeId) });
  const scheme = data?.scheme as any;
  const [weeks, setWeeks] = useState<any[] | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const rows = weeks ?? (data?.weeks as any[]) ?? [];
  const editable = !!scheme && (scheme.status === "DRAFT" || scheme.status === "REJECTED");
  const isAuthor = scheme?.createdBy === userId;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["schemes", schoolId] });
    void qc.invalidateQueries({ queryKey: ["scheme", schoolId, schemeId] });
    setWeeks(null);
    void refetch();
  };
  const onErr = (e: any) => toast.error(e?.response?.data?.message ?? "Something went wrong");

  const saveMut = useMutation({ mutationFn: () => api.curriculum.saveWeeks(schoolId, schemeId, rows), onSuccess: () => { toast.success("Weeks saved"); invalidate(); }, onError: onErr });
  const populateMut = useMutation({ mutationFn: () => api.curriculum.populateScheme(schoolId, schemeId), onSuccess: () => { toast.success("Weeks filled from the syllabus topics"); invalidate(); }, onError: onErr });
  const submitMut = useMutation({ mutationFn: () => api.curriculum.submitScheme(schoolId, schemeId), onSuccess: () => { toast.success("Submitted for review"); invalidate(); }, onError: onErr });
  const reviewMut = useMutation({
    mutationFn: (approve: boolean) => api.curriculum.reviewScheme(schoolId, schemeId, { approve, note: reviewNote }),
    onSuccess: (_d, approve) => { toast.success(approve ? "Scheme approved" : "Returned to the teacher"); setReviewNote(""); invalidate(); },
    onError: onErr,
  });

  const setCell = (i: number, key: string, value: string) => setWeeks(rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {scheme ? `${scheme.subjectName} · ${scheme.className} · Term ${scheme.term} ${scheme.academicYear}` : "Scheme of work"}
      </DialogTitle>
      <DialogContent>
        {!scheme ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {statusChip(scheme.status)}
              <span className="text-muted-foreground">Written by {scheme.createdBy}</span>
              {scheme.reviewedBy && <span className="text-muted-foreground">· Reviewed by {scheme.reviewedBy}</span>}
              {scheme.status === "APPROVED" && (
                <Button size="small" className="ml-auto" startIcon={<Download className="h-3.5 w-3.5" />} onClick={() => setPrintOpen(true)}>
                  Download
                </Button>
              )}
            </div>
            {scheme.reviewNote && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <p className="font-semibold">Review note</p>
                <p className="text-muted-foreground">{scheme.reviewNote}</p>
              </div>
            )}

            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Week</TableCell><TableCell>Topic</TableCell><TableCell>Sub-topics</TableCell><TableCell>Objectives</TableCell><TableCell>Activities</TableCell><TableCell>Resources</TableCell><TableCell>Assessment</TableCell></TableRow></TableHead>
                <TableBody>
                  {rows.map((w, i) => (
                    <TableRow key={w.id ?? i}>
                      <TableCell>{w.weekNumber ?? i + 1}</TableCell>
                      {(["topic", "subTopics", "objectives", "activities", "resources", "assessment"] as const).map((k) => (
                        <TableCell key={k} sx={{ minWidth: 150 }}>
                          <TextField variant="standard" fullWidth multiline value={w[k] ?? ""} disabled={!editable || !isAuthor}
                            onChange={(e) => setCell(i, k, e.target.value)} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No weeks yet. {editable && isAuthor ? "Fill them from the syllabus topics or add them by hand." : ""}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
              <div className="flex gap-2">
                {editable && isAuthor && (
                  <>
                    <Button variant="outlined" size="small" startIcon={<Sparkles className="h-4 w-4" />} disabled={populateMut.isPending} onClick={() => populateMut.mutate()}>Fill from syllabus topics</Button>
                    <Button variant="outlined" size="small" startIcon={<Plus className="h-4 w-4" />} onClick={() => setWeeks([...rows, { ...EMPTY_WEEK, weekNumber: rows.length + 1 }])}>Add week</Button>
                    {weeks && <Button variant="contained" size="small" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>Save weeks</Button>}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {editable && isAuthor && (
                  <Button variant="contained" color="primary" disabled={submitMut.isPending || weeks !== null || rows.length === 0} onClick={() => submitMut.mutate()}>
                    Submit for review
                  </Button>
                )}
              </div>
            </div>

            {canReview && scheme.status === "SUBMITTED" && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-semibold">Review this scheme</p>
                <TextField label="Note to the teacher (required to return it)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} size="small" fullWidth multiline minRows={2} />
                <div className="flex justify-end gap-2">
                  <Button color="warning" variant="outlined" disabled={reviewMut.isPending || !reviewNote.trim()} onClick={() => reviewMut.mutate(false)}>Return to teacher</Button>
                  <Button variant="contained" color="success" disabled={reviewMut.isPending} onClick={() => reviewMut.mutate(true)}>Approve</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Close</Button>
      </DialogActions>
      {printOpen && (
        <SchemePrintDialog schoolId={schoolId} schemeId={schemeId} userId={userId} userName={userName} onClose={() => setPrintOpen(false)} />
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- Lesson plans

const LESSON_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "topic", label: "Topic" },
  { key: "previousKnowledge", label: "Previous knowledge", multiline: true },
  { key: "objectives", label: "Objectives", multiline: true },
  { key: "materials", label: "Materials", multiline: true },
  { key: "introduction", label: "Introduction", multiline: true },
  { key: "development", label: "Development (teacher and learner activities)", multiline: true },
  { key: "conclusion", label: "Conclusion", multiline: true },
  { key: "evaluation", label: "Evaluation", multiline: true },
  { key: "homework", label: "Homework", multiline: true },
  { key: "teacherRemarks", label: "Teacher's remarks (after the lesson)", multiline: true },
];

function LessonPlansTab({ schoolId, role, userId, userEmail, userName }: { schoolId: string; role: string; userId: string; userEmail: string; userName: string }) {
  const qc = useQueryClient();
  const isTeacher = role === "teacher";
  const classes = useClasses(schoolId, isTeacher, userEmail);
  const subjectNames = useSubjectNames(schoolId);
  const classNameById = useMemo(() => Object.fromEntries((classes as any[]).map((c) => [c.id, c.name])), [classes]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [printing, setPrinting] = useState<any | null>(null);
  const [filterClass, setFilterClass] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const { data: plans = [] } = useQuery({ queryKey: ["lesson-plans", schoolId], queryFn: () => api.curriculum.lessonPlans(schoolId) });
  const { data: schemes = [] } = useQuery({ queryKey: ["schemes", schoolId], queryFn: () => api.curriculum.schemes(schoolId) });
  const { data: configs = [] } = useQuery({ queryKey: ["integration-configs", schoolId], queryFn: () => api.integrationConfigs.listForSchool(schoolId) });
  const aiConnected = (configs as any[]).some((c) => c.providerCode === "llm" && c.enabled);
  const approved = useMemo(() => (schemes as any[]).filter((s) => s.status === "APPROVED"), [schemes]);
  const filteredPlans = (plans as any[]).filter((p) =>
    (!filterClass || classNameById[p.classId] === filterClass) && (!filterSubject || p.subjectName === filterSubject));

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.curriculum.deleteLessonPlan(schoolId, id),
    onSuccess: () => { toast.success("Lesson plan deleted"); void qc.invalidateQueries({ queryKey: ["lesson-plans", schoolId] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not delete"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TextField select label="Class" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} size="small" sx={{ minWidth: 140 }}>
          <MenuItem value="">All classes</MenuItem>
          {(classes as any[]).map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
        </TextField>
        <TextField select label="Subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} size="small" sx={{ minWidth: 160 }}>
          <MenuItem value="">All subjects</MenuItem>
          {subjectNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
        <Button variant="contained" className="ml-auto" startIcon={<Sparkles className="h-4 w-4" />} onClick={() => setGenerateOpen(true)} disabled={approved.length === 0}>
          Generate lesson plan
        </Button>
      </div>
      {approved.length === 0 && (
        <p className="text-sm text-muted-foreground">Lesson plans are generated from an approved scheme of work. Once a scheme is approved it appears here.</p>
      )}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {filteredPlans.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{(plans as any[]).length === 0 ? "No lesson plans yet." : "No lesson plans match these filters."}</p>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Class</TableCell><TableCell>Subject</TableCell><TableCell>Topic</TableCell><TableCell>Source</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {filteredPlans.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.lessonDate ?? "—"}</TableCell>
                    <TableCell>{classNameById[p.classId] ?? "—"}</TableCell>
                    <TableCell>{p.subjectName}</TableCell>
                    <TableCell>{p.topic}</TableCell>
                    <TableCell><Chip size="small" label={p.source === "AI" ? "AI draft" : p.source === "TEMPLATE" ? "Template" : "Manual"} sx={badgeSx("outline")} /></TableCell>
                    <TableCell>{statusChip(p.status)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" aria-label="Download" onClick={() => setPrinting(p)}>
                        <Download className="h-4 w-4" />
                      </IconButton>
                      <Button size="small" onClick={() => setEditing(p)}>Open</Button>
                      <IconButton size="small" aria-label="Delete" onClick={() => { if (window.confirm("Delete this lesson plan?")) deleteMut.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>

      {generateOpen && (
        <GenerateDialog schoolId={schoolId} approved={approved} aiConnected={aiConnected} onClose={() => setGenerateOpen(false)}
          onCreated={(plan) => { setGenerateOpen(false); void qc.invalidateQueries({ queryKey: ["lesson-plans", schoolId] }); setEditing(plan); }} />
      )}
      {editing && <LessonEditor schoolId={schoolId} plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void qc.invalidateQueries({ queryKey: ["lesson-plans", schoolId] }); }} />}
      {printing && (
        <LessonPrintDialog plan={printing} className={classNameById[printing.classId] ?? ""} userId={userId} userName={userName} onClose={() => setPrinting(null)} />
      )}
    </div>
  );
}

function LessonPrintDialog({ plan, className, userId, userName, onClose }: { plan: any; className: string; userId: string; userName: string; onClose: () => void }) {
  const { active } = useTenant();
  const authorName = plan.createdBy === userId ? userName : "";
  return (
    <DocumentPreviewDialog
      open onClose={onClose}
      title={`${plan.subjectName} · ${plan.topic}`}
      onDownloadWord={async () => {
        const blob = await buildLessonDocxBlob({
          schoolName: active.name, authorName, subjectName: plan.subjectName, className,
          lessonDate: plan.lessonDate ?? "", durationMinutes: plan.durationMinutes ?? 40, topic: plan.topic,
          previousKnowledge: plan.previousKnowledge, objectives: plan.objectives, materials: plan.materials,
          introduction: plan.introduction, development: plan.development, conclusion: plan.conclusion,
          evaluation: plan.evaluation, homework: plan.homework, teacherRemarks: plan.teacherRemarks,
        });
        downloadBlob(blob, `Lesson Plan - ${plan.subjectName} - ${plan.lessonDate ?? ""}.docx`);
      }}
    >
      <LessonPrintView plan={plan} className={className} authorName={authorName} />
    </DocumentPreviewDialog>
  );
}

function GenerateDialog({ schoolId, approved, aiConnected, onClose, onCreated }: { schoolId: string; approved: any[]; aiConnected: boolean; onClose: () => void; onCreated: (plan: any) => void }) {
  const [schemeId, setSchemeId] = useState(approved[0]?.id ?? "");
  const [weekId, setWeekId] = useState("");
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState("40");
  const [mode, setMode] = useState<"TEMPLATE" | "AI">("TEMPLATE");

  const { data: weeks = [] } = useQuery({
    queryKey: ["scheme", schoolId, schemeId],
    queryFn: () => api.curriculum.scheme(schoolId, schemeId),
    enabled: !!schemeId,
  });
  const weekRows = ((weeks as any)?.weeks ?? []) as any[];

  const generateMut = useMutation({
    mutationFn: () => api.curriculum.generateLessonPlan(schoolId, { schemeId, schemeWeekId: weekId, lessonDate, durationMinutes: Number(duration), mode }),
    onSuccess: (plan: any) => { toast.success(mode === "AI" ? "AI draft ready — review it before marking final" : "Lesson plan created"); onCreated(plan); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not generate the lesson plan"),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generate lesson plan</DialogTitle>
      <DialogContent>
        <div className="grid gap-3 pt-2">
          <TextField select label="Scheme of work" value={schemeId} onChange={(e) => { setSchemeId(e.target.value); setWeekId(""); }} size="small" fullWidth>
            {approved.map((s) => <MenuItem key={s.id} value={s.id}>{s.className} · {s.subjectName} · Term {s.term}</MenuItem>)}
          </TextField>
          <TextField select label="Week" value={weekId} onChange={(e) => setWeekId(e.target.value)} size="small" fullWidth disabled={!schemeId}>
            {weekRows.map((w) => <MenuItem key={w.id} value={w.id}>Week {w.weekNumber}: {w.topic}</MenuItem>)}
          </TextField>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Lesson date" type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Duration (minutes)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} size="small" />
          </div>
          <TextField select label="How to draft it" value={mode} onChange={(e) => setMode(e.target.value as "TEMPLATE" | "AI")} size="small" fullWidth
            helperText={mode === "AI"
              ? (aiConnected ? "Drafted by your school's Anthropic account. Always review before using." : "Connect AI Lesson Drafting on the Integrations page first.")
              : "Fills the standard sections directly from the scheme week. No external service is used."}>
            <MenuItem value="TEMPLATE">Template (from the scheme)</MenuItem>
            <MenuItem value="AI" disabled={!aiConnected}>AI draft</MenuItem>
          </TextField>
        </div>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!weekId || generateMut.isPending} onClick={() => generateMut.mutate()}
          startIcon={generateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
          {mode === "AI" ? "Draft with AI" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LessonEditor({ schoolId, plan, onClose, onSaved }: { schoolId: string; plan: any; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(LESSON_FIELDS.map((f) => [f.key, plan[f.key] ?? ""])));
  const [lessonDate, setLessonDate] = useState<string>(plan.lessonDate ?? "");
  const [duration, setDuration] = useState<string>(String(plan.durationMinutes ?? 40));
  const [status, setStatus] = useState<string>(plan.status ?? "DRAFT");

  const saveMut = useMutation({
    mutationFn: () => api.curriculum.updateLessonPlan(schoolId, plan.id, {
      ...values, lessonDate: lessonDate || null, durationMinutes: Number(duration), status,
    }),
    onSuccess: () => { toast.success(status === "FINAL" ? "Lesson plan marked final" : "Lesson plan saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not save"),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle className="flex items-center gap-2">
        {plan.subjectName} · {plan.source === "AI" ? "AI draft" : plan.source === "TEMPLATE" ? "Template" : "Manual"}
      </DialogTitle>
      <DialogContent>
        <div className="grid gap-3 pt-2">
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Lesson date" type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Duration (minutes)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} size="small" />
            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} size="small">
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="FINAL">Final</MenuItem>
            </TextField>
          </div>
          {LESSON_FIELDS.map((f) => (
            <TextField key={f.key} label={f.label} size="small" fullWidth multiline={!!f.multiline} minRows={f.multiline ? 2 : 1}
              value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          ))}
          {plan.source === "AI" && (
            <p className="text-xs text-muted-foreground">This draft was written by AI. Check the content against the syllabus before marking it final.</p>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>Close</Button>
        <Button variant="contained" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
