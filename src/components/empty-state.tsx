import type { ComponentType, ReactNode } from "react";

import { Button } from "@mui/material";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionSlot,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: ComponentType<{ className?: string }> };
  /** Escape hatch for a router `<Link>` or other custom action element instead of a click handler. */
  actionSlot?: ReactNode;
  className?: string;
}) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-14 text-center text-muted-foreground sm:py-16",
        className,
      )}
    >
      {Icon && (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07] text-primary shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>}
      {action && (
        <Button
          variant="outlined"
          size="small"
          sx={{ mt: 1.5 }}
          startIcon={ActionIcon ? <ActionIcon className="h-3.5 w-3.5" /> : undefined}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
      {actionSlot && <div className="mt-3">{actionSlot}</div>}
    </div>
  );
}
