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
import { useState, useEffect, useMemo } from "react";
import { Search, LogOut, UserCircle, Command as CommandIcon, Lock } from "lucide-react";
import { ThemeProvider, CssBaseline, Menu, MenuItem, ListItemIcon, Divider, Box, Typography } from "@mui/material";

import appCss from "../styles.css?url";
import { theme, buildTheme, contrastFor, isValidHexColor } from "@/theme";
import { TenantProvider, useTenant, type Tenant } from "@/lib/tenant";
import { AuthProvider, useAuth, ROLE_META } from "@/lib/auth";
import { authRedirectFor } from "@/lib/auth-navigation";
import { NotificationProvider } from "@/lib/notifications";
import { useFavicon } from "@/hooks/use-favicon";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { WorkspaceSidebar, WorkspaceSidebarProvider, SidebarToggleButton } from "@/components/workspace-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { RouteAccessBoundary } from "@/components/access-guard";

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
    links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", href: "/favicon.svg" }],
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

type BrandColors = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
};

function buildShellStyle(brand: BrandColors): React.CSSProperties | undefined {
  const primaryColor = brand.primaryColor;
  if (!isValidHexColor(primaryColor)) return undefined;
  const fg = contrastFor(primaryColor);
  const style: Record<string, string> = {
    "--primary": primaryColor,
    "--primary-foreground": fg,
    "--ring": primaryColor,
    "--sidebar-primary": primaryColor,
    "--sidebar-primary-foreground": fg,
    "--sidebar-ring": primaryColor,
    // Active nav item bg — primary tinted into the dark sidebar base
    "--sidebar-accent": `color-mix(in srgb, ${primaryColor} 14%, #0e1423)`,
    "--sidebar-accent-foreground": "oklch(0.94 0.005 245)",
  };
  const secondaryColor = isValidHexColor(brand.secondaryColor) ? brand.secondaryColor : undefined;
  const accentColor = isValidHexColor(brand.accentColor) ? brand.accentColor : undefined;
  if (secondaryColor) {
    style["--secondary"] = secondaryColor;
    style["--secondary-foreground"] = contrastFor(secondaryColor);
  }
  if (accentColor) {
    style["--accent"] = accentColor;
    style["--accent-foreground"] = contrastFor(accentColor);
  }

  // Dashboard/report charts (index.tsx, results-analysis.tsx, etc.) plot against
  // var(--color-chart-1..5), which resolves through these five vars — previously never
  // overridden per tenant, so every school's charts silently used the same platform
  // default palette regardless of their brand color. Root chart-1/2/3 in the tenant's
  // actual colors, and derive two more tints from primary so there's still visual
  // separation between series for a school that's only set a primary color.
  style["--chart-1"] = primaryColor;
  style["--chart-2"] = secondaryColor ?? `color-mix(in srgb, ${primaryColor} 55%, white)`;
  style["--chart-3"] = accentColor ?? `color-mix(in srgb, ${primaryColor} 70%, black)`;
  style["--chart-4"] = `color-mix(in srgb, ${primaryColor} 35%, white)`;
  style["--chart-5"] = secondaryColor
    ? `color-mix(in srgb, ${secondaryColor} 60%, ${primaryColor})`
    : `color-mix(in srgb, ${primaryColor} 85%, black)`;

  return style as React.CSSProperties;
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
  "--secondary",
  "--secondary-foreground",
  "--accent",
  "--accent-foreground",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

function AppShell() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { user, isSystemAdmin, loadingSession } = useAuth();
  const { active, isResolving: tenantResolving } = useTenant();
  const router = useRouter();

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
    const style = isSystemAdmin
      ? undefined
      : buildShellStyle({ primaryColor: active.primaryColor, secondaryColor: active.secondaryColor, accentColor: active.accentColor });
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
  }, [isSystemAdmin, active.primaryColor, active.secondaryColor, active.accentColor]);

  // Apply school favicon to the browser tab — never a specific school's while in the
  // system-admin/platform workspace view, same as the brand color right above: `active`
  // still resolves to whichever school happens to be selected underneath even when the
  // super admin isn't actually looking at that school's own workspace.
  useFavicon(isSystemAdmin ? undefined : active.faviconUrl);

  // Recolor MUI's theme (buttons, chips, inputs, focus rings, …) to the active school's
  // brand — the static `theme` export only covers the platform default, so without this
  // MUI-native components stay the default blue/green regardless of tenant.
  const muiTheme = useMemo(
    () =>
      buildTheme(
        isSystemAdmin ? undefined : { primaryColor: active.primaryColor, secondaryColor: active.secondaryColor },
      ),
    [isSystemAdmin, active.primaryColor, active.secondaryColor],
  );

  // Redirects live here (in AppShell, which persists across the transition) rather than in a
  // child component mounted only while the condition holds. A child whose own effect fires
  // navigate() and whose unmounting is a direct consequence of that same navigation succeeding
  // races TanStack Router's commit: the in-flight navigation gets aborted before history.pushState
  // ever fires, reverting the location and immediately remounting the same child — an infinite
  // "Maximum update depth exceeded" bounce between the two routes. Keeping the effect on a
  // component that only re-renders (never unmounts) across the transition avoids that race.
  useEffect(() => {
    const to = authRedirectFor({ clientReady, loadingSession, user, path });
    if (to) void router.navigate({ to, replace: true });
  }, [clientReady, loadingSession, user, path, router]);

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
      <ThemeProvider theme={muiTheme}>
        <div className="min-h-screen w-full bg-background">
          {!user && path !== "/login" ? null : <Outlet />}
        </div>
      </ThemeProvider>
    );
  }

  // A freshly provisioned or admin-reset account must set its own password before it can
  // reach anything else — that password is known to whoever created/reset the account.
  if (user.mustChangePassword && path !== "/change-password") {
    return (
      <ThemeProvider theme={muiTheme}>
        <div className="min-h-screen w-full bg-background" />
      </ThemeProvider>
    );
  }

  if (path === "/change-password") {
    return (
      <ThemeProvider theme={muiTheme}>
        <div className="min-h-screen w-full bg-background">
          <Outlet />
        </div>
      </ThemeProvider>
    );
  }

  // Subscription/suspension features hidden — uncomment to re-enable
  // if (active.subscription.status === "suspended" && !isSystemAdmin) {
  //   return <SuspensionWall tenant={active} />;
  // }

  return (
    <ThemeProvider theme={muiTheme}>
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
          <main className="flex-1 overflow-x-hidden px-4 py-5 lg:px-6 lg:py-7">
            <div className="mx-auto w-full max-w-[1600px]">
              {tenantResolving ? (
                // Route components read active.id as soon as they mount — rendering them
                // before the school list finishes resolving fires every schoolId-scoped
                // query with the placeholder empty id, throwing "No valid school ID" from
                // every one of them. Hold the outlet here instead of guarding each query.
                <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
                  Loading workspace…
                </div>
              ) : (
                <RouteAccessBoundary pathname={path}>
                  <Outlet />
                </RouteAccessBoundary>
              )}
            </div>
          </main>
        </div>
        <CommandPalette />
      </div>
    </WorkspaceSidebarProvider>
    </ThemeProvider>
  );
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
