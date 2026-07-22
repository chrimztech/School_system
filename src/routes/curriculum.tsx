import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Languages, CalendarCheck2, Award, BookOpen, AlertTriangle } from "lucide-react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { PageHeader } from "@/components/page-header";
import {
  PHASES, PATHWAYS, CHANGES_2025,
  PRIMARY_GRADING, SECONDARY_GRADING, ALEVEL_GRADING, ECE_GRADING,
} from "@/lib/curriculum";
import { useTenant } from "@/lib/tenant";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/curriculum")({
  head: () => ({ meta: [{ title: "Curriculum Framework — SRMS" }] }),
  component: CurriculumPage,
});

function CurriculumPage() {
  const [tab, setTab] = useState("phases");
  const { active } = useTenant();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Framework"
        description={`Zambia 2025 Education Curriculum Framework (MoE / ECZ) — ${active.name}`}
      />

      {/* 2025 banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span>
          This school is on the <strong>Zambia 2025 Curriculum</strong>. Grade 7 is abolished — primary ends at Grade 6 and secondary starts at Form 1. See the <strong>2025 Changes</strong> tab for the full transition summary.
        </span>
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        <Tab value="phases" label="Phases & Grades" />
        <Tab value="pathways" label="Pathways" />
        <Tab value="grading" label="Grading Scales" />
        <Tab value="exams" label="ECZ Examinations" />
        <Tab value="changes" label="2025 Changes" />
      </Tabs>

      {/* ── Phases ────────────────────────────────────────────────── */}
      {tab === "phases" && (
        <Box sx={{ mt: 1.5 }}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PHASES.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${p.color}`}>{p.shortName}</span>
                    <h3 className="mt-2 text-base font-semibold">{p.name}</h3>
                  </div>
                  <GraduationCap className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.grades.map((g) => <Chip key={g} size="small" label={g} sx={badgeSx("secondary")} />)}
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><CalendarCheck2 className="h-3.5 w-3.5 shrink-0" />{p.ageRange}</p>
                  <p className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 shrink-0" />{p.language}</p>
                  {p.exitExam && <p className="flex items-center gap-2"><Award className="h-3.5 w-3.5 shrink-0 text-amber-500" />{p.exitExam}</p>}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
              </div>
            ))}
          </div>
        </Box>
      )}

      {/* ── Pathways ──────────────────────────────────────────────── */}
      {tab === "pathways" && (
        <Box sx={{ mt: 1.5 }}>
          <p className="text-sm text-muted-foreground">
            From O-Level onwards learners choose between two broad tracks. Both tracks lead to an ECZ School Certificate.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(PATHWAYS).map(([id, pw]) => (
              <div key={id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">{pw.name}</h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {pw.appliesTo.map((pid) => {
                    const phase = PHASES.find((p) => p.id === pid);
                    return phase ? (
                      <span key={pid} className={`rounded px-2 py-0.5 text-xs font-medium ${phase.color}`}>{phase.shortName}</span>
                    ) : null;
                  })}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{pw.description}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject areas</p>
                <ul className="mt-2 grid grid-cols-1 gap-1.5">
                  {pw.focus.map((f) => (
                    <li key={f} className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Box>
      )}

      {/* ── Grading Scales ────────────────────────────────────────── */}
      {tab === "grading" && (
        <Box sx={{ mt: 1.5 }}>
          <p className="text-sm text-muted-foreground">Four separate grading systems apply across the phases. A-Level uses its own letter scale distinct from O-Level.</p>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <ScaleCard
              title="ECE (Qualitative)"
              subtitle="Baby Class – Reception"
              color="bg-violet-500/15 text-violet-700 dark:text-violet-300"
              rows={ECE_GRADING.map((b) => ({ symbol: b.symbol, range: "—", descriptor: b.descriptor }))}
            />
            <ScaleCard
              title="Primary — A to F"
              subtitle="Grade 1 – Grade 6"
              color="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              rows={PRIMARY_GRADING.map((b) => ({ symbol: b.symbol, range: `${b.min}–${b.max}%`, descriptor: b.descriptor }))}
            />
            <ScaleCard
              title="O-Level — ECZ 1 to 9"
              subtitle="Form 1 – Form 4"
              color="bg-blue-500/15 text-blue-700 dark:text-blue-300"
              rows={SECONDARY_GRADING.map((b) => ({ symbol: b.symbol, range: `${b.min}–${b.max}%`, descriptor: b.descriptor }))}
            />
            <ScaleCard
              title="A-Level — A to U"
              subtitle="Form 5 – Form 6"
              color="bg-amber-500/15 text-amber-700 dark:text-amber-300"
              rows={ALEVEL_GRADING.map((b) => ({ symbol: b.symbol, range: `${b.min}–${b.max}%`, descriptor: b.descriptor }))}
            />
          </div>
        </Box>
      )}

      {/* ── ECZ Examinations ──────────────────────────────────────── */}
      {tab === "exams" && (
        <Box sx={{ mt: 1.5 }}>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Phase</TableCell>
                  <TableCell>Examination</TableCell>
                  <TableCell>Sat at</TableCell>
                  <TableCell>Awarding body</TableCell>
                  <TableCell>Outcome</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <span className="rounded px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Primary</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">Primary Leaving Assessment (PLA)</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Replaces the old PSLE which was sat at Grade 7</div>
                  </TableCell>
                  <TableCell className="text-sm">End of Grade 6</TableCell>
                  <TableCell className="text-sm">ECZ</TableCell>
                  <TableCell className="text-sm">Progression to Form 1 (O-Level Secondary)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <span className="rounded px-2 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300">O-Level</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">School Certificate — Ordinary Level</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Graded ECZ 1–9. Minimum 5 credits (grades 1–6) typically required for Form 5</div>
                  </TableCell>
                  <TableCell className="text-sm">End of Form 4</TableCell>
                  <TableCell className="text-sm">ECZ</TableCell>
                  <TableCell className="text-sm">Form 5 (A-Level) / TEVETA / Employment</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <span className="rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">A-Level</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">School Certificate — Advanced Level</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Principal subjects graded A–E + U. General Paper (GP) compulsory for all candidates</div>
                  </TableCell>
                  <TableCell className="text-sm">End of Form 6</TableCell>
                  <TableCell className="text-sm">ECZ</TableCell>
                  <TableCell className="text-sm">University / Professional colleges / Workforce</TableCell>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={5}>
                    <p className="text-xs text-muted-foreground italic">
                      Note: The Junior Secondary School Leaving Examination (JSSLE), previously sat at Grade 9, is abolished under the 2025 framework. No formal ECZ exit examination is sat between Grade 6 and Form 4.
                    </p>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </Box>
      )}

      {/* ── 2025 Changes ──────────────────────────────────────────── */}
      {tab === "changes" && (
        <Box sx={{ mt: 1.5 }}>
          <p className="text-sm text-muted-foreground">
            Summary of what changed when Zambia moved from the 2013 CDC framework to the 2025 ECF. Share this with staff and parents during the transition period.
          </p>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell className="w-32">Area</TableCell>
                  <TableCell className="w-64">Change</TableCell>
                  <TableCell>Detail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {CHANGES_2025.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Chip size="small" label={c.area} sx={badgeSx("outline")} />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{c.change}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </Box>
      )}
      </Box>
    </div>
  );
}

function ScaleCard({
  title, subtitle, color,
  rows,
}: {
  title: string;
  subtitle: string;
  color: string;
  rows: { symbol: string; range: string; descriptor: string }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className={`border-b border-border px-4 py-3 ${color}`}>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80">{subtitle}</p>
      </div>
      <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell className="w-14">Grade</TableCell>
            <TableCell>Range</TableCell>
            <TableCell>Descriptor</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.symbol}>
              <TableCell className="font-mono font-bold text-sm">{r.symbol}</TableCell>
              <TableCell className="tabular-nums text-sm">{r.range}</TableCell>
              <TableCell className="text-sm">{r.descriptor}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableContainer>
    </div>
  );
}
