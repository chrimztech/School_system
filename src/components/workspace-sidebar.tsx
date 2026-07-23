import { createContext, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

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
  PanelLeft,
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
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";

import { ROLE_META, useAuth } from "@/lib/auth";
import {
  type NavItem,
  platformBusiness,
  platformCore,
  platformGov,
  schoolAdmin,
  schoolCampusOps,
  schoolEnterprise,
  schoolFinance,
  schoolOverview,
  schoolStudentLife,
} from "@/lib/nav-items";
import { useTenant, isTenantModuleEnabled } from "@/lib/tenant";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

const sidebarBg = "#111821";
const sidebarFg = "#e8ebee";
const sidebarBorder = "rgba(255,255,255,0.08)";
const sidebarAccentBg = "rgba(255,255,255,0.06)";

function readCollapsedCookie(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(new RegExp(`${SIDEBAR_COOKIE_NAME}=(true|false)`));
  return match ? match[1] !== "true" : false;
}

type SidebarUIContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isMobile: boolean;
  toggle: () => void;
};

const SidebarUIContext = createContext<SidebarUIContextValue | null>(null);

export function useWorkspaceSidebarUI() {
  const ctx = useContext(SidebarUIContext);
  if (!ctx) throw new Error("useWorkspaceSidebarUI must be used within a WorkspaceSidebarProvider");
  return ctx;
}

export function WorkspaceSidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsedCookie());
  }, []);

  const toggle = () => {
    if (isMobile) {
      setMobileOpen((v) => !v);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      // Cookie stores "open" (expanded), inverse of collapsed, matching the old sidebar's semantics.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${!next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      return next;
    });
  };

  const value = useMemo<SidebarUIContextValue>(
    () => ({ collapsed: isMobile ? false : collapsed, mobileOpen, setMobileOpen, isMobile, toggle }),
    [collapsed, mobileOpen, isMobile],
  );

  return <SidebarUIContext.Provider value={value}>{children}</SidebarUIContext.Provider>;
}

export function SidebarToggleButton() {
  const { toggle } = useWorkspaceSidebarUI();
  return (
    <IconButton
      onClick={toggle}
      aria-label="Toggle sidebar"
      sx={{
        height: 36,
        width: 36,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha("#000", 0.02),
      }}
    >
      <PanelLeft size={16} />
    </IconButton>
  );
}

