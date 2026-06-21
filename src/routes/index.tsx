import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, CalendarCheck, Wallet, GraduationCap, TrendingUp, AlertCircle, ShieldAlert, ClipboardList, Truck, Download, Plus, UserPlus, Receipt, Wrench, Award, ShieldCheck, BookText, HandCoins, Heart, Building2, Activity, Layers, LifeBuoy, FileCog, FileText, CreditCard, HardDrive, Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SRMS" },
      { name: "description", content: "Live overview of enrolment, attendance, fees and assessments." },
    ],
  }),
  component: Dashboard,
});

function ParentDashboard() {
  const { user } = useAuth();
  const { active } = useTenant();
  const schoolId = active.id;

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["guardian-children", schoolId, user?.email],
    queryFn: () => api.students.listByGuardian(schoolId, user!.email),
    enabled: !!user?.email,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements", schoolId],
    queryFn: () => api.communication.announcements(schoolId),
    retry: false,
  });

  const childList = children as any[];
  const announcementList = announcements as any[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" /><span>Loading your child's information…</span>
      </div>
    );
  }

  if (childList.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parent Portal" description={`Welcome, ${user?.name} · ${active.name}`} />
        <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">No learners linked to your account</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact the school office to link your email address ({user?.email}) to your child's admission record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Parent Portal" description={`Welcome, ${user?.name} · ${active.name}`} />
      {childList.map((child: any) => {
        const fullName = [child.firstName, child.lastName].filter(Boolean).join(" ");
        const feeBalance = Number(child.feeBalance ?? 0);
        return (
          <div key={child.id} className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm" style={{ background: `linear-gradient(135deg, ${active.primaryColor}08, transparent)` }}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: active.primaryColor }}>
                  {child.firstName?.[0]}{child.lastName?.[0]}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{fullName}</h2>
                  <p className="text-sm text-muted-foreground">{child.admissionNumber} · Grade {child.grade}{child.section ? ` · ${child.section}` : ""}</p>
                  <div className="mt-1 flex gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${(child.status ?? "").toLowerCase() === "active" ? "border-transparent bg-secondary text-secondary-foreground" : "border-border text-muted-foreground"}`}>
                      {child.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarCheck className="h-4 w-4" />Attendance</div>
                <p className="mt-2 text-2xl font-semibold">{child.attendanceRate != null ? `${child.attendanceRate}%` : "—"}</p>
                <p className="text-xs text-muted-foreground">This term</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" />Fee balance</div>
                <p className={`mt-2 text-2xl font-semibold ${feeBalance > 0 ? "text-destructive" : "text-green-600"}`}>
                  {feeBalance > 0 ? `K ${feeBalance.toLocaleString()}` : "Cleared"}
                </p>
                <p className="text-xs text-muted-foreground">Current term</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><GraduationCap className="h-4 w-4" />Class</div>
                <p className="mt-2 text-lg font-semibold">Grade {child.grade}</p>
                <p className="text-xs text-muted-foreground">Section {child.section || "—"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4" />Medical</div>
                <p className="mt-2 text-sm font-semibold">{child.medicalConditions || child.allergies ? "On file" : "None on file"}</p>
                <p className="text-xs text-muted-foreground">{child.bloodGroup || "Blood group not captured"}</p>
              </div>
            </div>
          </div>
        );
      })}
      {announcementList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">School announcements</h2>
          <div className="divide-y divide-border">
            {announcementList.slice(0, 5).map((a: any) => (
              <div key={a.id} className="py-3">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{a.publishDate ?? a.createdAt?.slice(0, 10)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const { active: school, tenants, activePlan } = useTenant();
  const { user, isSystemAdmin } = useAuth();
  const qc = useQueryClient();

  if (user?.role === "parent") return <ParentDashboard />;
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [annForm, setAnnForm] = useState({ title: "", body: "", channels: "SMS" });
  const activeSubscribers = tenants.filter((t) => ["active", "trial"].includes(t.subscription.status)).length;
  const platformMrr = tenants.filter((t) => t.subscription.status === "active").reduce((s, t) => s + t.subscription.amount, 0);

  const schoolId = school.id;
  const { data: dash } = useQuery({ queryKey: ["dashboard", schoolId], queryFn: () => api.dashboard(schoolId), retry: false });
  const { data: attendanceSummary } = useQuery({ queryKey: ["attendance-summary", schoolId], queryFn: () => api.attendance.summary(schoolId), retry: false });
  const { data: feesCollected } = useQuery({ queryKey: ["fees-collected", schoolId], queryFn: () => api.fees.collected(schoolId), retry: false });
  const { data: announcements = [] } = useQuery({ queryKey: ["announcements", schoolId], queryFn: () => api.communication.announcements(schoolId), retry: false });

  const attendanceToday = attendanceSummary ?? (dash as any)?.attendanceToday ?? { present: 0, absent: 0, late: 0, rate: 0 };
  const fees = feesCollected ?? (dash as any)?.fees ?? { collected: 0, outstanding: 0, collectionRate: 0 };
  const announcementList = announcements as any[];

  const feeTrend = ((dash as any)?.feeTrend ?? []).length > 0
    ? (dash as any).feeTrend.map((p: any) => ({ month: p.label, collected: p.value, outstanding: 0 }))
    : [];
  const enrolmentByPhase: { phase: string; count: number }[] = ((dash as any)?.enrolmentByPhase ?? []).length > 0
    ? (dash as any).enrolmentByPhase.map((p: any) => ({ phase: p.phase as string, count: p.count as number }))
    : [];
  const attendanceTrend = ((dash as any)?.attendanceTrend ?? []).length > 0
    ? (dash as any).attendanceTrend.map((p: any) => ({ day: p.label, rate: p.value }))
    : [];
  const recentAttendance: { class: string; present: number; total: number; rate: number }[] = [];

  const createAnnouncementMutation = useMutation({
    mutationFn: (data: any) => api.communication.createAnnouncement(schoolId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements", schoolId] }); toast.success("Announcement posted"); setAnnForm({ title: "", body: "", channels: "SMS" }); setAnnouncementOpen(false); },
    onError: () => toast.error("Failed to post announcement"),
  });

  const postAnnouncement = () => {
    if (!annForm.title.trim() || !annForm.body.trim()) { toast.error("Title and message are required"); return; }
    createAnnouncementMutation.mutate({ title: annForm.title, body: annForm.body, channels: annForm.channels, audience: "ALL", publishDate: new Date().toISOString().slice(0, 10) });
  };

  return (
    <div className="space-y-6">
      {isSystemAdmin && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">System admin mode</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                You are viewing the shared platform workspace across {tenants.length} schools, with {activeSubscribers} active or trial subscriptions
                and K {platformMrr.toLocaleString()} in active monthly revenue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/sys-admin">Open system admin</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/platform-ops">Open platform ops</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {isSystemAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Link to="/platform-ops" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/70 hover:bg-primary/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Platform ops</p>
                <p className="mt-1 text-xs text-muted-foreground">Services, queues, incidents and release readiness.</p>
              </div>
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </Link>

          <Link to="/tenant-success" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/70 hover:bg-emerald-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Tenant success</p>
                <p className="mt-1 text-xs text-muted-foreground">Health, renewals, adoption, and expansion risk.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
          </Link>

          <Link to="/plan-catalog" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-amber-500/70 hover:bg-amber-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Plan catalog</p>
                <p className="mt-1 text-xs text-muted-foreground">Commercial packaging, add-ons, and promotions.</p>
              </div>
              <Layers className="h-5 w-5 text-amber-600" />
            </div>
          </Link>

          <Link to="/support-desk" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-sky-500/70 hover:bg-sky-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Support desk</p>
                <p className="mt-1 text-xs text-muted-foreground">Cross-tenant tickets, escalations, and knowledge links.</p>
              </div>
              <LifeBuoy className="h-5 w-5 text-sky-600" />
            </div>
          </Link>
        </div>
      )}

      {isSystemAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Link to="/platform-config" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-slate-500/70 hover:bg-slate-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Platform config</p>
                <p className="mt-1 text-xs text-muted-foreground">Global defaults, security baselines, and rollout flags.</p>
              </div>
              <FileCog className="h-5 w-5 text-slate-600" />
            </div>
          </Link>

          <Link to="/tenant-lifecycle" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-orange-500/70 hover:bg-orange-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Tenant lifecycle</p>
                <p className="mt-1 text-xs text-muted-foreground">Implementation, go-live, recovery, and suspension flows.</p>
              </div>
              <Wrench className="h-5 w-5 text-orange-600" />
            </div>
          </Link>

          <Link to="/platform-audit" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-rose-500/70 hover:bg-rose-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Platform audit</p>
                <p className="mt-1 text-xs text-muted-foreground">Cross-tenant admin, commercial, and operational evidence.</p>
              </div>
              <FileText className="h-5 w-5 text-rose-600" />
            </div>
          </Link>
        </div>
      )}

      {isSystemAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Link to="/revenue-ops" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/70 hover:bg-emerald-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Revenue ops</p>
                <p className="mt-1 text-xs text-muted-foreground">MRR, renewals, collections, and expansion signals across tenants.</p>
              </div>
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </div>
          </Link>

          <Link to="/data-governance" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-slate-500/70 hover:bg-slate-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Data governance</p>
                <p className="mt-1 text-xs text-muted-foreground">Privacy requests, retention rules, and tenant export governance.</p>
              </div>
              <HardDrive className="h-5 w-5 text-slate-600" />
            </div>
          </Link>
        </div>
      )}

      {isSystemAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Link to="/approval-center" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/70 hover:bg-emerald-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Approval center</p>
                <p className="mt-1 text-xs text-muted-foreground">Controlled approvals for discounts, deletions, contracts, and partner exceptions.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
          </Link>

          <Link to="/developer-console" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-sky-500/70 hover:bg-sky-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Developer console</p>
                <p className="mt-1 text-xs text-muted-foreground">API keys, webhook health, and partner sandbox operations.</p>
              </div>
              <Wrench className="h-5 w-5 text-sky-600" />
            </div>
          </Link>

          <Link to="/tenant-workbench" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-indigo-500/70 hover:bg-indigo-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Tenant workbench</p>
                <p className="mt-1 text-xs text-muted-foreground">Jump into tenant context, manage handoffs, and run platform support actions.</p>
              </div>
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>
          </Link>
        </div>
      )}

      {isSystemAdmin && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Link to="/partner-management" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-indigo-500/70 hover:bg-indigo-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Partner management</p>
                <p className="mt-1 text-xs text-muted-foreground">Resellers, implementation partners, and regional enablement.</p>
              </div>
              <Users className="h-5 w-5 text-indigo-600" />
            </div>
          </Link>

          <Link to="/contract-center" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-amber-500/70 hover:bg-amber-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Contract center</p>
                <p className="mt-1 text-xs text-muted-foreground">MSAs, DPAs, order forms, and renewal paperwork.</p>
              </div>
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
          </Link>

          <Link to="/status-center" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-rose-500/70 hover:bg-rose-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Status center</p>
                <p className="mt-1 text-xs text-muted-foreground">Incidents, maintenance windows, and service communications.</p>
              </div>
              <AlertCircle className="h-5 w-5 text-rose-600" />
            </div>
          </Link>
        </div>
      )}

      {!isSystemAdmin && (
      <>
      <PageHeader
        title={`Welcome back, ${school.name}`}
        description={`Term ${school.currentTerm}, ${school.currentYear} · ${school.type} school configuration`}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Snapshot exported")}><Download className="mr-1 h-4 w-4" />Export snapshot</Button>
            <Button asChild><Link to="/students"><Plus className="mr-1 h-4 w-4" />Enrol student</Link></Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
        <section className="surface-card-strong rounded-[30px] p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Building2 className="h-3.5 w-3.5" />
            {school.type} school workspace
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
            A clearer operating view for {school.shortCode}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {school.campuses.length} campus{school.campuses.length === 1 ? "" : "es"}, {school.totalTeachers.toLocaleString()} teachers,
            and {school.totalClasses.toLocaleString()} classes running on the {activePlan.name} plan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{school.curriculum ?? "ECZ"} curriculum</Badge>
            <Badge variant="outline">{school.ownership ?? "School"}</Badge>
            <Badge variant="outline">{school.category ?? "Day"}</Badge>
            <Badge variant="outline">{school.province}</Badge>
          </div>
          <div className="mt-6 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Learners</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{school.totalStudents.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Teaching team</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{school.totalTeachers.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Campuses live</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {school.campuses.length}/{school.subscription.campusLimit}
              </p>
            </div>
          </div>
        </section>

        <section className="surface-card rounded-[30px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Operational rhythm</p>
              <p className="mt-1 text-xs text-muted-foreground">What needs attention this term.</p>
            </div>
            <Badge variant={fees.collectionRate >= 75 ? "success" : "warning"}>{fees.collectionRate}% collected</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {[
              {
                label: "Attendance today",
                value: `${attendanceToday.present} present · ${attendanceToday.absent} absent`,
              },
              {
                label: "Fee collection",
                value: `K ${fees.collected.toLocaleString()} received`,
              },
              {
                label: "Support tier",
                value: school.subscription.supportLevel,
              },
              {
                label: "Renewal",
                value: school.subscription.renewalDate || "Not scheduled",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-right text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={school.totalStudents} hint="+12 this term" accent="primary" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Attendance Today" value={`${attendanceToday.rate}%`} hint={`${attendanceToday.present} present · ${attendanceToday.absent} absent`} accent="success" icon={<CalendarCheck className="h-4 w-4" />} />
        <StatCard label="Fees Collected" value={`K ${fees.collected.toLocaleString()}`} hint={`${fees.collectionRate}% of term target`} accent="accent" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Outstanding" value={`K ${fees.outstanding.toLocaleString()}`} hint="Across 87 students" accent="warning" icon={<AlertCircle className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">School structure</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {school.campuses.length} campus{school.campuses.length === 1 ? "" : "es"} across {school.levels.length} academic level{school.levels.length === 1 ? "" : "s"}.
            </p>
          </div>
          <Badge variant="outline">
            {school.campuses.length}/{school.subscription.campusLimit} campuses on plan
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {school.campuses.map((campus) => (
            <div key={campus.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{campus.name}</p>
                  <p className="text-xs text-muted-foreground">{campus.district} · {campus.status}</p>
                </div>
                <Badge variant="secondary">{campus.code}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {campus.levels.map((level) => (
                  <Badge key={`${campus.id}-${level}`} variant="outline">
                    {level.replaceAll("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Fee collection trend</h2>
              <p className="text-xs text-muted-foreground">Last 5 months · Zambian Kwacha</p>
            </div>
            <Badge variant="secondary" className="gap-1"><TrendingUp className="h-3 w-3" /> +8.2%</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={feeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="collected" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Enrolment by phase</h2>
          <p className="text-xs text-muted-foreground">Combined school</p>
          <div className="mt-4 space-y-3">
            {enrolmentByPhase.map((p) => (
              <div key={p.phase}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{p.phase}</span>
                  <span className="font-medium text-muted-foreground">{p.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(p.count / 350) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Link to="/enterprise-analytics" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/70 hover:bg-primary/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Enterprise analytics</p>
              <p className="mt-1 text-xs text-muted-foreground">Executive metrics, budget health and platform adoption.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Open executive dashboard</div>
        </Link>

        <Link to="/security" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-rose-500/70 hover:bg-rose-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Security operations</p>
              <p className="mt-1 text-xs text-muted-foreground">Access controls, incident signals and compliance posture.</p>
            </div>
            <ShieldAlert className="h-5 w-5 text-rose-500" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Review security dashboard</div>
        </Link>

        <Link to="/vendor-management" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/70 hover:bg-emerald-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Vendor management</p>
              <p className="mt-1 text-xs text-muted-foreground">Supplier contracts, procurement, and spending efficiency.</p>
            </div>
            <Truck className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Manage key suppliers</div>
        </Link>

        <Link to="/compliance" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-slate-500/70 hover:bg-slate-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Compliance management</p>
              <p className="mt-1 text-xs text-muted-foreground">Policy status, audits and regulatory readiness.</p>
            </div>
            <ClipboardList className="h-5 w-5 text-slate-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Open compliance dashboard</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link to="/admissions" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-sky-500/70 hover:bg-sky-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Admissions hub</p>
              <p className="mt-1 text-xs text-muted-foreground">Pipeline, offers, and learner intake readiness before enrolment.</p>
            </div>
            <UserPlus className="h-5 w-5 text-sky-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Open applicant pipeline</div>
        </Link>

        <Link to="/procurement" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-amber-500/70 hover:bg-amber-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Procurement hub</p>
              <p className="mt-1 text-xs text-muted-foreground">Requisitions, contract renewals, and approval workflows.</p>
            </div>
            <Receipt className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Review open requisitions</div>
        </Link>

        <Link to="/facilities" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-orange-500/70 hover:bg-orange-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Facilities & maintenance</p>
              <p className="mt-1 text-xs text-muted-foreground">Work orders, campus assets, and preventive maintenance planning.</p>
            </div>
            <Wrench className="h-5 w-5 text-orange-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Manage campus operations</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link to="/risk-register" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-red-500/70 hover:bg-red-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Risk register</p>
              <p className="mt-1 text-xs text-muted-foreground">Track institution-wide risks, owners, mitigations and review cadence.</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-red-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Review open risk items</div>
        </Link>

        <Link to="/alumni" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-indigo-500/70 hover:bg-indigo-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Alumni relations</p>
              <p className="mt-1 text-xs text-muted-foreground">Manage donor campaigns, mentorship, and reunion programmes.</p>
            </div>
            <Award className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Open alumni network</div>
        </Link>

        <Link to="/knowledge-base" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-teal-500/70 hover:bg-teal-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Knowledge base</p>
              <p className="mt-1 text-xs text-muted-foreground">Operating guides for onboarding, integrations, data operations and governance.</p>
            </div>
            <BookText className="h-5 w-5 text-teal-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Browse admin playbooks</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link to="/bursaries" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-amber-500/70 hover:bg-amber-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Bursaries & scholarships</p>
              <p className="mt-1 text-xs text-muted-foreground">Track financial aid awards, review applications, and manage renewals.</p>
            </div>
            <HandCoins className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Review award pipeline</div>
        </Link>

        <Link to="/student-welfare" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-rose-500/70 hover:bg-rose-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Student welfare</p>
              <p className="mt-1 text-xs text-muted-foreground">Coordinate pastoral care, vulnerable learner support, and intervention follow-up.</p>
            </div>
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Open case and support queue</div>
        </Link>

        <Link to="/staff-development" className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-emerald-500/70 hover:bg-emerald-500/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Staff development</p>
              <p className="mt-1 text-xs text-muted-foreground">Manage training plans, certification renewals, and coaching commitments.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Review capability pipeline</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Attendance this week</h2>
            <Badge variant="outline">{attendanceToday.rate}% today</Badge>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis domain={[80, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="rate" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Class attendance · today</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/attendance">View all</Link></Button>
          </div>
          <div className="space-y-2">
            {recentAttendance.map((c) => (
              <div key={c.class} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.class}</p>
                    <p className="text-xs text-muted-foreground">{c.present}/{c.total} present</p>
                  </div>
                </div>
                <Badge variant={c.rate >= 90 ? "secondary" : c.rate >= 80 ? "outline" : "destructive"}>
                  {c.rate}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent announcements</h2>
          <Button variant="ghost" size="sm" onClick={() => setAnnouncementOpen(true)}><Plus className="mr-1 h-3 w-3" />New announcement</Button>
        </div>
        <div className="divide-y divide-border">
          {announcementList.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No announcements yet.</p>}
          {announcementList.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                <span>{a.publishDate ?? a.createdAt?.slice(0, 10)}</span>
                <div className="flex gap-1">
                  {(typeof a.channels === "string"
                    ? a.channels.split(",").filter(Boolean)
                    : Array.isArray(a.channels) ? a.channels : []
                  ).map((c: string) => <Badge key={c} variant="outline" className="text-[10px]">{c.trim()}</Badge>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Title *</Label>
              <Input className="mt-1" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Term 2 mid-term results available" maxLength={100} />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea className="mt-1" rows={4} value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} placeholder="Dear parents and guardians..." />
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={annForm.channels} onValueChange={(v) => setAnnForm({ ...annForm, channels: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="USSD">USSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Cancel</Button>
            <Button onClick={postAnnouncement}>Post announcement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
