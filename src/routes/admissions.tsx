import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2, CheckCircle2, XCircle, Eye, Search } from "lucide-react";

import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { AccessGuard } from "@/components/access-guard";
import {
  Button, Chip, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle,
  DialogContentText, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab,
} from "@mui/material";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/admissions")({
  head: () => ({ meta: [{ title: "Admissions - SRMS" }] }),
  component: AdmissionsPage,
});

const STATUSES = ["PENDING", "REVIEWING", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

function statusChip(status: string) {
  if (status === "ACCEPTED") return <Chip size="small" icon={<CheckCircle2 size={12} />} label="Accepted" sx={badgeSx("success")} />;
  if (status === "REJECTED") return <Chip size="small" icon={<XCircle size={12} />} label="Rejected" sx={badgeSx("destructive")} />;
  if (status === "WITHDRAWN") return <Chip size="small" label="Withdrawn" sx={badgeSx("outline")} />;
  if (status === "REVIEWING") return <Chip size="small" label="Reviewing" sx={badgeSx("secondary")} />;
  return <Chip size="small" label="Pending" sx={badgeSx("outline")} />;
}

function emptyForm() {
  return {
    firstName: "", middleName: "", lastName: "", preferredName: "",
    dateOfBirth: "", gender: "Female", nationality: "Zambian", birthCertificateNo: "",
    applyingForGrade: "1", previousSchool: "", lastCompletedGrade: "",
    address: "", city: "",
    guardianName: "", guardianRelationship: "Mother", guardianPhone: "", guardianAltPhone: "",
    guardianEmail: "", guardianOccupation: "", guardianWorkplace: "", guardianNationalId: "",
    guardianAddress: "",
    emergencyContactName: "", emergencyContactRelationship: "", emergencyContactPhone: "",
    source: "Walk-in", priority: "Normal", medicalNotes: "", notes: "",
  };
}

function AdmissionsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const isSecondary = ["SECONDARY", "COMBINED", "FULL"].includes(active.type);
  const isPrimary = ["PRIMARY", "COMBINED", "FULL", "NURSERY"].includes(active.type);
  const gradeOptions: { value: string; label: string }[] =
    isSecondary && !isPrimary
      ? [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Form ${n}` }))
      : isPrimary && !isSecondary
      ? [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Grade ${n}` }))
      : [
          ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Grade ${n}` })),
          ...[7, 8, 9, 10, 11, 12].map((n) => ({ value: String(n), label: `Form ${n - 6}` })),
        ];
  const gradeLabel = (g: number) => gradeOptions.find((o) => o.value === String(g))?.label ?? `Grade ${g}`;

  const [tab, setTab] = useState<"ALL" | (typeof STATUSES)[number]>("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [viewing, setViewing] = useState<any | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<any | null>(null);
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admissions", schoolId],
    queryFn: () => api.admissions.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.admissions.create(schoolId, data),
    onSuccess: (app: any) => {
      qc.invalidateQueries({ queryKey: ["admissions", schoolId] });
      toast.success(`Application ${app.applicationNumber ?? ""} submitted`);
      setForm(emptyForm());
      setOpen(false);
    },
    onError: () => toast.error("Failed to submit application"),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.admissions.accept(schoolId, id),
    onSuccess: (app: any) => {
      qc.invalidateQueries({ queryKey: ["admissions", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
      toast.success(`${app.firstName} ${app.lastName} accepted — enrolled as ${app.enrolledAdmissionNumber ?? "a new student"}`);
      setAcceptTarget(null);
      setViewing(null);
    },
    onError: () => { toast.error("Failed to accept application"); setAcceptTarget(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.admissions.reject(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions", schoolId] });
      toast.success("Application rejected");
      setRejectTarget(null);
      setViewing(null);
    },
    onError: () => { toast.error("Failed to reject application"); setRejectTarget(null); },
  });

  const list = (applications as any[])
    .filter((a) => tab === "ALL" || a.status === tab)
    .filter((a) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return [a.firstName, a.lastName, a.applicationNumber, a.guardianName, a.guardianPhone]
        .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(needle));
    });

  const counts = {
    total: (applications as any[]).length,
    pending: (applications as any[]).filter((a) => a.status === "PENDING" || a.status === "REVIEWING").length,
    accepted: (applications as any[]).filter((a) => a.status === "ACCEPTED").length,
    rejected: (applications as any[]).filter((a) => a.status === "REJECTED" || a.status === "WITHDRAWN").length,
  };

  const submit = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.guardianName.trim() || !form.guardianPhone.trim()) {
      toast.error("Learner name, guardian name, and guardian phone are required");
      return;
    }
    createMutation.mutate({ ...form, applyingForGrade: Number(form.applyingForGrade) });
  };

  return (
    <AccessGuard module="admissions">
      <div className="space-y-6">
        <PageHeader
          title="Admissions"
          description="Applicant intake — review, accept, or reject prospective learners before they're enrolled."
          actions={
            <Button variant="contained" startIcon={<UserPlus size={16} />} onClick={() => setOpen(true)}>
              New application
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total applications" value={counts.total} icon={<UserPlus className="h-4 w-4" />} accent="primary" />
          <StatCard label="Awaiting decision" value={counts.pending} icon={<Loader2 className="h-4 w-4" />} accent="accent" />
          <StatCard label="Accepted" value={counts.accepted} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
          <StatCard label="Rejected / withdrawn" value={counts.rejected} icon={<XCircle className="h-4 w-4" />} accent="destructive" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab value="ALL" label="All" />
            {STATUSES.map((s) => <Tab key={s} value={s} label={s.charAt(0) + s.slice(1).toLowerCase()} />)}
          </Tabs>
          <TextField
            size="small"
            placeholder="Search name, application #, guardian…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            slotProps={{ input: { startAdornment: <Search size={14} className="mr-2 text-muted-foreground" /> } }}
            fullWidth
            sx={{ minWidth: { xs: 0, sm: 260 }, width: { xs: "100%", sm: "auto" } }}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading applications…</span>
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No applications"
              description={tab === "ALL" ? "Click “New application” to record a prospective learner." : "No applications with this status."}
            />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Application #</TableCell>
                    <TableCell>Applicant</TableCell>
                    <TableCell>Applying for</TableCell>
                    <TableCell>Guardian</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((a) => (
                    <TableRow key={a.id} hover>
                      <TableCell className="font-mono text-xs">{a.applicationNumber}</TableCell>
                      <TableCell className="font-medium">{a.firstName} {a.lastName}</TableCell>
                      <TableCell>{gradeLabel(a.applyingForGrade)}</TableCell>
                      <TableCell>
                        <div>{a.guardianName}</div>
                        <div className="text-xs text-muted-foreground">{a.guardianPhone}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.submittedDate}</TableCell>
                      <TableCell>{statusChip(a.status)}</TableCell>
                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="small" variant="text" color="inherit" startIcon={<Eye size={12} />} onClick={() => setViewing(a)}>View</Button>
                          {(a.status === "PENDING" || a.status === "REVIEWING") && (
                            <>
                              <Button size="small" variant="outlined" color="success" onClick={() => setAcceptTarget(a)}>Accept</Button>
                              <Button size="small" variant="outlined" color="error" onClick={() => setRejectTarget(a)}>Reject</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>

        {/* New application */}
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>New admission application</DialogTitle>
          <DialogContent>
            <div className="grid gap-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Learner</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <TextField label="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} size="small" fullWidth />
                  <TextField label="Middle name" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} size="small" fullWidth />
                  <TextField label="Last name *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} size="small" fullWidth />
                  <TextField label="Preferred name" value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} size="small" fullWidth />
                  <TextField type="date" label="Date of birth" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} size="small" fullWidth />
                  <TextField select label="Gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} size="small" fullWidth>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Male">Male</MenuItem>
                  </TextField>
                  <TextField label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} size="small" fullWidth />
                  <TextField label="Birth certificate no." value={form.birthCertificateNo} onChange={(e) => setForm({ ...form, birthCertificateNo: e.target.value })} size="small" fullWidth />
                  <TextField select label="Applying for" value={form.applyingForGrade} onChange={(e) => setForm({ ...form, applyingForGrade: e.target.value })} size="small" fullWidth>
                    {gradeOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                  <TextField label="Previous school" value={form.previousSchool} onChange={(e) => setForm({ ...form, previousSchool: e.target.value })} size="small" fullWidth />
                  <TextField label="Last completed grade" value={form.lastCompletedGrade} onChange={(e) => setForm({ ...form, lastCompletedGrade: e.target.value })} size="small" fullWidth />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Address</p>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} size="small" fullWidth />
                  <TextField label="City / town" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} size="small" fullWidth />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Guardian</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <TextField label="Full name *" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} size="small" fullWidth />
                  <TextField select label="Relationship" value={form.guardianRelationship} onChange={(e) => setForm({ ...form, guardianRelationship: e.target.value })} size="small" fullWidth>
                    {["Mother", "Father", "Guardian", "Grandparent", "Other"].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField label="Phone *" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} placeholder="+260 9XX XXX XXX" size="small" fullWidth />
                  <TextField label="Alternate phone" value={form.guardianAltPhone} onChange={(e) => setForm({ ...form, guardianAltPhone: e.target.value })} size="small" fullWidth />
                  <TextField label="Email" type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} size="small" fullWidth />
                  <TextField label="National ID" value={form.guardianNationalId} onChange={(e) => setForm({ ...form, guardianNationalId: e.target.value })} size="small" fullWidth />
                  <TextField label="Occupation" value={form.guardianOccupation} onChange={(e) => setForm({ ...form, guardianOccupation: e.target.value })} size="small" fullWidth />
                  <TextField label="Workplace" value={form.guardianWorkplace} onChange={(e) => setForm({ ...form, guardianWorkplace: e.target.value })} size="small" fullWidth />
                  <TextField label="Guardian address" value={form.guardianAddress} onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })} size="small" fullWidth />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Emergency contact</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <TextField label="Name" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} size="small" fullWidth />
                  <TextField label="Relationship" value={form.emergencyContactRelationship} onChange={(e) => setForm({ ...form, emergencyContactRelationship: e.target.value })} size="small" fullWidth />
                  <TextField label="Phone" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} size="small" fullWidth />
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Application details</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <TextField select label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} size="small" fullWidth>
                    {["Walk-in", "Referral", "Website", "Advertisement", "Sibling", "Other"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                  <TextField select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} size="small" fullWidth>
                    {["Normal", "High", "Urgent"].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </TextField>
                </div>
                <TextField label="Medical notes" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} multiline minRows={2} fullWidth size="small" sx={{ mt: 2 }} />
                <TextField label="Internal notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} multiline minRows={2} fullWidth size="small" sx={{ mt: 2 }} />
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" disabled={createMutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={createMutation.isPending} startIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined} onClick={submit}>
              Submit application
            </Button>
          </DialogActions>
        </Dialog>

        {/* View application */}
        <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="sm" fullWidth>
          {viewing && (
            <>
              <DialogTitle>
                {viewing.firstName} {viewing.lastName}
                <span className="ml-2 align-middle">{statusChip(viewing.status)}</span>
              </DialogTitle>
              <DialogContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Application #</dt><dd className="font-mono">{viewing.applicationNumber}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Applying for</dt><dd>{gradeLabel(viewing.applyingForGrade)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Date of birth</dt><dd>{viewing.dateOfBirth || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Gender</dt><dd>{viewing.gender || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Previous school</dt><dd>{viewing.previousSchool || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd>{viewing.submittedDate || "—"}</dd></div>
                  <div className="col-span-2 border-t border-border pt-3"><dt className="text-xs text-muted-foreground">Guardian</dt><dd>{viewing.guardianName} ({viewing.guardianRelationship}) · {viewing.guardianPhone}</dd></div>
                  {viewing.guardianEmail && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Guardian email</dt><dd>{viewing.guardianEmail}</dd></div>}
                  {viewing.medicalNotes && <div className="col-span-2 border-t border-border pt-3"><dt className="text-xs text-muted-foreground">Medical notes</dt><dd>{viewing.medicalNotes}</dd></div>}
                  {viewing.notes && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Internal notes</dt><dd>{viewing.notes}</dd></div>}
                  {viewing.status === "ACCEPTED" && (
                    <div className="col-span-2 border-t border-border pt-3"><dt className="text-xs text-muted-foreground">Enrolled as</dt><dd className="font-medium text-success">{viewing.enrolledAdmissionNumber} · {viewing.enrolledDate}</dd></div>
                  )}
                </dl>
              </DialogContent>
              <DialogActions>
                {(viewing.status === "PENDING" || viewing.status === "REVIEWING") && (
                  <>
                    <Button color="error" variant="outlined" onClick={() => setRejectTarget(viewing)}>Reject</Button>
                    <Button color="success" variant="contained" onClick={() => setAcceptTarget(viewing)}>Accept</Button>
                  </>
                )}
                <Button color="inherit" onClick={() => setViewing(null)}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Accept confirmation */}
        <Dialog open={!!acceptTarget} onClose={() => (acceptMutation.isPending ? null : setAcceptTarget(null))} maxWidth="xs" fullWidth>
          <DialogTitle>Accept this application?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This enrolls <strong>{acceptTarget?.firstName} {acceptTarget?.lastName}</strong> as an active student in {acceptTarget ? gradeLabel(acceptTarget.applyingForGrade) : ""}, using the guardian and contact details on this application. This creates a real student record.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" disabled={acceptMutation.isPending} onClick={() => setAcceptTarget(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              disabled={acceptMutation.isPending}
              startIcon={acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 size={16} />}
              onClick={() => acceptTarget && acceptMutation.mutate(acceptTarget.id)}
            >
              Accept &amp; enrol
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject confirmation */}
        <Dialog open={!!rejectTarget} onClose={() => (rejectMutation.isPending ? null : setRejectTarget(null))} maxWidth="xs" fullWidth>
          <DialogTitle>Reject this application?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              <strong>{rejectTarget?.firstName} {rejectTarget?.lastName}</strong>'s application will be marked rejected. This can be reviewed again later if needed.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" disabled={rejectMutation.isPending} onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={rejectMutation.isPending}
              startIcon={rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle size={16} />}
              onClick={() => rejectTarget && rejectMutation.mutate(rejectTarget.id)}
            >
              Reject
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </AccessGuard>
  );
}
