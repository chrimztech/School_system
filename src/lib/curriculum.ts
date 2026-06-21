// Zambia 2025 Education Curriculum Framework (ECF)
// Source: MoE / CDC Zambia 2023 curriculum review, rolled out January 2025.
//
// KEY STRUCTURAL CHANGES FROM THE 2013 FRAMEWORK:
//   • Grade 7 abolished — learners completing Grade 6 enter Form 1 directly
//   • Junior Secondary (Grade 8–9) merged into O-Level as Form 1–2
//   • Senior Secondary Grade 10–12 restructured: Form 3–4 = O-Level, Form 5–6 = A-Level
//   • Primary Leaving Assessment (PLA) replaces PSLE and is now sat at Grade 6
//   • Junior Secondary School Leaving Examination (JSSLE) abolished
//   • Integrated Science split into Biology, Chemistry & Physics at secondary level
//   • Computer Studies replaced by ICT (Information & Communication Technology)
//   • CTS (Computer Technology Studies) → Design & Technology Studies (DTS)
//   • A-Level formalised as a distinct phase with its own grading scale (A–E + U)

export type PhaseId = "ece" | "primary" | "olevel" | "alevel";
export type PathwayId = "academic" | "teveta";

export type Phase = {
  id: PhaseId;
  name: string;
  shortName: string;
  grades: string[];
  ageRange: string;
  language: string;
  description: string;
  exitExam?: string;
  color: string;
};

