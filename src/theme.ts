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

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: brand.primary, contrastText: brand.primaryContrast },
    secondary: { main: brand.secondary, contrastText: brand.secondaryContrast },
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
    button: { textTransform: "none", fontWeight: 600 },
  },
  shadows,
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 20 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: "0.75rem" },
      },
    },
  },
});

export const shellPalette = {
  sidebarBg: brand.sidebar,
  sidebarFg: brand.sidebarForeground,
  softShadow,
  mediumShadow,
  softBorder: alpha(brand.border, 0.9),
};
