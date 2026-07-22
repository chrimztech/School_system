import { createFileRoute, Link, useNavigate, Outlet, useChildMatches } from "@tanstack/react-router";
import { Plus, Search, Mail, Phone, Loader2, Trash2, ClipboardCheck, AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Chip, IconButton, InputAdornment, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { badgeSx, downloadCsv } from "@/lib/utils";
import { ImportDialog, type ImportResult } from "@/components/import-dialog";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/teachers")({
  head: () => ({ meta: [{ title: "Teachers — SRMS" }] }),
  component: TeachersPage,
});

const QUALIFICATIONS = ["BSc Ed. (UNZA)", "BA Ed. (CBU)", "BSc Ed.", "BA Ed.", "Diploma Ed.", "BSc Computing", "MA Ed.", "MEd."];
const GENDERS = ["Male", "Female"];

function TeachersListPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const isHOD = user?.role === "hod";
  const canWrite = !isHOD;
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState("staff");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    subjects: "",
    department: "",
    classCoverage: "",
    qualification: QUALIFICATIONS[0],
    gender: GENDERS[0],
    nationalId: "",
    dateJoined: new Date().toISOString().slice(0, 10),
    salary: "",
    email: "",
    phone: "",
    status: "active",
    emergencyContactName: "",
    emergencyContactPhone: "",
    professionalLicenseNo: "",
    teachingExperienceYears: "",
    bankName: "",
    bankAccount: "",
    address: "",
  });

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
  });

  const { data: rawDepts = [] } = useQuery({
    queryKey: ["departments", schoolId],
    queryFn: () => api.departments.list(schoolId),
  });

  const { data: allAssessments = [] } = useQuery({
    queryKey: ["assessments", schoolId],
    queryFn: () => api.assessments.list(schoolId),
    enabled: isHOD,
  });

  const { data: allSlots = [] } = useQuery({
    queryKey: ["timetable", schoolId],
    queryFn: () => api.timetable.list(schoolId),
    enabled: isHOD,
  });
  const deptNames = (rawDepts as any[]).map((d: any) => d.name);

  const firstDept = deptNames[0] as string | undefined;
  useEffect(() => {
    if (firstDept) setForm((prev) => prev.department === "" ? { ...prev, department: firstDept } : prev);
  }, [firstDept]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.teachers.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast.success("Staff record removed");
    },
    onError: () => toast.error("Failed to remove staff record"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.teachers.create(schoolId, data),
    onSuccess: (t: any) => {
      void qc.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast.success(`${t.firstName} ${t.lastName} added (${t.staffNumber})`);
      if (t.email) {
        void api.users.create(schoolId, {
          name: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
          email: t.email,
          role: "teacher",
        }).then(() => {
          void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
          toast.info(`Teacher login created — email: ${t.email} · password: password123`);
        }).catch(() => { /* login already exists */ });
      }
      setForm({
        firstName: "",
        lastName: "",
        subjects: "",
        department: deptNames[0] ?? "",
        classCoverage: "",
        qualification: QUALIFICATIONS[0],
        gender: GENDERS[0],
        nationalId: "",
        dateJoined: new Date().toISOString().slice(0, 10),
        salary: "",
        email: "",
        phone: "",
        status: "active",
        emergencyContactName: "",
        emergencyContactPhone: "",
        professionalLicenseNo: "",
        teachingExperienceYears: "",
        bankName: "",
        bankAccount: "",
        address: "",
      });
      setOpen(false);
    },
    onError: () => toast.error("Failed to add teacher"),
  });

  const addTeacher = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error("First name, last name, and email are required");
      return;
    }
    createMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      subject: form.subjects.trim(),
      email: form.email,
      phone: form.phone,
      qualification: form.qualification,
      department: form.classCoverage.trim() ? `${form.department} · ${form.classCoverage.trim()}` : form.department,
      status: form.status === "leave" ? "on_leave" : form.status,
      dateJoined: form.dateJoined,
      salary: Number(form.salary) || 0,
      gender: form.gender,
      nationalId: form.nationalId.trim(),
      emergencyContactName: form.emergencyContactName.trim() || null,
      emergencyContactPhone: form.emergencyContactPhone.trim() || null,
      professionalLicenseNo: form.professionalLicenseNo.trim() || null,
      teachingExperienceYears: Number(form.teachingExperienceYears) || null,
      bankName: form.bankName.trim() || null,
      bankAccount: form.bankAccount.trim() || null,
      address: form.address.trim() || null,
    });
  };

  const staffList = teachers as any[];

  const filtered = useMemo(
    () => staffList.filter((t) => {
      const name = `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim();
      return `${name} ${t.staffNumber ?? ""} ${t.subject ?? ""}`.toLowerCase().includes(q.toLowerCase());
    }),
    [q, staffList],
  );

  const activeCount = staffList.filter((t) => (t.status ?? "").toLowerCase() === "active").length;
  const leaveCount = staffList.filter((t) => (t.status ?? "").toLowerCase() === "on_leave").length;

  const assessmentsByTeacher = useMemo(() => {
    const map: Record<string, number> = {};
    (allAssessments as any[]).forEach((a: any) => {
      if (a.teacherId) map[a.teacherId] = (map[a.teacherId] ?? 0) + 1;
    });
    return map;
  }, [allAssessments]);

  const slotsByTeacher = useMemo(() => {
    const map: Record<string, number> = {};
    (allSlots as any[]).forEach((s: any) => {
      if (s.teacherId) map[s.teacherId] = (map[s.teacherId] ?? 0) + 1;
    });
    return map;
  }, [allSlots]);

  return (
    <AccessGuard module="teachers">
      <div className="space-y-6">
      <PageHeader
        title="Teachers & Staff"
        description={`${active.totalTeachers || staffList.length} staff registered at ${active.shortCode}`}
        actions={
          <>
            <Button variant="outlined" startIcon={<Download size={16} />} onClick={() => {
              if (staffList.length === 0) { toast.error("No staff to export"); return; }
              downloadCsv(staffList.map((t: any) => ({
                "Staff No": t.staffNumber ?? "",
                "First Name": t.firstName ?? "",
                "Last Name": t.lastName ?? "",
                Email: t.email ?? "",
                Phone: t.phone ?? "",
                Subjects: t.subject ?? "",
                Department: t.department ?? "",
                Qualification: t.qualification ?? "",
                Gender: t.gender ?? "",
                "Date Joined": t.dateJoined ?? "",
                "National ID": t.nationalId ?? "",
                Salary: t.salary ?? "",
                "Bank Name": t.bankName ?? "",
                "Bank Account": t.bankAccount ?? "",
                Address: t.address ?? "",
                "Professional License No": t.professionalLicenseNo ?? "",
                "Teaching Experience (Years)": t.teachingExperienceYears ?? "",
                "Emergency Contact Name": t.emergencyContactName ?? "",
                "Emergency Contact Phone": t.emergencyContactPhone ?? "",
                Status: t.status ?? "active",
              })), `staff-${new Date().toISOString().slice(0, 10)}`);
            }}>
              Export
            </Button>
            {canWrite && (
              <Button variant="outlined" startIcon={<Upload size={16} />} onClick={() => setImportOpen(true)}>
                Import
              </Button>
            )}
            {canWrite && <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Add teacher</Button>}
            {canWrite && <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
            <DialogTitle>Add new teacher</DialogTitle>
            <DialogContent>
              <div className="overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <TextField label="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth size="small" />
                <TextField label="Last name *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Daka" slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth size="small" />
                <div className="col-span-2">
                  <TextField label="Subjects (comma-separated)" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Mathematics, Physics" fullWidth size="small" />
                </div>
                <TextField
                  select
                  label="Department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {deptNames.length === 0
                    ? <MenuItem value="__none__" disabled>No departments — add on Departments page</MenuItem>
                    : deptNames.map((d: string) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                <TextField label="Class coverage" value={form.classCoverage} onChange={(e) => setForm({ ...form, classCoverage: e.target.value })} placeholder="Form 1-6" fullWidth size="small" />
                <TextField
                  select
                  label="Qualification"
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {QUALIFICATIONS.map((q) => <MenuItem key={q} value={q}>{q}</MenuItem>)}
                </TextField>
                <TextField
                  select
                  label="Gender"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {GENDERS.map((gender) => <MenuItem key={gender} value={gender}>{gender}</MenuItem>)}
                </TextField>
                <TextField type="email" label="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="j.daka@school.zm" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
                <TextField label="National ID / NRC" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" slotProps={{ htmlInput: { maxLength: 30 } }} fullWidth size="small" />
                <TextField
                  type="date"
                  label="Date joined"
                  value={form.dateJoined}
                  onChange={(e) => setForm({ ...form, dateJoined: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField type="number" label="Base salary (K)" slotProps={{ htmlInput: { min: 0 } }} value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="0" fullWidth size="small" />
                <TextField
                  select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="active">On duty</MenuItem>
                  <MenuItem value="leave">On leave</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="terminated">Terminated</MenuItem>
                </TextField>
                <TextField label="Teaching licence / ECZ no." value={form.professionalLicenseNo} onChange={(e) => setForm({ ...form, professionalLicenseNo: e.target.value })} placeholder="TRG/2020/00123" slotProps={{ htmlInput: { maxLength: 40 } }} fullWidth size="small" />
                <TextField type="number" label="Years of teaching experience" slotProps={{ htmlInput: { min: 0 } }} value={form.teachingExperienceYears} onChange={(e) => setForm({ ...form, teachingExperienceYears: e.target.value })} placeholder="5" fullWidth size="small" />
                <TextField label="Emergency contact name" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Jane Daka" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                <TextField label="Emergency contact phone" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 966 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
                <TextField label="Bank name" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="ZANACO, Stanbic, FNB, Absa" slotProps={{ htmlInput: { maxLength: 60 } }} fullWidth size="small" />
                <TextField label="Bank account no." value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Account number" slotProps={{ htmlInput: { maxLength: 40 } }} fullWidth size="small" />
                <div className="col-span-2">
                  <TextField label="Residential address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House no., street, area, city" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                </div>
              </div>
              </div>
            </DialogContent>
            <DialogActions className="mt-2">
              <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={addTeacher}
                disabled={createMutation.isPending}
                startIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                Add teacher
              </Button>
            </DialogActions>
          </Dialog>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total staff" value={active.totalTeachers || staffList.length} accent="primary" />
        <StatCard label="On duty today" value={activeCount} accent="success" />
        <StatCard label="On leave" value={leaveCount} accent="warning" />
        <StatCard label="Inactive / left" value={staffList.filter((t) => (t.status ?? "").toLowerCase() === "terminated" || (t.status ?? "").toLowerCase() === "suspended").length} accent="destructive" />
      </div>

      {isHOD && (
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="staff" label="Staff Directory" />
          <Tab value="audit" icon={<ClipboardCheck size={14} />} iconPosition="start" label="Record Audit" />
        </Tabs>
      )}

      {tab === "staff" && (
        <div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <div className="max-w-sm flex-1">
                <TextField
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name, staff no, subject"
                  fullWidth
                  size="small"
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{filtered.length} of {staffList.length}</p>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading staff…</span>
              </div>
            ) : (
              <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Staff</TableCell>
                    <TableCell>Subjects</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Status</TableCell>
                    {canWrite && <TableCell className="text-right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((t: any) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => void navigate({ to: "/teachers/$staffId", params: { staffId: t.id } })}
                    >
                      <TableCell>
                        <span className="font-medium">{t.firstName} {t.lastName}</span>
                        <div className="text-xs text-muted-foreground">{t.staffNumber} · {t.qualification}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(String(t.subject ?? "").split(",").map((item) => item.trim()).filter(Boolean)).map((s: string) => <Chip key={s} size="small" label={s} sx={badgeSx("secondary")} />)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.department}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{t.email}</span>
                          <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{t.phone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={(t.status ?? "").toLowerCase() === "on_leave" ? "On leave" : (t.status ?? "").toLowerCase() === "active" ? "On duty" : "Inactive"}
                          sx={badgeSx((t.status ?? "").toLowerCase() === "active" ? "default" : "outline")}
                        />
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            aria-label={`Remove ${t.firstName} ${t.lastName}`}
                            size="small"
                            color="error"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Remove ${t.firstName} ${t.lastName} from staff records? This cannot be undone.`))
                                deleteMutation.mutate(t.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">No staff found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </TableContainer>
            )}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium">Record-keeping audit</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verifies each teacher has timetable slots assigned and assessments on record.</p>
            </div>
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Subjects</TableCell>
                  <TableCell className="text-center">Timetable slots</TableCell>
                  <TableCell className="text-center">Assessments</TableCell>
                  <TableCell className="text-center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffList.filter((t: any) => (t.status ?? "").toLowerCase() === "active").map((t: any) => {
                  const slots = slotsByTeacher[t.id] ?? 0;
                  const assessments = assessmentsByTeacher[t.id] ?? 0;
                  const ok = slots > 0 && assessments > 0;
                  const partial = slots > 0 || assessments > 0;
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => void navigate({ to: "/teachers/$staffId", params: { staffId: t.id } })}
                    >
                      <TableCell>
                        <span className="font-medium">{t.firstName} {t.lastName}</span>
                        <div className="text-xs text-muted-foreground">{t.staffNumber}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.department}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(String(t.subject ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)).map((s: string) => <Chip key={s} size="small" label={s} sx={{ ...badgeSx("outline"), fontSize: 10 }} />)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={slots === 0 ? "text-destructive font-semibold" : "text-foreground"}>{slots}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={assessments === 0 ? "text-destructive font-semibold" : "text-foreground"}>{assessments}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />On track</span>
                        ) : partial ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertCircle className="h-3.5 w-3.5" />Incomplete</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />No records</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {staffList.filter((t: any) => (t.status ?? "").toLowerCase() === "active").length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No active staff found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          </div>
        </div>
      )}

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
          { key: "subjects", label: "Subjects", example: "Mathematics, Physics" },
          { key: "department", label: "Department", example: "Science" },
          { key: "qualification", label: "Qualification", example: "BSc Ed. (UNZA)" },
          { key: "gender", label: "Gender", example: "Male" },
          { key: "dateJoined", label: "Date Joined", example: "2022-01-10" },
          { key: "salary", label: "Salary", example: "8500" },
          { key: "nationalId", label: "National ID", example: "123456/78/1" },
          { key: "teachingExperienceYears", label: "Teaching Experience (Years)", example: "5" },
          { key: "professionalLicenseNo", label: "Professional License No", example: "ECZ-2022-001" },
          { key: "bankName", label: "Bank Name", example: "ZANACO" },
          { key: "bankAccount", label: "Bank Account", example: "4000012345" },
          { key: "address", label: "Address", example: "15 Chilenje, Lusaka" },
          { key: "emergencyContactName", label: "Emergency Contact Name", example: "Mary Daka" },
          { key: "emergencyContactPhone", label: "Emergency Contact Phone", example: "+260 977 000001" },
        ]}
        onDone={() => void qc.invalidateQueries({ queryKey: ["teachers", schoolId] })}
        onImport={async (rows) => {
          const result: ImportResult = { imported: 0, errors: [] };
          const valid: { row: number; dto: any }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row["First Name"]?.trim() || !row["Last Name"]?.trim() || !row["Email"]?.trim()) {
              result.errors.push({ row: i + 2, error: "First Name, Last Name and Email are required" });
              continue;
            }
            const dept = row["Department"]?.trim() ?? deptNames[0] ?? "";
            valid.push({
              row: i + 2,
              dto: {
                firstName: row["First Name"].trim(),
                lastName: row["Last Name"].trim(),
                email: row["Email"].trim(),
                phone: row["Phone"]?.trim() || null,
                subject: row["Subjects"]?.trim() || null,
                department: dept,
                qualification: row["Qualification"]?.trim() || QUALIFICATIONS[0],
                gender: row["Gender"]?.trim() || "Male",
                dateJoined: row["Date Joined"]?.trim() || new Date().toISOString().slice(0, 10),
                salary: Number(row["Salary"]) || 0,
                nationalId: row["National ID"]?.trim() || null,
                teachingExperienceYears: Number(row["Teaching Experience (Years)"]) || null,
                professionalLicenseNo: row["Professional License No"]?.trim() || null,
                bankName: row["Bank Name"]?.trim() || null,
                bankAccount: row["Bank Account"]?.trim() || null,
                address: row["Address"]?.trim() || null,
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
              // Auto-create logins for every row that actually landed
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

function TeachersPage() {
  const children = useChildMatches();
  if (children.length > 0) return <Outlet />;
  return <TeachersListPage />;
}
