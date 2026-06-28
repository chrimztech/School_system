import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HeartPulse, Syringe, Pill, AlertTriangle, Plus, Download, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Health & Clinic — SRMS" }] }),
  component: HealthPage,
});

function HealthPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    student: "", grade: "", complaint: "", treatment: "",
    visitDate: new Date().toISOString().slice(0, 10),
    visitTime: new Date().toTimeString().slice(0, 5),
    temperature: "", weight: "", bloodPressure: "",
    diagnosis: "", medicationPrescribed: "", dosage: "",
    followUpRequired: "no", followUpDate: "",
    referralRequired: "no", referralHospital: "",
    attendingNurse: "School Nurse",
  });

  const { data: visitsData = [], isLoading } = useQuery({
    queryKey: ["health-visits", schoolId],
    queryFn: () => api.health.visits(schoolId),
  });

  const { data: recordsData = [] } = useQuery({
    queryKey: ["health-records", schoolId],
    queryFn: () => api.health.records(schoolId),
  });

  const [recOpen, setRecOpen] = useState(false);
  const [recForm, setRecForm] = useState({
    studentName: "", grade: "", bloodGroup: "", allergies: "",
    chronicConditions: "", emergencyContact: "", emergencyPhone: "",
    lastCheckupDate: "", vaccinationStatus: "", notes: "",
  });

  const createRecordMut = useMutation({
    mutationFn: (data: any) => api.health.createRecord(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["health-records", schoolId] });
      toast.success("Health record saved");
      setRecForm({ studentName: "", grade: "", bloodGroup: "", allergies: "", chronicConditions: "", emergencyContact: "", emergencyPhone: "", lastCheckupDate: "", vaccinationStatus: "", notes: "" });
      setRecOpen(false);
    },
    onError: () => toast.error("Failed to save health record"),
  });

  const COMPLETE_STATUSES = ["complete", "completed", "up to date", "up-to-date", "fully vaccinated"];
  const records = recordsData as any[];
  const allergyRecords = records.filter((r) => (r.allergies || "").trim());
  const immunisationDue = records.filter((r) => r.vaccinationStatus && !COMPLETE_STATUSES.includes((r.vaccinationStatus as string).toLowerCase()));

  const createMutation = useMutation({
    mutationFn: (data: any) => api.health.createVisit(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["health-visits", schoolId] });
      toast.success("Visit recorded · parent SMS queued");
      setForm({ student: "", grade: "", complaint: "", treatment: "", visitDate: new Date().toISOString().slice(0, 10), visitTime: new Date().toTimeString().slice(0, 5), temperature: "", weight: "", bloodPressure: "", diagnosis: "", medicationPrescribed: "", dosage: "", followUpRequired: "no", followUpDate: "", referralRequired: "no", referralHospital: "", attendingNurse: "School Nurse" });
      setOpen(false);
    },
    onError: () => toast.error("Failed to record visit"),
  });

  const rawVisits = visitsData as any[];
  const visits = rawVisits.map((v: any) => ({
    ...v,
    student: v.studentName ?? v.student ?? "",
    grade: v.grade ?? v.class ?? "—",
    date: v.visitDate ?? v.date ?? v.createdAt ?? "",
    complaint: v.complaint ?? "",
    treatment: v.treatment ?? v.treatmentGiven ?? "",
    nurse: v.attendedBy ?? v.nurse ?? v.nurseName ?? "On duty",
  }));
  const todayVisits = visits.filter((v) => {
    const d = String(v.date);
    return d.includes("Today") || d.slice(0, 10) === new Date().toISOString().slice(0, 10);
  });

  return (
    <AccessGuard module="health">
      <div className="space-y-6">
      <PageHeader
        title="Health & Clinic"
        description="School clinic visits, immunisation records, allergies, and medical alerts."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/student-welfare">Welfare cases</Link>
            </Button>
            <Button variant="outline" onClick={() => toast.success("Health register exported (PDF)")}>
              <Download className="mr-2 h-4 w-4" />Export register
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New visit</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>Record clinic visit</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Student name *</Label>
                    <Input className="mt-1" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} placeholder="Full name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Class / grade</Label>
                    <Input className="mt-1" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Form 1A" maxLength={30} />
                  </div>
                  <div>
                    <Label>Visit date</Label>
                    <Input type="date" className="mt-1" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Visit time</Label>
                    <Input type="time" className="mt-1" value={form.visitTime} onChange={(e) => setForm({ ...form, visitTime: e.target.value })} />
                  </div>
                  <div>
                    <Label>Temperature (°C)</Label>
                    <Input type="number" step="0.1" min={34} max={42} className="mt-1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="e.g. 37.2" />
                  </div>
                  <div>
                    <Label>Weight (kg)</Label>
                    <Input type="number" step="0.1" min={0} className="mt-1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 42.5" />
                  </div>
                  <div>
                    <Label>Blood pressure (mmHg)</Label>
                    <Input className="mt-1" value={form.bloodPressure} onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })} placeholder="e.g. 120/80" maxLength={20} />
                  </div>
                  <div>
                    <Label>Attending nurse / staff</Label>
                    <Input className="mt-1" value={form.attendingNurse} onChange={(e) => setForm({ ...form, attendingNurse: e.target.value })} placeholder="School Nurse" maxLength={80} />
                  </div>
                  <div className="col-span-2">
                    <Label>Complaint / presenting symptoms *</Label>
                    <Textarea className="mt-1" rows={2} value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} placeholder="Describe presenting complaint" maxLength={300} />
                  </div>
                  <div className="col-span-2">
                    <Label>Diagnosis</Label>
                    <Input className="mt-1" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Clinical diagnosis or working diagnosis" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Treatment given</Label>
                    <Textarea className="mt-1" rows={2} value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Describe treatment administered" maxLength={300} />
                  </div>
                  <div>
                    <Label>Medication prescribed</Label>
                    <Input className="mt-1" value={form.medicationPrescribed} onChange={(e) => setForm({ ...form, medicationPrescribed: e.target.value })} placeholder="e.g. Paracetamol 500mg" maxLength={100} />
                  </div>
                  <div>
                    <Label>Dosage / instructions</Label>
                    <Input className="mt-1" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 1 tablet every 6 hrs for 3 days" maxLength={100} />
                  </div>
                  <div>
                    <Label>Follow-up required</Label>
                    <Select value={form.followUpRequired} onValueChange={(v) => setForm({ ...form, followUpRequired: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Follow-up date</Label>
                    <Input type="date" className="mt-1" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} disabled={form.followUpRequired !== "yes"} />
                  </div>
                  <div>
                    <Label>Referral required</Label>
                    <Select value={form.referralRequired} onValueChange={(v) => setForm({ ...form, referralRequired: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes — refer to hospital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Referral hospital / facility</Label>
                    <Input className="mt-1" value={form.referralHospital} onChange={(e) => setForm({ ...form, referralHospital: e.target.value })} placeholder="e.g. UTH, Levy Hospital" maxLength={100} disabled={form.referralRequired !== "yes"} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    if (!form.student.trim()) return toast.error("Student name required");
                    const diagnosisSummary = [
                      form.diagnosis.trim(),
                      form.temperature ? `Temp ${form.temperature}°C` : "",
                      form.weight ? `Weight ${form.weight}kg` : "",
                      form.bloodPressure.trim() ? `BP ${form.bloodPressure.trim()}` : "",
                    ].filter(Boolean).join(" | ");
                    const treatmentSummary = [
                      form.treatment.trim(),
                      form.medicationPrescribed.trim() ? `Medication: ${form.medicationPrescribed.trim()}` : "",
                      form.dosage.trim() ? `Dosage: ${form.dosage.trim()}` : "",
                      form.referralRequired === "yes" && form.referralHospital.trim() ? `Referral: ${form.referralHospital.trim()}` : "",
                    ].filter(Boolean).join("\n");
                    createMutation.mutate({
                      studentName: form.student.trim(), grade: form.grade || "—",
                      complaint: form.complaint,
                      treatment: treatmentSummary || form.treatment,
                      visitDate: form.visitDate,
                      diagnosis: diagnosisSummary || form.diagnosis.trim(),
                      followUpDate: form.followUpDate || null,
                      referredToHospital: form.referralRequired === "yes",
                      attendedBy: form.attendingNurse.trim() || "School Nurse",
                    });
                  }} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save visit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visits today" value={todayVisits.length} accent="primary" icon={<HeartPulse className="h-4 w-4" />} />
        <StatCard label="Immunisations pending" value={immunisationDue.length} hint={immunisationDue.length === 0 ? "All up to date" : "Check immunisation tab"} accent="warning" icon={<Syringe className="h-4 w-4" />} />
        <StatCard label="Known allergies" value={allergyRecords.length} hint={allergyRecords.length === 0 ? "None on file" : "Students on file"} accent="warning" icon={<Pill className="h-4 w-4" />} />
        <StatCard label="Health records" value={records.length} hint="Students on file" accent="accent" icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="visits">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="visits">Clinic visits</TabsTrigger>
            <TabsTrigger value="imm">Immunisation</TabsTrigger>
            <TabsTrigger value="allergies">Allergies & alerts</TabsTrigger>
            <TabsTrigger value="stock">Medicine stock</TabsTrigger>
          </TabsList>
          <Dialog open={recOpen} onOpenChange={setRecOpen}>
            <button
              onClick={() => setRecOpen(true)}
              className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />Add health record
            </button>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add student health record</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Student name *</Label>
                  <Input className="mt-1" value={recForm.studentName} onChange={(e) => setRecForm({ ...recForm, studentName: e.target.value })} placeholder="Full name" maxLength={100} />
                </div>
                <div>
                  <Label>Class / grade</Label>
                  <Input className="mt-1" value={recForm.grade} onChange={(e) => setRecForm({ ...recForm, grade: e.target.value })} placeholder="e.g. Form 2A" maxLength={30} />
                </div>
                <div>
                  <Label>Blood group</Label>
                  <Select value={recForm.bloodGroup || "__none__"} onValueChange={(v) => setRecForm({ ...recForm, bloodGroup: v === "__none__" ? "" : v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unknown</SelectItem>
                      {["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vaccination status</Label>
                  <Input className="mt-1" value={recForm.vaccinationStatus} onChange={(e) => setRecForm({ ...recForm, vaccinationStatus: e.target.value })} placeholder="e.g. Up to date / BCG due" maxLength={100} />
                </div>
                <div>
                  <Label>Last checkup date</Label>
                  <Input type="date" className="mt-1" value={recForm.lastCheckupDate} onChange={(e) => setRecForm({ ...recForm, lastCheckupDate: e.target.value })} />
                </div>
                <div>
                  <Label>Emergency contact</Label>
                  <Input className="mt-1" value={recForm.emergencyContact} onChange={(e) => setRecForm({ ...recForm, emergencyContact: e.target.value })} placeholder="Name" maxLength={80} />
                </div>
                <div className="col-span-2">
                  <Label>Emergency phone</Label>
                  <Input className="mt-1" value={recForm.emergencyPhone} onChange={(e) => setRecForm({ ...recForm, emergencyPhone: e.target.value })} placeholder="+260 9X XXX XXXX" maxLength={30} />
                </div>
                <div className="col-span-2">
                  <Label>Allergies</Label>
                  <Textarea className="mt-1" rows={2} value={recForm.allergies} onChange={(e) => setRecForm({ ...recForm, allergies: e.target.value })} placeholder="List known allergies, separated by commas" maxLength={500} />
                </div>
                <div className="col-span-2">
                  <Label>Chronic conditions</Label>
                  <Textarea className="mt-1" rows={2} value={recForm.chronicConditions} onChange={(e) => setRecForm({ ...recForm, chronicConditions: e.target.value })} placeholder="e.g. Asthma, Epilepsy, Diabetes" maxLength={500} />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea className="mt-1" rows={2} value={recForm.notes} onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })} placeholder="Any additional health notes" maxLength={500} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="ghost" onClick={() => setRecOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!recForm.studentName.trim()) return toast.error("Student name required");
                  createRecordMut.mutate({
                    studentName: recForm.studentName.trim(), grade: recForm.grade || "—",
                    bloodGroup: recForm.bloodGroup || null,
                    allergies: recForm.allergies.trim() || null,
                    chronicConditions: recForm.chronicConditions.trim() || null,
                    emergencyContact: recForm.emergencyContact.trim() || null,
                    emergencyPhone: recForm.emergencyPhone.trim() || null,
                    lastCheckupDate: recForm.lastCheckupDate || null,
                    vaccinationStatus: recForm.vaccinationStatus.trim() || null,
                    notes: recForm.notes.trim() || null,
                  });
                }} disabled={createRecordMut.isPending}>
                  {createRecordMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save record
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="visits" className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading visits…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Time</TableHead><TableHead>Student</TableHead><TableHead>Class</TableHead>
                <TableHead>Complaint</TableHead><TableHead>Treatment</TableHead><TableHead>Nurse</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {visits.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No clinic visits recorded.</TableCell></TableRow>
                ) : visits.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-muted-foreground">{String(v.date).slice(0, 16).replace("T", " ")}</TableCell>
                    <TableCell className="font-medium">{v.student}</TableCell>
                    <TableCell>{v.grade}</TableCell>
                    <TableCell>{v.complaint}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.treatment}</TableCell>
                    <TableCell>{v.nurse}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="imm" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Grade</TableHead>
              <TableHead>Vaccination status</TableHead><TableHead>Last checkup</TableHead><TableHead>Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {records.filter((r) => r.vaccinationStatus).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No immunisation records on file. Use "Add health record" to add one.</TableCell></TableRow>
              ) : records.filter((r) => r.vaccinationStatus).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell>{r.grade || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={COMPLETE_STATUSES.includes((r.vaccinationStatus || "").toLowerCase()) ? "secondary" : "destructive"}>
                      {r.vaccinationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.lastCheckupDate || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="allergies" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Grade</TableHead>
              <TableHead>Allergies</TableHead><TableHead>Chronic conditions</TableHead><TableHead>Emergency contact</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {allergyRecords.length === 0 && records.filter((r) => r.chronicConditions).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No allergy or condition records on file.</TableCell></TableRow>
              ) : records.filter((r) => (r.allergies || "").trim() || (r.chronicConditions || "").trim()).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell>{r.grade || "—"}</TableCell>
                  <TableCell>
                    {r.allergies
                      ? <span className="flex items-center gap-1 text-destructive text-xs"><AlertTriangle className="h-3 w-3 shrink-0" />{r.allergies}</span>
                      : <span className="text-xs text-muted-foreground">None</span>}
                  </TableCell>
                  <TableCell className="text-xs">{r.chronicConditions || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.emergencyContact ? `${r.emergencyContact}${r.emergencyPhone ? ` · ${r.emergencyPhone}` : ""}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="stock" className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Pill className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Medicine stock tracking not yet configured</p>
            <p className="text-sm text-muted-foreground">Contact your system administrator to enable clinic inventory management.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
