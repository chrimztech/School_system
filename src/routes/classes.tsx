import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users, Loader2, Trash2, BookOpen, UserCog, Search, GraduationCap } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button, Chip, Checkbox, IconButton, InputAdornment, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Drawer, Box, Typography, Tabs, Tab, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { useTenant, gradeRangeForType } from "@/lib/tenant";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/classes")({
  head: () => ({ meta: [{ title: "Classes — SRMS" }] }),
  component: ClassesPage,
});

function gradeLabel(grade: number | string | undefined, phase?: string): string {
  const g = Number(grade);
  if (!g) return "—";
  if (phase === "olevel" || phase === "alevel") return `Form ${g}`;
  if (phase === "primary") return `Grade ${g}`;
  // No phase tag (legacy class record): secondary grades are stored as 7-12 elsewhere
  // in the app (see formatGrade in lib/tenant.tsx) — same offset here for consistency.
  return g >= 7 ? `Form ${g - 6}` : `Grade ${g}`;
}

// Suggests the next-grade destination class for promotion, following the same
// primary(1-6) → olevel(1-4) → alevel(5-6) progression used when creating classes.
function suggestDestination(grade: number, phase: string, allClasses: any[], targetYear: string) {
  let nextGrade = grade + 1;
  let nextPhase = phase || "primary";
  if (nextPhase === "primary" && grade >= 6) { nextGrade = 1; nextPhase = "olevel"; }
  else if (nextPhase === "olevel" && grade >= 4) { nextGrade = 5; nextPhase = "alevel"; }
  else if (nextPhase === "alevel" && grade >= 6) return { graduate: true, defaultId: "" };
  const candidates = (allClasses as any[]).filter(
    (c: any) => String(c.academicYear) === targetYear && Number(c.grade) === nextGrade && (c.phase ?? nextPhase) === nextPhase,
  );
  return { graduate: false, defaultId: candidates.length === 1 ? candidates[0].id : "" };
}

function blankClassForm(year: string, defaultPhase = "") {
  return {
    name: "", grade: "", section: "", teacherId: "", teacherName: "", capacity: "30",
    room: "", academicYear: year, phase: defaultPhase, languageOfInstruction: "English",
    assessmentStream: "ECZ", notes: "",
  };
}

