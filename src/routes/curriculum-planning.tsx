import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField } from "@mui/material";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

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
      {tab === 1 && <SchemesTab schoolId={schoolId} canReview={canReview} role={role} userId={user?.id ?? ""} userEmail={user?.email ?? ""} />}
      {tab === 2 && <LessonPlansTab schoolId={schoolId} />}
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

function SchemesTab({ schoolId, canReview, role, userId, userEmail }: { schoolId: string; canReview: boolean; role: string; userId: string; userEmail: string }) {
  const qc = useQueryClient();
  const subjectNames = useSubjectNames(schoolId);
  const isTeacher = role === "teacher";
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ classId: "", subjectName: "", term: "1", academicYear: String(new Date().getFullYear()) });

  const { data: schemes = [] } = useQuery({ queryKey: ["schemes", schoolId], queryFn: () => api.curriculum.schemes(schoolId) });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-for-schemes", schoolId, isTeacher ? userEmail : ""],
    queryFn: () => api.classes.list(schoolId, isTeacher ? userEmail : undefined),
  });

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
      <div className="flex justify-end">
        <Button variant="contained" startIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New scheme of work</Button>
      </div>
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {(schemes as any[]).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No schemes of work yet. Create one for a class, subject and term.</p>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Class</TableCell><TableCell>Subject</TableCell><TableCell>Term</TableCell><TableCell>Year</TableCell><TableCell>Teacher</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {(schemes as any[]).map((s) => (
                  <TableRow key={s.id} hover onClick={() => setOpenId(s.id)} sx={{ cursor: "pointer" }}>
                    <TableCell>{s.className}</TableCell>
                    <TableCell>{s.subjectName}</TableCell>
                    <TableCell>Term {s.term}</TableCell>
                    <TableCell>{s.academicYear}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.createdBy}</TableCell>
                    <TableCell>{statusChip(s.status)}</TableCell>
                    <TableCell align="right"><Button size="small">Open</Button></TableCell>
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
            <TextField select label="Class" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} size="small" fullWidth>
              {(classes as any[]).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Subject" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} size="small" fullWidth>
              {subjectNames.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
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
        <SchemeEditor schoolId={schoolId} schemeId={openId} canReview={canReview} userId={userId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}

const EMPTY_WEEK = { topic: "", subTopics: "", objectives: "", activities: "", resources: "", assessment: "", remarks: "" };

function SchemeEditor({ schoolId, schemeId, canReview, userId, onClose }: { schoolId: string; schemeId: string; canReview: boolean; userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({ queryKey: ["scheme", schoolId, schemeId], queryFn: () => api.curriculum.scheme(schoolId, schemeId) });
  const scheme = data?.scheme as any;
  const [weeks, setWeeks] = useState<any[] | null>(null);
  const [reviewNote, setReviewNote] = useState("");
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
    </Dialog>
  );
}

// ---------------------------------------------------------------- Lesson plans

const LESSON_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: "topic", label: "Topic" },
  { key: "objectives", label: "Objectives", multiline: true },
  { key: "materials", label: "Materials", multiline: true },
  { key: "introduction", label: "Introduction", multiline: true },
  { key: "development", label: "Development (teacher and learner activities)", multiline: true },
  { key: "conclusion", label: "Conclusion", multiline: true },
  { key: "evaluation", label: "Evaluation", multiline: true },
  { key: "homework", label: "Homework", multiline: true },
];

function LessonPlansTab({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: plans = [] } = useQuery({ queryKey: ["lesson-plans", schoolId], queryFn: () => api.curriculum.lessonPlans(schoolId) });
  const { data: schemes = [] } = useQuery({ queryKey: ["schemes", schoolId], queryFn: () => api.curriculum.schemes(schoolId) });
  const { data: configs = [] } = useQuery({ queryKey: ["integration-configs", schoolId], queryFn: () => api.integrationConfigs.listForSchool(schoolId) });
  const aiConnected = (configs as any[]).some((c) => c.providerCode === "llm" && c.enabled);
  const approved = useMemo(() => (schemes as any[]).filter((s) => s.status === "APPROVED"), [schemes]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.curriculum.deleteLessonPlan(schoolId, id),
    onSuccess: () => { toast.success("Lesson plan deleted"); void qc.invalidateQueries({ queryKey: ["lesson-plans", schoolId] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not delete"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="contained" startIcon={<Sparkles className="h-4 w-4" />} onClick={() => setGenerateOpen(true)} disabled={approved.length === 0}>
          Generate lesson plan
        </Button>
      </div>
      {approved.length === 0 && (
        <p className="text-sm text-muted-foreground">Lesson plans are generated from an approved scheme of work. Once a scheme is approved it appears here.</p>
      )}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {(plans as any[]).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No lesson plans yet.</p>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Subject</TableCell><TableCell>Topic</TableCell><TableCell>Source</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {(plans as any[]).map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.lessonDate ?? "—"}</TableCell>
                    <TableCell>{p.subjectName}</TableCell>
                    <TableCell>{p.topic}</TableCell>
                    <TableCell><Chip size="small" label={p.source === "AI" ? "AI draft" : p.source === "TEMPLATE" ? "Template" : "Manual"} sx={badgeSx("outline")} /></TableCell>
                    <TableCell>{statusChip(p.status)}</TableCell>
                    <TableCell align="right">
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
    </div>
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
