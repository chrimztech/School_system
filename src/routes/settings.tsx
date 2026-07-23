import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  BookOpenCheck,
  Check,
  ChevronDown,
  GitBranch,
  Image as ImageIcon,
  Info,
  Lock,
  LayoutGrid,
  Palette,
  RotateCcw,
  Save,
  Scale,
  School as SchoolIcon,
  SlidersHorizontal,
  ToggleLeft,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { AccessGuard } from "@/components/access-guard";
import { api } from "@/lib/api";
import {
  ACADEMIC_LEVEL_META,
  ACADEMIC_LEVEL_ORDER,
  CAMPUS_STATUS_OPTIONS,
  FEATURE_META,
  FEATURE_ORDER,
  PLAN_CATALOG,
  planIncludesFeature,
  createCampusDraft,
  ZAMBIA_2023_GRADING_BANDS,
  type AcademicLevel,
  type Campus,
  type CampusStatus,
  type FeatureKey,
  type FeatureCategory,
  useTenant,
} from "@/lib/tenant";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings - SRMS" }] }),
  component: SettingsPage,
});

const ACCORDION_SX = {
  borderRadius: "12px !important",
  border: "1px solid",
  borderColor: "divider",
  "&:before": { display: "none" },
  overflow: "hidden",
};
const ACCORDION_SUMMARY_SX = { px: 2.5, py: 0.5, "& .MuiAccordionSummary-content": { my: 1.5, alignItems: "center", gap: 1.5 } };
const ACCORDION_DETAILS_SX = { px: 2.5, pb: 2.5, pt: 0, borderTop: "1px solid", borderColor: "divider" };

function SectionIcon({ icon: Icon }: { icon: typeof Building2 }) {
  return (
    <Box sx={{ display: "flex", height: 34, width: 34, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 2.5, bgcolor: "primary.main", color: "primary.contrastText", opacity: 0.9 }}>
      <Icon className="h-4 w-4" />
    </Box>
  );
}

const schoolTypes = [
  { code: "NURSERY", name: "Nursery / ECD", range: "Baby Class - Reception" },
  { code: "PRIMARY", name: "Primary Only", range: "Grade 1 - Grade 6 (Zambia 2025)" },
  { code: "SECONDARY", name: "Secondary Only", range: "Form 1-4 (O-Level) · Form 5-6 (A-Level)" },
  { code: "COMBINED", name: "Combined", range: "Grade 1-6 · Form 1-6" },
  { code: "FULL", name: "Full School", range: "Baby Class · Grade 1-6 · Form 1-6" },
] as const;

const managedFeatures = FEATURE_ORDER;
const FEATURE_CATEGORY_ORDER: FeatureCategory[] = [
  "Communication",
  "Finance",
  "Operations",
  "Enterprise",
];

type ManagedFeature = FeatureKey;
type FeatureState = Record<ManagedFeature, boolean>;

function currentFeatureState(features: Record<FeatureKey, boolean>): FeatureState {
  return managedFeatures.reduce((acc, feature) => {
    acc[feature] = features[feature];
    return acc;
  }, {} as FeatureState);
}

