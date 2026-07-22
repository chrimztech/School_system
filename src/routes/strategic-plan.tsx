import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, TrendingUp, CheckCircle2, Plus, ChevronRight, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx, type BadgeTone } from "@/lib/utils";

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
  const map: Record<ItemStatus, BadgeTone> = {
    "On track": "success",
    "At risk": "warning",
    "Delayed": "destructive",
    "Completed": "secondary",
  };
  return <Chip size="small" label={status} sx={badgeSx(map[status])} />;
}

function priorityBadge(p: Priority) {
  const map: Record<Priority, BadgeTone> = {
    High: "destructive",
    Medium: "warning",
    Low: "secondary",
  };
  return <Chip size="small" label={p} sx={badgeSx(map[p])} />;
}

function StrategicPlanPage() {
  const { active } = useTenant();
  const qc = useQueryClient();

  const [tab, setTab] = useState("goals");
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
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setGoalOpen(true)}>Add goal</Button>
            <Dialog open={goalOpen} onClose={() => setGoalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add strategic goal</DialogTitle>
                <DialogContent>
                <div className="grid gap-3">
                  <TextField
                    select
                    label="Strategic pillar"
                    value={goalForm.pillar}
                    onChange={(e) => setGoalForm({ ...goalForm, pillar: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {PILLARS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Goal description *"
                    value={goalForm.goal}
                    onChange={(e) => setGoalForm({ ...goalForm, goal: e.target.value })}
                    placeholder="Achieve 85% ECZ pass rate..."
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    fullWidth
                    size="small"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      select
                      label="Owner"
                      value={goalForm.owner}
                      onChange={(e) => setGoalForm({ ...goalForm, owner: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {OWNERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      label="Deadline *"
                      value={goalForm.deadline}
                      onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                      placeholder="Dec 2027"
                      slotProps={{ htmlInput: { maxLength: 30 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      type="number"
                      label="Initial progress (%)"
                      slotProps={{ htmlInput: { min: 0, max: 100 } }}
                      value={goalForm.progress}
                      onChange={(e) => setGoalForm({ ...goalForm, progress: e.target.value })}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Status"
                      value={goalForm.status}
                      onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as ItemStatus })}
                      fullWidth
                      size="small"
                    >
                      {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </div>
                  <TextField
                    label="KPIs (one per line)"
                    multiline
                    minRows={3}
                    value={goalForm.kpis}
                    onChange={(e) => setGoalForm({ ...goalForm, kpis: e.target.value })}
                    placeholder={"ECZ pass rate ≥ 85%\nAvg grade B or above"}
                    fullWidth
                    size="small"
                  />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setGoalOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={addGoal}>Add goal</Button>
                </DialogActions>
            </Dialog>

            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setReviewOpen(true)}>Log review</Button>
            <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Log strategic review</DialogTitle>
                <DialogContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      type="date"
                      label="Date *"
                      value={reviewForm.date}
                      onChange={(e) => setReviewForm({ ...reviewForm, date: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Cycle label *"
                      value={reviewForm.cycle}
                      onChange={(e) => setReviewForm({ ...reviewForm, cycle: e.target.value })}
                      placeholder="Q2 2026"
                      slotProps={{ htmlInput: { maxLength: 20 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      select
                      label="Facilitator"
                      value={reviewForm.facilitator}
                      onChange={(e) => setReviewForm({ ...reviewForm, facilitator: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {OWNERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      type="number"
                      label="Attendees"
                      slotProps={{ htmlInput: { min: 1, max: 50 } }}
                      value={reviewForm.attendees}
                      onChange={(e) => setReviewForm({ ...reviewForm, attendees: e.target.value })}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <TextField
                    label="Key highlights *"
                    multiline
                    minRows={3}
                    value={reviewForm.highlights}
                    onChange={(e) => setReviewForm({ ...reviewForm, highlights: e.target.value })}
                    placeholder="Summary of achievements and challenges..."
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Decisions taken"
                    multiline
                    minRows={2}
                    value={reviewForm.decisions}
                    onChange={(e) => setReviewForm({ ...reviewForm, decisions: e.target.value })}
                    placeholder="Action decisions from the review meeting..."
                    fullWidth
                    size="small"
                  />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setReviewOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={addReview}>Save review</Button>
                </DialogActions>
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

      <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="goals" label={`Strategic goals (${goals.length})`} />
          <Tab value="actions" label={`Action items (${actions.length})`} />
          <Tab value="reviews" label={`Reviews (${reviews.length})`} />
        </Tabs>

        {/* GOALS */}
        {tab === "goals" && (
        <Box className="space-y-4">
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
                  <IconButton size="small" aria-label={selectedGoal?.id === g.id ? "Collapse goal details" : "Expand goal details"} onClick={() => setSelectedGoal(g === selectedGoal ? null : g)}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${selectedGoal?.id === g.id ? "rotate-90" : ""}`} />
                  </IconButton>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{g.progress}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <LinearProgress variant="determinate" value={g.progress} sx={{ flex: 1, height: 8, borderRadius: 999 }} />
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
                  {g.kpis.map((k) => <Chip key={k} size="small" label={k} sx={{ ...badgeSx("outline"), fontSize: 10 }} />)}
                </div>
              )}
              {selectedGoal?.id === g.id && (
                <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Action items</p>
                    <Button size="small" variant="outlined" startIcon={<Plus size={12} />} onClick={() => { setActionForm({ ...actionForm, goalId: g.id }); setActionOpen(true); }}>
                      Add action
                    </Button>
                    <Dialog open={actionOpen} onClose={() => setActionOpen(false)} maxWidth="xs" fullWidth>
                        <DialogTitle>Add action item</DialogTitle>
                        <DialogContent>
                        <div className="grid gap-3">
                          <TextField
                            label="Action *"
                            multiline
                            minRows={2}
                            value={actionForm.action}
                            onChange={(e) => setActionForm({ ...actionForm, action: e.target.value })}
                            placeholder="What needs to be done?"
                            fullWidth
                            size="small"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <TextField
                              select
                              label="Owner"
                              value={actionForm.owner}
                              onChange={(e) => setActionForm({ ...actionForm, owner: e.target.value })}
                              fullWidth
                              size="small"
                            >
                              {OWNERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                            </TextField>
                            <TextField
                              type="date"
                              label="Due date *"
                              value={actionForm.dueDate}
                              onChange={(e) => setActionForm({ ...actionForm, dueDate: e.target.value })}
                              slotProps={{ inputLabel: { shrink: true } }}
                              fullWidth
                              size="small"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <TextField
                              select
                              label="Priority"
                              value={actionForm.priority}
                              onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value as Priority })}
                              fullWidth
                              size="small"
                            >
                              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                            </TextField>
                            <TextField
                              select
                              label="Status"
                              value={actionForm.status}
                              onChange={(e) => setActionForm({ ...actionForm, status: e.target.value as ItemStatus })}
                              fullWidth
                              size="small"
                            >
                              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                            </TextField>
                          </div>
                        </div>
                        </DialogContent>
                        <DialogActions>
                          <Button variant="outlined" color="inherit" onClick={() => setActionOpen(false)}>Cancel</Button>
                          <Button variant="contained" onClick={addAction}>Add action</Button>
                        </DialogActions>
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
                              <IconButton size="small" aria-label="Mark action as completed" onClick={() => markAction(a.id, "Completed")}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </IconButton>
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
        </Box>
        )}

        {/* ALL ACTIONS */}
        {tab === "actions" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Action</TableCell><TableCell>Goal</TableCell><TableCell>Owner</TableCell>
                <TableCell>Due</TableCell><TableCell>Priority</TableCell><TableCell>Status</TableCell>
                <TableCell className="text-right">Mark</TableCell>
              </TableRow>
            </TableHead>
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
                        <Button size="small" variant="outlined" onClick={() => markAction(a.id, "Completed")}>Complete</Button>
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
          </TableContainer>
        </Box>
        )}

        {/* REVIEWS */}
        {tab === "reviews" && (
        <Box className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{r.cycle} Strategic Review</p>
                  <p className="text-xs text-muted-foreground">{r.date} · Facilitated by {r.facilitator} · {r.attendees} attendees</p>
                </div>
                <Chip size="small" label="Review" sx={badgeSx("outline")} />
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
        </Box>
        )}
      </Box>
    </div>
  );
}