export const PHASES: Phase[] = [
  {
    id: "ece",
    name: "Early Childhood Education",
    shortName: "ECE",
    grades: ["Baby Class", "Middle Class", "Reception"],
    ageRange: "3 – 6 yrs",
    language: "Familiar / local language",
    description:
      "Play-based, holistic learning. Foundations in literacy, numeracy, motor skills and social development. Optional but strongly encouraged before Grade 1.",
    color: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  {
    id: "primary",
    name: "Primary",
    shortName: "Primary",
    grades: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"],
    ageRange: "6 – 12 yrs",
    language: "Zambian language (Gr 1–4) → English (Gr 5–6)",
    description:
      "Grades 1–4 use a familiar Zambian language as the medium of instruction. English transitions in from Grade 5. Core subjects: English Language, Mathematics, Zambian Languages, Social & Environmental Studies, Integrated Science, Religious Education, Physical Education, Creative Arts — plus Home Economics and Agricultural Science from Grade 4.",
    exitExam: "Primary Leaving Assessment (PLA) — Grade 6 ECZ",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "olevel",
    name: "O-Level Secondary",
    shortName: "O-Level",
    grades: ["Form 1", "Form 2", "Form 3", "Form 4"],
    ageRange: "13 – 16 yrs",
    language: "English",
    description:
      "6 compulsory core subjects (English Language, Mathematics, Zambian Languages, Civic Education, Religious Education, Physical Education) plus optional electives chosen from Sciences (Biology, Chemistry, Physics), Humanities, Languages and Technology streams. Integrated Science is no longer taught — each science discipline is now a separate subject.",
    exitExam: "School Certificate — Ordinary Level (Form 4 ECZ)",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  {
    id: "alevel",
    name: "A-Level Secondary",
    shortName: "A-Level",
    grades: ["Form 5", "Form 6"],
    ageRange: "17 – 18 yrs",
    language: "English",
    description:
      "Specialised study of 3–4 principal subjects chosen from Sciences, Humanities, Languages, Commerce or Technology, plus compulsory General Paper (GP). Prepares learners for university, professional colleges or the TEVETA vocational route.",
    exitExam: "School Certificate — Advanced Level (Form 6 ECZ)",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
];

export const PATHWAYS: Record<PathwayId, { name: string; appliesTo: PhaseId[]; focus: string[]; description: string }> = {
  academic: {
    name: "Academic Pathway",
    appliesTo: ["olevel", "alevel"],
    focus: [
      "Natural Sciences — Biology, Chemistry, Physics",
      "Mathematics & Further Mathematics",
      "Humanities — History, Geography, Economics, Sociology",
      "Languages — English, French, Literature, Zambian Languages",
      "Commerce — Business Studies, Principles of Accounts",
      "Technology — ICT, Design & Technology Studies",
    ],
    description:
      "University-preparation track. O-Level School Certificate qualifies learners for Form 5 entry. A-Level School Certificate is the primary university entrance qualification for Zambian and regional universities.",
  },
  teveta: {
    name: "TEVETA / Vocational Pathway",
    appliesTo: ["olevel", "alevel"],
    focus: [
      "Design & Technology Studies (DTS)",
      "Home Economics & Hospitality",
      "Agriculture & Natural Resources",
      "Business & Commerce",
      "ICT & Digital Skills",
      "Creative & Performing Arts",
    ],
    description:
      "Competence-based, TEVETA-aligned track. Combines the ECZ School Certificate with a recognised vocational qualification, opening pathways into skilled trades, entrepreneurship and further technical or professional colleges.",
  },
};

// All canonical grade labels in phase order
export const ALL_GRADES: string[] = PHASES.flatMap((p) => p.grades);

export function phaseForGrade(grade: string | number): Phase | undefined {
  const label =
    typeof grade === "number"
      ? grade <= 6
        ? `Grade ${grade}`
        : `Form ${grade}`
      : grade;
  return PHASES.find((p) => p.grades.includes(label));
}

// ── Grading Scales (ECZ 2025) ────────────────────────────────────────────────

export type GradingBand = { symbol: string; min: number; max: number; descriptor: string };
export type QualitativeBand = { symbol: string; descriptor: string };

export const ECE_GRADING: QualitativeBand[] = [
  { symbol: "EE", descriptor: "Exceeding Expectations" },
  { symbol: "ME", descriptor: "Meeting Expectations" },
  { symbol: "AE", descriptor: "Approaching Expectations" },
  { symbol: "BE", descriptor: "Below Expectations" },
];

export const PRIMARY_GRADING: GradingBand[] = [
  { symbol: "A", min: 80, max: 100, descriptor: "Distinction" },
  { symbol: "B", min: 70, max: 79,  descriptor: "Merit" },
  { symbol: "C", min: 60, max: 69,  descriptor: "Credit" },
  { symbol: "D", min: 50, max: 59,  descriptor: "Satisfactory" },
  { symbol: "E", min: 40, max: 49,  descriptor: "Pass" },
  { symbol: "F", min: 0,  max: 39,  descriptor: "Fail" },
];

// O-Level: ECZ 1–9 numeric scale (unchanged from old Grade 8–12 scale)
export const SECONDARY_GRADING: GradingBand[] = [
  { symbol: "1", min: 75, max: 100, descriptor: "Distinction" },
  { symbol: "2", min: 70, max: 74,  descriptor: "Distinction" },
  { symbol: "3", min: 65, max: 69,  descriptor: "Merit" },
  { symbol: "4", min: 60, max: 64,  descriptor: "Merit" },
  { symbol: "5", min: 55, max: 59,  descriptor: "Credit" },
  { symbol: "6", min: 50, max: 54,  descriptor: "Credit" },
  { symbol: "7", min: 45, max: 49,  descriptor: "Satisfactory" },
  { symbol: "8", min: 40, max: 44,  descriptor: "Pass" },
  { symbol: "9", min: 0,  max: 39,  descriptor: "Fail" },
];

// A-Level: letter scale A–E + U (new formalised A-Level grading 2025)
export const ALEVEL_GRADING: GradingBand[] = [
  { symbol: "A", min: 80, max: 100, descriptor: "Distinction" },
  { symbol: "B", min: 70, max: 79,  descriptor: "Merit" },
  { symbol: "C", min: 60, max: 69,  descriptor: "Credit" },
  { symbol: "D", min: 50, max: 59,  descriptor: "Pass" },
  { symbol: "E", min: 40, max: 49,  descriptor: "Subsidiary Pass" },
  { symbol: "U", min: 0,  max: 39,  descriptor: "Ungraded / Fail" },
];

export function gradeBandForScore(
  score: number,
  scale: "primary" | "secondary" | "alevel",
): GradingBand | undefined {
  const bands =
    scale === "primary"
      ? PRIMARY_GRADING
      : scale === "alevel"
        ? ALEVEL_GRADING
        : SECONDARY_GRADING;
  return bands.find((b) => score >= b.min && score <= b.max);
}

// ── 2025 curriculum change log (for display in the UI) ──────────────────────

export const CHANGES_2025 = [
  {
    area: "Structure",
    change: "Grade 7 abolished",
    detail:
      "Learners who complete Grade 6 now progress directly into Form 1 (O-Level Secondary). The old Grade 7 cohort was the last to sit the PSLE in 2024.",
  },
  {
    area: "Structure",
    change: "Junior Secondary merged into O-Level",
    detail:
      "Old Grade 8–9 (Junior Secondary) becomes Form 1–2 of O-Level. Old Grade 10–11 becomes Form 3–4. The full O-Level is now Form 1–4.",
  },
  {
    area: "Structure",
    change: "A-Level formalised as Form 5–6",
    detail:
      "Old Grade 12 expanded into a two-year A-Level (Form 5 and Form 6) with its own separate syllabus, examination timetable and grading scale.",
  },
  {
    area: "Examinations",
    change: "PSLE → Primary Leaving Assessment (PLA)",
    detail:
      "The Primary School Leaving Examination (PSLE), previously sat at Grade 7, is replaced by the Primary Leaving Assessment (PLA) sat at the end of Grade 6.",
  },
  {
    area: "Examinations",
    change: "JSSLE abolished",
    detail:
      "The Junior Secondary School Leaving Examination (Grade 9) is discontinued. No formal ECZ examination is sat at the end of Form 2.",
  },
  {
    area: "Sciences",
    change: "Integrated Science split",
    detail:
      "At O-Level and A-Level, Integrated Science is replaced by three separate subjects: Biology, Chemistry and Physics. Primary Integrated Science remains.",
  },
  {
    area: "Technology",
    change: "Computer Studies → ICT",
    detail:
      "Computer Studies is replaced by Information & Communication Technology (ICT) with an updated digital-skills syllabus aligned to the modern workforce.",
  },
  {
    area: "Technology",
    change: "CTS → Design & Technology Studies (DTS)",
    detail:
      "Computer Technology Studies (CTS) is renamed Design & Technology Studies (DTS) and now covers product design, engineering drawing and technical problem-solving.",
  },
];
