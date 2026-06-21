import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone, BookOpen, Wallet, CalendarCheck, ShieldAlert, Loader2, Mail, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/students/$studentId")({
  head: () => ({ meta: [{ title: "Student Profile - SRMS" }] }),
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const { active } = useTenant();
  const schoolId = active.id;

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", schoolId, studentId],
    queryFn: () => api.students.get(schoolId, studentId),
  });

  const { data: feePayments = [] } = useQuery({
    queryKey: ["student-fees", schoolId, studentId],
    queryFn: () => api.fees.studentPayments(schoolId, studentId),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" /><span>Loading student profile...</span>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/students"><ArrowLeft className="mr-1 h-4 w-4" />Students</Link>
        </Button>
        <p className="text-center text-muted-foreground">Student not found.</p>
      </div>
    );
  }

  const s = student as any;
  const feeBalance = s.feeBalance ?? 0;
  const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/students"><ArrowLeft className="mr-1 h-4 w-4" />Students</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm" style={{ background: `linear-gradient(135deg, ${active.primaryColor}08, transparent)` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ backgroundColor: active.primaryColor }}>
              {s.firstName?.[0]}{s.lastName?.[0]}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{fullName}</h1>
              <p className="font-mono text-sm text-muted-foreground">{s.admissionNumber}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant={(s.status ?? "").toLowerCase() === "active" ? "secondary" : "outline"}>{s.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {["SECONDARY","COMBINED","FULL"].includes(active.type) && !["PRIMARY","NURSERY"].includes(active.type) ? `Form ${s.grade}` : `Grade ${s.grade}`}
                  {s.section ? ` · Section ${s.section}` : ""}
                </span>
                {s.preferredName && <Badge variant="outline">Prefers {s.preferredName}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/report-card" search={{ studentId }}><BookOpen className="mr-1 h-4 w-4" />Report card</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarCheck className="h-4 w-4" />Attendance rate</div>
          <p className="mt-2 text-2xl font-semibold">{s.attendanceRate != null ? `${s.attendanceRate}%` : "—"}</p>
          <p className="text-xs text-muted-foreground">This term</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-4 w-4" />Average score</div>
          <p className="mt-2 text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">Mid-term assessment</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" />Fee balance</div>
          <p className={`mt-2 text-2xl font-semibold ${feeBalance > 0 ? "text-destructive" : "text-success"}`}>
            {feeBalance > 0 ? `K ${Number(feeBalance).toLocaleString()}` : "Cleared"}
          </p>
          <p className="text-xs text-muted-foreground">Current term</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4" />Medical alerts</div>
          <p className="mt-2 text-sm font-semibold">{s.medicalConditions || s.allergies ? "Captured" : "None recorded"}</p>
          <p className="text-xs text-muted-foreground">{s.bloodGroup || "Blood group not captured"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Learner profile</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Full name</dt>
              <dd className="font-medium text-right">{fullName}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Admission no.</dt>
              <dd className="font-mono font-medium text-right">{s.admissionNumber}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Admission date</dt>
              <dd className="font-medium">{s.admissionDate || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Date of birth</dt>
              <dd className="font-medium">{s.dateOfBirth || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="font-medium">{s.gender || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Nationality</dt>
              <dd className="font-medium">{s.nationality || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Birth certificate</dt>
              <dd className="font-medium text-right">{s.birthCertificateNo || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">National ID</dt>
              <dd className="font-medium text-right">{s.nationalId || "—"}</dd>
            </div>
            {(s.studentPhone || s.studentEmail) && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Learner contact</p>
                <div className="space-y-2">
                  {s.studentPhone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{s.studentPhone}</p>}
                  {s.studentEmail && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{s.studentEmail}</p>}
                </div>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Parent / guardian</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{s.guardian || "—"}</p>
              <p className="text-muted-foreground">{s.guardianRelationship || "Relationship not captured"}</p>
            </div>
            {s.guardianPhone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{s.guardianPhone}</p>}
            {s.guardianAltPhone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{s.guardianAltPhone} (alt)</p>}
            {s.guardianEmail && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{s.guardianEmail}</p>}
            {(s.guardianOccupation || s.guardianWorkplace) && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Work profile</p>
                <p className="mt-1 font-medium">{s.guardianOccupation || "Occupation not captured"}</p>
                <p className="text-muted-foreground">{s.guardianWorkplace || "Workplace not captured"}</p>
              </div>
            )}
            {(s.guardianAddress || s.city) && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Address</p>
                <p className="mt-1">{s.guardianAddress || s.address || "Address not captured"}</p>
                {s.city && <p className="text-muted-foreground">{s.city}</p>}
              </div>
            )}
            {(s.emergencyContactName || s.emergencyContactPhone) && (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Emergency contact</p>
                <p className="mt-1 font-medium">{s.emergencyContactName || "—"}</p>
                <p className="text-muted-foreground">
                  {[s.emergencyContactRelationship, s.emergencyContactPhone].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Welfare & health</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Religion</dt>
              <dd className="font-medium">{s.religion || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Blood group</dt>
              <dd className="font-medium">{s.bloodGroup || "—"}</dd>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Medical conditions</p>
              <p className="mt-1">{s.medicalConditions || "No medical conditions captured."}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Allergies</p>
              <p className="mt-1">{s.allergies || "No allergies captured."}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Learner address</p>
              <p className="mt-1">{s.address || "Address not captured."}</p>
              {s.city && <p className="text-muted-foreground">{s.city}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Academic performance · Term {active.currentTerm}</h2>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold">Attendance history</h2>
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Fee payment history</h2>
        {(feePayments as any[]).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(feePayments as any[]).map((payment: any) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-muted-foreground">{(payment.paymentDate ?? payment.date ?? "").slice(0, 10)}</TableCell>
                  <TableCell className="font-medium">K {Number(payment.amount).toLocaleString()}</TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell><Badge variant="secondary">{payment.status ?? "completed"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        )}
      </div>
    </div>
  );
}