function TenantMark({
  color,
  logoUrl,
  fallbackIcon: FallbackIcon,
  collapsed,
}: {
  color: string;
  logoUrl?: string;
  fallbackIcon: ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  const size = collapsed ? 40 : 56;
  return (
    <Box
      sx={{
        display: "flex",
        height: size,
        width: size,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: collapsed ? 3 : 4,
        p: collapsed ? 0.5 : 0.75,
        color: "#fff",
        boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
        bgcolor: color,
      }}
    >
      {logoUrl ? (
        <Box component="img" src={logoUrl} alt="" sx={{ height: "100%", width: "100%", objectFit: "contain" }} />
      ) : (
        <FallbackIcon className={collapsed ? "h-5 w-5" : "h-7 w-7"} />
      )}
    </Box>
  );
}

function SidebarIdentityCard({
  title,
  subtitle,
  meta,
  chipLabel,
  icon,
  collapsed,
  onClick,
  accentColor,
}: {
  title: string;
  subtitle: string;
  meta: string;
  chipLabel?: string;
  icon: ReactNode;
  collapsed: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  accentColor: string;
}) {
  return (
    <Box
      component={onClick ? "button" : "div"}
      onClick={onClick}
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        width: "100%",
        textAlign: "left",
        border: "1px solid",
        borderColor: sidebarBorder,
        bgcolor: sidebarAccentBg,
        borderRadius: collapsed ? 3 : 4,
        p: collapsed ? 0.75 : 1.25,
        boxShadow: "0 12px 28px rgba(2,6,23,0.16)",
        cursor: onClick ? "pointer" : "default",
        color: "inherit",
        font: "inherit",
        transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
        "&:hover": onClick
          ? { borderColor: alpha(accentColor, 0.45), bgcolor: alpha(accentColor, 0.1), transform: "translateY(-1px)" }
          : undefined,
      }}
    >
      {icon}
      {!collapsed && (
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: sidebarFg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </Typography>
            {chipLabel && (
              <Chip size="small" label={chipLabel} sx={{ height: 18, fontSize: 10, bgcolor: alpha(accentColor, 0.18), color: accentColor, fontWeight: 700 }} />
            )}
            {onClick && <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0" color={alpha(sidebarFg, 0.4)} />}
          </Box>
          {!chipLabel && (
            <Typography sx={{ mt: 0.25, fontSize: 11.5, color: alpha(sidebarFg, 0.7), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {subtitle}
            </Typography>
          )}
          <Typography sx={{ mt: 0.5, fontSize: 11, lineHeight: 1.4, color: alpha(sidebarFg, 0.7) }}>{meta}</Typography>
        </Box>
      )}
    </Box>
  );
}

function NavGroup({
  label,
  items,
  collapsed,
  isActive,
  can,
  accentColor,
}: {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  isActive: (url: string) => boolean;
  can: (module: string) => boolean | "read";
  accentColor: string;
}) {
  const { active } = useTenant();
  const visible = items.filter((item) => can(item.module) !== false && isTenantModuleEnabled(active, item.module));
  if (visible.length === 0) return null;

  return (
    <List
      dense
      disablePadding
      sx={{ px: 1.25, py: 0.75 }}
      subheader={
        !collapsed ? (
          <ListSubheader
            component="div"
            sx={{
              bgcolor: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              lineHeight: "26px",
              pl: 1,
              pr: 0.5,
            }}
          >
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: alpha(sidebarFg, 0.4) }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: alpha(sidebarFg, 0.25) }}>{visible.length}</Typography>
          </ListSubheader>
        ) : undefined
      }
    >
      {visible.map((item) => {
        const activeItem = isActive(item.url);
        const accessLevel = can(item.module);
        const button = (
          <ListItemButton
            key={item.url}
            component={Link}
            to={item.url}
            sx={{
              position: "relative",
              borderRadius: 3,
              mb: 0.375,
              py: 0.875,
              justifyContent: collapsed ? "center" : "flex-start",
              color: activeItem ? sidebarFg : alpha(sidebarFg, 0.72),
              overflow: "hidden",
              transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
              "&:hover": { bgcolor: sidebarAccentBg, color: sidebarFg, transform: collapsed ? "none" : "translateX(2px)" },
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: "22%",
                bottom: "22%",
                width: 3,
                borderRadius: "0 4px 4px 0",
                bgcolor: accentColor,
                opacity: activeItem ? 1 : 0,
                transition: "opacity 160ms ease",
              },
              ...(activeItem && {
                bgcolor: alpha(accentColor, 0.14),
                fontWeight: 600,
                "&:hover": { bgcolor: alpha(accentColor, 0.18), color: sidebarFg },
              }),
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? "auto" : 34,
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2.5,
                color: activeItem ? accentColor : "inherit",
                bgcolor: activeItem ? alpha(accentColor, 0.16) : "transparent",
                transition: "background-color 160ms ease, color 160ms ease",
              }}
            >
              <item.icon className="h-4 w-4" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary={item.title}
                sx={{ ml: 0.5 }}
                slotProps={{ primary: { sx: { fontSize: 13.5, fontWeight: activeItem ? 600 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } } }}
              />
            )}
            {!collapsed && accessLevel === "read" && (
              <Chip label="R" size="small" sx={{ height: 18, minWidth: 18, fontSize: 9, bgcolor: sidebarAccentBg, color: alpha(sidebarFg, 0.75) }} />
            )}
          </ListItemButton>
        );
        return collapsed ? (
          <Tooltip key={item.url} title={item.title} placement="right" arrow>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </List>
  );
}

