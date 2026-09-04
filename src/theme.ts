import { createTheme, alpha, type Shadows } from "@mui/material/styles";

// Hex equivalents of the brand OKLCH tokens previously defined in styles.css
// (kept in sync manually — see src/styles.css :root block for the source values).
const brand = {
  background: "#f8fafd",
  foreground: "#1a2028",
  paper: "#fdfeff",
  primary: "#2370bd",
  primaryContrast: "#fcfcfc",
  secondary: "#00c197",
  secondaryContrast: "#001d12",
  muted: "#f2f5f7",
  mutedForeground: "#656c76",
  destructive: "#ed403f",
  success: "#40ae67",
  warning: "#edb333",
  border: "#dbdee2",
  sidebar: "#111821",
  sidebarForeground: "#e8ebee",
};

const fontStack =
  '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const softShadow = "0 1px 2px rgb(15 23 42 / 0.05), 0 14px 38px rgb(15 23 42 / 0.06)";
const mediumShadow = "0 10px 30px rgb(15 23 42 / 0.08), 0 2px 8px rgb(15 23 42 / 0.04)";
const shadows = ["none", softShadow, mediumShadow, ...Array(22).fill(mediumShadow)] as Shadows;

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** WCAG-ish relative luminance, used to pick a readable black/white contrast color. */
export function contrastFor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.35 ? "#1a2028" : "#fcfcfc";
}

export type ThemeBrandOverrides = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

/**
 * Builds the MUI theme, optionally recolored with a school's brand palette. The base
 * `theme` export below is the platform default (no tenant); pages that know the active
 * school's colors should call this directly so MUI components (buttons, chips, focus
 * rings, etc.) reflect tenant branding instead of the hardcoded default forever.
 */
export function buildTheme(overrides?: ThemeBrandOverrides) {
  const primary = isValidHexColor(overrides?.primaryColor) ? overrides.primaryColor : brand.primary;
  const secondary = isValidHexColor(overrides?.secondaryColor) ? overrides.secondaryColor : brand.secondary;

  return createTheme({
    palette: {
      mode: "light",
      primary: { main: primary, contrastText: contrastFor(primary) },
      secondary: { main: secondary, contrastText: contrastFor(secondary) },
      error: { main: brand.destructive },
      success: { main: brand.success },
      warning: { main: brand.warning },
      background: { default: brand.background, paper: brand.paper },
      text: { primary: brand.foreground, secondary: brand.mutedForeground },
      divider: brand.border,
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: fontStack,
      h1: { fontWeight: 650, letterSpacing: "-0.035em" },
      h2: { fontWeight: 650, letterSpacing: "-0.03em" },
      h3: { fontWeight: 650, letterSpacing: "-0.025em" },
      h4: { fontWeight: 650, letterSpacing: "-0.02em" },
      h5: { fontWeight: 650, letterSpacing: "-0.015em" },
      h6: { fontWeight: 650, letterSpacing: "-0.01em" },
      button: { textTransform: "none", fontWeight: 650, letterSpacing: "-0.005em" },
    },
    shadows,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            minHeight: 40,
            paddingInline: 16,
            boxShadow: "none",
          },
          contained: {
            boxShadow: "0 1px 2px rgb(15 23 42 / 0.12), 0 6px 16px rgb(15 23 42 / 0.08)",
            "&:hover": { boxShadow: "0 2px 4px rgb(15 23 42 / 0.12), 0 8px 20px rgb(15 23 42 / 0.1)" },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none", backgroundClip: "padding-box" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 600 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: alpha(brand.paper, 0.72),
            transition: "background-color 160ms ease, box-shadow 160ms ease",
            "&:hover": { backgroundColor: brand.paper },
            "&.Mui-focused": { backgroundColor: brand.paper, boxShadow: `0 0 0 3px ${alpha(primary, 0.12)}` },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            border: `1px solid ${alpha(brand.border, 0.9)}`,
            boxShadow: "0 24px 80px rgb(15 23 42 / 0.2)",
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: "1.125rem", fontWeight: 650, padding: "20px 24px 12px" },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: "12px 24px 20px", gap: 8 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: brand.mutedForeground,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.035em",
            textTransform: "uppercase",
            backgroundColor: alpha(brand.muted, 0.86),
          },
          body: { fontSize: "0.82rem" },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { "&:last-child td": { borderBottom: 0 } },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { minHeight: 42, borderRadius: 8, marginInline: 6 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: "0.75rem" },
        },
      },
      // Every page in the app renders its section tabs with plain <Tabs>/<Tab> and no per-page
      // overflow handling. On a phone-width viewport that silently clips trailing tabs off the
      // edge of the screen with no way to reach them — scrollable mode (with touch-swipe and
      // auto scroll buttons) fixes every one of those pages from this single place.
      MuiTabs: {
        defaultProps: {
          variant: "scrollable",
          scrollButtons: "auto",
          allowScrollButtonsMobile: true,
        },
        styleOverrides: {
          scrollButtons: {
            "&.Mui-disabled": { opacity: 0.3 },
          },
        },
      },
    },
  });
}

export const theme = buildTheme();

export const shellPalette = {
  sidebarBg: brand.sidebar,
  sidebarFg: brand.sidebarForeground,
  softShadow,
  mediumShadow,
  softBorder: alpha(brand.border, 0.9),
};
