import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

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
  const [tab, setTab] = useState("awards");
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
  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["bursary-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: open,
  });
  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: s.className || s.grade,
  }));
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
            <Button component={Link} to="/fee-structure" variant="outlined">Fee rules</Button>
            <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Create award</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create bursary award</DialogTitle>
                <DialogContent>
                <div className="grid gap-3">
                  <div>
                    <p className="mb-1 text-sm font-medium">Find student</p>
                    <PersonCombobox
                      options={studentOptions}
                      loading={pickerStudentsLoading}
                      placeholder="Search enrolled students…"
                      emptyText="No students found."
                      onSelect={(option) => setForm((prev) => ({ ...prev, student: option.label }))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Student *" value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} placeholder="Ruth Zulu" fullWidth size="small" />
                    <TextField
                      select
                      label="Grade"
                      value={form.grade}
                      onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      select
                      label="Sponsor"
                      value={form.sponsor}
                      onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {["Board bursary fund", "Old scholars scholarship", "STEM girls grant", "Community donor fund"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Coverage"
                      value={form.coverage}
                      onChange={(e) => setForm({ ...form, coverage: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {["25% tuition", "50% tuition", "75% tuition", "100% tuition", "50% tuition + exam fee"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      type="number"
                      label="Annual value (K) *"
                      slotProps={{ htmlInput: { min: 1 } }}
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="9600"
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Award status"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {["Active", "Pending renewal", "Closed"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                    </TextField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      type="date"
                      label="Award start date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      type="date"
                      label="Award end date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Sponsorship agreement ref."
                      value={form.sponsorshipAgreementRef}
                      onChange={(e) => setForm({ ...form, sponsorshipAgreementRef: e.target.value })}
                      placeholder="e.g. SA-2026-041"
                      slotProps={{ htmlInput: { maxLength: 60 } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Disbursement schedule"
                      value={form.disbursementSchedule}
                      onChange={(e) => setForm({ ...form, disbursementSchedule: e.target.value })}
                      fullWidth
                      size="small"
                    >
                      {["Per term", "Monthly", "Annually", "On invoice"].map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </TextField>
                  </div>
                  <TextField
                    label="Household context"
                    value={form.household}
                    onChange={(e) => setForm({ ...form, household: e.target.value })}
                    placeholder="Single guardian household, sibling support case, OVC referral, low-income bracket"
                    slotProps={{ htmlInput: { maxLength: 160 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Performance conditions"
                    value={form.performanceConditions}
                    onChange={(e) => setForm({ ...form, performanceConditions: e.target.value })}
                    placeholder="e.g. Min 60% overall average, attendance >= 90%, no disciplinary action"
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Award rationale / committee note"
                    multiline
                    minRows={3}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Reason for support, academic promise, social-welfare recommendation, donor conditions, or review notes"
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    fullWidth
                    size="small"
                  />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={createAward} disabled={createAwardMutation.isPending}>Create award</Button>
                </DialogActions>
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

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="awards" label="Awards" />
        <Tab value="applications" label="Applications" />
        <Tab value="renewals" label="Renewals" />
      </Tabs>

      {tab === "awards" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Sponsor</TableCell>
                <TableCell>Coverage</TableCell>
                <TableCell>Annual value</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
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
                  <TableCell><Chip size="small" label={a.coverage} sx={badgeSx("outline")} /></TableCell>
                  <TableCell>K {Number(a.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip size="small" label={a.status} sx={badgeSx(a.status === "Active" ? "secondary" : a.status === "Pending renewal" ? "warning" : "outline")} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {tab === "applications" && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Household context</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Action</TableCell>
              </TableRow>
            </TableHead>
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
                    <Chip size="small" label={a.status} sx={badgeSx(a.status === "Approved" ? "secondary" : a.status === "Declined" ? "destructive" : a.status === "Review" ? "warning" : "outline")} />
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === "Approved" || a.status === "Declined" ? (
                      <span className="text-xs text-muted-foreground">Closed</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="small" variant="outlined" onClick={() => updateApplicationMutation.mutate({ id: a.id, status: "Review" })}>Review</Button>
                        <Button size="small" onClick={() => updateApplicationMutation.mutate({ id: a.id, status: "Approved" })}>Approve</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {tab === "renewals" && (
        <div className="grid gap-4 lg:grid-cols-2">
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
                <Chip size="small" label={r.status} sx={badgeSx(r.status === "Approved" ? "secondary" : r.status === "Ready" ? "success" : "warning")} />
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
                <Button sx={{ flex: 1 }} component={Link} to="/student-welfare" variant="outlined">Support review</Button>
                <Button sx={{ flex: 1 }} onClick={() => updateRenewalMutation.mutate(r.id)} disabled={r.status === "Approved"}>Approve renewal</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </AccessGuard>
  );
}
