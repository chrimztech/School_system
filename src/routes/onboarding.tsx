import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  GitBranch,
  GraduationCap,
  Image as ImageIcon,
  Lock,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button, Chip, MenuItem, Switch, TextField } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { toast } from "sonner";
import {
  useTenant,
  gradeRangeForType,
  buildFeatureFlags,
  createTenantSubscription,
  ACADEMIC_LEVEL_META,
  ACADEMIC_LEVEL_ORDER,
  CAMPUS_STATUS_OPTIONS,
  createCampusDraft,
  defaultLevelsForType,
  FEATURE_META,
  FEATURE_ORDER,
  PLAN_CATALOG,
  planIncludesFeature,
  ZAMBIA_2023_GRADING_BANDS,
  type SchoolType,
  type Tenant,
  type AcademicLevel,
  type Campus,
  type CampusStatus,
  type PlanId,
  type FeatureCategory,
} from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboard a school — SRMS" }] }),
  component: OnboardingPage,
});

const steps = [
  "Identity",
  "Type & Curriculum",
  "Contact",
  "Address",
  "Governance",
  "Academic",
  "Finance",
  "Branding",
  "Modules",
  "Review",
] as const;

const types: { code: SchoolType; name: string; desc: string }[] = [
  { code: "NURSERY", name: "Nursery / ECD", desc: "Baby Class to Reception" },
  { code: "PRIMARY", name: "Primary", desc: "Grade 1 – Grade 6 (Zambia 2025)" },
  { code: "SECONDARY", name: "Secondary", desc: "Form 1–4 (O-Level) · Form 5–6 (A-Level)" },
  { code: "COMBINED", name: "Combined", desc: "Grade 1–6 · Form 1–6" },
  { code: "FULL", name: "Full School", desc: "Baby Class · Grade 1–6 · Form 1–6" },
];

const palette = [
  "#1e40af",
  "#047857",
  "#9d174d",
  "#b45309",
  "#7c3aed",
  "#0f766e",
  "#be123c",
  "#0369a1",
];

const provinces = [
  "Lusaka",
  "Central",
  "Copperbelt",
  "Eastern",
  "Luapula",
  "Muchinga",
  "Northern",
  "North-Western",
  "Southern",
  "Western",
];

const FEATURE_CATEGORY_ORDER: FeatureCategory[] = [
  "Communication",
  "Finance",
  "Operations",
  "Enterprise",
];
const PLAN_IDS: PlanId[] = ["core", "growth", "advanced", "enterprise"];

type Form = Omit<Tenant, "id" | "totalStudents" | "totalTeachers" | "totalClasses">;

