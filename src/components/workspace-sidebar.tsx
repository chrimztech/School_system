import type { ComponentType, JSX } from "react";

import { Link, useRouterState } from "@tanstack/react-router";
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
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  FileCog,
  FileText,
  Globe,
  GraduationCap,
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
  Plus,
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
  UserPlus,
  Users,
  Users2,
  UtensilsCrossed,
  Wallet,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { ROLE_META, useAuth } from "@/lib/auth";
import { useTenant, isTenantModuleEnabled } from "@/lib/tenant";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  module: string;
};

const schoolOverview: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
  { title: "Students", url: "/students", icon: Users, module: "students" },
  { title: "Admissions", url: "/admissions", icon: UserPlus, module: "admissions" },
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

const schoolOps: NavItem[] = [
  { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
  { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
  { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
  { title: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
  { title: "Library", url: "/library", icon: BookOpen, module: "library" },
  { title: "Transport", url: "/transport", icon: Bus, module: "transport" },
  { title: "Health & Clinic", url: "/health", icon: HeartPulse, module: "health" },
  { title: "Hostel & Boarding", url: "/hostel", icon: BedDouble, module: "hostel" },
  { title: "Inventory", url: "/inventory", icon: Package, module: "inventory" },
  { title: "Canteen", url: "/canteen", icon: UtensilsCrossed, module: "canteen" },
  { title: "Facilities", url: "/facilities", icon: Wrench, module: "facilities" },
  { title: "Visitor Log", url: "/visitor-log", icon: ContactRound, module: "visitor-log" },
  { title: "Lost & Found", url: "/lost-found", icon: PackageSearch, module: "lost-found" },
  { title: "Alumni", url: "/alumni", icon: Award, module: "alumni" },
  { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
  { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
];

const schoolFinance: NavItem[] = [
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

const schoolEnterprise: NavItem[] = [
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

const schoolAdmin: NavItem[] = [
  { title: "Users & Roles", url: "/access", icon: KeyRound, module: "access" },
  { title: "Audit Log", url: "/audit", icon: History, module: "settings" },
  { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
  { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
  { title: "Settings", url: "/settings", icon: Settings, module: "settings" },
];

const platformCore: NavItem[] = [
  { title: "Platform Dashboard", url: "/", icon: LayoutDashboard, module: "platform-ops" },
  { title: "System Admin", url: "/sys-admin", icon: Building2, module: "platform-ops" },
  { title: "Platform Ops", url: "/platform-ops", icon: Activity, module: "platform-ops" },
  { title: "Tenant Lifecycle", url: "/tenant-lifecycle", icon: Wrench, module: "tenant-lifecycle" },
  { title: "Tenant Success", url: "/tenant-success", icon: TrendingUp, module: "tenant-success" },
  { title: "Tenant Workbench", url: "/tenant-workbench", icon: Building2, module: "tenant-workbench" },
];

const platformBusiness: NavItem[] = [
  // { title: "Revenue Ops", url: "/revenue-ops", icon: CreditCard, module: "revenue-ops" }, // hidden
  // { title: "Plan Catalog", url: "/plan-catalog", icon: Layers, module: "plan-catalog" }, // hidden
  { title: "Contract Center", url: "/contract-center", icon: FileText, module: "contract-center" },
  { title: "Partner Management", url: "/partner-management", icon: Users2, module: "partner-management" },
  { title: "Approval Center", url: "/approval-center", icon: ClipboardCheck, module: "approval-center" },
  { title: "Support Desk", url: "/support-desk", icon: LifeBuoy, module: "support-desk" },
];

const platformGov: NavItem[] = [
  { title: "Platform Config", url: "/platform-config", icon: FileCog, module: "platform-config" },
  { title: "Platform Audit", url: "/platform-audit", icon: History, module: "platform-audit" },
  { title: "Data Governance", url: "/data-governance", icon: HardDrive, module: "data-governance" },
  { title: "Status Center", url: "/status-center", icon: AlertTriangle, module: "status-center" },
  { title: "Developer Console", url: "/developer-console", icon: Plug, module: "developer-console" },
  { title: "Settings", url: "/settings", icon: Settings, module: "settings" },
];

function TenantMark({
  label,
  color,
  logoUrl,
  fallbackIcon,
}: {
  label: string;
  color: string;
  logoUrl?: string;
  fallbackIcon: ComponentType<{ className?: string }>;
}) {
  const FallbackIcon = fallbackIcon;

  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] p-1.5 text-white shadow-[0_12px_28px_rgb(15_23_42/0.18)] group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-1"
      style={{ backgroundColor: color }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={label} className="h-full w-full object-contain" />
      ) : (
        <FallbackIcon className="h-7 w-7 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
      )}
    </div>
  );
}

function SidebarIdentityCard({
  title,
  subtitle,
  meta,
  tone,
  icon,
  dropdown,
}: {
  title: string;
  subtitle: string;
  meta: string;
  tone?: string;
  icon: JSX.Element;
  dropdown?: JSX.Element;
}) {
  return (
    <div className="rounded-[24px] border border-sidebar-border/70 bg-sidebar-accent/40 p-2.5 shadow-[0_12px_28px_rgb(2_6_23/0.16)] group-data-[collapsible=icon]:rounded-[20px] group-data-[collapsible=icon]:p-1.5">
      <div className="flex items-start gap-2.5">
        {icon}
        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{title}</p>
            {tone ? (
              <Badge className={cn("border-transparent px-2 py-0.5 text-[10px]", tone)}>{subtitle}</Badge>
            ) : null}
          </div>
          {!tone ? <p className="mt-1 truncate text-xs text-sidebar-foreground/70">{subtitle}</p> : null}
          <p className="mt-1.5 text-xs leading-5 text-sidebar-foreground/70">{meta}</p>
        </div>
        {dropdown ? <div className="shrink-0 group-data-[collapsible=icon]:hidden">{dropdown}</div> : null}
      </div>
    </div>
  );
}

export function WorkspaceSidebar() {
  const path = useRouterState({ select: (router) => router.location.pathname });
  const { tenants, active, setActive } = useTenant();
  const { can, isSystemAdmin, user } = useAuth();

  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((item) => can(item.module) !== false && isTenantModuleEnabled(active, item.module));
    if (visible.length === 0) return null;

    return (
      <SidebarGroup>
        <div className="flex items-center justify-between">
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <span className="pr-1 text-[10px] font-semibold text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden">
            {visible.length}
          </span>
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sidebar/60 text-sidebar-foreground/70">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {can(item.module) === "read" ? <SidebarMenuBadge>R</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  if (isSystemAdmin) {
    return (
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-left outline-none">
                <SidebarIdentityCard
                  title="SRMS Platform"
                  subtitle="System Admin"
                  meta={`${tenants.length} schools in portfolio`}
                  tone={ROLE_META.super_admin.tone}
                  icon={
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sidebar-primary/20 text-sidebar-primary shadow-[0_12px_28px_rgb(2_6_23/0.16)]">
                      <Globe className="h-5 w-5" />
                    </div>
                  }
                  dropdown={<ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/60" />}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>Switch tenant context</DropdownMenuLabel>
              {tenants.map((tenant) => (
                <DropdownMenuItem key={tenant.id} onClick={() => setActive(tenant.id)} className="gap-3 py-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                    style={{ backgroundColor: tenant.primaryColor }}
                  >
                    {tenant.shortCode.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{tenant.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tenant.district}
                    </p>
                  </div>
                  {tenant.id === active.id ? <Check className="h-4 w-4" /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/onboarding" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Onboard new school
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          {renderGroup("Platform", platformCore)}
          {renderGroup("Business", platformBusiness)}
          {renderGroup("Governance", platformGov)}
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter>
          <div className="rounded-[22px] border border-sidebar-border/70 bg-sidebar-accent/40 p-3 shadow-[0_12px_28px_rgb(2_6_23/0.16)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar-primary/20 text-sidebar-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">Portfolio control</p>
                <p className="truncate text-xs text-sidebar-foreground/70">
                  {tenants.length} school{tenants.length === 1 ? "" : "s"} connected
                </p>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  const schoolTenant = tenants.find((tenant) => tenant.id === (user?.tenantId ?? active.id)) ?? active;
  const userRole = user ? ROLE_META[user.role] : null;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarIdentityCard
          title={schoolTenant.name}
          subtitle={schoolTenant.shortCode}
          meta={`${schoolTenant.district}, ${schoolTenant.province} · ${schoolTenant.totalStudents.toLocaleString()} learners`}
          icon={
            <TenantMark
              label={schoolTenant.shortCode}
              color={schoolTenant.primaryColor}
              logoUrl={schoolTenant.logoUrl}
              fallbackIcon={GraduationCap}
            />
          }
        />
        <div className="flex flex-wrap gap-1.5 px-1 group-data-[collapsible=icon]:hidden">
          <Badge variant="outline">Term {schoolTenant.currentTerm}</Badge>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {user?.role === "parent" ? (
          renderGroup("My Children", [
            { title: "Home", url: "/", icon: LayoutDashboard, module: "dashboard" },
            { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
            { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
            { title: "Report Card", url: "/report-card", icon: FileText, module: "report-card" },
            { title: "Fee Balance", url: "/fees", icon: Wallet, module: "fees" },
            { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
            { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
            { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
          ])
        ) : user?.role === "hod" ? (
          <>
            {renderGroup("My Department", [
              { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
              { title: "Departments", url: "/departments", icon: Building2, module: "assessments" },
              { title: "Classes", url: "/classes", icon: School, module: "students" },
              { title: "Timetable", url: "/timetable", icon: CalendarDays, module: "timetable" },
              { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
            ])}
            {renderGroup("Teaching Records", [
              { title: "Teachers", url: "/teachers", icon: UserCog, module: "teachers" },
              { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
              { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
              { title: "Examinations", url: "/exams", icon: ClipboardCheck, module: "assessments" },
              { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
            ])}
            {renderGroup("Students", [
              { title: "Students", url: "/students", icon: Users, module: "students" },
              { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
              { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
            ])}
            {renderGroup("Resources", [
              { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
              { title: "Library", url: "/library", icon: BookOpen, module: "library" },
              { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
              { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
              { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
            ])}
          </>
        ) : user?.role === "teacher" ? (
          <>
            {renderGroup("My Workspace", [
              { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
              { title: "Timetable", url: "/timetable", icon: CalendarDays, module: "timetable" },
              { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
              { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
              { title: "Examinations", url: "/exams", icon: ClipboardCheck, module: "assessments" },
              { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
              { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
            ])}
            {renderGroup("Students", [
              { title: "Students", url: "/students", icon: Users, module: "students" },
              { title: "Classes", url: "/classes", icon: School, module: "students" },
              { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
              { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
              { title: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
              { title: "Lost & Found", url: "/lost-found", icon: PackageSearch, module: "lost-found" },
            ])}
            {renderGroup("Resources", [
              { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
              { title: "Library", url: "/library", icon: BookOpen, module: "library" },
              { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
              { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
              { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
            ])}
          </>
        ) : user?.role === "finance" ? (
          <>
            {renderGroup("Overview", [
              { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
            ])}
            {renderGroup("Finance", schoolFinance)}
            {renderGroup("Reports", [
              { title: "Enterprise Analytics", url: "/enterprise-analytics", icon: TrendingUp, module: "enterprise-analytics" },
              { title: "Reporting", url: "/reporting", icon: BarChart3, module: "reporting" },
              { title: "Risk Register", url: "/risk-register", icon: ShieldCheck, module: "risk-register" },
            ])}
            {renderGroup("Resources", [
              { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
              { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
              { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
            ])}
          </>
        ) : user?.role === "career_guidance" ? (
          <>
            {renderGroup("My Guidance Workspace", [
              { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
              { title: "Students", url: "/students", icon: Users, module: "students" },
              { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
              { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
              { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
            ])}
            {renderGroup("Student Support", [
              { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
              { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
              { title: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
            ])}
            {renderGroup("Resources", [
              { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
              { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
              { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
            ])}
          </>
        ) : (
          <>
            {renderGroup("Overview", schoolOverview)}
            {renderGroup("Operations", schoolOps)}
            {renderGroup("Finance", schoolFinance)}
            {renderGroup("Enterprise", schoolEnterprise)}
            {renderGroup("Administration", schoolAdmin)}
          </>
        )}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <div className="rounded-[22px] border border-sidebar-border/70 bg-sidebar-accent/40 p-3 shadow-[0_12px_28px_rgb(2_6_23/0.16)]">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary"
              aria-hidden="true"
            >
              {user?.initials ?? "SR"}
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{user?.name ?? "School user"}</p>
              <p className="truncate text-xs text-sidebar-foreground/70">{userRole?.label ?? "Workspace access"}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 group-data-[collapsible=icon]:hidden">
            <Badge className={cn("border-transparent px-2 py-0.5 text-[10px]", userRole?.tone)}>{userRole?.label ?? "User"}</Badge>
            <Badge variant="outline">{schoolTenant.currentYear}</Badge>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