// ── Class detail sheet ────────────────────────────────────────────
function ClassDetailSheet({ cls, schoolId, onClose, readOnly = false }: { cls: any; schoolId: string; onClose: () => void; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [detailTab, setDetailTab] = useState("pupils");
  const [enrollSearch, setEnrollSearch] = useState("");
  const [teacherDialog, setTeacherDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);
  const [promoteDialog, setPromoteDialog] = useState(false);
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

  const { data: allClassesRaw = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => api.classes.list(schoolId),
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

  const promoteMut = useMutation({
    mutationFn: (payload: any) => api.promotions.promote(schoolId, payload),
    onSuccess: (result: any) => {
      void qc.invalidateQueries({ queryKey: ["class-enrolments", schoolId, cls.id] });
      void qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      toast.success(`${result.promoted} promoted, ${result.graduated} graduated`);
      setPromoteDialog(false);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to promote students"),
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
    <>
    <Drawer anchor="right" open onClose={onClose}>
      <Box sx={{ width: { xs: "100vw", sm: 720 }, display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3, py: 2 }}>
          <Typography variant="h6">{cls.name}</Typography>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span>{gradeLabel(cls.grade, cls.phase)}{cls.section ? ` · ${cls.section}` : ""}</span>
            {cls.room && <span>Room {cls.room}</span>}
            {cls.academicYear && <span>{cls.academicYear}</span>}
            <span className="font-medium text-foreground">Class teacher: {cls.classTeacherName ?? cls.classTeacher ?? "—"}</span>
          </div>
        </Box>

        <Box className="flex flex-1 flex-col overflow-hidden">
          <Tabs value={detailTab} onChange={(_e, v) => setDetailTab(v)} className="mx-6 mt-4 w-auto self-start">
            <Tab value="pupils" icon={<Users size={14} />} iconPosition="start" label={`Pupils (${enrolments.length})`} />
            <Tab value="teachers" icon={<BookOpen size={14} />} iconPosition="start" label={`Subject teachers (${classTeachers.length})`} />
          </Tabs>

          {/* PUPILS TAB */}
          {detailTab === "pupils" && (
          <Box className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <p className="text-sm text-muted-foreground">
                {enrolments.length} / {cls.capacity ?? "—"} enrolled
              </p>
              {!readOnly && <div className="flex gap-2">
              <Button size="small" variant="outlined" onClick={() => setPromoteDialog(true)} startIcon={<GraduationCap className="h-3.5 w-3.5" />}>
                Promote to next year
              </Button>
              <Button size="small" variant="contained" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEnrollDialog(true)}>Enrol pupils</Button>
              <Dialog open={enrollDialog} onClose={() => setEnrollDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                  Enrol pupils into {cls.name}
                  <p className="text-sm text-muted-foreground" style={{ fontWeight: 400 }}>Select admitted students to add to this class.</p>
                </DialogTitle>
                <DialogContent>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search by name, admission no. or grade"
                    value={enrollSearch}
                    onChange={(e) => setEnrollSearch(e.target.value)}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
                  />
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
                          <Button size="small" variant="outlined" onClick={() => enrolMut.mutate(s)} disabled={enrolMut.isPending}>
                            Enrol
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => { setEnrollDialog(false); setEnrollSearch(""); }}>Done</Button>
                </DialogActions>
              </Dialog>
              </div>}
            </div>

            <div className="flex-1 overflow-y-auto">
              {enrolLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span>Loading pupils…</span>
                </div>
              ) : (
                <TableContainer>
                <Table>
                  <TableHead><TableRow>
                    <TableCell>Student</TableCell>
                    <TableCell>Grade</TableCell>
                    <TableCell>Year</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell className="w-10" />
                  </TableRow></TableHead>
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
                          <Chip
                            size="small"
                            label={(e.status ?? "ACTIVE").toLowerCase()}
                            sx={{ ...badgeSx(e.status === "ACTIVE" ? "secondary" : "outline"), textTransform: "capitalize" }}
                          />
                        </TableCell>
                        <TableCell>
                          {!readOnly && <IconButton size="small" color="error" aria-label={`Remove ${e.studentName} from class`} onClick={() => removeEnrolMut.mutate(e.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              )}
            </div>
          </Box>
          )}

          {/* SUBJECT TEACHERS TAB */}
          {detailTab === "teachers" && (
          <Box className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <p className="text-sm text-muted-foreground">Teachers assigned to teach subjects in this class</p>
              <Button size="small" variant="contained" startIcon={<UserCog className="h-3.5 w-3.5" />} onClick={() => setTeacherDialog(true)}>Assign teacher</Button>
              <Dialog open={teacherDialog} onClose={() => setTeacherDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign subject teacher to {cls.name}</DialogTitle>
                <DialogContent>
                  <div className="space-y-3">
                    <TextField
                      select
                      label="Teacher *"
                      fullWidth
                      size="small"
                      value={teacherForm.teacherId}
                      onChange={(e) => {
                        const v = e.target.value;
                        const t = (allTeachers as any[]).find((x: any) => x.id === v);
                        setTeacherForm({ ...teacherForm, teacherId: v, teacherName: t ? `${t.firstName} ${t.lastName}` : "" });
                      }}
                    >
                      <MenuItem value="" disabled>Select teacher</MenuItem>
                      {(allTeachers as any[]).map((t: any) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}{t.subject ? ` · ${t.subject}` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                    <div>
                      {(allSubjects as any[]).length > 0 ? (
                        <TextField
                          select
                          label="Subject *"
                          fullWidth
                          size="small"
                          value={teacherForm.subjectId || "__custom__"}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__custom__") {
                              setTeacherForm({ ...teacherForm, subjectId: "", subjectName: "" });
                            } else {
                              const sub = (allSubjects as any[]).find((s: any) => s.id === v);
                              setTeacherForm({ ...teacherForm, subjectId: v, subjectName: sub?.name ?? "" });
                            }
                          }}
                        >
                          {(allSubjects as any[]).map((s: any) => (
                            <MenuItem key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</MenuItem>
                          ))}
                          <MenuItem value="__custom__">Other / type below</MenuItem>
                        </TextField>
                      ) : null}
                      {((allSubjects as any[]).length === 0 || !teacherForm.subjectId) && (
                        <TextField
                          className={(allSubjects as any[]).length > 0 ? "mt-1" : undefined}
                          label={(allSubjects as any[]).length === 0 ? "Subject *" : undefined}
                          fullWidth
                          size="small"
                          placeholder="e.g. Mathematics, English Language"
                          value={teacherForm.subjectName}
                          onChange={(e) => setTeacherForm({ ...teacherForm, subjectName: e.target.value, subjectId: "" })}
                        />
                      )}
                    </div>
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setTeacherDialog(false)}>Cancel</Button>
                  <Button variant="contained" onClick={submitTeacher} disabled={assignTeacherMut.isPending}>
                    {assignTeacherMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign
                  </Button>
                </DialogActions>
              </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto">
              {teachersLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span>Loading assignments…</span>
                </div>
              ) : (
                <TableContainer>
                <Table>
                  <TableHead><TableRow>
                    <TableCell>Teacher</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Year</TableCell>
                    <TableCell className="w-10" />
                  </TableRow></TableHead>
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
                          <IconButton size="small" color="error" aria-label={`Remove ${t.teacherName} from class`} onClick={() => removeTeacherMut.mutate(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              )}
            </div>
          </Box>
          )}
        </Box>
      </Box>
    </Drawer>
    {!readOnly && (
      <PromoteClassDialog
        open={promoteDialog}
        onOpenChange={setPromoteDialog}
        cls={cls}
        enrolments={enrolments}
        allClasses={allClassesRaw as any[]}
        onSubmit={(payload) => promoteMut.mutate(payload)}
        isPending={promoteMut.isPending}
      />
    )}
    </>
  );
}

// ── Promote class dialog ─────────────────────────────────────────
function PromoteClassDialog({
  open, onOpenChange, cls, enrolments, allClasses, onSubmit, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cls: any;
  enrolments: any[];
  allClasses: any[];
  onSubmit: (payload: any) => void;
  isPending: boolean;
}) {
  const activeEnrolments = useMemo(
    () => (enrolments as any[]).filter((e: any) => (e.status ?? "ACTIVE") === "ACTIVE"),
    [enrolments],
  );
  const [targetYear, setTargetYear] = useState(() => String(Number(cls.academicYear ?? new Date().getFullYear()) + 1));
  const [rows, setRows] = useState<Record<string, { include: boolean; destinationClassId: string; graduate: boolean }>>({});

  // Reset the roster whenever the dialog is (re)opened for this class
  useEffect(() => {
    if (!open) return;
    const year = String(Number(cls.academicYear ?? new Date().getFullYear()) + 1);
    setTargetYear(year);
    const suggestion = suggestDestination(Number(cls.grade), cls.phase ?? "primary", allClasses, year);
    const next: Record<string, { include: boolean; destinationClassId: string; graduate: boolean }> = {};
    for (const e of activeEnrolments) {
      next[e.id] = {
        include: true,
        destinationClassId: suggestion.graduate ? "" : suggestion.defaultId,
        graduate: suggestion.graduate,
      };
    }
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cls.id]);

  const candidates = useMemo(
    () => (allClasses as any[]).filter((c: any) => String(c.academicYear) === targetYear && c.id !== cls.id),
    [allClasses, targetYear, cls.id],
  );

  const updateRow = (id: string, patch: Partial<{ include: boolean; destinationClassId: string; graduate: boolean }>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const includedRows = activeEnrolments.filter((e: any) => rows[e.id]?.include);
  const canSubmit = includedRows.length > 0 && includedRows.every((e: any) => {
    const r = rows[e.id];
    return r?.graduate || (r?.destinationClassId ?? "").length > 0;
  });

  const submit = () => {
    const items = includedRows.map((e: any) => ({
      studentId: e.studentId,
      enrolmentId: e.id,
      destinationClassId: rows[e.id].graduate ? null : rows[e.id].destinationClassId,
      graduate: rows[e.id].graduate,
    }));
    onSubmit({ sourceClassId: cls.id, targetAcademicYear: targetYear, items });
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth="md" fullWidth>
      <DialogTitle>
        Promote {cls.name} to {targetYear}
        <p className="text-sm text-muted-foreground" style={{ fontWeight: 400 }}>
          Review each pupil, choose their destination class for the next academic year, or mark them as graduating.
        </p>
      </DialogTitle>
      <DialogContent className="flex max-h-[85vh] flex-col">
        <div className="flex items-center gap-3">
          <TextField
            label="Target academic year"
            size="small"
            className="w-40"
            value={targetYear}
            onChange={(e) => setTargetYear(e.target.value)}
          />
        </div>
        {activeEnrolments.length > 0 && candidates.length === 0 && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            No classes exist yet for {targetYear}. Create the destination class(es) in Classes first, or mark pupils as graduating below.
          </p>
        )}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border">
          {activeEnrolments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No active pupils to promote.</p>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell className="w-10" />
                <TableCell>Student</TableCell>
                <TableCell>Destination</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {activeEnrolments.map((e: any) => {
                  const row = rows[e.id] ?? { include: true, destinationClassId: "", graduate: false };
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Checkbox size="small" checked={row.include} onChange={(e2) => updateRow(e.id, { include: e2.target.checked })} />
                      </TableCell>
                      <TableCell className={!row.include ? "text-muted-foreground" : ""}>{e.studentName}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          className="w-56"
                          disabled={!row.include}
                          value={row.graduate ? "__graduate__" : row.destinationClassId || ""}
                          onChange={(ev) => {
                            const v = ev.target.value;
                            if (v === "__graduate__") updateRow(e.id, { graduate: true, destinationClassId: "" });
                            else updateRow(e.id, { graduate: false, destinationClassId: v });
                          }}
                        >
                          <MenuItem value="" disabled>Select destination</MenuItem>
                          {candidates.map((c: any) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                          ))}
                          <MenuItem value="__graduate__">🎓 Graduate (leaving school)</MenuItem>
                        </TextField>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!canSubmit || isPending}>
          {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Promote {includedRows.length} pupil{includedRows.length === 1 ? "" : "s"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────
function ClassesPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const teacherEmail = user?.role === "teacher" ? user.email : undefined;
  const qc = useQueryClient();

  const currentYear = String(active.currentYear ?? new Date().getFullYear());
  const showPrimary = ["PRIMARY", "COMBINED", "FULL", "NURSERY"].includes(active.type);
  const showSecondary = ["SECONDARY", "COMBINED", "FULL"].includes(active.type);
  const defaultPhase = showPrimary && !showSecondary ? "primary" : !showPrimary && showSecondary ? "olevel" : "";

  const [classesTab, setClassesTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailClass, setDetailClass] = useState<any | null>(null);
  const [form, setForm] = useState(() => blankClassForm(currentYear, defaultPhase));

  const { data: classesRaw = [], isLoading } = useQuery({
    queryKey: ["classes", schoolId, teacherEmail],
    queryFn: () => api.classes.list(schoolId, teacherEmail),
  });

  const { data: teachersRaw = [] } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.classes.create(schoolId, data),
    onSuccess: (c: any) => {
      void qc.invalidateQueries({ queryKey: ["classes", schoolId, teacherEmail] });
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
            <Chip
              size="small"
              label={c.phase === "olevel" ? "O-Level" : c.phase === "alevel" ? "A-Level" : c.phase === "primary" ? "Primary" : "Secondary"}
              sx={badgeSx(c.phase === "primary" ? "secondary" : "default")}
            />
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
        <p className="mt-3 text-xs text-primary underline-offset-2 hover:underline">
          {isTeacher ? "Click to view class roster →" : "Click to manage pupils & teachers →"}
        </p>
      </button>
    );
  };

  const isTeacher = user?.role === "teacher";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        description={isTeacher
          ? `${active.name} · Your assigned classes for this term.`
          : `${gradeRangeForType(active.type)} · ${active.name}. Create classes, enrol pupils and assign subject teachers.`}
        actions={!isTeacher && (
          <>
            <Button variant="contained" startIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create class</Button>
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Create new class</DialogTitle>
              <DialogContent>
              <div className="overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Class name *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Form 1 Blue / Grade 3A"
                  slotProps={{ htmlInput: { maxLength: 50 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Academic year"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                  placeholder="2026"
                  slotProps={{ htmlInput: { maxLength: 10 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Grade / Form *"
                  disabled={showPrimary && showSecondary && !form.phase}
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="" disabled>
                    {showPrimary && showSecondary && !form.phase ? "Select phase first" : "Select grade or form"}
                  </MenuItem>
                  {(form.phase === "primary" || (!showSecondary && !form.phase)) &&
                    [1,2,3,4,5,6].map((g) => <MenuItem key={g} value={String(g)}>Grade {g}</MenuItem>)}
                  {(form.phase === "olevel" || (!showPrimary && !form.phase)) &&
                    [1,2,3,4].map((g) => <MenuItem key={g} value={String(g)}>Form {g} (O-Level)</MenuItem>)}
                  {(form.phase === "olevel" || form.phase === "alevel") && form.phase === "alevel" &&
                    [5,6].map((g) => <MenuItem key={g} value={String(g)}>Form {g} (A-Level)</MenuItem>)}
                  {!showPrimary && !form.phase &&
                    [5,6].map((g) => <MenuItem key={`al-${g}`} value={String(g)}>Form {g} (A-Level)</MenuItem>)}
                </TextField>
                <TextField
                  label="Section / stream"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  placeholder="A, Blue, Science"
                  slotProps={{ htmlInput: { maxLength: 20 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Class teacher"
                  value={form.teacherId || "__none__"}
                  onChange={(e) => {
                    const v = e.target.value;
                    const t = (teachersRaw as any[]).find((x: any) => x.id === v);
                    setForm({ ...form, teacherId: v === "__none__" ? "" : v, teacherName: t ? `${t.firstName} ${t.lastName}` : "" });
                  }}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="__none__">Assign later</MenuItem>
                  {(teachersRaw as any[]).map((t: any) => (
                    <MenuItem key={t.id} value={t.id}>{t.firstName} {t.lastName}{t.subject ? ` · ${t.subject}` : ""}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Room"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  placeholder="P-105"
                  slotProps={{ htmlInput: { maxLength: 20 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Capacity"
                  type="number"
                  slotProps={{ htmlInput: { min: 1, max: 60 } }}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Phase"
                  value={form.phase || "__auto__"}
                  onChange={(e) => setForm({ ...form, phase: e.target.value === "__auto__" ? "" : e.target.value, grade: "" })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="__auto__">Auto-detect</MenuItem>
                  {showPrimary && <MenuItem value="primary">Primary (Grade 1-6)</MenuItem>}
                  {showSecondary && <MenuItem value="olevel">O-Level Secondary (Form 1-4)</MenuItem>}
                  {showSecondary && <MenuItem value="alevel">A-Level Secondary (Form 5-6)</MenuItem>}
                </TextField>
                <TextField
                  select
                  label="Language of instruction"
                  value={form.languageOfInstruction}
                  onChange={(e) => setForm({ ...form, languageOfInstruction: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {["English", "Nyanja", "Bemba", "Tonga", "Lozi"].map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
                <TextField
                  select
                  label="Assessment stream"
                  value={form.assessmentStream}
                  onChange={(e) => setForm({ ...form, assessmentStream: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {["ECZ", "IGCSE", "IB", "Internal only"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <div className="col-span-2">
                  <TextField
                    label="Notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Double period Tuesdays, shared lab Thursdays…"
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    fullWidth
                    size="small"
                  />
                </div>
              </div>
              </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={createClass} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create class
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
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
        <Box>
          <Tabs value={classesTab} onChange={(_e, v) => setClassesTab(v)} sx={{ mb: 2 }}>
            <Tab value="all" label={`All (${list.length})`} />
            {showPrimary && <Tab value="primary" label="Primary" />}
            {showSecondary && <Tab value="secondary" label="Secondary" />}
          </Tabs>
          {classesTab === "all" && (
            <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c: any) => <ClassCard key={c.id} c={c} />)}
              {list.length === 0 && <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">No classes yet. Create the first class above.</p>}
            </Box>
          )}
          {showPrimary && classesTab === "primary" && (
            <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.filter((c: any) => c.phase === "primary").map((c: any) => <ClassCard key={c.id} c={c} />)}
            </Box>
          )}
          {showSecondary && classesTab === "secondary" && (
            <Box className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.filter((c: any) => isSecondaryPhase(c.phase)).map((c: any) => <ClassCard key={c.id} c={c} />)}
            </Box>
          )}
        </Box>
      )}

      {detailClass && (
        <ClassDetailSheet
          cls={detailClass}
          schoolId={schoolId}
          onClose={() => setDetailClass(null)}
          readOnly={isTeacher}
        />
      )}
    </div>
  );
}
