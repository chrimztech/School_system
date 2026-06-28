import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, Users, Receipt, Plus, Download, Play, FileText, Calculator, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/utils";
import { SchoolDocumentHeader } from "@/components/school-document-header";

export const Route = createFileRoute("/payroll")({
  head: () => ({ meta: [{ title: "Payroll — SRMS" }] }),
  component: PayrollPage,
});

// Zambian PAYE brackets (2024+ monthly, ZMW)
const PAYE_BANDS = [
  { upTo: 5100,      rate: 0.0  },
  { upTo: 7100,      rate: 0.20 },
  { upTo: 9200,      rate: 0.30 },
  { upTo: Infinity,  rate: 0.37 },
];
const NAPSA_RATE = 0.05;
const NAPSA_CAP  = 1342.4;
const NHIMA_RATE = 0.01;

function calcPaye(gross: number) {
  let tax = 0, prev = 0;
  for (const b of PAYE_BANDS) {
    if (gross <= prev) break;
    const slice = Math.min(gross, b.upTo) - prev;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return Math.round(tax);
}

function payslip(basic: number, allowances = 0) {
  const gross = basic + allowances;
  const napsa = Math.min(gross * NAPSA_RATE, NAPSA_CAP);
  const nhima = gross * NHIMA_RATE;
  const taxable = gross - napsa;
  const paye = calcPaye(taxable);
  const net = gross - paye - napsa - nhima;
  return { gross, napsa: Math.round(napsa), nhima: Math.round(nhima), paye, net: Math.round(net) };
}

const k = (n: number) => `K ${n.toLocaleString()}`;

function PayrollPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState("staff");
  const [openHire, setOpenHire] = useState(false);
  const [openRun, setOpenRun] = useState(false);
  const [printSlip, setPrintSlip] = useState<any | null>(null);

  const { data: rawDepts = [] } = useQuery({
    queryKey: ["departments", schoolId],
    queryFn: () => api.departments.list(schoolId),
  });
  const deptNames = (rawDepts as any[]).map((d: any) => d.name);

  const { data: staffData = [], isLoading: staffLoading } = useQuery({
    queryKey: ["hr-staff", schoolId],
    queryFn: () => api.hr.staff(schoolId),
  });

  const { data: runsData = [], isLoading: runsLoading } = useQuery({
    queryKey: ["payroll-runs", schoolId],
    queryFn: () => api.payroll.runs(schoolId),
  });

  const createRunMutation = useMutation({
    mutationFn: (data: any) => api.payroll.createRun(schoolId, data),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs", schoolId] });
      toast.success(`Payroll run ${r.id ?? ""} created — review and post to GL`);
      setOpenRun(false);
      setTab("runs");
    },
    onError: () => toast.error("Failed to create payroll run"),
  });

  const addStaffMutation = useMutation({
    mutationFn: (data: any) => api.hr.createStaff(schoolId, data),
    onSuccess: (s: any) => {
      qc.invalidateQueries({ queryKey: ["hr-staff", schoolId] });
      toast.success(`${s.name ?? ""} added to payroll`);
      setOpenHire(false);
    },
    onError: () => toast.error("Failed to add employee"),
  });

  const staff = staffData as any[];
  const runs = runsData as any[];

  const activeStaff = staff.filter((s: any) => (s.status ?? "Active").toLowerCase() !== "on leave" && (s.status ?? "Active").toLowerCase() !== "inactive");

  const monthly = useMemo(() => {
    const slips = activeStaff.map((s: any) => {
      const basic = s.basic ?? s.basicSalary ?? s.salary ?? 0;
      const allow = s.allow ?? s.allowances ?? 0;
      return payslip(basic, allow);
    });
    return slips.reduce((acc, s) => ({
      gross: acc.gross + s.gross, net: acc.net + s.net,
      paye: acc.paye + s.paye, napsa: acc.napsa + s.napsa, nhima: acc.nhima + s.nhima,
    }), { gross: 0, net: 0, paye: 0, napsa: 0, nhima: 0 });
  }, [activeStaff]);

  const sendPayslipMutation = useMutation({
    mutationFn: (employee: any) => api.communication.createAnnouncement(schoolId, {
      title: `Payslip for ${new Date().toLocaleString("en", { month: "long", year: "numeric" })}`,
      body: `Dear ${employee.name}, please find your payslip details: Gross K${(employee.basic ?? employee.basicSalary ?? 0) + (employee.allow ?? employee.allowances ?? 0)}, Net K${payslip(employee.basic ?? employee.basicSalary ?? employee.salary ?? 0, employee.allow ?? employee.allowances ?? 0).net}. For queries contact the HR office.`,
      audience: employee.email ?? employee.name,
      channels: "SMS",
      publishDate: new Date().toISOString().slice(0, 10),
      active: true,
    }),
    onSuccess: (_: any, employee: any) => toast.success(`Payslip sent to ${employee.name}`),
    onError: () => toast.error("Failed to send payslip"),
  });

  const downloadBankFile = () => {
    if (activeStaff.length === 0) { toast.error("No active employees"); return; }
    downloadCsv(activeStaff.map((s: any) => {
      const p = payslip(s.basic ?? s.basicSalary ?? s.salary ?? 0, s.allow ?? s.allowances ?? 0);
      return {
        Name: s.name ?? "",
        Bank: s.bank ?? s.bankAccount ?? "",
        "Account Number": s.accountNumber ?? "",
        "Payment Method": s.paymentMethod ?? "Bank transfer",
        "Net Pay (K)": p.net,
        "TPIN": s.tpin ?? "",
        "NRC": s.nrc ?? "",
      };
    }), `bank-file-${new Date().toISOString().slice(0, 10)}`);
    toast.success("Bank file downloaded");
  };

  const runPayroll = () => {
    const period = new Date().toLocaleString("en", { month: "long", year: "numeric" });
    createRunMutation.mutate({
      period,
      employees: activeStaff.length,
      gross: monthly.gross,
      net: monthly.net,
      paye: monthly.paye,
      napsa: monthly.napsa,
      nhima: monthly.nhima,
      status: "Draft",
    });
  };

  const addStaff = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    addStaffMutation.mutate({
      name: String(fd.get("name") || ""),
      role: String(fd.get("role") || ""),
      department: String(fd.get("dept") || ""),
      basicSalary: Number(fd.get("basic") || 0),
      allowances: Number(fd.get("allow") || 0),
      bank: String(fd.get("bank") || ""),
      nrc: String(fd.get("nrc") || ""),
      tpin: String(fd.get("tpin") || ""),
      gender: String(fd.get("gender") || "Male"),
      contractType: String(fd.get("contractType") || "Permanent"),
      dateJoined: String(fd.get("dateJoined") || ""),
      paymentMethod: String(fd.get("paymentMethod") || "Bank transfer"),
      accountNumber: String(fd.get("accountNumber") || ""),
      napsaEnrolled: String(fd.get("napsaEnrolled") || "yes") === "yes",
      emergencyContactName: String(fd.get("emergencyContactName") || ""),
      emergencyContactPhone: String(fd.get("emergencyContactPhone") || ""),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="ZRA PAYE · NAPSA · NHIMA · automated payslips & bank file export"
        actions={
          <>
            <Button variant="outline" asChild><Link to="/accounting"><Calculator className="mr-2 h-4 w-4" />Accounting</Link></Button>
            <Button variant="outline" onClick={downloadBankFile}>
              <Download className="mr-2 h-4 w-4" />Bank file
            </Button>
            <Dialog open={openHire} onOpenChange={setOpenHire}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Add employee</Button></DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add employee to payroll</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addStaff(e.currentTarget); }} className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Full name *</Label>
                    <Input name="name" required className="mt-1" placeholder="Mwansa Tembo" />
                  </div>
                  <div>
                    <Label>NRC number</Label>
                    <Input name="nrc" placeholder="000000/00/1" className="mt-1" />
                  </div>
                  <div>
                    <Label>ZRA TPIN</Label>
                    <Input name="tpin" placeholder="10-digit TPIN" className="mt-1" maxLength={12} />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select name="gender" defaultValue="Male">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Role / position *</Label>
                    <Input name="role" required className="mt-1" placeholder="e.g. Mathematics Teacher" />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select key={`dept-${deptNames[0] ?? "none"}`} name="dept" defaultValue={deptNames[0] ?? ""}>
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
                    <Select name="contractType" defaultValue="Permanent">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Permanent", "Fixed-term", "Casual", "Temporary", "Volunteer"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date joined</Label>
                    <Input name="dateJoined" type="date" className="mt-1" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div>
                    <Label>Basic salary (K) *</Label>
                    <Input name="basic" type="number" required className="mt-1" placeholder="8500" />
                  </div>
                  <div>
                    <Label>Allowances (K)</Label>
                    <Input name="allow" type="number" defaultValue={0} className="mt-1" placeholder="1200" />
                  </div>
                  <div>
                    <Label>Payment method</Label>
                    <Select name="paymentMethod" defaultValue="Bank transfer">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Bank transfer", "Mobile money (Airtel)", "Mobile money (MTN)", "Cash"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>NAPSA enrolled</Label>
                    <Select name="napsaEnrolled" defaultValue="yes">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — enrolled</SelectItem>
                        <SelectItem value="no">No — exempt / pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bank name</Label>
                    <Input name="bank" placeholder="e.g. ZANACO, Stanbic, First National" className="mt-1" />
                  </div>
                  <div>
                    <Label>Account number</Label>
                    <Input name="accountNumber" placeholder="e.g. ****0000" className="mt-1" />
                  </div>
                  <div>
                    <Label>Emergency contact name</Label>
                    <Input name="emergencyContactName" placeholder="Next of kin" className="mt-1" maxLength={100} />
                  </div>
                  <div>
                    <Label>Emergency contact phone</Label>
                    <Input name="emergencyContactPhone" placeholder="+260 9XX XXX XXX" className="mt-1" maxLength={20} />
                  </div>
                  <div className="col-span-2">
                    <DialogFooter>
                      <Button variant="outline" type="button" onClick={() => setOpenHire(false)}>Cancel</Button>
                      <Button type="submit" disabled={addStaffMutation.isPending}>
                        {addStaffMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add employee
                      </Button>
                    </DialogFooter>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={openRun} onOpenChange={setOpenRun}>
              <DialogTrigger asChild><Button><Play className="mr-2 h-4 w-4" />Run payroll</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Run payroll</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">
                  This will calculate payslips for {activeStaff.length} active employees
                  using current ZRA PAYE bands, NAPSA (5% capped at K{NAPSA_CAP.toLocaleString()}) and NHIMA (1%).
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-muted-foreground">Gross</dt><dd className="font-mono font-semibold">{k(monthly.gross)}</dd></div>
                  <div><dt className="text-muted-foreground">Net pay</dt><dd className="font-mono font-semibold">{k(monthly.net)}</dd></div>
                  <div><dt className="text-muted-foreground">PAYE</dt><dd className="font-mono">{k(monthly.paye)}</dd></div>
                  <div><dt className="text-muted-foreground">NAPSA</dt><dd className="font-mono">{k(monthly.napsa)}</dd></div>
                  <div><dt className="text-muted-foreground">NHIMA</dt><dd className="font-mono">{k(monthly.nhima)}</dd></div>
                </dl>
                <DialogFooter>
                  <Button onClick={runPayroll} disabled={createRunMutation.isPending}>
                    {createRunMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate payslips
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Active employees" value={activeStaff.length} icon={<Users className="h-4 w-4" />} accent="primary" />
        <StatCard label="Monthly gross"    value={k(monthly.gross)} icon={<Banknote className="h-4 w-4" />} accent="success" />
        <StatCard label="Net to pay"       value={k(monthly.net)}   icon={<Banknote className="h-4 w-4" />} accent="accent" />
        <StatCard label="PAYE (ZRA)"       value={k(monthly.paye)}  icon={<Receipt className="h-4 w-4" />} accent="warning" />
        <StatCard label="NAPSA + NHIMA"    value={k(monthly.napsa + monthly.nhima)} icon={<Receipt className="h-4 w-4" />} accent="warning" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="staff">Employees</TabsTrigger>
          <TabsTrigger value="payslips">Payslip preview</TabsTrigger>
          <TabsTrigger value="runs">Payroll runs</TabsTrigger>
          <TabsTrigger value="statutory">Statutory</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {staffLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading employees…</span>
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Dept</TableHead>
                  <TableHead>NRC</TableHead><TableHead>Bank</TableHead>
                  <TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allow</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {staff.map((s: any) => {
                    const basic = s.basic ?? s.basicSalary ?? s.salary ?? 0;
                    const allow = s.allow ?? s.allowances ?? 0;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.role ?? s.position ?? s.jobTitle}</TableCell>
                        <TableCell>{s.dept ?? s.department}</TableCell>
                        <TableCell className="font-mono text-xs">{s.nrc ?? "—"}</TableCell>
                        <TableCell className="text-xs">{s.bank ?? s.bankAccount ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{k(basic)}</TableCell>
                        <TableCell className="text-right font-mono">{k(allow)}</TableCell>
                        <TableCell><Badge variant={(s.status ?? "Active") === "Active" ? "secondary" : "outline"}>{s.status ?? "Active"}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                  {staff.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No employees on payroll.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payslips">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">NAPSA</TableHead><TableHead className="text-right">NHIMA</TableHead>
                <TableHead className="text-right">Net pay</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {activeStaff.map((s: any) => {
                  const basic = s.basic ?? s.basicSalary ?? s.salary ?? 0;
                  const allow = s.allow ?? s.allowances ?? 0;
                  const p = payslip(basic, allow);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right font-mono">{k(p.gross)}</TableCell>
                      <TableCell className="text-right font-mono">{k(p.paye)}</TableCell>
                      <TableCell className="text-right font-mono">{k(p.napsa)}</TableCell>
                      <TableCell className="text-right font-mono">{k(p.nhima)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{k(p.net)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPrintSlip({ employee: s, slip: p })}>
                            <Printer className="mr-1 h-3 w-3" />Print
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={sendPayslipMutation.isPending} onClick={() => sendPayslipMutation.mutate(s)}>
                            <FileText className="mr-1 h-3 w-3" />Send
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activeStaff.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No active employees.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="runs">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {runsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading payroll runs…</span>
              </div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Run</TableHead><TableHead>Period</TableHead><TableHead>Staff</TableHead>
                  <TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Statutory</TableHead><TableHead>Status</TableHead><TableHead>Paid</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>{r.period}</TableCell>
                      <TableCell>{r.employees ?? r.employeeCount}</TableCell>
                      <TableCell className="text-right font-mono">{k(r.gross ?? r.grossAmount ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{k(r.net ?? r.netAmount ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{k((r.paye ?? 0) + (r.napsa ?? 0) + (r.nhima ?? 0))}</TableCell>
                      <TableCell><Badge variant={r.status === "Posted" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{(r.paid ?? r.paidDate ?? "—").slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No payroll runs yet. Click "Run payroll" to create one.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="statutory" className="grid gap-4 md:grid-cols-3">
          {[
            { name: "ZRA — PAYE return (P18)",    amount: monthly.paye,  body: "Zambia Revenue Authority", due: "10th of next month" },
            { name: "NAPSA contribution",          amount: monthly.napsa, body: "National Pension Scheme",  due: "10th of next month" },
            { name: "NHIMA contribution",          amount: monthly.nhima, body: "National Health Insurance", due: "10th of next month" },
          ].map((s) => (
            <div key={s.name} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.body}</p>
              <p className="mt-3 text-2xl font-semibold font-mono">{k(s.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Due {s.due}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => downloadCsv([{
                  "Statutory Body": s.body,
                  "Return Type": s.name,
                  "Amount (K)": s.amount,
                  "Due Date": s.due,
                  "Period": new Date().toLocaleString("en", { month: "long", year: "numeric" }),
                  "Status": "Pending",
                }], `statutory-${s.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 7)}`)}>Schedule</Button>
                <Button size="sm" className="flex-1" onClick={() => toast.info("Direct ZRA/NAPSA/NHIMA online filing is not supported. Please file via the respective authority's web portal.")}>File</Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!printSlip} onOpenChange={(o) => { if (!o) setPrintSlip(null); }}>
        <DialogContent className="sm:max-w-md">
          {printSlip && (
            <div className="divide-y divide-border text-sm">
              <SchoolDocumentHeader
                title="Employee Payslip"
                subtitle={new Date().toLocaleString("en", { month: "long", year: "numeric" })}
              />
              <div className="grid grid-cols-2 gap-3 p-6">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Employee</p>
                  <p className="mt-0.5 font-semibold">{printSlip.employee.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Role</p>
                  <p className="mt-0.5">{printSlip.employee.role ?? printSlip.employee.position ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Department</p>
                  <p className="mt-0.5">{printSlip.employee.dept ?? printSlip.employee.department ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">NRC</p>
                  <p className="mt-0.5 font-mono">{printSlip.employee.nrc ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Bank</p>
                  <p className="mt-0.5">{printSlip.employee.bank ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Account no.</p>
                  <p className="mt-0.5 font-mono">{printSlip.employee.accountNumber ?? "—"}</p>
                </div>
              </div>
              <div className="p-6 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Basic salary</span>
                  <span className="font-mono">{k(printSlip.employee.basic ?? printSlip.employee.basicSalary ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Allowances</span>
                  <span className="font-mono">{k(printSlip.employee.allow ?? printSlip.employee.allowances ?? 0)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-border pt-2">
                  <span>Gross pay</span>
                  <span className="font-mono">{k(printSlip.slip.gross)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>PAYE (ZRA)</span>
                  <span className="font-mono text-destructive">- {k(printSlip.slip.paye)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>NAPSA (5%)</span>
                  <span className="font-mono text-destructive">- {k(printSlip.slip.napsa)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>NHIMA (1%)</span>
                  <span className="font-mono text-destructive">- {k(printSlip.slip.nhima)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                  <span>Net pay</span>
                  <span className="font-mono text-emerald-600">{k(printSlip.slip.net)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6 pt-8">
                <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Employee signature</div>
                <div className="border-t border-border pt-2 text-center text-xs text-muted-foreground">Authorized signatory</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintSlip(null)}>Close</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
