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
}): "/" | "/login" | "/change-password" | null {
  if (!clientReady || loadingSession) return null;

  if (!user) return path === "/login" ? null : "/login";
  if (user.mustChangePassword) {
    return path === "/change-password" ? null : "/change-password";
  }

  return path === "/login" ? "/" : null;
}
