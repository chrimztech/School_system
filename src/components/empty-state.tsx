import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
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
        "flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground",
        className,
      )}
    >
      {Icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-muted/70">
          <Icon className="h-5 w-5 opacity-60" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs leading-5 opacity-75">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" className="mt-3" onClick={action.onClick}>
          {ActionIcon && <ActionIcon className="mr-1.5 h-3.5 w-3.5" />}
          {action.label}
        </Button>
      )}
      {actionSlot && <div className="mt-3">{actionSlot}</div>}
    </div>
  );
}
