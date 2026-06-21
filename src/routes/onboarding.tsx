import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useTenant, gradeRangeForType, buildFeatureFlags, createTenantSubscription, PLAN_CATALOG,
  ACADEMIC_LEVEL_META, ACADEMIC_LEVEL_ORDER, CAMPUS_STATUS_OPTIONS, createCampusDraft, defaultLevelsForType,
  type SchoolType, type Tenant, type PlanId, type BillingCycle, type AcademicLevel, type Campus, type CampusStatus,
} from "@/lib/tenant";
import { PLAN_UI } from "@/lib/subscription";
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
  "Subscription",
  "Review",
] as const;

const PLAN_IDS: PlanId[] = ["core", "growth", "advanced", "enterprise"];

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
    campuses: [createCampusDraft({ name: "", shortCode: "", district: "", city: "", physicalAddress: "", phone: "" }, defaultLevelsForType("PRIMARY"))],
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
    passMark: 50,
    currency: "ZMW",
    bankName: "",
    bankAccount: "",
    bankBranch: "",
    reportFooter: "",
    subscription: createTenantSubscription("core", { billingContact: "" }),
    features: buildFeatureFlags("core", { sms: true, momo: true }),
  });

  const update = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const toggle = (k: keyof Form["features"]) =>
    setForm((f) => ({ ...f, features: { ...f.features, [k]: !f.features[k] } }));

  const applyTypeTemplate = (type: SchoolType) => {
    const levels = defaultLevelsForType(type);
    setForm((current) => ({
      ...current,
      type,
      levels,
      campuses: current.campuses.map((campus) => ({
        ...campus,
        levels: campus.levels.filter((level) => levels.includes(level)).length > 0
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
          levels: campus.levels.filter((item) => nextLevels.includes(item)).length > 0
            ? campus.levels.filter((item) => nextLevels.includes(item))
            : nextLevels,
        })),
      };
    });
  };

  const addCampus = () => {
    setForm((current) => {
      if (current.campuses.length >= current.subscription.campusLimit) {
        toast.error(`The ${PLAN_CATALOG[current.subscription.planId].name} plan supports up to ${current.subscription.campusLimit} campus${current.subscription.campusLimit === 1 ? "" : "es"}.`);
        return current;
      }
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
      campuses: current.campuses.map((campus) => (
        campus.id === campusId ? { ...campus, ...patch } : campus
      )),
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
          levels: nextLevels.length > 0
            ? ACADEMIC_LEVEL_ORDER.filter((item) => nextLevels.includes(item))
            : campus.levels,
        };
      }),
    }));
  };

  const onPlanChange = (planId: PlanId, cycle: BillingCycle) => {
    setForm((f) => ({
      ...f,
      subscription: createTenantSubscription(planId, {
        billingCycle: cycle,
        billingContact: f.subscription.billingContact,
        status: "trial",
      }),
      features: buildFeatureFlags(planId),
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
    try {
      const created = await addTenant(form);

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

  const canContinue =
    step === 0 ? form.name.trim() && form.shortCode.trim() : true;

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
                className={
                  i === step ? "font-medium text-foreground" : "text-muted-foreground"
                }
              >
                {s}
              </span>
              {i < steps.length - 1 && (
                <span className="mx-1 text-muted-foreground/40">/</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {/* STEP 0 — Identity */}
        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">School name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Mongu Trust Academy"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="code">Short code *</Label>
              <Input
                id="code"
                value={form.shortCode}
                onChange={(e) => update("shortCode", e.target.value.toUpperCase())}
                placeholder="MTA"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="motto">Motto</Label>
              <Input
                id="motto"
                value={form.motto}
                onChange={(e) => update("motto", e.target.value)}
                placeholder="Knowledge. Service."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="yearFounded">Year founded</Label>
              <Input
                id="yearFounded"
                type="number"
                value={form.yearFounded ?? ""}
                onChange={(e) =>
                  update("yearFounded", e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="1998"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reg">Registration number</Label>
              <Input
                id="reg"
                value={form.registrationNo}
                onChange={(e) => update("registrationNo", e.target.value)}
                placeholder="MoE/REG/0001"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tpin">TPIN</Label>
              <Input
                id="tpin"
                value={form.tpinNo}
                onChange={(e) => update("tpinNo", e.target.value)}
                placeholder="1001234567"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="moe">MoE / EMIS code</Label>
              <Input
                id="moe"
                value={form.moeCode}
                onChange={(e) => update("moeCode", e.target.value)}
                placeholder="EMIS-12345"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ecz">ECZ exam centre number</Label>
              <Input
                id="ecz"
                value={form.examCentreNo}
                onChange={(e) => update("examCentreNo", e.target.value)}
                placeholder="700123"
                className="mt-1"
              />
            </div>
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
              <div>
                <Label>Ownership</Label>
                <Select
                  value={form.ownership}
                  onValueChange={(v) => update("ownership", v as Form["ownership"])}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Government", "Private", "Grant-Aided", "Community", "Faith-Based"].map(
                      (o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => update("category", v as Form["category"])}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Day", "Boarding", "Day & Boarding"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender admission</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => update("gender", v as Form["gender"])}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Mixed", "Boys", "Girls"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Curriculum</Label>
                <Select
                  value={form.curriculum}
                  onValueChange={(v) => update("curriculum", v as Form["curriculum"])}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["ECZ", "Cambridge", "IB", "Hybrid"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="lang">Language of instruction</Label>
                <Input
                  id="lang"
                  value={form.languageOfInstruction}
                  onChange={(e) => update("languageOfInstruction", e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Contact */}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Official email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="info@school.ac.zm"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://school.ac.zm"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone">Primary phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+260 211 000 000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="alt">Alternate phone</Label>
              <Input
                id="alt"
                value={form.altPhone}
                onChange={(e) => update("altPhone", e.target.value)}
                placeholder="+260 977 000 000"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* STEP 3 — Address */}
        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="addr">Physical address</Label>
              <Textarea
                id="addr"
                value={form.physicalAddress}
                onChange={(e) => update("physicalAddress", e.target.value)}
                placeholder="Plot 1234, Great East Road"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="po">P.O. Box</Label>
              <Input
                id="po"
                value={form.poBox}
                onChange={(e) => update("poBox", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="city">City / Town</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Province</Label>
              <Select value={form.province} onValueChange={(v) => update("province", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="postal">Postal code</Label>
              <Input
                id="postal"
                value={form.postalCode}
                onChange={(e) => update("postalCode", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="gps">GPS coordinates</Label>
              <Input
                id="gps"
                value={form.gpsCoordinates}
                onChange={(e) => update("gpsCoordinates", e.target.value)}
                placeholder="-15.3875, 28.3228"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* STEP 4 — Governance */}
        {step === 4 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="head">Head teacher</Label>
              <Input
                id="head"
                value={form.headTeacher}
                onChange={(e) => update("headTeacher", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="hemail">Head teacher email</Label>
              <Input
                id="hemail"
                type="email"
                value={form.headTeacherEmail}
                onChange={(e) => update("headTeacherEmail", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="deputy">Deputy head</Label>
              <Input
                id="deputy"
                value={form.deputyHead}
                onChange={(e) => update("deputyHead", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="board">Board chairperson</Label>
              <Input
                id="board"
                value={form.boardChair}
                onChange={(e) => update("boardChair", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* STEP 5 — Academic */}
        {step === 5 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Current term</Label>
              <Select
                value={String(form.currentTerm)}
                onValueChange={(v) => update("currentTerm", Number(v) as 1 | 2 | 3)}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year">Academic year</Label>
              <Input
                id="year"
                type="number"
                value={form.currentYear}
                onChange={(e) => update("currentYear", Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tstart">Term start date</Label>
              <Input
                id="tstart"
                type="date"
                value={form.termStart}
                onChange={(e) => update("termStart", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tend">Term end date</Label>
              <Input
                id="tend"
                type="date"
                value={form.termEnd}
                onChange={(e) => update("termEnd", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Week starts</Label>
              <Select
                value={form.weekStart}
                onValueChange={(v) => update("weekStart", v as Form["weekStart"])}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monday">Monday</SelectItem>
                  <SelectItem value="Sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Grading scale</Label>
              <Select
                value={form.gradingScale}
                onValueChange={(v) => update("gradingScale", v as Form["gradingScale"])}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ECZ", "Percentage", "GPA", "Letter"].map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pass">Pass mark (%)</Label>
              <Input
                id="pass"
                type="number"
                value={form.passMark}
                onChange={(e) => update("passMark", Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Academic levels offered</p>
                  <p className="text-xs text-muted-foreground">
                    Schools can span multiple levels even under one tenant.
                  </p>
                </div>
                <Badge variant="outline">{form.levels.length} level{form.levels.length === 1 ? "" : "s"}</Badge>
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
                        active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <p className="text-sm font-medium">{ACADEMIC_LEVEL_META[level].label}</p>
                      <p className="text-xs text-muted-foreground">{ACADEMIC_LEVEL_META[level].grades}</p>
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
                    Configure one or more campuses under the same school subscription.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addCampus}>
                  <Plus className="mr-1 h-4 w-4" />Add campus
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                {form.campuses.map((campus, index) => (
                  <div key={campus.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Campus {index + 1}</p>
                        <p className="text-xs text-muted-foreground">Levels and operational ownership for this location.</p>
                      </div>
                      {form.campuses.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeCampus(campus.id)}>
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Campus name</Label>
                        <Input
                          className="mt-1"
                          value={campus.name}
                          onChange={(e) => updateCampus(campus.id, { name: e.target.value })}
                          placeholder="Main Campus"
                        />
                      </div>
                      <div>
                        <Label>Campus code</Label>
                        <Input
                          className="mt-1"
                          value={campus.code}
                          onChange={(e) => updateCampus(campus.id, { code: e.target.value.toUpperCase() })}
                          placeholder="MTA1"
                        />
                      </div>
                      <div>
                        <Label>District</Label>
                        <Input
                          className="mt-1"
                          value={campus.district}
                          onChange={(e) => updateCampus(campus.id, { district: e.target.value })}
                          placeholder="Lusaka"
                        />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select
                          value={campus.status}
                          onValueChange={(value) => updateCampus(campus.id, { status: value as CampusStatus })}
                        >
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CAMPUS_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Label>Levels hosted on this campus</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.levels.map((level) => {
                          const active = campus.levels.includes(level);
                          return (
                            <button
                              key={`${campus.id}-${level}`}
                              type="button"
                              onClick={() => toggleCampusLevel(campus.id, level)}
                              className={`rounded-full border px-3 py-1 text-xs transition ${
                                active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
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
            <div>
              <Label>Default currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => update("currency", v as Form["currency"])}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZMW">Zambian Kwacha (ZMW)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bank">Bank name</Label>
              <Input
                id="bank"
                value={form.bankName}
                onChange={(e) => update("bankName", e.target.value)}
                placeholder="Zanaco"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="acc">Account number</Label>
              <Input
                id="acc"
                value={form.bankAccount}
                onChange={(e) => update("bankAccount", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={form.bankBranch}
                onChange={(e) => update("bankBranch", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* STEP 7 — Branding */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>School logo</Label>
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
                      variant="outline"
                      size="sm"
                      onClick={() => logoInput.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />Upload logo
                    </Button>
                    {form.logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => update("logoUrl", "")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <Label>Favicon</Label>
                <p className="text-xs text-muted-foreground">32×32 ICO/PNG, max 2MB.</p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {form.faviconUrl ? (
                      <img src={form.faviconUrl} alt="Favicon" className="h-10 w-10 object-contain" />
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
                      variant="outline"
                      size="sm"
                      onClick={() => faviconInput.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />Upload favicon
                    </Button>
                    {form.faviconUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
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
              <Label>Primary brand colour</Label>
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
              <div>
                <Label htmlFor="sec">Secondary colour</Label>
                <Input
                  id="sec"
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => update("secondaryColor", e.target.value)}
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label htmlFor="acc">Accent colour</Label>
                <Input
                  id="acc"
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => update("accentColor", e.target.value)}
                  className="mt-1 h-10"
                />
              </div>
              <div>
                <Label>Heading font</Label>
                <Select
                  value={form.fontFamily}
                  onValueChange={(v) => update("fontFamily", v)}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Inter", "Poppins", "Merriweather", "Playfair Display", "Source Sans 3"].map(
                      (o) => (<SelectItem key={o} value={o}>{o}</SelectItem>),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="footer">Report card footer text</Label>
              <Textarea
                id="footer"
                value={form.reportFooter}
                onChange={(e) => update("reportFooter", e.target.value)}
                placeholder="Issued by the Office of the Head Teacher. This report is computer-generated."
                className="mt-1"
              />
            </div>

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
                  <p
                    className="text-base font-semibold"
                    style={{ fontFamily: form.fontFamily }}
                  >
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
          <div className="space-y-3">
            {(
              [
                ["sms", "SMS parent alerts", "Africa's Talking gateway"],
                ["ussd", "USSD fallback", "For parents without smartphones"],
                ["momo", "Mobile money", "MTN MoMo, Airtel Money, Zamtel Kwacha"],
                ["ecz", "ECZ integration", "Auto-register exam candidates"],
                ["library", "Library module", "Catalogue & circulation"],
                ["transport", "Transport routes", "Bus tracking & fees"],
              ] as const
            ).map(([k, label, desc]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch checked={form.features[k]} onCheckedChange={() => toggle(k)} />
              </div>
            ))}
          </div>
        )}

        {/* STEP 9 — Subscription */}
        {step === 9 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold mb-1">Choose a subscription plan</p>
              <p className="text-xs text-muted-foreground mb-4">
                The plan determines which modules are available and the learner capacity. You can upgrade later.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PLAN_IDS.map((planId) => {
                  const plan = PLAN_CATALOG[planId];
                  const planUi = PLAN_UI[planId];
                  const isSelected = form.subscription.planId === planId;
                  return (
                    <button
                      key={planId}
                      onClick={() => onPlanChange(planId, form.subscription.billingCycle)}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`${planUi.badgeClass} text-[11px]`}>{plan.name}</Badge>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-xl font-bold">
                        K{(form.subscription.billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice).toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground">
                          /{form.subscription.billingCycle === "annual" ? "yr" : "mo"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                      <div className="mt-3 text-xs text-muted-foreground space-y-0.5 border-t border-border pt-2">
                        <p>Up to {plan.campusLimit} campus{plan.campusLimit === 1 ? "" : "es"}</p>
                        <p>Up to {plan.learnerLimit.toLocaleString()} learners</p>
                        <p>{plan.smsQuota.toLocaleString()} SMS / month</p>
                        <p>{plan.supportLevel} support</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-3">Billing cycle</p>
              <div className="grid grid-cols-2 gap-3">
                {(["monthly", "annual"] as BillingCycle[]).map((cycle) => {
                  const isSelected = form.subscription.billingCycle === cycle;
                  const price = cycle === "annual"
                    ? PLAN_CATALOG[form.subscription.planId].annualPrice
                    : PLAN_CATALOG[form.subscription.planId].monthlyPrice;
                  return (
                    <button
                      key={cycle}
                      onClick={() => onPlanChange(form.subscription.planId, cycle)}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold capitalize">{cycle}</p>
                        {cycle === "annual" && (
                          <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">Save 17%</span>
                        )}
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-lg font-bold mt-1">K{price.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {cycle === "annual" ? "Billed once per year" : "Billed each month"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Billing contact email</p>
              <input
                type="email"
                value={form.subscription.billingContact}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subscription: { ...f.subscription, billingContact: e.target.value } }))
                }
                placeholder="bursar@school.zm"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{PLAN_CATALOG[form.subscription.planId].name} · {form.subscription.billingCycle}</p>
                <p className="text-xs text-muted-foreground">
                  Trial starts immediately. First invoice on {form.subscription.nextInvoiceDate}. Campus allowance: {form.subscription.campusLimit}.
                </p>
              </div>
              <p className="text-2xl font-bold">K{form.subscription.amount.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* STEP 10 — Review */}
        {step === 10 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-accent/10 p-4">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
              <div>
                <p className="text-sm font-medium">Ready to provision</p>
                <p className="text-xs text-muted-foreground">
                  Grade structure, term calendar and report templates will be generated automatically.
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
                ["Brand", form.primaryColor],
                ["Plan", `${PLAN_CATALOG[form.subscription.planId].name} · ${form.subscription.billingCycle}`],
                ["First invoice", `K${form.subscription.amount.toLocaleString()}`],
                ["Billing contact", form.subscription.billingContact || "—"],
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
                  <Badge key={k} variant="secondary">{k}</Badge>
                ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={next} disabled={!canContinue}>
              Next<ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => void finish()} disabled={submitting}>
              Provision school<Check className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
