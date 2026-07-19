import type { ComponentType } from "react";

import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BedDouble,
  BookMarked,
  BookOpen,
  BookText,
  Briefcase,
  Building2,
  Bus,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  FileCog,
  FileText,
  HandCoins,
  HardDrive,
  Heart,
  HeartPulse,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  LifeBuoy,
  MessageSquare,
  Package,
  PackageSearch,
  Plug,
  Receipt,
  School,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Users2,
  UtensilsCrossed,
  Wallet,
  Wrench,
} from "lucide-react";

/**
 * Single source of truth for the school/platform nav catalog. Both the sidebar
 * (workspace-sidebar.tsx) and the command palette (command-palette.tsx) render
 * from these arrays so the two surfaces can't silently drift out of sync.
 */
export type NavItem = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  module: string;
  /** Command-palette-only keyboard shortcut hint (e.g. "G D"); ignored by the sidebar. */
  shortcut?: string;
};

export const schoolOverview: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard", shortcut: "G D" },
  { title: "Students", url: "/students", icon: Users, module: "students", shortcut: "G S" },
  { title: "Parents", url: "/parents", icon: Users2, module: "communication" },
  { title: "Teachers", url: "/teachers", icon: UserCog, module: "teachers" },
  { title: "Classes", url: "/classes", icon: School, module: "students" },
  { title: "Subjects", url: "/subjects", icon: BookMarked, module: "assessments" },
  { title: "Departments", url: "/departments", icon: Building2, module: "assessments" },
  { title: "Curriculum", url: "/curriculum", icon: Library, module: "assessments" },
  { title: "Timetable", url: "/timetable", icon: CalendarDays, module: "timetable" },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
  { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
  { title: "Examinations", url: "/exams", icon: ClipboardCheck, module: "assessments" },
  { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
];

/** Clubs, wellbeing, and community-facing operations. */
export const schoolStudentLife: NavItem[] = [
  { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
  { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
  { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
  { title: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
  { title: "Alumni", url: "/alumni", icon: Award, module: "alumni" },
  { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
];

/** Physical campus and facilities operations. */
export const schoolCampusOps: NavItem[] = [
  { title: "Library", url: "/library", icon: BookOpen, module: "library" },
  { title: "Transport", url: "/transport", icon: Bus, module: "transport" },
  { title: "Health & Clinic", url: "/health", icon: HeartPulse, module: "health" },
  { title: "Hostel & Boarding", url: "/hostel", icon: BedDouble, module: "hostel" },
  { title: "Inventory", url: "/inventory", icon: Package, module: "inventory" },
  { title: "Canteen", url: "/canteen", icon: UtensilsCrossed, module: "canteen" },
  { title: "Facilities", url: "/facilities", icon: Wrench, module: "facilities" },
  { title: "Visitor Log", url: "/visitor-log", icon: ContactRound, module: "visitor-log" },
  { title: "Lost & Found", url: "/lost-found", icon: PackageSearch, module: "lost-found" },
  { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
];

/** @deprecated Prefer the split `schoolStudentLife`/`schoolCampusOps` groups. Kept for consumers that want one flat list. */
export const schoolOps: NavItem[] = [...schoolStudentLife, ...schoolCampusOps];

export const schoolFinance: NavItem[] = [
  { title: "Fee Structure", url: "/fee-structure", icon: Layers, module: "fee-structure" },
  { title: "Bursaries", url: "/bursaries", icon: HandCoins, module: "bursaries" },
  { title: "Fees & Payments", url: "/fees", icon: Wallet, module: "fees" },
  { title: "Accounting", url: "/accounting", icon: Calculator, module: "accounting" },
  { title: "Payroll", url: "/payroll", icon: Wallet, module: "accounting" },
  { title: "Procurement", url: "/procurement", icon: Receipt, module: "procurement" },
  { title: "Vendor Management", url: "/vendor-management", icon: Truck, module: "vendor-management" },
  { title: "Human Resources", url: "/hr", icon: Briefcase, module: "hr" },
  { title: "Staff Development", url: "/staff-development", icon: TrendingUp, module: "staff-development" },
  { title: "Duty Roster", url: "/duty-roster", icon: Shield, module: "duty-roster" },
];

export const schoolEnterprise: NavItem[] = [
  { title: "Enterprise Analytics", url: "/enterprise-analytics", icon: TrendingUp, module: "enterprise-analytics" },
  { title: "Security", url: "/security", icon: ShieldAlert, module: "security" },
  { title: "Compliance", url: "/compliance", icon: ClipboardList, module: "compliance" },
  { title: "Risk Register", url: "/risk-register", icon: ShieldCheck, module: "risk-register" },
  { title: "District Management", url: "/district-management", icon: Building2, module: "district-management" },
  { title: "Reporting", url: "/reporting", icon: BarChart3, module: "reporting" },
  { title: "Incident Management", url: "/incident-management", icon: AlertTriangle, module: "incident-management" },
  { title: "Policy Library", url: "/policy-library", icon: FileText, module: "policy-library" },
  { title: "Strategic Plan", url: "/strategic-plan", icon: Target, module: "strategic-plan" },
];

export const schoolAdmin: NavItem[] = [
  { title: "Users & Roles", url: "/access", icon: KeyRound, module: "access" },
  { title: "Audit Log", url: "/audit", icon: History, module: "settings" },
  { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
  { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
  { title: "Settings", url: "/settings", icon: Settings, module: "settings" },
];

export const platformCore: NavItem[] = [
  { title: "Platform Dashboard", url: "/", icon: LayoutDashboard, module: "platform-ops" },
  { title: "System Admin", url: "/sys-admin", icon: Building2, module: "platform-ops" },
  { title: "Platform Ops", url: "/platform-ops", icon: Activity, module: "platform-ops" },
  { title: "Tenant Lifecycle", url: "/tenant-lifecycle", icon: Wrench, module: "tenant-lifecycle" },
  { title: "Tenant Success", url: "/tenant-success", icon: TrendingUp, module: "tenant-success" },
  { title: "Tenant Workbench", url: "/tenant-workbench", icon: Building2, module: "tenant-workbench" },
];

export const platformBusiness: NavItem[] = [
  { title: "Contract Center", url: "/contract-center", icon: FileText, module: "contract-center" },
  { title: "Partner Management", url: "/partner-management", icon: Users2, module: "partner-management" },
  { title: "Approval Center", url: "/approval-center", icon: ClipboardCheck, module: "approval-center" },
  { title: "Support Desk", url: "/support-desk", icon: LifeBuoy, module: "support-desk" },
];

export const platformGov: NavItem[] = [
  { title: "Platform Config", url: "/platform-config", icon: FileCog, module: "platform-config" },
  { title: "Platform Audit", url: "/platform-audit", icon: History, module: "platform-audit" },
  { title: "Data Governance", url: "/data-governance", icon: HardDrive, module: "data-governance" },
  { title: "Status Center", url: "/status-center", icon: AlertTriangle, module: "status-center" },
  { title: "Developer Console", url: "/developer-console", icon: Plug, module: "developer-console" },
  { title: "Settings", url: "/settings", icon: Settings, module: "settings" },
];
