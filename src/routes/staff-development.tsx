import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, Star, TrendingUp, Users, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx, downloadCsv } from "@/lib/utils";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";

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
  const [tab, setTab] = useState("appraisals");

  const [appraisalForm, setAppraisalForm] = useState({ staff: "", role: "Teacher", reviewer: "", cycle: "Term 2 · 2026", appraisalMethod: "Line manager review", startDate: new Date().toISOString().slice(0, 10), competencyFocus: "", targetScore: "70" });
  const [obsForm, setObsForm] = useState({ observer: "", observee: "", subject: "", grade: "", date: "", time: "", rating: "4", lessonObjective: "", strengthsObserved: "", areasForImprovement: "", notes: "" });
  const [trainForm, setTrainForm] = useState({ course: "", provider: "", startDate: "", endDate: "", hours: "", staff: "", category: CATEGORIES[0], venue: "", mode: "In-person", certificationIssued: "no", certificationRef: "", trainingBudget: "" });
  const [pdpForm, setPDPForm] = useState({ staff: "", goals: "3", nextReview: "", status: "Active" as PDP["status"], reviewType: "Line manager", goal1: "", goal2: "", goal3: "", developmentArea: "", supportRequired: "" });

  const anyDialogOpen = appraisalOpen || observationOpen || trainingOpen || pdpOpen;
  const { data: pickerTeachers = [], isLoading: pickerTeachersLoading } = useQuery({
    queryKey: ["staff-dev-picker-teachers", active.id],
    queryFn: () => api.teachers.list(active.id),
    enabled: anyDialogOpen,
  });
  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["staff-dev-picker-users", active.id],
    queryFn: () => api.users.list(active.id),
    enabled: anyDialogOpen,
  });
  const teacherOptions: PersonOption[] = (pickerTeachers as any[]).map((t) => ({
    id: t.id,
    label: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.id,
    sublabel: t.email,
  }));
  const staffOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));
  const findTeacher = (id: string) => (pickerTeachers as any[]).find((t) => t.id === id);
  const teacherLabel = (t: any) => `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim();

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
        actions={<Button variant="outlined" onClick={() => { downloadCsv((trainings as any[]).map((t: any) => ({ Course: t.program || t.course, Provider: t.provider, Category: t.category, Staff: t.staffName || t.staff, Hours: t.hours, Date: t.startDate || t.date, Mode: t.mode, "Cert Issued": t.certificationIssued ? "Yes" : "No" })), "cpd-summary"); toast.success("CPD summary exported"); }}>Export CPD report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active PDPs" value={pdps.filter((p) => p.status === "Active").length} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Observations this term" value={observations.length} accent="accent" icon={<Star className="h-4 w-4" />} />
        <StatCard label="Avg appraisal score" value={`${Math.round(avgScore)}%`} hint="Completed appraisals" accent="success" icon={<Users className="h-4 w-4" />} />
        <StatCard label="CPD hours logged" value={totalHours} hint="This academic year" accent="warning" icon={<BookOpen className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="appraisals" label="Appraisals" />
        <Tab value="observations" label="Lesson observations" />
        <Tab value="training" label="CPD training" />
        <Tab value="pdp" label="PDPs" />
      </Tabs>

      {/* APPRAISALS */}
      {tab === "appraisals" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button variant="contained" size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAppraisalOpen(true)}>Start appraisal</Button>
            <Dialog open={appraisalOpen} onClose={() => setAppraisalOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Start appraisal</DialogTitle>
                <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Find teacher</p>
                    <PersonCombobox
                      options={teacherOptions}
                      loading={pickerTeachersLoading}
                      placeholder="Search teaching staff…"
                      emptyText="No teachers found."
                      onSelect={(option) => {
                        const teacher = findTeacher(option.id);
                        if (!teacher) return;
                        setAppraisalForm((prev) => ({ ...prev, staff: teacherLabel(teacher) }));
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Find reviewer</p>
                    <PersonCombobox
                      options={staffOptions}
                      loading={pickerUsersLoading}
                      placeholder="Search school staff…"
                      emptyText="No staff found."
                      onSelect={(option) => setAppraisalForm((prev) => ({ ...prev, reviewer: option.label }))}
                    />
                  </div>
                  <TextField label="Staff member" value={appraisalForm.staff} onChange={(e) => setAppraisalForm({ ...appraisalForm, staff: e.target.value })} placeholder="Full name" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField label="Role / position" value={appraisalForm.role} onChange={(e) => setAppraisalForm({ ...appraisalForm, role: e.target.value })} placeholder="Teacher, HOD, Warden" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                  <TextField label="Reviewer" value={appraisalForm.reviewer} onChange={(e) => setAppraisalForm({ ...appraisalForm, reviewer: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField label="Appraisal cycle" value={appraisalForm.cycle} onChange={(e) => setAppraisalForm({ ...appraisalForm, cycle: e.target.value })} placeholder="Term 2 · 2026" slotProps={{ htmlInput: { maxLength: 50 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Appraisal method"
                    value={appraisalForm.appraisalMethod}
                    onChange={(e) => setAppraisalForm({ ...appraisalForm, appraisalMethod: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Line manager review", "360° feedback", "Self-appraisal", "Peer review", "Combined"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="date"
                    label="Start date"
                    value={appraisalForm.startDate}
                    onChange={(e) => setAppraisalForm({ ...appraisalForm, startDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField type="number" label="Target score (%)" slotProps={{ htmlInput: { min: 0, max: 100 } }} value={appraisalForm.targetScore} onChange={(e) => setAppraisalForm({ ...appraisalForm, targetScore: e.target.value })} placeholder="70" fullWidth size="small" />
                  <TextField label="Competency focus area" value={appraisalForm.competencyFocus} onChange={(e) => setAppraisalForm({ ...appraisalForm, competencyFocus: e.target.value })} placeholder="e.g. Classroom management, lesson planning" slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth size="small" />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setAppraisalOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={startAppraisal}>Start appraisal</Button>
                </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Staff</TableCell><TableCell>Role</TableCell><TableCell>Reviewer</TableCell>
              <TableCell>Cycle</TableCell><TableCell>Score</TableCell><TableCell>Status</TableCell>
              <TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {appraisals.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.staff}</TableCell>
                  <TableCell>{a.role}</TableCell>
                  <TableCell className="text-muted-foreground">{a.reviewer}</TableCell>
                  <TableCell>{a.cycle}</TableCell>
                  <TableCell>
                    {a.score !== null ? (
                      <Chip size="small" label={`${a.score}%`} sx={badgeSx(a.score >= 75 ? "success" : "warning")} />
                    ) : <span className="text-xs text-muted-foreground">Pending</span>}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={a.status} sx={badgeSx(a.status === "Completed" ? "secondary" : a.status === "In Progress" ? "default" : "outline")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" onClick={() => {
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
          </TableContainer>
        </div>
      )}

      {/* OBSERVATIONS */}
      {tab === "observations" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button variant="contained" size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setObservationOpen(true)}>Log observation</Button>
            <Dialog open={observationOpen} onClose={() => setObservationOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Log lesson observation</DialogTitle>
                <DialogContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Find observer</p>
                      <PersonCombobox
                        options={staffOptions}
                        loading={pickerUsersLoading}
                        placeholder="Search school staff…"
                        emptyText="No staff found."
                        onSelect={(option) => setObsForm((prev) => ({ ...prev, observer: option.label }))}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Find observee</p>
                      <PersonCombobox
                        options={teacherOptions}
                        loading={pickerTeachersLoading}
                        placeholder="Search teaching staff…"
                        emptyText="No teachers found."
                        onSelect={(option) => {
                          const teacher = findTeacher(option.id);
                          if (!teacher) return;
                          setObsForm((prev) => ({ ...prev, observee: teacherLabel(teacher) }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Observer" value={obsForm.observer} onChange={(e) => setObsForm({ ...obsForm, observer: e.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                    <TextField label="Observee" value={obsForm.observee} onChange={(e) => setObsForm({ ...obsForm, observee: e.target.value })} placeholder="Teacher name" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Subject *" value={obsForm.subject} onChange={(e) => setObsForm({ ...obsForm, subject: e.target.value })} placeholder="Mathematics" slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth size="small" />
                    <TextField label="Class" value={obsForm.grade} onChange={(e) => setObsForm({ ...obsForm, grade: e.target.value })} placeholder="Form 3A" slotProps={{ htmlInput: { maxLength: 30 } }} fullWidth size="small" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      type="date"
                      label="Date *"
                      value={obsForm.date}
                      onChange={(e) => setObsForm({ ...obsForm, date: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Rating (1–5)"
                      value={obsForm.rating}
                      onChange={(e) => setObsForm({ ...obsForm, rating: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {["1", "2", "3", "4", "5"].map((r) => <MenuItem key={r} value={r}>{r} — {["Poor", "Below average", "Satisfactory", "Good", "Outstanding"][Number(r) - 1]}</MenuItem>)}
                    </TextField>
                  </div>
                  <TextField label="Notes" multiline minRows={3} value={obsForm.notes} onChange={(e) => setObsForm({ ...obsForm, notes: e.target.value })} placeholder="Key observations and recommendations..." slotProps={{ htmlInput: { maxLength: 500 } }} fullWidth size="small" />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setObservationOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={logObservation}>Log observation</Button>
                </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Observer</TableCell><TableCell>Teacher</TableCell><TableCell>Subject</TableCell>
              <TableCell>Class</TableCell><TableCell>Date</TableCell><TableCell>Rating</TableCell>
              <TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {observations.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-muted-foreground">{o.observer}</TableCell>
                  <TableCell className="font-medium">{o.observee}</TableCell>
                  <TableCell>{o.subject}</TableCell>
                  <TableCell>{o.grade}</TableCell>
                  <TableCell className="text-muted-foreground">{o.date}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={`${"★".repeat(o.rating)}${"☆".repeat(5 - o.rating)}`}
                      sx={badgeSx(o.rating >= 4 ? "success" : o.rating === 3 ? "outline" : "destructive")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" onClick={() => toast.info(o.notes || "No notes recorded")}>Notes</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {/* CPD TRAINING — connected to backend */}
      {tab === "training" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button variant="contained" size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setTrainingOpen(true)}>Log training</Button>
            <Dialog open={trainingOpen} onClose={() => setTrainingOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Log CPD training</DialogTitle>
                <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <TextField label="Course name *" value={trainForm.course} onChange={(e) => setTrainForm({ ...trainForm, course: e.target.value })} placeholder="e.g. Inclusive Education Methods" slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth size="small" />
                  </div>
                  <TextField label="Provider *" value={trainForm.provider} onChange={(e) => setTrainForm({ ...trainForm, provider: e.target.value })} placeholder="e.g. MoE CPD Unit, UNZA" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Category"
                    value={trainForm.category}
                    onChange={(e) => setTrainForm({ ...trainForm, category: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <div>
                    <p className="text-sm font-medium mb-1">Find teacher</p>
                    <PersonCombobox
                      options={teacherOptions}
                      loading={pickerTeachersLoading}
                      placeholder="Search teaching staff…"
                      emptyText="No teachers found."
                      onSelect={(option) => {
                        const teacher = findTeacher(option.id);
                        if (!teacher) return;
                        setTrainForm((prev) => ({ ...prev, staff: teacherLabel(teacher) }));
                      }}
                    />
                  </div>
                  <TextField label="Staff member" value={trainForm.staff} onChange={(e) => setTrainForm({ ...trainForm, staff: e.target.value })} placeholder="Full name" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Delivery mode"
                    value={trainForm.mode}
                    onChange={(e) => setTrainForm({ ...trainForm, mode: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["In-person", "Online", "Hybrid", "Self-study", "On-the-job"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="date"
                    label="Start date"
                    value={trainForm.startDate}
                    onChange={(e) => setTrainForm({ ...trainForm, startDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="date"
                    label="End date"
                    value={trainForm.endDate}
                    onChange={(e) => setTrainForm({ ...trainForm, endDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField label="Total hours" type="number" slotProps={{ htmlInput: { min: 1 } }} value={trainForm.hours} onChange={(e) => setTrainForm({ ...trainForm, hours: e.target.value })} placeholder="8" fullWidth size="small" />
                  <TextField label="Venue / platform" value={trainForm.venue} onChange={(e) => setTrainForm({ ...trainForm, venue: e.target.value })} placeholder="e.g. School staffroom, Zoom, NISTCOL" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Certification issued"
                    value={trainForm.certificationIssued}
                    onChange={(e) => setTrainForm({ ...trainForm, certificationIssued: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="no">No certificate</MenuItem>
                    <MenuItem value="yes">Yes — certificate issued</MenuItem>
                  </TextField>
                  <TextField label="Certificate reference" value={trainForm.certificationRef} onChange={(e) => setTrainForm({ ...trainForm, certificationRef: e.target.value })} placeholder="Certificate number or serial" slotProps={{ htmlInput: { maxLength: 80 } }} disabled={trainForm.certificationIssued !== "yes"} fullWidth size="small" />
                  <TextField label="Training budget (K)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={trainForm.trainingBudget} onChange={(e) => setTrainForm({ ...trainForm, trainingBudget: e.target.value })} placeholder="e.g. 1500" fullWidth size="small" />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setTrainingOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={logTraining} disabled={createTrainingMut.isPending}>Log training</Button>
                </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Course</TableCell><TableCell>Provider</TableCell><TableCell>Category</TableCell>
              <TableCell>Staff</TableCell><TableCell>Hours</TableCell><TableCell>Date</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {trainingsLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (trainings as any[]).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.program || t.course}</TableCell>
                  <TableCell className="text-muted-foreground">{t.provider}</TableCell>
                  <TableCell><Chip size="small" label={t.category} sx={badgeSx("outline")} /></TableCell>
                  <TableCell>{t.staffName || t.staff}</TableCell>
                  <TableCell>{t.hours}h</TableCell>
                  <TableCell className="text-muted-foreground">{t.startDate || t.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {/* PDPs */}
      {tab === "pdp" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button variant="contained" size="small" startIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPDPOpen(true)}>Create PDP</Button>
            <Dialog open={pdpOpen} onClose={() => setPDPOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create personal development plan</DialogTitle>
                <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Find teacher</p>
                    <PersonCombobox
                      options={teacherOptions}
                      loading={pickerTeachersLoading}
                      placeholder="Search teaching staff…"
                      emptyText="No teachers found."
                      onSelect={(option) => {
                        const teacher = findTeacher(option.id);
                        if (!teacher) return;
                        setPDPForm((prev) => ({ ...prev, staff: teacherLabel(teacher) }));
                      }}
                    />
                  </div>
                  <TextField label="Staff member" value={pdpForm.staff} onChange={(e) => setPDPForm({ ...pdpForm, staff: e.target.value })} placeholder="Full name" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Review type"
                    value={pdpForm.reviewType}
                    onChange={(e) => setPDPForm({ ...pdpForm, reviewType: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["Line manager", "Self-directed", "Peer-supported", "Mentorship-led"].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField label="Number of goals" type="number" slotProps={{ htmlInput: { min: 1, max: 10 } }} value={pdpForm.goals} onChange={(e) => setPDPForm({ ...pdpForm, goals: e.target.value })} fullWidth size="small" />
                  <TextField
                    select
                    label="Status"
                    value={pdpForm.status}
                    onChange={(e) => setPDPForm({ ...pdpForm, status: e.target.value as PDP["status"] })}
                    fullWidth
                    size="small"
                  >
                    {(["Active", "On Hold", "Completed"] as const).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="date"
                    label="Next review date *"
                    value={pdpForm.nextReview}
                    onChange={(e) => setPDPForm({ ...pdpForm, nextReview: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField label="Development area" value={pdpForm.developmentArea} onChange={(e) => setPDPForm({ ...pdpForm, developmentArea: e.target.value })} placeholder="e.g. Differentiated instruction, Leadership" slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth size="small" />
                  <div className="col-span-2">
                    <TextField label="Goal 1" value={pdpForm.goal1} onChange={(e) => setPDPForm({ ...pdpForm, goal1: e.target.value })} placeholder="SMART goal statement" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                  </div>
                  <div className="col-span-2">
                    <TextField label="Goal 2" value={pdpForm.goal2} onChange={(e) => setPDPForm({ ...pdpForm, goal2: e.target.value })} placeholder="SMART goal statement" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                  </div>
                  <div className="col-span-2">
                    <TextField label="Goal 3" value={pdpForm.goal3} onChange={(e) => setPDPForm({ ...pdpForm, goal3: e.target.value })} placeholder="SMART goal statement" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                  </div>
                  <div className="col-span-2">
                    <TextField label="Support required" value={pdpForm.supportRequired} onChange={(e) => setPDPForm({ ...pdpForm, supportRequired: e.target.value })} placeholder="e.g. Mentoring, funding for training, observation sessions" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                  </div>
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setPDPOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={createPDP}>Create PDP</Button>
                </DialogActions>
            </Dialog>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Staff</TableCell><TableCell>Goals</TableCell><TableCell>Next review</TableCell>
              <TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {pdps.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.staff}</TableCell>
                  <TableCell>{p.goals} goals</TableCell>
                  <TableCell className="text-muted-foreground">{p.nextReview}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.status} sx={badgeSx(p.status === "Active" ? "default" : p.status === "Completed" ? "secondary" : "outline")} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" onClick={() => toast.success(`${p.staff}'s PDP opened`)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}
    </div>
    </AccessGuard>
  );
}
