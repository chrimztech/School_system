import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { GraduationCap, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
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

const CAPABILITIES = [
  "Real-time attendance & gradebook",
  "ECZ-aligned report cards",
  "Fee billing & reconciliation",
  "Role-based access for every campus",
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

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left branding panel ──────────────────────────────────────── */}
      <div
        className="relative hidden lg:flex flex-col justify-between p-16 overflow-hidden select-none"
        style={{
          background: schoolBranding
            ? `color-mix(in srgb, ${brandPrimary} 88%, black)`
            : "#0a0a0b",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
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
        <div className="max-w-[420px] space-y-9">
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
            <h1 className="text-[42px] font-semibold leading-[1.15] tracking-[-0.02em] text-white">
              The operating system<br />for your school.
            </h1>
          )}

          <p className="text-[14px] text-white/40 leading-relaxed">
            Admissions through graduation — attendance, assessments, fees, and
            reporting, in one place.
          </p>

          <ul className="space-y-3">
            {CAPABILITIES.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[13px] text-white/50">
                <Check className="h-3.5 w-3.5 shrink-0 text-white/25" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-5">
          <p className="text-[11px] text-white/25">
            © {new Date().getFullYear()} School Records Management System
          </p>
          <p className="text-[11px] text-white/25">256-bit SSL</p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-10 py-16 sm:px-16 xl:px-24">
        <div className="w-full max-w-[380px]">
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

          <div className="space-y-8">
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
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
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
                  className={`h-10 text-sm ${error ? "border-destructive/40 focus-visible:ring-destructive/20" : ""}`}
                />
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
                    className={`h-10 pr-10 text-sm ${error ? "border-destructive/40 focus-visible:ring-destructive/20" : ""}`}
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
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Contact your school administrator to reset your password — they can
                  set a temporary one from the user management panel.
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-10 text-sm font-medium bg-[#0a0a0b] text-white hover:bg-[#0a0a0b]/90 hover:translate-y-0 shadow-none hover:shadow-none"
                disabled={loading || !email.trim() || !password}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
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
