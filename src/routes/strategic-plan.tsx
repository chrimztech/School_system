import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, TrendingUp, CheckCircle2, Plus, ChevronRight, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/strategic-plan")({
  head: () => ({ meta: [{ title: "Strategic Plan — SRMS" }] }),
  component: StrategicPlanPage,
});

type Priority = "High" | "Medium" | "Low";
type ItemStatus = "On track" | "At risk" | "Delayed" | "Completed";

type StrategicGoal = {
  id: string;
  pillar: string;
  goal: string;
  owner: string;
  deadline: string;
  progress: number;
  status: ItemStatus;
  kpis: string[];
};

type ActionItem = {
  id: string;
  goalId: string;
  action: string;
  owner: string;
  dueDate: string;
  priority: Priority;
  status: ItemStatus;
};

type StrategicReview = {
  id: string;
  date: string;
  cycle: string;
  facilitator: string;
  attendees: number;
  highlights: string;
  decisions: string;
};

const PILLARS = ["Academic Excellence", "Infrastructure", "Staff Development", "Community Engagement", "Financial Sustainability", "Technology & Innovation"];
const OWNERS = ["Head Teacher", "Deputy Head", "Finance Officer", "Head of Academics", "IT Coordinator", "HR Manager"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STATUSES: ItemStatus[] = ["On track", "At risk", "Delayed", "Completed"];


function statusBadge(status: ItemStatus) {
  const map: Record<ItemStatus, string> = {
    "On track": "bg-success/15 text-success",
    "At risk": "bg-warning/15 text-warning-foreground",
    "Delayed": "bg-destructive/15 text-destructive",
    "Completed": "bg-muted text-muted-foreground",
  };
  return <Badge className={map[status]}>{status}</Badge>;
}

function priorityBadge(p: Priority) {
  const map: Record<Priority, string> = {
    High: "bg-destructive/15 text-destructive",
    Medium: "bg-warning/15 text-warning-foreground",
    Low: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[p]}>{p}</Badge>;
}

function StrategicPlanPage() {
  const { active } = useTenant();
  const qc = useQueryClient();

  const [goalOpen, setGoalOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<StrategicGoal | null>(null);

  const [goalForm, setGoalForm] = useState({ pillar: PILLARS[0], goal: "", owner: OWNERS[0], deadline: "", progress: "0", status: "On track" as ItemStatus, kpis: "" });
  const [actionForm, setActionForm] = useState({ goalId: "", action: "", owner: OWNERS[0], dueDate: "", priority: "High" as Priority, status: "On track" as ItemStatus });
  const [reviewForm, setReviewForm] = useState({ date: "", cycle: "", facilitator: OWNERS[0], attendees: "10", highlights: "", decisions: "" });

  const { data: goalsRaw = [] } = useQuery({ queryKey: ["strategic-goals", active.id], queryFn: () => api.strategicPlan.goals(active.id) });
  const { data: actionsRaw = [] } = useQuery({ queryKey: ["strategic-actions", active.id], queryFn: () => api.strategicPlan.actions(active.id) });
  const { data: reviewsRaw = [] } = useQuery({ queryKey: ["strategic-reviews", active.id], queryFn: () => api.strategicPlan.reviews(active.id) });

  const goals: StrategicGoal[] = (goalsRaw as any[]).map((goal) => ({
    id: goal.id,
    pillar: goal.pillar ?? "",
    goal: goal.goal ?? "",
    owner: goal.owner ?? "",
    deadline: goal.deadline ?? "",
    progress: Number(goal.progress ?? 0),
    status: (goal.status ?? "On track") as ItemStatus,
    kpis: String(goal.kpis ?? "")
      .split(",")
      .map((kpi) => kpi.trim())
      .filter(Boolean),
  }));
  const actions: ActionItem[] = (actionsRaw as any[]).map((action) => ({
    id: action.id,
    goalId: action.goalId ?? "",
    action: action.action ?? "",
    owner: action.owner ?? "",
    dueDate: action.dueDate ?? "",
    priority: (action.priority ?? "Medium") as Priority,
    status: (action.status ?? "On track") as ItemStatus,
  }));
  const reviews: StrategicReview[] = (reviewsRaw as any[]).map((review) => ({
    id: review.id,
    date: review.reviewDate ?? review.date ?? "",
    cycle: review.cycle ?? "",
    facilitator: review.facilitator ?? "",
    attendees: Number(review.attendees ?? 0),
    highlights: review.highlights ?? "",
    decisions: review.decisions ?? "",
  }));

  const createGoalMut = useMutation({
    mutationFn: (data: any) => api.strategicPlan.createGoal(active.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["strategic-goals", active.id] }); toast.success("Strategic goal added"); setGoalForm({ pillar: PILLARS[0], goal: "", owner: OWNERS[0], deadline: "", progress: "0", status: "On track", kpis: "" }); setGoalOpen(false); },
    onError: () => toast.error("Failed to add goal"),
  });
  const updateGoalMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.strategicPlan.updateGoal(active.id, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategic-goals", active.id] }),
  });
  const createActionMut = useMutation({
    mutationFn: (data: any) => api.strategicPlan.createAction(active.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["strategic-actions", active.id] }); toast.success("Action item added"); setActionForm({ goalId: "", action: "", owner: OWNERS[0], dueDate: "", priority: "High", status: "On track" }); setActionOpen(false); },
    onError: () => toast.error("Failed to add action"),
  });
  const updateActionMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.strategicPlan.updateAction(active.id, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategic-actions", active.id] }),
  });
  const createReviewMut = useMutation({
    mutationFn: (data: any) => api.strategicPlan.createReview(active.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["strategic-reviews", active.id] }); toast.success("Strategic review logged"); setReviewForm({ date: "", cycle: "", facilitator: OWNERS[0], attendees: "10", highlights: "", decisions: "" }); setReviewOpen(false); },
    onError: () => toast.error("Failed to log review"),
  });

  const onTrack = goals.filter((g) => g.status === "On track").length;
  const atRisk = goals.filter((g) => g.status === "At risk" || g.status === "Delayed").length;
  const completed = goals.filter((g) => g.status === "Completed").length;
  const avgProgress = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  const goalActions = useMemo(() => selectedGoal ? actions.filter((a) => a.goalId === selectedGoal.id) : [], [actions, selectedGoal]);

  const addGoal = () => {
    if (!goalForm.goal.trim() || !goalForm.deadline.trim()) { toast.error("Goal description and deadline are required"); return; }
    const kpis = goalForm.kpis.split("\n").map((k) => k.trim()).filter(Boolean).join(",");
    createGoalMut.mutate({ pillar: goalForm.pillar, goal: goalForm.goal.trim(), owner: goalForm.owner, deadline: goalForm.deadline.trim(), progress: Math.max(0, Math.min(100, Number(goalForm.progress) || 0)), status: goalForm.status, kpis });
  };

  const addAction = () => {
    if (!actionForm.action.trim() || !actionForm.dueDate.trim()) { toast.error("Action description and due date are required"); return; }
    createActionMut.mutate({ goalId: actionForm.goalId || (goals[0]?.id ?? ""), action: actionForm.action.trim(), owner: actionForm.owner, dueDate: actionForm.dueDate.trim(), priority: actionForm.priority, status: actionForm.status });
  };

  const markAction = (id: string, status: ItemStatus) => {
    updateActionMut.mutate({ id, data: { status } });
    toast.success(`Action marked as ${status}`);
  };

  const updateGoalProgress = (id: string, progress: number) => {
    const clamped = Math.max(0, Math.min(100, progress));
    updateGoalMut.mutate({ id, data: { progress: clamped, status: clamped >= 100 ? "Completed" : undefined } });
  };

  const addReview = () => {
    if (!reviewForm.date.trim() || !reviewForm.cycle.trim() || !reviewForm.highlights.trim()) { toast.error("Date, cycle, and highlights are required"); return; }
    createReviewMut.mutate({ reviewDate: reviewForm.date.trim(), cycle: reviewForm.cycle.trim(), facilitator: reviewForm.facilitator, attendees: Number(reviewForm.attendees) || 1, highlights: reviewForm.highlights.trim(), decisions: reviewForm.decisions.trim() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategic Plan"
        description="School-wide strategic goals, action items, and review cycles."
        actions={
          <div className="flex gap-2">
            <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Add goal</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Add strategic goal</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Strategic pillar</Label>
                    <Select value={goalForm.pillar} onValueChange={(v) => setGoalForm({ ...goalForm, pillar: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{PILLARS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Goal description *</Label>
                    <Input className="mt-1" value={goalForm.goal} onChange={(e) => setGoalForm({ ...goalForm, goal: e.target.value })} placeholder="Achieve 85% ECZ pass rate..." maxLength={200} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Owner</Label>
                      <Select value={goalForm.owner} onValueChange={(v) => setGoalForm({ ...goalForm, owner: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Deadline *</Label>
                      <Input className="mt-1" value={goalForm.deadline} onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })} placeholder="Dec 2027" maxLength={30} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Initial progress (%)</Label>
                      <Input type="number" min={0} max={100} className="mt-1" value={goalForm.progress} onChange={(e) => setGoalForm({ ...goalForm, progress: e.target.value })} />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={goalForm.status} onValueChange={(v) => setGoalForm({ ...goalForm, status: v as ItemStatus })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>KPIs (one per line)</Label>
                    <Textarea className="mt-1" value={goalForm.kpis} onChange={(e) => setGoalForm({ ...goalForm, kpis: e.target.value })} placeholder={"ECZ pass rate ≥ 85%\nAvg grade B or above"} rows={3} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setGoalOpen(false)}>Cancel</Button>
                  <Button onClick={addGoal}>Add goal</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Log review</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Log strategic review</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date *</Label>
                      <Input type="date" className="mt-1" value={reviewForm.date} onChange={(e) => setReviewForm({ ...reviewForm, date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Cycle label *</Label>
                      <Input className="mt-1" value={reviewForm.cycle} onChange={(e) => setReviewForm({ ...reviewForm, cycle: e.target.value })} placeholder="Q2 2026" maxLength={20} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Facilitator</Label>
                      <Select value={reviewForm.facilitator} onValueChange={(v) => setReviewForm({ ...reviewForm, facilitator: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Attendees</Label>
                      <Input type="number" min={1} max={50} className="mt-1" value={reviewForm.attendees} onChange={(e) => setReviewForm({ ...reviewForm, attendees: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Key highlights *</Label>
                    <Textarea className="mt-1" value={reviewForm.highlights} onChange={(e) => setReviewForm({ ...reviewForm, highlights: e.target.value })} placeholder="Summary of achievements and challenges..." rows={3} />
                  </div>
                  <div>
                    <Label>Decisions taken</Label>
                    <Textarea className="mt-1" value={reviewForm.decisions} onChange={(e) => setReviewForm({ ...reviewForm, decisions: e.target.value })} placeholder="Action decisions from the review meeting..." rows={2} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
                  <Button onClick={addReview}>Save review</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Goals on track" value={onTrack} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="At risk / delayed" value={atRisk} accent="warning" icon={<Target className="h-4 w-4" />} />
        <StatCard label="Completed goals" value={completed} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Avg. progress" value={`${avgProgress}%`} accent="accent" icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="goals">
        <TabsList>
          <TabsTrigger value="goals">Strategic goals ({goals.length})</TabsTrigger>
          <TabsTrigger value="actions">Action items ({actions.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
        </TabsList>

        {/* GOALS */}
        <TabsContent value="goals" className="space-y-4">
          {goals.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No strategic goals recorded yet.
            </div>
          )}
          {goals.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.goal}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{g.pillar} · Owner: {g.owner} · Due: {g.deadline}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(g.status)}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedGoal(g === selectedGoal ? null : g)}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${selectedGoal?.id === g.id ? "rotate-90" : ""}`} />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{g.progress}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={g.progress} className="flex-1 h-2" />
                  <input
                    type="number" min={0} max={100}
                    className="w-14 rounded border border-input bg-background px-2 py-0.5 text-xs text-center"
                    value={g.progress}
                    onChange={(e) => updateGoalProgress(g.id, Number(e.target.value))}
                  />
                </div>
              </div>
              {g.kpis.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {g.kpis.map((k) => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
                </div>
              )}
              {selectedGoal?.id === g.id && (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Action items</p>
                    <Dialog open={actionOpen} onOpenChange={setActionOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" onClick={() => setActionForm({ ...actionForm, goalId: g.id })}>
                          <Plus className="mr-1 h-3 w-3" />Add action
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader><DialogTitle>Add action item</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                          <div>
                            <Label>Action *</Label>
                            <Textarea className="mt-1" value={actionForm.action} onChange={(e) => setActionForm({ ...actionForm, action: e.target.value })} placeholder="What needs to be done?" rows={2} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Owner</Label>
                              <Select value={actionForm.owner} onValueChange={(v) => setActionForm({ ...actionForm, owner: v })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>{OWNERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Due date *</Label>
                              <Input type="date" className="mt-1" value={actionForm.dueDate} onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label>Priority</Label>
                              <Select value={actionForm.priority} onValueChange={(v) => setActionForm({ ...actionForm, priority: v as Priority })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Status</Label>
                              <Select value={actionForm.status} onValueChange={(v) => setActionForm({ ...actionForm, status: v as ItemStatus })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <DialogFooter className="mt-2">
                          <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
                          <Button onClick={addAction}>Add action</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  {goalActions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No action items yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {goalActions.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 rounded-md bg-background px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{a.action}</p>
                            <p className="text-xs text-muted-foreground">{a.owner} · Due: {a.dueDate}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {priorityBadge(a.priority)}
                            {statusBadge(a.status)}
                            {a.status !== "Completed" && (
                              <Button size="sm" variant="outline" onClick={() => markAction(a.id, "Completed")}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* ALL ACTIONS */}
        <TabsContent value="actions" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead><TableHead>Goal</TableHead><TableHead>Owner</TableHead>
                <TableHead>Due</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Mark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => {
                const goal = goals.find((g) => g.id === a.goalId);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{a.action}</TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[140px] truncate">{goal?.goal ?? "—"}</TableCell>
                    <TableCell>{a.owner}</TableCell>
                    <TableCell className="text-muted-foreground">{a.dueDate}</TableCell>
                    <TableCell>{priorityBadge(a.priority)}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="text-right">
                      {a.status !== "Completed" ? (
                        <Button size="sm" variant="outline" onClick={() => markAction(a.id, "Completed")}>Complete</Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Done</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {actions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No action items yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {/* REVIEWS */}
        <TabsContent value="reviews" className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.cycle} Strategic Review</p>
                  <p className="text-xs text-muted-foreground">{r.date} · Facilitated by {r.facilitator} · {r.attendees} attendees</p>
                </div>
                <Badge variant="outline">Review</Badge>
              </div>
              <div className="grid gap-1 text-sm">
                <p><span className="font-medium">Highlights: </span>{r.highlights}</p>
                {r.decisions && <p><span className="font-medium">Decisions: </span>{r.decisions}</p>}
              </div>
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No reviews logged yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
