import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Tone names matching the old shadcn Badge `variant` prop, for use with MUI Chip's `sx`. */
export type BadgeTone = "default" | "secondary" | "destructive" | "outline" | "warning" | "success";

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  default: { bg: "rgba(35,112,189,0.1)", fg: "#2370bd", border: "rgba(35,112,189,0.2)" },
  secondary: { bg: "#eff3f6", fg: "#222933", border: "rgba(219,222,226,0.7)" },
  destructive: { bg: "rgba(237,64,63,0.1)", fg: "#ed403f", border: "rgba(237,64,63,0.2)" },
  outline: { bg: "rgba(248,250,253,0.7)", fg: "#1a2028", border: "rgba(219,222,226,0.8)" },
  warning: { bg: "rgba(245,158,11,0.1)", fg: "#b45309", border: "rgba(245,158,11,0.2)" },
  success: { bg: "rgba(16,185,129,0.1)", fg: "#047857", border: "rgba(16,185,129,0.2)" },
};

/** MUI Chip `sx` treatment matching the old shadcn Badge visual variants. Use as `<Chip sx={badgeSx("success")} .../>`. */
export function badgeSx(tone: BadgeTone = "default") {
  const t = BADGE_TONES[tone];
  return {
    bgcolor: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.01em",
    height: "auto",
    "& .MuiChip-label": { px: 1.25, py: 0.4 },
  };
}

/**
 * MUI Chip `sx` treatment for the ECZ achievement grading scale (`GradingScaleService.zambia2023Defaults`
 * on the backend). `grade` is the point value 1-9 as a string; description bands are
 * 1-2 Distinction, 3-4 Merit, 5-6 Credit, 7-8 Satisfactory, 9 Unsatisfactory.
 */
export function gradeChipSx(grade: string | null | undefined) {
  const g = (grade ?? "").trim().toUpperCase();
  const tone = (bg: string, fg: string) => ({ bgcolor: bg, color: fg, border: "1px solid transparent" });
  if (g === "1" || g === "2") return tone("rgba(16,185,129,0.15)", "#047857");
  if (g === "3" || g === "4") return tone("rgba(14,165,233,0.15)", "#0369a1");
  if (g === "5" || g === "6") return tone("rgba(245,158,11,0.15)", "#b45309");
  if (g === "7" || g === "8") return tone("rgba(249,115,22,0.15)", "#c2410c");
  if (g === "9") return tone("rgba(237,64,63,0.15)", "#ed403f");
  return tone("rgba(101,108,118,0.12)", "#656c76");
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
