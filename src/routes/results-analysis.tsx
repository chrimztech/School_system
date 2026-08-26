import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, GraduationCap, Layers, Percent, Users } from "lucide-react";
import { MenuItem, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader, StatCard } from "@/components/page-header";
import { AccessGuard } from "@/components/access-guard";
import { EmptyState } from "@/components/empty-state";
import { useTenant, formatGrade } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/results-analysis")({
  head: () => ({ meta: [{ title: "Results Analysis — SRMS" }] }),
  component: ResultsAnalysisPage,
});

const TERM_OPTIONS = [
  { value: "1", label: "Term 1" },
  { value: "2", label: "Term 2" },
  { value: "3", label: "Term 3" },
];

type Breakdown = "CLASS" | "GRADE" | "SUBJECT" | "SCHOOL";

function ResultsAnalysisPage() {
  const { active } = useTenant();
  const levelWord = active.type === "SECONDARY" ? "form" : (active.type === "PRIMARY" || active.type === "NURSERY") ? "grade" : "grade/form";
  const schoolId = active.id;

  const [breakdown, setBreakdown] = useState<Breakdown>("CLASS");
  const [classId, setClassId] = useState("");
  const [grade, setGrade] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [term, setTerm] = useState(String(active.currentTerm ?? "1"));
  const [academicYear, setAcademicYear] = useState(String(active.currentYear ?? new Date().getFullYear()));
  const [reportingPeriod, setReportingPeriod] = useState<"MIDTERM" | "END_TERM" | "COMBINED">(
    active.resultPublicationMode === "COMBINED" ? "COMBINED" : "END_TERM",
  );

  const { data: classes = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => api.classes.list(schoolId),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: () => api.subjects.list(schoolId),
    enabled: !!schoolId,
  });

  const gradeOptions = useMemo(
    () =>
      Array.from(new Set((classes as any[]).map((c) => c.grade).filter((g) => g != null))).sort(
        (a, b) => a - b,
      ),
    [classes],
  );

  const canQuery =
    !!schoolId &&
    !!term &&
    !!academicYear &&
    (breakdown === "SCHOOL" ||
      (breakdown === "CLASS" && !!classId) ||
      (breakdown === "GRADE" && !!grade) ||
      (breakdown === "SUBJECT" && !!subjectName));

  const { data, isLoading } = useQuery({
    queryKey: ["results-analysis", schoolId, breakdown, classId, grade, subjectName, term, academicYear, reportingPeriod],
    queryFn: () => {
      if (breakdown === "CLASS")
        return api.resultsAnalysis.byClass(schoolId, { classId, term, academicYear, reportingPeriod });
      if (breakdown === "GRADE")
        return api.resultsAnalysis.byGrade(schoolId, { grade: Number(grade), term, academicYear, reportingPeriod });
      if (breakdown === "SUBJECT")
        return api.resultsAnalysis.bySubject(schoolId, { subjectName, term, academicYear, reportingPeriod });
      return api.resultsAnalysis.bySchool(schoolId, { term, academicYear, reportingPeriod });
    },
    enabled: canQuery,
  });

  const distributionData = useMemo(
    () =>
      Object.entries(data?.distribution ?? {})
        .map(([letter, count]) => ({ letter, count }))
        .sort((a, b) => a.letter.localeCompare(b.letter)),
    [data],
  );

  const hasData = !!data && data.studentCount > 0;

  return (
    <AccessGuard module="report-card">
      <div className="space-y-6">
        <PageHeader
          title="Results Analysis"
          description="Compare published academic performance by class, grade level, subject, or across the whole school."
        />

        <section className="surface-card rounded-2xl p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <TextField
              select
              label="Breakdown"
              value={breakdown}
              size="small"
              onChange={(e) => setBreakdown(e.target.value as Breakdown)}
            >
              <MenuItem value="CLASS">By class</MenuItem>
              <MenuItem value="GRADE">By {levelWord} level</MenuItem>
              <MenuItem value="SUBJECT">By subject</MenuItem>
              <MenuItem value="SCHOOL">Whole school</MenuItem>
            </TextField>

            {breakdown === "CLASS" && (
              <TextField select label="Class" value={classId} size="small" onChange={(e) => setClassId(e.target.value)}>
                <MenuItem value="" disabled>
                  Select class
                </MenuItem>
                {(classes as any[]).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` ${c.section}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {breakdown === "GRADE" && (
              <TextField select label={`${levelWord.charAt(0).toUpperCase()}${levelWord.slice(1)} level`} value={grade} size="small" onChange={(e) => setGrade(e.target.value)}>
                <MenuItem value="" disabled>
                  Select grade
                </MenuItem>
                {gradeOptions.map((g) => (
                  <MenuItem key={g} value={String(g)}>
                    {formatGrade(g, active.type)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {breakdown === "SUBJECT" && (
              <TextField
                select
                label="Subject"
                value={subjectName}
                size="small"
                onChange={(e) => setSubjectName(e.target.value)}
              >
                <MenuItem value="" disabled>
                  Select subject
                </MenuItem>
                {(subjects as any[]).map((s) => (
                  <MenuItem key={s.id ?? s.code ?? s.name} value={s.name}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField select label="Term" value={term} size="small" onChange={(e) => setTerm(e.target.value)}>
              {TERM_OPTIONS.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Academic year"
              value={academicYear}
              size="small"
              onChange={(e) => setAcademicYear(e.target.value)}
            />

            {active.resultPublicationMode === "SEPARATE" && (
              <TextField
                select
                label="Release"
                value={reportingPeriod}
                size="small"
                onChange={(e) => setReportingPeriod(e.target.value as "MIDTERM" | "END_TERM")}
              >
                <MenuItem value="MIDTERM">Mid-term</MenuItem>
                <MenuItem value="END_TERM">End-of-term</MenuItem>
              </TextField>
            )}
          </div>
        </section>

        {!canQuery ? (
          <EmptyState
            icon={BarChart3}
            title="Choose a breakdown"
            description="Select a class, grade level, or subject (or choose whole-school) to see results."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Average score"
                value={data?.average != null ? `${Math.round(data.average)}%` : "—"}
                icon={<GraduationCap className="h-5 w-5" />}
                hint={data?.scopeLabel}
              />
              <StatCard
                label="Pass rate"
                value={data?.passRate != null ? `${Math.round(data.passRate)}%` : "—"}
                accent={data?.passRate != null ? (data.passRate >= 50 ? "success" : "destructive") : "primary"}
                icon={<Percent className="h-5 w-5" />}
                hint={data ? `Pass mark: ${data.passMarkUsed}%` : undefined}
              />
              <StatCard
                label="Students counted"
                value={data?.studentCount ?? 0}
                icon={<Users className="h-5 w-5" />}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold">{levelWord.charAt(0).toUpperCase()}{levelWord.slice(1)} distribution</h2>
                <div className="h-64">
                  {!hasData ? (
                    <EmptyState
                      icon={BarChart3}
                      title="No published results"
                      description="No results have been published yet for this selection."
                      className="py-10"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={distributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="letter" stroke="var(--color-muted-foreground)" fontSize={12} />
                        <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                          }}
                        />
                        <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold">Subject averages</h2>
                <div className="h-64">
                  {!data?.bySubject?.length ? (
                    <EmptyState
                      icon={Layers}
                      title={breakdown === "SUBJECT" ? "Single subject view" : "No subject data"}
                      description={
                        breakdown === "SUBJECT"
                          ? "Already viewing a single subject — switch breakdown to compare across subjects."
                          : "No published results have been broken down by subject yet."
                      }
                      className="py-10"
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.bySubject}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis
                          dataKey="subjectName"
                          stroke="var(--color-muted-foreground)"
                          fontSize={11}
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            background: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 8,
                          }}
                        />
                        <Bar dataKey="average" name="Average %" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="passRate" name="Pass rate %" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {breakdown !== "SUBJECT" && (
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border p-5">
                  <h2 className="text-sm font-semibold">Per-subject breakdown</h2>
                </div>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Subject</TableCell>
                        <TableCell className="text-right">Students</TableCell>
                        <TableCell className="text-right">Average</TableCell>
                        <TableCell className="text-right">Pass rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!data?.bySubject?.length ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            {isLoading ? "Loading…" : "No published results for this selection yet."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.bySubject.map((s) => (
                          <TableRow key={s.subjectName}>
                            <TableCell className="font-medium">{s.subjectName}</TableCell>
                            <TableCell className="text-right tabular-nums">{s.studentCount}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {s.average != null ? `${Math.round(s.average)}%` : "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {s.passRate != null ? `${Math.round(s.passRate)}%` : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            )}
          </>
        )}
      </div>
    </AccessGuard>
  );
}
