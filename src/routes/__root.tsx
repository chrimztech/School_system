import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, LogOut, UserCircle, Command as CommandIcon, AlertTriangle, Clock, Lock } from "lucide-react";
import { ThemeProvider, CssBaseline, Chip, Menu, MenuItem, ListItemIcon, Divider, Box, Typography } from "@mui/material";

import appCss from "../styles.css?url";
import { theme } from "@/theme";
import { TenantProvider, useTenant, type Tenant } from "@/lib/tenant";
import { AuthProvider, useAuth, ROLE_META } from "@/lib/auth";
import { badgeSx } from "@/lib/utils";
import { NotificationProvider } from "@/lib/notifications";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { WorkspaceSidebar, WorkspaceSidebarProvider, SidebarToggleButton } from "@/components/workspace-sidebar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card-strong max-w-md rounded-[28px] p-8 text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card-strong max-w-md rounded-[28px] p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SRMS — School Records Management System" },
      { name: "description", content: "Configurable school management for Zambian institutions: enrolment, attendance, assessments, fees, and parental communication." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  if (!user) {
    return (
      <Link to="/login" className="text-sm font-medium text-primary hover:underline">Sign in</Link>
    );
  }
  const closeMenu = () => setAnchorEl(null);
  return (
    <>
      <button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-2.5 py-2 shadow-sm transition hover:border-primary/20 hover:bg-card"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm">{user.initials}</div>
        <div className="hidden text-left sm:block">
          <p className="text-xs font-semibold leading-tight text-foreground">{user.name}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{ROLE_META[user.role].label}</p>
        </div>
      </button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2">{user.name}</Typography>
          <Typography variant="caption" color="text.secondary">{user.email ?? user.phone}</Typography>
        </Box>
        <Divider />
        <MenuItem component={Link} to="/profile" onClick={closeMenu}>
          <ListItemIcon><UserCircle className="h-4 w-4" /></ListItemIcon>My profile
        </MenuItem>
        <MenuItem component={Link} to="/notifications" onClick={closeMenu}>
          <ListItemIcon><UserCircle className="h-4 w-4" /></ListItemIcon>Notifications
        </MenuItem>
        <MenuItem component={Link} to="/help" onClick={closeMenu}>
          <ListItemIcon><UserCircle className="h-4 w-4" /></ListItemIcon>Help & support
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { closeMenu(); signOut(); }}>
          <ListItemIcon><LogOut className="h-4 w-4" /></ListItemIcon>Sign out
        </MenuItem>
      </Menu>
    </>
  );
}

function GlobalSearchButton() {
  const trigger = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
  };
  return (
    <button
      onClick={trigger}
      className="relative hidden h-11 max-w-xl flex-1 items-center gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 text-sm text-muted-foreground shadow-sm transition hover:border-primary/20 hover:bg-card md:flex"
    >
      <Search className="h-4 w-4" />
      <span>Search students, staff, pages…</span>
      <kbd className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-border/80 bg-background/90 px-2 py-1 text-[10px] font-semibold shadow-sm">
        <CommandIcon className="h-3 w-3" />K
      </kbd>
    </button>
  );
}

function SuspensionWall({ tenant }: { tenant: Tenant }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="surface-card-strong w-full max-w-md rounded-[30px] p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <div className="mt-6">
          <h1 className="text-2xl font-bold">Account Suspended</h1>
          <p className="mt-2 text-muted-foreground">
            Access to <strong>{tenant.name}</strong> has been suspended. Please contact
            the SRMS platform team to resolve the issue and restore access.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border border-border/70 bg-card/70 p-4 text-left text-sm shadow-sm">
          <p className="font-semibold">SRMS Platform Support</p>
          <p className="text-muted-foreground">support@srms.zm · +260 211 000 000</p>
          <p className="pt-1 text-xs text-muted-foreground">
            Account: {tenant.shortCode} · Renewal was {tenant.subscription.renewalDate}
          </p>
        </div>
        <button
          onClick={signOut}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />Sign out
        </button>
      </div>
    </div>
  );
}

