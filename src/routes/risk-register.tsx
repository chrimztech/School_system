import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/risk-register")({
  head: () => ({ meta: [{ title: "Risk Register - SRMS" }] }),
  component: RiskRegisterPage,
});

const CATEGORIES = ["Compliance", "Security", "Operations", "Finance", "Vendors"] as const;
const STATUSES = ["Open", "Mitigating", "Monitoring", "Closed"] as const;
const LIKELIHOODS = ["Low", "Medium", "High"] as const;
const IMPACTS = ["Low", "Medium", "High"] as const;

const categoryTone: Record<string, "secondary" | "outline" | "warning" | "destructive" | "success"> = {
  Compliance: "warning", Security: "destructive", Operations: "outline", Finance: "secondary", Vendors: "success",
};

const linkedRoute: Record<string, string> = {
  Compliance: "/compliance", Security: "/security", Operations: "/facilities", Finance: "/accounting", Vendors: "/procurement",
};

function RiskRegisterPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
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
            <Button variant="outline" asChild><Link to="/compliance">Open compliance board</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add risk</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add risk item</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Risk title *</Label>
                    <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. MFA rollout behind audit deadline" maxLength={160} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as typeof CATEGORIES[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Risk owner *</Label>
                    <Input className="mt-1" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="e.g. IT Security, Finance, Operations" maxLength={100} />
                  </div>
                  <div>
                    <Label>Inherent likelihood</Label>
                    <Select value={form.likelihood} onValueChange={(v) => setForm({ ...form, likelihood: v as typeof LIKELIHOODS[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{LIKELIHOODS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Inherent impact</Label>
                    <Select value={form.impact} onValueChange={(v) => setForm({ ...form, impact: v as typeof IMPACTS[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{IMPACTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Residual likelihood</Label>
                    <Select value={form.residualLikelihood} onValueChange={(v) => setForm({ ...form, residualLikelihood: v as typeof LIKELIHOODS[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{LIKELIHOODS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Residual impact</Label>
                    <Select value={form.residualImpact} onValueChange={(v) => setForm({ ...form, residualImpact: v as typeof IMPACTS[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{IMPACTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Review frequency</Label>
                    <Select value={form.reviewFrequency} onValueChange={(v) => setForm({ ...form, reviewFrequency: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action owner</Label>
                    <Input className="mt-1" value={form.actionOwner} onChange={(e) => setForm({ ...form, actionOwner: e.target.value })} placeholder="Person responsible for mitigation actions" maxLength={100} />
                  </div>
                  <div>
                    <Label>Mitigation deadline</Label>
                    <Input type="date" className="mt-1" value={form.mitigationDeadline} onChange={(e) => setForm({ ...form, mitigationDeadline: e.target.value })} />
                  </div>
                  <div>
                    <Label>Next review date</Label>
                    <Input type="date" className="mt-1" value={form.nextReviewDate} onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Mitigation response</Label>
                    <Textarea className="mt-1" rows={3} value={form.mitigation} onChange={(e) => setForm({ ...form, mitigation: e.target.value })} placeholder="Describe the mitigation plan, controls, approvals, and escalation path." maxLength={600} />
                  </div>
                  <div className="col-span-2">
                    <Label>Internal notes</Label>
                    <Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Audit evidence references, committee decisions, linked incident IDs, or regulatory obligations" maxLength={400} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addRisk} disabled={createMut.isPending}>Add to register</Button>
                </DialogFooter>
              </DialogContent>
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

      <Tabs defaultValue="register" className="space-y-4">
        <TabsList>
          <TabsTrigger value="register">Risk register</TabsTrigger>
          <TabsTrigger value="mitigation">Mitigation plans</TabsTrigger>
          <TabsTrigger value="review">Review cadence</TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Likelihood</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (risks as any[]).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.title}</div>
                  </TableCell>
                  <TableCell><Badge variant={categoryTone[r.category] ?? "outline"}>{r.category}</Badge></TableCell>
                  <TableCell>{r.owner}</TableCell>
                  <TableCell>
                    <Badge variant={r.likelihood === "High" ? "destructive" : r.likelihood === "Medium" ? "warning" : "outline"}>{r.likelihood}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.impact === "High" ? "destructive" : r.impact === "Medium" ? "warning" : "outline"}>{r.impact}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => { updateMut.mutate({ id: r.id, status: v }); toast.success(`Risk moved to ${v}`); }}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={linkedRoute[r.category] ?? "/compliance"}>Open {r.category?.toLowerCase()}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="mitigation" className="grid gap-4 lg:grid-cols-2">
          {(risks as any[]).map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.owner}</p>
                </div>
                <Badge variant={categoryTone[r.category] ?? "outline"}>{r.category}</Badge>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{r.mitigation || "No mitigation plan defined yet."}</p>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm font-medium">Current status</span>
                <Badge variant={r.status === "Closed" ? "secondary" : r.status === "Mitigating" ? "success" : r.status === "Monitoring" ? "outline" : "warning"}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="review" className="grid gap-4 lg:grid-cols-3">
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
              <Button className="w-full" variant="outline" asChild><Link to="/incident-management">Open incident queue</Link></Button>
              <Button className="w-full" variant="outline" asChild><Link to="/vendor-management">Review vendors</Link></Button>
              <Button className="w-full" onClick={() => toast.success("Risk review board scheduled for next Tuesday at 09:00")}>Schedule board review</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
