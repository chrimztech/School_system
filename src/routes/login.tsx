import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { keyframes } from "@emotion/react";
import {
  GraduationCap,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  Check,
  CalendarCheck,
  FileBadge,
  Wallet,
  ShieldCheck,
  BadgeCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  Stack,
  CircularProgress,
  Fade,
  Collapse,
  alpha,
  ThemeProvider,
  Tooltip,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { schoolSlugFromHostname } from "@/lib/tenant-host";
import { useFavicon } from "@/hooks/use-favicon";
import { buildTheme } from "@/theme";

// Default brand color for the unbranded/generic view (bare platform domain, or a school
// that hasn't set a color yet). Scoped to this page only — the app-wide default in
// theme.ts is a separate, larger change and deliberately left untouched here.
const DEFAULT_BRAND = "#2447B8";
const TEXT_PRIMARY = "#172033";
const TEXT_SECONDARY = "#667085";
const PAGE_BG = "#F7F9FC";
// Roughly matches "collapse to a single card below ~1000-1100px" — MUI's built-in `lg`
// breakpoint (1200px) sits noticeably above that, so this page uses its own threshold
// instead of the theme default.
const BP = 1040;

const fadeSlideUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: scale(0.82); }
  to { opacity: 1; transform: scale(1); }
`;

const drift = keyframes`
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-16px, 20px); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
`;

const shake = keyframes`
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
`;

const reveal = (delaySeconds: number) => ({
  opacity: 0,
  animation: `${fadeSlideUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delaySeconds}s both`,
});

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SRMS" }] }),
  component: LoginPage,
});

type SchoolBranding = {
  id: string;
  name: string;
  shortCode: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  motto?: string | null;
  district?: string | null;
  province?: string | null;
};

const PENDING_SLUG_KEY = "srms_pending_slug";

function detectSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  return schoolSlugFromHostname(window.location.hostname);
}
// Set by the /s/$slug route — lets a plain path URL (srms.com/s/mongu-trust-academy)
// resolve the same school branding a real subdomain would, without needing wildcard DNS.
function consumePendingSlug(): string | null {
  if (typeof window === "undefined") return null;
  const slug = window.sessionStorage.getItem(PENDING_SLUG_KEY);
  if (slug) window.sessionStorage.removeItem(PENDING_SLUG_KEY);
  return slug;
}

const FEATURES = [
  { icon: CalendarCheck, label: "Real-time attendance & gradebook", hint: "Live" },
  { icon: FileBadge, label: "ECZ-aligned report cards", hint: "Compliant" },
  { icon: Wallet, label: "Fee billing & reconciliation", hint: "Transparent" },
  { icon: ShieldCheck, label: "Role-based access, every campus", hint: "Secure" },
];

type FieldErrors = { identifier?: string; password?: string };

function LoginPage() {
  const { completeSignIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showForgot, setShowForgot] = useState(false);
  const [schoolBranding, setSchoolBranding] = useState<SchoolBranding | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    const slug = detectSubdomainSlug() ?? consumePendingSlug();
    if (!slug) return;
    api.public
      .schoolBySlug(slug)
      .then((data: Partial<SchoolBranding>) => {
        // Defensive trim — stray leading/trailing whitespace in stored school names has
        // shown up in the wild and breaks possessive copy like "{name}'s platform".
        if (data?.id) {
          setSchoolBranding({
            ...(data as SchoolBranding),
            name: (data.name ?? "").trim(),
            motto: data.motto?.trim() || data.motto,
          });
        }
      })
      .catch(() => {
        /* ignore — unknown slug */
      });
  }, []);

  useFavicon(schoolBranding?.faviconUrl);

  // Static "Sign in — SRMS" would be identical across every open school tab — set it per
  // school so someone juggling multiple schools' logins can tell tabs apart at a glance,
  // not just by the small favicon.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = schoolBranding ? `Sign in — ${schoolBranding.name}` : "Sign in — SRMS";
  }, [schoolBranding]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextFieldErrors: FieldErrors = {};
    if (!identifier.trim()) nextFieldErrors.identifier = "Enter your email or phone number";
    if (!password) nextFieldErrors.password = "Enter your password";
    if (nextFieldErrors.identifier || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const auth = await api.login(identifier.trim(), password);
      completeSignIn(auth);
      setSuccess(true);
      toast.success(`Welcome back, ${auth.name}!`);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; error?: string } } })?.response;
      setError(
        response
          ? (response.data?.message ?? response.data?.error ?? "Invalid email/phone or password.")
          : "Can't reach the server — check your connection and try again.",
      );
      setLoading(false);
    }
  };

  const brandPrimary = schoolBranding?.primaryColor ?? DEFAULT_BRAND;
  const brandAccent = schoolBranding?.secondaryColor ?? "#00c197";

  // Recolor MUI's theme to the resolved school's brand ahead of sign-in, so buttons,
  // inputs, and focus rings match the same colors as the gradients/logo above — not
  // just the platform default.
  const muiTheme = useMemo(
    () =>
      buildTheme({
        primaryColor: schoolBranding?.primaryColor ?? DEFAULT_BRAND,
        secondaryColor: schoolBranding?.secondaryColor,
      }),
    [schoolBranding?.primaryColor, schoolBranding?.secondaryColor],
  );

  const fieldRadiusSx: SxProps<Theme> = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px",
      transition: "box-shadow 180ms ease",
    },
    "& .MuiOutlinedInput-root .MuiInputAdornment-root svg": {
      transition: "color 180ms ease",
      color: "text.disabled",
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiInputAdornment-root svg": {
      color: "primary.main",
    },
    "& .MuiOutlinedInput-root.Mui-focused": {
      boxShadow: (t) => `0 0 0 4px ${alpha(t.palette.primary.main, 0.12)}`,
    },
  };

  return (
    <ThemeProvider theme={muiTheme}>
    <Box
      sx={{
        display: "grid",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100vw",
        overflowX: "hidden",
        gridTemplateColumns: "minmax(0, 1fr)",
        [`@media (min-width:${BP}px)`]: {
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
        },
        bgcolor: PAGE_BG,
      }}
    >
      {/* Left branding panel */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          display: "none",
          [`@media (min-width:${BP}px)`]: { display: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: 7,
          userSelect: "none",
          background: schoolBranding
            ? `color-mix(in srgb, ${brandPrimary} 90%, black)`
            : "linear-gradient(160deg, #10141d 0%, #171d29 100%)",
          transition: "background 700ms ease",
        }}
      >
        {/* Decorative dot grid */}
        <Box
          sx={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            opacity: 0.7,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 0)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 60% 55% at 20% 15%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 20% 15%, black, transparent 75%)",
          }}
        />
        {/* Decorative glow blobs — slow ambient drift for a premium, alive feel */}
        <Box
          sx={{
            pointerEvents: "none",
            position: "absolute",
            top: -96,
            right: -96,
            height: 384,
            width: 384,
            borderRadius: "50%",
            filter: "blur(110px)",
            background: alpha(brandPrimary, 0.35),
            transition: "background 700ms ease",
            animation: `${drift} 13s ease-in-out infinite`,
          }}
        />
        <Box
          sx={{
            pointerEvents: "none",
            position: "absolute",
            bottom: -128,
            left: -64,
            height: 320,
            width: 320,
            borderRadius: "50%",
            filter: "blur(100px)",
            background: alpha(brandAccent, 0.22),
            transition: "background 700ms ease",
            animation: `${drift} 16s ease-in-out infinite reverse`,
          }}
        />

        {/* Logo */}
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", position: "relative", zIndex: 1, ...reveal(0) }}>
          {schoolBranding?.logoUrl ? (
            <Box
              component="img"
              src={schoolBranding.logoUrl}
              alt={schoolBranding.name}
              sx={{
                height: 100,
                width: 100,
                borderRadius: 3.5,
                objectFit: "contain",
                bgcolor: "rgba(255,255,255,0.12)",
                p: 1.25,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.14), 0 14px 32px -6px ${alpha(brandPrimary, 0.6)}`,
                animation: `${scaleIn} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both`,
                flexShrink: 0,
              }}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                height: 100,
                width: 100,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 3.5,
                bgcolor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                flexShrink: 0,
              }}
            >
              <GraduationCap size={46} color="#fff" />
            </Box>
          )}
          <Box sx={{ lineHeight: 1.3 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
                {schoolBranding ? schoolBranding.name : "SRMS"}
              </Typography>
              {schoolBranding && (
                <Tooltip title="This is your school's verified workspace">
                  <Box sx={{ display: "flex", color: "#5eead4", animation: `${scaleIn} 0.4s ease 0.15s both` }}>
                    <BadgeCheck size={15} />
                  </Box>
                </Tooltip>
              )}
            </Stack>
            {schoolBranding && (
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.65)", mt: 0.25 }}>
                {[schoolBranding.district, schoolBranding.province].filter(Boolean).join(" · ")}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Hero content */}
        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 460 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              px: 1.5,
              py: 0.5,
              mb: 4,
              ...reveal(0.05),
            }}
          >
            <Box sx={{ height: 6, width: 6, borderRadius: "50%", bgcolor: "#34d399", animation: `${pulse} 2.2s ease-in-out infinite` }} />
            <Typography sx={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.02em", color: "rgba(255,255,255,0.8)" }}>
              School management platform
            </Typography>
          </Box>

          {schoolBranding ? (
            <Box sx={{ mb: 3, ...reveal(0.1) }}>
              <Typography
                sx={{ fontSize: 44, fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.02em", color: "#fff", mb: schoolBranding.motto ? 1.5 : 0 }}
              >
                {schoolBranding.name}
              </Typography>
              {schoolBranding.motto && (
                <Typography sx={{ fontSize: 16, color: "rgba(255,255,255,0.75)", fontStyle: "italic", lineHeight: 1.6 }}>
                  "{schoolBranding.motto}"
                </Typography>
              )}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 44, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#fff", mb: 3, ...reveal(0.1) }}>
              Sign in to your school's management platform.
            </Typography>
          )}

          <Typography sx={{ fontSize: 16, color: "rgba(255,255,255,0.78)", lineHeight: 1.6, mb: 4, ...reveal(0.15) }}>
            Admissions through graduation — attendance, assessments, fees, and reporting, unified in
            one secure system of record.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            {FEATURES.map(({ icon: Icon, label, hint }, i) => (
              <Box
                key={label}
                sx={{
                  borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.1)",
                  bgcolor: "rgba(255,255,255,0.05)",
                  p: 1.75,
                  backdropFilter: "blur(4px)",
                  transition: "background 200ms ease, border-color 200ms ease",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.08)",
                    borderColor: "rgba(255,255,255,0.2)",
                  },
                  ...reveal(0.2 + i * 0.05),
                }}
              >
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Icon size={16} color="rgba(255,255,255,0.85)" />
                  <Typography sx={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.55)" }}>
                    {hint}
                  </Typography>
                </Stack>
                <Typography sx={{ mt: 1, fontSize: 12.5, lineHeight: 1.4, color: "rgba(255,255,255,0.85)" }}>
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Footer */}
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            pt: 2.5,
            ...reveal(0.35),
          }}
        >
          <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            © {new Date().getFullYear()} School Records Management System
          </Typography>
        </Stack>
      </Box>

      {/* Right form panel */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2, sm: 5 },
          py: 8,
        }}
      >
        {/* Ambient brand glow — ties this panel back to the left side's color instead of
            reading as a flat, disconnected white void once the card's narrow 460px width
            leaves most of a wide viewport empty. */}
        <Box
          sx={{
            pointerEvents: "none",
            position: "absolute",
            top: "50%",
            left: "50%",
            height: 640,
            width: 640,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${alpha(brandPrimary, 0.1)} 0%, transparent 68%)`,
            transition: "background 700ms ease",
          }}
        />

        <Fade in timeout={500}>
          <Box sx={{ width: "100%", maxWidth: 460, minWidth: 0, position: "relative" }}>
            {/* Mobile brand header */}
            <Stack
              spacing={1.5}
              sx={{
                alignItems: "center",
                mb: 4.5,
                textAlign: "center",
                display: "flex",
                [`@media (min-width:${BP}px)`]: { display: "none" },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  height: 112,
                  width: 112,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  color: "#fff",
                  background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})`,
                  boxShadow: `0 14px 32px -6px ${alpha(brandPrimary, 0.55)}`,
                  transition: "background 700ms ease, box-shadow 700ms ease",
                }}
              >
                {schoolBranding?.logoUrl ? (
                  <Box
                    component="img"
                    src={schoolBranding.logoUrl}
                    alt={schoolBranding.name}
                    sx={{
                      height: 72,
                      width: 72,
                      borderRadius: 2.5,
                      objectFit: "contain",
                      bgcolor: "rgba(255,255,255,0.18)",
                      animation: `${scaleIn} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both`,
                    }}
                  />
                ) : (
                  <GraduationCap size={52} />
                )}
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Typography sx={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: TEXT_PRIMARY }}>
                  {schoolBranding?.name ?? "SRMS"}
                </Typography>
                {schoolBranding && (
                  <Box sx={{ display: "flex", color: "success.main" }}>
                    <BadgeCheck size={15} />
                  </Box>
                )}
              </Stack>
              <Typography variant="caption" sx={{ color: TEXT_SECONDARY }}>
                School Records Management System
              </Typography>
            </Stack>

            <Paper
              elevation={2}
              sx={{
                width: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                p: { xs: "24px", sm: "40px" },
                borderRadius: "20px",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  height: 3,
                  width: 80,
                  borderRadius: 1,
                  mb: 3,
                  background: `linear-gradient(90deg, ${alpha(brandPrimary, 0.7)}, transparent)`,
                  transition: "background 700ms ease",
                }}
              />

              {/* Persistent school identity strip — unmissable regardless of viewport, so
                  someone with several schools' tabs open can never mistake which one this is. */}
              {schoolBranding && (
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{
                    alignItems: "center",
                    mb: 2.5,
                    p: 1.25,
                    pr: 1.75,
                    borderRadius: "14px",
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.07),
                    border: "1px solid",
                    borderColor: (t) => alpha(t.palette.primary.main, 0.16),
                    transition: "background-color 700ms ease, border-color 700ms ease",
                    ...reveal(0),
                  }}
                >
                  {schoolBranding.logoUrl ? (
                    <Box
                      component="img"
                      src={schoolBranding.logoUrl}
                      alt={schoolBranding.name}
                      sx={{ height: 48, width: 48, borderRadius: 2, objectFit: "contain", bgcolor: "background.paper", flexShrink: 0 }}
                    />
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        height: 48,
                        width: 48,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        flexShrink: 0,
                      }}
                    >
                      <GraduationCap size={24} />
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", flex: 1, minWidth: 0, color: TEXT_PRIMARY }} noWrap>
                    {schoolBranding.name}
                  </Typography>
                  <Tooltip title="This is your school's verified workspace">
                    <Box sx={{ display: "flex", color: "success.main", flexShrink: 0 }}>
                      <BadgeCheck size={16} />
                    </Box>
                  </Tooltip>
                </Stack>
              )}

              <Box sx={{ mb: 3, ...reveal(0.06) }}>
                <Typography sx={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2, color: TEXT_PRIMARY }}>
                  Sign in
                </Typography>
                <Typography sx={{ fontSize: 14, color: TEXT_SECONDARY, mt: 0.5, lineHeight: 1.5 }}>
                  {schoolBranding
                    ? "Enter your credentials to continue"
                    : "to your school's management platform"}
                </Typography>
              </Box>

              {error && (
                <Alert
                  id="login-error"
                  role="alert"
                  key={error}
                  severity="error"
                  sx={{ mb: 2.5, borderRadius: "12px", animation: `${shake} 0.4s ease` }}
                >
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={submit} suppressHydrationWarning noValidate sx={reveal(0.12)}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography
                      component="label"
                      htmlFor="email"
                      sx={{ display: "block", fontSize: 13.5, fontWeight: 500, color: TEXT_PRIMARY, mb: 0.75 }}
                    >
                      Email or phone number <Box component="span" sx={{ color: TEXT_SECONDARY }}>*</Box>
                    </Typography>
                    <TextField
                      id="email"
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        setFieldErrors((f) => ({ ...f, identifier: undefined }));
                        setError(null);
                      }}
                      placeholder="you@school.zm or 0977 000 000"
                      autoComplete="username"
                      autoFocus
                      fullWidth
                      disabled={loading}
                      error={Boolean(error) || Boolean(fieldErrors.identifier)}
                      helperText={fieldErrors.identifier}
                      aria-describedby={error ? "login-error" : undefined}
                      sx={fieldRadiusSx}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Mail size={16} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                        columnGap: 1,
                        mb: 0.75,
                      }}
                    >
                      <Typography component="label" htmlFor="password" sx={{ fontSize: 13.5, fontWeight: 500, color: TEXT_PRIMARY }}>
                        Password <Box component="span" sx={{ color: TEXT_SECONDARY }}>*</Box>
                      </Typography>
                      <Button
                        type="button"
                        variant="text"
                        size="small"
                        onClick={() => setShowForgot((v) => !v)}
                        sx={{
                          minWidth: 0,
                          minHeight: 0,
                          p: 0.5,
                          m: -0.5,
                          borderRadius: "6px",
                          fontSize: 12.5,
                          fontWeight: 500,
                          flexShrink: 0,
                          color: "primary.main",
                          textTransform: "none",
                          "&:focus-visible": {
                            boxShadow: (t) => `0 0 0 2px ${alpha(t.palette.primary.main, 0.4)}`,
                          },
                        }}
                      >
                        Forgot password?
                      </Button>
                    </Stack>
                    <TextField
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setFieldErrors((f) => ({ ...f, password: undefined }));
                        setError(null);
                      }}
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                      onBlur={() => setCapsLockOn(false)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      fullWidth
                      disabled={loading}
                      error={Boolean(error) || Boolean(fieldErrors.password)}
                      helperText={fieldErrors.password}
                      aria-describedby={error ? "login-error" : undefined}
                      sx={fieldRadiusSx}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Lock size={16} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                tabIndex={-1}
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                edge="end"
                                sx={{ minWidth: 44, minHeight: 44 }}
                              >
                                <Box
                                  key={showPassword ? "hide" : "show"}
                                  component="span"
                                  sx={{ display: "flex", animation: `${scaleIn} 0.2s ease both` }}
                                >
                                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </Box>
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    <Collapse in={capsLockOn} timeout={150}>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.75, color: "warning.main" }}>
                        <TriangleAlert size={12} />
                        <Typography sx={{ fontSize: 11.5 }}>Caps Lock is on</Typography>
                      </Stack>
                    </Collapse>
                  </Box>

                  <Collapse in={showForgot} timeout={200}>
                    <Alert severity="info" icon={false} sx={{ bgcolor: "action.hover", color: TEXT_SECONDARY, fontSize: 12.5, borderRadius: "12px" }}>
                      Contact your school administrator to reset your password — they can set a
                      temporary one from the user management panel.
                    </Alert>
                  </Collapse>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    endIcon={
                      !loading && !success ? (
                        <Box component="span" className="signin-arrow" sx={{ display: "flex", transition: "transform 200ms ease" }}>
                          <ArrowRight size={16} />
                        </Box>
                      ) : undefined
                    }
                    sx={{
                      borderRadius: "12px",
                      minHeight: 52,
                      boxShadow: (t) => `0 10px 24px -8px ${alpha(t.palette.primary.main, 0.55)}`,
                      transition: "box-shadow 200ms ease, transform 150ms ease",
                      "&:hover": {
                        boxShadow: (t) => `0 12px 28px -6px ${alpha(t.palette.primary.main, 0.65)}`,
                        transform: "translateY(-1px)",
                      },
                      "&:hover .signin-arrow": { transform: "translateX(3px)" },
                      "&:active": { transform: "translateY(0)" },
                    }}
                  >
                    {success ? (
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", animation: `${scaleIn} 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both` }}>
                        <Check size={16} />
                        <span>Signed in</span>
                      </Stack>
                    ) : loading ? (
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <CircularProgress size={16} color="inherit" />
                        <span>Signing in…</span>
                      </Stack>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </Stack>
              </Box>

              <Typography sx={{ fontSize: 12, color: TEXT_SECONDARY, textAlign: "center", mt: 3, lineHeight: 1.6, ...reveal(0.18) }}>
                Secured by SRMS · ECZ aligned
              </Typography>

              <Typography sx={{ fontSize: 12.5, color: TEXT_SECONDARY, textAlign: "center", mt: 2, lineHeight: 1.6, ...reveal(0.18) }}>
                Need access? Contact your school administrator or{" "}
                <Box component="span" sx={{ color: TEXT_PRIMARY, fontWeight: 500 }}>
                  chrishentmatakala@yahoo.com
                </Box>
                .
              </Typography>
            </Paper>
          </Box>
        </Fade>
      </Box>
    </Box>
    </ThemeProvider>
  );
}
