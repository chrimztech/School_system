import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { GraduationCap, Eye, EyeOff, AlertCircle, ShieldCheck, HelpCircle } from "lucide-react";
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

function detectSubdomainSlug(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.hostname.split(".");
  if (parts.length < 3) return null;
  const sub = parts[0].toLowerCase();
  if (["www", "app", "portal", "admin", "api", "mail"].includes(sub)) return null;
  return sub;
}

const STATS = [
  { value: "15+", label: "Modules" },
  { value: "ECZ", label: "Aligned" },
  { value: "99.9%", label: "Uptime" },
  { value: "Multi", label: "Campus" },
];

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5 fill-amber-400" viewBox="0 0 20 20" aria-hidden>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

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
    const slug = detectSubdomainSlug();
    if (!slug) return;
    api.public.schoolBySlug(slug)
      .then((data: any) => {
        if (data?.id) setSchoolBranding(data as SchoolBranding);
      })
      .catch(() => { /* ignore — not on a school subdomain */ });
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

  const brandPrimary = schoolBranding?.primaryColor ?? "#1e3a8a";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left branding panel ──────────────────────────────────────── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-14 overflow-hidden select-none"
        style={{
          background: schoolBranding
            ? `linear-gradient(145deg, color-mix(in srgb, ${brandPrimary} 95%, black) 0%, color-mix(in srgb, ${brandPrimary} 80%, black) 45%, color-mix(in srgb, ${brandPrimary} 90%, black) 100%)`
            : "linear-gradient(145deg, #03071a 0%, #060e2b 45%, #04091f 100%)",
        }}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(59,130,246,0.08) 0%, transparent 28%), linear-gradient(180deg, rgba(165,180,252,0.06) 0%, transparent 40%)",
          }}
        />
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          {schoolBranding?.logoUrl ? (
            <img
              src={schoolBranding.logoUrl}
              alt={schoolBranding.name}
              className="h-10 w-10 rounded-[10px] object-contain bg-white/10 p-1 ring-1 ring-white/10"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/[0.07] ring-1 ring-white/10">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="leading-none">
            <p className="text-[15px] font-bold text-white tracking-tight">
              {schoolBranding ? schoolBranding.name : "SRMS"}
            </p>
            <p className="text-[10px] text-white/35 tracking-[0.18em] uppercase mt-0.5">
              {schoolBranding
                ? `${schoolBranding.district ?? ""} · ${schoolBranding.province ?? ""}`.replace(/^ · | · $/, "").replace(/^ · $/, "")
                : "Platform"}
            </p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-10">
          <div className="space-y-5">
            {/* Status pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]" />
              <span className="text-[11px] font-medium text-white/50 tracking-wide">
                All systems operational · Zambia 2026
              </span>
            </div>

            {/* Headline */}
            {schoolBranding ? (
              <div className="space-y-3">
                <h1 className="text-[46px] font-bold leading-[1.08] tracking-[-0.02em] text-white">
                  {schoolBranding.name}
                </h1>
                {schoolBranding.motto && (
                  <p className="text-[16px] text-white/60 italic leading-relaxed max-w-[320px]">
                    "{schoolBranding.motto}"
                  </p>
                )}
                <p className="text-[14px] text-white/35 leading-relaxed max-w-[300px]">
                  Powered by SRMS — the complete school management platform for Zambian institutions.
                </p>
              </div>
            ) : (
              <h1 className="text-[52px] font-bold leading-[1.05] tracking-[-0.02em] text-white">
                The complete<br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{
                    backgroundImage:
                      "linear-gradient(90deg, #93c5fd 0%, #a5b4fc 50%, #c4b5fd 100%)",
                  }}
                >
                  school management
                </span>
                <br />
                platform.
              </h1>
            )}

            {!schoolBranding && (
              <p className="text-[15px] text-white/40 leading-relaxed max-w-[320px]">
                Purpose-built for Zambian institutions — ECE through Form 6,
                aligned to the 2025 MoE curriculum.
                single campus to multi-site.
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {STATS.map(({ value, label }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 backdrop-blur-sm"
              >
                <p className="text-[26px] font-bold text-white leading-none tracking-tight">
                  {value}
                </p>
                <p className="text-[11px] text-white/35 mt-1.5 uppercase tracking-wider">
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          {!schoolBranding && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-5 space-y-4">
              <StarRating />
              <p className="text-[13px] text-white/55 leading-relaxed italic">
                "SRMS transformed how we manage our 800+ learners. Attendance, fees, and report
                cards — everything lives in one place now. I would not go back to the old way."
              </p>
              <div className="flex items-center gap-3 pt-0.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-bold text-blue-300 ring-1 ring-blue-500/20">
                  BN
                </div>
                <div className="leading-none">
                  <p className="text-[12px] font-semibold text-white/65">Beatrice N.</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Head Teacher · Combined School, Lusaka
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.06] pt-5">
          <p className="text-[10px] text-white/20">
            © {new Date().getFullYear()} School Records Management System
          </p>
          <div className="flex items-center gap-1.5 text-white/20">
            <ShieldCheck className="h-3 w-3" />
            <span className="text-[10px]">256-bit SSL</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex flex-col bg-background">
        <div className="flex flex-1 flex-col justify-center px-10 py-16 sm:px-16 xl:px-24">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            {schoolBranding?.logoUrl ? (
              <img
                src={schoolBranding.logoUrl}
                alt={schoolBranding.name}
                className="h-10 w-10 rounded-xl object-contain"
                style={{ background: brandPrimary + "22" }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
            )}
            <div className="leading-none">
              <p className="text-base font-bold">{schoolBranding?.name ?? "SRMS"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {schoolBranding
                  ? (schoolBranding.district ?? "School Management")
                  : "School Records Management"}
              </p>
            </div>
          </div>

          <div className="w-full max-w-[400px] mx-auto space-y-8">
            {/* Heading */}
            <div className="space-y-1.5">
              <h2 className="text-[26px] font-bold tracking-tight text-foreground leading-tight">
                Welcome back
              </h2>
              <p className="text-sm text-muted-foreground leading-snug">
                {schoolBranding
                  ? `Sign in to ${schoolBranding.name}'s management platform.`
                  : "Sign in to access your school's management platform."}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
                <AlertCircle className="mt-px h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive leading-snug">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={submit} className="space-y-5" suppressHydrationWarning>
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Email address
                </Label>
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
                  className={`h-11 text-sm ${error ? "border-destructive/40 focus-visible:ring-destructive/20" : ""}`}
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Password
                </Label>
                <div className="relative">
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
                    className={`h-11 pr-10 text-sm ${error ? "border-destructive/40 focus-visible:ring-destructive/20" : ""}`}
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
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgot(v => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {showForgot && (
                <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <HelpCircle className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <p className="font-medium text-foreground mb-0.5">Password reset</p>
                    Contact your school administrator to reset your password. They can set a new temporary password for you from the user management panel.
                    <br />Once reset, sign in with the temporary password and then change it from your account menu.
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold tracking-wide"
                disabled={loading || !email.trim() || !password}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  `Sign in${schoolBranding ? ` to ${schoolBranding.shortCode}` : " to SRMS"}`
                )}
              </Button>
            </form>

            {/* Security micro-badge */}
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground/40">
                Secured with 256-bit SSL encryption
              </p>
            </div>

            {/* Support card */}
            <div className="rounded-xl border border-border bg-muted/20 px-5 py-4 space-y-1.5">
              <p className="text-xs font-semibold text-foreground">
                Need access to your account?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contact your school administrator or the SRMS support team at{" "}
                <span className="font-medium text-foreground">support@srms.zm</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel footer */}
        <div className="border-t border-border px-10 py-4 sm:px-16 xl:px-24">
          <p className="text-xs text-muted-foreground/40 text-center lg:text-left">
            © {new Date().getFullYear()} School Records Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
