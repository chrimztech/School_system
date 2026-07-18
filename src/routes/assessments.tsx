import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDotDashed,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Loader2,
  LockKeyhole,
  Plus,
  Search,
  Send,
  Scale,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { gradingBandForPercentage, useTenant, type GradingBand } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { ImportDialog, type ImportColumn, type ImportResult } from "@/components/import-dialog";
import { gradeBadgeClass } from "@/lib/utils";

export const Route = createFileRoute("/assessments")({
  head: () => ({ meta: [{ title: "Results Operations — SRMS" }] }),
  component: AssessmentsPage,
});

const typeColor: Record<string, "secondary" | "outline" | "destructive"> = {
  exam: "destructive",
  midterm: "destructive",
  cat: "secondary",
  quiz: "secondary",
  project: "outline",
  homework: "outline",
  practical: "outline",
};

const TYPES = ["cat", "quiz", "practical", "project", "homework", "midterm", "exam"] as const;
const TERM_OPTIONS = [
  { value: "1", label: "Term 1" },
  { value: "2", label: "Term 2" },
  { value: "3", label: "Term 3" },
];
const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Science",
  "Social Studies",
  "Civic Education",
  "Religious Education",
  "Physical Education",
  "French",
  "History",
  "Geography",
  "Biology",
  "Chemistry",
  "Physics",
  "Computer Studies",
  "Commerce",
  "Accounts",
  "Literature",
  "Art",
  "Music",
];
const EMPTY_ITEMS: any[] = [];

type ReportingPeriod = "MIDTERM" | "END_TERM" | "COMBINED";
type WorkflowStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "PUBLISHED";

const WORKFLOW_META: Record<
  WorkflowStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  DRAFT: {
    label: "Draft",
    className:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
    icon: CircleDotDashed,
  },
  SUBMITTED: {
    label: "Awaiting HOD",
    className:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    icon: Clock3,
  },
  VERIFIED: {
    label: "Ready to publish",
    className:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    icon: ShieldCheck,
  },
  REJECTED: {
    label: "Corrections needed",
    className:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
    icon: AlertCircle,
  },
  PUBLISHED: {
    label: "Published",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    icon: FileCheck2,
  },
};

function normalizedStatus(value: unknown): WorkflowStatus {
  const status = String(value ?? "DRAFT").toUpperCase() as WorkflowStatus;
  return WORKFLOW_META[status] ? status : "DRAFT";
}

function WorkflowBadge({ status }: { status: unknown }) {
  const meta = WORKFLOW_META[normalizedStatus(status)];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 whitespace-nowrap font-medium ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function isActionForRole(status: WorkflowStatus, role?: string) {
  if (role === "teacher") return status === "DRAFT" || status === "REJECTED";
  if (role === "hod") return status === "SUBMITTED";
  if (role === "career_guidance") return status === "VERIFIED";
  return status !== "PUBLISHED";
}

function effectiveReportingPeriod(
  assessment: any,
  publicationMode: "SEPARATE" | "COMBINED",
): ReportingPeriod {
  if (publicationMode === "COMBINED") return "COMBINED";
  if (assessment?.reportingPeriod === "MIDTERM" || assessment?.reportingPeriod === "END_TERM") {
    return assessment.reportingPeriod;
  }
  return assessment?.type === "midterm" ? "MIDTERM" : "END_TERM";
}

function computeGrade(score: number, maxScore: number, bands: GradingBand[]): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return gradingBandForPercentage(bands, pct).grade;
}

type WorkflowSummary = Record<WorkflowStatus, number>;

/**
 * A compact visual contract for the results lifecycle. It deliberately lives
 * above the queue so every role sees where a mark sheet is going next, not just
 * the action available to them today.
 */
