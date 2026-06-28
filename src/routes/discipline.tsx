import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/discipline")({
  head: () => ({ meta: [{ title: "Discipline — SRMS" }] }),
  component: DisciplinePage,
});

const ACTIONS = ["Verbal warning", "Written warning", "1-day suspension", "3-day suspension", "1-week suspension", "Expulsion", "Community service", "Detention", "Parent meeting", "Counselling referral"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
const OFFENSE_CATEGORIES = ["Behaviour", "Academic dishonesty", "Bullying / harassment", "Physical altercation", "Substance abuse", "Property damage", "Truancy / absenteeism", "Cyberbullying", "Defiance of authority", "Other"];

function extractNoteValue(notes: string | null | undefined, label: string) {
  return (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${label}:`))
    ?.replace(`${label}:`, "")
    .trim();
}

function DisciplinePage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const teacherEmail = isTeacher ? user.email : undefined;
  // Teachers can log incidents but cannot escalate to expulsion/long suspension or resolve cases
  const availableActions = isTeacher
    ? ACTIONS.filter((a) => !["Expulsion", "1-week suspension", "3-day suspension"].includes(a))
    : ACTIONS;
  const qc = useQueryClient();

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", schoolId, teacherEmail], queryFn: () => api.classes.list(schoolId, teacherEmail) });
  const classList = (classesData as any[]).map((c: any) => c.name || c.className || c.id).filter(Boolean);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    studentName: "", grade: "", offense: "", offenseCategory: OFFENSE_CATEGORIES[0],
    severity: "Medium" as typeof SEVERITIES[number], action: ACTIONS[0],
    location: "", incidentDate: new Date().toISOString().slice(0, 10),
    incidentTime: "", witnessNames: "", reportedBy: "", followUpDate: "", notified: "yes",
    status: "Open", repeatCount: "1", notes: "",
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["discipline", schoolId],
    queryFn: () => api.discipline.list(schoolId),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.discipline.resolve(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["discipline", schoolId] });
      toast.success("Case resolved");
    },
    onError: () => toast.error("Failed to resolve case"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.discipline.create(schoolId, data),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["discipline", schoolId] });
      toast.success(`Incident logged for ${d.studentName}`);
      setForm({
        studentName: "",
        grade: "",
        offense: "",
        offenseCategory: OFFENSE_CATEGORIES[0],
        severity: "Medium",
        action: ACTIONS[0],
        location: "",
        incidentDate: new Date().toISOString().slice(0, 10),
        incidentTime: "",
        witnessNames: "",
        reportedBy: "",
        followUpDate: "",
        notified: "yes",
        status: "Open",
        repeatCount: "1",
        notes: "",
      });
      setOpen(false);
    },
    onError: () => toast.error("Failed to log incident"),
  });

  const logIncident = () => {
    if (!form.studentName.trim() || !form.offense.trim()) { toast.error("Student name and offence are required"); return; }
    createMutation.mutate({
      studentName: form.studentName.trim(),
      grade: form.grade,
      offense: form.offense.trim(),
      offenseCategory: form.offenseCategory,
      severity: form.severity,
      action: form.action,
      incidentDate: form.incidentDate,
      incidentTime: form.incidentTime || null,
      location: form.location.trim() || null,
      witnessNames: form.witnessNames.trim() || null,
      followUpDate: form.followUpDate || null,
      parentNotified: form.notified === "yes",
      reportedBy: form.reportedBy.trim(),
      status: form.status,
      repeatCount: Math.max(1, Number(form.repeatCount) || 1),
      notes: form.notes.trim() || null,
    });
  };

  const recs = records as any[];
  const openCases = recs.filter((r) => !r.action?.includes("Expulsion")).length;
  const suspensions = recs.filter((r) => r.action?.includes("suspension")).length;
  const repeats = recs.filter((r) => (r.repeats ?? r.repeatCount ?? 0) > 1).length;

  return (
    <AccessGuard module="discipline">
      <div className="space-y-6">
      <PageHeader
        title="Discipline"
        description="Log offences, take action, notify parents and track repeats"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/student-welfare">Welfare cases</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Log incident</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>Log disciplinary incident</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Student name *</Label>
                    <Input className="mt-1" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} placeholder="Mwansa Tembo" maxLength={100} />
                  </div>
                  <div>
                    <Label>Class / grade</Label>
                    <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{classList.length === 0 ? <SelectItem value="__empty__" disabled>No classes yet</SelectItem> : classList.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Incident date</Label>
                    <Input type="date" className="mt-1" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Incident time</Label>
                    <Input type="time" className="mt-1" value={form.incidentTime} onChange={(e) => setForm({ ...form, incidentTime: e.target.value })} />
                  </div>
                  <div>
                    <Label>Location / venue</Label>
                    <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Classroom 8A, Playground" maxLength={100} />
                  </div>
                  <div>
                    <Label>Severity</Label>
                    <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v as typeof SEVERITIES[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Offence category</Label>
                    <Select value={form.offenseCategory} onValueChange={(v) => setForm({ ...form, offenseCategory: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{OFFENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action taken</Label>
                    <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{availableActions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Offence description *</Label>
                    <Textarea className="mt-1" rows={2} value={form.offense} onChange={(e) => setForm({ ...form, offense: e.target.value })} placeholder="Describe the incident in full detail" maxLength={500} />
                  </div>
                  <div>
                    <Label>Reported by</Label>
                    <Input className="mt-1" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} placeholder="Reporting teacher / staff name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Follow-up date</Label>
                    <Input type="date" className="mt-1" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Workflow status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Open", "Monitoring", "Resolved"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Repeat count</Label>
                    <Input type="number" min={1} className="mt-1" value={form.repeatCount} onChange={(e) => setForm({ ...form, repeatCount: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Witness names (comma-separated)</Label>
                    <Input className="mt-1" value={form.witnessNames} onChange={(e) => setForm({ ...form, witnessNames: e.target.value })} placeholder="e.g. Mr. Banda, Miss Mwale" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Internal notes / support actions</Label>
                    <Textarea className="mt-1" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Restorative actions, counseling referral, parent commitments, or dean comments" maxLength={400} />
                  </div>
                  <div>
                    <Label>Parent / guardian notified</Label>
                    <Select value={form.notified} onValueChange={(v) => setForm({ ...form, notified: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — notified</SelectItem>
                        <SelectItem value="no">Not yet — pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={logIncident} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log incident
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open cases this term" value={openCases} accent="warning" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="Suspensions" value={suspensions} accent="destructive" />
        <StatCard label="Repeat offenders" value={repeats} accent="primary" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading records…</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Offence</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Repeats</TableHead>
                <TableHead>Parent notified</TableHead>
                {!isTeacher && <TableHead className="text-right">Resolve</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
                {recs.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-muted-foreground">{(d.date ?? d.incidentDate ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="font-medium">{d.studentName ?? d.student}</TableCell>
                    <TableCell>{d.grade}</TableCell>
                    <TableCell>
                      <div>{d.offense}</div>
                      <div className="text-xs text-muted-foreground">
                        {[d.offenseCategory ?? extractNoteValue(d.notes, "Category"), d.severity ?? extractNoteValue(d.notes, "Severity")].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.action?.includes("suspension") || d.action === "Expulsion" ? "destructive" : "outline"}>{d.action}</Badge>
                    </TableCell>
                  <TableCell>{(d.repeats ?? d.repeatCount ?? 1)}×</TableCell>
                  <TableCell>
                    {(d.notified ?? d.parentNotified) ? <Badge variant="secondary">Sent</Badge> : <Badge variant="destructive">Pending</Badge>}
                  </TableCell>
                  {!isTeacher && <TableCell className="text-right">
                    {(d.status ?? "Open") === "Resolved" ? (
                      <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Resolved</span>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate(d.id)}>
                        {resolveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resolve"}
                      </Button>
                    )}
                  </TableCell>}
                </TableRow>
              ))}
              {recs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No disciplinary records.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
    </AccessGuard>
  );
}
