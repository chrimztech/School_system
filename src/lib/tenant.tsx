import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, type BackendSchool, type BackendSchoolDto } from "@/lib/api";

export type SchoolType = "NURSERY" | "PRIMARY" | "SECONDARY" | "COMBINED" | "FULL";
export type AcademicLevel = "ECE" | "PRIMARY" | "JUNIOR_SECONDARY" | "SENIOR_SECONDARY";
export type CampusStatus = "active" | "setup" | "planned";
export type PlanId = "core" | "growth" | "advanced" | "enterprise";
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended";
export type SupportLevel = "Standard" | "Priority" | "Dedicated";
export type FeatureCategory = "Communication" | "Finance" | "Operations" | "Enterprise";
export type FeatureKey =
  | "sms"
  | "ussd"
  | "momo"
  | "ecz"
  | "library"
  | "transport"
  | "inventory"
  | "hostel"
  | "hr"
  | "bursaries"
  | "studentWelfare"
  | "staffDevelopment"
  | "facilities"
  | "procurement"
  | "vendorManagement"
  | "security"
  | "compliance"
  | "reporting"
  | "analytics"
  | "districtManagement"
  | "canteen"
  | "strategicPlan"
  | "lostFound"
  | "multiCurrency"
  | "customBranding"
  | "offlineMode";

export type FeatureMeta = {
  label: string;
  description: string;
  availableFrom: PlanId;
  category: FeatureCategory;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  badge: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  campusLimit: number;
  learnerLimit: number;
  smsQuota: number;
  supportLevel: SupportLevel;
};

export type Campus = {
  id: string;
  name: string;
  code: string;
  district: string;
  city?: string;
  address?: string;
  phone?: string;
  status: CampusStatus;
  levels: AcademicLevel[];
  studentCount: number;
  teacherCount: number;
};

export type TenantFeatureFlags = Record<FeatureKey, boolean>;

export type TenantSubscription = {
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  campusLimit: number;
  nextInvoiceDate: string;
  renewalDate: string;
  learnerLimit: number;
  smsQuota: number;
  smsUsed: number;
  supportLevel: SupportLevel;
  billingContact: string;
  notes?: string;
};

export type Tenant = {
  id: string;
  name: string;
  shortCode: string;
  type: SchoolType;
  levels: AcademicLevel[];
  campuses: Campus[];
  motto: string;
  district: string;
  province: string;
  currentTerm: 1 | 2 | 3;
  currentYear: number;
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  primaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  registrationNo?: string;
  tpinNo?: string;
  moeCode?: string;
  examCentreNo?: string;
  yearFounded?: number;
  ownership?: "Government" | "Private" | "Grant-Aided" | "Community" | "Faith-Based";
  category?: "Day" | "Boarding" | "Day & Boarding";
  gender?: "Mixed" | "Boys" | "Girls";
  curriculum?: "ECZ" | "Cambridge" | "IB" | "Hybrid";
  languageOfInstruction?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  website?: string;
  physicalAddress?: string;
  poBox?: string;
  city?: string;
  postalCode?: string;
  gpsCoordinates?: string;
  headTeacher?: string;
  headTeacherEmail?: string;
  deputyHead?: string;
  boardChair?: string;
  termStart?: string;
  termEnd?: string;
  weekStart?: "Monday" | "Sunday";
  gradingScale?: "ECZ" | "Percentage" | "GPA" | "Letter";
  passMark?: number;
  currency?: "ZMW" | "USD";
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  reportFooter?: string;
  offlineMode?: boolean;
  slug?: string;
  subscription: TenantSubscription;
  features: TenantFeatureFlags;
};

type TenantPatch = Partial<Omit<Tenant, "subscription" | "features">> & {
  subscription?: Partial<TenantSubscription>;
  features?: Partial<TenantFeatureFlags>;
};

