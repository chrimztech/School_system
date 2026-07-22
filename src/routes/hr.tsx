import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Users, CalendarOff, Award, BriefcaseBusiness, Plus, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { Box, Button, Chip, MenuItem, Tab, Tabs, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { ImportDialog, type ImportResult } from "@/components/import-dialog";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR — SRMS" }] }),
  component: HRPage,
});

const CONTRACTS = ["Permanent", "Contract", "Probation"] as const;

function HRPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState("staff");
  const [form, setForm] = useState({
    name: "", role: "", dept: "", contract: "Permanent" as typeof CONTRACTS[number],
    status: "Active" as "Active" | "On leave", gender: "Male" as "Male" | "Female",
    email: "", phone: "", nationalId: "",
    dateJoined: new Date().toISOString().slice(0, 10), contractEndDate: "",
    salaryBand: "", qualifications: "", emergencyContactName: "", emergencyContactPhone: "",
    tpin: "", paymentMethod: "Bank transfer", napsaEnrolled: "yes", bankName: "", accountNumber: "",
  });

  const { data: rawDepts = [] } = useQuery({
    queryKey: ["departments", schoolId],
    queryFn: () => api.departments.list(schoolId),
  });
  const deptNames = (rawDepts as any[]).map((d: any) => d.name);

  const { data: rawTeachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });

  const { data: rawAppUsers = [], isLoading: appUsersLoading } = useQuery({
    queryKey: ["school-users", schoolId],
    queryFn: () => api.users.list(schoolId),
  });

  const staffLoading = teachersLoading || appUsersLoading;

  // Merge: all teachers + any app_users whose email isn't already in the teachers table
  const teacherEmails = new Set((rawTeachers as any[]).map((t: any) => t.email?.toLowerCase()));
  const staffData: any[] = [
    ...(rawTeachers as any[]).map((t: any) => ({
      id: t.id,
      name: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
      role: t.subject || t.qualification || "Teacher",
      department: t.department,
      joined: t.dateJoined,
      contractType: "—",
      status: t.status ?? "active",
      staffNumber: t.staffNumber,
      _source: "teacher",
    })),
    ...(rawAppUsers as any[])
      .filter((u: any) => !teacherEmails.has(u.email?.toLowerCase()))
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        role: u.role?.toLowerCase().replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        department: "—",
        joined: null,
        contractType: "—",
        status: u.active === false ? "inactive" : "active",
        staffNumber: null,
        _source: "user",
      })),
  ];

  const { data: leaveData = [], isLoading: leaveLoading } = useQuery({
    queryKey: ["hr-leave", schoolId],
    queryFn: () => api.hr.leave(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.teachers.create(schoolId, data),
    onSuccess: (s: any) => {
      qc.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast.success(`${s.firstName ?? ""} ${s.lastName ?? ""} added to HR register`);
      setForm({ name: "", role: "", dept: deptNames[0] ?? "", contract: "Permanent", status: "Active", gender: "Male", email: "", phone: "", nationalId: "", dateJoined: new Date().toISOString().slice(0, 10), contractEndDate: "", salaryBand: "", qualifications: "", emergencyContactName: "", emergencyContactPhone: "", tpin: "", paymentMethod: "Bank transfer", napsaEnrolled: "yes", bankName: "", accountNumber: "" });
      setOpen(false);
    },
    onError: () => toast.error("Failed to add staff member"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.hr.approveLeave(schoolId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leave", schoolId] }); toast.success("Leave approved"); },
    onError: () => toast.error("Failed to approve leave"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.hr.rejectLeave(schoolId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leave", schoolId] }); toast.error("Leave rejected"); },
    onError: () => toast.error("Failed to reject leave"),
  });

  const addStaff = () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Name and email are required"); return; }
    const nameParts = form.name.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "-";
    createMutation.mutate({
      firstName,
      lastName,
      subject: form.role.trim(),
      department: form.dept,
      status: form.status === "Active" ? "active" : "on_leave",
      gender: form.gender,
      email: form.email.trim(),
      phone: form.phone.trim(),
      nationalId: form.nationalId.trim(),
      dateJoined: form.dateJoined,
      qualification: form.qualifications.trim() || null,
      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      bankName: form.bankName.trim() || null,
      bankAccount: form.accountNumber.trim() || null,
      salary: 0,
    });
  };

  const staff = staffData;
  const leaves = leaveData as any[];
  const onLeaveCount = staff.filter((s) => {
    const st = (s.status ?? "").toLowerCase().replace(/[_ ]/g, "");
    return st === "onleave";
  }).length;

  return (
    <AccessGuard module="hr">
      <div className="space-y-6">
      <PageHeader
        title="Human Resources"
        description="Staff records, leave management, appraisals and recruitment."
        actions={
          <>
            <Button variant="outlined" component={Link} to="/staff-development">Staff development</Button>
            <Button variant="outlined" component={Link} to="/duty-roster">Duty roster</Button>
            <Button variant="outlined" onClick={() => setImportOpen(true)} startIcon={<Upload className="h-4 w-4" />}>Import staff</Button>
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add staff</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Add staff member</DialogTitle>
              <DialogContent>
                <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mutale Mwale" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField label="Role / position *" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Biology Teacher" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField type="email" label="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="m.mwale@school.zm" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
                  <TextField label="National ID / NRC" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" slotProps={{ htmlInput: { maxLength: 30 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Gender"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as "Male" | "Female" })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Department"
                    value={form.dept}
                    onChange={(e) => setForm({ ...form, dept: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {deptNames.length === 0
                      ? <MenuItem value="__none__" disabled>No departments — add on Departments page</MenuItem>
                      : deptNames.map((d: string) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label="Contract type"
                    value={form.contract}
                    onChange={(e) => setForm({ ...form, contract: e.target.value as typeof CONTRACTS[number] })}
                    fullWidth
                    size="small"
                  >
                    {CONTRACTS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField
                    type="date"
                    label="Date joined"
                    value={form.dateJoined}
                    onChange={(e) => setForm({ ...form, dateJoined: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    type="date"
                    label="Contract end date"
                    value={form.contractEndDate}
                    onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField label="Salary band (K / month)" value={form.salaryBand} onChange={(e) => setForm({ ...form, salaryBand: e.target.value })} placeholder="e.g. K 8,500 – K 12,000" slotProps={{ htmlInput: { maxLength: 50 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as "Active" | "On leave" })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="On leave">On leave</MenuItem>
                  </TextField>
                  <div className="col-span-2">
                    <TextField label="Qualifications" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} placeholder="e.g. BSc Ed. (UNZA), PGDip School Management" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                  </div>
                  <TextField label="Emergency contact name" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Next of kin full name" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField label="Emergency contact phone" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 966 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
                  <TextField label="TPIN" value={form.tpin} onChange={(e) => setForm({ ...form, tpin: e.target.value })} placeholder="Tax Payer Identification No." slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
                  <TextField
                    select
                    label="Payment method"
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="Bank transfer">Bank transfer</MenuItem>
                    <MenuItem value="Mobile money">Mobile money</MenuItem>
                    <MenuItem value="Cash">Cash</MenuItem>
                    <MenuItem value="Cheque">Cheque</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="NAPSA enrolled"
                    value={form.napsaEnrolled}
                    onChange={(e) => setForm({ ...form, napsaEnrolled: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="yes">Yes</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </TextField>
                  <TextField label="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Zanaco, FNB, Stanbic" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                  <div className="col-span-2">
                    <TextField label="Bank account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="Account number" slotProps={{ htmlInput: { maxLength: 30 } }} fullWidth size="small" />
                  </div>
                </div>
                </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addStaff} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add staff
                </Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total staff" value={staff.length} accent="primary" icon={<Users className="h-4 w-4" />} />
        <StatCard label="On leave today" value={onLeaveCount} accent="warning" icon={<CalendarOff className="h-4 w-4" />} />
        <StatCard label="Avg appraisal" value="—" accent="success" icon={<Award className="h-4 w-4" />} />
        <StatCard label="Open vacancies" value={0} accent="accent" icon={<BriefcaseBusiness className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="staff" label="Staff directory" />
        <Tab value="leave" label="Leave" />
        <Tab value="appraisal" label="Appraisals" />
        <Tab value="jobs" label="Recruitment" />
      </Tabs>

      {tab === "staff" && (
        <Box className="rounded-xl border border-border bg-card">
          {staffLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading staff…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Name</TableCell><TableCell>Role</TableCell><TableCell>Department</TableCell>
                <TableCell>Joined</TableCell><TableCell>Contract</TableCell><TableCell>Status</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {staff.map((s) => {
                  const rawStatus = (s.status ?? "active").toLowerCase().replace(/[_ ]/g, "");
                  const isActive = rawStatus === "active";
                  const statusLabel = rawStatus === "onleave" ? "On leave" : isActive ? "Active" : s.status;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.staffNumber && <div className="text-xs text-muted-foreground">{s.staffNumber}</div>}
                      </TableCell>
                      <TableCell>{s.role}</TableCell>
                      <TableCell>{s.department ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.joined ? String(s.joined).slice(0, 7) : "—"}</TableCell>
                      <TableCell><Chip size="small" label={s.contractType} sx={badgeSx("outline")} /></TableCell>
                      <TableCell>
                        <Chip size="small" label={statusLabel} sx={badgeSx(isActive ? "success" : "warning")} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {staff.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No staff on record.</TableCell></TableRow>
                )}
                {staff.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No staff on record.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {tab === "leave" && (
        <Box className="rounded-xl border border-border bg-card">
          {leaveLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading leave records…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Ref</TableCell><TableCell>Staff</TableCell><TableCell>Type</TableCell>
                <TableCell>From</TableCell><TableCell>To</TableCell><TableCell>Days</TableCell>
                <TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {leaves.map((l: any) => {
                  const isPending = (l.status ?? "").toLowerCase() === "pending";
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.id}</TableCell>
                      <TableCell className="font-medium">{l.staff ?? l.staffName ?? l.employeeName}</TableCell>
                      <TableCell>{l.type ?? l.leaveType}</TableCell>
                      <TableCell>{(l.from ?? l.startDate ?? "").slice(0, 10)}</TableCell>
                      <TableCell>{(l.to ?? l.endDate ?? "").slice(0, 10)}</TableCell>
                      <TableCell>{l.days ?? l.numberOfDays}</TableCell>
                      <TableCell><Chip size="small" label={l.status} sx={badgeSx("outline")} /></TableCell>
                      <TableCell className="space-x-2 text-right">
                        {isPending ? (
                          <>
                            <Button size="small" variant="outlined" onClick={() => rejectMutation.mutate(l.id)} disabled={rejectMutation.isPending}>Reject</Button>
                            <Button size="small" onClick={() => approveMutation.mutate(l.id)} disabled={approveMutation.isPending}>Approve</Button>
                          </>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {leaves.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No leave requests on record.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {tab === "appraisal" && (
        <Box sx={{ mt: 1.5 }}>
          <EmptyState
            icon={Award}
            title="No appraisals recorded yet"
            description="Staff performance reviews and appraisal cycles will appear here."
          />
        </Box>
      )}

      {tab === "jobs" && (
        <Box className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={BriefcaseBusiness}
            title="No open positions yet"
            description="Job postings and recruitment pipelines will appear here."
          />
        </Box>
      )}
      </Box>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import staff"
        entityName="staff record"
        columns={[
          { key: "firstName", label: "First Name", required: true, example: "John" },
          { key: "lastName", label: "Last Name", required: true, example: "Daka" },
          { key: "email", label: "Email", required: true, example: "john.daka@school.edu.zm" },
          { key: "phone", label: "Phone", example: "+260 966 000001" },
          { key: "role", label: "Role / Position", example: "Biology Teacher" },
          { key: "department", label: "Department", example: "Science" },
          { key: "qualification", label: "Qualification", example: "BSc Ed. (UNZA)" },
          { key: "gender", label: "Gender", example: "Male" },
          { key: "dateJoined", label: "Date Joined", example: "2022-01-10" },
          { key: "nationalId", label: "National ID", example: "123456/78/1" },
          { key: "bankName", label: "Bank Name", example: "ZANACO" },
          { key: "bankAccount", label: "Bank Account", example: "4000012345" },
          { key: "emergencyContactName", label: "Emergency Contact Name", example: "Mary Daka" },
          { key: "emergencyContactPhone", label: "Emergency Contact Phone", example: "+260 977 000001" },
        ]}
        onDone={() => { void qc.invalidateQueries({ queryKey: ["teachers", schoolId] }); void qc.invalidateQueries({ queryKey: ["school-users", schoolId] }); }}
        onImport={async (rows) => {
          const result: ImportResult = { imported: 0, errors: [] };
          const valid: { row: number; dto: any }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row["First Name"]?.trim() || !row["Last Name"]?.trim() || !row["Email"]?.trim()) {
              result.errors.push({ row: i + 2, error: "First Name, Last Name and Email are required" });
              continue;
            }
            valid.push({
              row: i + 2,
              dto: {
                firstName: row["First Name"].trim(),
                lastName: row["Last Name"].trim(),
                email: row["Email"].trim(),
                phone: row["Phone"]?.trim() || null,
                subject: row["Role / Position"]?.trim() || null,
                department: row["Department"]?.trim() || deptNames[0] || "",
                qualification: row["Qualification"]?.trim() || null,
                gender: row["Gender"]?.trim() || "Male",
                dateJoined: row["Date Joined"]?.trim() || new Date().toISOString().slice(0, 10),
                nationalId: row["National ID"]?.trim() || null,
                bankName: row["Bank Name"]?.trim() || null,
                bankAccount: row["Bank Account"]?.trim() || null,
                emergencyContactName: row["Emergency Contact Name"]?.trim() || null,
                emergencyContactPhone: row["Emergency Contact Phone"]?.trim() || null,
                status: "active",
              },
            });
          }
          if (valid.length > 0) {
            try {
              const bulk = await api.teachers.bulkCreate(schoolId, valid.map((v) => v.dto));
              result.imported += bulk.imported;
              const failedRows = new Set(bulk.errors.map((e) => e.row));
              bulk.errors.forEach((e) => result.errors.push({ row: valid[e.row]?.row ?? -1, error: e.error }));
              await Promise.all(
                valid
                  .filter((_, i) => !failedRows.has(i))
                  .map((v) =>
                    api.users.create(schoolId, {
                      name: `${v.dto.firstName ?? ""} ${v.dto.lastName ?? ""}`.trim(),
                      email: v.dto.email,
                      role: "teacher",
                    }).catch(() => { /* login may already exist */ })
                  )
              );
            } catch (e: any) {
              valid.forEach((v) => result.errors.push({ row: v.row, error: e?.response?.data?.message ?? e?.message ?? "Unknown error" }));
            }
          }
          result.errors.sort((a, b) => a.row - b.row);
          return result;
        }}
      />
    </div>
    </AccessGuard>
  );
}
