import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone, BookOpen, Wallet, CalendarCheck, ShieldAlert, Loader2, Mail, MapPin, Bus } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant, formatGrade } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/students/$studentId")({
  head: () => ({ meta: [{ title: "Student Profile - SRMS" }] }),
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();
  const term = String(active.currentTerm ?? "1");
  const year = String(active.currentYear ?? new Date().getFullYear());

  const [transportOpen, setTransportOpen] = useState(false);
  const [transportForm, setTransportForm] = useState({ routeId: "", pickupStop: "" });

  const { data: student, isLoading } = useQuery({
    queryKey: ["student", schoolId, studentId],
    queryFn: () => api.students.get(schoolId, studentId),
  });

  const { data: feePayments = [] } = useQuery({
    queryKey: ["student-fees", schoolId, studentId],
    queryFn: () => api.fees.studentPayments(schoolId, studentId),
    enabled: !!studentId,
  });

  const { data: enrolments = [] } = useQuery({
    queryKey: ["transport-enrolments", schoolId],
    queryFn: () => api.transport.enrolments(schoolId),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["transport-routes", schoolId],
    queryFn: () => api.transport.routes(schoolId),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["transport-vehicles", schoolId],
    queryFn: () => api.transport.vehicles(schoolId),
  });

  const enrolMutation = useMutation({
    mutationFn: (data: any) => api.transport.enrolStudent(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-enrolments", schoolId] });
      toast.success("Assigned to route");
      setTransportOpen(false);
    },
    onError: () => toast.error("Failed to assign route"),
  });

  const updateEnrolmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.transport.updateEnrolment(schoolId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-enrolments", schoolId] });
      toast.success("Route assignment updated");
      setTransportOpen(false);
    },
    onError: () => toast.error("Failed to update route assignment"),
  });

  const removeEnrolmentMutation = useMutation({
    mutationFn: (id: string) => api.transport.deleteEnrolment(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-enrolments", schoolId] });
      toast.success("Removed from transport");
    },
    onError: () => toast.error("Failed to remove from transport"),
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

  const currentEnrolment = (enrolments as any[]).find((e: any) => e.studentId === studentId && e.status !== "INACTIVE");
  const currentRoute = currentEnrolment ? (routes as any[]).find((r: any) => r.id === currentEnrolment.routeId || r.routeName === currentEnrolment.routeName) : null;
  const currentVehicle = currentRoute ? (vehicles as any[]).find((v: any) => v.id === currentRoute.vehicleId) : null;

  const openTransportDialog = () => {
    setTransportForm({ routeId: currentRoute?.id ?? "", pickupStop: currentEnrolment?.pickupStop ?? "" });
    setTransportOpen(true);
  };

  const saveTransportAssignment = () => {
    if (!transportForm.routeId) {
      toast.error("Select a route");
      return;
    }
    const route = (routes as any[]).find((r: any) => r.id === transportForm.routeId);
    const payload = {
      studentId,
      studentName: fullName,
      grade: s.grade ?? null,
      routeId: transportForm.routeId,
      routeName: route?.routeName ?? "",
      pickupStop: transportForm.pickupStop.trim() || null,
      term,
      academicYear: year,
    };
    if (currentEnrolment) {
      updateEnrolmentMutation.mutate({ id: currentEnrolment.id, data: payload });
    } else {
      enrolMutation.mutate(payload);
    }
  };

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
                  {formatGrade(s.grade, active.type)}
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transport</h2>
          {currentEnrolment ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openTransportDialog}>Change route</Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(`Remove ${fullName} from transport?`)) removeEnrolmentMutation.mutate(currentEnrolment.id);
                }}
              >
                Remove
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={openTransportDialog}><Bus className="mr-1 h-4 w-4" />Assign to route</Button>
          )}
        </div>
        {currentEnrolment ? (
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Route</p>
              <p className="mt-1 font-medium">{currentEnrolment.routeName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="mt-1 font-medium">{currentVehicle?.plateNumber ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Driver</p>
              <p className="mt-1 font-medium">{currentVehicle?.driverName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pickup stop</p>
              <p className="mt-1 font-medium">{currentEnrolment.pickupStop || "—"}</p>
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">Not currently assigned to a bus route.</p>
        )}
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

      <Dialog open={transportOpen} onOpenChange={setTransportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{currentEnrolment ? "Change route" : "Assign to route"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Route *</Label>
              <Select value={transportForm.routeId} onValueChange={(v) => setTransportForm({ ...transportForm, routeId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={(routes as any[]).length === 0 ? "No routes configured yet" : "Select a route"} /></SelectTrigger>
                <SelectContent>
                  {(routes as any[]).map((r: any) => {
                    const vehicle = (vehicles as any[]).find((v: any) => v.id === r.vehicleId);
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        {r.routeName}{vehicle ? ` · ${vehicle.plateNumber}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pickup stop</Label>
              <Input className="mt-1" value={transportForm.pickupStop} onChange={(e) => setTransportForm({ ...transportForm, pickupStop: e.target.value })} placeholder="Crossroads" maxLength={100} />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setTransportOpen(false)}>Cancel</Button>
            <Button onClick={saveTransportAssignment} disabled={enrolMutation.isPending || updateEnrolmentMutation.isPending}>
              {(enrolMutation.isPending || updateEnrolmentMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentEnrolment ? "Save changes" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