function OnboardingPage() {
  const navigate = useNavigate();
  const { addTenant } = useTenant();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Form>({
    name: "",
    shortCode: "",
    levels: defaultLevelsForType("PRIMARY"),
    campuses: [
      createCampusDraft(
        { name: "", shortCode: "", district: "", city: "", physicalAddress: "", phone: "" },
        defaultLevelsForType("PRIMARY"),
      ),
    ],
    motto: "",
    district: "",
    province: "Lusaka",
    type: "PRIMARY",
    primaryColor: palette[0],
    secondaryColor: "#0f172a",
    accentColor: "#f59e0b",
    fontFamily: "Inter",
    currentTerm: 1,
    currentYear: 2026,
    logoUrl: "",
    faviconUrl: "",
    registrationNo: "",
    tpinNo: "",
    moeCode: "",
    examCentreNo: "",
    yearFounded: undefined,
    ownership: "Private",
    category: "Day",
    gender: "Mixed",
    curriculum: "ECZ",
    languageOfInstruction: "English",
    email: "",
    phone: "",
    altPhone: "",
    website: "",
    physicalAddress: "",
    poBox: "",
    city: "",
    postalCode: "",
    gpsCoordinates: "",
    headTeacher: "",
    headTeacherEmail: "",
    deputyHead: "",
    boardChair: "",
    termStart: "",
    termEnd: "",
    weekStart: "Monday",
    gradingScale: "ECZ",
    resultPublicationMode: "SEPARATE",
    gradingBands: ZAMBIA_2023_GRADING_BANDS,
    passMark: 40,
    currency: "ZMW",
    bankName: "",
    bankAccount: "",
    bankBranch: "",
    reportFooter: "",
    subscription: createTenantSubscription("core", { billingContact: "" }),
    features: buildFeatureFlags("core", { sms: true, momo: true }),
  });

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: keyof Form["features"]) =>
    setForm((f) => ({ ...f, features: { ...f.features, [k]: !f.features[k] } }));
  const setPlan = (planId: PlanId) =>
    setForm((f) => ({
      ...f,
      subscription: createTenantSubscription(planId, f.subscription),
      features: buildFeatureFlags(planId, f.features),
    }));

  const applyTypeTemplate = (type: SchoolType) => {
    const levels = defaultLevelsForType(type);
    setForm((current) => ({
      ...current,
      type,
      levels,
      campuses: current.campuses.map((campus) => ({
        ...campus,
        levels:
          campus.levels.filter((level) => levels.includes(level)).length > 0
            ? campus.levels.filter((level) => levels.includes(level))
            : levels,
      })),
    }));
  };

  const toggleLevel = (level: AcademicLevel) => {
    setForm((current) => {
      const nextLevels = current.levels.includes(level)
        ? current.levels.filter((item) => item !== level)
        : [...current.levels, level];
      if (nextLevels.length === 0) return current;
      return {
        ...current,
        levels: ACADEMIC_LEVEL_ORDER.filter((item) => nextLevels.includes(item)),
        campuses: current.campuses.map((campus) => ({
          ...campus,
          levels:
            campus.levels.filter((item) => nextLevels.includes(item)).length > 0
              ? campus.levels.filter((item) => nextLevels.includes(item))
              : nextLevels,
        })),
      };
    });
  };

  const addCampus = () => {
    setForm((current) => {
      return {
        ...current,
        campuses: [
          ...current.campuses,
          createCampusDraft(current, current.levels, current.campuses.length),
        ],
      };
    });
  };

  const updateCampus = (campusId: string, patch: Partial<Campus>) => {
    setForm((current) => ({
      ...current,
      campuses: current.campuses.map((campus) =>
        campus.id === campusId ? { ...campus, ...patch } : campus,
      ),
    }));
  };

  const removeCampus = (campusId: string) => {
    setForm((current) => {
      if (current.campuses.length === 1) return current;
      return {
        ...current,
        campuses: current.campuses.filter((campus) => campus.id !== campusId),
      };
    });
  };

  const toggleCampusLevel = (campusId: string, level: AcademicLevel) => {
    setForm((current) => ({
      ...current,
      campuses: current.campuses.map((campus) => {
        if (campus.id !== campusId) return campus;
        const nextLevels = campus.levels.includes(level)
          ? campus.levels.filter((item) => item !== level)
          : [...campus.levels, level];
        return {
          ...campus,
          levels:
            nextLevels.length > 0
              ? ACADEMIC_LEVEL_ORDER.filter((item) => nextLevels.includes(item))
              : campus.levels,
        };
      }),
    }));
  };

  const readAsDataUrl = (file: File, key: "logoUrl" | "faviconUrl") => {
    if (file.size > 2_000_000) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(key, reader.result as string);
    reader.readAsDataURL(file);
  };

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = async () => {
    setSubmitting(true);
    let created: Tenant;
    try {
      created = await addTenant(form);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          "Failed to provision school — check your connection and try again.",
      );
      setSubmitting(false);
      return;
    }

    try {
      // Create school admin user if head teacher email is provided
      const adminEmail = form.headTeacherEmail?.trim() || form.email?.trim();
      const adminName = form.headTeacher?.trim() || form.name;
      if (adminEmail && created.id) {
        try {
          await api.users.create(created.id, {
            name: adminName,
            email: adminEmail,
            role: "SCHOOL_ADMIN",
            password: "password123",
          });
          toast.success(`${form.name} provisioned — admin account: ${adminEmail} / password123`);
        } catch {
          toast.success(`${form.name} provisioned successfully`);
          toast.warning("Could not create admin user — add manually in User Management");
        }
      } else {
        toast.success(`${form.name} provisioned successfully`);
      }

      navigate({ to: "/sys-admin" });
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue = step === 0 ? form.name.trim() && form.shortCode.trim() : true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboard a new school"
        description="Capture the institution's full profile — identity, governance, academic and finance — to tailor the system end-to-end"
      />

      <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
        <ol className="flex flex-wrap items-center gap-2 p-2 text-xs">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i < step
                    ? "bg-success text-success-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={i === step ? "font-medium text-foreground" : "text-muted-foreground"}
              >
                {s}
              </span>
              {i < steps.length - 1 && <span className="mx-1 text-muted-foreground/40">/</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {/* STEP 0 — Identity */}
        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                label="School name *"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Mongu Trust Academy"
                fullWidth
                size="small"
              />
            </div>
            <TextField
              label="Short code *"
              value={form.shortCode}
              onChange={(e) => update("shortCode", e.target.value.toUpperCase())}
              placeholder="MTA"
              fullWidth
              size="small"
            />
            <TextField
              label="Motto"
              value={form.motto}
              onChange={(e) => update("motto", e.target.value)}
              placeholder="Knowledge. Service."
              fullWidth
              size="small"
            />
            <div className="sm:col-span-2">
              <p className="mb-1 text-sm font-medium">URL slug</p>
              <div className="flex items-center gap-0">
                <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground select-none">
                  srms.com/s/
                </span>
                <TextField
                  value={form.slug ?? ""}
                  onChange={(e) =>
                    update(
                      "slug",
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") || undefined,
                    )
                  }
                  placeholder="mongu-trust-academy"
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { className: "font-mono text-sm" } }}
                  sx={{ "& .MuiOutlinedInput-root": { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Unique link to this school's branded login page. Auto-generated from the short code
                if left blank.
              </p>
            </div>
            <TextField
              type="number"
              label="Year founded"
              value={form.yearFounded ?? ""}
              onChange={(e) =>
                update("yearFounded", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="1998"
              fullWidth
              size="small"
            />
            <TextField
              label="Registration number"
              value={form.registrationNo}
              onChange={(e) => update("registrationNo", e.target.value)}
              placeholder="MoE/REG/0001"
              fullWidth
              size="small"
            />
            <TextField
              label="TPIN"
              value={form.tpinNo}
              onChange={(e) => update("tpinNo", e.target.value)}
              placeholder="1001234567"
              fullWidth
              size="small"
            />
            <TextField
              label="MoE / EMIS code"
              value={form.moeCode}
              onChange={(e) => update("moeCode", e.target.value)}
              placeholder="EMIS-12345"
              fullWidth
              size="small"
            />
            <TextField
              label="ECZ exam centre number"
              value={form.examCentreNo}
              onChange={(e) => update("examCentreNo", e.target.value)}
              placeholder="700123"
              fullWidth
              size="small"
            />
          </div>
        )}

        {/* STEP 1 — Type & Curriculum */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((t) => {
                const active = t.code === form.type;
                return (
                  <button
                    key={t.code}
                    onClick={() => applyTypeTemplate(t.code)}
                    className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        active ? "bg-accent text-accent-foreground" : "border border-border"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                select
                label="Ownership"
                value={form.ownership}
                onChange={(e) => update("ownership", e.target.value as Form["ownership"])}
                fullWidth
                size="small"
              >
                {["Government", "Private", "Grant-Aided", "Community", "Faith-Based"].map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Category"
                value={form.category}
                onChange={(e) => update("category", e.target.value as Form["category"])}
                fullWidth
                size="small"
              >
                {["Day", "Boarding", "Day & Boarding"].map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Gender admission"
                value={form.gender}
                onChange={(e) => update("gender", e.target.value as Form["gender"])}
                fullWidth
                size="small"
              >
                {["Mixed", "Boys", "Girls"].map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Curriculum"
                value={form.curriculum}
                onChange={(e) => update("curriculum", e.target.value as Form["curriculum"])}
                fullWidth
                size="small"
              >
                {["ECZ", "Cambridge", "IB", "Hybrid"].map((o) => (
                  <MenuItem key={o} value={o}>
                    {o}
                  </MenuItem>
                ))}
              </TextField>
              <div className="sm:col-span-2">
                <TextField
                  label="Language of instruction"
                  value={form.languageOfInstruction}
                  onChange={(e) => update("languageOfInstruction", e.target.value)}
                  fullWidth
                  size="small"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Contact */}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              type="email"
              label="Official email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="info@school.ac.zm"
              fullWidth
              size="small"
            />
            <TextField
              label="Website"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              placeholder="https://school.ac.zm"
              fullWidth
              size="small"
            />
            <TextField
              label="Primary phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+260 211 000 000"
              fullWidth
              size="small"
            />
            <TextField
              label="Alternate phone"
              value={form.altPhone}
              onChange={(e) => update("altPhone", e.target.value)}
              placeholder="+260 977 000 000"
              fullWidth
              size="small"
            />
          </div>
        )}

        {/* STEP 3 — Address */}
        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                label="Physical address"
                multiline
                minRows={3}
                value={form.physicalAddress}
                onChange={(e) => update("physicalAddress", e.target.value)}
                placeholder="Plot 1234, Great East Road"
                fullWidth
                size="small"
              />
            </div>
            <TextField
              label="P.O. Box"
              value={form.poBox}
              onChange={(e) => update("poBox", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="City / Town"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="District"
              value={form.district}
              onChange={(e) => update("district", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Province"
              value={form.province}
              onChange={(e) => update("province", e.target.value)}
              fullWidth
              size="small"
            >
              {provinces.map((p) => (
                <MenuItem key={p} value={p}>
                  {p}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Postal code"
              value={form.postalCode}
              onChange={(e) => update("postalCode", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="GPS coordinates"
              value={form.gpsCoordinates}
              onChange={(e) => update("gpsCoordinates", e.target.value)}
              placeholder="-15.3875, 28.3228"
              fullWidth
              size="small"
            />
          </div>
        )}

        {/* STEP 4 — Governance */}
        {step === 4 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Head teacher"
              value={form.headTeacher}
              onChange={(e) => update("headTeacher", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              type="email"
              label="Head teacher email"
              value={form.headTeacherEmail}
              onChange={(e) => update("headTeacherEmail", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Deputy head"
              value={form.deputyHead}
              onChange={(e) => update("deputyHead", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Board chairperson"
              value={form.boardChair}
              onChange={(e) => update("boardChair", e.target.value)}
              fullWidth
              size="small"
            />
          </div>
        )}

        {/* STEP 5 — Academic */}
        {step === 5 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="surface-card-strong relative overflow-hidden rounded-2xl p-5 sm:col-span-2">
              <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Set the academic reporting policy</p>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
                      These defaults control every mark sheet and report card. School administrators
                      can refine them later; teachers cannot override them.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <Chip
                    size="small"
                    icon={<ShieldCheck size={12} />}
                    label="HOD verified"
                    sx={{ ...badgeSx("outline"), bgcolor: "background.paper" }}
                  />
                  <Chip
                    size="small"
                    icon={<Lock size={12} />}
                    label="Careers Guidance release"
                    sx={{ ...badgeSx("outline"), bgcolor: "background.paper" }}
                  />
                </div>
              </div>
            </div>
            <TextField
              select
              label="Current term"
              value={String(form.currentTerm)}
              onChange={(e) => update("currentTerm", Number(e.target.value) as 1 | 2 | 3)}
              fullWidth
              size="small"
            >
              <MenuItem value="1">Term 1</MenuItem>
              <MenuItem value="2">Term 2</MenuItem>
              <MenuItem value="3">Term 3</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Academic year"
              value={form.currentYear}
              onChange={(e) => update("currentYear", Number(e.target.value))}
              fullWidth
              size="small"
            />
            <TextField
              type="date"
              label="Term start date"
              value={form.termStart}
              onChange={(e) => update("termStart", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              size="small"
            />
            <TextField
              type="date"
              label="Term end date"
              value={form.termEnd}
              onChange={(e) => update("termEnd", e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Week starts"
              value={form.weekStart}
              onChange={(e) => update("weekStart", e.target.value as Form["weekStart"])}
              fullWidth
              size="small"
            >
              <MenuItem value="Monday">Monday</MenuItem>
              <MenuItem value="Sunday">Sunday</MenuItem>
            </TextField>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Grading scale</p>
              </div>
              <p className="mt-3 text-sm font-semibold">Zambia MoE 2023</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Achievement bands A–E with descriptions and points.
              </p>
              <Chip
                size="small"
                icon={<Lock size={12} />}
                label="Applied automatically"
                sx={{ ...badgeSx("secondary"), mt: 1.5 }}
              />
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Pass mark</p>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <TextField
                  type="number"
                  slotProps={{ htmlInput: { min: 0, max: 100 } }}
                  value={form.passMark}
                  onChange={(e) => update("passMark", Number(e.target.value))}
                  size="small"
                  sx={{ "& .MuiInputBase-input": { fontSize: "1.25rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" } }}
                />
                <span className="pb-2.5 text-sm text-muted-foreground">%</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Used for school performance analytics.
              </p>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Result publication</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose when Careers Guidance releases report cards to families.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: "SEPARATE",
                      title: "Separate releases",
                      copy: "Mid-term report first, followed by the end-of-term report.",
                      icon: GitBranch,
                    },
                    {
                      value: "COMBINED",
                      title: "Combined release",
                      copy: "One complete report after all term results are ready.",
                      icon: BookOpenCheck,
                    },
                  ] as const
                ).map((option) => {
                  const selected = form.resultPublicationMode === option.value;
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update("resultPublicationMode", option.value)}
                      className={`interactive-card rounded-2xl border p-4 text-left ${selected ? "border-primary bg-primary/[0.07] ring-1 ring-primary/20" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          <OptionIcon className="h-4 w-4" />
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "border border-border"}`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold">{option.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.copy}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-border p-4 sm:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Zambia 2023 achievement scale</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Administrators can adjust these bands later; teachers receive automatic grades.
                  </p>
                </div>
                <Chip size="small" label="8 achievement bands" sx={badgeSx("outline")} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {form.gradingBands.map((band) => (
                  <div
                    key={band.grade}
                    className="rounded-xl border border-border bg-background p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">{band.grade}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {band.min}–{band.max}
                      </span>
                    </div>
                    <p className="mt-2 font-medium">{band.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {band.points} point{band.points === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Academic levels offered</p>
                  <p className="text-xs text-muted-foreground">
                    Schools can span multiple levels even under one tenant.
                  </p>
                </div>
                <Chip
                  size="small"
                  label={`${form.levels.length} level${form.levels.length === 1 ? "" : "s"}`}
                  sx={badgeSx("outline")}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {ACADEMIC_LEVEL_ORDER.map((level) => {
                  const active = form.levels.includes(level);
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => toggleLevel(level)}
                      className={`rounded-lg border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <p className="text-sm font-medium">{ACADEMIC_LEVEL_META[level].label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACADEMIC_LEVEL_META[level].grades}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Campus structure</p>
                  <p className="text-xs text-muted-foreground">
                    Configure one or more campuses under this school.
                  </p>
                </div>
                <Button type="button" variant="outlined" size="small" onClick={addCampus} startIcon={<Plus className="h-4 w-4" />}>
                  Add campus
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                {form.campuses.map((campus, index) => (
                  <div key={campus.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Campus {index + 1}</p>
                        <p className="text-xs text-muted-foreground">
                          Levels and operational ownership for this location.
                        </p>
                      </div>
                      {form.campuses.length > 1 && (
                        <Button
                          type="button"
                          variant="text"
                          color="inherit"
                          size="small"
                          onClick={() => removeCampus(campus.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <TextField
                        label="Campus name"
                        value={campus.name}
                        onChange={(e) => updateCampus(campus.id, { name: e.target.value })}
                        placeholder="Main Campus"
                        fullWidth
                        size="small"
                      />
                      <TextField
                        label="Campus code"
                        value={campus.code}
                        onChange={(e) =>
                          updateCampus(campus.id, { code: e.target.value.toUpperCase() })
                        }
                        placeholder="MTA1"
                        fullWidth
                        size="small"
                      />
                      <TextField
                        label="District"
                        value={campus.district}
                        onChange={(e) => updateCampus(campus.id, { district: e.target.value })}
                        placeholder="Lusaka"
                        fullWidth
                        size="small"
                      />
                      <TextField
                        select
                        label="Status"
                        value={campus.status}
                        onChange={(e) =>
                          updateCampus(campus.id, { status: e.target.value as CampusStatus })
                        }
                        fullWidth
                        size="small"
                      >
                        {CAMPUS_STATUS_OPTIONS.map((status) => (
                          <MenuItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </MenuItem>
                        ))}
                      </TextField>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm font-medium">Levels hosted on this campus</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.levels.map((level) => {
                          const active = campus.levels.includes(level);
                          return (
                            <button
                              key={`${campus.id}-${level}`}
                              type="button"
                              onClick={() => toggleCampusLevel(campus.id, level)}
                              className={`rounded-full border px-3 py-1 text-xs transition ${
                                active
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {ACADEMIC_LEVEL_META[level].label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6 — Finance */}
        {step === 6 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              select
              label="Default currency"
              value={form.currency}
              onChange={(e) => update("currency", e.target.value as Form["currency"])}
              fullWidth
              size="small"
            >
              <MenuItem value="ZMW">Zambian Kwacha (ZMW)</MenuItem>
              <MenuItem value="USD">US Dollar (USD)</MenuItem>
            </TextField>
            <TextField
              label="Bank name"
              value={form.bankName}
              onChange={(e) => update("bankName", e.target.value)}
              placeholder="Zanaco"
              fullWidth
              size="small"
            />
            <TextField
              label="Account number"
              value={form.bankAccount}
              onChange={(e) => update("bankAccount", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Branch"
              value={form.bankBranch}
              onChange={(e) => update("bankBranch", e.target.value)}
              fullWidth
              size="small"
            />
          </div>
        )}

        {/* STEP 7 — Branding */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">School logo</p>
                <p className="text-xs text-muted-foreground">PNG or SVG, square, max 2MB.</p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInput}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readAsDataUrl(f, "logoUrl");
                      }}
                    />
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      onClick={() => logoInput.current?.click()}
                      startIcon={<Upload className="h-4 w-4" />}
                    >
                      Upload logo
                    </Button>
                    {form.logoUrl && (
                      <Button
                        type="button"
                        variant="text"
                        color="inherit"
                        size="small"
                        onClick={() => update("logoUrl", "")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Favicon</p>
                <p className="text-xs text-muted-foreground">32×32 ICO/PNG, max 2MB.</p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {form.faviconUrl ? (
                      <img
                        src={form.faviconUrl}
                        alt="Favicon"
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={faviconInput}
                      type="file"
                      accept="image/*,.ico"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readAsDataUrl(f, "faviconUrl");
                      }}
                    />
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      onClick={() => faviconInput.current?.click()}
                      startIcon={<Upload className="h-4 w-4" />}
                    >
                      Upload favicon
                    </Button>
                    {form.faviconUrl && (
                      <Button
                        type="button"
                        variant="text"
                        color="inherit"
                        size="small"
                        onClick={() => update("faviconUrl", "")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">Primary brand colour</p>
              <p className="text-xs text-muted-foreground">
                Used in the sidebar logo, badges and reports header.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {palette.map((c) => (
                  <button
                    key={c}
                    onClick={() => update("primaryColor", c)}
                    className={`h-10 w-10 rounded-md border-2 transition ${
                      form.primaryColor === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                type="color"
                label="Secondary colour"
                value={form.secondaryColor}
                onChange={(e) => update("secondaryColor", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
                size="small"
              />
              <TextField
                type="color"
                label="Accent colour"
                value={form.accentColor}
                onChange={(e) => update("accentColor", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
                size="small"
              />
              <TextField
                select
                label="Heading font"
                value={form.fontFamily}
                onChange={(e) => update("fontFamily", e.target.value)}
                fullWidth
                size="small"
              >
                {["Inter", "Poppins", "Merriweather", "Playfair Display", "Source Sans 3"].map(
                  (o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ),
                )}
              </TextField>
            </div>

            <TextField
              label="Report card footer text"
              multiline
              minRows={3}
              value={form.reportFooter}
              onChange={(e) => update("reportFooter", e.target.value)}
              placeholder="Issued by the Office of the Head Teacher. This report is computer-generated."
              fullWidth
              size="small"
            />

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg text-white"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <GraduationCap className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ fontFamily: form.fontFamily }}>
                    {form.name || "School name"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.shortCode || "CODE"} · {form.district || "District"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8 — Modules */}
        {step === 8 && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium">Starting plan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Determines which modules can be switched on below. Can be changed later from
                Billing.
              </p>
              <TextField
                select
                value={form.subscription.planId}
                onChange={(e) => setPlan(e.target.value as PlanId)}
                fullWidth
                size="small"
                sx={{ mt: 2 }}
              >
                {PLAN_IDS.map((id) => (
                  <MenuItem key={id} value={id}>
                    {PLAN_CATALOG[id].name} — {PLAN_CATALOG[id].badge}
                  </MenuItem>
                ))}
              </TextField>
            </div>

            {FEATURE_CATEGORY_ORDER.map((category) => {
              const keys = FEATURE_ORDER.filter((k) => FEATURE_META[k].category === category);
              if (keys.length === 0) return null;
              return (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </p>
                  <div className="space-y-2">
                    {keys.map((k) => {
                      const meta = FEATURE_META[k];
                      const unlocked = planIncludesFeature(form.subscription.planId, k);
                      return (
                        <div
                          key={k}
                          className={`flex items-center justify-between rounded-lg border border-border p-3 ${!unlocked ? "opacity-60" : ""}`}
                        >
                          <div>
                            <p className="flex items-center gap-1.5 text-sm font-medium">
                              {meta.label}
                              {!unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {unlocked
                                ? meta.description
                                : `Requires ${PLAN_CATALOG[meta.availableFrom].name} plan`}
                            </p>
                          </div>
                          <Switch
                            checked={form.features[k]}
                            disabled={!unlocked}
                            onChange={() => toggle(k)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STEP 9 — Review */}
        {step === 9 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-accent/10 p-4">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
              <div>
                <p className="text-sm font-medium">Ready to provision</p>
                <p className="text-xs text-muted-foreground">
                  Grade structure, term calendar and report templates will be generated
                  automatically.
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Name", form.name],
                ["Code", form.shortCode],
                ["Type", `${form.type} · ${gradeRangeForType(form.type)}`],
                ["Ownership", form.ownership],
                ["Category", form.category],
                ["Curriculum", form.curriculum],
                ["MoE code", form.moeCode || "—"],
                ["ECZ centre", form.examCentreNo || "—"],
                ["Location", `${form.district}, ${form.province}`],
                ["Levels", form.levels.map((level) => ACADEMIC_LEVEL_META[level].label).join(", ")],
                ["Campuses", `${form.campuses.length} configured`],
                ["Head teacher", form.headTeacher || "—"],
                ["Term", `Term ${form.currentTerm}, ${form.currentYear}`],
                ["Currency", form.currency],
                ["Pass mark", `${form.passMark}%`],
                [
                  "Result release",
                  form.resultPublicationMode === "SEPARATE"
                    ? "Mid-term and end-of-term separately"
                    : "Combined term report",
                ],
                ["Brand", form.primaryColor],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-border p-3">
                  <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v as string}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {Object.entries(form.features)
                .filter(([, v]) => v)
                .map(([k]) => (
                  <Chip key={k} size="small" label={k} sx={badgeSx("secondary")} />
                ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <Button variant="text" color="inherit" onClick={back} disabled={step === 0} startIcon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button variant="contained" onClick={next} disabled={!canContinue} endIcon={<ArrowRight className="h-4 w-4" />}>
              Next
            </Button>
          ) : (
            <Button variant="contained" onClick={() => void finish()} disabled={submitting} endIcon={<Check className="h-4 w-4" />}>
              Provision school
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
