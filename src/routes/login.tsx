import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  GraduationCap,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  Lock,
  ArrowRight,
  CalendarCheck,
  FileBadge,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — SRMS" }] }),
  component: LoginPage,
});

type SchoolBranding = {
  name: string;
  shortCode: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  motto?: string;
  district?: string;
  province?: string;
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
  { icon: CalendarCheck, label: "Real-time attendance & gradebook" },
  { icon: FileBadge, label: "ECZ-aligned report cards" },
  { icon: Wallet, label: "Fee billing & reconciliation" },
  { icon: ShieldCheck, label: "Role-based access, every campus" },
];

function LoginPage() {
  const { completeSignIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
    api.public.schoolBySlug(slug)
      .then((data: any) => {
        if (data?.id) setSchoolBranding(data as SchoolBranding);
      })
      .catch(() => { /* ignore — unknown slug */ });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await api.login(email.trim(), password);
      completeSignIn(auth);
      toast.success(`Welcome back, ${auth.name}!`);
      navigate({ to: "/" });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.response?.data?.error ??
          "Invalid email address or password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const brandPrimary = schoolBranding?.primaryColor ?? "#111113";
  const leftPanelBg = schoolBranding
    ? `color-mix(in srgb, ${brandPrimary} 88%, black)`
    : "color-mix(in oklab, var(--foreground) 94%, black)";

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left branding panel ──────────────────────────────────────── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-16 overflow-hidden select-none"
        style={{ background: leftPanelBg }}
      >
        {/* Decorative dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 0)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 60% 55% at 20% 15%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 20% 15%, black, transparent 75%)",
          }}
        />
        {/* Decorative glow blobs */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-[110px]"
          style={{ background: "color-mix(in oklab, var(--primary) 55%, transparent)", opacity: 0.35 }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full blur-[100px]"
          style={{ background: "color-mix(in oklab, var(--accent) 55%, transparent)", opacity: 0.22 }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          {schoolBranding?.logoUrl ? (
            <img
              src={schoolBranding.logoUrl}
              alt={schoolBranding.name}
              className="h-9 w-9 rounded-lg object-contain bg-white/10 p-1"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
              <GraduationCap className="h-4.5 w-4.5 text-white" />
            </div>
          )}
          <div className="leading-none">
            <p className="text-[14px] font-semibold text-white tracking-tight">
              {schoolBranding ? schoolBranding.name : "SRMS"}
            </p>
            {schoolBranding && (
              <p className="text-[10px] text-white/30 tracking-wide mt-0.5">
                {[schoolBranding.district, schoolBranding.province].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-[440px] space-y-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-medium tracking-wide text-white/55 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            School management platform
          </span>

          {schoolBranding ? (
            <div className="space-y-3">
              <h1 className="text-[38px] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
                {schoolBranding.name}
              </h1>
              {schoolBranding.motto && (
                <p className="text-[15px] text-white/45 italic leading-relaxed">
                  "{schoolBranding.motto}"
                </p>
              )}
            </div>
          ) : (
            <h1 className="text-[38px] font-semibold leading-[1.18] tracking-[-0.02em] text-white">
              The complete platform for school administration.
            </h1>
          )}

          <p className="text-[14px] text-white/40 leading-relaxed">
            Admissions through graduation — attendance, assessments, fees, and
            reporting, unified in one secure system of record.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 backdrop-blur-sm"
              >
                <Icon className="h-4 w-4 text-white/50" />
                <p className="mt-2 text-[12.5px] leading-snug text-white/60">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.08] pt-5">
          <p className="text-[11px] text-white/25">
            © {new Date().getFullYear()} School Records Management System
          </p>
          <p className="inline-flex items-center gap-1.5 text-[11px] text-white/25">
            <ShieldCheck className="h-3.5 w-3.5" />
            256-bit SSL
          </p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 sm:px-10">
        <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            {schoolBranding?.logoUrl ? (
              <img
                src={schoolBranding.logoUrl}
                alt={schoolBranding.name}
                className="h-9 w-9 rounded-lg object-contain"
                style={{ background: brandPrimary + "22" }}
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-4.5 w-4.5" />
              </div>
            )}
            <p className="text-[15px] font-semibold">{schoolBranding?.name ?? "SRMS"}</p>
          </div>

          <div className="space-y-7 rounded-2xl border border-border/60 bg-card/60 p-7 shadow-soft backdrop-blur-sm sm:p-8">
            {/* Heading */}
            <div className="space-y-1.5">
              <h2 className="text-[22px] font-semibold tracking-tight text-foreground leading-tight">
                Sign in
              </h2>
              <p className="text-sm text-muted-foreground leading-snug">
                {schoolBranding
                  ? `to ${schoolBranding.name}'s management platform`
                  : "to your school's management platform"}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="mt-px h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive leading-snug">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={submit} className="space-y-4" suppressHydrationWarning>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="you@school.zm"
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={loading}
                    className={`h-10 pl-9 text-sm ${error ? "border-destructive/40 focus-visible:ring-destructive/20" : ""}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowForgot((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className={`h-10 pl-9 pr-10 text-sm ${error ? "border-destructive/40 focus-visible:ring-destructive/20" : ""}`}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {showForgot && (
                <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
                  Contact your school administrator to reset your password — they can
                  set a temporary one from the user management panel.
                </p>
              )}

              <Button
                type="submit"
                className="group w-full h-10 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 hover:translate-y-0 shadow-none hover:shadow-none"
                disabled={loading || !email.trim() || !password}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground/70 text-center">
              Need access? Contact your school administrator or{" "}
              <span className="text-foreground">support@srms.zm</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
