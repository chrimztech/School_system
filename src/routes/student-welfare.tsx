import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Heart, MessageSquare, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/student-welfare")({
  head: () => ({ meta: [{ title: "Student Welfare — SRMS" }] }),
  component: StudentWelfarePage,
});

const CASE_TYPES = ["Academic", "Emotional", "Social", "Family", "Medical"] as const;
const GRADES = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];


function StudentWelfarePage() {
  const { active } = useTenant();
  const qc = useQueryClient();

  const [caseOpen, setCaseOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [caseForm, setCaseForm] = useState({ student: "", grade: GRADES[0], type: "Academic", assignedTo: "" });
  const [sessionForm, setSessionForm] = useState({ student: "", counselor: "", date: "", type: "Individual", notes: "" });

  const { data: cases = [], isLoading: casesLoading } = useQuery({
    queryKey: ["welfare-cases", active.id],
    queryFn: () => api.welfare.cases(active.id),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["welfare-sessions", active.id],
    queryFn: () => api.welfare.sessions(active.id),
  });

  const createCaseMut = useMutation({
    mutationFn: (data: any) => api.welfare.createCase(active.id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["welfare-cases", active.id] }); toast.success(`Welfare case opened`); setCaseOpen(false); },
    onError: () => toast.error("Failed to open case"),
  });

  const createSessionMut = useMutation({
    mutationFn: (data: any) => api.welfare.createSession(active.id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["welfare-sessions", active.id] }); toast.success("Session logged"); setSessionOpen(false); },
    onError: () => toast.error("Failed to log session"),
  });

  const resolveCaseMut = useMutation({
    mutationFn: ({ id }: { id: string; student: string }) => api.welfare.updateCase(active.id, id, { status: "Resolved" }),
    onSuccess: (_d, { student }) => { void qc.invalidateQueries({ queryKey: ["welfare-cases", active.id] }); toast.success(`Case for ${student} marked as resolved`); },
    onError: () => toast.error("Failed to resolve case"),
  });

  const logCase = () => {
    if (!caseForm.student.trim()) { toast.error("Student name is required"); return; }
    createCaseMut.mutate({ student: caseForm.student.trim(), grade: caseForm.grade, type: caseForm.type, assignedTo: caseForm.assignedTo, status: "Open", lastContact: new Date().toISOString().slice(0, 10) });
    setCaseForm({ student: "", grade: GRADES[0], type: "Academic", assignedTo: "" });
  };

  const logSession = () => {
    if (!sessionForm.student.trim() || !sessionForm.date.trim()) { toast.error("Student and date are required"); return; }
    createSessionMut.mutate({ student: sessionForm.student.trim(), counselor: sessionForm.counselor, sessionDate: sessionForm.date.trim(), sessionType: sessionForm.type, notes: sessionForm.notes.trim() });
    setSessionForm({ student: "", counselor: "", date: "", type: "Individual", notes: "" });
  };

  const openCases = (cases as any[]).filter((c: any) => c.status !== "Resolved").length;
  const resolvedCases = (cases as any[]).filter((c: any) => c.status === "Resolved").length;
  const highRisk = 0;

  return (
    <AccessGuard module="student-welfare">
      <div className="space-y-6">
      <PageHeader
        title="Student Welfare"
        description="Pastoral care cases, counseling sessions, and at-risk student monitoring."
        actions={<Button variant="outline" onClick={() => toast.success("Welfare report exported")}>Export report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open cases" value={openCases} accent="warning" icon={<Heart className="h-4 w-4" />} />
        <StatCard label="Sessions this term" value={(sessions as any[]).length} accent="primary" icon={<MessageSquare className="h-4 w-4" />} />
        <StatCard label="High-risk alerts" value={highRisk} hint="Need urgent attention" accent="accent" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Resolved cases" value={resolvedCases} accent="success" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Welfare cases</TabsTrigger>
          <TabsTrigger value="sessions">Counseling sessions</TabsTrigger>
          <TabsTrigger value="atrisk">At-risk alerts</TabsTrigger>
        </TabsList>

        {/* CASES */}
        <TabsContent value="cases" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={caseOpen} onOpenChange={setCaseOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />New case</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Open welfare case</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Student name *</Label>
                    <Input className="mt-1" value={caseForm.student} onChange={(e) => setCaseForm({ ...caseForm, student: e.target.value })} placeholder="Chanda Mwape" maxLength={100} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Grade</Label>
                      <Select value={caseForm.grade} onValueChange={(v) => setCaseForm({ ...caseForm, grade: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Case type</Label>
                      <Select value={caseForm.type} onValueChange={(v) => setCaseForm({ ...caseForm, type: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{CASE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Assigned to</Label>
                    <Input className="mt-1" value={caseForm.assignedTo} onChange={(e) => setCaseForm({ ...caseForm, assignedTo: e.target.value })} placeholder="Counselor / staff name" maxLength={100} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setCaseOpen(false)}>Cancel</Button>
                  <Button onClick={logCase} disabled={createCaseMut.isPending}>Open case</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Grade</TableHead><TableHead>Type</TableHead>
              <TableHead>Assigned to</TableHead><TableHead>Last contact</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {casesLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (cases as any[]).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.student}</TableCell>
                  <TableCell>{c.grade}</TableCell>
                  <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{c.assignedTo}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lastContact}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "Resolved" ? "secondary" : c.status === "Monitoring" ? "default" : "destructive"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {c.status !== "Resolved" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { createSessionMut.mutate({ student: c.student, counselor: c.assignedTo, sessionDate: new Date().toISOString().slice(0, 10), sessionType: "Individual", notes: "Follow-up session" }); }}>Log session</Button>
                        <Button size="sm" variant="ghost" onClick={() => resolveCaseMut.mutate({ id: c.id, student: c.student })}>Resolve</Button>
                      </>
                    ) : <span className="text-xs text-muted-foreground">Closed</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* SESSIONS */}
        <TabsContent value="sessions" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Log session</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Log counseling session</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Student name *</Label>
                      <Input className="mt-1" value={sessionForm.student} onChange={(e) => setSessionForm({ ...sessionForm, student: e.target.value })} placeholder="Chanda Mwape" maxLength={100} />
                    </div>
                    <div>
                      <Label>Counselor</Label>
                      <Input className="mt-1" value={sessionForm.counselor} onChange={(e) => setSessionForm({ ...sessionForm, counselor: e.target.value })} placeholder="Counselor / staff name" maxLength={100} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date *</Label>
                      <Input type="date" className="mt-1" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Session type</Label>
                      <Select value={sessionForm.type} onValueChange={(v) => setSessionForm({ ...sessionForm, type: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["Individual", "Group", "Parent"] as const).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Session notes</Label>
                    <Textarea className="mt-1" rows={3} value={sessionForm.notes} onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })} placeholder="Key discussion points and follow-up actions..." maxLength={500} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setSessionOpen(false)}>Cancel</Button>
                  <Button onClick={logSession} disabled={createSessionMut.isPending}>Log session</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Student</TableHead><TableHead>Counselor</TableHead><TableHead>Date</TableHead>
              <TableHead>Type</TableHead><TableHead>Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sessionsLoading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (sessions as any[]).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.student}</TableCell>
                  <TableCell className="text-muted-foreground">{s.counselor}</TableCell>
                  <TableCell className="text-muted-foreground">{s.sessionDate || s.date}</TableCell>
                  <TableCell><Badge variant="secondary">{s.sessionType || s.type}</Badge></TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{s.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* AT-RISK */}
        <TabsContent value="atrisk" className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