function ReleasePipeline({
  summary,
  role,
  publicationMode,
}: {
  summary: WorkflowSummary;
  role?: string;
  publicationMode: "SEPARATE" | "COMBINED";
}) {
  const activeStage =
    role === "teacher"
      ? "capture"
      : role === "hod"
        ? "verify"
        : role === "career_guidance"
          ? "publish"
          : "families";
  const stages = [
    {
      key: "capture",
      index: "01",
      label: "Teacher capture",
      detail: "Marks saved or awaiting correction",
      count: summary.DRAFT + summary.REJECTED,
      icon: ClipboardList,
      tone: "blue",
    },
    {
      key: "verify",
      index: "02",
      label: "HOD verification",
      detail: "Locked sheets waiting for review",
      count: summary.SUBMITTED,
      icon: ShieldCheck,
      tone: "amber",
    },
    {
      key: "publish",
      index: "03",
      label: "Careers Guidance",
      detail: "Verified cycles ready to release",
      count: summary.VERIFIED,
      icon: Upload,
      tone: "violet",
    },
    {
      key: "families",
      index: "04",
      label: "Learner & family view",
      detail: "Published snapshots on report cards",
      count: summary.PUBLISHED,
      icon: Users,
      tone: "emerald",
    },
  ] as const;

  return (
    <section className="surface-card-strong overflow-hidden rounded-2xl" aria-label="Results release pipeline">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold">Release pipeline</p>
          </div>
          <p className="mt-1 pl-10 text-xs text-muted-foreground">
            Every release is verified, locked and traceable before it reaches families.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 bg-background/70 text-[10px] uppercase tracking-[0.1em]">
          <CalendarDays className="h-3 w-3" />
          {publicationMode === "SEPARATE" ? "Mid-term + end-of-term" : "Combined term"}
        </Badge>
      </div>
      <div className="grid gap-0 px-5 py-5 sm:grid-cols-4 sm:px-6">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isActive = stage.key === activeStage;
          const toneClasses = {
            blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
            amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
            emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          }[stage.tone];
          return (
            <div key={stage.key} className="relative flex gap-3 pb-5 last:pb-0 sm:block sm:pb-0 sm:pr-5">
              {index < stages.length - 1 && (
                <div className="absolute left-4 top-9 h-[calc(100%-1.7rem)] w-px bg-border sm:left-auto sm:right-0 sm:top-4 sm:h-px sm:w-[calc(100%-2.25rem)]" />
              )}
              <div className="relative z-10 flex shrink-0 items-center gap-2 sm:block">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClasses} ${isActive ? "ring-4 ring-primary/10" : ""}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground sm:absolute sm:left-10 sm:top-2">
                  {stage.index}
                </span>
              </div>
              <div className="min-w-0 sm:mt-3">
                <div className="flex items-center gap-2">
                  <p className={`truncate text-xs font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>
                    {stage.label}
                  </p>
                  {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Current stage" />}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{stage.detail}</p>
                <p className="mt-2 text-lg font-semibold tabular-nums">{stage.count}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GradingPolicySnapshot({ bands }: { bands: GradingBand[] }) {
  return (
    <section className="surface-card overflow-hidden rounded-2xl" aria-label="Configured grading policy">
      <div className="flex items-start gap-3 border-b border-border/70 bg-gradient-to-r from-emerald-500/[0.07] to-transparent px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <Scale className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Achievement scale</p>
            <Badge variant="secondary" className="text-[10px]">Admin controlled</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Zambia MoE 2023 bands are applied automatically. Teachers enter marks only.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 p-4">
        {bands.map((band) => (
          <div key={band.grade} className="rounded-xl border border-border/80 bg-background/70 px-2 py-2 text-center">
            <Badge className={`h-6 min-w-7 justify-center px-1.5 text-xs ${gradeBadgeClass(band.grade)}`}>
              {band.grade}
            </Badge>
            <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
              {band.min}–{band.max}%
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Results Recording Sheet ----------

interface ResultRow {
  studentId: string;
  studentName: string;
  score: string;
  absent: boolean;
  grade: string;
}

function resultRowsFingerprint(rows: ResultRow[]) {
  return JSON.stringify(rows.map(({ studentId, score, absent }) => ({ studentId, score, absent })));
}

function ResultsSheet({
  assessment,
  schoolId,
  classes,
  open,
  onClose,
  canManage,
}: {
  assessment: any;
  schoolId: string;
  classes: any[];
  open: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { active } = useTenant();
  const { user } = useAuth();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [publicationDialogOpen, setPublicationDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const workflowStatus = normalizedStatus(assessment?.workflowStatus);
  const canEdit = canManage && (workflowStatus === "DRAFT" || workflowStatus === "REJECTED");
  const canVerify = user?.role === "hod" && workflowStatus === "SUBMITTED";
  const canPublish = user?.role === "career_guidance" && workflowStatus === "VERIFIED";

  // Assessment.classId is stored as the class's display name (or occasionally its real id) —
  // resolve it to the real SchoolClass id before looking up enrolments.
  const resolvedClassId = useMemo(() => {
    const target = assessment?.classId ?? assessment?.class;
    if (!target) return undefined;
    const match = classes.find(
      (c: any) => c.id === target || c.name === target || c.className === target,
    );
    return match?.id ?? target;
  }, [assessment, classes]);

  const enrolmentsQuery = useQuery({
    queryKey: ["class-enrolments", schoolId, resolvedClassId],
    queryFn: () => api.classes.enrolments(schoolId, resolvedClassId),
    enabled: open && !!resolvedClassId,
  });

  const resultsQuery = useQuery({
    queryKey: ["assessment-results", schoolId, assessment?.id],
    queryFn: () => api.assessments.results(schoolId, assessment.id),
    enabled: open && !!assessment?.id,
  });
  const enrolments = useMemo(
    () =>
      ((enrolmentsQuery.data ?? EMPTY_ITEMS) as any[]).filter(
        (enrolment) =>
          String(enrolment.status ?? "ACTIVE").toUpperCase() === "ACTIVE" &&
          (!enrolment.academicYear ||
            String(enrolment.academicYear) === String(assessment?.academicYear ?? "")),
      ),
    [enrolmentsQuery.data, assessment?.academicYear],
  );
  const existingResults = (resultsQuery.data ?? EMPTY_ITEMS) as any[];
  const studentsLoading = enrolmentsQuery.isLoading;
  const resultsLoading = resultsQuery.isLoading;

  // Build rows from the class's actual enrolment roster
  useEffect(() => {
    if (!open || !assessment) return;

    const resultsMap: Record<string, any> = {};
    (existingResults as any[]).forEach((r: any) => {
      resultsMap[r.studentId] = r;
    });

    const nextRows = enrolments.map((e: any) => {
      const existing = resultsMap[e.studentId];
      const score = existing ? String(existing.score ?? "") : "";
      const absent = existing?.absent ?? false;
      const grade = absent
        ? "—"
        : (existing?.grade ??
          (score !== ""
            ? computeGrade(Number(score), assessment.maxScore, active.gradingBands)
            : ""));
      return {
        studentId: e.studentId,
        studentName: e.studentName || e.studentId,
        score,
        absent,
        grade,
      };
    });
    setRows(nextRows);
    setSavedFingerprint(resultRowsFingerprint(nextRows));
  }, [open, assessment, enrolments, existingResults, active.gradingBands]);

  const updateRow = (studentId: string, field: "score" | "absent", value: string | boolean) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        if (field === "absent") {
          return {
            ...r,
            absent: value as boolean,
            score: value ? "" : r.score,
            grade: value
              ? "—"
              : r.score !== ""
                ? computeGrade(Number(r.score), assessment.maxScore, active.gradingBands)
                : "",
          };
        }
        const score = value as string;
        const grade =
          score !== "" ? computeGrade(Number(score), assessment.maxScore, active.gradingBands) : "";
        return { ...r, score, grade };
      }),
    );
  };

  const saveMutation = useMutation({
    mutationFn: async ({ payload, submit }: { payload: any[]; submit: boolean }) => {
      await api.assessments.saveResults(schoolId, assessment.id, payload);
      if (submit) await api.assessments.submit(schoolId, assessment.id);
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["assessment-results", schoolId, assessment?.id] });
      qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success(
        variables.submit ? "Results sent to the HOD for verification" : "Results saved as a draft",
      );
      onClose();
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? "Failed to save results"),
  });

  const handleSave = (submit: boolean) => {
    const invalidRows = rows.filter(
      (r) =>
        !r.absent &&
        r.score !== "" &&
        (!Number.isFinite(Number(r.score)) ||
          Number(r.score) < 0 ||
          Number(r.score) > Number(assessment.maxScore)),
    );
    if (invalidRows.length > 0) {
      toast.error(
        `Correct ${invalidRows.length} score${invalidRows.length === 1 ? "" : "s"} outside the allowed range`,
      );
      return;
    }
    if (submit && rows.some((r) => !r.absent && r.score === "")) {
      toast.error("Enter a score or mark every remaining learner absent before sending to the HOD");
      return;
    }
    const payload = rows
      .filter((r) => r.absent || r.score !== "")
      .map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        score: r.absent ? null : Number(r.score),
        absent: r.absent,
      }));
    saveMutation.mutate({ payload, submit });
  };

  const verifyMutation = useMutation({
    mutationFn: () => api.assessments.verify(schoolId, assessment.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success("Results verified and sent to Careers Guidance");
      onClose();
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? "Verification failed"),
  });
  const rejectMutation = useMutation({
    mutationFn: (note: string) => api.assessments.reject(schoolId, assessment.id, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success("Results returned to the teacher");
      onClose();
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? "Unable to return results"),
  });
  const publishMutation = useMutation({
    mutationFn: () => api.assessments.publishCycle(schoolId, assessment.id),
    onSuccess: (result: any) => {
      void qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      void qc.invalidateQueries({ queryKey: ["published-term-grades", schoolId] });
      void qc.invalidateQueries({ queryKey: ["parent-published-term-grades", schoolId] });
      void qc.invalidateQueries({ queryKey: ["report-card-class-avg", schoolId] });
      void qc.invalidateQueries({ queryKey: ["term-grade-class-stats", schoolId] });
      void qc.invalidateQueries({ queryKey: ["parent-results", schoolId] });
      toast.success(`${result.reportCardRowsPublished ?? 0} report-card result rows published`);
      onClose();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.message ?? "Publication is blocked until every result is verified",
      ),
  });

  // Stats derived from current rows
  const stats = useMemo(() => {
    const marked = rows.filter((r) => r.absent || r.score !== "");
    const scored = rows.filter((r) => !r.absent && r.score !== "");
    const avg =
      scored.length > 0 ? scored.reduce((s, r) => s + Number(r.score), 0) / scored.length : 0;
    const passCount = scored.filter(
      (r) =>
        assessment.maxScore > 0 &&
        (Number(r.score) / assessment.maxScore) * 100 >= (active.passMark ?? 40),
    ).length;
    const passRate = scored.length > 0 ? Math.round((passCount / scored.length) * 100) : 0;

    const byGrade: Record<string, number> = Object.fromEntries(
      active.gradingBands.map((band) => [band.grade, 0]),
    );
    scored.forEach((r) => {
      if (r.grade && r.grade !== "—") byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1;
    });

    return { marked: marked.length, total: rows.length, avg, passRate, byGrade };
  }, [rows, assessment.maxScore, active.passMark, active.gradingBands]);

  const invalidCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          !r.absent &&
          r.score !== "" &&
          (!Number.isFinite(Number(r.score)) ||
            Number(r.score) < 0 ||
            Number(r.score) > Number(assessment?.maxScore)),
      ).length,
    [rows, assessment?.maxScore],
  );
  const completion = stats.total > 0 ? Math.round((stats.marked / stats.total) * 100) : 0;
  const visibleRows = useMemo(() => {
    const term = learnerSearch.trim().toLowerCase();
    return term ? rows.filter((row) => row.studentName.toLowerCase().includes(term)) : rows;
  }, [learnerSearch, rows]);
  const hasUnsavedChanges = canEdit && savedFingerprint !== resultRowsFingerprint(rows);

  const requestClose = () => {
    if (hasUnsavedChanges && !saveMutation.isPending) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  };

  const pasteScores = (studentId: string, rawText: string) => {
    const values = rawText
      .split(/[\t\r\n]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length <= 1) return false;
    const startIndex = rows.findIndex((row) => row.studentId === studentId);
    if (startIndex < 0) return false;
    let applied = 0;
    setRows((current) =>
      current.map((row, index) => {
        const value = values[index - startIndex];
        if (index < startIndex || value == null || row.absent) return row;
        applied += 1;
        return {
          ...row,
          score: value,
          grade: computeGrade(Number(value), assessment.maxScore, active.gradingBands),
        };
      }),
    );
    toast.success(
      `${Math.min(values.length, rows.length - startIndex)} scores pasted into the mark sheet`,
    );
    return true;
  };

  const csvColumns: ImportColumn[] = [
    { key: "studentName", label: "Student Name", required: true, example: "Mwansa Tembo" },
    { key: "score", label: "Score", example: "78" },
    { key: "absent", label: "Absent", example: "No" },
  ];

  const handleCsvImport = async (csvRows: Record<string, string>[]): Promise<ImportResult> => {
    const result: ImportResult = { imported: 0, errors: [] };
    const nameIndex = new Map<string, string[]>();
    rows.forEach((r) => {
      const key = r.studentName.trim().toLowerCase();
      nameIndex.set(key, [...(nameIndex.get(key) ?? []), r.studentId]);
    });

    const updates = new Map<string, { score: string; absent: boolean }>();
    csvRows.forEach((row, i) => {
      const rowNum = i + 2;
      const name = row["Student Name"]?.trim();
      if (!name) {
        result.errors.push({ row: rowNum, error: "Student Name is required" });
        return;
      }
      const matches = nameIndex.get(name.toLowerCase());
      if (!matches || matches.length === 0) {
        result.errors.push({ row: rowNum, error: `"${name}" is not on this class's roster` });
        return;
      }
      if (matches.length > 1) {
        result.errors.push({
          row: rowNum,
          error: `"${name}" matches more than one learner — resolve manually`,
        });
        return;
      }
      const absentRaw = (row["Absent"] ?? "").trim().toLowerCase();
      const absent = ["yes", "y", "true", "1"].includes(absentRaw);
      const scoreRaw = (row["Score"] ?? "").trim();
      if (!absent && scoreRaw === "") {
        result.errors.push({ row: rowNum, error: "Provide a score or mark the learner absent" });
        return;
      }
      if (!absent) {
        const score = Number(scoreRaw);
        if (!Number.isFinite(score) || score < 0 || score > Number(assessment.maxScore)) {
          result.errors.push({
            row: rowNum,
            error: `Score must be between 0 and ${assessment.maxScore}`,
          });
          return;
        }
      }
      updates.set(matches[0], { score: absent ? "" : scoreRaw, absent });
    });

    if (updates.size > 0) {
      setRows((current) =>
        current.map((r) => {
          const update = updates.get(r.studentId);
          if (!update) return r;
          return {
            ...r,
            score: update.score,
            absent: update.absent,
            grade: update.absent
              ? "—"
              : computeGrade(Number(update.score), assessment.maxScore, active.gradingBands),
          };
        }),
      );
    }
    result.imported = updates.size;
    return result;
  };

  const actionGuidance = canEdit
    ? "Complete every learner row, save as you work, then send the locked mark sheet to your HOD."
    : canVerify
      ? "Review the full mark sheet. Verify it when correct, or return it with a clear correction note."
      : canPublish
        ? "Publishing releases the complete reporting cycle to report cards and parent accounts."
        : workflowStatus === "PUBLISHED"
          ? "This is the published, read-only result record currently visible on report cards."
          : "This mark sheet is read-only at its current workflow stage.";

  const isLoading = studentsLoading || resultsLoading;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && requestClose()}>
        <SheetContent
          side="right"
          className="flex w-full max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl"
        >
          <SheetHeader className="shrink-0 border-b border-border bg-gradient-to-br from-primary/[0.07] via-card to-card px-5 py-5 text-left sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="text-base leading-snug">{assessment?.title}</SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {assessment?.classId ?? assessment?.class} ·{" "}
                  {assessment?.subjectName ?? assessment?.subject} · Max {assessment?.maxScore}{" "}
                  marks
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <WorkflowBadge status={workflowStatus} />
                  <Badge variant="secondary" className="gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    {effectiveReportingPeriod(assessment, active.resultPublicationMode).replace(
                      "_",
                      " ",
                    )}
                  </Badge>
                </div>
              </div>
              <button
                onClick={requestClose}
                className="rounded-md p-1 hover:bg-muted transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {rows.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Mark sheet completion
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {stats.marked} of {stats.total} learner results captured
                    </p>
                  </div>
                  <p className="text-2xl font-semibold tracking-tight">{completion}%</p>
                </div>
                <Progress value={completion} className="mb-4 h-2" />
                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <div className="rounded-lg bg-muted/50 px-3 py-1.5">
                    <p className="text-lg font-bold leading-tight">
                      {stats.marked}/{stats.total}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Marked</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-1.5">
                    <p className="text-lg font-bold leading-tight text-emerald-600">
                      {stats.avg > 0 ? stats.avg.toFixed(1) : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Avg score</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-1.5">
                    <p
                      className={`text-lg font-bold leading-tight ${stats.passRate >= 70 ? "text-emerald-600" : stats.passRate >= 50 ? "text-amber-600" : "text-destructive"}`}
                    >
                      {stats.marked > 0 ? `${stats.passRate}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Pass rate</p>
                  </div>
                  {stats.marked > 0 && (
                    <div className="ml-auto flex items-end gap-1.5">
                      {Object.entries(stats.byGrade).map(
                        ([g, count]) =>
                          count > 0 && (
                            <Badge
                              key={g}
                              variant="outline"
                              className={`gap-1 ${gradeBadgeClass(g)}`}
                            >
                              {g}
                              <span className="font-bold">{count}</span>
                            </Badge>
                          ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-3 flex gap-2 rounded-xl border border-primary/15 bg-primary/[0.06] p-3 text-xs leading-5 text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{actionGuidance}</p>
            </div>
            {assessment?.reviewNote && (
              <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                HOD correction note: {assessment.reviewNote}
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto bg-muted/15">
            {!isLoading && rows.length > 0 && (
              <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-3 backdrop-blur sm:px-7">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={learnerSearch}
                    onChange={(event) => setLearnerSearch(event.target.value)}
                    placeholder="Find a learner…"
                    className="h-9 bg-background pl-9"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {canEdit && (
                    <>
                      <span className="hidden lg:inline">
                        Paste a spreadsheet column or press Enter to move down
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setCsvImportOpen(true)}
                      >
                        <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                        Import CSV
                      </Button>
                    </>
                  )}
                  {hasUnsavedChanges && (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                    >
                      Unsaved
                    </Badge>
                  )}
                  {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
                  <span>
                    {visibleRows.length} learner{visibleRows.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading students…</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
                <Users className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  No students found for class "{assessment?.classId ?? assessment?.class}"
                </p>
                <p className="text-xs opacity-60">Make sure students are enrolled in this class</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-center">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-28">Score /{assessment?.maxScore}</TableHead>
                    <TableHead className="w-16 text-center">Grade</TableHead>
                    <TableHead className="w-16 text-center">Absent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r, i) => {
                    const invalid =
                      !r.absent &&
                      r.score !== "" &&
                      (Number(r.score) < 0 || Number(r.score) > Number(assessment?.maxScore));
                    return (
                      <TableRow
                        key={r.studentId}
                        className={`transition-colors hover:bg-muted/40 ${r.absent ? "opacity-55" : ""} ${invalid ? "bg-destructive/[0.06]" : ""}`}
                      >
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{r.studentName}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={assessment?.maxScore}
                            value={r.score}
                            disabled={r.absent || !canEdit}
                            onChange={(e) => updateRow(r.studentId, "score", e.target.value)}
                            onPaste={(event) => {
                              if (pasteScores(r.studentId, event.clipboardData.getData("text")))
                                event.preventDefault();
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              const inputs = Array.from(
                                document.querySelectorAll<HTMLInputElement>(
                                  '[data-result-score="true"]',
                                ),
                              );
                              const currentIndex = inputs.indexOf(event.currentTarget);
                              inputs[currentIndex + 1]?.focus();
                              inputs[currentIndex + 1]?.select();
                            }}
                            data-result-score="true"
                            className={`h-9 w-24 text-sm tabular-nums ${invalid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                            placeholder="0"
                            aria-invalid={invalid}
                            aria-label={`${r.studentName} score out of ${assessment?.maxScore}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {r.grade ? (
                            <Badge className={gradeBadgeClass(r.grade)}>{r.grade}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={r.absent}
                            disabled={!canEdit}
                            onCheckedChange={(checked) =>
                              updateRow(r.studentId, "absent", !!checked)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        No learners match “{learnerSearch}”.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {rows.length > 0 && (
            <div className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-xs text-muted-foreground">
                  {invalidCount > 0 ? (
                    <span className="font-medium text-destructive">
                      Resolve {invalidCount} invalid score{invalidCount === 1 ? "" : "s"} before
                      saving.
                    </span>
                  ) : canEdit && stats.marked !== stats.total ? (
                    <span>
                      {stats.total - stats.marked} learner result
                      {stats.total - stats.marked === 1 ? "" : "s"} still outstanding.
                    </span>
                  ) : canEdit ? (
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      Complete and ready to send for verification.
                    </span>
                  ) : (
                    <span>Changes are locked at this workflow stage.</span>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={requestClose}>
                    {canEdit ? "Cancel" : "Close"}
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => handleSave(false)}
                      disabled={saveMutation.isPending || invalidCount > 0}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Save draft
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      onClick={() => handleSave(true)}
                      disabled={
                        saveMutation.isPending || stats.marked !== stats.total || invalidCount > 0
                      }
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send to HOD
                    </Button>
                  )}
                  {canVerify && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setReturnDialogOpen(true)}
                        disabled={rejectMutation.isPending}
                      >
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Return to teacher
                      </Button>
                      <Button
                        onClick={() => verifyMutation.mutate()}
                        disabled={verifyMutation.isPending || invalidCount > 0}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Verify results
                      </Button>
                    </>
                  )}
                  {canPublish && (
                    <Button
                      onClick={() => setPublicationDialogOpen(true)}
                      disabled={publishMutation.isPending}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Publish reporting cycle
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        title="Import results from CSV"
        entityName="result"
        columns={csvColumns}
        onImport={handleCsvImport}
      />

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Discard unsaved marks?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              Scores changed in this mark sheet have not been saved. Closing now will permanently
              discard those edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDiscardDialogOpen(false);
                onClose();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Return results for correction</DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              Give the teacher a specific, actionable note. The mark sheet will unlock for
              correction.
            </p>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hod-return-note">Correction note</Label>
            <Textarea
              id="hod-return-note"
              value={returnNote}
              onChange={(event) => setReturnNote(event.target.value)}
              placeholder="For example: Recheck Chanda Mwila's score against question 4 and complete the two missing learner rows."
              rows={4}
              maxLength={500}
            />
            <p className="text-right text-[11px] text-muted-foreground">{returnNote.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!returnNote.trim() || rejectMutation.isPending}
              onClick={() =>
                rejectMutation.mutate(returnNote.trim(), {
                  onSuccess: () => {
                    setReturnDialogOpen(false);
                    setReturnNote("");
                  },
                })
              }
            >
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Return to teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={publicationDialogOpen} onOpenChange={setPublicationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Upload className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Publish this reporting cycle?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6">
              This publishes every verified result in the class cycle and makes the report cards
              visible to parents. The published snapshot is locked for audit integrity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">
              {assessment?.classId ?? assessment?.class} ·{" "}
              {assessment?.term ? `Term ${assessment.term}` : "Current term"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {effectiveReportingPeriod(assessment, active.resultPublicationMode).replace("_", " ")}{" "}
              release
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish to report cards
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------- Main Page ----------

function AssessmentsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user, can } = useAuth();
  const isTeacher = user?.role === "teacher";
  const isHOD = user?.role === "hod";
  const teacherEmail = isTeacher ? user.email : undefined;
  const loggedInTeacherName = isTeacher || isHOD ? (user?.name ?? "") : "";
  const canManage = can("assessments") === true;
  const qc = useQueryClient();

  // Teachers are scoped to the subjects they're actually assigned to teach — not the
  // school's full subject catalogue — matching what the backend now enforces for writes.
  const { data: teacherAssignments = [] } = useQuery({
    queryKey: ["teacher-assignments", schoolId, teacherEmail],
    queryFn: () => api.classes.assignments(schoolId, teacherEmail as string),
    enabled: isTeacher && !!teacherEmail,
  });
  const subjectOptions: string[] = isTeacher
    ? Array.from(new Set((teacherAssignments as any[]).map((a) => a.subjectName).filter(Boolean)))
    : [...SUBJECTS];

  const { data: classesData = [] } = useQuery({
    queryKey: ["classes", schoolId, teacherEmail],
    queryFn: () => api.classes.list(schoolId, teacherEmail),
  });
  const classList = (classesData as any[])
    .map((c: any) => c.name || c.className || c.id)
    .filter(Boolean);

  const [open, setOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueView, setQueueView] = useState<"ACTION" | "ALL" | "PUBLISHED">("ACTION");
  const [statusFilter, setStatusFilter] = useState<"ALL" | WorkflowStatus>("ALL");
  const [cycleFilter, setCycleFilter] = useState<"ALL" | ReportingPeriod>("ALL");

  const [form, setForm] = useState({
    title: "",
    classId: "",
    type: "cat" as (typeof TYPES)[number],
    subject: SUBJECTS[0],
    teacherAssigned: loggedInTeacherName,
    term: String(active.currentTerm ?? "1"),
    maxScore: "40",
    weight: "10",
    date: new Date().toISOString().slice(0, 10),
    totalStudents: "32",
    rubricDescription: "",
    submissionMode: "Written",
    durationMinutes: "60",
    syllabusReference: "",
    gradingScheme: "Zambia MoE 2023",
    retakeAllowed: "no",
    markingCompletedBy: "",
    reportingPeriod: (active.resultPublicationMode === "COMBINED" ? "COMBINED" : "END_TERM") as
      | "MIDTERM"
      | "END_TERM"
      | "COMBINED",
  });

  const firstClass = classList[0] as string | undefined;
  useEffect(() => {
    if (firstClass)
      setForm((prev) => (prev.classId === "" ? { ...prev, classId: firstClass } : prev));
  }, [firstClass]);
  useEffect(() => {
    if (loggedInTeacherName)
      setForm((prev) =>
        prev.teacherAssigned === "" ? { ...prev, teacherAssigned: loggedInTeacherName } : prev,
      );
  }, [loggedInTeacherName]);
  useEffect(() => {
    if (isTeacher && subjectOptions.length > 0 && !subjectOptions.includes(form.subject)) {
      setForm((prev) => ({ ...prev, subject: subjectOptions[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, subjectOptions.join("|")]);

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ["assessments", schoolId],
    queryFn: () => api.assessments.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.assessments.create(schoolId, data),
    onSuccess: (a: any) => {
      qc.invalidateQueries({ queryKey: ["assessments", schoolId] });
      toast.success(`Assessment "${a.title}" created`);
      setForm({
        title: "",
        classId: firstClass ?? "",
        type: "cat",
        subject: subjectOptions[0] ?? SUBJECTS[0],
        teacherAssigned: loggedInTeacherName,
        term: String(active.currentTerm ?? "1"),
        maxScore: "40",
        weight: "10",
        date: new Date().toISOString().slice(0, 10),
        totalStudents: "32",
        rubricDescription: "",
        submissionMode: "Written",
        durationMinutes: "60",
        syllabusReference: "",
        gradingScheme: "Zambia MoE 2023",
        retakeAllowed: "no",
        markingCompletedBy: "",
        reportingPeriod: active.resultPublicationMode === "COMBINED" ? "COMBINED" : "END_TERM",
      });
      setOpen(false);
    },
    onError: () => toast.error("Failed to create assessment"),
  });

  const addAssessment = () => {
    if (!form.title.trim()) {
      toast.error("Assessment title is required");
      return;
    }
    if (!form.classId) {
      toast.error("Select a class");
      return;
    }
    if (!form.subject) {
      toast.error("Select a subject");
      return;
    }
    createMutation.mutate({
      title: form.title,
      classId: form.classId,
      type: form.type,
      subjectName: form.subject,
      teacherAssigned: form.teacherAssigned.trim() || null,
      term: form.term,
      academicYear: String(active.currentYear ?? new Date().getFullYear()),
      maxScore: Number(form.maxScore) || 40,
      weight: Number(form.weight) || 10,
      date: form.date,
      totalStudents: Number(form.totalStudents) || 32,
      rubricDescription: form.rubricDescription.trim() || null,
      submissionMode: form.submissionMode,
      durationMinutes: Number(form.durationMinutes) || null,
      syllabusReference: form.syllabusReference.trim() || null,
      gradingScheme: form.gradingScheme,
      reportingPeriod:
        active.resultPublicationMode === "COMBINED" ? "COMBINED" : form.reportingPeriod,
      retakeAllowed: form.retakeAllowed === "yes",
      markingCompletedBy: form.markingCompletedBy.trim() || null,
    });
  };

  const assessmentList = assessments as any[];
  const workflowSummary = useMemo(
    () =>
      assessmentList.reduce(
        (summary, assessment) => {
          const status = normalizedStatus(assessment.workflowStatus);
          summary[status] += 1;
          return summary;
        },
        { DRAFT: 0, SUBMITTED: 0, VERIFIED: 0, REJECTED: 0, PUBLISHED: 0 } as Record<
          WorkflowStatus,
          number
        >,
      ),
    [assessmentList],
  );
  const actionQueueCount = useMemo(
    () =>
      assessmentList.filter((assessment) =>
        isActionForRole(normalizedStatus(assessment.workflowStatus), user?.role),
      ).length,
    [assessmentList, user?.role],
  );

  const filteredAssessments = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return assessmentList.filter((assessment) => {
      const status = normalizedStatus(assessment.workflowStatus);
      const cycle = effectiveReportingPeriod(assessment, active.resultPublicationMode);
      const matchesQueue =
        queueView === "ALL" ||
        (queueView === "PUBLISHED" ? status === "PUBLISHED" : isActionForRole(status, user?.role));
      const matchesSearch =
        !term ||
        [
          assessment.title,
          assessment.classId,
          assessment.class,
          assessment.subjectName,
          assessment.subject,
          assessment.teacherAssigned,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );
      return (
        matchesQueue &&
        matchesSearch &&
        (statusFilter === "ALL" || status === statusFilter) &&
        (cycleFilter === "ALL" || cycle === cycleFilter)
      );
    });
  }, [
    active.resultPublicationMode,
    assessmentList,
    cycleFilter,
    queueView,
    searchQuery,
    statusFilter,
    user?.role,
  ]);
  const hasListFilters =
    searchQuery.trim().length > 0 || statusFilter !== "ALL" || cycleFilter !== "ALL";
  const actionQueueIsEmpty = queueView === "ACTION" && !hasListFilters;

  const roleWorkspace = isTeacher
    ? {
        eyebrow: "Teacher workspace",
        title: "Capture complete and accurate marks",
        description:
          "Your drafts remain private until every learner has a score or is marked absent.",
        icon: ClipboardList,
      }
    : isHOD
      ? {
          eyebrow: "HOD review desk",
          title: `${workflowSummary.SUBMITTED} submission${workflowSummary.SUBMITTED === 1 ? "" : "s"} awaiting review`,
          description: "Verify clean mark sheets or return them with specific correction notes.",
          icon: ShieldCheck,
        }
      : user?.role === "career_guidance"
        ? {
            eyebrow: "Careers Guidance release desk",
            title: `${workflowSummary.VERIFIED} cycle item${workflowSummary.VERIFIED === 1 ? "" : "s"} ready`,
            description:
              "Publish only after the complete class cycle has passed departmental verification.",
            icon: Upload,
          }
        : {
            eyebrow: "Results operations",
            title: "One controlled path from marks to report cards",
            description:
              "Monitor capture, verification and publication from a single audit-ready workspace.",
            icon: ClipboardCheck,
          };
  const RoleIcon = roleWorkspace.icon;
  const actionLabelFor = (assessment: any) => {
    const status = normalizedStatus(assessment.workflowStatus);
    if (isTeacher && (status === "DRAFT" || status === "REJECTED"))
      return status === "REJECTED" ? "Correct mark sheet" : "Enter results";
    if (isHOD && status === "SUBMITTED") return "Review submission";
    if (user?.role === "career_guidance" && status === "VERIFIED") return "Review & publish";
    return status === "PUBLISHED" ? "View published results" : "Open mark sheet";
  };

  return (
    <AccessGuard module="assessments">
      <div className="space-y-6">
        <PageHeader
          title="Results Operations"
          description="A controlled, role-based path from classroom marks to published learner reports."
          actions={
            <>
              <Button variant="outline" asChild>
                <Link to="/report-card" search={{ studentId: "" }}>
                  <FileText className="mr-2 h-4 w-4" /> Report cards
                </Link>
              </Button>
              {canManage && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Add assessment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b border-border bg-gradient-to-r from-primary/[0.08] to-transparent px-6 py-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <DialogTitle>Create assessment</DialogTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Define the mark sheet and reporting cycle. Grading is applied
                            automatically from the admin policy.
                          </p>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="grid max-h-[68vh] grid-cols-1 gap-4 overflow-y-auto p-6 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label>Assessment title *</Label>
                        <Input
                          className="mt-1"
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          placeholder="e.g. Form 3A — Term 1 Maths CAT"
                          maxLength={120}
                        />
                      </div>
                      <div>
                        <Label>Class</Label>
                        <Select
                          value={form.classId}
                          onValueChange={(v) => setForm({ ...form, classId: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classList.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={form.type}
                          onValueChange={(v) =>
                            setForm({
                              ...form,
                              type: v as typeof form.type,
                              reportingPeriod:
                                active.resultPublicationMode === "COMBINED"
                                  ? "COMBINED"
                                  : v === "midterm"
                                    ? "MIDTERM"
                                    : form.reportingPeriod,
                            })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Subject</Label>
                        <Select
                          value={form.subject}
                          onValueChange={(v) => setForm({ ...form, subject: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {subjectOptions.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Term</Label>
                        <Select
                          value={form.term}
                          onValueChange={(v) => setForm({ ...form, term: v })}
                        >
                          <SelectTrigger className="mt-1">
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
                          <Label>Reporting cycle</Label>
                          <Select
                            value={form.reportingPeriod}
                            onValueChange={(v) =>
                              setForm({ ...form, reportingPeriod: v as "MIDTERM" | "END_TERM" })
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MIDTERM">Mid-term</SelectItem>
                              <SelectItem value="END_TERM">End-of-term</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label>Teacher assigned</Label>
                        <Input
                          className="mt-1"
                          value={form.teacherAssigned}
                          onChange={(e) => setForm({ ...form, teacherAssigned: e.target.value })}
                          placeholder="Teacher name"
                          readOnly={isTeacher}
                          title={isTeacher ? "Auto-filled from your account" : undefined}
                          maxLength={80}
                        />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input
                          className="mt-1"
                          type="date"
                          value={form.date}
                          onChange={(e) => setForm({ ...form, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Max score</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          value={form.maxScore}
                          onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                          min={1}
                          max={200}
                        />
                      </div>
                      <div>
                        <Label>Weight (%)</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          value={form.weight}
                          onChange={(e) => setForm({ ...form, weight: e.target.value })}
                          min={0}
                          max={100}
                        />
                      </div>
                      <div>
                        <Label>Duration (min)</Label>
                        <Input
                          className="mt-1"
                          type="number"
                          value={form.durationMinutes}
                          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                          min={0}
                        />
                      </div>
                      <div>
                        <Label>Grading scheme</Label>
                        <Input
                          className="mt-1"
                          value="Zambia MoE 2023 (admin configured)"
                          readOnly
                        />
                      </div>
                      <div>
                        <Label>Retake allowed</Label>
                        <Select
                          value={form.retakeAllowed}
                          onValueChange={(v) => setForm({ ...form, retakeAllowed: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes — one retake</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Marking completed by</Label>
                        <Input
                          className="mt-1"
                          value={form.markingCompletedBy}
                          onChange={(e) => setForm({ ...form, markingCompletedBy: e.target.value })}
                          placeholder="Mrs. Phiri"
                          maxLength={80}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Syllabus reference / topic coverage</Label>
                        <Input
                          className="mt-1"
                          value={form.syllabusReference}
                          onChange={(e) => setForm({ ...form, syllabusReference: e.target.value })}
                          placeholder="e.g. ECZ Maths Syl. 4024 · Topics: Algebra, Simultaneous equations"
                          maxLength={200}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Rubric / marking scheme description</Label>
                        <Input
                          className="mt-1"
                          value={form.rubricDescription}
                          onChange={(e) => setForm({ ...form, rubricDescription: e.target.value })}
                          placeholder="e.g. Section A: 20 marks (MCQ), Section B: 20 marks (structured)"
                          maxLength={250}
                        />
                      </div>
                    </div>
                    <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4">
                      <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addAssessment} disabled={createMutation.isPending}>
                        {createMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Create assessment
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[1.35fr,0.65fr]">
          <ReleasePipeline
            summary={workflowSummary}
            role={user?.role}
            publicationMode={active.resultPublicationMode}
          />
          <GradingPolicySnapshot bands={active.gradingBands} />
        </div>

        <section className="surface-card-strong rounded-2xl px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <RoleIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {roleWorkspace.eyebrow}
                  </p>
                  <span className="hidden text-border sm:inline">/</span>
                  <p className="text-xs text-muted-foreground">
                    Term {active.currentTerm}, {active.currentYear} ·{" "}
                    {active.resultPublicationMode === "SEPARATE"
                      ? "Separate releases"
                      : "Combined release"}
                  </p>
                </div>
                <p className="mt-1 truncate text-sm font-semibold sm:text-base">
                  {roleWorkspace.title}
                </p>
                <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                  {roleWorkspace.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-border overflow-hidden rounded-xl border border-border/80 bg-background/70 xl:min-w-[430px]">
              {[
                { label: "My queue", value: actionQueueCount, tone: "text-primary" },
                { label: "Submitted", value: workflowSummary.SUBMITTED, tone: "text-amber-600" },
                { label: "Ready", value: workflowSummary.VERIFIED, tone: "text-blue-600" },
                { label: "Published", value: workflowSummary.PUBLISHED, tone: "text-emerald-600" },
              ].map((metric) => (
                <div key={metric.label} className="px-2 py-2.5 text-center sm:px-3">
                  <p className={`text-base font-semibold tabular-nums ${metric.tone}`}>
                    {metric.value}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Assessment list */}
        <div className="surface-card flex flex-col gap-2 rounded-2xl p-2 lg:flex-row lg:items-center">
          <div className="grid grid-cols-3 rounded-xl bg-muted/70 p-1 lg:w-auto lg:shrink-0">
            {[
              { value: "ACTION" as const, label: "My action", count: actionQueueCount },
              { value: "ALL" as const, label: "All", count: assessmentList.length },
              {
                value: "PUBLISHED" as const,
                label: "Published",
                count: workflowSummary.PUBLISHED,
              },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={queueView === item.value}
                onClick={() => {
                  setQueueView(item.value);
                  setStatusFilter("ALL");
                }}
                className={`flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${
                  queueView === item.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                    queueView === item.value ? "bg-primary/10 text-primary" : "bg-background/60"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, class, subject or teacher…"
              className="h-10 border-0 bg-muted/60 pl-9 shadow-none focus-visible:ring-1"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as "ALL" | WorkflowStatus);
                if (value !== "ALL") setQueueView("ALL");
              }}
            >
              <SelectTrigger className="h-10 w-[170px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All workflow stages</SelectItem>
                {(Object.keys(WORKFLOW_META) as WorkflowStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {WORKFLOW_META[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cycleFilter}
              onValueChange={(value) => setCycleFilter(value as "ALL" | ReportingPeriod)}
            >
              <SelectTrigger className="h-10 w-[160px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All reporting cycles</SelectItem>
                {active.resultPublicationMode === "SEPARATE" ? (
                  <>
                    <SelectItem value="MIDTERM">Mid-term</SelectItem>
                    <SelectItem value="END_TERM">End-of-term</SelectItem>
                  </>
                ) : (
                  <SelectItem value="COMBINED">Combined term</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="h-8 px-3">
              {filteredAssessments.length} shown
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:hidden">
          {filteredAssessments.map((assessment: any) => {
            const submitted = assessment.submittedCount ?? assessment.submitted ?? 0;
            const total = assessment.totalStudents ?? assessment.total ?? 0;
            const progress =
              total > 0
                ? Math.min(Math.round((submitted / total) * 100), 100)
                : submitted > 0
                  ? 100
                  : 0;
            return (
              <button
                key={assessment.id}
                type="button"
                onClick={() => setSelectedAssessment(assessment)}
                className="surface-card interactive-card rounded-2xl p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{assessment.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {assessment.subjectName ?? assessment.subject} ·{" "}
                      {assessment.classId ?? assessment.class}
                    </p>
                  </div>
                  <WorkflowBadge status={assessment.workflowStatus} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Cycle</p>
                    <p className="mt-1 font-medium">
                      {effectiveReportingPeriod(assessment, active.resultPublicationMode).replace(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Type</p>
                    <p className="mt-1 font-medium uppercase">{assessment.type}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase text-muted-foreground">Weight</p>
                    <p className="mt-1 font-medium tabular-nums">{assessment.weight}%</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Results captured</span>
                    <span className="tabular-nums">
                      {submitted}/{total || submitted || 0}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                  <span className="text-xs font-medium text-primary">
                    {actionLabelFor(assessment)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </div>
              </button>
            );
          })}
          {filteredAssessments.length === 0 && (
            <div className="surface-card rounded-2xl p-8 text-center">
              {actionQueueIsEmpty ? (
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
              ) : (
                <Search className="mx-auto h-6 w-6 text-muted-foreground" />
              )}
              <p className="mt-3 text-sm font-medium">
                {actionQueueIsEmpty ? "You're all caught up" : "No matching assessments"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {actionQueueIsEmpty
                  ? "There are no result sheets waiting for your action."
                  : "Try another stage, cycle or search term."}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setCycleFilter("ALL");
                  setQueueView(actionQueueIsEmpty ? "ALL" : "ACTION");
                }}
              >
                {actionQueueIsEmpty ? "Show all assessments" : "Reset view"}
              </Button>
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading assessments…</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssessments.map((a: any) => {
                  const submitted = a.submittedCount ?? a.submitted ?? 0;
                  const total = a.totalStudents ?? a.total ?? 0;
                  const hasResults = submitted > 0;
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedAssessment(a)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {a.title}
                          {hasResults && (
                            <ClipboardList className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{a.classId ?? a.class}</TableCell>
                      <TableCell>
                        <Badge variant={typeColor[a.type] ?? "outline"}>{a.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {effectiveReportingPeriod(a, active.resultPublicationMode).replace(
                          "_",
                          " ",
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {a.subjectName ?? a.subject}
                      </TableCell>
                      <TableCell>{a.maxScore}</TableCell>
                      <TableCell>{a.weight}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(a.date ?? "").slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        {hasResults ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {submitted}/{total || submitted}
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: `${total > 0 ? Math.min((submitted / total) * 100, 100) : 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Not recorded</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <WorkflowBadge status={a.workflowStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="whitespace-nowrap text-xs text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedAssessment(a);
                          }}
                        >
                          {actionLabelFor(a)}
                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAssessments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                            actionQueueIsEmpty
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {actionQueueIsEmpty ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Search className="h-5 w-5" />
                          )}
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          {actionQueueIsEmpty
                            ? "You're all caught up"
                            : "No assessments match this view"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {actionQueueIsEmpty
                            ? "There are no result sheets waiting for your action."
                            : "Try another workflow stage, reporting cycle or search term."}
                        </p>
                        {(actionQueueIsEmpty || hasListFilters) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setSearchQuery("");
                              setStatusFilter("ALL");
                              setCycleFilter("ALL");
                              setQueueView(actionQueueIsEmpty ? "ALL" : "ACTION");
                            }}
                          >
                            {actionQueueIsEmpty ? "Show all assessments" : "Reset view"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {selectedAssessment && (
        <ResultsSheet
          assessment={selectedAssessment}
          schoolId={schoolId}
          classes={classesData as any[]}
          open={!!selectedAssessment}
          onClose={() => setSelectedAssessment(null)}
          canManage={canManage}
        />
      )}
    </AccessGuard>
  );
}
