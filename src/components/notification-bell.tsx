import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notifications";
import { Button, IconButton, Popover, Box } from "@mui/material";
import { cn } from "@/lib/utils";

const severityDot: Record<string, string> = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
};

export function NotificationBell() {
  const { items, unread, markAllRead, markRead, clear } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <>
      <button
        className="relative rounded-md p-2 text-muted-foreground hover:bg-muted"
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>
      <Popover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ width: 384 }}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread} unread</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="text"
              color="inherit"
              size="small"
              startIcon={<CheckCheck className="h-3 w-3" />}
              onClick={markAllRead}
              sx={{ height: 28, px: 1, fontSize: 12 }}
            >
              Read all
            </Button>
            <IconButton size="small" aria-label="Clear all notifications" onClick={clear} sx={{ height: 28, width: 28 }}>
              <Trash2 className="h-3 w-3" />
            </IconButton>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">You're all caught up.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn("flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition hover:bg-muted/50", !n.read && "bg-accent/5")}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot[n.severity])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              </div>
              {!n.read && <Check className="mt-1 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
            </button>
          ))}
        </div>
        <div className="border-t border-border px-4 py-2 text-center">
          <Link to="/notifications" className="text-xs font-medium text-primary hover:underline">
            View all notifications
          </Link>
        </div>
        </Box>
      </Popover>
    </>
  );
}
