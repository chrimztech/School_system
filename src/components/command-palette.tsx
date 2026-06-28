import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Users2, UserCog, School, BookMarked, CalendarDays,
  CalendarCheck, ClipboardList, FileText, Wallet, MessageSquare, ShieldAlert,
  BookOpen, Bus, Calendar, BarChart3, KeyRound, History, Settings, Plug,
  HardDrive, LifeBuoy, CreditCard, UserCircle, Plus, Bell, UserPlus, Wrench, Receipt, ShieldCheck, BookText,
  Library, ClipboardCheck, HeartPulse, BedDouble, Package, Award, Calculator,
  Briefcase, TrendingUp, Building2, AlertTriangle, Heart, Layers, Shield, Trophy,
  ContactRound, HandCoins, Truck, UtensilsCrossed, Target, PackageSearch,
  Activity, FileCog,
} from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem,
  CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Item = { label: string; url: string; icon: React.ComponentType<{ className?: string }>; module?: string; shortcut?: string };

const core: Item[] = [
  { label: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard", shortcut: "G D" },
  { label: "Students", url: "/students", icon: Users, module: "students", shortcut: "G S" },
  { label: "Admissions", url: "/admissions", icon: UserPlus, module: "admissions" },
  { label: "Parents", url: "/parents", icon: Users2, module: "communication" },
  { label: "Teachers", url: "/teachers", icon: UserCog, module: "teachers" },
  { label: "Classes", url: "/classes", icon: School, module: "students" },
  { label: "Subjects", url: "/subjects", icon: BookMarked, module: "assessments" },
  { label: "Curriculum", url: "/curriculum", icon: Library, module: "assessments" },
  { label: "Timetable", url: "/timetable", icon: CalendarDays, module: "timetable" },
  { label: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
  { label: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
  { label: "Examinations", url: "/exams", icon: ClipboardCheck, module: "assessments" },
  { label: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
];

const operations: Item[] = [
  { label: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
  { label: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
  { label: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
  { label: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
  { label: "Library", url: "/library", icon: BookOpen, module: "library" },
  { label: "Transport", url: "/transport", icon: Bus, module: "transport" },
  { label: "Health & Clinic", url: "/health", icon: HeartPulse, module: "health" },
  { label: "Hostel & Boarding", url: "/hostel", icon: BedDouble, module: "hostel" },
  { label: "Inventory", url: "/inventory", icon: Package, module: "inventory" },
  { label: "Canteen", url: "/canteen", icon: UtensilsCrossed, module: "canteen" },
  { label: "Facilities", url: "/facilities", icon: Wrench, module: "facilities" },
  { label: "Visitor Log", url: "/visitor-log", icon: ContactRound, module: "visitor-log" },
  { label: "Lost & Found", url: "/lost-found", icon: PackageSearch, module: "lost-found" },
  { label: "Alumni", url: "/alumni", icon: Award, module: "alumni" },
  { label: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
];

const financeAndEnterprise: Item[] = [
  { label: "Fee Structure", url: "/fee-structure", icon: Layers, module: "fee-structure" },
  { label: "Bursaries", url: "/bursaries", icon: HandCoins, module: "bursaries" },
  { label: "Fees & Payments", url: "/fees", icon: Wallet, module: "fees" },
  { label: "Accounting", url: "/accounting", icon: Calculator, module: "accounting" },
  { label: "Payroll", url: "/payroll", icon: Wallet, module: "accounting" },
  { label: "Procurement", url: "/procurement", icon: Receipt, module: "procurement" },
  { label: "Vendor Management", url: "/vendor-management", icon: Truck, module: "vendor-management" },
  { label: "Human Resources", url: "/hr", icon: Briefcase, module: "hr" },
  { label: "Staff Development", url: "/staff-development", icon: TrendingUp, module: "staff-development" },
  { label: "Duty Roster", url: "/duty-roster", icon: Shield, module: "duty-roster" },
  { label: "Enterprise Analytics", url: "/enterprise-analytics", icon: TrendingUp, module: "enterprise-analytics" },
  { label: "Security", url: "/security", icon: ShieldAlert, module: "security" },
  { label: "Compliance", url: "/compliance", icon: ClipboardList, module: "compliance" },
  { label: "Risk Register", url: "/risk-register", icon: ShieldCheck, module: "risk-register" },
  { label: "District Management", url: "/district-management", icon: Building2, module: "district-management" },
  { label: "Reporting", url: "/reporting", icon: BarChart3, module: "reporting" },
  { label: "Incident Management", url: "/incident-management", icon: AlertTriangle, module: "incident-management" },
  { label: "User Management", url: "/user-management", icon: UserCog, module: "user-management" },
  { label: "Policy Library", url: "/policy-library", icon: FileText, module: "policy-library" },
  { label: "Strategic Plan", url: "/strategic-plan", icon: Target, module: "strategic-plan" },
];

const admin: Item[] = [
  { label: "Reports", url: "/reports", icon: BarChart3, module: "reports" },
  { label: "Access Control", url: "/access", icon: KeyRound, module: "access" },
  { label: "System Admin", url: "/sys-admin", icon: Building2, module: "onboarding" },
  { label: "Platform Ops", url: "/platform-ops", icon: Activity, module: "platform-ops" },
  { label: "Platform Config", url: "/platform-config", icon: FileCog, module: "platform-config" },
  { label: "Platform Audit", url: "/platform-audit", icon: History, module: "platform-audit" },
  { label: "Approval Center", url: "/approval-center", icon: ClipboardCheck, module: "approval-center" },
  { label: "Developer Console", url: "/developer-console", icon: Plug, module: "developer-console" },
  { label: "Tenant Workbench", url: "/tenant-workbench", icon: Building2, module: "tenant-workbench" },
  { label: "Tenant Lifecycle", url: "/tenant-lifecycle", icon: Wrench, module: "tenant-lifecycle" },
  { label: "Tenant Success", url: "/tenant-success", icon: TrendingUp, module: "tenant-success" },
  // { label: "Revenue Ops", url: "/revenue-ops", icon: CreditCard, module: "revenue-ops" }, // hidden
  { label: "Data Governance", url: "/data-governance", icon: HardDrive, module: "data-governance" },
  { label: "Partner Management", url: "/partner-management", icon: Users2, module: "partner-management" },
  { label: "Contract Center", url: "/contract-center", icon: FileText, module: "contract-center" },
  { label: "Status Center", url: "/status-center", icon: AlertTriangle, module: "status-center" },
  // { label: "Plan Catalog", url: "/plan-catalog", icon: Layers, module: "plan-catalog" }, // hidden
  { label: "Support Desk", url: "/support-desk", icon: LifeBuoy, module: "support-desk" },
  { label: "Audit Log", url: "/audit", icon: History, module: "settings" },
  // { label: "Integrations", url: "/integrations", icon: Plug, module: "settings" }, // sys-admin only
  // { label: "Backups & Data", url: "/backups", icon: HardDrive, module: "settings" }, // sys-admin only
  // { label: "Billing", url: "/billing", icon: CreditCard, module: "settings" }, // hidden
  { label: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
  { label: "Notifications", url: "/notifications", icon: Bell },
  { label: "Profile", url: "/profile", icon: UserCircle },
  { label: "Help & Support", url: "/help", icon: LifeBuoy },
  { label: "Settings", url: "/settings", icon: Settings, module: "settings" },
];

const quick: Item[] = [
  { label: "Onboard new school", url: "/onboarding", icon: Plus, module: "onboarding" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { can } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (url: string) => {
    setOpen(false);
    navigate({ to: url });
  };

  const allowed = (i: Item) => !i.module || can(i.module) !== false;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, students, actions…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Core">
          {core.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.label}
              {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Operations">
          {operations.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.label}
              {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Finance & Enterprise">
          {financeAndEnterprise.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.label}
              {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Administration">
          {admin.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          {quick.filter(allowed).map((i) => (
            <CommandItem key={i.url} onSelect={() => go(i.url)}>
              <i.icon className="mr-2 h-4 w-4" />{i.label}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => { setOpen(false); toast.success("Export queued — you'll be emailed when ready"); }}>
            <FileText className="mr-2 h-4 w-4" />Export school data
          </CommandItem>
          <CommandItem onSelect={() => { setOpen(false); toast.info("Broadcast composer opened"); navigate({ to: "/communication", hash: "broadcast" }); }}>
            <MessageSquare className="mr-2 h-4 w-4" />Send broadcast
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
