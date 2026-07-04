import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Lock, Palette, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { AccessGuard } from "@/components/access-guard";
import {
  ACADEMIC_LEVEL_META,
  ACADEMIC_LEVEL_ORDER,
  CAMPUS_STATUS_OPTIONS,
  FEATURE_META,
  FEATURE_ORDER,
  PLAN_CATALOG,
  planIncludesFeature,
  createCampusDraft,
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

const schoolTypes = [
  { code: "NURSERY", name: "Nursery / ECD", range: "Baby Class - Reception" },
  { code: "PRIMARY", name: "Primary Only", range: "Grade 1 - Grade 6 (Zambia 2025)" },
  { code: "SECONDARY", name: "Secondary Only", range: "Form 1-4 (O-Level) · Form 5-6 (A-Level)" },
  { code: "COMBINED", name: "Combined", range: "Grade 1-6 · Form 1-6" },
  { code: "FULL", name: "Full School", range: "Baby Class · Grade 1-6 · Form 1-6" },
] as const;

const managedFeatures = FEATURE_ORDER;
const FEATURE_CATEGORY_ORDER: FeatureCategory[] = ["Communication", "Finance", "Operations", "Enterprise"];

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
  const { active: school, updateActive } = useTenant();
  const [selectedType, setSelectedType] = useState(school.type);
  const [levels, setLevels] = useState<AcademicLevel[]>(school.levels);
  const [campuses, setCampuses] = useState<Campus[]>(school.campuses);
  const [name, setName] = useState(school.name);
  const [motto, setMotto] = useState(school.motto);
  const [term, setTerm] = useState(String(school.currentTerm));
  const [year, setYear] = useState(String(school.currentYear));
  const [defaultCurrency, setDefaultCurrency] = useState(school.currency ?? "ZMW");
  const [featureValues, setFeatureValues] = useState<FeatureState>(() => currentFeatureState(school.features));
  const [primaryColor, setPrimaryColor] = useState(school.primaryColor ?? "#1e40af");
  const [secondaryColor, setSecondaryColor] = useState(school.secondaryColor ?? "#134e4a");
  const [accentColor, setAccentColor] = useState(school.accentColor ?? "#7c3aed");
  const [logoUrl, setLogoUrl] = useState(school.logoUrl ?? "");
  const [slug, setSlug] = useState(school.slug ?? "");

  useEffect(() => {
    setSelectedType(school.type);
    setLevels(school.levels);
    setCampuses(school.campuses);
    setName(school.name);
    setMotto(school.motto);
    setTerm(String(school.currentTerm));
    setYear(String(school.currentYear));
    setDefaultCurrency(school.currency ?? "ZMW");
    setFeatureValues(currentFeatureState(school.features));
    setPrimaryColor(school.primaryColor ?? "#1e40af");
    setSecondaryColor(school.secondaryColor ?? "#134e4a");
    setAccentColor(school.accentColor ?? "#7c3aed");
    setLogoUrl(school.logoUrl ?? "");
    setSlug(school.slug ?? "");
  }, [school]);

  const saveChanges = () => {
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

    updateActive({
      name: name.trim(),
      motto: motto.trim(),
      type: selectedType,
      levels,
      campuses,
      currentTerm: nextTerm as 1 | 2 | 3,
      currentYear: nextYear,
      currency: featureValues.multiCurrency ? defaultCurrency : "ZMW",
      offlineMode: featureValues.offlineMode,
      primaryColor,
      secondaryColor,
      accentColor,
      logoUrl: logoUrl.trim() || undefined,
      slug: slug.trim() ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") : undefined,
      features: {
        ...school.features,
        ...featureValues,
      },
    });
    toast.success("Settings saved successfully");
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
      setCampuses((existingCampuses) => existingCampuses.map((campus) => ({
        ...campus,
        levels: campus.levels.filter((item) => nextLevels.includes(item)).length > 0
          ? campus.levels.filter((item) => nextLevels.includes(item))
          : nextLevels,
      })));
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
    setCampuses((current) => current.map((campus) => (
      campus.id === campusId ? { ...campus, ...patch } : campus
    )));
  };

  const removeCampus = (campusId: string) => {
    setCampuses((current) => (current.length === 1 ? current : current.filter((campus) => campus.id !== campusId)));
  };

  const toggleCampusLevel = (campusId: string, level: AcademicLevel) => {
    setCampuses((current) => current.map((campus) => {
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
    }));
  };

  return (
    <AccessGuard module="settings">
      <div className="space-y-6">
      <PageHeader
        title="School Settings"
        description="Manage school profile, plan-governed features, and operational defaults for the active tenant."
        actions={
          <Button onClick={saveChanges}>
            <Save className="mr-1 h-4 w-4" />Save changes
          </Button>
        }
      />

      {isSystemAdmin && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Platform admin context</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.name} is editing school settings on behalf of <span className="font-medium text-foreground">{school.name}</span>.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">School type</h2>
        <p className="text-xs text-muted-foreground">
          Changing the school structure after go-live may require data migration and timetable adjustments.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schoolTypes.map((typeOption) => {
            const isActive = typeOption.code === selectedType;
            return (
              <button
                key={typeOption.code}
                onClick={() => setSelectedType(typeOption.code)}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
                  isActive ? "border-accent bg-accent/10" : "border-border hover:border-muted-foreground/40"
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
                    <Badge className="mt-2" variant="secondary">
                      Selected
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Academic levels</h2>
              <p className="text-xs text-muted-foreground">
                Define the teaching bands this school group serves across all campuses.
              </p>
            </div>
            <Badge variant="outline">{levels.length} active</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ACADEMIC_LEVEL_ORDER.map((level) => {
              const active = levels.includes(level);
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

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Campus directory</h2>
              <p className="text-xs text-muted-foreground">
                Multi-campus schools can operate under one tenant while keeping levels and location ownership clear.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCampus}>
              Add campus
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {campuses.map((campus, index) => (
              <div key={campus.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Campus {index + 1}</p>
                    <p className="text-xs text-muted-foreground">Operational location and level coverage.</p>
                  </div>
                  {campuses.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCampus(campus.id)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Campus name</Label>
                    <Input className="mt-1" value={campus.name} onChange={(e) => updateCampus(campus.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Campus code</Label>
                    <Input className="mt-1" value={campus.code} onChange={(e) => updateCampus(campus.id, { code: e.target.value.toUpperCase() })} />
                  </div>
                  <div>
                    <Label>District</Label>
                    <Input className="mt-1" value={campus.district} onChange={(e) => updateCampus(campus.id, { district: e.target.value })} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={campus.status} onValueChange={(value) => updateCampus(campus.id, { status: value as CampusStatus })}>
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
                  <Label>Levels on this campus</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {levels.map((level) => {
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">School profile</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="motto">Motto</Label>
              <Input id="motto" value={motto} onChange={(e) => setMotto(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="slug">URL slug</Label>
              <div className="mt-1 flex items-center gap-0">
                <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground select-none">
                  srms.com/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="greenfields-secondary"
                  className="mt-0 rounded-l-none font-mono text-sm"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                School's unique subdomain — auto-generated from the school code if left blank.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="term">Current term</Label>
                <Input id="term" type="number" value={term} onChange={(e) => setTerm(e.target.value)} min={1} max={3} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} min={2020} className="mt-1" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Brand &amp; visual identity</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Colour changes apply across the sidebar and system immediately after saving.</p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="primaryColor">Primary colour</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
              </div>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Secondary colour</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="secondaryColor"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor">Accent colour</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="accentColor"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 font-mono text-xs" maxLength={7} />
              </div>
            </div>
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="mt-1"
                placeholder="https://yourdomain.com/logo.png"
              />
              {logoUrl && (
                <div className="mt-2 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  <img src={logoUrl} alt="Logo preview" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Feature controls</h2>
            <p className="text-xs text-muted-foreground">
              Modules on the {PLAN_CATALOG[school.subscription.planId].name} plan
            </p>
          </div>
          <div className="mt-4 space-y-6">
            {FEATURE_CATEGORY_ORDER.map((category) => {
              const keys = managedFeatures.filter((k) => FEATURE_META[k].category === category);
              if (keys.length === 0) return null;
              return (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                  <div className="space-y-2">
                    {keys.map((feature) => {
                      const meta = FEATURE_META[feature];
                      const unlocked = planIncludesFeature(school.subscription.planId, feature);
                      return (
                        <div key={feature} className={`flex items-center justify-between gap-3 rounded-lg border border-border p-3 ${!unlocked ? "opacity-60" : ""}`}>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium">
                              {meta.label}
                              {!unlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {unlocked ? meta.description : (
                                <>Requires {PLAN_CATALOG[meta.availableFrom].name} plan — <Link to="/billing" className="underline">upgrade</Link></>
                              )}
                            </p>
                          </div>
                          <Switch
                            checked={featureValues[feature]}
                            disabled={!unlocked}
                            onCheckedChange={(enabled) => toggleFeature(feature, enabled)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </AccessGuard>
  );
}
