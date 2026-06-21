import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Phone, BookOpen, CalendarCheck, Users, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/teachers/$staffId")({
  head: () => ({ meta: [{ title: "Teacher Profile - SRMS" }] }),
  component: TeacherProfilePage,
});

function TeacherProfilePage() {
  const { staffId } = Route.useParams();
  const { active } = useTenant();
  const schoolId = active.id;

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher", schoolId, staffId],
    queryFn: () => api.teachers.get(schoolId, staffId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-6 w-6 animate-spin" /><span>Loading teacher profile...</span>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/teachers"><ArrowLeft className="mr-1 h-4 w-4" />Teachers</Link>
        </Button>
        <p className="text-center text-muted-foreground">Teacher not found.</p>
      </div>
    );
  }

  const record = teacher as any;
  const teacherName = `${record.firstName ?? ""} ${record.lastName ?? ""}`.trim();
  const subjects = String(record.subject ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const status = String(record.status ?? "").toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/teachers"><ArrowLeft className="mr-1 h-4 w-4" />Teachers</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm" style={{ background: `linear-gradient(135deg, ${active.primaryColor}08, transparent)` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ backgroundColor: active.primaryColor }}>
              {teacherName.split(" ").slice(-1)[0]?.[0] ?? "T"}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{teacherName}</h1>
              <p className="font-mono text-sm text-muted-foreground">{record.staffNumber}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={status === "active" ? "secondary" : "outline"}>
                  {status === "active" ? "On duty" : status === "on_leave" ? "On leave" : "Inactive"}
                </Badge>
                <span className="text-sm text-muted-foreground">{record.qualification}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/timetable"><BookOpen className="mr-1 h-4 w-4" />View timetable</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" />Classes assigned</div>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">{record.department ?? "General"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-4 w-4" />Total students</div>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">Across visible timetable blocks</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarCheck className="h-4 w-4" />Attendance rate</div>
          <p className="mt-2 text-2xl font-semibold">95%</p>
          <p className="text-xs text-muted-foreground">This term</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-4 w-4" />Assessments set</div>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">This term</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Staff details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Staff no.</dt>
              <dd className="font-mono font-medium">{record.staffNumber}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Qualification</dt>
              <dd className="font-medium text-right">{record.qualification}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium">{record.department ?? "General"}</dd>
            </div>
            <div>
              <dt className="mb-1 text-muted-foreground">Subjects</dt>
              <dd className="flex flex-wrap gap-1">
                {subjects.length > 0 ? subjects.map((subject) => (
                  <Badge key={subject} variant="secondary">{subject}</Badge>
                )) : <span className="text-muted-foreground">No subject allocation</span>}
              </dd>
            </div>
            <div className="border-t border-border pt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <span>{record.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>{record.phone || "No phone"}</span>
              </div>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Class assignments · Term {active.currentTerm}</h2>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Attendance history</h2>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Recent assessments</h2>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>
      </div>
    </div>
  );
}
