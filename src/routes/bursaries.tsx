import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Plus, ShieldCheck, Users } from "lucide-react";
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
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/bursaries")({
  head: () => ({ meta: [{ title: "Bursaries - SRMS" }] }),
  component: BursariesPage,
});

type ApplicationStatus = "Submitted" | "Review" | "Approved" | "Declined";
type RenewalStatus = "Due" | "Ready" | "Approved";

type Application = { id: string; student: string; household: string; requested: number; reason: string; status: ApplicationStatus };
type Renewal = { id: string; student: string; sponsor: string; reviewDate: string; attendance: string; academics: string; status: RenewalStatus };


function BursariesPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    student: "",
    grade: "Form 1",
    sponsor: "Board bursary fund",
    coverage: "50% tuition",
    amount: "",
    status: "Active",
    household: "",
    reason: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    sponsorshipAgreementRef: "",
    disbursementSchedule: "Per term",
    performanceConditions: "",
  });

  const { data: awardsRaw = [], isLoading: awardsLoading } = useQuery({
    queryKey: ["bursaries", schoolId],
    queryFn: () => api.bursaries.list(schoolId),
  });
  const { data: applicationsRaw = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["bursary-applications", schoolId],
    queryFn: () => api.bursaries.applications(schoolId),
  });
  const { data: renewalsRaw = [], isLoading: renewalsLoading } = useQuery({
    queryKey: ["bursary-renewals", schoolId],
    queryFn: () => api.bursaries.renewals(schoolId),
  });

  const createAwardMutation = useMutation({
    mutationFn: (data: any) => api.bursaries.create(schoolId, data),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["bursaries", schoolId] });
      toast.success(`${vars.student} added to the bursary register`);
      setOpen(false);
      setForm({
        student: "",
        grade: "Form 1",
        sponsor: "Board bursary fund",
        coverage: "50% tuition",
        amount: "",
        status: "Active",
        household: "",
        reason: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        sponsorshipAgreementRef: "",
        disbursementSchedule: "Per term",
        performanceConditions: "",
      });
    },
    onError: () => toast.error("Failed to create award"),
  });
  const updateApplicationMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      api.bursaries.updateApplication(schoolId, id, { status }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["bursary-applications", schoolId] });
      toast.success(`Application moved to ${vars.status}`);
    },
    onError: () => toast.error("Failed to update application"),
  });
  const updateRenewalMutation = useMutation({
    mutationFn: (id: string) => api.bursaries.updateRenewal(schoolId, id, { status: "Approved" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bursary-renewals", schoolId] });
      toast.success("Renewal approved");
    },
    onError: () => toast.error("Failed to approve renewal"),
  });

  const awards = awardsRaw as any[];
  const applications: Application[] = (applicationsRaw as any[]).map((item) => ({
    id: item.id,
    student: item.student ?? "-",
    household: item.household ?? "-",
    requested: Number(item.requested ?? 0),
    reason: item.reason ?? "-",
    status: (item.status ?? "Submitted") as ApplicationStatus,
  }));
  const renewals: Renewal[] = (renewalsRaw as any[]).map((item) => ({
    id: item.id,
    student: item.student ?? "-",
    sponsor: item.sponsor ?? "-",
    reviewDate: item.reviewDate ?? "-",
    attendance: item.attendance ?? "-",
    academics: item.academics ?? "-",
    status: (item.status ?? "Due") as RenewalStatus,
  }));

  const createAward = () => {
    const amount = Number(form.amount);
    if (!form.student.trim() || !Number.isFinite(amount) || amount <= 0) { toast.error("Student and a valid annual amount are required"); return; }
    createAwardMutation.mutate({
      student: form.student.trim(),
      grade: form.grade,
      sponsor: form.sponsor,
      coverage: form.coverage,
      amount,
      status: form.status,
      household: form.household.trim() || null,
      applicationReason: form.reason.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      sponsorshipAgreementRef: form.sponsorshipAgreementRef.trim() || null,
      disbursementSchedule: form.disbursementSchedule,
      performanceConditions: form.performanceConditions.trim() || null,
    });
  };

  const activeAwards = awards.filter((a: any) => a.status === "Active").length;
  const annualValue = awards.filter((a: any) => a.status !== "Closed").reduce((sum: number, a: any) => sum + (Number(a.amount) || 0), 0);
  const reviewQueue = applications.filter((a) => a.status === "Review" || a.status === "Submitted").length;
  const renewalsDue = renewals.filter((r) => r.status !== "Approved").length;

  return (
    <AccessGuard module="bursaries">
      <div className="space-y-6">
      <PageHeader
        title="Bursaries & Scholarships"
        description="Manage financial aid awards, application reviews, renewals, and sponsor-backed scholarship coverage."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/fee-structure">Fee rules</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Create award</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Create bursary award</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Student *</Label>
                      <Input className="mt-1" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} placeholder="Ruth Zulu" />
                    </div>
                    <div>
                      <Label>Grade</Label>
                      <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Sponsor</Label>
                      <Select value={form.sponsor} onValueChange={(v) => setForm({ ...form, sponsor: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Board bursary fund", "Old scholars scholarship", "STEM girls grant", "Community donor fund"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Coverage</Label>
                      <Select value={form.coverage} onValueChange={(v) => setForm({ ...form, coverage: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["25% tuition", "50% tuition", "75% tuition", "100% tuition", "50% tuition + exam fee"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Annual value (K) *</Label>
                      <Input className="mt-1" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="9600" />
                    </div>
                    <div>
                      <Label>Award status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Active", "Pending renewal", "Closed"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Award start date</Label>
                      <Input type="date" className="mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                    </div>
                    <div>
                      <Label>Award end date</Label>
                      <Input type="date" className="mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Sponsorship agreement ref.</Label>
                      <Input className="mt-1" value={form.sponsorshipAgreementRef} onChange={(e) => setForm({ ...form, sponsorshipAgreementRef: e.target.value })} placeholder="e.g. SA-2026-041" maxLength={60} />
                    </div>
                    <div>
                      <Label>Disbursement schedule</Label>
                      <Select value={form.disbursementSchedule} onValueChange={(v) => setForm({ ...form, disbursementSchedule: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Per term", "Monthly", "Annually", "On invoice"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Household context</Label>
                    <Input className="mt-1" value={form.household} onChange={(e) => setForm({ ...form, household: e.target.value })} placeholder="Single guardian household, sibling support case, OVC referral, low-income bracket" maxLength={160} />
                  </div>
                  <div>
                    <Label>Performance conditions</Label>
                    <Input className="mt-1" value={form.performanceConditions} onChange={(e) => setForm({ ...form, performanceConditions: e.target.value })} placeholder="e.g. Min 60% overall average, attendance >= 90%, no disciplinary action" maxLength={200} />
                  </div>
                  <div>
                    <Label>Award rationale / committee note</Label>
                    <Textarea className="mt-1" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for support, academic promise, social-welfare recommendation, donor conditions, or review notes" maxLength={500} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={createAward} disabled={createAwardMutation.isPending}>Create award</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active awards" value={activeAwards} accent="primary" icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Annual value" value={`K ${annualValue.toLocaleString()}`} accent="success" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Review queue" value={reviewQueue} accent="warning" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Renewals due" value={renewalsDue} accent="accent" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="awards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="awards">Awards</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="renewals">Renewals</TabsTrigger>
        </TabsList>

        <TabsContent value="awards" className="rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Annual value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {awardsLoading ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading awards...</TableCell></TableRow>
              ) : awards.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No bursary awards found in the database.</TableCell></TableRow>
              ) : awards.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.student}</div>
                    <div className="text-xs text-muted-foreground">{a.grade}</div>
                    {(a.household || a.applicationReason) && (
                      <div className="mt-1 text-xs text-muted-foreground">{a.household || a.applicationReason}</div>
                    )}
                  </TableCell>
                  <TableCell>{a.sponsor}</TableCell>
                  <TableCell><Badge variant="outline">{a.coverage}</Badge></TableCell>
                  <TableCell>K {Number(a.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "Active" ? "secondary" : a.status === "Pending renewal" ? "warning" : "outline"}>{a.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="applications" className="rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Household context</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicationsLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading applications...</TableCell></TableRow>
              ) : applications.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No bursary applications found in the database.</TableCell></TableRow>
              ) : applications.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.student}</TableCell>
                  <TableCell>K {a.requested.toLocaleString()}</TableCell>
                  <TableCell>{a.household}</TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">{a.reason}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "Approved" ? "secondary" : a.status === "Declined" ? "destructive" : a.status === "Review" ? "warning" : "outline"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === "Approved" || a.status === "Declined" ? (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateApplicationMutation.mutate({ id: a.id, status: "Review" })}>Review</Button>
                        <Button size="sm" onClick={() => updateApplicationMutation.mutate({ id: a.id, status: "Approved" })}>Approve</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="renewals" className="grid gap-4 lg:grid-cols-2">
          {renewalsLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground lg:col-span-2">Loading renewals...</div>
          ) : renewals.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground lg:col-span-2">No renewal reviews found in the database.</div>
          ) : renewals.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{r.student}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.sponsor} · review {r.reviewDate}</p>
                </div>
                <Badge variant={r.status === "Approved" ? "secondary" : r.status === "Ready" ? "success" : "warning"}>{r.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Attendance</p>
                  <p className="mt-1 text-sm font-medium">{r.attendance}</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Academics</p>
                  <p className="mt-1 text-sm font-medium">{r.academics}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" variant="outline" asChild><Link to="/student-welfare">Support review</Link></Button>
                <Button className="flex-1" onClick={() => updateRenewalMutation.mutate(r.id)} disabled={r.status === "Approved"}>Approve renewal</Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