function SettingsPage() {
  const { user, isSystemAdmin } = useAuth();
  const canConfigureResults = user?.role === "school_admin" || user?.role === "super_admin";
  const { active: school, updateActive } = useTenant();
  const [selectedType, setSelectedType] = useState(school.type);
  const [levels, setLevels] = useState<AcademicLevel[]>(school.levels);
  const [campuses, setCampuses] = useState<Campus[]>(school.campuses);
  const [name, setName] = useState(school.name);
  const [motto, setMotto] = useState(school.motto);
  const [term, setTerm] = useState(String(school.currentTerm));
  const [year, setYear] = useState(String(school.currentYear));
  const [defaultCurrency, setDefaultCurrency] = useState(school.currency ?? "ZMW");
  const [resultPublicationMode, setResultPublicationMode] = useState(school.resultPublicationMode);
  const [gradingBands, setGradingBands] = useState(() =>
    school.gradingBands.map((band) => ({ ...band })),
  );
  const [passMark, setPassMark] = useState(String(school.passMark ?? 40));
  const [gradeWeights, setGradeWeights] = useState({
    caWeight: 30,
    midtermWeight: 30,
    examWeight: 40,
  });
  const [saving, setSaving] = useState(false);
  const [featureValues, setFeatureValues] = useState<FeatureState>(() =>
    currentFeatureState(school.features),
  );
  const [primaryColor, setPrimaryColor] = useState(school.primaryColor ?? "#1e40af");
  const [secondaryColor, setSecondaryColor] = useState(school.secondaryColor ?? "#134e4a");
  const [accentColor, setAccentColor] = useState(school.accentColor ?? "#7c3aed");
  const [logoUrl, setLogoUrl] = useState(school.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(school.faviconUrl ?? "");
  const [slug, setSlug] = useState(school.slug ?? "");
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  const readAsDataUrl = (file: File, setter: (value: string) => void) => {
    if (file.size > 2_000_000) {
      toast.error("File too large. Max 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setSelectedType(school.type);
    setLevels(school.levels);
    setCampuses(school.campuses);
    setName(school.name);
    setMotto(school.motto);
    setTerm(String(school.currentTerm));
    setYear(String(school.currentYear));
    setDefaultCurrency(school.currency ?? "ZMW");
    setResultPublicationMode(school.resultPublicationMode);
    setGradingBands(school.gradingBands.map((band) => ({ ...band })));
    setPassMark(String(school.passMark ?? 40));
    setFeatureValues(currentFeatureState(school.features));
    setPrimaryColor(school.primaryColor ?? "#1e40af");
    setSecondaryColor(school.secondaryColor ?? "#134e4a");
    setAccentColor(school.accentColor ?? "#7c3aed");
    setLogoUrl(school.logoUrl ?? "");
    setFaviconUrl(school.faviconUrl ?? "");
    setSlug(school.slug ?? "");
  }, [school]);

  useEffect(() => {
    if (!canConfigureResults || !school.id) return;
    let cancelled = false;
    void api.gradeWeights
      .get(school.id)
      .then((weights) => {
        if (!cancelled) {
          setGradeWeights({
            caWeight: Number(weights.caWeight ?? 30),
            midtermWeight: Number(weights.midtermWeight ?? 30),
            examWeight: Number(weights.examWeight ?? 40),
          });
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load the school's result weighting");
      });
    return () => {
      cancelled = true;
    };
  }, [canConfigureResults, school.id]);

  const saveChanges = async () => {
    if (!name.trim()) {
      toast.error("School name is required");
      return;
    }

    const nextTerm = Number(term);
    const nextYear = Number(year);

    if (!Number.isInteger(nextTerm) || nextTerm < 1 || nextTerm > 3) {
      toast.error("Current term must be between 1 and 3");
      return;
    }

    if (!Number.isInteger(nextYear) || nextYear < 2020) {
      toast.error("Enter a valid school year");
      return;
    }

    const orderedBands = [...gradingBands].sort((a, b) => a.min - b.min);
    let expectedMin = 0;
    for (const band of orderedBands) {
      if (
        band.min !== expectedMin ||
        band.max < band.min ||
        !band.grade.trim() ||
        !band.description.trim()
      ) {
        toast.error(
          "Grading bands must cover 0–100 without gaps and include a grade and description",
        );
        return;
      }
      expectedMin = band.max + 1;
    }
    if (expectedMin !== 101) {
      toast.error("Grading bands must cover 0–100 without gaps");
      return;
    }

    const passMarkValue = Number(passMark);
    if (!Number.isFinite(passMarkValue) || passMarkValue < 0 || passMarkValue > 100) {
      toast.error("Pass mark must be between 0 and 100");
      return;
    }

    const weightTotal =
      gradeWeights.caWeight + gradeWeights.midtermWeight + gradeWeights.examWeight;
    if (
      canConfigureResults &&
      (weightTotal !== 100 ||
        Object.values(gradeWeights).some(
          (weight) => !Number.isFinite(weight) || weight < 0 || weight > 100,
        ))
    ) {
      toast.error("CA, mid-term, and examination weights must be valid percentages totalling 100");
      return;
    }

    setSaving(true);
    try {
      await updateActive({
        name: name.trim(),
        motto: motto.trim(),
        type: selectedType,
        levels,
        campuses,
        currentTerm: nextTerm as 1 | 2 | 3,
        currentYear: nextYear,
        currency: featureValues.multiCurrency ? defaultCurrency : "ZMW",
        resultPublicationMode,
        gradingScale: "ECZ",
        gradingBands: orderedBands.sort((a, b) => b.min - a.min),
        passMark: passMarkValue,
        offlineMode: featureValues.offlineMode,
        primaryColor,
        secondaryColor,
        accentColor,
        logoUrl: logoUrl.trim() || undefined,
        faviconUrl: faviconUrl.trim() || undefined,
        slug: slug.trim()
          ? slug
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "")
          : undefined,
        features: {
          ...school.features,
          ...featureValues,
        },
      });
      if (canConfigureResults) await api.gradeWeights.update(school.id, gradeWeights);
      toast.success("Settings saved successfully");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (feature: ManagedFeature, enabled: boolean) => {
    setFeatureValues((current) => ({ ...current, [feature]: enabled }));
    if (feature === "multiCurrency" && !enabled) {
      setDefaultCurrency("ZMW");
    }
  };

  const toggleLevel = (level: AcademicLevel) => {
    setLevels((current) => {
      const nextLevels = current.includes(level)
        ? current.filter((item) => item !== level)
        : [...current, level];
      if (nextLevels.length === 0) return current;
      setCampuses((existingCampuses) =>
        existingCampuses.map((campus) => ({
          ...campus,
          levels:
            campus.levels.filter((item) => nextLevels.includes(item)).length > 0
              ? campus.levels.filter((item) => nextLevels.includes(item))
              : nextLevels,
        })),
      );
      return ACADEMIC_LEVEL_ORDER.filter((item) => nextLevels.includes(item));
    });
  };

  const addCampus = () => {
    setCampuses((current) => {
      return [
        ...current,
        createCampusDraft(
          {
            name,
            shortCode: school.shortCode,
            district: school.district,
            city: school.city,
            physicalAddress: school.physicalAddress,
            phone: school.phone,
          },
          levels,
          current.length,
        ),
      ];
    });
  };

  const updateCampus = (campusId: string, patch: Partial<Campus>) => {
    setCampuses((current) =>
      current.map((campus) => (campus.id === campusId ? { ...campus, ...patch } : campus)),
    );
  };

  const removeCampus = (campusId: string) => {
    setCampuses((current) =>
      current.length === 1 ? current : current.filter((campus) => campus.id !== campusId),
    );
  };

  const toggleCampusLevel = (campusId: string, level: AcademicLevel) => {
    setCampuses((current) =>
      current.map((campus) => {
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
    );
  };

  return (
    <AccessGuard module="settings">
      <div className="space-y-6">
        <PageHeader
          title="School Settings"
          description="Manage school profile, plan-governed features, and operational defaults for the active tenant."
          actions={
            <Button variant="contained" onClick={() => void saveChanges()} disabled={saving} startIcon={<Save className="h-4 w-4" />}>
              Save changes
            </Button>
          }
        />

        {isSystemAdmin && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Platform admin context</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.name} is editing school settings on behalf of{" "}
              <span className="font-medium text-foreground">{school.name}</span>.
            </p>
          </div>
        )}

        <Accordion disableGutters sx={ACCORDION_SX}>
          <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />} sx={ACCORDION_SUMMARY_SX}>
            <SectionIcon icon={SchoolIcon} />
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>School type</Typography>
              <Typography variant="caption" color="text.secondary">
                {schoolTypes.find((t) => t.code === selectedType)?.name ?? "Not set"}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={ACCORDION_DETAILS_SX}>
          <p className="mb-3 pt-3 text-xs text-muted-foreground">
            Changing the school structure after go-live may require data migration and timetable
            adjustments.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schoolTypes.map((typeOption) => {
              const isActive = typeOption.code === selectedType;
              return (
                <button
                  key={typeOption.code}
                  onClick={() => setSelectedType(typeOption.code)}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                    isActive
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      isActive ? "bg-accent text-accent-foreground" : "border border-border"
                    }`}
                  >
                    {isActive && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{typeOption.name}</p>
                    <p className="text-xs text-muted-foreground">{typeOption.range}</p>
                    {isActive && (
                      <Chip size="small" label="Selected" sx={{ ...badgeSx("secondary"), mt: 1 }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          </AccordionDetails>
        </Accordion>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <Accordion disableGutters sx={ACCORDION_SX}>
            <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />} sx={ACCORDION_SUMMARY_SX}>
              <SectionIcon icon={LayoutGrid} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Academic levels</Typography>
                <Typography variant="caption" color="text.secondary">
                  Teaching bands served across all campuses.
                </Typography>
              </Box>
              <Chip size="small" label={`${levels.length} active`} sx={{ ...badgeSx("outline"), mr: 1 }} />
            </AccordionSummary>
            <AccordionDetails sx={ACCORDION_DETAILS_SX}>
            <div className="grid gap-3 pt-3 sm:grid-cols-2">
              {ACADEMIC_LEVEL_ORDER.map((level) => {
                const active = levels.includes(level);
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
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters sx={ACCORDION_SX}>
            <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />} sx={ACCORDION_SUMMARY_SX}>
              <SectionIcon icon={Building2} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Campus directory</Typography>
                <Typography variant="caption" color="text.secondary">
                  Location and level coverage per campus.
                </Typography>
              </Box>
              <Chip size="small" label={`${campuses.length} campus${campuses.length === 1 ? "" : "es"}`} />
            </AccordionSummary>
            <AccordionDetails sx={ACCORDION_DETAILS_SX}>
            <div className="flex justify-end pt-3">
              <Button type="button" variant="outlined" size="small" onClick={addCampus}>
                Add campus
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              {campuses.map((campus, index) => (
                <div key={campus.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Campus {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        Operational location and level coverage.
                      </p>
                    </div>
                    {campuses.length > 1 && (
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
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Campus code"
                      value={campus.code}
                      onChange={(e) =>
                        updateCampus(campus.id, { code: e.target.value.toUpperCase() })
                      }
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="District"
                      value={campus.district}
                      onChange={(e) => updateCampus(campus.id, { district: e.target.value })}
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
                    <p className="text-sm font-medium">Levels on this campus</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {levels.map((level) => {
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
            </AccordionDetails>
          </Accordion>
        </div>

        {canConfigureResults && (
          <Accordion disableGutters sx={{ ...ACCORDION_SX, borderRadius: "20px !important" }}>
            <AccordionSummary
              expandIcon={<ChevronDown className="h-4 w-4" />}
              sx={{
                px: { xs: 2.5, sm: 3 },
                background: "linear-gradient(to right, color-mix(in oklab, var(--primary) 8%, transparent), transparent)",
                "& .MuiAccordionSummary-content": { my: 1.75, alignItems: "center", gap: 1.5, flexWrap: "wrap" },
              }}
            >
              <Box sx={{ display: "flex", height: 40, width: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: "primary.main", color: "primary.contrastText", boxShadow: 2 }}>
                <SlidersHorizontal className="h-5 w-5" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Results policy &amp; publication</Typography>
                  <Chip
                    size="small"
                    icon={<Lock size={12} />}
                    label="Admin controlled"
                    sx={{ ...badgeSx("outline"), bgcolor: "background.paper" }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Set one school-wide policy for marks, verification, and publication.
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: { xs: 2.5, sm: 3 }, pt: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
              <div className="grid gap-5 lg:grid-cols-[1.4fr,0.6fr]">
                <div>
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Publication format</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose how families receive results for each term.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          value: "SEPARATE",
                          title: "Separate releases",
                          copy: "Publish mid-term first, then end-of-term when it is ready.",
                          badge: "Recommended for this school",
                        },
                        {
                          value: "COMBINED",
                          title: "Combined term report",
                          copy: "Hold all term results and publish them as one complete report.",
                          badge: "Single release",
                        },
                      ] as const
                    ).map((option) => {
                      const selected = resultPublicationMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setResultPublicationMode(option.value)}
                          className={`interactive-card rounded-2xl border p-4 text-left ${selected ? "border-primary bg-primary/[0.07] ring-1 ring-primary/20" : "border-border bg-background/60"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                            >
                              {option.value === "SEPARATE" ? (
                                <GitBranch className="h-4 w-4" />
                              ) : (
                                <BookOpenCheck className="h-4 w-4" />
                              )}
                            </div>
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "border border-border"}`}
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                          <p className="mt-3 text-sm font-semibold">{option.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {option.copy}
                          </p>
                          <Chip size="small" label={option.badge} sx={{ ...badgeSx("outline"), mt: 1.5, fontSize: 10 }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Pass mark</p>
                  </div>
                  <div className="mt-4 flex items-end gap-2">
                    <TextField
                      type="number"
                      slotProps={{ htmlInput: { min: 0, max: 100 } }}
                      value={passMark}
                      onChange={(event) => setPassMark(event.target.value)}
                      size="small"
                      sx={{ "& .MuiInputBase-input": { fontSize: "1.5rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" } }}
                    />
                    <span className="pb-3 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="mt-3 flex gap-2 text-xs leading-5 text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Used for pass-rate analytics. Letter grades still follow the achievement bands
                    below.
                  </p>
                </div>
              </div>
              <div className="mt-6 border-t border-border pt-6">
                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Final grade weighting</p>
                      <p className="text-xs text-muted-foreground">
                        Continuous assessment, mid-term, and examination must total 100%.
                      </p>
                    </div>
                  </div>
                  <Chip
                    size="small"
                    label={`Total ${gradeWeights.caWeight + gradeWeights.midtermWeight + gradeWeights.examWeight}%`}
                    sx={badgeSx(
                      gradeWeights.caWeight + gradeWeights.midtermWeight + gradeWeights.examWeight === 100
                        ? "secondary"
                        : "destructive"
                    )}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["caWeight", "Continuous assessment"],
                      ["midtermWeight", "Mid-term"],
                      ["examWeight", "End-of-term examination"],
                    ] as const
                  ).map(([key, label]) => (
                    <TextField
                      key={key}
                      label={`${label} (%)`}
                      type="number"
                      slotProps={{
                        htmlInput: { min: 0, max: 100, className: "text-base font-semibold tabular-nums" },
                        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                      }}
                      value={gradeWeights[key]}
                      onChange={(event) =>
                        setGradeWeights((current) => ({
                          ...current,
                          [key]: Number(event.target.value),
                        }))
                      }
                      fullWidth
                      size="small"
                    />
                  ))}
                </div>
                <div
                  className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted"
                  aria-label="Grade weighting distribution"
                >
                  <div
                    className="bg-blue-500 transition-all"
                    style={{ width: `${Math.max(gradeWeights.caWeight, 0)}%` }}
                    title={`Continuous assessment ${gradeWeights.caWeight}%`}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{ width: `${Math.max(gradeWeights.midtermWeight, 0)}%` }}
                    title={`Mid-term ${gradeWeights.midtermWeight}%`}
                  />
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(gradeWeights.examWeight, 0)}%` }}
                    title={`End-of-term examination ${gradeWeights.examWeight}%`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Continuous assessment
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Mid-term
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    End-of-term
                  </span>
                </div>
              </div>
              <div className="mt-6 border-t border-border pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <BookOpenCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Achievement grading scale</p>
                      <p className="text-xs text-muted-foreground">
                        Applied automatically to every result; teachers never choose letter grades
                        manually.
                      </p>
                    </div>
                  </div>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip size="small" label={`${gradingBands.length} bands`} sx={badgeSx("secondary")} />
                    <Button
                      type="button"
                      variant="outlined"
                      size="small"
                      onClick={() => setGradingBands(ZAMBIA_2023_GRADING_BANDS.map((band) => ({ ...band })))}
                      startIcon={<RotateCcw className="h-3.5 w-3.5" />}
                    >
                      Restore Zambia 2023 scale
                    </Button>
                  </Box>
                </div>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-background/60">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Minimum</th>
                        <th className="px-3 py-2 text-left">Maximum</th>
                        <th className="px-3 py-2 text-left">Grade</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradingBands.map((band, index) => (
                        <tr
                          key={`${band.grade}-${index}`}
                          className="border-t border-border transition-colors hover:bg-muted/30"
                        >
                          <td className="p-2">
                            <TextField
                              className="min-w-20"
                              type="number"
                              slotProps={{ htmlInput: { min: 0, max: 100, className: "tabular-nums" } }}
                              value={band.min}
                              onChange={(event) =>
                                setGradingBands((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, min: Number(event.target.value) }
                                      : item,
                                  ),
                                )
                              }
                              size="small"
                            />
                          </td>
                          <td className="p-2">
                            <TextField
                              className="min-w-20"
                              type="number"
                              slotProps={{ htmlInput: { min: 0, max: 100, className: "tabular-nums" } }}
                              value={band.max}
                              onChange={(event) =>
                                setGradingBands((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, max: Number(event.target.value) }
                                      : item,
                                  ),
                                )
                              }
                              size="small"
                            />
                          </td>
                          <td className="p-2">
                            <TextField
                              className="min-w-20"
                              slotProps={{ htmlInput: { className: "font-semibold" } }}
                              value={band.grade}
                              onChange={(event) =>
                                setGradingBands((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, grade: event.target.value.toUpperCase() }
                                      : item,
                                  ),
                                )
                              }
                              size="small"
                            />
                          </td>
                          <td className="p-2">
                            <TextField
                              className="min-w-40"
                              value={band.description}
                              onChange={(event) =>
                                setGradingBands((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, description: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              size="small"
                              fullWidth
                            />
                          </td>
                          <td className="p-2">
                            <TextField
                              className="min-w-20"
                              type="number"
                              slotProps={{ htmlInput: { min: 0, className: "tabular-nums" } }}
                              value={band.points}
                              onChange={(event) =>
                                setGradingBands((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, points: Number(event.target.value) }
                                      : item,
                                  ),
                                )
                              }
                              size="small"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </AccordionDetails>
          </Accordion>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <Accordion disableGutters defaultExpanded sx={ACCORDION_SX}>
            <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />} sx={ACCORDION_SUMMARY_SX}>
              <SectionIcon icon={SlidersHorizontal} />
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>School profile</Typography>
                <Typography variant="caption" color="text.secondary">{name || "Untitled school"}</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={ACCORDION_DETAILS_SX}>
            <div className="space-y-3 pt-3">
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Motto"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                fullWidth
                size="small"
              />
              <div>
                <p className="mb-1 text-sm font-medium">URL slug</p>
                <div className="flex items-center gap-0">
                  <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground select-none">
                    srms.com/s/
                  </span>
                  <TextField
                    value={slug}
                    onChange={(e) =>
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                    }
                    placeholder="greenfields-secondary"
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { className: "font-mono text-sm" } }}
                    sx={{ "& .MuiOutlinedInput-root": { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Unique link to this school's branded login page — auto-generated from the school
                  code if left blank.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Current term"
                  type="number"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  slotProps={{ htmlInput: { min: 1, max: 3 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  slotProps={{ htmlInput: { min: 2020 } }}
                  fullWidth
                  size="small"
                />
              </div>
            </div>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters sx={ACCORDION_SX}>
            <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />} sx={ACCORDION_SUMMARY_SX}>
              <SectionIcon icon={Palette} />
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Brand &amp; visual identity</Typography>
                <Typography variant="caption" color="text.secondary">Colours, logo, favicon</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={ACCORDION_DETAILS_SX}>
            <p className="pt-3 text-xs text-muted-foreground">
              Colour changes apply across the sidebar and system immediately after saving.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium">Primary colour</p>
                <div className="flex items-center gap-2">
                  <input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                  />
                  <TextField
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                    slotProps={{ htmlInput: { maxLength: 7, className: "font-mono text-xs" } }}
                    size="small"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Secondary colour</p>
                <div className="flex items-center gap-2">
                  <input
                    id="secondaryColor"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                  />
                  <TextField
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1"
                    slotProps={{ htmlInput: { maxLength: 7, className: "font-mono text-xs" } }}
                    size="small"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Accent colour</p>
                <div className="flex items-center gap-2">
                  <input
                    id="accentColor"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                  />
                  <TextField
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1"
                    slotProps={{ htmlInput: { maxLength: 7, className: "font-mono text-xs" } }}
                    size="small"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">School logo</p>
                <p className="text-xs text-muted-foreground">PNG or SVG, square, max 2MB.</p>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
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
                        if (f) readAsDataUrl(f, setLogoUrl);
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
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="text"
                        color="inherit"
                        size="small"
                        onClick={() => setLogoUrl("")}
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
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {faviconUrl ? (
                      <img
                        src={faviconUrl}
                        alt="Favicon preview"
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
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
                        if (f) readAsDataUrl(f, setFaviconUrl);
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
                    {faviconUrl && (
                      <Button
                        type="button"
                        variant="text"
                        color="inherit"
                        size="small"
                        onClick={() => setFaviconUrl("")}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters sx={ACCORDION_SX}>
            <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />} sx={ACCORDION_SUMMARY_SX}>
              <SectionIcon icon={ToggleLeft} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Feature controls</Typography>
                <Typography variant="caption" color="text.secondary">
                  Modules on the {PLAN_CATALOG[school.subscription.planId].name} plan
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={ACCORDION_DETAILS_SX}>
            <div className="space-y-6 pt-3">
              {FEATURE_CATEGORY_ORDER.map((category) => {
                const keys = managedFeatures.filter((k) => FEATURE_META[k].category === category);
                if (keys.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </p>
                    <div className="space-y-2">
                      {keys.map((feature) => {
                        const meta = FEATURE_META[feature];
                        const unlocked = planIncludesFeature(school.subscription.planId, feature);
                        return (
                          <div
                            key={feature}
                            className={`flex items-center justify-between gap-3 rounded-lg border border-border p-3 ${!unlocked ? "opacity-60" : ""}`}
                          >
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-sm font-medium">
                                {meta.label}
                                {!unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {unlocked ? (
                                  meta.description
                                ) : (
                                  <>
                                    Requires {PLAN_CATALOG[meta.availableFrom].name} plan —{" "}
                                    <Link to="/billing" className="underline">
                                      upgrade
                                    </Link>
                                  </>
                                )}
                              </p>
                            </div>
                            <Switch
                              checked={featureValues[feature]}
                              disabled={!unlocked}
                              onChange={(e) => toggleFeature(feature, e.target.checked)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </AccordionDetails>
          </Accordion>
        </div>
      </div>
    </AccessGuard>
  );
}
