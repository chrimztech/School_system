import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { keyframes } from "@emotion/react";
import {
  GraduationCap,
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  CalendarCheck,
  FileBadge,
  Wallet,
  ShieldCheck,
  Sparkles,
  LockKeyhole,
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
  Divider,
  alpha,
  ThemeProvider,
  Tooltip,
} from "@mui/material";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { schoolSlugFromHostname } from "@/lib/tenant-host";
import { useFavicon } from "@/hooks/use-favicon";
import { buildTheme } from "@/theme";

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

function LoginPage() {
  const { completeSignIn, user } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [schoolBranding, setSchoolBranding] = useState<SchoolBranding | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

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
    if (!identifier.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await api.login(identifier.trim(), password);
      completeSignIn(auth);
      toast.success(`Welcome back, ${auth.name}!`);
      navigate({ to: "/" });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response
        ?.data;
      setError(data?.message ?? data?.error ?? "Invalid email/phone or password.");
    } finally {
      setLoading(false);
    }
  };

  const brandPrimary = schoolBranding?.primaryColor ?? "#2370bd";
  const brandAccent = schoolBranding?.secondaryColor ?? "#00c197";

  // Recolor MUI's theme to the resolved school's brand ahead of sign-in, so buttons,
  // inputs, and focus rings match the same colors as the gradients/logo above — not
  // just the platform default.
  const muiTheme = useMemo(
    () => buildTheme({ primaryColor: schoolBranding?.primaryColor, secondaryColor: schoolBranding?.secondaryColor }),
    [schoolBranding?.primaryColor, schoolBranding?.secondaryColor],
  );

  return (
    <ThemeProvider theme={muiTheme}>
    <Box
      sx={{
        display: "grid",
        minHeight: "100vh",
        gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1fr" },
        bgcolor: "background.default",
      }}
    >
      {/* Left branding panel */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          display: { xs: "none", lg: "flex" },
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
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", position: "relative", zIndex: 1, ...reveal(0) }}>
          {schoolBranding?.logoUrl ? (
            <Box
              component="img"
              src={schoolBranding.logoUrl}
              alt={schoolBranding.name}
              sx={{
                height: 36,
                width: 36,
                borderRadius: 2,
                objectFit: "contain",
                bgcolor: "rgba(255,255,255,0.1)",
                p: 0.5,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 6px 16px -4px ${alpha(brandPrimary, 0.5)}`,
                animation: `${scaleIn} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both`,
              }}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                height: 36,
                width: 36,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <GraduationCap size={18} color="#fff" />
            </Box>
          )}
          <Box sx={{ lineHeight: 1 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
                {schoolBranding ? schoolBranding.name : "SRMS"}
              </Typography>
              {schoolBranding && (
                <Tooltip title="This is your school's verified workspace">
                  <Box sx={{ display: "flex", color: "#34d399", animation: `${scaleIn} 0.4s ease 0.15s both` }}>
                    <BadgeCheck size={13} />
                  </Box>
                </Tooltip>
              )}
            </Stack>
            {schoolBranding && (
              <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", mt: 0.25 }}>
                {[schoolBranding.district, schoolBranding.province].filter(Boolean).join(" · ")}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Hero content */}
        <Box sx={{ position: "relative", zIndex: 1, maxWidth: 440 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              borderRadius: 999,
              bgcolor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              px: 1.5,
              py: 0.5,
              mb: 4,
              ...reveal(0.05),
            }}
          >
            <Box sx={{ height: 6, width: 6, borderRadius: "50%", bgcolor: "#34d399", animation: `${pulse} 2.2s ease-in-out infinite` }} />
            <Typography sx={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.02em", color: "rgba(255,255,255,0.55)" }}>
              School management platform
            </Typography>
          </Box>

          {schoolBranding ? (
            <Box sx={{ mb: 4, ...reveal(0.1) }}>
              <Typography
                sx={{ fontSize: 38, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#fff", mb: schoolBranding.motto ? 1.5 : 0 }}
              >
                {schoolBranding.name}
              </Typography>
              {schoolBranding.motto && (
                <Typography sx={{ fontSize: 15, color: "rgba(255,255,255,0.45)", fontStyle: "italic", lineHeight: 1.6 }}>
                  "{schoolBranding.motto}"
                </Typography>
              )}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 38, fontWeight: 600, lineHeight: 1.18, letterSpacing: "-0.02em", color: "#fff", mb: 4, ...reveal(0.1) }}>
              The complete platform for school administration.
            </Typography>
          )}

          <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, mb: 4, ...reveal(0.15) }}>
            Admissions through graduation — attendance, assessments, fees, and reporting, unified in
            one secure system of record.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            {FEATURES.map(({ icon: Icon, label, hint }, i) => (
              <Box
                key={label}
                sx={{
                  borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.08)",
                  bgcolor: "rgba(255,255,255,0.03)",
                  p: 1.75,
                  backdropFilter: "blur(4px)",
                  transition: "background 200ms ease, border-color 200ms ease",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.06)",
                    borderColor: "rgba(255,255,255,0.16)",
                  },
                  ...reveal(0.2 + i * 0.05),
                }}
              >
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Icon size={16} color="rgba(255,255,255,0.5)" />
                  <Typography sx={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)" }}>
                    {hint}
                  </Typography>
                </Stack>
                <Typography sx={{ mt: 1, fontSize: 12.5, lineHeight: 1.4, color: "rgba(255,255,255,0.6)" }}>
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
            borderTop: "1px solid rgba(255,255,255,0.08)",
            pt: 2.5,
            ...reveal(0.35),
          }}
        >
          <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            © {new Date().getFullYear()} School Records Management System
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", color: "rgba(255,255,255,0.25)" }}>
            <ShieldCheck size={14} />
            <Typography sx={{ fontSize: 11 }}>256-bit SSL</Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Right form panel */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 3, sm: 5 },
          py: 8,
        }}
      >
        <Fade in timeout={500}>
          <Box sx={{ width: "100%", maxWidth: 400 }}>
            {/* Mobile brand header */}
            <Stack spacing={1.5} sx={{ alignItems: "center", mb: 4.5, textAlign: "center", display: { xs: "flex", lg: "none" } }}>
              <Box
                sx={{
                  display: "flex",
                  height: 48,
                  width: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 3,
                  color: "#fff",
                  boxShadow: 2,
                  background: `linear-gradient(135deg, ${brandPrimary}, ${brandAccent})`,
                  transition: "background 700ms ease",
                }}
              >
                {schoolBranding?.logoUrl ? (
                  <Box
                    component="img"
                    src={schoolBranding.logoUrl}
                    alt={schoolBranding.name}
                    sx={{
                      height: 28,
                      width: 28,
                      borderRadius: 1,
                      objectFit: "contain",
                      bgcolor: "rgba(255,255,255,0.15)",
                      animation: `${scaleIn} 0.5s cubic-bezier(0.16, 1, 0.3, 1) both`,
                    }}
                  />
                ) : (
                  <GraduationCap size={24} />
                )}
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Typography sx={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {schoolBranding?.name ?? "SRMS"}
                </Typography>
                {schoolBranding && (
                  <Box sx={{ display: "flex", color: "success.main" }}>
                    <BadgeCheck size={14} />
                  </Box>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                School Records Management System
              </Typography>
            </Stack>

            <Paper
              elevation={2}
              sx={{
                p: { xs: 3.5, sm: 4 },
                borderRadius: 5,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box
                sx={{
                  height: 2,
                  width: 80,
                  borderRadius: 1,
                  mb: 3,
                  background: `linear-gradient(90deg, ${alpha(brandPrimary, 0.6)}, transparent)`,
                  transition: "background 700ms ease",
                }}
              />

              {/* Persistent school identity strip — unmissable regardless of viewport, so
                  someone with several schools' tabs open can never mistake which one this is. */}
              {schoolBranding && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    mb: 2,
                    p: 1,
                    pr: 1.5,
                    borderRadius: 3,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                    border: "1px solid",
                    borderColor: (t) => alpha(t.palette.primary.main, 0.14),
                    transition: "background-color 700ms ease, border-color 700ms ease",
                  }}
                >
                  {schoolBranding.logoUrl ? (
                    <Box
                      component="img"
                      src={schoolBranding.logoUrl}
                      alt={schoolBranding.name}
                      sx={{ height: 24, width: 24, borderRadius: 1.5, objectFit: "contain", bgcolor: "background.paper" }}
                    />
                  ) : (
                    <Box
                      sx={{
                        display: "flex",
                        height: 24,
                        width: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 1.5,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                      }}
                    >
                      <GraduationCap size={13} />
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", flex: 1, minWidth: 0 }} noWrap>
                    {schoolBranding.name}
                  </Typography>
                  <Tooltip title="This is your school's verified workspace">
                    <Box sx={{ display: "flex", color: "success.main", flexShrink: 0 }}>
                      <BadgeCheck size={15} />
                    </Box>
                  </Tooltip>
                </Stack>
              )}

              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                  Sign in
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {schoolBranding
                    ? "Enter your credentials to continue"
                    : "to your school's management platform"}
                </Typography>
              </Box>

              {error && (
                <Alert key={error} severity="error" sx={{ mb: 2.5, animation: `${shake} 0.4s ease` }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={submit} suppressHydrationWarning>
                <Stack spacing={2}>
                  <TextField
                    id="email"
                    label="Email or phone number"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError(null);
                    }}
                    placeholder="you@school.zm or 0977 000 000"
                    autoComplete="username"
                    autoFocus
                    required
                    fullWidth
                    disabled={loading}
                    error={Boolean(error)}
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

                  <Box>
                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                      <Box component="label" htmlFor="password" sx={{ fontSize: 0 }} />
                      <Box sx={{ flex: 1 }} />
                      <Button
                        type="button"
                        variant="text"
                        size="small"
                        onClick={() => setShowForgot((v) => !v)}
                        sx={{ minWidth: 0, p: 0, fontSize: 12, fontWeight: 400, color: "text.secondary", textTransform: "none" }}
                      >
                        Forgot password?
                      </Button>
                    </Stack>
                    <TextField
                      id="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState?.("CapsLock") ?? false)}
                      onBlur={() => setCapsLockOn(false)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      fullWidth
                      disabled={loading}
                      error={Boolean(error)}
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
                                size="small"
                              >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    <Alert severity="info" icon={false} sx={{ bgcolor: "action.hover", color: "text.secondary", fontSize: 12 }}>
                      Contact your school administrator to reset your password — they can set a
                      temporary one from the user management panel.
                    </Alert>
                  </Collapse>

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading || !identifier.trim() || !password}
                    endIcon={!loading ? <ArrowRight size={16} /> : undefined}
                    sx={{
                      boxShadow: (t) => `0 10px 24px -8px ${alpha(t.palette.primary.main, 0.55)}`,
                      transition: "box-shadow 200ms ease, transform 150ms ease",
                      "&:hover": {
                        boxShadow: (t) => `0 12px 28px -6px ${alpha(t.palette.primary.main, 0.65)}`,
                        transform: "translateY(-1px)",
                      },
                      "&:active": { transform: "translateY(0)" },
                    }}
                  >
                    {loading ? (
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

              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", my: 3, color: "text.disabled" }}>
                <Divider sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Secured by SRMS
                </Typography>
                <Divider sx={{ flex: 1 }} />
              </Stack>

              <Stack direction="row" spacing={2.5} sx={{ alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <LockKeyhole size={14} />
                  <Typography variant="caption">Encrypted</Typography>
                </Stack>
                <Divider orientation="vertical" flexItem />
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <Sparkles size={14} />
                  <Typography variant="caption">ECZ aligned</Typography>
                </Stack>
                <Divider orientation="vertical" flexItem />
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <ShieldCheck size={14} />
                  <Typography variant="caption">99.9% uptime</Typography>
                </Stack>
              </Stack>

              <Typography variant="caption" color="text.secondary" align="center" sx={{ display: "block", mt: 3 }}>
                Need access? Contact your school administrator or{" "}
                <Box component="span" sx={{ color: "text.primary" }}>
                  support@srms.zm
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
