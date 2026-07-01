import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, type BackendAppUser, type BackendAuthSession } from "@/lib/api";
import { useTenant } from "@/lib/tenant";

export type Role =
  | "super_admin"
  | "school_admin"
  | "teacher"
  | "hod"
  | "finance"
  | "parent"
  | "principal"
  | "deputy_head"
  | "career_guidance";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  tenantId?: string;
  phone?: string;
  active?: boolean;
};

const SESSION_EVENT = "srms-session-changed";
const TOKEN_STORAGE_KEY = "srms_token";
const USER_STORAGE_KEY = "srms_user";
const SCHOOL_STORAGE_KEY = "srms_school_id";

export const ROLE_META: Record<Role, { label: string; tone: string; description: string }> = {
  super_admin: {
    label: "System Admin",
    tone: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    description: "Platform-wide control across onboarding, billing, and school portfolios.",
  },
  school_admin: {
    label: "School Admin",
    tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    description: "Full operational control for one subscribed school tenant.",
  },
  teacher: {
    label: "Teacher",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    description: "Attendance, assessments, welfare follow-up, and communication.",
  },
  hod: {
    label: "Head of Department",
    tone: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
    description: "Oversees a department — assigns teachers to classes and periods, monitors record completeness.",
  },
  finance: {
    label: "Finance Officer",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    description: "Fees, collections, procurement coordination, and statutory reporting.",
  },
  parent: {
    label: "Parent",
    tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    description: "View learner progress, communication, transport, and balances.",
  },
  principal: {
    label: "Principal",
    tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    description: "Head teacher — full oversight of the school's operations and academic records.",
  },
  deputy_head: {
    label: "Deputy Head",
    tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    description: "Deputises for the Principal across the school's day-to-day operations.",
  },
  career_guidance: {
    label: "Career Guidance Teacher",
    tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    description: "Guides students on academic and career choices using welfare and performance records.",
  },
};

export type Access = true | "read" | false;
export const MODULE_MATRIX = [
  "dashboard", "students", "teachers", "timetable", "attendance", "assessments",
  "report-card", "fees", "communication", "discipline", "library", "transport",
  "calendar", "reports", "settings", "access", "onboarding", "accounting",
  "health", "hostel", "inventory", "hr", "alumni", "admissions", "procurement",
  "facilities", "enterprise-analytics", "security", "compliance", "vendor-management",
  "district-management", "reporting", "incident-management", "user-management",
  "policy-library", "risk-register", "staff-development", "student-welfare",
  "fee-structure", "bursaries", "duty-roster", "activities", "visitor-log", "canteen",
  "strategic-plan", "lost-found", "platform-ops", "tenant-success", "plan-catalog", "support-desk",
  "platform-config", "tenant-lifecycle", "platform-audit", "revenue-ops", "data-governance",
  "partner-management", "contract-center", "status-center", "approval-center", "developer-console", "tenant-workbench",
] as const;

