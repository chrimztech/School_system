import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Star, TrendingUp, Users, Plus } from "lucide-react";
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
import { downloadCsv } from "@/lib/utils";

export const Route = createFileRoute("/staff-development")({
  head: () => ({ meta: [{ title: "Staff Development — SRMS" }] }),
  component: StaffDevelopmentPage,
});

type Appraisal = { id: string; staff: string; role: string; reviewer: string; cycle: string; score: number | null; status: "Draft" | "In Progress" | "Completed" };
type Observation = { id: string; observer: string; observee: string; subject: string; grade: string; date: string; rating: 1 | 2 | 3 | 4 | 5; notes: string };
type PDP = { id: string; staff: string; goals: number; nextReview: string; status: "Active" | "On Hold" | "Completed" };

const CATEGORIES = ["Pedagogy", "Technology", "Leadership", "Safeguarding", "Subject Mastery", "Wellness"];

function StaffDevelopmentPage() {
  const { active } = useTenant();
  const qc = useQueryClient();

  const { data: appraisals = [] } = useQuery({
    queryKey: ["staff-appraisals", active.id],
    queryFn: () => api.staffDevelopment.appraisals(active.id),
  });
  const { data: observations = [] } = useQuery({
    queryKey: ["staff-observations", active.id],
    queryFn: () => api.staffDevelopment.observations(active.id),
  });
  const { data: pdps = [] } = useQuery({
    queryKey: ["staff-pdps", active.id],
    queryFn: () => api.staffDevelopment.pdps(active.id),
  });

  const [appraisalOpen, setAppraisalOpen] = useState(false);
  const [observationOpen, setObservationOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [pdpOpen, setPDPOpen] = useState(false);

  const [appraisalForm, setAppraisalForm] = useState({ staff: "", role: "Teacher", reviewer: "", cycle: "Term 2 · 2026", appraisalMethod: "Line manager review", startDate: new Date().toISOString().slice(0, 10), competencyFocus: "", targetScore: "70" });
  const [obsForm, setObsForm] = useState({ observer: "", observee: "", subject: "", grade: "", date: "", time: "", rating: "4", lessonObjective: "", strengthsObserved: "", areasForImprovement: "", notes: "" });
  const [trainForm, setTrainForm] = useState({ course: "", provider: "", startDate: "", endDate: "", hours: "", staff: "", category: CATEGORIES[0], venue: "", mode: "In-person", certificationIssued: "no", certificationRef: "", trainingBudget: "" });
  const [pdpForm, setPDPForm] = useState({ staff: "", goals: "3", nextReview: "", status: "Active" as PDP["status"], reviewType: "Line manager", goal1: "", goal2: "", goal3: "", developmentArea: "", supportRequired: "" });

  // Training records connected to backend
  const { data: trainings = [], isLoading: trainingsLoading } = useQuery({
    queryKey: ["staff-development", active.id],
    queryFn: () => api.staffDevelopment.list(active.id),
  });

  const createTrainingMut = useMutation({
    mutationFn: (data: any) => api.staffDevelopment.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff-development", active.id] });
      toast.success(`Training recorded`);
      setTrainingOpen(false);
      setTrainForm({ course: "", provider: "", startDate: "", endDate: "", hours: "", staff: "", category: CATEGORIES[0], venue: "", mode: "In-person", certificationIssued: "no", certificationRef: "", trainingBudget: "" });
    },
    onError: () => toast.error("Failed to log training"),
  });

  const createAppraisalMut = useMutation({
    mutationFn: (data: any) => api.staffDevelopment.createAppraisal(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff-appraisals", active.id] });
      toast.success("Appraisal started");
      setAppraisalOpen(false);
      setAppraisalForm({ staff: "", role: "Teacher", reviewer: "", cycle: "Term 2 Â· 2026", appraisalMethod: "Line manager review", startDate: new Date().toISOString().slice(0, 10), competencyFocus: "", targetScore: "70" });
    },
    onError: () => toast.error("Failed to start appraisal"),
  });
  const updateAppraisalMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.staffDevelopment.updateAppraisal(active.id, id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["staff-appraisals", active.id] }),
  });
  const createObservationMut = useMutation({
    mutationFn: (data: any) => api.staffDevelopment.createObservation(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff-observations", active.id] });
      toast.success("Observation logged");
      setObservationOpen(false);
      setObsForm({ observer: "", observee: "", subject: "", grade: "", date: "", time: "", rating: "4", lessonObjective: "", strengthsObserved: "", areasForImprovement: "", notes: "" });
    },
    onError: () => toast.error("Failed to log observation"),
  });
  const createPdpMut = useMutation({
    mutationFn: (data: any) => api.staffDevelopment.createPdp(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff-pdps", active.id] });
      toast.success("PDP created");
      setPDPOpen(false);
      setPDPForm({ staff: "", goals: "3", nextReview: "", status: "Active", reviewType: "Line manager", goal1: "", goal2: "", goal3: "", developmentArea: "", supportRequired: "" });
    },
    onError: () => toast.error("Failed to create PDP"),
  });

  const totalHours = (trainings as any[]).reduce((sum: number, t: any) => sum + (Number(t.hours) || 0), 0);
  const avgScore = (appraisals as Appraisal[]).filter((a) => a.score !== null).reduce((sum, a) => sum + (a.score ?? 0), 0) / ((appraisals as Appraisal[]).filter((a) => a.score !== null).length || 1);

  const startAppraisal = () => {
    if (!appraisalForm.staff || !appraisalForm.cycle.trim()) { toast.error("Staff and cycle are required"); return; }
    createAppraisalMut.mutate({
      staff: appraisalForm.staff,
      role: appraisalForm.role,
      reviewer: appraisalForm.reviewer,
      cycle: appraisalForm.cycle,
      score: null,
      status: "Draft",
      appraisalMethod: appraisalForm.appraisalMethod,
      startDate: appraisalForm.startDate,
      competencyFocus: appraisalForm.competencyFocus.trim() || null,
      targetScore: Number(appraisalForm.targetScore) || null,
    });
  };

  const logObservation = () => {
    if (!obsForm.subject.trim() || !obsForm.date.trim()) { toast.error("Subject and date are required"); return; }
    createObservationMut.mutate({
      observer: obsForm.observer.trim() || null,
      observee: obsForm.observee.trim() || null,
      subject: obsForm.subject.trim(),
      grade: obsForm.grade.trim() || "-",
      date: obsForm.date.trim(),
      time: obsForm.time || null,
      rating: Number(obsForm.rating) as Observation["rating"],
      lessonObjective: obsForm.lessonObjective.trim() || null,
      strengthsObserved: obsForm.strengthsObserved.trim() || null,
      areasForImprovement: obsForm.areasForImprovement.trim() || null,
      notes: obsForm.notes.trim() || null,
    });
  };

  const logTraining = () => {
    if (!trainForm.course.trim() || !trainForm.provider.trim()) { toast.error("Course and provider are required"); return; }
    createTrainingMut.mutate({ staffName: trainForm.staff, program: trainForm.course.trim(), provider: trainForm.provider.trim(), startDate: trainForm.startDate || new Date().toISOString().slice(0, 10), endDate: trainForm.endDate || null, hours: Number(trainForm.hours) || 0, category: trainForm.category, mode: trainForm.mode, venue: trainForm.venue.trim() || null, certificationIssued: trainForm.certificationIssued === "yes", certificationRef: trainForm.certificationRef.trim() || null, trainingBudget: Number(trainForm.trainingBudget) || null, status: "Completed" });
  };

  const createPDP = () => {
    if (!pdpForm.staff || !pdpForm.nextReview.trim()) { toast.error("Staff and next review date are required"); return; }
    createPdpMut.mutate({
      staff: pdpForm.staff,
      goals: Number(pdpForm.goals) || 1,
      nextReview: pdpForm.nextReview.trim(),
      status: pdpForm.status,
      reviewType: pdpForm.reviewType,
      goal1: pdpForm.goal1.trim() || null,
      goal2: pdpForm.goal2.trim() || null,
      goal3: pdpForm.goal3.trim() || null,
      developmentArea: pdpForm.developmentArea.trim() || null,
      supportRequired: pdpForm.supportRequired.trim() || null,
    });
  };

  return (
    <AccessGuard module="staff-development">
      <div className="space-y-6">
      <PageHeader
        title="Staff Development"
        description="Appraisals, lesson observations, CPD training log, and personal development plans."
        actions={<Button variant="outline" onClick={() => { downloadCsv((trainings as any[]).map((t: any) => ({ Course: t.program || t.course, Provider: t.provider, Category: t.category, Staff: t.staffName || t.staff, Hours: t.hours, Date: t.startDate || t.date, Mode: t.mode, "Cert Issued": t.certificationIssued ? "Yes" : "No" })), "cpd-summary"); toast.success("CPD summary exported"); }}>Export CPD report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active PDPs" value={pdps.filter((p) => p.status === "Active").length} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Observations this term" value={observations.length} accent="accent" icon={<Star className="h-4 w-4" />} />
        <StatCard label="Avg appraisal score" value={`${Math.round(avgScore)}%`} hint="Completed appraisals" accent="success" icon={<Users className="h-4 w-4" />} />
        <StatCard label="CPD hours logged" value={totalHours} hint="This academic year" accent="warning" icon={<BookOpen className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="appraisals">
        <TabsList>
          <TabsTrigger value="appraisals">Appraisals</TabsTrigger>
          <TabsTrigger value="observations">Lesson observations</TabsTrigger>
          <TabsTrigger value="training">CPD training</TabsTrigger>
          <TabsTrigger value="pdp">PDPs</TabsTrigger>
        </TabsList>

        {/* APPRAISALS */}
        <TabsContent value="appraisals" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={appraisalOpen} onOpenChange={setAppraisalOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Start appraisal</Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Start appraisal</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Staff member</Label>
                    <Input className="mt-1" value={appraisalForm.staff} onChange={(e) => setAppraisalForm({ ...appraisalForm, staff: e.target.value })} placeholder="Full name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Role / position</Label>
                    <Input className="mt-1" value={appraisalForm.role} onChange={(e) => setAppraisalForm({ ...appraisalForm, role: e.target.value })} placeholder="Teacher, HOD, Warden" maxLength={80} />
                  </div>
                  <div>
                    <Label>Reviewer</Label>
                    <Input className="mt-1" value={appraisalForm.reviewer} onChange={(e) => setAppraisalForm({ ...appraisalForm, reviewer: e.target.value })} maxLength={100} />
                  </div>
                  <div>
                    <Label>Appraisal cycle</Label>
                    <Input className="mt-1" value={appraisalForm.cycle} onChange={(e) => setAppraisalForm({ ...appraisalForm, cycle: e.target.value })} placeholder="Term 2 · 2026" maxLength={50} />
                  </div>
                  <div>
                    <Label>Appraisal method</Label>
                    <Select value={appraisalForm.appraisalMethod} onValueChange={(v) => setAppraisalForm({ ...appraisalForm, appraisalMethod: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Line manager review", "360° feedback", "Self-appraisal", "Peer review", "Combined"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" className="mt-1" value={appraisalForm.startDate} onChange={(e) => setAppraisalForm({ ...appraisalForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Target score (%)</Label>
                    <Input type="number" min={0} max={100} className="mt-1" value={appraisalForm.targetScore} onChange={(e) => setAppraisalForm({ ...appraisalForm, targetScore: e.target.value })} placeholder="70" />
                  </div>
                  <div>
                    <Label>Competency focus area</Label>
                    <Input className="mt-1" value={appraisalForm.competencyFocus} onChange={(e) => setAppraisalForm({ ...appraisalForm, competencyFocus: e.target.value })} placeholder="e.g. Classroom management, lesson planning" maxLength={120} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setAppraisalOpen(false)}>Cancel</Button>
                  <Button onClick={startAppraisal}>Start appraisal</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Staff</TableHead><TableHead>Role</TableHead><TableHead>Reviewer</TableHead>
              <TableHead>Cycle</TableHead><TableHead>Score</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {appraisals.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.staff}</TableCell>
                  <TableCell>{a.role}</TableCell>
                  <TableCell className="text-muted-foreground">{a.reviewer}</TableCell>
                  <TableCell>{a.cycle}</TableCell>
                  <TableCell>
                    {a.score !== null ? (
                      <Badge variant="secondary" className={a.score >= 75 ? "text-success" : "text-warning"}>{a.score}%</Badge>
                    ) : <span className="text-xs text-muted-foreground">Pending</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === "Completed" ? "secondary" : a.status === "In Progress" ? "default" : "outline"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (a.status !== "Completed") {
                        const nextStatus = a.status === "Draft" ? "In Progress" : "Completed";
                        updateAppraisalMut.mutate({
                          id: a.id,
                          data: {
                            status: nextStatus,
                            score: nextStatus === "Completed" ? (a.score ?? 0) : a.score,
                          },
                        });
                        toast.success(nextStatus === "Completed" ? `${a.staff}'s appraisal completed` : `${a.staff}'s appraisal opened`);
                      } else {
                        toast.info(`${a.staff}'s appraisal opened`);
                      }
                    }}>{a.status === "Completed" ? "View" : "Open"}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* OBSERVATIONS */}
        <TabsContent value="observations" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={observationOpen} onOpenChange={setObservationOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Log observation</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Log lesson observation</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Observer</Label>
                      <Input className="mt-1" value={obsForm.observer} onChange={(e) => setObsForm({ ...obsForm, observer: e.target.value })} maxLength={100} />
                    </div>
                    <div>
                      <Label>Observee</Label>
                      <Input className="mt-1" value={obsForm.observee} onChange={(e) => setObsForm({ ...obsForm, observee: e.target.value })} placeholder="Teacher name" maxLength={100} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Subject *</Label>
                      <Input className="mt-1" value={obsForm.subject} onChange={(e) => setObsForm({ ...obsForm, subject: e.target.value })} placeholder="Mathematics" maxLength={60} />
                    </div>
                    <div>
                      <Label>Class</Label>
                      <Input className="mt-1" value={obsForm.grade} onChange={(e) => setObsForm({ ...obsForm, grade: e.target.value })} placeholder="Form 3A" maxLength={30} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date *</Label>
                      <Input type="date" className="mt-1" value={obsForm.date} onChange={(e) => setObsForm({ ...obsForm, date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Rating (1–5)</Label>
                      <Select value={obsForm.rating} onValueChange={(v) => setObsForm({ ...obsForm, rating: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["1", "2", "3", "4", "5"].map((r) => <SelectItem key={r} value={r}>{r} — {["Poor", "Below average", "Satisfactory", "Good", "Outstanding"][Number(r) - 1]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea className="mt-1" rows={3} value={obsForm.notes} onChange={(e) => setObsForm({ ...obsForm, notes: e.target.value })} placeholder="Key observations and recommendations..." maxLength={500} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setObservationOpen(false)}>Cancel</Button>
                  <Button onClick={logObservation}>Log observation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Observer</TableHead><TableHead>Teacher</TableHead><TableHead>Subject</TableHead>
              <TableHead>Class</TableHead><TableHead>Date</TableHead><TableHead>Rating</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {observations.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-muted-foreground">{o.observer}</TableCell>
                  <TableCell className="font-medium">{o.observee}</TableCell>
                  <TableCell>{o.subject}</TableCell>
                  <TableCell>{o.grade}</TableCell>
                  <TableCell className="text-muted-foreground">{o.date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={o.rating >= 4 ? "text-success" : o.rating === 3 ? "" : "text-destructive"}>
                      {"★".repeat(o.rating)}{"☆".repeat(5 - o.rating)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toast.info(o.notes || "No notes recorded")}>Notes</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* CPD TRAINING — connected to backend */}
        <TabsContent value="training" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={trainingOpen} onOpenChange={setTrainingOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Log training</Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Log CPD training</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Course name *</Label>
                    <Input className="mt-1" value={trainForm.course} onChange={(e) => setTrainForm({ ...trainForm, course: e.target.value })} placeholder="e.g. Inclusive Education Methods" maxLength={120} />
                  </div>
                  <div>
                    <Label>Provider *</Label>
                    <Input className="mt-1" value={trainForm.provider} onChange={(e) => setTrainForm({ ...trainForm, provider: e.target.value })} placeholder="e.g. MoE CPD Unit, UNZA" maxLength={80} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={trainForm.category} onValueChange={(v) => setTrainForm({ ...trainForm, category: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Staff member</Label>
                    <Input className="mt-1" value={trainForm.staff} onChange={(e) => setTrainForm({ ...trainForm, staff: e.target.value })} placeholder="Full name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Delivery mode</Label>
                    <Select value={trainForm.mode} onValueChange={(v) => setTrainForm({ ...trainForm, mode: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["In-person", "Online", "Hybrid", "Self-study", "On-the-job"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" className="mt-1" value={trainForm.startDate} onChange={(e) => setTrainForm({ ...trainForm, startDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input type="date" className="mt-1" value={trainForm.endDate} onChange={(e) => setTrainForm({ ...trainForm, endDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Total hours</Label>
                    <Input className="mt-1" type="number" min={1} value={trainForm.hours} onChange={(e) => setTrainForm({ ...trainForm, hours: e.target.value })} placeholder="8" />
                  </div>
                  <div>
                    <Label>Venue / platform</Label>
                    <Input className="mt-1" value={trainForm.venue} onChange={(e) => setTrainForm({ ...trainForm, venue: e.target.value })} placeholder="e.g. School staffroom, Zoom, NISTCOL" maxLength={100} />
                  </div>
                  <div>
                    <Label>Certification issued</Label>
                    <Select value={trainForm.certificationIssued} onValueChange={(v) => setTrainForm({ ...trainForm, certificationIssued: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No certificate</SelectItem>
                        <SelectItem value="yes">Yes — certificate issued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Certificate reference</Label>
                    <Input className="mt-1" value={trainForm.certificationRef} onChange={(e) => setTrainForm({ ...trainForm, certificationRef: e.target.value })} placeholder="Certificate number or serial" maxLength={80} disabled={trainForm.certificationIssued !== "yes"} />
                  </div>
                  <div>
                    <Label>Training budget (K)</Label>
                    <Input className="mt-1" type="number" min={0} value={trainForm.trainingBudget} onChange={(e) => setTrainForm({ ...trainForm, trainingBudget: e.target.value })} placeholder="e.g. 1500" />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setTrainingOpen(false)}>Cancel</Button>
                  <Button onClick={logTraining} disabled={createTrainingMut.isPending}>Log training</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Course</TableHead><TableHead>Provider</TableHead><TableHead>Category</TableHead>
              <TableHead>Staff</TableHead><TableHead>Hours</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trainingsLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (trainings as any[]).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.program || t.course}</TableCell>
                  <TableCell className="text-muted-foreground">{t.provider}</TableCell>
                  <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                  <TableCell>{t.staffName || t.staff}</TableCell>
                  <TableCell>{t.hours}h</TableCell>
                  <TableCell className="text-muted-foreground">{t.startDate || t.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* PDPs */}
        <TabsContent value="pdp" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={pdpOpen} onOpenChange={setPDPOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Create PDP</Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Create personal development plan</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Staff member</Label>
                    <Input className="mt-1" value={pdpForm.staff} onChange={(e) => setPDPForm({ ...pdpForm, staff: e.target.value })} placeholder="Full name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Review type</Label>
                    <Select value={pdpForm.reviewType} onValueChange={(v) => setPDPForm({ ...pdpForm, reviewType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Line manager", "Self-directed", "Peer-supported", "Mentorship-led"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Number of goals</Label>
                    <Input className="mt-1" type="number" min={1} max={10} value={pdpForm.goals} onChange={(e) => setPDPForm({ ...pdpForm, goals: e.target.value })} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={pdpForm.status} onValueChange={(v) => setPDPForm({ ...pdpForm, status: v as PDP["status"] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{(["Active", "On Hold", "Completed"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Next review date *</Label>
                    <Input type="date" className="mt-1" value={pdpForm.nextReview} onChange={(e) => setPDPForm({ ...pdpForm, nextReview: e.target.value })} />
                  </div>
                  <div>
                    <Label>Development area</Label>
                    <Input className="mt-1" value={pdpForm.developmentArea} onChange={(e) => setPDPForm({ ...pdpForm, developmentArea: e.target.value })} placeholder="e.g. Differentiated instruction, Leadership" maxLength={120} />
                  </div>
                  <div className="col-span-2">
                    <Label>Goal 1</Label>
                    <Input className="mt-1" value={pdpForm.goal1} onChange={(e) => setPDPForm({ ...pdpForm, goal1: e.target.value })} placeholder="SMART goal statement" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Goal 2</Label>
                    <Input className="mt-1" value={pdpForm.goal2} onChange={(e) => setPDPForm({ ...pdpForm, goal2: e.target.value })} placeholder="SMART goal statement" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Goal 3</Label>
                    <Input className="mt-1" value={pdpForm.goal3} onChange={(e) => setPDPForm({ ...pdpForm, goal3: e.target.value })} placeholder="SMART goal statement" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Support required</Label>
                    <Input className="mt-1" value={pdpForm.supportRequired} onChange={(e) => setPDPForm({ ...pdpForm, supportRequired: e.target.value })} placeholder="e.g. Mentoring, funding for training, observation sessions" maxLength={200} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setPDPOpen(false)}>Cancel</Button>
                  <Button onClick={createPDP}>Create PDP</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Staff</TableHead><TableHead>Goals</TableHead><TableHead>Next review</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pdps.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.staff}</TableCell>
                  <TableCell>{p.goals} goals</TableCell>
                  <TableCell className="text-muted-foreground">{p.nextReview}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "Active" ? "default" : p.status === "Completed" ? "secondary" : "outline"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toast.success(`${p.staff}'s PDP opened`)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
