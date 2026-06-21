import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SRMS" }] }),
  component: NotificationsPage,
});

const dot: Record<string, string> = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

function NotificationsPage() {
  const { items, markAllRead, markRead, clear, unread } = useNotifications();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unread} unread of ${items.length}`}
        actions={
          <>
            <Button variant="outline" onClick={markAllRead}><CheckCheck className="mr-1 h-4 w-4" />Mark all read</Button>
            <Button variant="ghost" onClick={clear}><Trash2 className="mr-1 h-4 w-4" />Clear</Button>
          </>
        }
      />
      <div className="rounded-xl border border-border bg-card">
        {items.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted-foreground">No notifications.</p>}
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className={cn("flex w-full items-start gap-3 border-b border-border/50 px-5 py-4 text-left transition hover:bg-muted/30 last:border-0", !n.read && "bg-accent/5")}
          >
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot[n.severity])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{n.module}</Badge>
                  {n.time}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
