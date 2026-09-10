import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileBadge,
  FileText,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Mail,
  Menu,
  MessageSquare,
  Network,
  Phone,
  ReceiptText,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRoundCheck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";

import { api } from "@/lib/api";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "SRMS | One connected school system" },
      {
        name: "description",
        content:
          "Run admissions, academics, fees, people, campus operations, and reporting from one secure school management platform built for Zambia.",
      },
    ],
  }),
  component: WelcomePage,
});

type ProductSuite = {
  id: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  tint: string;
  modules: string[];
};

type PublicTestimonial = {
  id?: string;
  rating?: number | null;
  quote: string;
  authorName: string;
  authorRole?: string | null;
  schoolName?: string | null;
};

const PRODUCT_SUITES: ProductSuite[] = [
  {
    id: "academic",
    label: "Academic management",
    title: "A continuous record from admission to graduation.",
    description:
      "Give academic teams one dependable place to plan teaching, capture attendance, manage marks, approve results, and move learners forward.",
    icon: GraduationCap,
    accent: "#215ce8",
    tint: "#eaf0ff",
    modules: [
      "Admissions",
      "Pupil records",
      "Classes & subjects",
      "Curriculum",
      "Timetables",
      "Attendance",
      "Assessments",
      "Exams & report cards",
    ],
  },
  {
    id: "finance",
    label: "Finance & people",
    title: "Clearer control of money, staff, and accountability.",
    description:
      "Connect billing and collections to the learner record while finance and HR teams work from the same trusted school structure.",
    icon: Wallet,
    accent: "#087f62",
    tint: "#e7f8f1",
    modules: [
      "Fee structures",
      "Payments & receipts",
      "Bursaries",
      "Accounting",
      "Payroll",
      "Procurement",
      "Vendor management",
      "Human resources",
    ],
  },
  {
    id: "campus",
    label: "Campus operations",
    title: "The services around learning, managed together.",
    description:
      "Keep the library, transport, boarding, clinic, stores, dining hall, and facilities connected to the people they serve.",
    icon: School,
    accent: "#b9690d",
    tint: "#fff3df",
    modules: [
      "Library",
      "Transport",
      "Hostel & boarding",
      "Health & clinic",
      "Dining hall",
      "Inventory",
      "Facilities",
      "Visitors & lost property",
    ],
  },
  {
    id: "leadership",
    label: "Leadership & governance",
    title: "A live view of performance, risk, and progress.",
    description:
      "Turn operational records into useful oversight for school leaders, boards, districts, and platform teams.",
    icon: BarChart3,
    accent: "#6d46c7",
    tint: "#f1ecff",
    modules: [
      "Enterprise analytics",
      "Management reporting",
      "Compliance",
      "Risk register",
      "Incident management",
      "Policy library",
      "Strategic planning",
      "District oversight",
    ],
  },
];

const ROLE_OUTCOMES = [
  {
    icon: UserRoundCheck,
    role: "School administrators",
    outcome: "Control enrolment, access, records, fees, and daily operations from one workspace.",
  },
  {
    icon: ClipboardCheck,
    role: "Teachers & academic leaders",
    outcome: "Take registers, manage assessments, review marks, and publish results confidently.",
  },
  {
    icon: Users,
    role: "Parents & guardians",
    outcome: "See each child’s published results, attendance, balances, and school communication.",
  },
  {
    icon: TrendingUp,
    role: "Leadership teams",
    outcome: "Follow academic, operational, financial, and governance performance in context.",
  },
] as const;

const LEARNER_JOURNEY = [
  {
    number: "01",
    icon: FileText,
    title: "Apply & enrol",
    detail: "Move an application into a complete learner profile and the right class placement.",
  },
  {
    number: "02",
    icon: CalendarCheck,
    title: "Attend & learn",
    detail: "Connect daily registers to classes, subjects, timetables, and learner support.",
  },
  {
    number: "03",
    icon: FileBadge,
    title: "Assess & approve",
    detail: "Move results through review and approval before families see published reports.",
  },
  {
    number: "04",
    icon: GraduationCap,
    title: "Report & advance",
    detail:
      "Use one verified record for report cards, promotion, analysis, and leadership decisions.",
  },
] as const;

const COVERAGE: { icon: LucideIcon; label: string }[] = [
  { icon: BookOpen, label: "Academics" },
  { icon: Wallet, label: "Finance" },
  { icon: Bus, label: "Campus" },
  { icon: Users, label: "People" },
  { icon: ShieldCheck, label: "Governance" },
];

const PLATFORM_PROOF = [
  { value: "60+", label: "connected workflows" },
  { value: "4", label: "core operating areas" },
  { value: "1", label: "trusted school record" },
] as const;

const NAV_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "Workflow", href: "#workflow" },
  { label: "For your team", href: "#roles" },
  { label: "FAQ", href: "#faq" },
] as const;

const FAQS = [
  {
    q: "How long does it take to get our school running on SRMS?",
    a: "Your workspace is configured before your team logs in — school structure, curriculum, campuses, branding, and the first admin account are set up as part of onboarding, not left as a blank form for you to fill in.",
  },
  {
    q: "Can staff only see what's relevant to their role?",
    a: "Yes. Access is role-based down to the module — a teacher, a finance officer, and a head of department each see a workspace scoped to their responsibilities, and every meaningful action is recorded in an audit trail.",
  },
  {
    q: "Do parents need to install anything?",
    a: "It's their choice. Parents can sign in from any web browser or use the dedicated mobile app — either way they see the same published results, attendance, and fee balances, and get SMS, email, or WhatsApp updates directly.",
  },
  {
    q: "Can we take payments the way our parents actually pay?",
    a: "SRMS supports ZMW billing with Mobile Money and card payment options, so collections and reconciliation stay inside the same fee ledger instead of a separate spreadsheet.",
  },
  {
    q: "What happens to our data if we ever need to leave?",
    a: "Your school's records stay yours — data exports are available on request, so you're never locked out of information your team entered.",
  },
] as const;

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b2b4b] text-white shadow-sm">
        <GraduationCap className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className={compact ? "hidden sm:block" : "block"}>
        <span className="block text-base font-extrabold leading-none tracking-[-0.025em] text-[#0a1c30]">
          SRMS
        </span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          School records
        </span>
      </div>
    </div>
  );
}

