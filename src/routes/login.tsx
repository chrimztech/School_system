import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  Divider,
  alpha,
} from "@mui/material";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SRMS" }] }),
  component: LoginPage,
});

type SchoolBranding = {
  id: string;
  name: string;
  shortCode: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  motto?: string | null;
  district?: string | null;
  province?: string | null;
};

const PENDING_SLUG_KEY = "srms_pending_slug";

function detectSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.hostname.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  if (["www", "app", "portal", "admin", "api", "mail"].includes(sub)) return null;
  return sub;
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

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  useEffect(() => {
    const slug = detectSubdomainSlug() ?? consumePendingSlug();
    if (!slug) return;
    api.public
      .schoolBySlug(slug)
      .then((data: Partial<SchoolBranding>) => {
        if (data?.id) setSchoolBranding(data as SchoolBranding);
      })
      .catch(() => {
        /* ignore — unknown slug */
      });
  }, []);

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

  return (
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
        {/* Decorative glow blobs */}
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
          }}
        />

        {/* Logo */}
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", position: "relative", zIndex: 1 }}>
          {schoolBranding?.logoUrl ? (
            <Box
              component="img"
              src={schoolBranding.logoUrl}
              alt={schoolBranding.name}
              sx={{ height: 36, width: 36, borderRadius: 2, objectFit: "contain", bgcolor: "rgba(255,255,255,0.1)", p: 0.5 }}
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
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
              {schoolBranding ? schoolBranding.name : "SRMS"}
            </Typography>
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
            }}
          >
            <Box sx={{ height: 6, width: 6, borderRadius: "50%", bgcolor: "#34d399" }} />
            <Typography sx={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.02em", color: "rgba(255,255,255,0.55)" }}>
              School management platform
            </Typography>
          </Box>

          {schoolBranding ? (
            <Box sx={{ mb: 4 }}>
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
            <Typography sx={{ fontSize: 38, fontWeight: 600, lineHeight: 1.18, letterSpacing: "-0.02em", color: "#fff", mb: 4 }}>
              The complete platform for school administration.
            </Typography>
          )}

          <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, mb: 4 }}>
            Admissions through graduation — attendance, assessments, fees, and reporting, unified in
            one secure system of record.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            {FEATURES.map(({ icon: Icon, label, hint }) => (
              <Box
                key={label}
                sx={{
                  borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.08)",
                  bgcolor: "rgba(255,255,255,0.03)",
                  p: 1.75,
                  backdropFilter: "blur(4px)",
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
                }}
              >
                {schoolBranding?.logoUrl ? (
                  <Box
                    component="img"
                    src={schoolBranding.logoUrl}
                    alt={schoolBranding.name}
                    sx={{ height: 28, width: 28, borderRadius: 1, objectFit: "contain", bgcolor: "rgba(255,255,255,0.15)" }}
                  />
                ) : (
                  <GraduationCap size={24} />
                )}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {schoolBranding?.name ?? "SRMS"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  School Records Management System
                </Typography>
              </Box>
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
              <Box sx={{ height: 2, width: 80, borderRadius: 1, mb: 3, background: `linear-gradient(90deg, ${alpha(brandPrimary, 0.6)}, transparent)` }} />

              <Box sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                  Sign in
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {schoolBranding
                    ? `to ${schoolBranding.name}'s management platform`
                    : "to your school's management platform"}
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2.5 }}>
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
                  </Box>

                  {showForgot && (
                    <Alert severity="info" icon={false} sx={{ bgcolor: "action.hover", color: "text.secondary", fontSize: 12 }}>
                      Contact your school administrator to reset your password — they can set a
                      temporary one from the user management panel.
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading || !identifier.trim() || !password}
                    endIcon={!loading ? <ArrowRight size={16} /> : undefined}
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
  );
}
