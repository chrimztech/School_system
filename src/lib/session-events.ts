export const SESSION_CHANGE_EVENT = "srms-session-changed";
export const AUTH_PROVIDER_SESSION_SOURCE = "auth-provider";

type SessionChangeDetail = {
  source?: string;
};

export function dispatchSessionChange(source?: string) {
  if (typeof window === "undefined") return;

  const event = source
    ? new CustomEvent<SessionChangeDetail>(SESSION_CHANGE_EVENT, { detail: { source } })
    : new Event(SESSION_CHANGE_EVENT);
  window.dispatchEvent(event);
}

export function sessionChangeCameFrom(event: Event, source: string): boolean {
  return (event as CustomEvent<SessionChangeDetail>).detail?.source === source;
}
