import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  Box,
  Button,
  Chip,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
} from "@mui/material";

import { AccessGuard } from "@/components/access-guard";
import { PageHeader, StatCard } from "@/components/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RESULT_APPROVAL_ROLES } from "@/lib/route-access";
import { useTenant } from "@/lib/tenant";
import { badgeSx, type BadgeTone } from "@/lib/utils";
import { ResultsSheet } from "@/routes/assessments";

export const Route = createFileRoute("/results-approvals")({
  head: () => ({ meta: [{ title: "Result Approvals - SRMS" }] }),
  component: ResultsApprovalsPage,
});

type WorkflowStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "PUBLISHED";
type QueueView = "ACTION" | "PIPELINE" | "PUBLISHED";
type AssessmentRecord = {
  id: string;
  title: string;
  workflowStatus?: string;
  classId?: string;
  class?: string;
  subjectName?: string;
  subject?: string;
  teacherAssigned?: string;
  reportingPeriod?: string;
  term?: string;
  academicYear?: string;
};

const EMPTY_ASSESSMENTS: AssessmentRecord[] = [];
const EMPTY_CLASSES: Array<Record<string, unknown>> = [];

const STATUS_META: Record<WorkflowStatus, { label: string; tone: BadgeTone; action: string }> = {
  DRAFT: { label: "Teacher draft", tone: "secondary", action: "View mark sheet" },
  SUBMITTED: { label: "Awaiting HOD", tone: "warning", action: "Review submission" },
  VERIFIED: { label: "Ready to publish", tone: "default", action: "Review and publish" },
  REJECTED: { label: "Returned", tone: "destructive", action: "View correction note" },
  PUBLISHED: { label: "Published", tone: "success", action: "View published sheet" },
};

function statusOf(value: unknown): WorkflowStatus {
  const status = String(value ?? "DRAFT").toUpperCase() as WorkflowStatus;
  return STATUS_META[status] ? status : "DRAFT";
}

function roleActionStatuses(role?: string): WorkflowStatus[] {
  if (role === "hod") return ["SUBMITTED"];
  if (role === "career_guidance") return ["VERIFIED"];
  return ["SUBMITTED", "VERIFIED"];
}

function reportingPeriod(assessment: AssessmentRecord, mode: "SEPARATE" | "COMBINED") {
  if (mode === "COMBINED") return "Combined term";
  if (assessment.reportingPeriod === "MIDTERM") return "Mid-term";
  return "End-of-term";
}

function ResultsApprovalsPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const schoolId = active.id;
  const [view, setView] = useState<QueueView>("ACTION");
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentRecord | null>(null);

  const assessmentsQuery = useQuery({
    queryKey: ["assessments", schoolId],
    queryFn: () => api.assessments.list(schoolId),
  });
  const classesQuery = useQuery({
    queryKey: ["classes", schoolId, "result-approvals"],
    queryFn: () => api.classes.list(schoolId),
  });

  const assessments = useMemo(
    () => (assessmentsQuery.data ?? EMPTY_ASSESSMENTS) as AssessmentRecord[],
    [assessmentsQuery.data],
  );
  const classes = useMemo(
    () => (classesQuery.data ?? EMPTY_CLASSES) as Array<Record<string, unknown>>,
    [classesQuery.data],
  );
  const summary = useMemo(
    () =>
      assessments.reduce(
        (counts, assessment) => {
          counts[statusOf(assessment.workflowStatus)] += 1;
          return counts;
        },
        { DRAFT: 0, SUBMITTED: 0, VERIFIED: 0, REJECTED: 0, PUBLISHED: 0 } as Record<
          WorkflowStatus,
          number
        >,
      ),
    [assessments],
  );
  const actionableStatuses = useMemo(() => roleActionStatuses(user?.role), [user?.role]);
  const visible = useMemo(
    () =>
      assessments.filter((assessment) => {
        const status = statusOf(assessment.workflowStatus);
        if (view === "ACTION") return actionableStatuses.includes(status);
        if (view === "PUBLISHED") return status === "PUBLISHED";
        return status !== "DRAFT";
      }),
    [actionableStatuses, assessments, view],
  );
  const actionCount = assessments.filter((assessment) =>
    actionableStatuses.includes(statusOf(assessment.workflowStatus)),
  ).length;
  const isLoading = assessmentsQuery.isLoading || classesQuery.isLoading;
  const hasError = assessmentsQuery.isError || classesQuery.isError;

  const roleDescription =
    user?.role === "hod"
      ? "Review submitted mark sheets for your department, verify accurate results, or return them with a correction note."
      : user?.role === "career_guidance"
        ? "Release HOD-verified reporting cycles to learner report cards and parent accounts."
        : "Monitor result verification and publication across the school. Approval actions remain separated by assigned role.";

  return (
    <AccessGuard module="assessments" allowedRoles={RESULT_APPROVAL_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title="Result Approvals"
          description={roleDescription}
          actions={
            <Button variant="outlined" component={Link} to="/assessments">
              Open results operations
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="My approval queue"
            value={actionCount}
            accent="primary"
            icon={<ClipboardCheck className="h-4 w-4" />}
          />
          <StatCard
            label="Awaiting HOD"
            value={summary.SUBMITTED}
            accent="warning"
            icon={<Clock3 className="h-4 w-4" />}
          />
          <StatCard
            label="Ready to publish"
            value={summary.VERIFIED}
            accent="accent"
            icon={<Upload className="h-4 w-4" />}
          />
          <StatCard
            label="Published"
            value={summary.PUBLISHED}
            accent="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>

        <Box className="border-b border-border">
          <Tabs value={view} onChange={(_event, value: QueueView) => setView(value)}>
            <Tab value="ACTION" label={`My queue (${actionCount})`} />
            <Tab
              value="PIPELINE"
              label={`Approval pipeline (${summary.SUBMITTED + summary.VERIFIED + summary.REJECTED})`}
            />
            <Tab value="PUBLISHED" label={`Published (${summary.PUBLISHED})`} />
          </Tabs>
        </Box>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading approval queue...
          </div>
        ) : hasError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
            <div>
              <p className="font-semibold">The approval queue could not be loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the API connection and try again.
              </p>
            </div>
            <Button
              variant="outlined"
              startIcon={<RefreshCw size={16} />}
              onClick={() => {
                void assessmentsQuery.refetch();
                void classesQuery.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">
                {view === "ACTION" ? "Your approval queue is clear" : "No results in this view"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {view === "ACTION"
                  ? "New submissions appear here automatically when they reach your stage of the workflow."
                  : "Change the view or open Results Operations to inspect draft mark sheets."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {visible.map((assessment) => {
                const status = statusOf(assessment.workflowStatus);
                const meta = STATUS_META[status];
                return (
                  <button
                    key={assessment.id}
                    type="button"
                    onClick={() => setSelectedAssessment(assessment)}
                    className="w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{assessment.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {assessment.classId ?? assessment.class} ·{" "}
                          {assessment.subjectName ?? assessment.subject}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Chip size="small" label={meta.label} sx={badgeSx(meta.tone)} />
                      <Chip
                        size="small"
                        label={reportingPeriod(assessment, active.resultPublicationMode)}
                        sx={badgeSx("outline")}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <Box className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Assessment</TableCell>
                      <TableCell>Class and subject</TableCell>
                      <TableCell>Reporting cycle</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visible.map((assessment) => {
                      const status = statusOf(assessment.workflowStatus);
                      const meta = STATUS_META[status];
                      return (
                        <TableRow key={assessment.id} hover>
                          <TableCell>
                            <p className="font-medium">{assessment.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {assessment.teacherAssigned || "Teacher not recorded"}
                            </p>
                          </TableCell>
                          <TableCell>
                            {assessment.classId ?? assessment.class} ·{" "}
                            {assessment.subjectName ?? assessment.subject}
                          </TableCell>
                          <TableCell>
                            <p>{reportingPeriod(assessment, active.resultPublicationMode)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Term {assessment.term ?? active.currentTerm},{" "}
                              {assessment.academicYear ?? active.currentYear}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={meta.label} sx={badgeSx(meta.tone)} />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant={
                                actionableStatuses.includes(status) ? "contained" : "outlined"
                              }
                              endIcon={<ChevronRight size={15} />}
                              onClick={() => setSelectedAssessment(assessment)}
                            >
                              {meta.action}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        )}
      </div>

      {selectedAssessment && (
        <ResultsSheet
          assessment={selectedAssessment}
          schoolId={schoolId}
          classes={classes}
          open
          onClose={() => setSelectedAssessment(null)}
          canManage={false}
        />
      )}
    </AccessGuard>
  );
}
