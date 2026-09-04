import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export type Notification = {
  id: string;
  title: string;
  body: string;
  time: string;
  module: string;
  read: boolean;
  severity: "info" | "success" | "warning" | "critical";
};

type Ctx = {
  items: Notification[];
  unread: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  push: (n: Omit<Notification, "id" | "time" | "read">) => void;
  clear: () => void;
};

const NotifContext = createContext<Ctx | null>(null);

// There's no backend push/notification table — this is a per-device, per-user log of things
// this browser session itself observed (a message arrived, a backup finished, a payment was
// recorded), not a cross-device inbox. Keeping it in localStorage rather than plain component
// state means it survives a reload instead of vanishing the moment the page refreshes.
const MAX_STORED = 100;

function storageKey(userId: string) {
  return `srms-notifications:${userId}`;
}

function loadStored(userId: string): Notification[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const [items, setItems] = useState<Notification[]>(() => loadStored(userId));

  // Re-load the right person's notifications on login/logout without a full page reload.
  useEffect(() => {
    setItems(loadStored(userId));
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, MAX_STORED)));
    } catch {
      // best-effort — private browsing / storage-full shouldn't break the page
    }
  }, [items, userId]);

  const value = useMemo<Ctx>(() => ({
    items,
    unread: items.filter((i) => !i.read).length,
    markAllRead: () => setItems((prev) => prev.map((n) => ({ ...n, read: true }))),
    markRead: (id) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    push: (n) => setItems((prev) => [{ ...n, id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, time: new Date().toISOString(), read: false }, ...prev].slice(0, MAX_STORED)),
    clear: () => setItems([]),
  }), [items]);
  return <NotifContext.Provider value={value}>{children}</NotifContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

/** `n.time` is stored as an ISO timestamp (see push() above); this renders it relative to now
 * for display, so a notification from yesterday doesn't still read "just now" after a reload. */
export function formatNotificationTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
