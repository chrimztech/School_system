import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Loader2, Building2, ChevronDown, ChevronRight, BookMarked, ArrowRightLeft, UserCog, School, Crown } from "lucide-react";
import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Button,
  Chip,
  IconButton,
  MenuItem,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/departments")({
  head: () => ({ meta: [{ title: "Departments — SRMS" }] }),
  component: DepartmentsPage,
});

function emptyForm() {
  return { name: "", code: "", headTeacherId: "", description: "" };
}

const PHASE_LABEL: Record<string, string> = {
  primary: "Primary",
  olevel: "O-Level",
  alevel: "A-Level",
  secondary: "Secondary",
};

type DeptForm = ReturnType<typeof emptyForm>;

function SubjectRow({
  s, currentDept, onMove,
}: {
  s: any;
  currentDept: string;
  onMove: (subject: any, dept: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{s.code}</span>
        <span className="text-sm font-medium">{s.name}</span>
        {s.phase && <Chip size="small" label={PHASE_LABEL[s.phase] ?? s.phase} sx={{ ...badgeSx("outline"), fontSize: 12 }} />}
        {(s.compulsory ?? s.isCore) && <Chip size="small" label="Core" sx={{ ...badgeSx("default"), fontSize: 12 }} />}
      </div>
      <Button
        variant="text" color="inherit" size="small"
        startIcon={<ArrowRightLeft size={12} />}
        sx={{ height: 28, fontSize: 12 }}
        onClick={() => onMove(s, currentDept)}
      >
        Move
      </Button>
    </div>
  );
}

function DeptDialog({
  open, onClose, title, form, setForm, save, editTarget, isPending,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  form: DeptForm;
  setForm: Dispatch<SetStateAction<DeptForm>>;
  save: () => void;
  editTarget: any | null;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sciences" slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth size="small" />
            <TextField label="Code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="SCI" slotProps={{ htmlInput: { maxLength: 10 } }} fullWidth size="small" />
          </div>
          {!editTarget && (
            <p className="text-xs text-muted-foreground">
              Add teachers to this department from the Staff/Teachers page once it's created, then promote one of them to Head of Department from the list below.
            </p>
          )}
          <TextField
            label="Description"
            multiline
            minRows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description…"
            slotProps={{ htmlInput: { maxLength: 200 } }}
            fullWidth
            size="small"
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editTarget ? "Save changes" : "Add department"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DepartmentsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const isHOD = user?.role === "hod";
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reassigning, setReassigning] = useState<{ subject: any; targetDept: string } | null>(null);
  const [assigningTeacher, setAssigningTeacher] = useState<{ teacher: any; deptSubjects: any[]; selectedSubject: string } | null>(null);
  const [assigningClass, setAssigningClass] = useState<{ teacher: any; deptSubjects: any[]; selectedClassId: string; selectedSubject: string } | null>(null);

  const { data: rawDepts = [], isLoading: deptsLoading } = useQuery({
    queryKey: ["departments", schoolId],
    queryFn: () => api.departments.list(schoolId),
  });
  const depts = rawDepts as any[];

  const { data: rawSubjects = [] } = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: () => api.subjects.list(schoolId),
  });
  const subjects = rawSubjects as any[];

  const { data: rawTeachers = [] } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });
  const teachers = rawTeachers as any[];

  const { data: rawClasses = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => api.classes.list(schoolId),
  });
  const classes = rawClasses as any[];

  // Group subjects and teachers by department name
  const subjectsByDept = subjects.reduce<Record<string, any[]>>((acc, s) => {
    const key = s.department ?? "__unassigned__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const teachersByDept = teachers.reduce<Record<string, any[]>>((acc, t) => {
    const key = t.department ?? "__unassigned__";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const deptNames = depts.map((d: any) => d.name);
  const unassigned = subjects.filter((s) => !s.department || !deptNames.includes(s.department));
  const unassignedTeachers = teachers.filter((t) => !t.department || !deptNames.includes(t.department));

  // HODs only manage the department(s) they've been set as head of — not every department in the school.
  const myTeacherRecord = isHOD
    ? teachers.find((t: any) => t.email && user?.email && t.email.toLowerCase() === user.email.toLowerCase())
    : undefined;
  const visibleDepts = isHOD
    ? depts.filter((d: any) => myTeacherRecord && d.headTeacherId === myTeacherRecord.id)
    : depts;
  const visibleDeptNames = visibleDepts.map((d: any) => d.name);

  // Auto-expand the HOD's own department so they land straight on their teacher list.
  useEffect(() => {
    if (!isHOD || visibleDepts.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      visibleDepts.forEach((d: any) => next.add(d.id));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHOD, visibleDepts.map((d: any) => d.id).join(",")]);

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: any) => api.departments.create(schoolId, data),
    onSuccess: (d: any) => {
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      toast.success(`${d.name} created`);
      setForm(emptyForm());
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create department"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.departments.update(schoolId, id, data),
    onSuccess: (d: any) => {
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      toast.success(`${d.name} updated`);
      setEditTarget(null);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update department"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.departments.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      toast.success("Department removed");
    },
    onError: () => toast.error("Failed to remove department"),
  });

  const reassignMut = useMutation({
    mutationFn: ({ id, dept }: { id: string; dept: string }) =>
      api.subjects.update(schoolId, id, { department: dept }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subjects", schoolId] });
      toast.success("Subject moved");
      setReassigning(null);
    },
    onError: () => toast.error("Failed to move subject"),
  });

  const assignSubjectMut = useMutation({
    mutationFn: ({ id, subject }: { id: string; subject: string | null }) =>
      api.teachers.update(schoolId, id, { subject }),
    onSuccess: (t: any) => {
      void qc.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast.success(t.subject ? `Assigned to ${t.subject}` : "Subject cleared");
      setAssigningTeacher(null);
    },
    onError: () => toast.error("Failed to assign subject"),
  });

  const assignClassMut = useMutation({
    mutationFn: ({ classId, teacherId, teacherName, subjectName, className }: {
      classId: string; teacherId: string; teacherName: string; subjectName: string; className: string;
    }) => api.classes.assignTeacher(schoolId, classId, { teacherId, teacherName, subjectName, className }),
    onSuccess: (_: any, vars: any) => {
      void qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      const cls = classes.find((c: any) => c.id === vars.classId);
      toast.success(`Assigned to ${cls?.name ?? "class"}`);
      setAssigningClass(null);
    },
    onError: () => toast.error("Failed to assign teacher to class"),
  });

  const openEdit = (d: any) => {
    setEditTarget(d);
    setForm({ name: d.name ?? "", code: d.code ?? "", headTeacherId: d.headTeacherId ?? "", description: d.description ?? "" });
  };

  const save = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      headTeacherId: form.headTeacherId || "",
      description: form.description.trim() || null,
    };
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };


  const handleMove = (subject: any, dept: string) =>
    setReassigning({ subject, targetDept: dept });

  const isLoading = deptsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description={isHOD ? "Manage the teachers and subjects in the department you head" : "Academic departments — manage faculty groupings and subject assignments"}
        actions={
          !isHOD && (
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => { setForm(emptyForm()); setEditTarget(null); setAddOpen(true); }}>
              Add department
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Departments" value={visibleDepts.length} accent="primary" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Linked subjects" value={subjects.filter(s => s.department && visibleDeptNames.includes(s.department)).length} accent="success" icon={<BookMarked className="h-4 w-4" />} />
        <StatCard label="Linked teachers" value={teachers.filter(t => t.department && visibleDeptNames.includes(t.department)).length} accent="accent" icon={<UserCog className="h-4 w-4" />} />
        {!isHOD && <StatCard label="Unassigned" value={unassigned.length + unassignedTeachers.length} accent="warning" hint="Subjects + teachers" />}
      </div>

      <DeptDialog
        open={addOpen || !!editTarget}
        onClose={() => { setAddOpen(false); setEditTarget(null); setForm(emptyForm()); }}
        title={editTarget ? `Edit — ${editTarget.name}` : "Add department"}
        form={form}
        setForm={setForm}
        save={save}
        editTarget={editTarget}
        isPending={createMut.isPending || updateMut.isPending}
      />

      {/* Assign teacher to subject dialog */}
      <Dialog open={!!assigningTeacher} onClose={() => setAssigningTeacher(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign subject</DialogTitle>
        <DialogContent>
          <div className="space-y-3 text-sm">
            <p>
              Assign <strong>{assigningTeacher?.teacher?.firstName} {assigningTeacher?.teacher?.lastName}</strong> to a subject in this department.
            </p>
            <div>
              {assigningTeacher?.deptSubjects && assigningTeacher.deptSubjects.length > 0 ? (
                <TextField
                  select
                  label="Subject"
                  value={assigningTeacher?.selectedSubject ?? ""}
                  onChange={(e) => setAssigningTeacher((a) => a ? { ...a, selectedSubject: e.target.value } : a)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="__clear__">— No subject (clear) —</MenuItem>
                  {assigningTeacher.deptSubjects.map((s: any) => (
                    <MenuItem key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <p className="text-sm font-medium">Subject</p>
                  <p className="mt-1 text-xs text-amber-600">
                    No subjects in this department yet. Add subjects on the Subjects page first.
                  </p>
                </>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAssigningTeacher(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={assignSubjectMut.isPending || !assigningTeacher?.selectedSubject}
            onClick={() => {
              if (!assigningTeacher) return;
              const subj = assigningTeacher.selectedSubject === "__clear__" ? null : assigningTeacher.selectedSubject;
              assignSubjectMut.mutate({ id: assigningTeacher.teacher.id, subject: subj });
            }}
          >
            {assignSubjectMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign teacher to class dialog */}
      <Dialog open={!!assigningClass} onClose={() => setAssigningClass(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign to class</DialogTitle>
        <DialogContent>
          <div className="space-y-3 text-sm">
            <p>
              Assign <strong>{assigningClass?.teacher?.firstName} {assigningClass?.teacher?.lastName}</strong> to teach a class.
            </p>
            <div>
              {classes.length > 0 ? (
                <TextField
                  select
                  label="Class"
                  value={assigningClass?.selectedClassId ?? ""}
                  onChange={(e) => setAssigningClass((a) => a ? { ...a, selectedClassId: e.target.value } : a)}
                  fullWidth
                  size="small"
                >
                  {classes.map((c: any) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}{c.section ? ` — ${c.section}` : ""}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <p className="text-sm font-medium">Class</p>
                  <p className="mt-1 text-xs text-amber-600">No classes found. Add classes on the Classes page first.</p>
                </>
              )}
            </div>
            <div>
              {assigningClass?.deptSubjects && assigningClass.deptSubjects.length > 0 ? (
                <TextField
                  select
                  label="Subject to teach in this class"
                  value={assigningClass?.selectedSubject ?? ""}
                  onChange={(e) => setAssigningClass((a) => a ? { ...a, selectedSubject: e.target.value } : a)}
                  fullWidth
                  size="small"
                >
                  {assigningClass.deptSubjects.map((s: any) => (
                    <MenuItem key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <p className="text-sm font-medium">Subject to teach in this class</p>
                  <p className="mt-1 text-xs text-muted-foreground">No subjects in this department yet.</p>
                </>
              )}
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAssigningClass(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={assignClassMut.isPending || !assigningClass?.selectedClassId || !assigningClass?.selectedSubject}
            onClick={() => {
              if (!assigningClass) return;
              const t = assigningClass.teacher;
              const cls = classes.find((c: any) => c.id === assigningClass.selectedClassId);
              assignClassMut.mutate({
                classId: assigningClass.selectedClassId,
                teacherId: t.id,
                teacherName: `${t.firstName} ${t.lastName}`,
                subjectName: assigningClass.selectedSubject,
                className: cls?.name ?? "",
              });
            }}
          >
            {assignClassMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reassign dialog */}
      <Dialog open={!!reassigning} onClose={() => setReassigning(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Move subject</DialogTitle>
        <DialogContent>
          <div className="space-y-3 text-sm">
            <p>Move <strong>{reassigning?.subject?.name}</strong> to a different department.</p>
            <TextField
              select
              label="Target department"
              value={reassigning?.targetDept ?? ""}
              onChange={(e) => setReassigning((r) => r ? { ...r, targetDept: e.target.value } : r)}
              fullWidth
              size="small"
            >
              {depts.map((d: any) => (
                <MenuItem key={d.id} value={d.name}>{d.name}</MenuItem>
              ))}
            </TextField>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setReassigning(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={reassignMut.isPending || !reassigning?.targetDept}
            onClick={() => reassigning && reassignMut.mutate({ id: reassigning.subject.id, dept: reassigning.targetDept })}
          >
            {reassignMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move subject
          </Button>
        </DialogActions>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span>Loading…</span>
        </div>
      ) : visibleDepts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <Building2 className="h-8 w-8 text-muted-foreground/40" />
          {isHOD ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">You're not set as head of any department yet.</p>
              <p className="text-xs text-muted-foreground">Ask your school administrator to assign you as head of department first.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground">No departments yet.</p>
              <p className="text-xs text-muted-foreground">Add your first department to start grouping subjects by faculty.</p>
              <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={() => { setForm(emptyForm()); setEditTarget(null); setAddOpen(true); }}>
                Add department
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {visibleDepts.map((d: any, idx: number) => {
            const deptSubjects: any[] = subjectsByDept[d.name] ?? [];
            const deptTeachers: any[] = teachersByDept[d.name] ?? [];
            const isOpen = expanded.has(d.id);
            return (
              <div key={d.id} className={idx > 0 ? "border-t border-border" : ""}>
                {/* Department header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  onClick={() => toggleExpand(d.id)}
                >
                  <button className="text-muted-foreground shrink-0">
                    {isOpen
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{d.name}</span>
                      {d.code && <Chip size="small" label={d.code} sx={{ ...badgeSx("secondary"), fontFamily: "monospace", fontSize: 12 }} />}
                      <Chip
                        size="small"
                        label={`${deptSubjects.length} subject${deptSubjects.length !== 1 ? "s" : ""}`}
                        sx={{ ...badgeSx((deptSubjects.length + deptTeachers.length) > 0 ? "outline" : "secondary"), fontSize: 12 }}
                      />
                      <Chip
                        size="small"
                        label={`${deptTeachers.length} teacher${deptTeachers.length !== 1 ? "s" : ""}`}
                        sx={{ ...badgeSx(deptTeachers.length > 0 ? "outline" : "secondary"), fontSize: 12 }}
                      />
                    </div>
                    {d.headTeacherId && (() => {
                      const head = teachers.find((t: any) => t.id === d.headTeacherId);
                      return head ? <p className="text-xs text-muted-foreground mt-0.5">HOD: {head.firstName} {head.lastName}</p> : null;
                    })()}
                  </div>
                  {!isHOD && (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" aria-label={`Edit ${d.name}`} onClick={() => openEdit(d)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Delete ${d.name}`}
                        sx={{ color: "error.main" }}
                        disabled={deleteMut.isPending}
                        onClick={() => deleteMut.mutate(d.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  )}
                </div>

                {/* Expanded: teachers then subjects */}
                {isOpen && (
                  <div>
                    {/* Teachers */}
                    {deptTeachers.length > 0 && (
                      <>
                        <div className="border-t border-border/50 bg-muted/10 px-10 py-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Teachers ({deptTeachers.length})</span>
                        </div>
                        {deptTeachers.map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <span className="text-sm font-medium">{t.firstName} {t.lastName}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{t.staffNumber}</span>
                              </div>
                              {t.subject
                                ? <Chip size="small" label={t.subject} sx={{ ...badgeSx("secondary"), fontSize: 12 }} />
                                : <span className="text-xs text-muted-foreground italic">No subject</span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isHOD && (
                                <Button
                                  variant="text"
                                  color={d.headTeacherId === t.id ? "warning" : "inherit"}
                                  size="small"
                                  startIcon={<Crown size={12} />}
                                  sx={{ height: 28, fontSize: 12 }}
                                  disabled={updateMut.isPending}
                                  onClick={() => updateMut.mutate({
                                    id: d.id,
                                    data: { headTeacherId: d.headTeacherId === t.id ? "" : t.id },
                                  })}
                                >
                                  {d.headTeacherId === t.id ? "Remove HOD" : "Make HOD"}
                                </Button>
                              )}
                              <Button
                                variant="text"
                                color="inherit"
                                size="small"
                                startIcon={<Pencil size={12} />}
                                sx={{ height: 28, fontSize: 12 }}
                                onClick={() => setAssigningTeacher({ teacher: t, deptSubjects, selectedSubject: t.subject ?? "" })}
                              >
                                Subject
                              </Button>
                              <Button
                                variant="text"
                                color="inherit"
                                size="small"
                                startIcon={<School size={12} />}
                                sx={{ height: 28, fontSize: 12 }}
                                onClick={() => setAssigningClass({ teacher: t, deptSubjects, selectedClassId: "", selectedSubject: t.subject ?? "" })}
                              >
                                Class
                              </Button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {/* Subjects */}
                    {deptSubjects.length > 0 && (
                      <div className="border-t border-border/50 bg-muted/10 px-10 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subjects ({deptSubjects.length})</span>
                      </div>
                    )}
                    {deptSubjects.length === 0 && deptTeachers.length === 0 ? (
                      <div className="px-10 py-4 text-xs text-muted-foreground italic border-t border-border/50 bg-muted/10">
                        No subjects or teachers assigned yet.
                      </div>
                    ) : (
                      deptSubjects.map((s: any) => (
                        <SubjectRow key={s.id} s={s} currentDept={d.name} onMove={handleMove} />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned section */}
          {!isHOD && (unassigned.length > 0 || unassignedTeachers.length > 0) && (
            <div className="border-t border-border">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                onClick={() => toggleExpand("__unassigned__")}
              >
                <button className="text-muted-foreground shrink-0">
                  {expanded.has("__unassigned__")
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">Unassigned</span>
                    {unassigned.length > 0 && (
                      <Chip size="small" label={`${unassigned.length} subject${unassigned.length !== 1 ? "s" : ""}`} sx={{ ...badgeSx("warning"), fontSize: 12 }} />
                    )}
                    {unassignedTeachers.length > 0 && (
                      <Chip size="small" label={`${unassignedTeachers.length} teacher${unassignedTeachers.length !== 1 ? "s" : ""}`} sx={{ ...badgeSx("warning"), fontSize: 12 }} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Not linked to any department</p>
                </div>
              </div>
              {expanded.has("__unassigned__") && (
                <div>
                  {unassignedTeachers.length > 0 && (
                    <>
                      <div className="border-t border-border/50 bg-muted/10 px-10 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Teachers</span>
                      </div>
                      {unassignedTeachers.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-2 border-t border-border/50 bg-muted/10">
                          <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium">{t.firstName} {t.lastName}</span>
                          <span className="text-xs text-muted-foreground">{t.staffNumber}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {unassigned.length > 0 && (
                    <>
                      <div className="border-t border-border/50 bg-muted/10 px-10 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subjects</span>
                      </div>
                      {unassigned.map((s: any) => (
                        <SubjectRow key={s.id} s={s} currentDept="" onMove={handleMove} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
