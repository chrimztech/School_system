export type AuthRedirectUser = {
  mustChangePassword?: boolean;
};

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
}): "/" | "/login" | "/welcome" | "/change-password" | null {
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

  return path === "/login" || path === "/welcome" ? "/" : null;
}
