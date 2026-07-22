import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Loader2, BookOpen, AlertCircle, Building2 } from "lucide-react";
import { Fragment, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button, Chip, IconButton, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Drawer, Box, Typography, Tabs, Tab, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/subjects")({
  head: () => ({ meta: [{ title: "Subjects - SRMS" }] }),
  component: SubjectsPage,
});

// ── Zambia MoE / ECZ 2025 curriculum ─────────────────────────────
// Source: 2023 Zambia Education Curriculum Framework (rolled out Jan 2025)
// New structure: Primary Grade 1-6 | O-Level Form 1-4 | A-Level Form 5-6
// Key changes: Integrated Science split into Biology/Chemistry/Physics;
//              Computer Studies replaced by ICT; CTS -> Design & Technology Studies;
//              Grade 7 abolished — old Grade 7 learners now enter Form 1 (secondary)
const MOE_SUBJECTS = [
  // ── Primary Grade 1-6 ─────────────────────────────────────────
  { code: "ENG",  name: "English Language",                       department: "Languages",             phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 7, compulsory: true  },
  { code: "MAT",  name: "Mathematics",                            department: "Mathematics",            phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 7, compulsory: true  },
  { code: "ZAM",  name: "Zambian Languages",                      department: "Languages",             phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 6, compulsory: true  },
  { code: "SST",  name: "Social & Environmental Studies",         department: "Social Sciences",        phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 4, compulsory: true  },
  { code: "SCI",  name: "Integrated Science",                     department: "Sciences",               phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 4, compulsory: true  },
  { code: "CRE",  name: "Religious Education",                    department: "Religious Education",    phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 3, compulsory: true  },
  { code: "PE",   name: "Physical Education",                     department: "Arts & Physical Ed.",   phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 2, compulsory: true  },
  { code: "CAR",  name: "Creative Arts",                          department: "Arts & Physical Ed.",   phase: "primary", gradeFrom: 1, gradeTo: 6, periodsPerWeek: 2, compulsory: true  },
  { code: "HEC",  name: "Home Economics",                         department: "Technical & Vocational", phase: "primary", gradeFrom: 4, gradeTo: 6, periodsPerWeek: 2, compulsory: false },
  { code: "AGR",  name: "Agricultural Science",                   department: "Sciences",               phase: "primary", gradeFrom: 4, gradeTo: 6, periodsPerWeek: 2, compulsory: false },
  // ── O-Level Secondary Form 1-4 ────────────────────────────────
  // Core (compulsory for all secondary learners)
  { code: "ENG",  name: "English Language",                       department: "Languages",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 6, compulsory: true  },
  { code: "MAT",  name: "Mathematics",                            department: "Mathematics",            phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 6, compulsory: true  },
  { code: "CIV",  name: "Civic Education",                        department: "Social Sciences",        phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 3, compulsory: true  },
  { code: "CRE",  name: "Religious Education",                    department: "Religious Education",    phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 3, compulsory: true  },
  { code: "ZAM",  name: "Zambian Languages",                      department: "Languages",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: true  },
  { code: "PE",   name: "Physical Education",                     department: "Arts & Physical Ed.",   phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 2, compulsory: true  },
  // Sciences (Integrated Science replaced by 3 separate subjects at secondary level)
  { code: "BIO",  name: "Biology",                                department: "Sciences",               phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 5, compulsory: false },
  { code: "CHE",  name: "Chemistry",                              department: "Sciences",               phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 5, compulsory: false },
  { code: "PHY",  name: "Physics",                                department: "Sciences",               phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 5, compulsory: false },
  { code: "AGR",  name: "Agricultural Science",                   department: "Sciences",               phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "ADM",  name: "Additional Mathematics",                 department: "Mathematics",            phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  // Humanities
  { code: "GEO",  name: "Geography",                              department: "Humanities",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "HIS",  name: "History",                                department: "Humanities",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "COM",  name: "Commerce",                               department: "Humanities",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "BST",  name: "Business Studies",                       department: "Humanities",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "ACT",  name: "Principles of Accounts",                 department: "Humanities",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  // Languages
  { code: "LIT",  name: "Literature in English",                  department: "Languages",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "LZL",  name: "Literature in Zambian Languages",        department: "Languages",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 3, compulsory: false },
  { code: "FRE",  name: "French",                                 department: "Languages",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  // Technology & vocational
  { code: "ICT",  name: "Information & Communication Technology", department: "Technology",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "DTS",  name: "Design & Technology Studies",            department: "Technology",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  { code: "HEC",  name: "Home Economics",                         department: "Technology",             phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 4, compulsory: false },
  // Arts
  { code: "ART",  name: "Art & Design",                           department: "Arts & Physical Ed.",   phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 3, compulsory: false },
  { code: "MUS",  name: "Music",                                  department: "Arts & Physical Ed.",   phase: "olevel", gradeFrom: 1, gradeTo: 4, periodsPerWeek: 2, compulsory: false },
  // ── A-Level Secondary Form 5-6 ────────────────────────────────
  // Core (compulsory)
  { code: "GP",   name: "General Paper",                          department: "General Studies",        phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 3, compulsory: true  },
  // Principal subjects — Sciences
  { code: "BIO",  name: "Biology",                                department: "Sciences",               phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 6, compulsory: false },
  { code: "CHE",  name: "Chemistry",                              department: "Sciences",               phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 6, compulsory: false },
  { code: "PHY",  name: "Physics",                                department: "Sciences",               phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 6, compulsory: false },
  { code: "MAT",  name: "Mathematics",                            department: "Mathematics",            phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 6, compulsory: false },
  { code: "FMA",  name: "Further Mathematics",                    department: "Mathematics",            phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "AGR",  name: "Agricultural Science",                   department: "Sciences",               phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  // Principal subjects — Humanities
  { code: "HIS",  name: "History",                                department: "Humanities",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "GEO",  name: "Geography",                              department: "Humanities",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "ECO",  name: "Economics",                              department: "Humanities",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "ACT",  name: "Principles of Accounts",                 department: "Humanities",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "BST",  name: "Business Studies",                       department: "Humanities",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "SOC",  name: "Sociology",                              department: "Humanities",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 4, compulsory: false },
  // Principal subjects — Languages
  { code: "ENG",  name: "English Language",                       department: "Languages",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "LIT",  name: "Literature in English",                  department: "Languages",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "FRE",  name: "French",                                 department: "Languages",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  // Principal subjects — Technology
  { code: "ICT",  name: "Information & Communication Technology", department: "Technology",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
  { code: "DTS",  name: "Design & Technology Studies",            department: "Technology",             phase: "alevel", gradeFrom: 5, gradeTo: 6, periodsPerWeek: 5, compulsory: false },
];

const PHASES = [
  { value: "primary", label: "Primary (Grade 1-6)" },
  { value: "olevel",  label: "O-Level Secondary (Form 1-4)" },
  { value: "alevel",  label: "A-Level Secondary (Form 5-6)" },
];

function emptyForm(defaultPhase: string, firstDept = "") {
  return {
    code: "", name: "", department: firstDept, compulsory: "true",
    periods: "4", phase: defaultPhase, gradeFrom: "", gradeTo: "", description: "",
  };
}

function emptyDeptForm() {
  return { name: "", code: "", description: "", headTeacherId: "" };
}

function phaseFormRange(phase: string): { gradeFrom: string; gradeTo: string } {
  if (phase === "primary") return { gradeFrom: "1", gradeTo: "6" };
  if (phase === "olevel")  return { gradeFrom: "1", gradeTo: "4" };
  if (phase === "alevel")  return { gradeFrom: "5", gradeTo: "6" };
  return { gradeFrom: "", gradeTo: "" };
}

function formRangeLabel(s: any): string {
  const from = s.gradeFrom ?? 0;
  const to   = s.gradeTo   ?? 0;
  if (!from || !to) return "";
  if (s.phase === "primary") return `Gr ${from}–${to}`;
  return `Form ${from}–${to}`;
}

function SubjectsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const showPrimary  = ["PRIMARY", "COMBINED", "FULL", "NURSERY"].includes(active.type);
  const isSecondary  = ["SECONDARY", "COMBINED", "FULL"].includes(active.type);
  const defaultPhase = showPrimary && !isSecondary ? "primary" : "olevel";

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [deptSheetOpen, setDeptSheetOpen] = useState(false);
  const [deptEdit, setDeptEdit] = useState<any | null>(null);
  const [deptForm, setDeptForm] = useState(emptyDeptForm);

  // ── Data ──────────────────────────────────────────────────────
  const { data: rawDepts = [] } = useQuery({
    queryKey: ["departments", schoolId],
    queryFn: () => api.departments.list(schoolId),
  });
  const deptList = rawDepts as any[];
  const deptNames = deptList.map((d: any) => d.name);

  const { data: rawTeachers = [] } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });
  const teacherList = rawTeachers as any[];

  const [form, setForm] = useState(() => emptyForm(defaultPhase, deptNames[0] ?? ""));

  const firstDept = deptNames[0] as string | undefined;
  useEffect(() => {
    if (firstDept) setForm((prev) => prev.department === "" ? { ...prev, department: firstDept } : prev);
  }, [firstDept]);

  const { data: rawSubjects = [], isLoading } = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: () => api.subjects.list(schoolId),
  });

  const subjectList = rawSubjects as any[];

  // ── Mutations ─────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: any) => api.subjects.create(schoolId, data),
    onSuccess: (s: any) => {
      void qc.invalidateQueries({ queryKey: ["subjects", schoolId] });
      toast.success(`${s.name ?? form.name} added`);
      setForm(emptyForm(defaultPhase, deptNames[0] ?? ""));
      setAddOpen(false);
    },
    onError: () => toast.error("Failed to add subject"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.subjects.update(schoolId, id, data),
    onSuccess: (s: any) => {
      void qc.invalidateQueries({ queryKey: ["subjects", schoolId] });
      toast.success(`${s.name ?? form.name} updated`);
      setEditTarget(null);
    },
    onError: () => toast.error("Failed to update subject"),
  });

  const seedMut = useMutation({
    mutationFn: async () => {
      const toSeed = MOE_SUBJECTS.filter((s) =>
        (s.phase === "primary" && showPrimary) ||
        ((s.phase === "olevel" || s.phase === "alevel") && isSecondary),
      );
      // Auto-create any departments that don't exist yet
      const uniqueDepts = [...new Set(toSeed.map((s) => s.department))];
      const existingNames = new Set(deptList.map((d: any) => d.name));
      await Promise.all(
        uniqueDepts
          .filter((name) => !existingNames.has(name))
          .map((name) => api.departments.create(schoolId, { name })),
      );
      return api.subjects.bulk(schoolId, toSeed);
    },
    onSuccess: (created: any) => {
      void qc.invalidateQueries({ queryKey: ["subjects", schoolId] });
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      const n = Array.isArray(created) ? created.length : 0;
      toast.success(n > 0 ? `${n} MoE subjects seeded` : "All MoE subjects already present");
      setSeedConfirm(false);
    },
    onError: () => toast.error("Failed to seed subjects"),
  });

  const createDeptMut = useMutation({
    mutationFn: (data: any) => api.departments.create(schoolId, data),
    onSuccess: (d: any) => {
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      toast.success(`${d.name} department created`);
      setDeptForm(emptyDeptForm());
    },
    onError: () => toast.error("Failed to create department"),
  });

  const updateDeptMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.departments.update(schoolId, id, data),
    onSuccess: (d: any) => {
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      toast.success(`${d.name} updated`);
      setDeptEdit(null);
      setDeptForm(emptyDeptForm());
    },
    onError: () => toast.error("Failed to update department"),
  });

  const deleteDeptMut = useMutation({
    mutationFn: (id: string) => api.departments.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["departments", schoolId] });
      toast.success("Department removed");
    },
    onError: () => toast.error("Failed to remove department"),
  });

  // ── Helpers ───────────────────────────────────────────────────
  const openEdit = (s: any) => {
    setEditTarget(s);
    setForm({
      code: s.code ?? "",
      name: s.name ?? "",
      department: s.department ?? deptNames[0] ?? "",
      compulsory: String(s.compulsory ?? s.isCore ?? s.core ?? false),
      periods: String(s.periodsPerWeek ?? s.periods ?? 4),
      phase: s.phase ?? defaultPhase,
      gradeFrom: String(s.gradeFrom ?? ""),
      gradeTo:   String(s.gradeTo   ?? ""),
      description: s.description ?? "",
    });
  };

  const gradeRangeForPhase = (phase: string) => {
    if (phase === "primary") return { gradeFrom: 1, gradeTo: 6 };
    if (phase === "olevel")  return { gradeFrom: 1, gradeTo: 4 };
    if (phase === "alevel")  return { gradeFrom: 5, gradeTo: 6 };
    return { gradeFrom: 1, gradeTo: 6 };
  };

  const saveAdd = () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    createMut.mutate({
      code: form.code.toUpperCase().trim(),
      name: form.name.trim(),
      department: form.department,
      compulsory: form.compulsory === "true",
      periodsPerWeek: Number(form.periods) || 4,
      phase: form.phase,
      ...gradeRangeForPhase(form.phase),
    });
  };

  const saveEdit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    updateMut.mutate({
      id: editTarget.id,
      data: {
        name: form.name.trim(),
        department: form.department,
        compulsory: form.compulsory === "true",
        periodsPerWeek: Number(form.periods) || (editTarget.periodsPerWeek ?? 4),
        gradeFrom: form.gradeFrom ? Number(form.gradeFrom) : undefined,
        gradeTo:   form.gradeTo   ? Number(form.gradeTo)   : undefined,
        description: form.description.trim() || null,
      },
    });
  };

  // ── Split by phase ────────────────────────────────────────────
  const isOLevel = (s: any) =>
    s.phase === "olevel" ||
    s.phase === "junior" ||
    (s.phase === "secondary" && (s.gradeFrom ?? 8) <= 9);
  const isALevel = (s: any) =>
    s.phase === "alevel" ||
    s.phase === "senior" ||
    (s.phase === "secondary" && (s.gradeFrom ?? 10) >= 10);

  const primary = useMemo(() => subjectList.filter((s) => (s.phase ?? "olevel") === "primary"), [subjectList]);
  const olevel  = useMemo(() => subjectList.filter(isOLevel), [subjectList]);
  const alevel  = useMemo(() => subjectList.filter(isALevel), [subjectList]);

  // ── Stats ─────────────────────────────────────────────────────
  const totalPeriods = (list: any[]) => list.reduce((s, x) => s + (x.periodsPerWeek ?? x.periods ?? 0), 0);
  const coreCount    = (list: any[]) => list.filter((x) => x.compulsory ?? x.isCore ?? x.core).length;

  const defaultTab   = showPrimary && !isSecondary ? "primary" : "olevel";
  const [phaseTab, setPhaseTab] = useState(defaultTab);
  const activeList   = phaseTab === "primary" ? primary : phaseTab === "olevel" ? olevel : alevel;
  const hasNoSubjects = subjectList.length === 0;

  const seedCount = MOE_SUBJECTS.filter((s) =>
    (s.phase === "primary" && showPrimary) || ((s.phase === "olevel" || s.phase === "alevel") && isSecondary),
  ).length;

  // ── Grouped table ─────────────────────────────────────────────
  const SubjectTable = ({ list }: { list: any[] }) => {
    const byDept = deptNames.reduce<Record<string, any[]>>((acc: Record<string, any[]>, d: string) => {
      const rows = list.filter((s) => (s.department ?? "Other") === d);
      if (rows.length) acc[d] = rows;
      return acc;
    }, {});
    const others = list.filter((s) => !deptNames.includes(s.department ?? ""));
    if (others.length) byDept["Other"] = others;

    if (list.length === 0) {
      return (
        <EmptyState
          icon={BookOpen}
          title="No subjects in this phase yet"
          description="Use “Seed MoE curriculum” to load the Zambia 2025 ECZ syllabus."
        />
      );
    }

    return (
      <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell className="w-16">Code</TableCell>
            <TableCell>Subject</TableCell>
            <TableCell>Department</TableCell>
            <TableCell className="text-center w-20">Type</TableCell>
            <TableCell className="text-center w-24">Forms / Grades</TableCell>
            <TableCell className="text-center w-24">Periods/wk</TableCell>
            <TableCell className="w-10" />
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(byDept).map(([dept, rows]) => (
            <Fragment key={dept}>
              <TableRow className="bg-muted/30">
                <TableCell colSpan={7} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {dept}
                </TableCell>
              </TableRow>
              {rows.map((s: any) => (
                <TableRow key={s.id ?? `${s.phase}-${s.code}`}>
                  <TableCell className="font-mono text-xs font-semibold">{s.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    {s.description && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{s.description}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.department ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    {(s.compulsory ?? s.isCore ?? s.core)
                      ? <Chip size="small" label="Core" sx={{ ...badgeSx("default"), fontSize: 12 }} />
                      : <Chip size="small" label="Optional" sx={{ ...badgeSx("secondary"), fontSize: 12 }} />}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-xs text-muted-foreground">{formRangeLabel(s) || "—"}</TableCell>
                  <TableCell className="text-center tabular-nums text-sm">{s.periodsPerWeek ?? s.periods ?? 4}</TableCell>
                  <TableCell className="text-right">
                    <IconButton size="small" aria-label={`Edit ${s.name}`} onClick={() => openEdit(s)}>
                      <Pencil size={14} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      </TableContainer>
    );
  };

  if (isLoading) {
    return <LoadingState label="Loading subjects…" className="py-16" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subjects"
        description="Zambia MoE 2025 curriculum — Primary Grade 1-6 · O-Level Form 1-4 · A-Level Form 5-6 (ECZ)"
        actions={
          <>
            <Button variant="outlined" startIcon={<Building2 size={16} />} onClick={() => setDeptSheetOpen(true)}>
              Departments ({deptList.length})
            </Button>
            <Button variant="outlined" startIcon={<BookOpen size={16} />} onClick={() => setSeedConfirm(true)}>
              Seed MoE curriculum
            </Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Add subject</Button>
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Add subject</DialogTitle>
              <DialogContent>
                <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BIO" slotProps={{ htmlInput: { maxLength: 6 } }} fullWidth size="small" />
                    <TextField select label="Phase" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} fullWidth size="small">
                      {PHASES.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
                    </TextField>
                  </div>
                  <TextField label="Subject name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Biology" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                  <TextField select label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} fullWidth size="small">
                    {deptNames.length === 0
                      ? <MenuItem value="__none__" disabled>No departments — add on Departments page</MenuItem>
                      : deptNames.map((d: string) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </TextField>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField select label="Type" value={form.compulsory} onChange={(e) => setForm({ ...form, compulsory: e.target.value })} fullWidth size="small">
                      <MenuItem value="true">Core / Compulsory</MenuItem>
                      <MenuItem value="false">Optional / Elective</MenuItem>
                    </TextField>
                    <TextField label="Periods per week" type="number" slotProps={{ htmlInput: { min: 1, max: 15 } }} value={form.periods} onChange={(e) => setForm({ ...form, periods: e.target.value })} fullWidth size="small" />
                  </div>
                </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={saveAdd} disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add subject
                </Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      {/* MoE seed confirmation */}
      <Dialog open={seedConfirm} onClose={() => setSeedConfirm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Seed Zambia MoE 2025 curriculum</DialogTitle>
        <DialogContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>This will add up to <strong>{seedCount} subjects</strong> from the Zambia 2025 ECZ curriculum:</p>
            <ul className="ml-4 list-disc space-y-0.5">
              {showPrimary  && <li>10 Primary subjects (Grade 1-6) — 8 core, 2 optional</li>}
              {isSecondary  && <li>26 O-Level subjects (Form 1-4) — 6 core, 20 optional</li>}
              {isSecondary  && <li>17 A-Level subjects (Form 5-6) — 1 core (General Paper), 16 principals</li>}
            </ul>
            <p className="text-xs pt-1 border-t border-border">
              <strong>2025 key changes:</strong> Integrated Science is now split into Biology, Chemistry &amp; Physics separately. Computer Studies is replaced by ICT. CTS becomes Design &amp; Technology Studies. Grade 7 no longer exists — that cohort now enters Form 1 (secondary).
            </p>
            <p className="flex items-start gap-1.5 pt-1">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              Subjects already present (same code + phase) are skipped — no duplicates.
            </p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setSeedConfirm(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
            {seedMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Seed {seedCount} subjects
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit — {editTarget?.name}</DialogTitle>
        <DialogContent>
          <div className="overflow-y-auto flex-1 pr-1">
          <div className="grid gap-3">
            <TextField label="Subject name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
            <TextField select label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} fullWidth size="small">
              {deptNames.map((d: string) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
            <div className="grid grid-cols-2 gap-3">
              <TextField select label="Type" value={form.compulsory} onChange={(e) => setForm({ ...form, compulsory: e.target.value })} fullWidth size="small">
                <MenuItem value="true">Core / Compulsory</MenuItem>
                <MenuItem value="false">Optional / Elective</MenuItem>
              </TextField>
              <TextField label="Periods per week" type="number" slotProps={{ htmlInput: { min: 1, max: 15 } }} value={form.periods} onChange={(e) => setForm({ ...form, periods: e.target.value })} fullWidth size="small" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={form.phase === "primary" ? "Grade from" : "Form from"}
                type="number"
                slotProps={{ htmlInput: { min: 1, max: 6 } }}
                placeholder={phaseFormRange(form.phase).gradeFrom}
                value={form.gradeFrom}
                onChange={(e) => setForm({ ...form, gradeFrom: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label={form.phase === "primary" ? "Grade to" : "Form to"}
                type="number"
                slotProps={{ htmlInput: { min: 1, max: 6 } }}
                placeholder={phaseFormRange(form.phase).gradeTo}
                value={form.gradeTo}
                onChange={(e) => setForm({ ...form, gradeTo: e.target.value })}
                fullWidth
                size="small"
              />
            </div>
            <TextField
              label="Notes / description"
              multiline
              minRows={3}
              placeholder="Syllabus notes, exam board guidance, prerequisites…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              fullWidth
              size="small"
            />
          </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={updateMut.isPending}>
            {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Department management sheet ──────────────────────────── */}
      <Drawer anchor="right" open={deptSheetOpen} onClose={() => setDeptSheetOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 420 }, display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3, py: 2 }}>
            <Typography variant="h6">Departments</Typography>
            <p className="text-sm text-muted-foreground">Subject departments for {active.name}. Department names appear in the subject selector.</p>
          </Box>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Add / edit form */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {deptEdit ? `Editing — ${deptEdit.name}` : "Add department"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Name *" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="Sciences" slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth size="small" />
                <TextField label="Code" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="SCI" slotProps={{ htmlInput: { maxLength: 10 } }} fullWidth size="small" />
              </div>
              <TextField
                select
                label="Head of department"
                value={deptForm.headTeacherId || "__none__"}
                onChange={(e) => setDeptForm({ ...deptForm, headTeacherId: e.target.value === "__none__" ? "" : e.target.value })}
                fullWidth
                size="small"
              >
                <MenuItem value="__none__">— None —</MenuItem>
                {teacherList.map((t: any) => (
                  <MenuItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Description"
                multiline
                minRows={2}
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                placeholder="Brief description…"
                slotProps={{ htmlInput: { maxLength: 200 } }}
                fullWidth
                size="small"
              />
              <div className="flex gap-2 justify-end">
                {deptEdit && (
                  <Button variant="text" color="inherit" size="small" onClick={() => { setDeptEdit(null); setDeptForm(emptyDeptForm()); }}>Cancel</Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  disabled={createDeptMut.isPending || updateDeptMut.isPending}
                  onClick={() => {
                    if (!deptForm.name.trim()) { toast.error("Name is required"); return; }
                    if (deptEdit) {
                      updateDeptMut.mutate({ id: deptEdit.id, data: { name: deptForm.name.trim(), code: deptForm.code.trim() || null, headTeacherId: deptForm.headTeacherId || "", description: deptForm.description.trim() || null } });
                    } else {
                      createDeptMut.mutate({ name: deptForm.name.trim(), code: deptForm.code.trim() || null, headTeacherId: deptForm.headTeacherId || "", description: deptForm.description.trim() || null });
                    }
                  }}
                >
                  {(createDeptMut.isPending || updateDeptMut.isPending) && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  {deptEdit ? "Save changes" : "Add department"}
                </Button>
              </div>
            </div>

            {/* Existing departments list */}
            {deptList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No departments yet. Add the first one above.</p>
            ) : (
              <div className="space-y-1">
                {deptList.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.name}</span>
                        {d.code && <Chip size="small" label={d.code} sx={{ ...badgeSx("secondary"), fontSize: 12, fontFamily: "monospace" }} />}
                      </div>
                      {d.headTeacherId && (() => {
                        const head = teacherList.find((t: any) => t.id === d.headTeacherId);
                        return head ? <p className="text-xs text-muted-foreground mt-0.5">HOD: {head.firstName} {head.lastName}</p> : null;
                      })()}
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        size="small"
                        aria-label={`Edit ${d.name}`}
                        onClick={() => { setDeptEdit(d); setDeptForm({ name: d.name, code: d.code ?? "", description: d.description ?? "", headTeacherId: d.headTeacherId ?? "" }); }}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label={`Delete ${d.name}`}
                        sx={{ color: "error.main" }}
                        disabled={deleteDeptMut.isPending}
                        onClick={() => deleteDeptMut.mutate(d.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Box>
      </Drawer>

      {/* Empty state nudge */}
      {hasNoSubjects && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>No subjects configured yet. Click <strong>Seed MoE curriculum</strong> to load the full Zambia 2025 ECZ syllabus automatically.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total subjects" value={subjectList.length} accent="primary" />
        <StatCard label="Core subjects" value={coreCount(activeList)} hint="In active tab" accent="success" />
        <StatCard label="Optional subjects" value={activeList.length - coreCount(activeList)} hint="In active tab" accent="accent" />
        <StatCard label="Total periods/wk" value={totalPeriods(activeList)} hint="In active tab" accent="warning" />
      </div>

      <Tabs value={phaseTab} onChange={(_e, v) => setPhaseTab(v)} sx={{ mb: 2 }}>
        {showPrimary  && <Tab value="primary" label={`Primary — Grade 1-6 (${primary.length})`} />}
        {isSecondary  && <Tab value="olevel" label={`O-Level — Form 1-4 (${olevel.length})`} />}
        {isSecondary  && <Tab value="alevel" label={`A-Level — Form 5-6 (${alevel.length})`} />}
      </Tabs>

      {showPrimary && phaseTab === "primary" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <SubjectTable list={primary} />
        </div>
      )}
      {isSecondary && phaseTab === "olevel" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <SubjectTable list={olevel} />
        </div>
      )}
      {isSecondary && phaseTab === "alevel" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <SubjectTable list={alevel} />
        </div>
      )}
    </div>
  );
}
