import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Visual treatment for the admin-configured Zambia achievement grades. */
export function gradeBadgeClass(grade: string | null | undefined): string {
  const g = (grade ?? "").trim().toUpperCase();
  if (g === "A") return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (g === "B+" || g === "B") return "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400";
  if (g === "C+" || g === "C") return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400";
  if (g === "D+" || g === "D") return "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400";
  if (g === "E") return "border-transparent bg-destructive/15 text-destructive";
  return "border-transparent bg-muted text-muted-foreground";
}

export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
