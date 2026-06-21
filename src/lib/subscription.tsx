// Re-exports and UI helpers built on top of the canonical tenant subscription model
export type {
  PlanId,
  BillingCycle,
  SubscriptionStatus,
  PlanDefinition,
  FeatureKey,
  FeatureMeta,
  FeatureCategory,
  TenantSubscription,
} from "./tenant";

export {
  PLAN_CATALOG,
  FEATURE_META,
  FEATURE_ORDER,
  MODULE_FEATURE_MAP,
  planIncludesFeature,
  featuresForPlan,
  buildFeatureFlags,
  getPlanPrice,
  isTenantFeatureIncluded,
  isTenantFeatureEnabled,
  isTenantModuleEnabled,
} from "./tenant";

import type { PlanId, SubscriptionStatus } from "./tenant";

export const PLAN_UI: Record<PlanId, { color: string; badgeClass: string }> = {
  core: { color: "#6b7280", badgeClass: "bg-gray-500/15 text-gray-700 dark:text-gray-300" },
  growth: { color: "#0ea5e9", badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  advanced: { color: "#8b5cf6", badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  enterprise: { color: "#f59e0b", badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};

export const STATUS_UI: Record<SubscriptionStatus, { label: string; badgeClass: string }> = {
  active: { label: "Active", badgeClass: "bg-success/15 text-success" },
  trial: { label: "Trial", badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  past_due: { label: "Past due", badgeClass: "bg-destructive/15 text-destructive" },
  suspended: { label: "Suspended", badgeClass: "bg-gray-500/15 text-gray-500" },
};
