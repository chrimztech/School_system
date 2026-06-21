import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Mail, Phone, Loader2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/teachers")({
  head: () => ({ meta: [{ title: "Teachers — SRMS" }] }),
  component: TeachersPage,
});

const QUALIFICATIONS = ["BSc Ed. (UNZA)", "BA Ed. (CBU)", "BSc Ed.", "BA Ed.", "Diploma Ed.", "BSc Computing", "MA Ed.", "MEd."];
const GENDERS = ["Male", "Female"];

function TeachersPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
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
  const deptNames = (rawDepts as any[]).map((d: any) => d.name);

  const firstDept = deptNames[0] as string | undefined;
  useEffect(() => {
    if (firstDept) setForm((prev) => prev.department === "" ? { ...prev, department: firstDept } : prev);
  }, [firstDept]);

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
        }).then(() => void qc.invalidateQueries({ queryKey: ["school-users", schoolId] }))
          .catch(() => { /* login may already exist */ });
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teachers & Staff"
        description={`${active.totalTeachers || staffList.length} staff registered at ${active.shortCode}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Add teacher</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader><DialogTitle>Add new teacher</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name *</Label>
                  <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="John" maxLength={60} />
                </div>
                <div>
                  <Label>Last name *</Label>
                  <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Daka" maxLength={60} />
                </div>
                <div className="col-span-2">
                  <Label>Subjects (comma-separated)</Label>
                  <Input className="mt-1" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Mathematics, Physics" />
                </div>
                <div>
                  <Label>Department</Label>
                  <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {deptNames.length === 0
                        ? <SelectItem value="__none__" disabled>No departments — add on Departments page</SelectItem>
                        : deptNames.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Class coverage</Label>
                  <Input className="mt-1" value={form.classCoverage} onChange={(e) => setForm({ ...form, classCoverage: e.target.value })} placeholder="Grade 8-12" />
                </div>
                <div>
                  <Label>Qualification</Label>
                  <Select value={form.qualification} onValueChange={(v) => setForm({ ...form, qualification: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{GENDERS.map((gender) => <SelectItem key={gender} value={gender}>{gender}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="j.daka@school.zm" maxLength={100} />
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
                  <Label>Date joined</Label>
                  <Input type="date" className="mt-1" value={form.dateJoined} onChange={(e) => setForm({ ...form, dateJoined: e.target.value })} />
                </div>
                <div>
                  <Label>Base salary (K)</Label>
                  <Input type="number" min={0} className="mt-1" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">On duty</SelectItem>
                      <SelectItem value="leave">On leave</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Teaching licence / ECZ no.</Label>
                  <Input className="mt-1" value={form.professionalLicenseNo} onChange={(e) => setForm({ ...form, professionalLicenseNo: e.target.value })} placeholder="TRG/2020/00123" maxLength={40} />
                </div>
                <div>
                  <Label>Years of teaching experience</Label>
                  <Input type="number" min={0} className="mt-1" value={form.teachingExperienceYears} onChange={(e) => setForm({ ...form, teachingExperienceYears: e.target.value })} placeholder="5" />
                </div>
                <div>
                  <Label>Emergency contact name</Label>
                  <Input className="mt-1" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Jane Daka" maxLength={100} />
                </div>
                <div>
                  <Label>Emergency contact phone</Label>
                  <Input className="mt-1" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 966 000 000" maxLength={20} />
                </div>
                <div>
                  <Label>Bank name</Label>
                  <Input className="mt-1" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="ZANACO, Stanbic, FNB, Absa" maxLength={60} />
                </div>
                <div>
                  <Label>Bank account no.</Label>
                  <Input className="mt-1" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Account number" maxLength={40} />
                </div>
                <div className="col-span-2">
                  <Label>Residential address</Label>
                  <Input className="mt-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House no., street, area, city" maxLength={200} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addTeacher} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add teacher
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total staff" value={active.totalTeachers || staffList.length} accent="primary" />
        <StatCard label="On duty today" value={activeCount} accent="success" />
        <StatCard label="On leave" value={leaveCount} accent="warning" />
        <StatCard label="Inactive / left" value={staffList.filter((t) => (t.status ?? "").toLowerCase() === "terminated" || (t.status ?? "").toLowerCase() === "suspended").length} accent="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, staff no, subject" className="pl-9" />
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} of {staffList.length}</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading staff…</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link to="/teachers/$staffId" params={{ staffId: t.id }} className="font-medium hover:underline">{t.firstName} {t.lastName}</Link>
                    <div className="text-xs text-muted-foreground">{t.staffNumber} · {t.qualification}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(String(t.subject ?? "").split(",").map((item) => item.trim()).filter(Boolean)).map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
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
                    <Badge variant={(t.status ?? "").toLowerCase() === "active" ? "default" : "outline"}>
                      {(t.status ?? "").toLowerCase() === "on_leave" ? "On leave" : (t.status ?? "").toLowerCase() === "active" ? "On duty" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No staff found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
