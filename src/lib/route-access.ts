import type { Role } from "@/lib/auth";

export type RouteAccessRule = {
  module?: string;
  allowedRoles?: readonly Role[];
};

export const RESULT_APPROVAL_ROLES: readonly Role[] = [
  "super_admin",
  "school_admin",
  "principal",
  "deputy_head",
  "hod",
  "career_guidance",
];

const ACADEMIC_OPERATIONS_ROLES: readonly Role[] = [
  ...RESULT_APPROVAL_ROLES,
  "teacher",
];

const GUARDIAN_DIRECTORY_ROLES: readonly Role[] = [
  "super_admin",
  "school_admin",
  "principal",
  "deputy_head",
  "finance",
];

/**
 * Central route policy. Sidebar visibility is only navigation; this table is
 * the authorization boundary used when a user enters a URL directly.
 */
export const ROUTE_ACCESS_BY_SEGMENT: Readonly<Record<string, RouteAccessRule>> = {
  "": { module: "dashboard" },
  access: { module: "access" },
  accounting: { module: "accounting" },
  activities: { module: "activities" },
  alumni: { module: "alumni" },
  "approval-center": { module: "approval-center", allowedRoles: ["super_admin"] },
  assessments: { module: "assessments", allowedRoles: ACADEMIC_OPERATIONS_ROLES },
  attendance: { module: "attendance" },
  audit: { module: "settings" },
  backups: { module: "settings" },
  billing: { module: "settings", allowedRoles: ["super_admin"] },
  bursaries: { module: "bursaries" },
  calendar: { module: "calendar" },
  canteen: { module: "canteen" },
  classes: { module: "students" },
  communication: { module: "communication" },
  compliance: { module: "compliance" },
  "contract-center": { module: "contract-center" },
  curriculum: { module: "assessments", allowedRoles: ACADEMIC_OPERATIONS_ROLES },
  "data-governance": { module: "data-governance" },
  departments: { module: "assessments", allowedRoles: ACADEMIC_OPERATIONS_ROLES },
  "developer-console": { module: "developer-console" },
  discipline: { module: "discipline" },
  "district-management": { module: "district-management" },
  "duty-roster": { module: "duty-roster" },
  "enterprise-analytics": { module: "enterprise-analytics" },
  exams: { module: "assessments", allowedRoles: ACADEMIC_OPERATIONS_ROLES },
  facilities: { module: "facilities" },
  "fee-structure": { module: "fee-structure" },
  fees: { module: "fees" },
  health: { module: "health" },
  help: {},
  hostel: { module: "hostel" },
  hr: { module: "hr" },
  "incident-management": { module: "incident-management" },
  integrations: { module: "settings" },
  inventory: { module: "inventory" },
  "knowledge-base": {},
  library: { module: "library" },
  "lost-found": { module: "lost-found" },
  notifications: {},
  "my-children": { module: "my-children" },
  onboarding: { module: "onboarding" },
  parents: { module: "communication", allowedRoles: GUARDIAN_DIRECTORY_ROLES },
  "partner-management": { module: "partner-management" },
  "payment-result": { module: "fees" },
  payroll: { module: "accounting" },
  "plan-catalog": { module: "plan-catalog" },
  "platform-audit": { module: "platform-audit" },
  "platform-config": { module: "platform-config" },
  "platform-ops": { module: "platform-ops" },
  "policy-library": { module: "policy-library" },
  procurement: { module: "procurement" },
  profile: {},
  ptc: { module: "ptc" },
  "report-card": { module: "report-card" },
  reporting: { module: "reporting" },
  reports: { module: "reports" },
  "results-analysis": {
    module: "report-card",
    allowedRoles: ACADEMIC_OPERATIONS_ROLES,
  },
  "results-approvals": {
    module: "assessments",
    allowedRoles: RESULT_APPROVAL_ROLES,
  },
  "revenue-ops": { module: "revenue-ops" },
  "risk-register": { module: "risk-register" },
  s: {},
  security: { module: "security" },
  settings: { module: "settings" },
  "staff-development": { module: "staff-development" },
  "status-center": { module: "status-center" },
  "strategic-plan": { module: "strategic-plan" },
  "student-welfare": { module: "student-welfare" },
  students: { module: "students" },
  subjects: { module: "assessments", allowedRoles: ACADEMIC_OPERATIONS_ROLES },
  "support-desk": { module: "support-desk" },
  "sys-admin": { module: "platform-ops", allowedRoles: ["super_admin"] },
  teachers: { module: "teachers" },
  "tenant-lifecycle": { module: "tenant-lifecycle" },
  "tenant-success": { module: "tenant-success" },
  "tenant-workbench": { module: "tenant-workbench" },
  timetable: { module: "timetable" },
  transport: { module: "transport" },
  "user-management": { module: "user-management" },
  "vendor-management": { module: "vendor-management" },
  "visitor-log": { module: "visitor-log" },
};

export function routeAccessForPath(pathname: string): RouteAccessRule {
  const segment = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean)[0] ?? "";
  return ROUTE_ACCESS_BY_SEGMENT[segment] ?? { module: "__unmapped_route__" };
}

export function roleAllowedForPath(pathname: string, role: Role | undefined): boolean {
  const allowedRoles = routeAccessForPath(pathname).allowedRoles;
  return !allowedRoles || (role !== undefined && allowedRoles.includes(role));
}