export const ACCESS: Record<Role, Record<string, Access>> = {
  super_admin: { dashboard: true, students: true, teachers: true, timetable: true, attendance: true, assessments: true, "report-card": true, fees: true, communication: true, discipline: true, library: true, transport: true, calendar: true, reports: true, settings: true, access: true, onboarding: true, accounting: true, health: true, hostel: true, inventory: true, hr: true, alumni: true, admissions: true, procurement: true, facilities: true, "enterprise-analytics": true, security: true, compliance: true, "vendor-management": true, "district-management": true, reporting: true, "incident-management": true, "user-management": true, "policy-library": true, "risk-register": true, "staff-development": true, "student-welfare": true, "fee-structure": true, bursaries: true, "duty-roster": true, activities: true, "visitor-log": true, canteen: true, "strategic-plan": true, "lost-found": true, "platform-ops": true, "tenant-success": true, "plan-catalog": true, "support-desk": true, "platform-config": true, "tenant-lifecycle": true, "platform-audit": true, "revenue-ops": true, "data-governance": true, "partner-management": true, "contract-center": true, "status-center": true, "approval-center": true, "developer-console": true, "tenant-workbench": true },
  school_admin: { dashboard: true, students: true, teachers: true, timetable: true, attendance: true, assessments: true, "report-card": true, fees: true, communication: true, discipline: true, library: true, transport: true, calendar: true, reports: true, settings: true, access: true, onboarding: false, accounting: true, health: true, hostel: true, inventory: true, hr: true, alumni: true, admissions: true, procurement: true, facilities: true, "enterprise-analytics": true, security: true, compliance: true, "vendor-management": true, "district-management": false, reporting: true, "incident-management": true, "user-management": true, "policy-library": true, "risk-register": true, "staff-development": true, "student-welfare": true, "fee-structure": true, bursaries: true, "duty-roster": true, activities: true, "visitor-log": true, canteen: true, "strategic-plan": true, "lost-found": true, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  teacher: { dashboard: true, students: "read", teachers: "read", timetable: "read", attendance: true, assessments: true, "report-card": true, fees: false, communication: true, discipline: true, library: "read", transport: false, calendar: "read", reports: "read", settings: false, access: false, onboarding: false, accounting: false, health: "read", hostel: "read", inventory: false, hr: false, alumni: "read", admissions: false, procurement: false, facilities: "read", "enterprise-analytics": false, security: false, compliance: "read", "vendor-management": false, "district-management": false, reporting: "read", "incident-management": "read", "user-management": false, "policy-library": "read", "risk-register": "read", "staff-development": "read", "student-welfare": true, "fee-structure": false, bursaries: false, "duty-roster": "read", activities: true, "visitor-log": false, canteen: "read", "strategic-plan": "read", "lost-found": true, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  hod: { dashboard: true, students: true, teachers: "read", timetable: true, attendance: "read", assessments: "read", "report-card": "read", fees: false, communication: true, discipline: true, library: "read", transport: false, calendar: "read", reports: "read", settings: false, access: false, onboarding: false, accounting: false, health: "read", hostel: "read", inventory: false, hr: false, alumni: "read", admissions: false, procurement: false, facilities: "read", "enterprise-analytics": false, security: false, compliance: "read", "vendor-management": false, "district-management": false, reporting: "read", "incident-management": "read", "user-management": false, "policy-library": "read", "risk-register": false, "staff-development": "read", "student-welfare": true, "fee-structure": false, bursaries: false, "duty-roster": "read", activities: "read", "visitor-log": false, canteen: false, "strategic-plan": false, "lost-found": true, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  finance: { dashboard: true, students: "read", teachers: false, timetable: false, attendance: "read", assessments: false, "report-card": false, fees: true, communication: "read", discipline: false, library: false, transport: true, calendar: "read", reports: true, settings: false, access: false, onboarding: false, accounting: true, health: false, hostel: false, inventory: true, hr: true, alumni: "read", admissions: "read", procurement: true, facilities: "read", "enterprise-analytics": true, security: true, compliance: "read", "vendor-management": true, "district-management": false, reporting: true, "incident-management": false, "user-management": false, "policy-library": "read", "risk-register": true, "staff-development": false, "student-welfare": false, "fee-structure": true, bursaries: true, "duty-roster": false, activities: false, "visitor-log": false, canteen: true, "strategic-plan": "read", "lost-found": false, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  parent: { dashboard: true, students: false, teachers: false, timetable: "read", attendance: "read", assessments: "read", "report-card": "read", fees: "read", communication: true, discipline: "read", library: false, transport: "read", calendar: "read", reports: false, settings: false, access: false, onboarding: false, accounting: false, health: "read", hostel: "read", inventory: false, hr: false, alumni: false, admissions: false, procurement: false, facilities: false, "enterprise-analytics": false, security: false, compliance: false, "vendor-management": false, "district-management": false, reporting: false, "incident-management": false, "user-management": false, "policy-library": false, "risk-register": false, "staff-development": false, "student-welfare": false, "fee-structure": "read", bursaries: false, "duty-roster": false, activities: "read", "visitor-log": false, canteen: false, "strategic-plan": false, "lost-found": false, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  principal: { dashboard: true, students: true, teachers: true, timetable: true, attendance: true, assessments: true, "report-card": true, fees: true, communication: true, discipline: true, library: true, transport: true, calendar: true, reports: true, settings: true, access: true, onboarding: false, accounting: true, health: true, hostel: true, inventory: true, hr: true, alumni: true, admissions: true, procurement: true, facilities: true, "enterprise-analytics": true, security: true, compliance: true, "vendor-management": true, "district-management": false, reporting: true, "incident-management": true, "user-management": true, "policy-library": true, "risk-register": true, "staff-development": true, "student-welfare": true, "fee-structure": true, bursaries: true, "duty-roster": true, activities: true, "visitor-log": true, canteen: true, "strategic-plan": true, "lost-found": true, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  deputy_head: { dashboard: true, students: true, teachers: true, timetable: true, attendance: true, assessments: true, "report-card": true, fees: true, communication: true, discipline: true, library: true, transport: true, calendar: true, reports: true, settings: true, access: true, onboarding: false, accounting: true, health: true, hostel: true, inventory: true, hr: true, alumni: true, admissions: true, procurement: true, facilities: true, "enterprise-analytics": true, security: true, compliance: true, "vendor-management": true, "district-management": false, reporting: true, "incident-management": true, "user-management": true, "policy-library": true, "risk-register": true, "staff-development": true, "student-welfare": true, "fee-structure": true, bursaries: true, "duty-roster": true, activities: true, "visitor-log": true, canteen: true, "strategic-plan": true, "lost-found": true, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
  career_guidance: { dashboard: true, students: "read", teachers: false, timetable: false, attendance: "read", assessments: "read", "report-card": "read", fees: false, communication: true, discipline: "read", library: false, transport: false, calendar: true, reports: false, settings: false, access: false, onboarding: false, accounting: false, health: false, hostel: false, inventory: false, hr: false, alumni: false, admissions: false, procurement: false, facilities: false, "enterprise-analytics": false, security: false, compliance: false, "vendor-management": false, "district-management": false, reporting: false, "incident-management": false, "user-management": false, "policy-library": false, "risk-register": false, "staff-development": false, "student-welfare": true, "fee-structure": false, bursaries: false, "duty-roster": false, activities: "read", "visitor-log": false, canteen: false, "strategic-plan": false, "lost-found": false, "platform-ops": false, "tenant-success": false, "plan-catalog": false, "support-desk": false, "platform-config": false, "tenant-lifecycle": false, "platform-audit": false, "revenue-ops": false, "data-governance": false, "partner-management": false, "contract-center": false, "status-center": false, "approval-center": false, "developer-console": false, "tenant-workbench": false },
};

type AuthContextValue = {
  user: AppUser | null;
  users: AppUser[];
  assignableRoles: Role[];
  isSystemAdmin: boolean;
  loadingSession: boolean;
  signIn: (email: string) => boolean;
  completeSignIn: (session: BackendAuthSession | BackendAppUser) => void;
  signOut: () => void;
  switchRole: (role: Role) => void;
  can: (module: string) => Access;
  addUser: (user: { name: string; email: string; role: Role; phone?: string; password?: string }) => Promise<AppUser>;
  updateUserRole: (id: string, role: Role) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function initialsFor(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function normaliseRole(role: string | null | undefined): Role {
  switch ((role ?? "").toLowerCase()) {
    case "super_admin":
    case "super admin":
      return "super_admin";
    case "school_admin":
    case "school admin":
      return "school_admin";
    case "teacher":
      return "teacher";
    case "hod":
    case "head_of_department":
    case "head of department":
      return "hod";
    case "finance":
    case "finance_officer":
    case "finance officer":
      return "finance";
    case "parent":
      return "parent";
    case "principal":
    case "head_master":
    case "headmaster":
    case "head master":
      return "principal";
    case "deputy_head":
    case "deputy_headteacher":
    case "deputy head":
      return "deputy_head";
    case "career_guidance":
    case "career_guidance_teacher":
    case "career guidance":
    case "career guidance teacher":
      return "career_guidance";
    default:
      return "school_admin";
  }
}

function mergeUser(users: AppUser[], nextUser: AppUser) {
  const existing = users.findIndex((user) => user.id === nextUser.id || user.email.toLowerCase() === nextUser.email.toLowerCase());
  if (existing === -1) return [nextUser, ...users];
  return users.map((user, index) => (index === existing ? { ...user, ...nextUser } : user));
}

function notifySessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function persistUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
}

function readStoredUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppUser>;
    if (!parsed.id || !parsed.name || !parsed.email || !parsed.role) return null;
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      role: normaliseRole(parsed.role),
      initials: parsed.initials || initialsFor(parsed.name),
      tenantId: parsed.tenantId,
      phone: parsed.phone,
      active: parsed.active,
    };
  } catch {
    return null;
  }
}

function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(SCHOOL_STORAGE_KEY);
}

function hasBackendSession() {
  return typeof window !== "undefined" && Boolean(window.localStorage.getItem(TOKEN_STORAGE_KEY));
}

function toAppUser(session: BackendAuthSession | BackendAppUser): AppUser {
  return {
    id: session.id,
    name: session.name,
    email: session.email,
    role: normaliseRole(session.role),
    initials: session.initials?.trim() || initialsFor(session.name),
    tenantId: session.schoolId ?? undefined,
    phone: "phone" in session ? session.phone ?? undefined : undefined,
    active: "active" in session ? session.active ?? undefined : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { active, isModuleEnabled, setActive } = useTenant();
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [user, setUser] = useState<AppUser | null>(() => readStoredUser());
  const [loadingSession, setLoadingSession] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(TOKEN_STORAGE_KEY) || window.localStorage.getItem(USER_STORAGE_KEY));
  });

  useEffect(() => {
    const hydrateSession = async () => {
      if (typeof window === "undefined") {
        setLoadingSession(false);
        return;
      }

      const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      const cachedUser = readStoredUser();

      if (cachedUser) {
        setAllUsers((prev) => mergeUser(prev, cachedUser));
        setUser(cachedUser);
        if (cachedUser.tenantId) setActive(cachedUser.tenantId);
      }

      if (!token) {
        setLoadingSession(false);
        return;
      }

      try {
        const backendUser = await api.auth.me();
        const nextUser = toAppUser(backendUser);
        setAllUsers((prev) => mergeUser(prev, nextUser));
        setUser(nextUser);
        persistUser(nextUser);
        if (nextUser.tenantId) {
          window.localStorage.setItem(SCHOOL_STORAGE_KEY, nextUser.tenantId);
          setActive(nextUser.tenantId);
        }
      } catch {
        if (!cachedUser) {
          clearStoredSession();
          setUser(null);
        }
      } finally {
        setLoadingSession(false);
      }
    };

    void hydrateSession();

    if (typeof window === "undefined") return undefined;

    const onSessionChanged = () => {
      setLoadingSession(true);
      void hydrateSession();
    };

    window.addEventListener(SESSION_EVENT, onSessionChanged);
    return () => window.removeEventListener(SESSION_EVENT, onSessionChanged);
  }, [setActive]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!user || !hasBackendSession()) return;

      try {
        const records = user.role === "super_admin"
          ? await api.users.all()
          : user.tenantId
            ? await api.users.list(user.tenantId)
            : [];
        const mapped = records.map(toAppUser);
        setAllUsers(() => {
          const merged = mapped.reduce<AppUser[]>((acc, record) => mergeUser(acc, record), []);
          return mergeUser(merged, user);
        });
      } catch (error) {
        console.warn("Failed to load users from backend", error);
      }
    };

    void loadUsers();
  }, [user]);

  const value = useMemo<AuthContextValue>(() => {
    const isSystemAdmin = user?.role === "super_admin";
    const scopedUsers = !user
      ? []
      : isSystemAdmin
        ? allUsers
        : allUsers.filter((record) => record.tenantId === (user.tenantId ?? active.id));
    const assignableRoles: Role[] = isSystemAdmin
      ? ["super_admin", "school_admin", "principal", "deputy_head", "teacher", "hod", "career_guidance", "finance", "parent"]
      : ["school_admin", "principal", "deputy_head", "teacher", "hod", "career_guidance", "finance", "parent"];

    return {
      user,
      users: scopedUsers,
      assignableRoles,
      isSystemAdmin,
      loadingSession,
      signIn: (email) => {
        const nextUser = allUsers.find((record) => record.email.toLowerCase() === email.toLowerCase());
        if (!nextUser) return false;
        setAllUsers((prev) => mergeUser(prev, nextUser));
        setUser(nextUser);
        persistUser(nextUser);
        if (typeof window !== "undefined") {
          if (nextUser.tenantId) {
            window.localStorage.setItem(SCHOOL_STORAGE_KEY, nextUser.tenantId);
          } else {
            window.localStorage.removeItem(SCHOOL_STORAGE_KEY);
          }
        }
        if (nextUser.tenantId) setActive(nextUser.tenantId);
        setLoadingSession(false);
        notifySessionChange();
        return true;
      },
      completeSignIn: (session) => {
        const nextUser = toAppUser(session);
        setAllUsers((prev) => mergeUser(prev, nextUser));
        setUser(nextUser);
        persistUser(nextUser);
        if (typeof window !== "undefined") {
          if ("token" in session && session.token) {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
          }
          if (nextUser.tenantId) {
            window.localStorage.setItem(SCHOOL_STORAGE_KEY, nextUser.tenantId);
          } else {
            window.localStorage.removeItem(SCHOOL_STORAGE_KEY);
          }
        }
        if (nextUser.tenantId) setActive(nextUser.tenantId);
        setLoadingSession(false);
        notifySessionChange();
      },
      signOut: () => {
        clearStoredSession();
        setUser(null);
        setLoadingSession(false);
        notifySessionChange();
      },
      switchRole: (role) => {
        setUser((current) => {
          if (!current) return current;
          const nextTenantId = role === "super_admin" ? undefined : current.tenantId ?? active.id;
          const nextUser = { ...current, role, tenantId: nextTenantId, initials: current.initials };
          persistUser(nextUser);
          if (typeof window !== "undefined") {
            if (nextTenantId) {
              window.localStorage.setItem(SCHOOL_STORAGE_KEY, nextTenantId);
            } else {
              window.localStorage.removeItem(SCHOOL_STORAGE_KEY);
            }
          }
          if (nextTenantId) setActive(nextTenantId);
          return nextUser;
        });
      },
      can: (module) => {
        if (!user) return false;
        const roleAccess = ACCESS[user.role][module] ?? false;
        if (roleAccess === false) return false;
        if (user.role === "super_admin") return roleAccess;
        return isModuleEnabled(module) ? roleAccess : false;
      },
      addUser: async (nextUser) => {
        const tenantId = nextUser.role === "super_admin" ? undefined : (isSystemAdmin ? active.id : user?.tenantId ?? active.id);
        const localUser = {
          ...nextUser,
          tenantId,
          id: `u${Date.now().toString(36)}`,
          initials: initialsFor(nextUser.name),
          active: true,
        };

        if (!hasBackendSession()) {
          setAllUsers((prev) => [...prev, localUser]);
          return localUser;
        }

        if (!tenantId && nextUser.role !== "super_admin") {
          throw new Error("A school must be selected before creating this user.");
        }

        const created = isSystemAdmin
          ? await api.users.createGlobal({
            ...nextUser,
            schoolId: tenantId,
          })
          : await api.users.create(tenantId!, nextUser);

        const mapped = toAppUser(created);
        setAllUsers((prev) => mergeUser(prev, mapped));
        return mapped;
      },
      updateUserRole: async (id, role) => {
        if (!hasBackendSession()) {
          setAllUsers((prev) => prev.map((record) => {
            if (record.id !== id) return record;
            return {
              ...record,
              role,
              tenantId: role === "super_admin" ? undefined : record.tenantId ?? active.id,
            };
          }));
          return;
        }

        const existing = allUsers.find((record) => record.id === id);
        if (!existing) return;

        const schoolId = role === "super_admin"
          ? undefined
          : existing.tenantId ?? (isSystemAdmin ? active.id : user?.tenantId ?? active.id);
        const updated = isSystemAdmin
          ? await api.users.update(id, { role, schoolId })
          : await api.users.updateForSchool(schoolId!, id, { role });
        const mapped = toAppUser(updated);

        setAllUsers((prev) => mergeUser(prev, mapped));
        if (user?.id === mapped.id) {
          setUser(mapped);
          persistUser(mapped);
        }
      },
      removeUser: async (id) => {
        if (!hasBackendSession()) {
          setAllUsers((prev) => prev.filter((record) => record.id !== id));
          return;
        }

        const existing = allUsers.find((record) => record.id === id);
        if (!existing) return;

        const schoolId = existing.tenantId ?? (isSystemAdmin ? active.id : user?.tenantId ?? active.id);
        if (isSystemAdmin) {
          await api.users.delete(id);
        } else {
          await api.users.deleteForSchool(schoolId!, id);
        }

        setAllUsers((prev) => prev.filter((record) => record.id !== id));
      },
    };
  }, [active.id, allUsers, isModuleEnabled, loadingSession, setActive, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
