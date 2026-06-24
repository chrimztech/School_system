import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, CalendarCheck, ClipboardList, Wallet, MessageSquare,
  ShieldAlert, BarChart3, Settings, GraduationCap, UserCog, CalendarDays,
  BookOpen, Bus, FileText, Calendar, Check, Plus, ChevronsUpDown,
  Users2, School, BookMarked, History, KeyRound, Plug, HardDrive, CreditCard, LifeBuoy, Library,
  Calculator, HeartPulse, BedDouble, ClipboardCheck, Package, Briefcase, Award,
  Building2, AlertTriangle, Truck, TrendingUp, UserPlus, Wrench, Receipt, ShieldCheck, BookText,
  Heart, Layers, Shield, Trophy, ContactRound, HandCoins, UtensilsCrossed, Target, PackageSearch,
  Activity, FileCog, Globe, LogOut, Lock, Eye, EyeOff, Loader2,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; module: string };

// ── School nav (visible to school roles only) ─────────────────────────────────

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
  { title: "Integrations", url: "/integrations", icon: Plug, module: "settings" },
  { title: "Audit Log", url: "/audit", icon: History, module: "settings" },
  { title: "Backups & Data", url: "/backups", icon: HardDrive, module: "settings" },
  { title: "Billing", url: "/billing", icon: CreditCard, module: "settings" },
  { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
  { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
  { title: "Settings", url: "/settings", icon: Settings, module: "settings" },
];

// ── Platform nav (super admin only) ──────────────────────────────────────────

const platformCore: NavItem[] = [
  { title: "Platform Dashboard", url: "/", icon: LayoutDashboard, module: "platform-ops" },
  { title: "System Admin", url: "/sys-admin", icon: Building2, module: "platform-ops" },
  { title: "Platform Ops", url: "/platform-ops", icon: Activity, module: "platform-ops" },
  { title: "Tenant Lifecycle", url: "/tenant-lifecycle", icon: Wrench, module: "tenant-lifecycle" },
  { title: "Tenant Success", url: "/tenant-success", icon: TrendingUp, module: "tenant-success" },
  { title: "Tenant Workbench", url: "/tenant-workbench", icon: Building2, module: "tenant-workbench" },
];

const platformBusiness: NavItem[] = [
  { title: "Revenue Ops", url: "/revenue-ops", icon: CreditCard, module: "revenue-ops" },
  { title: "Plan Catalog", url: "/plan-catalog", icon: Layers, module: "plan-catalog" },
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

export function AppSidebar() {
  const path = useRouterState({ select: (router) => router.location.pathname });
  const { tenants, active, activePlan, setActive } = useTenant();
  const { can, isSystemAdmin, user } = useAuth();
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const renderGroup = (label: string, items: NavItem[]) => {
    const visible = items.filter((item) => can(item.module) !== false);
    if (visible.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visible.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)}>
                  <Link to={item.url} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {can(item.module) === "read" && (
                      <span className="ml-auto text-[9px] uppercase text-muted-foreground">read</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  if (isSystemAdmin) {
    return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-sidebar-accent">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white">
                  <Globe className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">SRMS Platform</p>
                  <p className="truncate text-xs text-sidebar-foreground/70">System Administration</p>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>View a school</DropdownMenuLabel>
              {tenants.map((tenant) => (
                <DropdownMenuItem key={tenant.id} onClick={() => setActive(tenant.id)} className="gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: tenant.primaryColor }}>
                    {tenant.shortCode.slice(0, 2)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{tenant.name}</p>
                    <p className="text-xs text-muted-foreground">{tenant.district} · {tenant.subscription.planId}</p>
                  </div>
                  {tenant.id === active.id && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/onboarding" className="gap-2">
                  <Plus className="h-4 w-4" />Onboard new school
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarHeader>

        <SidebarContent>
          {renderGroup("Platform", platformCore)}
          {renderGroup("Business", platformBusiness)}
          {renderGroup("Governance", platformGov)}
        </SidebarContent>

        <SidebarFooter>
          <div className="rounded-md bg-sidebar-accent px-3 py-2 text-xs text-sidebar-accent-foreground">
            <p className="font-medium">System Administrator</p>
            <p className="text-sidebar-foreground/70">{tenants.length} school{tenants.length !== 1 ? "s" : ""} on platform</p>
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  // ── School user sidebar ────────────────────────────────────────────────────
  const userTenants = tenants.filter((t) => t.id === (user?.tenantId ?? active.id));
  const schoolTenant = userTenants[0] ?? active;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex w-full items-center gap-3 rounded-md px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white" style={{ backgroundColor: schoolTenant.primaryColor }}>
            {schoolTenant.logoUrl
              ? <img src={schoolTenant.logoUrl} alt={schoolTenant.shortCode} className="h-full w-full object-contain" />
              : <GraduationCap className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{schoolTenant.shortCode}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{schoolTenant.name}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {user?.role === "parent"
          ? renderGroup("My Children", [
              { title: "Home", url: "/", icon: LayoutDashboard, module: "dashboard" },
              { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
              { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
              { title: "Report Card", url: "/report-card", icon: FileText, module: "report-card" },
              { title: "Fee Balance", url: "/fees", icon: Wallet, module: "fees" },
              { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
              { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
            ])
          : <>
              {renderGroup("Overview", schoolOverview)}
              {renderGroup("Operations", schoolOps)}
              {renderGroup("Finance", schoolFinance)}
              {renderGroup("Enterprise", schoolEnterprise)}
              {renderGroup("Administration", schoolAdmin)}
            </>
        }
      </SidebarContent>

      <SidebarFooter>
        <div className="rounded-md bg-sidebar-accent px-3 py-2 text-xs text-sidebar-accent-foreground mb-1">
          <p className="font-medium">Term {schoolTenant.currentTerm} · {schoolTenant.currentYear}</p>
          <p className="text-sidebar-foreground/70">{activePlan.name} plan · {schoolTenant.province}</p>
        </div>
        <UserFooter />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserFooter() {
  const { user, signOut } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const changePwMutation = useMutation({
    mutationFn: () => api.auth.changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setPwOpen(false);
      setCurrent(""); setNext(""); setConfirm("");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? "Failed to change password"),
  });

  const submit = () => {
    if (!current || !next || !confirm) return toast.error("All fields are required");
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("Passwords do not match");
    changePwMutation.mutate();
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition hover:bg-sidebar-accent">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {user.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{user.name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">{user.email}</p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56 mb-1">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{user.name}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPwOpen(true)} className="gap-2 cursor-pointer">
            <Lock className="h-4 w-4" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pwOpen} onOpenChange={(v) => { setPwOpen(v); if (!v) { setCurrent(""); setNext(""); setConfirm(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label className="text-xs">Current password</Label>
              <div className="relative mt-1">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">New password</Label>
              <div className="relative mt-1">
                <Input
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pr-9"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowNext(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Confirm new password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={changePwMutation.isPending}>
              {changePwMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