const PLAN_ORDER: PlanId[] = ["core", "growth", "advanced", "enterprise"];
export const ACADEMIC_LEVEL_ORDER: AcademicLevel[] = ["ECE", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
export const CAMPUS_STATUS_OPTIONS: CampusStatus[] = ["active", "setup", "planned"];

export const ACADEMIC_LEVEL_META: Record<AcademicLevel, { label: string; grades: string }> = {
  ECE: { label: "ECE", grades: "Baby Class - Reception" },
  PRIMARY: { label: "Primary", grades: "Grade 1 - Grade 6" },
  JUNIOR_SECONDARY: { label: "Junior Secondary", grades: "Form 1 - Form 2 (O-Level)" },
  SENIOR_SECONDARY: { label: "Senior Secondary", grades: "Form 3 - Form 6 (O & A-Level)" },
};

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  sms: { label: "SMS alerts", description: "Parent alerts, reminders, and bulk messaging.", availableFrom: "core", category: "Communication" },
  ussd: { label: "USSD fallback", description: "Low-data parent access for non-smartphone households.", availableFrom: "growth", category: "Communication" },
  momo: { label: "Mobile money", description: "MTN MoMo, Airtel Money, and Zamtel collections.", availableFrom: "core", category: "Finance" },
  ecz: { label: "ECZ integration", description: "Candidate registration and exam sync workflows.", availableFrom: "growth", category: "Operations" },
  library: { label: "Library", description: "Catalogue, circulation, and return tracking.", availableFrom: "growth", category: "Operations" },
  transport: { label: "Transport", description: "Route, rider, and fare management.", availableFrom: "growth", category: "Operations" },
  inventory: { label: "Inventory", description: "Stores, stock movements, and reorder control.", availableFrom: "growth", category: "Operations" },
  hostel: { label: "Hostel", description: "Boarding, rooming, and leave workflows.", availableFrom: "advanced", category: "Operations" },
  hr: { label: "Human resources", description: "Staff records, leave, recruitment, and appraisals.", availableFrom: "advanced", category: "Operations" },
  bursaries: { label: "Bursaries", description: "Scholarships, renewals, and aid reviews.", availableFrom: "growth", category: "Finance" },
  studentWelfare: { label: "Student welfare", description: "Pastoral cases, interventions, and support tracking.", availableFrom: "advanced", category: "Operations" },
  staffDevelopment: { label: "Staff development", description: "CPD, coaching, and performance development plans.", availableFrom: "advanced", category: "Operations" },
  facilities: { label: "Facilities", description: "Work orders, preventive maintenance, and site readiness.", availableFrom: "advanced", category: "Operations" },
  procurement: { label: "Procurement", description: "Requisitions, approvals, and supplier spend control.", availableFrom: "advanced", category: "Finance" },
  vendorManagement: { label: "Vendor management", description: "Supplier scorecards, contracts, and renewals.", availableFrom: "advanced", category: "Finance" },
  security: { label: "Security", description: "Access oversight, incidents, and operational safeguards.", availableFrom: "advanced", category: "Enterprise" },
  compliance: { label: "Compliance", description: "Audits, policy tracking, and regulatory readiness.", availableFrom: "advanced", category: "Enterprise" },
  reporting: { label: "Executive reporting", description: "Board, MoE, and management reporting packs.", availableFrom: "advanced", category: "Enterprise" },
  analytics: { label: "Enterprise analytics", description: "Cross-functional KPIs and budget intelligence.", availableFrom: "advanced", category: "Enterprise" },
  districtManagement: { label: "District management", description: "Multi-school oversight, benchmarking, and roll-ups.", availableFrom: "enterprise", category: "Enterprise" },
  canteen: { label: "Canteen", description: "Sales, balances, and stock for tuck shop operations.", availableFrom: "growth", category: "Operations" },
  strategicPlan: { label: "Strategic plan", description: "Goals, action items, and progress governance.", availableFrom: "advanced", category: "Enterprise" },
  lostFound: { label: "Lost & found", description: "Item registry, claims, and disposal workflow.", availableFrom: "growth", category: "Operations" },
  multiCurrency: { label: "Multi-currency", description: "Accept USD alongside ZMW in billing workflows.", availableFrom: "growth", category: "Finance" },
  customBranding: { label: "Custom branding", description: "Brand packs, white-labelling, and bespoke assets.", availableFrom: "enterprise", category: "Enterprise" },
  offlineMode: { label: "Offline mode", description: "Capture attendance and operations with weak connectivity.", availableFrom: "core", category: "Operations" },
};

export const FEATURE_ORDER = Object.keys(FEATURE_META) as FeatureKey[];

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  core: {
    id: "core",
    name: "Core",
    badge: "Best for one campus",
    description: "Academic operations, billing, and communications for a single school launching digitally.",
    monthlyPrice: 1900,
    annualPrice: 19000,
    campusLimit: 1,
    learnerLimit: 500,
    smsQuota: 2500,
    supportLevel: "Standard",
  },
  growth: {
    id: "growth",
    name: "Growth",
    badge: "Most popular",
    description: "Adds parent reach, learner services, and campus operations for growing schools.",
    monthlyPrice: 4200,
    annualPrice: 42000,
    campusLimit: 2,
    learnerLimit: 1000,
    smsQuota: 10000,
    supportLevel: "Priority",
  },
  advanced: {
    id: "advanced",
    name: "Advanced",
    badge: "Operations suite",
    description: "Unlocks advanced campus, HR, compliance, and planning workflows for mature institutions.",
    monthlyPrice: 8200,
    annualPrice: 82000,
    campusLimit: 5,
    learnerLimit: 1500,
    smsQuota: 20000,
    supportLevel: "Priority",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    badge: "Multi-school",
    description: "Portfolio-wide governance, district oversight, and white-labelled service delivery.",
    monthlyPrice: 14500,
    annualPrice: 145000,
    campusLimit: 20,
    learnerLimit: 5000,
    smsQuota: 50000,
    supportLevel: "Dedicated",
  },
};

export const MODULE_FEATURE_MAP: Partial<Record<string, FeatureKey>> = {
  library: "library",
  transport: "transport",
  inventory: "inventory",
  hostel: "hostel",
  hr: "hr",
  bursaries: "bursaries",
  "student-welfare": "studentWelfare",
  "staff-development": "staffDevelopment",
  facilities: "facilities",
  procurement: "procurement",
  "vendor-management": "vendorManagement",
  security: "security",
  compliance: "compliance",
  reporting: "reporting",
  "enterprise-analytics": "analytics",
  "district-management": "districtManagement",
  canteen: "canteen",
  "strategic-plan": "strategicPlan",
  "lost-found": "lostFound",
  "risk-register": "compliance",
  "incident-management": "security",
  "policy-library": "compliance",
};

function planIndex(planId: PlanId) {
  return PLAN_ORDER.indexOf(planId);
}

export function planIncludesFeature(planId: PlanId, feature: FeatureKey) {
  return planIndex(planId) >= planIndex(FEATURE_META[feature].availableFrom);
}

