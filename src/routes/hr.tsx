import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Users, CalendarOff, Award, BriefcaseBusiness, Plus, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
            <Button variant="outline" asChild>
              <Link to="/staff-development">Staff development</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/duty-roster">Duty roster</Link>
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import staff</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add staff</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
                <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Full name *</Label>
                    <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mutale Mwale" maxLength={100} />
                  </div>
                  <div>
                    <Label>Role / position *</Label>
                    <Input className="mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Biology Teacher" maxLength={100} />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="m.mwale@school.zm" maxLength={100} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" maxLength={20} />
                  </div>
                  <div>
                    <Label>National ID / NRC</Label>
                    <Input className="mt-1" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" maxLength={30} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as "Male" | "Female" })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select value={form.dept} onValueChange={(v) => setForm({ ...form, dept: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {deptNames.length === 0
                          ? <SelectItem value="__none__" disabled>No departments — add on Departments page</SelectItem>
                          : deptNames.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Contract type</Label>
                    <Select value={form.contract} onValueChange={(v) => setForm({ ...form, contract: v as typeof CONTRACTS[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONTRACTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date joined</Label>
                    <Input type="date" className="mt-1" value={form.dateJoined} onChange={(e) => setForm({ ...form, dateJoined: e.target.value })} />
                  </div>
                  <div>
                    <Label>Contract end date</Label>
                    <Input type="date" className="mt-1" value={form.contractEndDate} onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Salary band (K / month)</Label>
                    <Input className="mt-1" value={form.salaryBand} onChange={(e) => setForm({ ...form, salaryBand: e.target.value })} placeholder="e.g. K 8,500 – K 12,000" maxLength={50} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "Active" | "On leave" })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="On leave">On leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Qualifications</Label>
                    <Input className="mt-1" value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} placeholder="e.g. BSc Ed. (UNZA), PGDip School Management" maxLength={200} />
                  </div>
                  <div>
                    <Label>Emergency contact name</Label>
                    <Input className="mt-1" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Next of kin full name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Emergency contact phone</Label>
                    <Input className="mt-1" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 966 000 000" maxLength={20} />
                  </div>
                  <div>
                    <Label>TPIN</Label>
                    <Input className="mt-1" value={form.tpin} onChange={(e) => setForm({ ...form, tpin: e.target.value })} placeholder="Tax Payer Identification No." maxLength={20} />
                  </div>
                  <div>
                    <Label>Payment method</Label>
                    <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                        <SelectItem value="Mobile money">Mobile money</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>NAPSA enrolled</Label>
                    <Select value={form.napsaEnrolled} onValueChange={(v) => setForm({ ...form, napsaEnrolled: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bank name</Label>
                    <Input className="mt-1" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Zanaco, FNB, Stanbic" maxLength={80} />
                  </div>
                  <div className="col-span-2">
                    <Label>Bank account number</Label>
                    <Input className="mt-1" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="Account number" maxLength={30} />
                  </div>
                </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addStaff} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add staff
                  </Button>
                </DialogFooter>
              </DialogContent>
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

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff directory</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="appraisal">Appraisals</TabsTrigger>
          <TabsTrigger value="jobs">Recruitment</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="rounded-xl border border-border bg-card">
          {staffLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading staff…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead>
                <TableHead>Joined</TableHead><TableHead>Contract</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
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
                      <TableCell><Badge variant="outline">{s.contractType}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={isActive ? "text-success" : "text-amber-600"}>{statusLabel}</Badge>
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
          )}
        </TabsContent>

        <TabsContent value="leave" className="rounded-xl border border-border bg-card">
          {leaveLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading leave records…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref</TableHead><TableHead>Staff</TableHead><TableHead>Type</TableHead>
                <TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
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
                      <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                      <TableCell className="space-x-2 text-right">
                        {isPending ? (
                          <>
                            <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(l.id)} disabled={rejectMutation.isPending}>Reject</Button>
                            <Button size="sm" onClick={() => approveMutation.mutate(l.id)} disabled={approveMutation.isPending}>Approve</Button>
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
          )}
        </TabsContent>

        <TabsContent value="appraisal" className="space-y-3">
          <EmptyState
            icon={Award}
            title="No appraisals recorded yet"
            description="Staff performance reviews and appraisal cycles will appear here."
          />
        </TabsContent>

        <TabsContent value="jobs" className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={BriefcaseBusiness}
            title="No open positions yet"
            description="Job postings and recruitment pipelines will appear here."
          />
        </TabsContent>
      </Tabs>

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
