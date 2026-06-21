import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const value = useMemo<Ctx>(() => ({
    items,
    unread: items.filter((i) => !i.read).length,
    markAllRead: () => setItems((prev) => prev.map((n) => ({ ...n, read: true }))),
    markRead: (id) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))),
    push: (n) => setItems((prev) => [{ ...n, id: `n${Date.now().toString(36)}`, time: "just now", read: false }, ...prev]),
    clear: () => setItems([]),
  }), [items]);
  return <NotifContext.Provider value={value}>{children}</NotifContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}
