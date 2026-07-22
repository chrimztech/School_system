import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx, type BadgeTone } from "@/lib/utils";

export const Route = createFileRoute("/risk-register")({
  head: () => ({ meta: [{ title: "Risk Register - SRMS" }] }),
  component: RiskRegisterPage,
});

const CATEGORIES = ["Compliance", "Security", "Operations", "Finance", "Vendors"] as const;
const STATUSES = ["Open", "Mitigating", "Monitoring", "Closed"] as const;
const LIKELIHOODS = ["Low", "Medium", "High"] as const;
const IMPACTS = ["Low", "Medium", "High"] as const;

const categoryTone: Record<string, BadgeTone> = {
  Compliance: "warning", Security: "destructive", Operations: "outline", Finance: "secondary", Vendors: "success",
};

const linkedRoute: Record<string, string> = {
  Compliance: "/compliance", Security: "/security", Operations: "/facilities", Finance: "/accounting", Vendors: "/procurement",
};

function RiskRegisterPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [tab, setTab] = useState("register");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "Compliance" as typeof CATEGORIES[number],
    owner: "",
    likelihood: "Medium" as typeof LIKELIHOODS[number],
    impact: "Medium" as typeof IMPACTS[number],
    mitigation: "",
    reviewFrequency: "Monthly",
    mitigationDeadline: "",
    nextReviewDate: "",
    actionOwner: "",
    residualLikelihood: "Low" as typeof LIKELIHOODS[number],
    residualImpact: "Low" as typeof IMPACTS[number],
    notes: "",
  });

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ["risk-register", active.id],
    queryFn: () => api.riskRegister.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.riskRegister.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["risk-register", active.id] });
      toast.success("Risk added to the register");
      setOpen(false);
      setForm({ title: "", category: "Compliance", owner: "", likelihood: "Medium", impact: "Medium", mitigation: "", reviewFrequency: "Monthly", mitigationDeadline: "", nextReviewDate: "", actionOwner: "", residualLikelihood: "Low", residualImpact: "Low", notes: "" });
    },
    onError: () => toast.error("Failed to add risk"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.riskRegister.update(active.id, id, { status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["risk-register", active.id] }); },
    onError: () => toast.error("Failed to update status"),
  });

  const addRisk = () => {
    if (!form.title.trim() || !form.owner.trim()) { toast.error("Title and owner are required"); return; }
    createMut.mutate({
      title: form.title,
      category: form.category,
      owner: form.owner,
      likelihood: form.likelihood,
      impact: form.impact,
      status: "Open",
      mitigation: form.mitigation || "Mitigation plan to be defined at next review.",
      reviewFrequency: form.reviewFrequency,
      mitigationDeadline: form.mitigationDeadline || null,
      nextReviewDate: form.nextReviewDate || null,
      actionOwner: form.actionOwner.trim() || form.owner,
      residualLikelihood: form.residualLikelihood,
      residualImpact: form.residualImpact,
      notes: form.notes.trim() || null,
    });
  };

  const openRisks = (risks as any[]).filter((r: any) => r.status !== "Closed");
  const criticalRisks = (risks as any[]).filter((r: any) => r.likelihood === "High" && r.impact === "High" && r.status !== "Closed");
  const monitored = (risks as any[]).filter((r: any) => r.status === "Monitoring");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Risk Register"
        description="Centralise operational, compliance, security and vendor risks with accountable mitigation owners."
        actions={
          <>
            <Button variant="outlined" component={Link} to="/compliance">Open compliance board</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Add risk</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Add risk item</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Risk title *" fullWidth size="small" className="col-span-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. MFA rollout behind audit deadline" slotProps={{ htmlInput: { maxLength: 160 } }} />
                  <TextField select label="Category" fullWidth size="small" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof CATEGORIES[number] })}>
                    {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField label="Risk owner *" fullWidth size="small" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="e.g. IT Security, Finance, Operations" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField select label="Inherent likelihood" fullWidth size="small" value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: e.target.value as typeof LIKELIHOODS[number] })}>
                    {LIKELIHOODS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </TextField>
                  <TextField select label="Inherent impact" fullWidth size="small" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value as typeof IMPACTS[number] })}>
                    {IMPACTS.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                  </TextField>
                  <TextField select label="Residual likelihood" fullWidth size="small" value={form.residualLikelihood} onChange={(e) => setForm({ ...form, residualLikelihood: e.target.value as typeof LIKELIHOODS[number] })}>
                    {LIKELIHOODS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </TextField>
                  <TextField select label="Residual impact" fullWidth size="small" value={form.residualImpact} onChange={(e) => setForm({ ...form, residualImpact: e.target.value as typeof IMPACTS[number] })}>
                    {IMPACTS.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                  </TextField>
                  <TextField select label="Review frequency" fullWidth size="small" value={form.reviewFrequency} onChange={(e) => setForm({ ...form, reviewFrequency: e.target.value })}>
                    {["Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually"].map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </TextField>
                  <TextField label="Action owner" fullWidth size="small" value={form.actionOwner} onChange={(e) => setForm({ ...form, actionOwner: e.target.value })} placeholder="Person responsible for mitigation actions" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField type="date" label="Mitigation deadline" fullWidth size="small" value={form.mitigationDeadline} onChange={(e) => setForm({ ...form, mitigationDeadline: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="date" label="Next review date" fullWidth size="small" value={form.nextReviewDate} onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Mitigation response" fullWidth size="small" multiline minRows={3} className="col-span-2" value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} placeholder="Describe the mitigation plan, controls, approvals, and escalation path." slotProps={{ htmlInput: { maxLength: 600 } }} />
                  <TextField label="Internal notes" fullWidth size="small" multiline minRows={2} className="col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Audit evidence references, committee decisions, linked incident IDs, or regulatory obligations" slotProps={{ htmlInput: { maxLength: 400 } }} />
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={addRisk} disabled={createMut.isPending}>Add to register</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open risks" value={openRisks.length} accent="primary" icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Critical exposure" value={criticalRisks.length} accent="destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Monitored" value={monitored.length} accent="warning" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Total logged" value={(risks as any[]).length} accent="accent" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="register" label="Risk register" />
        <Tab value="mitigation" label="Mitigation plans" />
        <Tab value="review" label="Review cadence" />
      </Tabs>

      {tab === "register" && (
        <Box className="rounded-xl border border-border bg-card shadow-sm">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Risk</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Likelihood</TableCell>
                <TableCell>Impact</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (risks as any[]).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.title}</div>
                  </TableCell>
                  <TableCell><Chip size="small" label={r.category} sx={badgeSx(categoryTone[r.category] ?? "outline")} /></TableCell>
                  <TableCell>{r.owner}</TableCell>
                  <TableCell>
                    <Chip size="small" label={r.likelihood} sx={badgeSx(r.likelihood === "High" ? "destructive" : r.likelihood === "Medium" ? "warning" : "outline")} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={r.impact} sx={badgeSx(r.impact === "High" ? "destructive" : r.impact === "Medium" ? "warning" : "outline")} />
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      className="w-36"
                      value={r.status}
                      onChange={(e) => { updateMut.mutate({ id: r.id, status: e.target.value }); toast.success(`Risk moved to ${e.target.value}`); }}
                    >
                      {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" component={Link} to={linkedRoute[r.category] ?? "/compliance"}>
                      Open {r.category?.toLowerCase()}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
      )}

      {tab === "mitigation" && (
        <Box className="grid gap-4 lg:grid-cols-2">
          {(risks as any[]).map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.owner}</p>
                </div>
                <Chip size="small" label={r.category} sx={badgeSx(categoryTone[r.category] ?? "outline")} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{r.mitigation || "No mitigation plan defined yet."}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm font-medium">Current status</span>
                <Chip
                  size="small"
                  label={r.status}
                  sx={badgeSx(r.status === "Closed" ? "secondary" : r.status === "Mitigating" ? "success" : r.status === "Monitoring" ? "outline" : "warning")}
                />
              </div>
            </div>
          ))}
        </Box>
      )}

      {tab === "review" && (
        <Box className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold text-foreground">Upcoming review board</h2>
            <p className="mt-1 text-xs text-muted-foreground">Use a consistent monthly cadence to close actions and rerate exposure.</p>
            <div className="mt-4 space-y-3">
              {[
                "Review all items with High likelihood and High impact",
                "Confirm procurement and contract mitigations before renewals",
                "Verify policy attestations and evidence attachments",
                "Escalate unresolved maintenance blockers to district leadership",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-foreground">{item}</div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Review actions</h2>
            <p className="mt-1 text-xs text-muted-foreground">Kick off the next committee cycle with linked modules.</p>
            <div className="mt-4 space-y-3">
              <Button fullWidth variant="outlined" component={Link} to="/incident-management">Open incident queue</Button>
              <Button fullWidth variant="outlined" component={Link} to="/vendor-management">Review vendors</Button>
              <Button fullWidth variant="contained" onClick={() => toast.success("Risk review board scheduled for next Tuesday at 09:00")}>Schedule board review</Button>
            </div>
          </div>
        </Box>
      )}
    </div>
  );
}