/** Fades + rises a section into place the first time it scrolls into view, then stops
 * observing — a static one-shot reveal, not a distracting repeat-on-every-scroll effect. */
function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0"} ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

/** Tracks which #id section is currently most in view so the nav can highlight it — pure
 * progressive enhancement, the page works identically if this never fires. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          const topMost = visible.reduce((a, b) =>
            a.intersectionRatio > b.intersectionRatio ? a : b,
          );
          setActive(topMost.target.id);
        }
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // ids.join("|") is a deliberate stable-key substitute for the `ids` array itself, which
    // is a fresh reference every render (it's built inline via useMemo at the call site) —
    // depending on the array directly would re-run this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")]);

  return active;
}

type PreviewView = {
  id: string;
  icon: LucideIcon;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  tint: string;
  chartTitle: string;
  chartCaption: string;
  chartPath: string;
  chartPoints: Array<[number, number]>;
  chartLabels: string[];
  metrics: Array<{ label: string; value: string; note: string; color: string }>;
  tasks: Array<{ icon: LucideIcon; label: string; count: string; color: string }>;
};

const PREVIEW_VIEWS: PreviewView[] = [
  {
    id: "overview",
    icon: BarChart3,
    label: "Overview",
    eyebrow: "School command centre",
    title: "Good morning, Administrator",
    subtitle: "Today across the whole school · Sample workspace",
    accent: "#215ce8",
    tint: "#eaf0ff",
    chartTitle: "Attendance trend",
    chartCaption: "Whole-school daily view",
    chartPath: "M8 88 C48 70 64 76 101 58 S158 72 197 45 S253 55 290 30 S354 44 412 18",
    chartPoints: [
      [8, 88],
      [101, 58],
      [197, 45],
      [290, 30],
      [412, 18],
    ],
    chartLabels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    metrics: [
      { label: "Learners", value: "1,248", note: "+32 this term", color: "#215ce8" },
      { label: "Attendance", value: "94.6%", note: "Today", color: "#087f62" },
      { label: "Fees collected", value: "82%", note: "Term target", color: "#b9690d" },
      { label: "Results review", value: "12", note: "Awaiting action", color: "#6d46c7" },
    ],
    tasks: [
      { icon: ClipboardCheck, label: "Result approvals", count: "12", color: "#6d46c7" },
      { icon: ReceiptText, label: "Fee follow-up", count: "26", color: "#b9690d" },
      { icon: HeartPulse, label: "Welfare cases", count: "3", color: "#087f62" },
    ],
  },
  {
    id: "students",
    icon: Users,
    label: "Pupils",
    eyebrow: "Learner records",
    title: "Every learner, one complete story",
    subtitle: "Admissions, profiles, placement, and progression · Sample workspace",
    accent: "#215ce8",
    tint: "#eaf0ff",
    chartTitle: "Enrolment movement",
    chartCaption: "Active learners this academic year",
    chartPath: "M8 82 C54 80 72 68 108 70 S165 54 205 56 S269 36 309 41 S370 24 412 20",
    chartPoints: [
      [8, 82],
      [108, 70],
      [205, 56],
      [309, 41],
      [412, 20],
    ],
    chartLabels: ["Jan", "Mar", "May", "Jul", "Sep"],
    metrics: [
      { label: "Active learners", value: "1,248", note: "Across 34 classes", color: "#215ce8" },
      { label: "New admissions", value: "38", note: "This term", color: "#087f62" },
      { label: "Complete records", value: "96%", note: "Verified profiles", color: "#6d46c7" },
      { label: "Transfers", value: "6", note: "In progress", color: "#b9690d" },
    ],
    tasks: [
      { icon: FileText, label: "New applications", count: "18", color: "#215ce8" },
      { icon: UserRoundCheck, label: "Profile follow-up", count: "9", color: "#b9690d" },
      { icon: School, label: "Class placements", count: "6", color: "#087f62" },
    ],
  },
  {
    id: "attendance",
    icon: CalendarCheck,
    label: "Attendance",
    eyebrow: "Live attendance",
    title: "Know who is present—before lessons move on",
    subtitle: "Registers update the school-wide picture · Sample workspace",
    accent: "#087f62",
    tint: "#e7f8f1",
    chartTitle: "Weekly attendance",
    chartCaption: "Present learners by day",
    chartPath: "M8 48 C45 35 74 43 108 30 S168 38 205 26 S266 34 309 21 S371 27 412 16",
    chartPoints: [
      [8, 48],
      [108, 30],
      [205, 26],
      [309, 21],
      [412, 16],
    ],
    chartLabels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    metrics: [
      { label: "Present", value: "1,181", note: "94.6% today", color: "#087f62" },
      { label: "Late", value: "21", note: "Checked in", color: "#b9690d" },
      { label: "Absent", value: "34", note: "Guardians notified", color: "#dc3f45" },
      { label: "Registers", value: "98%", note: "Completed", color: "#215ce8" },
    ],
    tasks: [
      { icon: ClipboardCheck, label: "Registers outstanding", count: "4", color: "#b9690d" },
      { icon: MessageSquare, label: "Guardian follow-up", count: "11", color: "#215ce8" },
      { icon: HeartPulse, label: "Health-linked absences", count: "3", color: "#087f62" },
    ],
  },
  {
    id: "finance",
    icon: Wallet,
    label: "Finance",
    eyebrow: "School finance",
    title: "Collections and balances, reconciled in context",
    subtitle: "One fee ledger connected to every learner · Sample workspace",
    accent: "#b9690d",
    tint: "#fff3df",
    chartTitle: "Collection progress",
    chartCaption: "Term receipts against target",
    chartPath: "M8 94 C48 88 70 78 108 72 S170 61 205 54 S265 48 309 35 S365 30 412 18",
    chartPoints: [
      [8, 94],
      [108, 72],
      [205, 54],
      [309, 35],
      [412, 18],
    ],
    chartLabels: ["Week 1", "3", "5", "7", "9"],
    metrics: [
      { label: "Collected", value: "K1.82m", note: "This term", color: "#087f62" },
      { label: "Outstanding", value: "K392k", note: "Across accounts", color: "#dc3f45" },
      { label: "Receipts", value: "167", note: "This week", color: "#215ce8" },
      { label: "Collection rate", value: "82%", note: "Of term target", color: "#b9690d" },
    ],
    tasks: [
      { icon: ReceiptText, label: "Overdue accounts", count: "26", color: "#dc3f45" },
      { icon: Wallet, label: "Payments to match", count: "3", color: "#b9690d" },
      { icon: HandCoins, label: "Bursary reviews", count: "7", color: "#087f62" },
    ],
  },
  {
    id: "results",
    icon: FileBadge,
    label: "Results",
    eyebrow: "Assessment workflow",
    title: "Marks move through review with confidence",
    subtitle: "From teacher entry to approved family reports · Sample workspace",
    accent: "#6d46c7",
    tint: "#f1ecff",
    chartTitle: "Subject performance",
    chartCaption: "Current term averages",
    chartPath: "M8 66 C40 64 74 36 108 42 S168 72 205 52 S268 22 309 31 S369 48 412 25",
    chartPoints: [
      [8, 66],
      [108, 42],
      [205, 52],
      [309, 31],
      [412, 25],
    ],
    chartLabels: ["Math", "Eng", "Sci", "ICT", "Soc"],
    metrics: [
      { label: "Average", value: "68%", note: "Current term", color: "#215ce8" },
      { label: "Ready", value: "14", note: "Classes reviewed", color: "#087f62" },
      { label: "Awaiting", value: "12", note: "Approval actions", color: "#b9690d" },
      { label: "Published", value: "8", note: "Class reports", color: "#6d46c7" },
    ],
    tasks: [
      { icon: ClipboardCheck, label: "Awaiting approval", count: "12", color: "#6d46c7" },
      { icon: FileBadge, label: "Marks to verify", count: "4", color: "#b9690d" },
      { icon: CheckCircle2, label: "Ready to publish", count: "8", color: "#087f62" },
    ],
  },
];

function SystemPreview() {
  const [activeViewId, setActiveViewId] = useState(PREVIEW_VIEWS[0].id);
  const activeView = PREVIEW_VIEWS.find((view) => view.id === activeViewId) ?? PREVIEW_VIEWS[0];
  const chartGradientId = `preview-chart-${activeView.id}`;

  return (
    <div className="srms-tilt overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_35px_90px_rgba(8,28,51,0.18)] transition-transform duration-500 ease-out">
      <div className="flex h-12 items-center border-b border-slate-200 bg-[#fbfcfe] px-4 sm:px-5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff806e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f4c45d]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#54cda0]" />
        </div>
        <div className="mx-auto rounded-md border border-slate-200 bg-white px-5 py-1 text-[10px] font-semibold text-slate-400 shadow-sm">
          Demo school workspace
        </div>
        <span className="hidden rounded-full bg-[#e8f8f2] px-2 py-1 text-[9px] font-bold text-[#087f62] sm:block">
          Secure
        </span>
      </div>

      <div className="grid min-h-[470px] grid-cols-[64px_1fr] sm:grid-cols-[180px_1fr]">
        <aside className="bg-[#0a2038] px-2.5 py-5 text-white sm:px-4">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#45d3a2] text-[#06251d]">
              <School className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[11px] font-bold">Demo School</p>
              <p className="mt-0.5 text-[9px] text-white/40">Term 2 · 2026</p>
            </div>
          </div>

          <nav className="mt-7 space-y-1.5" aria-label="Explore the sample workspace">
            {PREVIEW_VIEWS.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={activeView.id === item.id}
                aria-label={`Preview ${item.label}`}
                onClick={() => setActiveViewId(item.id)}
                className={`group flex h-10 w-full items-center justify-center gap-2.5 rounded-lg px-2 text-[11px] font-semibold transition-all duration-200 sm:justify-start ${activeView.id === item.id ? "bg-white/11 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]" : "text-white/43 hover:bg-white/[0.055] hover:text-white/75"}`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${activeView.id === item.id ? "text-[#7ee7c1]" : "group-hover:scale-105"}`}
                />
                <span className="hidden sm:block">{item.label}</span>
                {activeView.id === item.id && (
                  <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#55d6a9] sm:block" />
                )}
              </button>
            ))}
          </nav>

          <div className="mt-8 hidden rounded-xl border border-white/8 bg-white/[0.04] p-3 sm:block">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
              Current role
            </p>
            <p className="mt-2 text-[11px] font-semibold">School administrator</p>
            <p className="mt-1 text-[9px] text-white/38">Select an area to explore</p>
          </div>
        </aside>

        <div className="min-w-0 bg-[#f5f7fa] p-4 sm:p-6 lg:p-7" aria-live="polite">
          <div key={activeView.id} className="srms-preview-enter">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: activeView.accent }}
                >
                  {activeView.eyebrow}
                </p>
                <h3 className="mt-1.5 text-base font-bold tracking-[-0.02em] text-[#10233c] sm:text-xl">
                  {activeView.title}
                </h3>
                <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">
                  {activeView.subtitle}
                </p>
              </div>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-black ring-4 ring-white"
                style={{ color: activeView.accent, backgroundColor: activeView.tint }}
              >
                <activeView.icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {activeView.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[9px] font-bold text-slate-400 sm:text-[10px]">
                      {metric.label}
                    </p>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: metric.color }}
                    />
                  </div>
                  <p className="mt-2 text-base font-extrabold tracking-[-0.02em] text-[#10233c] sm:text-lg">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-[9px] text-slate-400">{metric.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-[#10233c]">{activeView.chartTitle}</p>
                    <p className="mt-0.5 text-[9px] text-slate-400">{activeView.chartCaption}</p>
                  </div>
                  <span
                    className="rounded-md px-2 py-1 text-[9px] font-bold"
                    style={{ color: activeView.accent, backgroundColor: activeView.tint }}
                  >
                    Sample
                  </span>
                </div>
                <div className="mt-5 h-[105px] w-full">
                  <svg
                    viewBox="0 0 420 110"
                    className="srms-draw h-full w-full"
                    role="img"
                    aria-label="Illustrative attendance trend"
                  >
                    <defs>
                      <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeView.accent} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={activeView.accent} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`${activeView.chartPath} L412 106 L8 106 Z`}
                      fill={`url(#${chartGradientId})`}
                    />
                    <path
                      d={activeView.chartPath}
                      fill="none"
                      stroke={activeView.accent}
                      strokeWidth="3"
                      strokeLinecap="round"
                      pathLength={100}
                    />
                    {activeView.chartPoints.map(([x, y]) => (
                      <circle
                        key={`${x}-${y}`}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="white"
                        stroke={activeView.accent}
                        strokeWidth="2.5"
                      />
                    ))}
                  </svg>
                </div>
                <div className="flex justify-between text-[8px] font-semibold text-slate-400">
                  {activeView.chartLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold text-[#10233c]">Needs attention</p>
                <p className="mt-0.5 text-[9px] text-slate-400">One queue across teams</p>
                <div className="mt-4 space-y-2">
                  {activeView.tasks.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 rounded-lg bg-[#f6f8fb] px-2.5 py-2.5 transition-colors duration-200 hover:bg-[#eef2f8]"
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" style={{ color: item.color }} />
                      <span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-slate-600">
                        {item.label}
                      </span>
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-black text-slate-500 shadow-sm">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectedRecordCard() {
  return (
    <div className="srms-record-card hidden w-[306px] overflow-hidden rounded-2xl border border-white/20 bg-[#071827]/78 text-white shadow-[0_24px_70px_rgba(3,15,28,.38)] backdrop-blur-xl xl:block">
      <div className="flex items-center justify-between border-b border-white/12 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#55d6a9] opacity-55" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#55d6a9]" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/65">
            Connected record
          </span>
        </div>
        <Network className="h-4 w-4 text-[#7ee7c1]" />
      </div>
      <div className="p-5">
        <p className="font-['Poppins'] text-xl font-semibold leading-tight tracking-[-0.03em]">
          One learner. Every team in context.
        </p>
        <div className="relative mt-5 grid grid-cols-4 gap-2">
          <span className="absolute left-[12%] right-[12%] top-4 h-px bg-gradient-to-r from-transparent via-[#55d6a9]/70 to-transparent" />
          {[
            { icon: FileText, label: "Enrol" },
            { icon: BookOpen, label: "Learn" },
            { icon: Wallet, label: "Bill" },
            { icon: FileBadge, label: "Report" },
          ].map((item) => (
            <div
              key={item.label}
              className="relative z-10 flex flex-col items-center gap-2 text-center"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#102d49] text-[#7ee7c1] shadow-[0_0_0_4px_rgba(7,24,39,.78)]">
                <item.icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-[9px] font-bold text-white/48">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Written by /login whenever it successfully resolves a school's branding (by subdomain or
// /s/$slug handoff) — lets a returning visitor jump straight back in without hunting for
// their school's link again. Read-only here; /welcome never writes it.
const LAST_SCHOOL_KEY = "srms_last_school";

function readRememberedSchool(): { slug: string; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SCHOOL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.slug === "string" && typeof parsed.name === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

function WelcomePage() {
  const [activeSuiteId, setActiveSuiteId] = useState(PRODUCT_SUITES[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [rememberedSchool, setRememberedSchool] = useState<{ slug: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    setRememberedSchool(readRememberedSchool());
  }, []);
  const [demoForm, setDemoForm] = useState({
    reporterName: "",
    tenantName: "",
    reporterEmail: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const activeSuite =
    PRODUCT_SUITES.find((suite) => suite.id === activeSuiteId) ?? PRODUCT_SUITES[0];

  const { data: testimonials = [] } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: () => api.testimonials.public(),
    staleTime: 5 * 60 * 1000,
  });

  const demoMutation = useMutation({
    mutationFn: () => api.public.submitDemoRequest(demoForm),
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Request sent — we'll be in touch shortly.");
    },
    onError: (error: unknown) => {
      const apiMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data
        ?.message;
      toast.error(
        typeof apiMessage === "string" ? apiMessage : "Couldn't send that — please try again.",
      );
    },
  });

  const featuredTestimonials = useMemo(
    () => (testimonials as PublicTestimonial[]).slice(0, 3),
    [testimonials],
  );

  const sectionIds = useMemo(
    () => [
      "platform",
      "workflow",
      "roles",
      "faq",
      ...(featuredTestimonials.length > 0 ? ["stories"] : []),
    ],
    [featuredTestimonials.length],
  );
  const activeSection = useActiveSection(sectionIds);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setScrollProgress(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submitDemo = () => {
    if (
      !demoForm.reporterName.trim() ||
      !demoForm.tenantName.trim() ||
      !demoForm.reporterEmail.trim()
    ) {
      toast.error("Name, school, and a way to reach you are required");
      return;
    }
    demoMutation.mutate();
  };

  const openDemo = () => {
    setMobileMenuOpen(false);
    setDemoOpen(true);
  };

  const closeDemo = () => {
    setDemoOpen(false);
    setTimeout(() => {
      setSubmitted(false);
      setDemoForm({ reporterName: "", tenantName: "", reporterEmail: "", message: "" });
    }, 300);
  };

  return (
    <div className="srms-landing min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#0a1c30]">
      <style>{`
        @keyframes srms-kenburns {
          0% { transform: scale(1.06) translate3d(0,0,0); }
          100% { transform: scale(1.14) translate3d(-1%, -1%, 0); }
        }
        @keyframes srms-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes srms-draw-line {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
        .srms-hero-image { animation: srms-kenburns 22s ease-in-out infinite alternate; }
        .srms-float { animation: srms-float 5s ease-in-out infinite; }
        .srms-draw path[stroke] { stroke-dasharray: 100; animation: srms-draw-line 1.6s ease-out forwards; }
        .srms-tilt:hover { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce) {
          .srms-hero-image, .srms-float, .srms-draw path[stroke] { animation: none !important; }
        }
      `}</style>

      <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
        <div
          className="h-full bg-gradient-to-r from-[#215ce8] to-[#55d6a9] transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <a href="#top" aria-label="SRMS home">
            <BrandMark />
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.href.slice(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`relative py-2 text-sm font-semibold transition-colors ${isActive ? "text-[#0a1c30]" : "text-slate-500 hover:text-[#0a1c30]"}`}
                >
                  {link.label}
                  <span
                    className={`absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#215ce8] transition-transform duration-300 ${isActive ? "scale-x-100" : "scale-x-0"}`}
                  />
                </a>
              );
            })}
            {featuredTestimonials.length > 0 && (
              <a
                href="#stories"
                className={`relative py-2 text-sm font-semibold transition-colors ${activeSection === "stories" ? "text-[#0a1c30]" : "text-slate-500 hover:text-[#0a1c30]"}`}
              >
                Stories
                <span
                  className={`absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#215ce8] transition-transform duration-300 ${activeSection === "stories" ? "scale-x-100" : "scale-x-0"}`}
                />
              </a>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {rememberedSchool && (
              <a
                href={`/s/${rememberedSchool.slug}`}
                className="hidden items-center gap-1.5 rounded-full border border-[#215ce8]/20 bg-[#eaf0ff] px-3 py-1.5 text-xs font-bold text-[#215ce8] transition-colors hover:bg-[#dbe6ff] sm:inline-flex"
              >
                Continue to {rememberedSchool.name}
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
            <Button
              component={Link}
              to="/login"
              variant="text"
              size="small"
              sx={{ display: { xs: "none", sm: "inline-flex" }, color: "#20354f", px: 1.5 }}
            >
              Sign in
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={openDemo}
              endIcon={<ArrowRight className="h-3.5 w-3.5" />}
              sx={{
                bgcolor: "#1649bd",
                px: { xs: 1.5, sm: 2.25 },
                boxShadow: "0 8px 22px rgba(22,73,189,.18)",
                transition: "transform 160ms ease, box-shadow 160ms ease",
                "&:hover": {
                  bgcolor: "#103c9d",
                  transform: "translateY(-1px)",
                  boxShadow: "0 12px 28px rgba(22,73,189,.26)",
                },
              }}
            >
              Book a demo
            </Button>
            <IconButton
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
              sx={{ display: { xs: "inline-flex", lg: "none" }, color: "#0a1c30" }}
            >
              <Menu className="h-5 w-5" />
            </IconButton>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate min-h-[680px] overflow-hidden bg-[#081d33] text-white sm:min-h-[720px]">
          <div className="absolute inset-y-0 right-0 h-full w-full overflow-hidden md:w-[64%]">
            <img
              src="/landing-school-community.png"
              alt="Pupils and a teacher walking through a school courtyard"
              className="srms-hero-image h-full w-full object-cover object-[68%_center] opacity-35 md:opacity-100"
              fetchPriority="high"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#081d33_0%,#081d33_44%,rgba(8,29,51,.9)_58%,rgba(8,29,51,.16)_100%)] max-md:bg-[linear-gradient(90deg,rgba(8,29,51,.98)_0%,rgba(8,29,51,.88)_62%,rgba(8,29,51,.62)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,29,51,.72)_0%,transparent_40%)]" />
          <div className="srms-hero-grid pointer-events-none absolute inset-0 opacity-55" />
          <div className="pointer-events-none absolute -right-28 -top-40 h-[34rem] w-[34rem] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-4 -top-24 h-[23rem] w-[23rem] rounded-full border border-[#55d6a9]/20" />
          <div className="srms-float pointer-events-none absolute right-[6%] top-[18%] hidden h-24 w-24 rounded-full bg-[#55d6a9]/10 blur-2xl md:block" />

          <div className="relative mx-auto flex min-h-[680px] max-w-[1240px] items-center px-5 py-20 sm:min-h-[720px] sm:px-8">
            <div className="srms-hero-copy max-w-[650px]">
              <div className="inline-flex items-center gap-2 border-l-2 border-[#55d6a9] pl-3 text-xs font-bold uppercase tracking-[0.15em] text-white/72">
                <Sparkles className="h-3.5 w-3.5 text-[#55d6a9]" />
                Built for Zambian education
              </div>
              <h1 className="mt-7 max-w-2xl font-['Poppins'] text-[2.8rem] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[4.25rem] lg:text-[5.35rem]">
                Your entire school,
                <span className="srms-gradient-text block">working as one.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                SRMS connects learning, finance, people, campus services, and leadership in one
                secure system — so every team can act from the same trusted record.
              </p>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Button
                  variant="contained"
                  size="large"
                  onClick={openDemo}
                  endIcon={<ArrowRight className="h-4 w-4" />}
                  sx={{
                    minHeight: 52,
                    bgcolor: "#55d6a9",
                    color: "#06251d",
                    px: 3.5,
                    boxShadow: "0 14px 34px rgba(85,214,169,.18)",
                    transition: "transform 160ms ease, box-shadow 160ms ease",
                    "&:hover": {
                      bgcolor: "#6de0b8",
                      transform: "translateY(-2px)",
                      boxShadow: "0 18px 40px rgba(85,214,169,.28)",
                    },
                  }}
                >
                  Book a tailored walkthrough
                </Button>
                <Button
                  component={Link}
                  to="/login"
                  variant="text"
                  size="large"
                  sx={{
                    minHeight: 52,
                    color: "#fff",
                    px: 2.5,
                    "&:hover": { bgcolor: "rgba(255,255,255,.08)" },
                  }}
                >
                  Open your workspace
                </Button>
              </div>
              <p className="mt-4 text-sm text-white/48">
                {rememberedSchool ? (
                  <>
                    Not {rememberedSchool.name}?{" "}
                    <a
                      href={`/s/${rememberedSchool.slug}`}
                      className="font-semibold text-[#7ee7c1] underline underline-offset-2 hover:text-[#9ff0d3]"
                    >
                      Continue to {rememberedSchool.name}
                    </a>{" "}
                    instead.
                  </>
                ) : (
                  "Signing in works for any school on SRMS — we'll take you straight to your school's workspace."
                )}
              </p>
              <div className="mt-10 flex max-w-[620px] flex-wrap gap-x-7 gap-y-3 border-t border-white/14 pt-6 text-sm font-semibold text-white/68">
                {["ECE to secondary", "Role-based access", "ZMW & Mobile Money"].map((label) => (
                  <span key={label} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#55d6a9]" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute bottom-24 right-[max(2rem,calc((100vw-1240px)/2+2rem))] z-10">
            <ConnectedRecordCard />
          </div>
          <a
            href="#platform-preview"
            className="group absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-white/80 sm:flex"
          >
            Explore the platform
            <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-1" />
          </a>
        </section>

        <section
          id="platform-preview"
          aria-label="SRMS product preview"
          className="relative z-10 mx-auto -mt-14 scroll-mt-24 px-3 sm:-mt-20 sm:max-w-[1304px] sm:px-8"
        >
          <Reveal>
            <SystemPreview />
          </Reveal>
        </section>

        <section
          aria-label="Platform coverage"
          className="mx-auto max-w-[1240px] px-5 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-12"
        >
          <Reveal className="flex flex-col items-center justify-between gap-6 border-b border-slate-200 pb-8 lg:flex-row">
            <p className="text-sm font-bold text-slate-400">One platform across the whole school</p>
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-3">
              {COVERAGE.map((item) => (
                <span
                  key={item.label}
                  className="flex items-center gap-2 text-sm font-bold text-slate-600"
                >
                  <item.icon className="h-4 w-4 text-[#215ce8]" />
                  {item.label}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal
            delayMs={80}
            className="grid border-b border-slate-200 py-8 sm:grid-cols-3 sm:py-10"
          >
            {PLATFORM_PROOF.map((item, index) => (
              <div
                key={item.label}
                className={`flex items-baseline gap-3 py-3 sm:block sm:px-8 sm:py-0 ${index > 0 ? "border-t border-slate-200 sm:border-l sm:border-t-0" : ""}`}
              >
                <strong className="font-['Poppins'] text-3xl font-semibold tracking-[-0.05em] text-[#0a1c30] sm:text-4xl">
                  {item.value}
                </strong>
                <span className="text-sm font-semibold text-slate-500 sm:mt-2 sm:block">
                  {item.label}
                </span>
              </div>
            ))}
          </Reveal>
        </section>

        <section id="platform" className="scroll-mt-24 bg-white py-24 sm:py-28">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <Reveal className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#215ce8]">
                  Inside the platform
                </p>
                <h2 className="mt-4 font-['Poppins'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                  Replace disconnected tools with one operating system.
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-slate-600 lg:justify-self-end">
                Every module shares the same learners, staff, classes, permissions, and audit trail.
                Work entered once becomes useful everywhere it belongs.
              </p>
            </Reveal>

            <Reveal delayMs={100} className="mt-14 border-y border-slate-200">
              <div className="flex overflow-x-auto" role="tablist" aria-label="Product areas">
                {PRODUCT_SUITES.map((suite) => (
                  <button
                    key={suite.id}
                    id={`product-suite-tab-${suite.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeSuite.id === suite.id}
                    aria-controls="product-suite-panel"
                    tabIndex={activeSuite.id === suite.id ? 0 : -1}
                    onClick={() => setActiveSuiteId(suite.id)}
                    onKeyDown={(event) => {
                      const index = PRODUCT_SUITES.findIndex((item) => item.id === suite.id);
                      const direction =
                        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                      if (!direction) return;
                      event.preventDefault();
                      const next =
                        PRODUCT_SUITES[
                          (index + direction + PRODUCT_SUITES.length) % PRODUCT_SUITES.length
                        ];
                      setActiveSuiteId(next.id);
                      requestAnimationFrame(() =>
                        document.getElementById(`product-suite-tab-${next.id}`)?.focus(),
                      );
                    }}
                    className={`relative min-w-max flex-1 px-5 py-5 text-left text-sm font-bold transition-colors ${activeSuite.id === suite.id ? "text-[#0a1c30]" : "text-slate-400 hover:text-slate-700"}`}
                  >
                    {suite.label}
                    {activeSuite.id === suite.id && (
                      <span
                        className="absolute inset-x-5 bottom-0 h-0.5"
                        style={{ backgroundColor: suite.accent }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div
                id="product-suite-panel"
                key={activeSuite.id}
                role="tabpanel"
                aria-labelledby={`product-suite-tab-${activeSuite.id}`}
                className="srms-panel-enter grid gap-10 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-14"
              >
                <div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ color: activeSuite.accent, backgroundColor: activeSuite.tint }}
                  >
                    <activeSuite.icon className="h-6 w-6" />
                  </div>
                  <p
                    className="mt-7 text-xs font-black uppercase tracking-[0.16em]"
                    style={{ color: activeSuite.accent }}
                  >
                    {activeSuite.label}
                  </p>
                  <h3 className="mt-3 max-w-xl font-['Poppins'] text-2xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
                    {activeSuite.title}
                  </h3>
                  <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                    {activeSuite.description}
                  </p>
                  <Button
                    variant="text"
                    onClick={openDemo}
                    endIcon={<ArrowRight className="h-4 w-4" />}
                    sx={{
                      mt: 3,
                      color: activeSuite.accent,
                      px: 0,
                      "&:hover": { bgcolor: "transparent", opacity: 0.78 },
                    }}
                  >
                    Explore this area in a demo
                  </Button>
                </div>

                <div className="grid content-start gap-x-8 sm:grid-cols-2">
                  {activeSuite.modules.map((module, index) => (
                    <div
                      key={module}
                      className="flex min-h-[64px] items-center gap-3 border-b border-slate-200 py-3 text-sm font-bold text-slate-700"
                    >
                      <span className="text-[10px] font-black tabular-nums text-slate-300">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Check className="h-4 w-4 shrink-0" style={{ color: activeSuite.accent }} />
                      {module}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-24 py-24 sm:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#087f62]">
                One learner journey
              </p>
              <h2 className="mt-4 font-['Poppins'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                The record grows as the learner does.
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                Stop rebuilding the same picture in different offices. SRMS carries context forward
                through every important school workflow.
              </p>
            </Reveal>

            <div className="border-t border-slate-200">
              {LEARNER_JOURNEY.map((step, index) => (
                <Reveal key={step.number} delayMs={index * 80}>
                  <article className="group grid gap-4 border-b border-slate-200 py-7 transition-colors sm:grid-cols-[56px_58px_1fr] sm:items-start sm:gap-5 sm:py-8">
                    <span className="text-xs font-black tabular-nums text-slate-300">
                      {step.number}
                    </span>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f8f1] text-[#087f62] transition-transform duration-300 group-hover:scale-110">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-[-0.02em]">{step.title}</h3>
                      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                        {step.detail}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="roles" className="scroll-mt-24 bg-[#0a2038] py-24 text-white sm:py-28">
          <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
            <Reveal className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#55d6a9]">
                  Made for the whole school
                </p>
                <h2 className="mt-4 max-w-3xl font-['Poppins'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                  The right information for every role.
                </h2>
              </div>
              <p className="max-w-lg text-base leading-7 text-white/58 lg:justify-self-end">
                Staff see the tools they need. Families see what has been published. Leadership sees
                the full picture.
              </p>
            </Reveal>

            <div className="mt-14 grid border-l border-t border-white/12 sm:grid-cols-2">
              {ROLE_OUTCOMES.map((item, index) => (
                <Reveal key={item.role} delayMs={index * 70}>
                  <article className="group h-full border-b border-r border-white/12 p-6 transition-colors duration-300 hover:bg-white/[0.04] sm:p-8 lg:p-10">
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/8 text-[#7ee7c1] transition-transform duration-300 group-hover:scale-110">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-black text-white/22">0{index + 1}</span>
                    </div>
                    <h3 className="mt-7 text-lg font-bold">{item.role}</h3>
                    <p className="mt-3 max-w-md text-sm leading-6 text-white/54">{item.outcome}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {featuredTestimonials.length > 0 && (
          <section id="stories" className="scroll-mt-24 bg-white py-24 sm:py-28">
            <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
              <Reveal className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#215ce8]">
                  School stories
                </p>
                <h2 className="mt-4 font-['Poppins'] text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  What schools say about SRMS.
                </h2>
              </Reveal>
              <div className="mt-12 grid gap-5 md:grid-cols-3">
                {featuredTestimonials.map((testimonial, index) => {
                  const rating = testimonial.rating;
                  return (
                    <Reveal key={testimonial.id ?? index} delayMs={index * 90}>
                      <article className="flex h-full flex-col border-t-2 border-[#215ce8] bg-[#f6f8fb] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                        {typeof rating === "number" && (
                          <div className="mb-5 flex gap-1">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Star
                                key={starIndex}
                                className={`h-4 w-4 ${starIndex < rating ? "fill-[#e5a934] text-[#e5a934]" : "text-slate-200"}`}
                              />
                            ))}
                          </div>
                        )}
                        <p className="flex-1 text-base leading-7 text-slate-700">
                          “{testimonial.quote}”
                        </p>
                        <div className="mt-7 border-t border-slate-200 pt-4">
                          <p className="text-sm font-bold">{testimonial.authorName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[testimonial.authorRole, testimonial.schoolName]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </article>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section id="faq" className="scroll-mt-24 bg-[#f6f8fb] py-24 sm:py-28">
          <div className="mx-auto max-w-[880px] px-5 sm:px-8">
            <Reveal className="text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#215ce8]">
                Questions worth asking
              </p>
              <h2 className="mt-4 font-['Poppins'] text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Before you book a walkthrough.
              </h2>
            </Reveal>
            <Reveal delayMs={100} className="mt-12">
              {FAQS.map((item) => (
                <Accordion
                  key={item.q}
                  disableGutters
                  elevation={0}
                  square
                  sx={{
                    bgcolor: "transparent",
                    borderBottom: "1px solid #e2e8f0",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ChevronDown className="h-4 w-4 text-slate-400" />}
                    sx={{ px: 0, py: 1 }}
                  >
                    <span className="text-base font-bold text-[#0a1c30]">{item.q}</span>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pb: 3 }}>
                    <p className="max-w-2xl text-sm leading-7 text-slate-600">{item.a}</p>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Reveal>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 sm:py-24">
          <Reveal>
            <div className="mx-auto grid max-w-[1160px] overflow-hidden bg-[#1649bd] text-white shadow-[0_30px_80px_rgba(22,73,189,.2)] lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="p-8 sm:p-12 lg:p-14">
                <p className="text-xs font-black uppercase tracking-[0.17em] text-white/55">
                  A clearer way to run your school
                </p>
                <h2 className="mt-4 max-w-2xl font-['Poppins'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
                  See how SRMS fits your school.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/72">
                  We’ll tailor the walkthrough to your structure, priorities, and the teams that
                  need to work better together.
                </p>
              </div>
              <div className="border-t border-white/15 p-8 sm:p-12 lg:border-l lg:border-t-0 lg:p-14">
                <Button
                  variant="contained"
                  size="large"
                  onClick={openDemo}
                  endIcon={<ArrowRight className="h-4 w-4" />}
                  sx={{
                    minHeight: 54,
                    whiteSpace: "nowrap",
                    bgcolor: "#fff",
                    color: "#123b9b",
                    px: 3.5,
                    transition: "transform 160ms ease",
                    "&:hover": { bgcolor: "#f5f7fb", transform: "translateY(-2px)" },
                  }}
                >
                  Book your walkthrough
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div>
              <BrandMark />
              <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
                One connected platform for academics, operations, finance, and leadership.
              </p>
            </div>
            <div className="grid gap-8 text-sm sm:grid-cols-2 sm:gap-16">
              <div>
                <p className="font-bold text-slate-800">Explore</p>
                <div className="mt-4 flex flex-col gap-3 text-slate-500">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="transition-colors hover:text-slate-900"
                    >
                      {link.label}
                    </a>
                  ))}
                  <Link to="/login" className="transition-colors hover:text-slate-900">
                    Sign in
                  </Link>
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-800">Contact</p>
                <div className="mt-4 flex flex-col gap-3 text-slate-500">
                  <a
                    href="tel:+260976911338"
                    className="flex items-center gap-2 transition-colors hover:text-slate-900"
                  >
                    <Phone className="h-4 w-4" />
                    +260 976 911 338
                  </a>
                  <a
                    href="mailto:chrishentmatakala@yahoo.com"
                    className="flex items-center gap-2 transition-colors hover:text-slate-900"
                  >
                    <Mail className="h-4 w-4" />
                    chrishentmatakala@yahoo.com
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} School Records Management System.</span>
            <span>Built for schools across Zambia.</span>
          </div>
        </div>
      </footer>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        slotProps={{ paper: { sx: { width: "min(88vw, 360px)", bgcolor: "#fff" } } }}
      >
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between">
            <BrandMark compact />
            <IconButton aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </IconButton>
          </div>
          <nav
            aria-label="Mobile navigation"
            className="mt-10 flex flex-col border-t border-slate-200"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between border-b border-slate-200 py-5 text-base font-bold text-[#0a1c30]"
              >
                {link.label}
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </a>
            ))}
            {featuredTestimonials.length > 0 && (
              <a
                href="#stories"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between border-b border-slate-200 py-5 text-base font-bold text-[#0a1c30]"
              >
                Stories
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </a>
            )}
          </nav>
          <div className="mt-auto grid gap-3 pt-8">
            {rememberedSchool && (
              <a
                href={`/s/${rememberedSchool.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-[#215ce8]/20 bg-[#eaf0ff] px-4 py-2.5 text-sm font-bold text-[#215ce8]"
              >
                Continue to {rememberedSchool.name}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            )}
            <Button
              component={Link}
              to="/login"
              variant="outlined"
              color="inherit"
              fullWidth
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Button>
            <Button variant="contained" fullWidth onClick={openDemo} sx={{ bgcolor: "#1649bd" }}>
              Book a demo
            </Button>
          </div>
        </div>
      </Drawer>

      <Dialog open={demoOpen} onClose={closeDemo} maxWidth="xs" fullWidth>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitDemo();
          }}
        >
          <DialogTitle className="flex items-center justify-between">
            <span>Book a school walkthrough</span>
            <IconButton aria-label="Close demo request" size="small" onClick={closeDemo}>
              <X className="h-4 w-4" />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-7 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                  <Check className="h-6 w-6" />
                </div>
                <p className="text-base font-bold">Thanks — we’ve got your request.</p>
                <p className="text-sm leading-6 text-slate-500">
                  Someone from our team will contact you to arrange the walkthrough.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 pt-1">
                <p className="mb-1 text-sm leading-6 text-slate-500">
                  Share a few details and we’ll tailor the conversation to your school.
                </p>
                <TextField
                  label="Your name"
                  value={demoForm.reporterName}
                  onChange={(event) =>
                    setDemoForm({ ...demoForm, reporterName: event.target.value })
                  }
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  required
                  fullWidth
                  size="small"
                />
                <TextField
                  label="School or organisation"
                  value={demoForm.tenantName}
                  onChange={(event) => setDemoForm({ ...demoForm, tenantName: event.target.value })}
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                  required
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Email or phone"
                  value={demoForm.reporterEmail}
                  onChange={(event) =>
                    setDemoForm({ ...demoForm, reporterEmail: event.target.value })
                  }
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  required
                  fullWidth
                  size="small"
                />
                <TextField
                  label="What would you like to improve? (optional)"
                  value={demoForm.message}
                  onChange={(event) => setDemoForm({ ...demoForm, message: event.target.value })}
                  multiline
                  minRows={3}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                  fullWidth
                  size="small"
                />
              </div>
            )}
          </DialogContent>
          {!submitted && (
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={closeDemo}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={demoMutation.isPending}>
                {demoMutation.isPending ? "Sending…" : "Request walkthrough"}
              </Button>
            </DialogActions>
          )}
        </form>
      </Dialog>
    </div>
  );
}