export function featuresForPlan(planId: PlanId) {
  return FEATURE_ORDER.filter((feature) => planIncludesFeature(planId, feature));
}

export function defaultLevelsForType(type: SchoolType): AcademicLevel[] {
  switch (type) {
    case "NURSERY":
      return ["ECE"];
    case "PRIMARY":
      return ["PRIMARY"];
    case "SECONDARY":
      return ["JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
    case "COMBINED":
      return ["PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
    case "FULL":
      return ["ECE", "PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"];
  }
}

function uniqueLevels(levels: AcademicLevel[]) {
  return ACADEMIC_LEVEL_ORDER.filter((level) => levels.includes(level));
}

export function createCampusDraft(
  template: Pick<Tenant, "name" | "shortCode" | "district" | "city" | "physicalAddress" | "phone">,
  levels: AcademicLevel[],
  index = 0,
): Campus {
  const suffix = index === 0 ? "Main Campus" : `Campus ${index + 1}`;
  return {
    id: `campus-${index + 1}`,
    name: template.name ? `${template.name} ${suffix}` : suffix,
    code: template.shortCode ? `${template.shortCode}${index + 1}` : `C${index + 1}`,
    district: template.district,
    city: template.city,
    address: template.physicalAddress,
    phone: template.phone,
    status: index === 0 ? "active" : "setup",
    levels: uniqueLevels(levels),
    studentCount: 0,
    teacherCount: 0,
  };
}

function normaliseTenantStructure(tenant: Tenant): Tenant {
  const desiredLevels = uniqueLevels(
    tenant.levels.length > 0 ? tenant.levels : defaultLevelsForType(tenant.type),
  );
  const primaryCampus = createCampusDraft(tenant, desiredLevels, 0);
  const campuses = (tenant.campuses.length > 0 ? tenant.campuses : [primaryCampus]).map((campus, index) => ({
    ...campus,
    id: campus.id || `campus-${index + 1}`,
    name: campus.name || (index === 0 ? primaryCampus.name : `Campus ${index + 1}`),
    code: campus.code || `${tenant.shortCode}${index + 1}`,
    district: campus.district || tenant.district,
    city: campus.city || tenant.city,
    address: campus.address || tenant.physicalAddress,
    phone: campus.phone || tenant.phone,
    status: campus.status ?? (index === 0 ? "active" : "setup"),
    levels: uniqueLevels(campus.levels.length > 0 ? campus.levels : desiredLevels),
    studentCount: campus.studentCount ?? 0,
    teacherCount: campus.teacherCount ?? 0,
  }));
  const levelsFromCampuses = uniqueLevels(campuses.flatMap((campus) => campus.levels));

  return {
    ...tenant,
    levels: levelsFromCampuses.length > 0 ? levelsFromCampuses : desiredLevels,
    campuses,
  };
}

function createEmptyFeatureFlags(): TenantFeatureFlags {
  return FEATURE_ORDER.reduce((acc, feature) => {
    acc[feature] = false;
    return acc;
  }, {} as TenantFeatureFlags);
}

export function buildFeatureFlags(planId: PlanId, overrides: Partial<TenantFeatureFlags> = {}) {
  const next = createEmptyFeatureFlags();
  for (const feature of FEATURE_ORDER) {
    next[feature] = planIncludesFeature(planId, feature);
  }
  for (const [feature, enabled] of Object.entries(overrides) as [FeatureKey, boolean][]) {
    next[feature] = planIncludesFeature(planId, feature) ? enabled : false;
  }
  return next;
}

export function getPlanPrice(planId: PlanId, billingCycle: BillingCycle) {
  const plan = PLAN_CATALOG[planId];
  return billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

export function createTenantSubscription(
  planId: PlanId,
  overrides: Partial<TenantSubscription> = {},
): TenantSubscription {
  const billingCycle = overrides.billingCycle ?? "monthly";
  const plan = PLAN_CATALOG[planId];
  return {
    planId,
    status: overrides.status ?? "trial",
    billingCycle,
    amount: overrides.amount ?? getPlanPrice(planId, billingCycle),
    campusLimit: overrides.campusLimit ?? plan.campusLimit,
    nextInvoiceDate: overrides.nextInvoiceDate ?? "01 Jun 2026",
    renewalDate: overrides.renewalDate ?? "01 Jun 2026",
    learnerLimit: overrides.learnerLimit ?? plan.learnerLimit,
    smsQuota: overrides.smsQuota ?? plan.smsQuota,
    smsUsed: overrides.smsUsed ?? 0,
    supportLevel: overrides.supportLevel ?? plan.supportLevel,
    billingContact: overrides.billingContact ?? "",
    notes: overrides.notes,
  };
}

export function isTenantFeatureIncluded(tenant: Tenant, feature: FeatureKey) {
  return planIncludesFeature(tenant.subscription.planId, feature);
}

export function isTenantFeatureEnabled(tenant: Tenant, feature: FeatureKey) {
  return tenant.features[feature];
}

export function isTenantModuleEnabled(tenant: Tenant, module: string) {
  const feature = MODULE_FEATURE_MAP[module];
  return feature ? isTenantFeatureEnabled(tenant, feature) : true;
}

function withPlan(tenant: Tenant, planId: PlanId, billingCycle = tenant.subscription.billingCycle) {
  const features = buildFeatureFlags(planId, tenant.features);
  return normaliseTenantStructure({
    ...tenant,
    currency: planIncludesFeature(planId, "multiCurrency") ? tenant.currency : "ZMW",
    offlineMode: planIncludesFeature(planId, "offlineMode") ? tenant.offlineMode : false,
    features,
    subscription: createTenantSubscription(planId, {
      ...tenant.subscription,
      planId,
      billingCycle,
      amount: getPlanPrice(planId, billingCycle),
      campusLimit: PLAN_CATALOG[planId].campusLimit,
      learnerLimit: PLAN_CATALOG[planId].learnerLimit,
      smsQuota: PLAN_CATALOG[planId].smsQuota,
      supportLevel: PLAN_CATALOG[planId].supportLevel,
    }),
  });
}

function applyTenantPatch(tenant: Tenant, patch: TenantPatch) {
  const nextPlanId = patch.subscription?.planId ?? tenant.subscription.planId;
  const nextBillingCycle = patch.subscription?.billingCycle ?? tenant.subscription.billingCycle;
  const base =
    nextPlanId !== tenant.subscription.planId || nextBillingCycle !== tenant.subscription.billingCycle
      ? withPlan(tenant, nextPlanId, nextBillingCycle)
      : tenant;
  const subscription = patch.subscription
    ? { ...base.subscription, ...patch.subscription }
    : base.subscription;
  const features = buildFeatureFlags(
    subscription.planId,
    patch.features ? { ...base.features, ...patch.features } : base.features,
  );

  return normaliseTenantStructure({
    ...base,
    ...patch,
    currency: features.multiCurrency ? patch.currency ?? base.currency : "ZMW",
    offlineMode: features.offlineMode ? patch.offlineMode ?? base.offlineMode : false,
    subscription,
    features,
  });
}

const EMPTY_TENANT: Tenant = normaliseTenantStructure({
  id: "",
  name: "",
  shortCode: "",
  type: "PRIMARY",
  levels: ["PRIMARY"],
  campuses: [],
  motto: "",
  district: "",
  province: "",
  currentTerm: 1,
  currentYear: new Date().getFullYear(),
  totalStudents: 0,
  totalTeachers: 0,
  totalClasses: 0,
  primaryColor: "#1e40af",
  offlineMode: false,
  subscription: createTenantSubscription("core", {
    status: "trial",
    billingCycle: "monthly",
    nextInvoiceDate: "",
    renewalDate: "",
    smsUsed: 0,
    billingContact: "",
  }),
  features: buildFeatureFlags("core"),
});

const SCHOOL_STORAGE_KEY = "srms_school_id";
const SESSION_EVENT = "srms-session-changed";

function normalisePlanId(planId: string | null | undefined, fallback: PlanId = "core"): PlanId {
  return (Object.keys(PLAN_CATALOG) as PlanId[]).includes(planId as PlanId) ? (planId as PlanId) : fallback;
}

function normaliseSubscriptionStatus(
  status: string | null | undefined,
  fallback: SubscriptionStatus = "trial",
): SubscriptionStatus {
  return ["trial", "active", "past_due", "suspended"].includes(status ?? "")
    ? (status as SubscriptionStatus)
    : fallback;
}

function normaliseSchoolType(type: string | null | undefined, fallback: SchoolType = "PRIMARY"): SchoolType {
  const next = (type ?? "").toUpperCase();
  return ["NURSERY", "PRIMARY", "SECONDARY", "COMBINED", "FULL"].includes(next)
    ? (next as SchoolType)
    : fallback;
}

function normaliseOwnership(value: string | null | undefined, fallback: Tenant["ownership"] = "Private"): Tenant["ownership"] {
  return ["Government", "Private", "Grant-Aided", "Community", "Faith-Based"].includes(value ?? "")
    ? (value as Tenant["ownership"])
    : fallback;
}

function normaliseCategory(value: string | null | undefined, fallback: Tenant["category"] = "Day"): Tenant["category"] {
  return ["Day", "Boarding", "Day & Boarding"].includes(value ?? "")
    ? (value as Tenant["category"])
    : fallback;
}

function normaliseCurriculum(value: string | null | undefined, fallback: Tenant["curriculum"] = "ECZ"): Tenant["curriculum"] {
  return ["ECZ", "Cambridge", "IB", "Hybrid"].includes(value ?? "")
    ? (value as Tenant["curriculum"])
    : fallback;
}

function normaliseTerm(value: number | null | undefined, fallback: 1 | 2 | 3 = 1): 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : fallback;
}

function normaliseBillingCycle(value: string | null | undefined, fallback: BillingCycle = "monthly"): BillingCycle {
  return value === "annual" || value === "monthly" ? value : fallback;
}

function normaliseSupportLevel(
  value: string | null | undefined,
  fallback: SupportLevel = "Standard",
): SupportLevel {
  return value === "Priority" || value === "Dedicated" || value === "Standard"
    ? value
    : fallback;
}

function normaliseAcademicLevels(
  levels: readonly (string | null | undefined)[] | null | undefined,
  fallback: AcademicLevel[],
) {
  const next = ACADEMIC_LEVEL_ORDER.filter((level) => levels?.includes(level));
  return next.length > 0 ? next : fallback;
}

function normaliseCampusStatus(
  value: string | null | undefined,
  fallback: CampusStatus = "active",
): CampusStatus {
  return value === "active" || value === "setup" || value === "planned" ? value : fallback;
}

function toSchoolDto(tenant: Tenant): BackendSchoolDto {
  return {
    name: tenant.name,
    shortCode: tenant.shortCode,
    motto: tenant.motto,
    district: tenant.district,
    province: tenant.province,
    type: tenant.type,
    ownership: tenant.ownership,
    category: tenant.category,
    gender: tenant.gender,
    curriculum: tenant.curriculum,
    languageOfInstruction: tenant.languageOfInstruction,
    email: tenant.email,
    phone: tenant.phone,
    altPhone: tenant.altPhone,
    website: tenant.website,
    physicalAddress: tenant.physicalAddress,
    poBox: tenant.poBox,
    city: tenant.city,
    postalCode: tenant.postalCode,
    gpsCoordinates: tenant.gpsCoordinates,
    headTeacher: tenant.headTeacher,
    headTeacherEmail: tenant.headTeacherEmail,
    deputyHead: tenant.deputyHead,
    boardChair: tenant.boardChair,
    primaryColor: tenant.primaryColor,
    secondaryColor: tenant.secondaryColor,
    accentColor: tenant.accentColor,
    fontFamily: tenant.fontFamily,
    logoUrl: tenant.logoUrl,
    faviconUrl: tenant.faviconUrl,
    reportFooter: tenant.reportFooter,
    registrationNo: tenant.registrationNo,
    tpinNo: tenant.tpinNo,
    moeCode: tenant.moeCode,
    examCentreNo: tenant.examCentreNo,
    yearFounded: tenant.yearFounded,
    weekStart: tenant.weekStart,
    gradingScale: tenant.gradingScale,
    passMark: tenant.passMark,
    currency: tenant.currency,
    bankName: tenant.bankName,
    bankAccount: tenant.bankAccount,
    bankBranch: tenant.bankBranch,
    termStart: tenant.termStart,
    termEnd: tenant.termEnd,
    currentTerm: tenant.currentTerm,
    currentYear: tenant.currentYear,
    totalStudents: tenant.totalStudents,
    totalTeachers: tenant.totalTeachers,
    totalClasses: tenant.totalClasses,
    planId: tenant.subscription.planId,
    billingCycle: tenant.subscription.billingCycle,
    amount: tenant.subscription.amount,
    campusLimit: tenant.subscription.campusLimit,
    nextInvoiceDate: tenant.subscription.nextInvoiceDate,
    renewalDate: tenant.subscription.renewalDate,
    learnerLimit: tenant.subscription.learnerLimit,
    smsQuota: tenant.subscription.smsQuota,
    smsUsed: tenant.subscription.smsUsed,
    supportLevel: tenant.subscription.supportLevel,
    billingContact: tenant.subscription.billingContact,
    notes: tenant.subscription.notes,
    offlineMode: tenant.offlineMode,
    slug: tenant.slug,
    subscriptionStatus: tenant.subscription.status,
    levels: tenant.levels,
    campuses: tenant.campuses.map((campus) => ({
      id: campus.id,
      name: campus.name,
      code: campus.code,
      district: campus.district,
      city: campus.city,
      address: campus.address,
      phone: campus.phone,
      status: campus.status,
      levels: campus.levels,
      studentCount: campus.studentCount,
      teacherCount: campus.teacherCount,
    })),
    features: tenant.features,
  };
}

function tenantFromBackendSchool(school: BackendSchool, existing?: Tenant): Tenant {
  const type = normaliseSchoolType(school.type, existing?.type ?? "PRIMARY");
  const planId = normalisePlanId(school.planId, existing?.subscription.planId ?? "core");
  const billingCycle = normaliseBillingCycle(school.billingCycle, existing?.subscription.billingCycle ?? "monthly");
  const fallbackLevels = existing?.levels?.length ? existing.levels : defaultLevelsForType(type);
  const levels = normaliseAcademicLevels(school.levels, fallbackLevels);
  const primaryCampusDraft = createCampusDraft(
    {
      name: school.name,
      shortCode: school.shortCode,
      district: school.district ?? existing?.district ?? "",
      city: school.city ?? existing?.city,
      physicalAddress: school.physicalAddress ?? existing?.physicalAddress,
      phone: school.phone ?? existing?.phone,
    },
    levels,
    0,
  );

  const baseSubscription = existing?.subscription ?? createTenantSubscription(planId, {
    billingCycle,
    billingContact: school.email ?? "",
  });

  const campuses = school.campuses?.length
    ? school.campuses.map((campus, index) => ({
      id: campus.id || `campus-${index + 1}`,
      name: campus.name || (index === 0 ? primaryCampusDraft.name : `Campus ${index + 1}`),
      code: campus.code || `${school.shortCode}${index + 1}`,
      district: campus.district || school.district || existing?.district || "",
      city: campus.city || school.city || existing?.city,
      address: campus.address || school.physicalAddress || existing?.physicalAddress,
      phone: campus.phone || school.phone || existing?.phone,
      status: normaliseCampusStatus(campus.status, index === 0 ? "active" : "setup"),
      levels: normaliseAcademicLevels(campus.levels, levels),
      studentCount: Number(campus.studentCount ?? 0),
      teacherCount: Number(campus.teacherCount ?? 0),
    }))
    : existing?.campuses?.length
      ? existing.campuses
      : [primaryCampusDraft];

  const featureOverrides = Object.fromEntries(
    Object.entries(school.features ?? {})
      .filter(([feature]) => FEATURE_ORDER.includes(feature as FeatureKey))
      .map(([feature, enabled]) => [feature, Boolean(enabled)]),
  ) as Partial<TenantFeatureFlags>;

  return normaliseTenantStructure({
    ...(existing ?? {
      id: school.id,
      name: school.name,
      shortCode: school.shortCode,
      type,
      levels,
      campuses,
      motto: school.motto ?? "",
      district: school.district ?? "",
      province: school.province ?? "Lusaka",
      currentTerm: normaliseTerm(school.currentTerm, 1),
      currentYear: school.currentYear || new Date().getFullYear(),
      totalStudents: school.totalStudents ?? 0,
      totalTeachers: school.totalTeachers ?? 0,
      totalClasses: school.totalClasses ?? 0,
      primaryColor: school.primaryColor ?? "#1e40af",
      ownership: normaliseOwnership(school.ownership, "Private"),
      category: normaliseCategory(school.category, "Day"),
      gender: school.gender === "Boys" || school.gender === "Girls" || school.gender === "Mixed"
        ? school.gender
        : undefined,
      curriculum: normaliseCurriculum(school.curriculum, "ECZ"),
      languageOfInstruction: school.languageOfInstruction ?? undefined,
      email: school.email ?? "",
      phone: school.phone ?? "",
      altPhone: school.altPhone ?? "",
      website: school.website ?? "",
      physicalAddress: school.physicalAddress ?? "",
      poBox: school.poBox ?? "",
      city: school.city ?? "",
      postalCode: school.postalCode ?? "",
      gpsCoordinates: school.gpsCoordinates ?? "",
      headTeacher: school.headTeacher ?? "",
      headTeacherEmail: school.headTeacherEmail ?? "",
      deputyHead: school.deputyHead ?? "",
      boardChair: school.boardChair ?? "",
      registrationNo: school.registrationNo ?? "",
      tpinNo: school.tpinNo ?? "",
      moeCode: school.moeCode ?? "",
      examCentreNo: school.examCentreNo ?? "",
      yearFounded: school.yearFounded ?? undefined,
      weekStart: school.weekStart === "Sunday" ? "Sunday" : school.weekStart === "Monday" ? "Monday" : "Monday",
      gradingScale: school.gradingScale === "Percentage" || school.gradingScale === "GPA" || school.gradingScale === "Letter"
        ? school.gradingScale
        : "ECZ",
      passMark: school.passMark ?? undefined,
      currency: school.currency === "USD" || school.currency === "ZMW" ? school.currency : "ZMW",
      bankName: school.bankName ?? "",
      bankAccount: school.bankAccount ?? "",
      bankBranch: school.bankBranch ?? "",
      secondaryColor: school.secondaryColor ?? undefined,
      accentColor: school.accentColor ?? undefined,
      fontFamily: school.fontFamily ?? undefined,
      logoUrl: school.logoUrl ?? undefined,
      faviconUrl: school.faviconUrl ?? undefined,
      reportFooter: school.reportFooter ?? undefined,
      termStart: school.termStart ?? undefined,
      termEnd: school.termEnd ?? undefined,
      offlineMode: Boolean(school.offlineMode),
      slug: school.slug ?? undefined,
      subscription: baseSubscription,
      features: buildFeatureFlags(planId, featureOverrides),
    }),
    id: school.id,
    name: school.name,
    shortCode: school.shortCode,
    type,
    levels,
    campuses,
    motto: school.motto ?? existing?.motto ?? "",
    district: school.district ?? existing?.district ?? "",
    province: school.province ?? existing?.province ?? "Lusaka",
    currentTerm: normaliseTerm(school.currentTerm, existing?.currentTerm ?? 1),
    currentYear: school.currentYear || existing?.currentYear || new Date().getFullYear(),
    totalStudents: school.totalStudents ?? existing?.totalStudents ?? 0,
    totalTeachers: school.totalTeachers ?? existing?.totalTeachers ?? 0,
    totalClasses: school.totalClasses ?? existing?.totalClasses ?? 0,
    primaryColor: school.primaryColor ?? existing?.primaryColor ?? "#1e40af",
    ownership: normaliseOwnership(school.ownership, existing?.ownership ?? "Private"),
    category: normaliseCategory(school.category, existing?.category ?? "Day"),
    gender: school.gender === "Boys" || school.gender === "Girls" || school.gender === "Mixed"
      ? school.gender
      : existing?.gender,
    curriculum: normaliseCurriculum(school.curriculum, existing?.curriculum ?? "ECZ"),
    languageOfInstruction: school.languageOfInstruction ?? existing?.languageOfInstruction,
    email: school.email ?? existing?.email ?? "",
    phone: school.phone ?? existing?.phone ?? "",
    altPhone: school.altPhone ?? existing?.altPhone ?? "",
    website: school.website ?? existing?.website ?? "",
    physicalAddress: school.physicalAddress ?? existing?.physicalAddress ?? "",
    poBox: school.poBox ?? existing?.poBox ?? "",
    city: school.city ?? existing?.city ?? "",
    postalCode: school.postalCode ?? existing?.postalCode ?? "",
    gpsCoordinates: school.gpsCoordinates ?? existing?.gpsCoordinates ?? "",
    headTeacher: school.headTeacher ?? existing?.headTeacher ?? "",
    headTeacherEmail: school.headTeacherEmail ?? existing?.headTeacherEmail ?? "",
    deputyHead: school.deputyHead ?? existing?.deputyHead ?? "",
    boardChair: school.boardChair ?? existing?.boardChair ?? "",
    registrationNo: school.registrationNo ?? existing?.registrationNo ?? "",
    tpinNo: school.tpinNo ?? existing?.tpinNo ?? "",
    moeCode: school.moeCode ?? existing?.moeCode ?? "",
    examCentreNo: school.examCentreNo ?? existing?.examCentreNo ?? "",
    yearFounded: school.yearFounded ?? existing?.yearFounded,
    weekStart: school.weekStart === "Sunday"
      ? "Sunday"
      : school.weekStart === "Monday"
        ? "Monday"
        : existing?.weekStart ?? "Monday",
    gradingScale: school.gradingScale === "Percentage" || school.gradingScale === "GPA" || school.gradingScale === "Letter" || school.gradingScale === "ECZ"
      ? school.gradingScale
      : existing?.gradingScale ?? "ECZ",
    passMark: school.passMark ?? existing?.passMark,
    currency: school.currency === "USD" || school.currency === "ZMW"
      ? school.currency
      : existing?.currency ?? "ZMW",
    bankName: school.bankName ?? existing?.bankName ?? "",
    bankAccount: school.bankAccount ?? existing?.bankAccount ?? "",
    bankBranch: school.bankBranch ?? existing?.bankBranch ?? "",
    secondaryColor: school.secondaryColor ?? existing?.secondaryColor,
    accentColor: school.accentColor ?? existing?.accentColor,
    fontFamily: school.fontFamily ?? existing?.fontFamily,
    logoUrl: school.logoUrl ?? existing?.logoUrl,
    faviconUrl: school.faviconUrl ?? existing?.faviconUrl,
    reportFooter: school.reportFooter ?? existing?.reportFooter,
    termStart: school.termStart ?? existing?.termStart,
    termEnd: school.termEnd ?? existing?.termEnd,
    offlineMode: school.offlineMode ?? existing?.offlineMode ?? false,
    slug: school.slug ?? existing?.slug,
    subscription: createTenantSubscription(planId, {
      ...baseSubscription,
      billingCycle,
      amount: Number(school.amount ?? baseSubscription.amount),
      status: normaliseSubscriptionStatus(school.subscriptionStatus, baseSubscription.status),
      campusLimit: Number(school.campusLimit ?? baseSubscription.campusLimit),
      nextInvoiceDate: school.nextInvoiceDate ?? baseSubscription.nextInvoiceDate,
      renewalDate: school.renewalDate ?? baseSubscription.renewalDate,
      learnerLimit: Number(school.learnerLimit ?? baseSubscription.learnerLimit),
      smsQuota: Number(school.smsQuota ?? baseSubscription.smsQuota),
      smsUsed: Number(school.smsUsed ?? baseSubscription.smsUsed),
      supportLevel: normaliseSupportLevel(school.supportLevel, baseSubscription.supportLevel),
      billingContact: school.billingContact ?? baseSubscription.billingContact ?? school.email ?? "",
      notes: school.notes ?? baseSubscription.notes,
    }),
    features: buildFeatureFlags(planId, {
      ...existing?.features,
      ...featureOverrides,
    }),
  });
}

type TenantContextValue = {
  tenants: Tenant[];
  active: Tenant;
  activePlan: PlanDefinition;
  setActive: (id: string) => void;
  addTenant: (tenant: Omit<Tenant, "id" | "totalStudents" | "totalTeachers" | "totalClasses">) => Promise<Tenant>;
  updateActive: (patch: TenantPatch) => void;
  updateTenant: (tenantId: string, patch: TenantPatch) => void;
  setFeaturesForTenant: (tenantId: string, features: Partial<TenantFeatureFlags>) => void;
  changePlan: (planId: PlanId, billingCycle?: BillingCycle) => void;
  changePlanForTenant: (tenantId: string, planId: PlanId, billingCycle?: BillingCycle) => void;
  setFeatureEnabled: (feature: FeatureKey, enabled: boolean) => void;
  isFeatureIncluded: (feature: FeatureKey, tenant?: Tenant) => boolean;
  isFeatureEnabled: (feature: FeatureKey, tenant?: Tenant) => boolean;
  isModuleEnabled: (module: string, tenant?: Tenant) => boolean;
};

function detectSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.hostname.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  if (["www", "app", "portal", "admin", "api", "mail", "smtp"].includes(sub)) return null;
  return sub;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(SCHOOL_STORAGE_KEY) ?? "";
  });

  const persistTenant = async (tenant: Tenant) => {
    try {
      await api.schools.update(tenant.id, toSchoolDto(tenant));
    } catch (error) {
      console.warn("Failed to sync school to backend", error);
    }
  };

  const mutateTenant = (tenantId: string, updater: (tenant: Tenant) => Tenant, persist = false) => {
    let nextTenant: Tenant | null = null;
    setTenants((prev) => prev.map((tenant) => {
      if (tenant.id !== tenantId) return tenant;
      nextTenant = updater(tenant);
      return nextTenant;
    }));
    if (persist && nextTenant) {
      void persistTenant(nextTenant);
    }
  };

  useEffect(() => {
    const loadBackendTenants = async () => {
      if (typeof window === "undefined") return;
      if (!window.localStorage.getItem("srms_token")) {
        setTenants([]);
        setActiveId("");
        return;
      }

      try {
        const schools = await api.schools.list();
        if (schools.length === 0) {
          setTenants([]);
          setActiveId("");
          window.localStorage.removeItem(SCHOOL_STORAGE_KEY);
          return;
        }

        setTenants((prev) => {
          const merged = schools.map((school) => {
            const existing = prev.find((tenant) => tenant.id === school.id || tenant.shortCode === school.shortCode);
            return tenantFromBackendSchool(school, existing);
          });
          const localOnly = prev.filter((tenant) => (
            tenant.id.startsWith("local-") &&
            !schools.some((school) => school.id === tenant.id || school.shortCode === tenant.shortCode)
          ));
          return [...merged, ...localOnly];
        });

        const subSlug = detectSubdomainSlug();
        const slugMatch = subSlug ? schools.find((s) => s.slug === subSlug) : undefined;
        const storedId = window.localStorage.getItem(SCHOOL_STORAGE_KEY);
        const nextActiveId = slugMatch
          ? slugMatch.id
          : storedId && schools.some((school) => school.id === storedId)
            ? storedId
            : schools[0].id;
        setActiveId(nextActiveId);
        window.localStorage.setItem(SCHOOL_STORAGE_KEY, nextActiveId);
      } catch (error) {
        console.warn("Failed to load schools from backend", error);
      }
    };

    void loadBackendTenants();

    if (typeof window === "undefined") return undefined;

    const onSessionChanged = () => {
      void loadBackendTenants();
    };

    window.addEventListener(SESSION_EVENT, onSessionChanged);
    return () => window.removeEventListener(SESSION_EVENT, onSessionChanged);
  }, []);

  const value = useMemo<TenantContextValue>(() => {
    const active = tenants.find((tenant) => tenant.id === activeId) ?? tenants[0] ?? EMPTY_TENANT;

    return {
      tenants,
      active,
      activePlan: PLAN_CATALOG[active.subscription.planId],
      setActive: (id) => {
        setActiveId(id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SCHOOL_STORAGE_KEY, id);
        }
      },
      addTenant: async (tenant) => {
        const draft = withPlan(
          {
            ...tenant,
            id: `local-${tenant.shortCode.toLowerCase()}-${Date.now().toString(36)}`,
            totalStudents: 0,
            totalTeachers: 0,
            totalClasses: 0,
          },
          tenant.subscription.planId,
          tenant.subscription.billingCycle,
        );
        // No fallback here on purpose: a school that only exists in local state
        // disappears on the next refresh with no record it was ever "created",
        // while onboarding would still tell the user it succeeded. Let failures
        // propagate so the caller can show a real error instead.
        const createdSchool = await api.schools.create(toSchoolDto(draft));
        const created = tenantFromBackendSchool(createdSchool, { ...draft, id: createdSchool.id });
        setTenants((prev) => [...prev.filter((item) => item.shortCode !== created.shortCode), created]);
        setActiveId(created.id);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(SCHOOL_STORAGE_KEY, created.id);
        }
        return created;
      },
      updateActive: (patch) => {
        mutateTenant(activeId, (tenant) => applyTenantPatch(tenant, patch), true);
      },
      updateTenant: (tenantId, patch) => {
        mutateTenant(tenantId, (tenant) => applyTenantPatch(tenant, patch), true);
      },
      setFeaturesForTenant: (tenantId, features) => {
        mutateTenant(tenantId, (tenant) => {
          const nextFeatures = buildFeatureFlags(tenant.subscription.planId, {
            ...tenant.features,
            ...features,
          });

          return normaliseTenantStructure({
            ...tenant,
            currency: nextFeatures.multiCurrency ? tenant.currency : "ZMW",
            offlineMode: nextFeatures.offlineMode ? tenant.offlineMode : false,
            features: nextFeatures,
          });
        });
      },
      changePlan: (planId, billingCycle) => {
        mutateTenant(activeId, (tenant) => withPlan(tenant, planId, billingCycle), true);
      },
      changePlanForTenant: (tenantId, planId, billingCycle) => {
        mutateTenant(tenantId, (tenant) => withPlan(tenant, planId, billingCycle), true);
      },
      setFeatureEnabled: (feature, enabled) => {
        mutateTenant(activeId, (tenant) => {
          if (!isTenantFeatureIncluded(tenant, feature)) return tenant;
          const features = buildFeatureFlags(tenant.subscription.planId, {
            ...tenant.features,
            [feature]: enabled,
          });
          return {
            ...tenant,
            offlineMode: features.offlineMode ? (feature === "offlineMode" ? enabled : tenant.offlineMode) : false,
            currency: features.multiCurrency ? tenant.currency : "ZMW",
            features,
          };
        });
      },
      isFeatureIncluded: (feature, tenant = active) => isTenantFeatureIncluded(tenant, feature),
      isFeatureEnabled: (feature, tenant = active) => isTenantFeatureEnabled(tenant, feature),
      isModuleEnabled: (module, tenant = active) => isTenantModuleEnabled(tenant, module),
    };
  }, [tenants, activeId]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used inside TenantProvider");
  return context;
}

export function gradeRangeForType(type: SchoolType): string {
  switch (type) {
    case "NURSERY":
      return "ECE: Baby Class - Reception";
    case "PRIMARY":
      return "Lower & Upper Primary: Grade 1 - Grade 6";
    case "SECONDARY":
      return "O-Level Form 1-4 · A-Level Form 5-6 (Zambia 2025 curriculum)";
    case "COMBINED":
      return "Primary Grade 1-6 · Secondary Form 1-6";
    case "FULL":
      return "ECE · Primary Grade 1-6 · Secondary Form 1-6";
  }
}
