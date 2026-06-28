import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Loader2, Building2, ChevronDown, ChevronRight, BookMarked, ArrowRightLeft, UserCog, School } from "lucide-react";
import { useState, Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/departments")({
  head: () => ({ meta: [{ title: "Departments — SRMS" }] }),
  component: DepartmentsPage,
});

function emptyForm() {
  return { name: "", code: "", head: "", description: "" };
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
        {s.phase && <Badge variant="outline" className="text-xs">{PHASE_LABEL[s.phase] ?? s.phase}</Badge>}
        {(s.compulsory ?? s.isCore) && <Badge className="text-xs">Core</Badge>}
      </div>
      <Button
        variant="ghost" size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => onMove(s, currentDept)}
      >
        <ArrowRightLeft className="h-3 w-3" />Move
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Sciences" maxLength={60} />
            </div>
            <div>
              <Label>Code</Label>
              <Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="SCI" maxLength={10} />
            </div>
          </div>
          <div>
            <Label>Head of Department</Label>
            <Input className="mt-1" value={form.head} onChange={(e) => setForm((f) => ({ ...f, head: e.target.value }))} placeholder="Mr. Banda" maxLength={80} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea className="mt-1 min-h-16 resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description…" maxLength={200} />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editTarget ? "Save changes" : "Add department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
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
    setForm({ name: d.name ?? "", code: d.code ?? "", head: d.head ?? "", description: d.description ?? "" });
  };

  const save = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      head: form.head.trim() || null,
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
        description="Academic departments — manage faculty groupings and subject assignments"
        actions={
          <Button onClick={() => { setForm(emptyForm()); setEditTarget(null); setAddOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />Add department
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Departments" value={depts.length} accent="primary" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Linked subjects" value={subjects.filter(s => s.department && deptNames.includes(s.department)).length} accent="success" icon={<BookMarked className="h-4 w-4" />} />
        <StatCard label="Linked teachers" value={teachers.filter(t => t.department && deptNames.includes(t.department)).length} accent="accent" icon={<UserCog className="h-4 w-4" />} />
        <StatCard label="Unassigned" value={unassigned.length + unassignedTeachers.length} accent="warning" hint="Subjects + teachers" />
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
      <Dialog open={!!assigningTeacher} onOpenChange={(v) => { if (!v) setAssigningTeacher(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Assign <strong>{assigningTeacher?.teacher?.firstName} {assigningTeacher?.teacher?.lastName}</strong> to a subject in this department.
            </p>
            <div>
              <Label>Subject</Label>
              {assigningTeacher?.deptSubjects && assigningTeacher.deptSubjects.length > 0 ? (
                <Select
                  value={assigningTeacher?.selectedSubject ?? ""}
                  onValueChange={(v) => setAssigningTeacher((a) => a ? { ...a, selectedSubject: v } : a)}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">— No subject (clear) —</SelectItem>
                    {assigningTeacher.deptSubjects.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-xs text-amber-600">
                  No subjects in this department yet. Add subjects on the Subjects page first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setAssigningTeacher(null)}>Cancel</Button>
            <Button
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign teacher to class dialog */}
      <Dialog open={!!assigningClass} onOpenChange={(v) => { if (!v) setAssigningClass(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign to class</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Assign <strong>{assigningClass?.teacher?.firstName} {assigningClass?.teacher?.lastName}</strong> to teach a class.
            </p>
            <div>
              <Label>Class</Label>
              {classes.length > 0 ? (
                <Select
                  value={assigningClass?.selectedClassId ?? ""}
                  onValueChange={(v) => setAssigningClass((a) => a ? { ...a, selectedClassId: v } : a)}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select class…" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.section ? ` — ${c.section}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-xs text-amber-600">No classes found. Add classes on the Classes page first.</p>
              )}
            </div>
            <div>
              <Label>Subject to teach in this class</Label>
              {assigningClass?.deptSubjects && assigningClass.deptSubjects.length > 0 ? (
                <Select
                  value={assigningClass?.selectedSubject ?? ""}
                  onValueChange={(v) => setAssigningClass((a) => a ? { ...a, selectedSubject: v } : a)}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject…" /></SelectTrigger>
                  <SelectContent>
                    {assigningClass.deptSubjects.map((s: any) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No subjects in this department yet.</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setAssigningClass(null)}>Cancel</Button>
            <Button
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign dialog */}
      <Dialog open={!!reassigning} onOpenChange={(v) => { if (!v) setReassigning(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Move <strong>{reassigning?.subject?.name}</strong> to a different department.</p>
            <div>
              <Label>Target department</Label>
              <Select
                value={reassigning?.targetDept ?? ""}
                onValueChange={(v) => setReassigning((r) => r ? { ...r, targetDept: v } : r)}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {depts.map((d: any) => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setReassigning(null)}>Cancel</Button>
            <Button
              disabled={reassignMut.isPending || !reassigning?.targetDept}
              onClick={() => reassigning && reassignMut.mutate({ id: reassigning.subject.id, dept: reassigning.targetDept })}
            >
              {reassignMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Move subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /><span>Loading…</span>
        </div>
      ) : depts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <Building2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No departments yet.</p>
          <p className="text-xs text-muted-foreground">Add your first department to start grouping subjects by faculty.</p>
          <Button size="sm" onClick={() => { setForm(emptyForm()); setEditTarget(null); setAddOpen(true); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add department
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {depts.map((d: any, idx: number) => {
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
                      {d.code && <Badge variant="secondary" className="font-mono text-xs">{d.code}</Badge>}
                      <Badge variant={(deptSubjects.length + deptTeachers.length) > 0 ? "outline" : "secondary"} className="text-xs">
                        {deptSubjects.length} subject{deptSubjects.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant={deptTeachers.length > 0 ? "outline" : "secondary"} className="text-xs">
                        {deptTeachers.length} teacher{deptTeachers.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {d.head && <p className="text-xs text-muted-foreground mt-0.5">HOD: {d.head}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
                                ? <Badge variant="secondary" className="text-xs">{t.subject}</Badge>
                                : <span className="text-xs text-muted-foreground italic">No subject</span>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setAssigningTeacher({ teacher: t, deptSubjects, selectedSubject: t.subject ?? "" })}
                              >
                                <Pencil className="h-3 w-3" />
                                Subject
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setAssigningClass({ teacher: t, deptSubjects, selectedClassId: "", selectedSubject: t.subject ?? "" })}
                              >
                                <School className="h-3 w-3" />
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
          {(unassigned.length > 0 || unassignedTeachers.length > 0) && (
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
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                        {unassigned.length} subject{unassigned.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {unassignedTeachers.length > 0 && (
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                        {unassignedTeachers.length} teacher{unassignedTeachers.length !== 1 ? "s" : ""}
                      </Badge>
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