export function WorkspaceSidebar() {
  const path = useRouterState({ select: (router) => router.location.pathname });
  const { tenants, active, setActive } = useTenant();
  const { can, isSystemAdmin, user } = useAuth();
  const { collapsed, isMobile, mobileOpen, setMobileOpen } = useWorkspaceSidebarUI();
  const [tenantMenuAnchor, setTenantMenuAnchor] = useState<HTMLElement | null>(null);

  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));
  const accentColor = isSystemAdmin ? "#00c197" : active.primaryColor || "#00c197";

  const drawerBody = (isCollapsed: boolean) => (
    <Box sx={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", bgcolor: sidebarBg, color: sidebarFg, overflow: "hidden" }}>
      <Box
        sx={{
          pointerEvents: "none",
          position: "absolute",
          top: -80,
          left: -60,
          height: 220,
          width: 220,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(accentColor, 0.28)}, transparent 70%)`,
          filter: "blur(10px)",
        }}
      />
      <Box sx={{ position: "relative", p: isCollapsed ? 1 : 1.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
        {isSystemAdmin ? (
          <>
            <SidebarIdentityCard
              title="SRMS Platform"
              subtitle="System Admin"
              meta={`${tenants.length} schools in portfolio`}
              chipLabel="System Admin"
              collapsed={isCollapsed}
              accentColor={accentColor}
              onClick={(e) => setTenantMenuAnchor(e.currentTarget)}
              icon={
                <Box sx={{ display: "flex", height: 44, width: 44, alignItems: "center", justifyContent: "center", borderRadius: 3, bgcolor: alpha(accentColor, 0.2), color: accentColor }}>
                  <Globe className="h-5 w-5" />
                </Box>
              }
            />
            <Menu
              anchorEl={tenantMenuAnchor}
              open={Boolean(tenantMenuAnchor)}
              onClose={() => setTenantMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              <Typography variant="caption" sx={{ px: 2, py: 1, display: "block", color: "text.secondary" }}>
                Switch tenant context
              </Typography>
              <Divider />
              {tenants.map((tenant) => (
                <MenuItem
                  key={tenant.id}
                  onClick={() => {
                    setActive(tenant.id);
                    setTenantMenuAnchor(null);
                  }}
                  sx={{ gap: 1.5, py: 1 }}
                >
                  <Box sx={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 2, fontSize: 10, fontWeight: 700, color: "#fff", bgcolor: tenant.primaryColor }}>
                    {tenant.shortCode.slice(0, 2)}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tenant.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{tenant.district}</Typography>
                  </Box>
                  {tenant.id === active.id && <Check className="h-4 w-4" />}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem component={Link} to="/onboarding" onClick={() => setTenantMenuAnchor(null)} sx={{ gap: 1.5 }}>
                <Plus className="h-4 w-4" />
                Onboard new school
              </MenuItem>
            </Menu>
          </>
        ) : (
          (() => {
            const schoolTenant = tenants.find((t) => t.id === (user?.tenantId ?? active.id)) ?? active;
            return (
              <>
                <SidebarIdentityCard
                  title={schoolTenant.name}
                  subtitle={schoolTenant.shortCode}
                  meta={`${schoolTenant.district}, ${schoolTenant.province} · ${schoolTenant.totalStudents.toLocaleString()} learners`}
                  collapsed={isCollapsed}
                  accentColor={accentColor}
                  icon={
                    <TenantMark
                      color={schoolTenant.primaryColor}
                      logoUrl={schoolTenant.logoUrl}
                      fallbackIcon={GraduationCap}
                      collapsed={isCollapsed}
                    />
                  }
                />
                {!isCollapsed && (
                  <Chip
                    size="small"
                    label={`Term ${schoolTenant.currentTerm}`}
                    sx={{ alignSelf: "flex-start", height: 20, fontSize: 10.5, bgcolor: alpha(accentColor, 0.14), border: "1px solid", borderColor: alpha(accentColor, 0.3), color: accentColor, fontWeight: 600 }}
                  />
                )}
              </>
            );
          })()
        )}
      </Box>

      <Divider sx={{ borderColor: sidebarBorder }} />

      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          py: 0.5,
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-track": { background: "transparent" },
          "&::-webkit-scrollbar-thumb": { background: alpha(sidebarFg, 0.12), borderRadius: 999 },
          "&::-webkit-scrollbar-thumb:hover": { background: alpha(sidebarFg, 0.2) },
        }}
      >
        {isSystemAdmin ? (
          <>
            <NavGroup label="Platform" items={platformCore} collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} />
            <NavGroup label="Business" items={platformBusiness} collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} />
            <NavGroup label="Governance" items={platformGov} collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} />
          </>
        ) : user?.role === "parent" ? (
          <NavGroup
            label="My Children"
            collapsed={isCollapsed}
            isActive={isActive}
            can={can} accentColor={accentColor}
            items={[
              { title: "Home", url: "/", icon: LayoutDashboard, module: "dashboard" },
              { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
              { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
              { title: "Report Card", url: "/report-card", icon: FileText, module: "report-card" },
              { title: "Fee Balance", url: "/fees", icon: Wallet, module: "fees" },
              { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
              { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
              { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
            ]}
          />
        ) : user?.role === "hod" ? (
          <>
            <NavGroup
              label="My Department"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
                { title: "Departments", url: "/departments", icon: Building2, module: "assessments" },
                { title: "Classes", url: "/classes", icon: School, module: "students" },
                { title: "Timetable", url: "/timetable", icon: CalendarDays, module: "timetable" },
                { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
              ]}
            />
            <NavGroup
              label="Teaching Records"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Teachers", url: "/teachers", icon: UserCog, module: "teachers" },
                { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
                { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
                { title: "Examinations", url: "/exams", icon: ClipboardCheck, module: "assessments" },
                { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
              ]}
            />
            <NavGroup
              label="Students"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Students", url: "/students", icon: Users, module: "students" },
                { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
                { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
              ]}
            />
            <NavGroup
              label="Resources"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
                { title: "Library", url: "/library", icon: BookOpen, module: "library" },
                { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
                { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
                { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
              ]}
            />
          </>
        ) : user?.role === "teacher" ? (
          <>
            <NavGroup
              label="My Workspace"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
                { title: "Timetable", url: "/timetable", icon: CalendarDays, module: "timetable" },
                { title: "Attendance", url: "/attendance", icon: CalendarCheck, module: "attendance" },
                { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
                { title: "Examinations", url: "/exams", icon: ClipboardCheck, module: "assessments" },
                { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
                { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
              ]}
            />
            <NavGroup
              label="Students"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Students", url: "/students", icon: Users, module: "students" },
                { title: "Classes", url: "/classes", icon: School, module: "students" },
                { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
                { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
                { title: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
                { title: "Lost & Found", url: "/lost-found", icon: PackageSearch, module: "lost-found" },
              ]}
            />
            <NavGroup
              label="Resources"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
                { title: "Library", url: "/library", icon: BookOpen, module: "library" },
                { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
                { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
                { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
              ]}
            />
          </>
        ) : user?.role === "finance" ? (
          <>
            <NavGroup label="Overview" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={[{ title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" }]} />
            <NavGroup label="Finance" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolFinance} />
            <NavGroup
              label="Reports"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Enterprise Analytics", url: "/enterprise-analytics", icon: TrendingUp, module: "enterprise-analytics" },
                { title: "Reporting", url: "/reporting", icon: BarChart3, module: "reporting" },
                { title: "Risk Register", url: "/risk-register", icon: ShieldCheck, module: "risk-register" },
              ]}
            />
            <NavGroup
              label="Resources"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "PTC Committee", url: "/ptc", icon: Users2, module: "ptc" },
                { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
                { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
              ]}
            />
          </>
        ) : user?.role === "career_guidance" ? (
          <>
            <NavGroup
              label="Careers Guidance"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Dashboard", url: "/", icon: LayoutDashboard, module: "dashboard" },
                { title: "Students", url: "/students", icon: Users, module: "students" },
                { title: "Assessments", url: "/assessments", icon: ClipboardList, module: "assessments" },
                { title: "Report Cards", url: "/report-card", icon: FileText, module: "report-card" },
                { title: "Calendar", url: "/calendar", icon: Calendar, module: "calendar" },
              ]}
            />
            <NavGroup
              label="Student Support"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Student Welfare", url: "/student-welfare", icon: Heart, module: "student-welfare" },
                { title: "Discipline", url: "/discipline", icon: ShieldAlert, module: "discipline" },
                { title: "Activities & Clubs", url: "/activities", icon: Trophy, module: "activities" },
              ]}
            />
            <NavGroup
              label="Resources"
              collapsed={isCollapsed}
              isActive={isActive}
              can={can} accentColor={accentColor}
              items={[
                { title: "Communication", url: "/communication", icon: MessageSquare, module: "communication" },
                { title: "Knowledge Base", url: "/knowledge-base", icon: BookText, module: "dashboard" },
                { title: "Help & Support", url: "/help", icon: LifeBuoy, module: "dashboard" },
              ]}
            />
          </>
        ) : (
          <>
            <NavGroup label="Overview" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolOverview} />
            <NavGroup label="Student Life" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolStudentLife} />
            <NavGroup label="Campus Operations" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolCampusOps} />
            <NavGroup label="Finance" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolFinance} />
            <NavGroup label="Enterprise" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolEnterprise} />
            <NavGroup label="Administration" collapsed={isCollapsed} isActive={isActive} can={can} accentColor={accentColor} items={schoolAdmin} />
          </>
        )}
      </Box>

      <Divider sx={{ borderColor: sidebarBorder }} />

      <Box sx={{ p: isCollapsed ? 1 : 1.5 }}>
        <Box
          component={Link}
          to="/profile"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            borderRadius: isCollapsed ? 3 : 4,
            border: "1px solid",
            borderColor: sidebarBorder,
            bgcolor: sidebarAccentBg,
            p: isCollapsed ? 0.75 : 1.25,
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 160ms ease, background-color 160ms ease",
            "&:hover": { borderColor: alpha(accentColor, 0.4), bgcolor: alpha(accentColor, 0.1) },
          }}
        >
          <Box
            sx={{
              display: "flex",
              height: 36,
              width: 36,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 3,
              bgcolor: alpha(accentColor, 0.2),
              color: accentColor,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {isSystemAdmin ? <Globe className="h-4 w-4" /> : user?.initials ?? "SR"}
          </Box>
          {!isCollapsed && (
            <>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: sidebarFg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isSystemAdmin ? "Portfolio control" : user?.name ?? "School user"}
                </Typography>
                <Typography sx={{ fontSize: 11, color: alpha(sidebarFg, 0.7), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isSystemAdmin
                    ? `${tenants.length} school${tenants.length === 1 ? "" : "s"} connected`
                    : (user ? ROLE_META[user.role].label : "Workspace access")}
                </Typography>
              </Box>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" color={alpha(sidebarFg, 0.35)} />
            </>
          )}
        </Box>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        slotProps={{ paper: { sx: { width: 288, border: "none", bgcolor: sidebarBg } } }}
      >
        {drawerBody(false)}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
        flexShrink: 0,
        transition: "width 200ms ease",
        "& .MuiDrawer-paper": {
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH,
          position: "relative",
          border: "none",
          overflowX: "hidden",
          bgcolor: sidebarBg,
          boxShadow: "4px 0 24px rgba(2,6,23,0.12)",
          transition: "width 200ms ease",
        },
      }}
    >
      {drawerBody(collapsed)}
    </Drawer>
  );
}
