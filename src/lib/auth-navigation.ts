export type AuthRedirectUser = {
  mustChangePassword?: boolean;
  name?: string | null;
  role?: string;
};

const MISSING_PARENT_NAMES = new Set([
  "",
  "not provided",
  "not available",
  "n/a",
  "na",
  "unknown",
  "unavailable",
  "tbd",
  "none",
  "-",
  "pending",
  "guardian",
  "parent",
]);

export function parentProfileNeedsCompletion(user: AuthRedirectUser | null): boolean {
  if (user?.role?.toLowerCase() !== "parent") return false;
  return MISSING_PARENT_NAMES.has(user.name?.trim().toLowerCase() ?? "");
}

export function authRedirectFor({
  clientReady,
  loadingSession,
  user,
  path,
}: {
  clientReady: boolean;
  loadingSession: boolean;
  user: AuthRedirectUser | null;
  path: string;
}): "/" | "/login" | "/welcome" | "/change-password" | "/set-bio" | null {
  if (!clientReady || loadingSession) return null;

  if (!user) {
    // The public marketing page — visiting it, or the bare root (which would otherwise be the
    // signed-in dashboard), needs no redirect; any other protected deep link still bounces
    // straight to sign-in rather than the marketing page, same as before.
    if (path === "/login" || path === "/welcome") return null;
    return path === "/" ? "/welcome" : "/login";
  }
  if (user.mustChangePassword) {
    return path === "/change-password" ? null : "/change-password";
  }

  if (parentProfileNeedsCompletion(user)) {
    return path === "/set-bio" ? null : "/set-bio";
  }

  if (path === "/set-bio") return "/";

  return path === "/login" || path === "/welcome" ? "/" : null;
}
