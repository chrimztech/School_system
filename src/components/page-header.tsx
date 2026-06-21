import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-6">
      <div className="hero-divider" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">{title}</h1>
          {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "primary",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "accent";
  icon?: ReactNode;
}) {
  const accentClasses: Record<string, { card: string; icon: string; ribbon: string }> = {
    primary: {
      card: "border-primary/20",
      icon: "bg-primary/10 text-primary",
      ribbon: "from-primary/10",
    },
    success: {
      card: "border-emerald-500/20",
      icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      ribbon: "from-emerald-500/10",
    },
    warning: {
      card: "border-amber-500/20",
      icon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      ribbon: "from-amber-500/10",
    },
    destructive: {
      card: "border-destructive/20",
      icon: "bg-destructive/10 text-destructive",
      ribbon: "from-destructive/10",
    },
    accent: {
      card: "border-accent/20",
      icon: "bg-accent/20 text-accent-foreground",
      ribbon: "from-accent/10",
    },
  };

  const tones = accentClasses[accent];

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm", tones.card)}>
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", tones.ribbon)} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {icon && (
          <div className={cn("relative z-10 flex h-10 w-10 items-center justify-center rounded-xl", tones.icon)}>
            {icon}
          </div>
        )}
      </div>
      <p className="relative z-10 mt-4 text-[1.9rem] font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="relative z-10 mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}
