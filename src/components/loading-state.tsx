import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground",
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07] text-primary shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