function SubscriptionBanner({ tenant }: { tenant: Tenant }) {
  const sub = tenant.subscription;
  const learnerPct = sub.learnerLimit > 0 ? (tenant.totalStudents / sub.learnerLimit) * 100 : 0;
  const smsPct = sub.smsQuota > 0 ? (sub.smsUsed / sub.smsQuota) * 100 : 0;

  if (sub.status === "past_due") {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm shadow-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <p className="flex-1">
          <span className="font-semibold text-destructive">Payment overdue.</span>{" "}
          Your account is past due. Please make payment to avoid suspension.
        </p>
        <Link to="/billing" className="shrink-0 text-xs font-semibold text-destructive underline underline-offset-2">
          Pay now →
        </Link>
      </div>
    );
  }

  if (sub.status === "trial") {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-sky-300/40 bg-sky-500/10 px-4 py-3 text-sm shadow-sm">
        <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
        <p className="flex-1">
          <span className="font-semibold text-sky-700 dark:text-sky-300">Trial period.</span>{" "}
          Your trial ends on {sub.renewalDate}. Upgrade to keep your data and access.
        </p>
        <Chip size="small" label="Trial" sx={{ ...badgeSx("default"), flexShrink: 0 }} />
        <Link to="/billing" className="shrink-0 text-xs font-semibold text-sky-700 dark:text-sky-300 underline underline-offset-2">
          Upgrade →
        </Link>
      </div>
    );
  }

  if (learnerPct >= 90) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm shadow-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <p className="flex-1">
          <span className="font-semibold">Learner limit at {Math.round(learnerPct)}%.</span>{" "}
          {tenant.totalStudents.toLocaleString()} of {sub.learnerLimit.toLocaleString()} used. Upgrade for more capacity.
        </p>
        <Link to="/billing" className="shrink-0 text-xs font-semibold underline underline-offset-2">
          Upgrade →
        </Link>
      </div>
    );
  }

  if (smsPct >= 80) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm shadow-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <p className="flex-1">
          <span className="font-semibold">SMS quota at {Math.round(smsPct)}%.</span>{" "}
          {sub.smsUsed.toLocaleString()} of {sub.smsQuota.toLocaleString()} used this month.
        </p>
        <Link to="/billing" className="shrink-0 text-xs font-semibold underline underline-offset-2">
          Upgrade →
        </Link>
      </div>
    );
  }

  return null;
}

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function buildShellStyle(primaryColor: string): React.CSSProperties | undefined {
  if (!primaryColor || !/^#[0-9a-fA-F]{6}$/i.test(primaryColor)) return undefined;
  const lum = hexLuminance(primaryColor);
  const fg = lum > 0.35 ? "oklch(0.15 0 0)" : "oklch(0.99 0 0)";
  return {
    "--primary": primaryColor,
    "--primary-foreground": fg,
    "--ring": primaryColor,
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": fg,
    "--sidebar-ring": primaryColor,
    // Active nav item bg — primary tinted into the dark sidebar base
    "--sidebar-accent": `color-mix(in srgb, ${primaryColor} 14%, #0e1423)`,
    "--sidebar-accent-foreground": "oklch(0.94 0.005 245)",
  } as React.CSSProperties;
}

const SHELL_STYLE_PROPS = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
] as const;

function AppShell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, isSystemAdmin, loadingSession } = useAuth();
  const { active } = useTenant();

  // Ensure SSR and first client render produce identical HTML.
  // Auth state reads from localStorage (client-only), so delay auth-dependent
  // rendering until after hydration to prevent mismatch errors.
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => { setClientReady(true); }, []);

  // Apply the school's brand color as CSS custom properties on <html> rather than a
  // nested div: Radix portals (dialogs, dropdowns, selects, popovers, toasts) render
  // into document.body, outside any inline style scoped to the app shell, so setting
  // these on documentElement is the only way portaled UI also picks up the color.
  useEffect(() => {
    const root = document.documentElement;
    const style = isSystemAdmin ? undefined : buildShellStyle(active.primaryColor);
    if (style) {
      for (const [key, value] of Object.entries(style)) {
        root.style.setProperty(key, value as string);
      }
    } else {
      for (const key of SHELL_STYLE_PROPS) root.style.removeProperty(key);
    }
    return () => {
      for (const key of SHELL_STYLE_PROPS) root.style.removeProperty(key);
    };
  }, [isSystemAdmin, active.primaryColor]);

  // Apply school favicon to the browser tab
  useEffect(() => {
    if (!active.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = active.faviconUrl;
  }, [active.faviconUrl]);

  if (!clientReady) {
    return <div className="min-h-screen w-full bg-background" />;
  }

  // Login page renders without sidebar/header
  if (loadingSession && path !== "/login") {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading workspace…</p>
      </div>
    );
  }

  if (path === "/login" || !user) {
    return (
      <div className="min-h-screen w-full bg-background">
        {!user && path !== "/login" ? <RedirectToLogin /> : <Outlet />}
      </div>
    );
  }

  // Subscription/suspension features hidden — uncomment to re-enable
  // if (active.subscription.status === "suspended" && !isSystemAdmin) {
  //   return <SuspensionWall tenant={active} />;
  // }

  return (
    <WorkspaceSidebarProvider>
      <div className="app-shell flex min-h-screen w-full bg-background">
        <WorkspaceSidebar />
        <div className="workspace-frame flex min-w-0 flex-1 flex-col overflow-hidden bg-background/90">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
            {!isSystemAdmin && active.primaryColor && (
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent, ${active.primaryColor}, transparent)` }}
              />
            )}
            <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
              <SidebarToggleButton />
              <div className="hidden min-w-0 items-center gap-3 lg:flex">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-2 shadow-sm"
                  style={isSystemAdmin ? undefined : { backgroundColor: active.primaryColor }}
                >
                  {isSystemAdmin ? (
                    <span className="text-xs font-semibold text-foreground">SR</span>
                  ) : active.logoUrl ? (
                    <img src={active.logoUrl} alt={active.shortCode} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs font-semibold text-white">{active.shortCode.slice(0, 2)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {isSystemAdmin ? "Platform workspace" : active.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isSystemAdmin ? "Cross-tenant administration" : `${active.district}, ${active.province}`}
                  </p>
                </div>
              </div>
              <GlobalSearchButton />
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                <UserMenu />
              </div>
            </div>
          </header>
          {/* SubscriptionBanner hidden — {!isSystemAdmin && <SubscriptionBanner tenant={active} />} */}
          <main className="flex-1 overflow-x-hidden px-4 py-5 lg:px-6 lg:py-7">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </div>
        <CommandPalette />
      </div>
    </WorkspaceSidebarProvider>
  );
}

function RedirectToLogin() {
  const router = useRouter();
  useEffect(() => {
    void router.navigate({ to: "/login" });
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <TenantProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppShell />
              <Toaster richColors position="top-right" />
            </NotificationProvider>
          </AuthProvider>
        </TenantProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
