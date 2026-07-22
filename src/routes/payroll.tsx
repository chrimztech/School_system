import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, Users, Receipt, Plus, Download, Play, FileText, Calculator, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Box, Button, Chip, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx, downloadCsv } from "@/lib/utils";
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
            <Button variant="outlined" component={Link} to="/accounting" startIcon={<Calculator className="h-4 w-4" />}>Accounting</Button>
            <Button variant="outlined" onClick={downloadBankFile} startIcon={<Download className="h-4 w-4" />}>
              Bank file
            </Button>
            <Button variant="outlined" startIcon={<Plus className="h-4 w-4" />} onClick={() => setOpenHire(true)}>Add employee</Button>
            <Dialog open={openHire} onClose={() => setOpenHire(false)} maxWidth="md" fullWidth>
              <DialogTitle>Add employee to payroll</DialogTitle>
              <DialogContent>
                <form onSubmit={(e) => { e.preventDefault(); addStaff(e.currentTarget); }} className="grid grid-cols-2 gap-3">
                  <TextField name="name" label="Full name *" required placeholder="Mwansa Tembo" fullWidth size="small" />
                  <TextField name="nrc" label="NRC number" placeholder="000000/00/1" fullWidth size="small" />
                  <TextField name="tpin" label="ZRA TPIN" placeholder="10-digit TPIN" slotProps={{ htmlInput: { maxLength: 12 } }} fullWidth size="small" />
                  <TextField select name="gender" label="Gender" defaultValue="Male" fullWidth size="small">
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                  </TextField>
                  <TextField name="role" label="Role / position *" required placeholder="e.g. Mathematics Teacher" fullWidth size="small" />
                  <TextField
                    select
                    key={`dept-${deptNames[0] ?? "none"}`}
                    name="dept"
                    label="Department"
                    defaultValue={deptNames[0] ?? ""}
                    fullWidth
                    size="small"
                  >
                    {deptNames.length === 0
                      ? <MenuItem value="__none__" disabled>No departments — add on Departments page</MenuItem>
                      : deptNames.map((d: string) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </TextField>
                  <TextField select name="contractType" label="Contract type" defaultValue="Permanent" fullWidth size="small">
                    {["Permanent", "Fixed-term", "Casual", "Temporary", "Volunteer"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField
                    name="dateJoined"
                    type="date"
                    label="Date joined"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField name="basic" type="number" label="Basic salary (K) *" required placeholder="8500" fullWidth size="small" />
                  <TextField name="allow" type="number" label="Allowances (K)" defaultValue={0} placeholder="1200" fullWidth size="small" />
                  <TextField select name="paymentMethod" label="Payment method" defaultValue="Bank transfer" fullWidth size="small">
                    {["Bank transfer", "Mobile money (Airtel)", "Mobile money (MTN)", "Cash"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField select name="napsaEnrolled" label="NAPSA enrolled" defaultValue="yes" fullWidth size="small">
                    <MenuItem value="yes">Yes — enrolled</MenuItem>
                    <MenuItem value="no">No — exempt / pending</MenuItem>
                  </TextField>
                  <TextField name="bank" label="Bank name" placeholder="e.g. ZANACO, Stanbic, First National" fullWidth size="small" />
                  <TextField name="accountNumber" label="Account number" placeholder="e.g. ****0000" fullWidth size="small" />
                  <TextField name="emergencyContactName" label="Emergency contact name" placeholder="Next of kin" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  <TextField name="emergencyContactPhone" label="Emergency contact phone" placeholder="+260 9XX XXX XXX" slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
                  <div className="col-span-2">
                    <DialogActions sx={{ px: 0 }}>
                      <Button variant="outlined" color="inherit" type="button" onClick={() => setOpenHire(false)}>Cancel</Button>
                      <Button type="submit" disabled={addStaffMutation.isPending}>
                        {addStaffMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add employee
                      </Button>
                    </DialogActions>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Button startIcon={<Play className="h-4 w-4" />} onClick={() => setOpenRun(true)}>Run payroll</Button>
            <Dialog open={openRun} onClose={() => setOpenRun(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Run payroll</DialogTitle>
              <DialogContent>
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
              </DialogContent>
              <DialogActions>
                <Button onClick={runPayroll} disabled={createRunMutation.isPending}>
                  {createRunMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate payslips
                </Button>
              </DialogActions>
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

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="staff" label="Employees" />
        <Tab value="payslips" label="Payslip preview" />
        <Tab value="runs" label="Payroll runs" />
        <Tab value="statutory" label="Statutory" />
      </Tabs>

      {tab === "staff" && (
        <Box>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {staffLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading employees…</span>
              </div>
            ) : (
              <TableContainer>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Name</TableCell><TableCell>Role</TableCell><TableCell>Dept</TableCell>
                  <TableCell>NRC</TableCell><TableCell>Bank</TableCell>
                  <TableCell className="text-right">Basic</TableCell><TableCell className="text-right">Allow</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow></TableHead>
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
                        <TableCell><Chip size="small" label={s.status ?? "Active"} sx={badgeSx((s.status ?? "Active") === "Active" ? "secondary" : "outline")} /></TableCell>
                      </TableRow>
                    );
                  })}
                  {staff.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No employees on payroll.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </TableContainer>
            )}
          </div>
        </Box>
      )}

      {tab === "payslips" && (
        <Box>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Employee</TableCell>
                <TableCell className="text-right">Gross</TableCell><TableCell className="text-right">PAYE</TableCell>
                <TableCell className="text-right">NAPSA</TableCell><TableCell className="text-right">NHIMA</TableCell>
                <TableCell className="text-right">Net pay</TableCell><TableCell></TableCell>
              </TableRow></TableHead>
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
                          <Button size="small" variant="text" color="inherit" sx={{ height: 28, fontSize: "0.75rem" }} onClick={() => setPrintSlip({ employee: s, slip: p })} startIcon={<Printer className="h-3 w-3" />}>
                            Print
                          </Button>
                          <Button size="small" variant="text" color="inherit" sx={{ height: 28, fontSize: "0.75rem" }} disabled={sendPayslipMutation.isPending} onClick={() => sendPayslipMutation.mutate(s)} startIcon={<FileText className="h-3 w-3" />}>
                            Send
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
            </TableContainer>
          </div>
        </Box>
      )}

      {tab === "runs" && (
        <Box>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {runsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading payroll runs…</span>
              </div>
            ) : (
              <TableContainer>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Run</TableCell><TableCell>Period</TableCell><TableCell>Staff</TableCell>
                  <TableCell className="text-right">Gross</TableCell><TableCell className="text-right">Net</TableCell>
                  <TableCell className="text-right">Statutory</TableCell><TableCell>Status</TableCell><TableCell>Paid</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>{r.period}</TableCell>
                      <TableCell>{r.employees ?? r.employeeCount}</TableCell>
                      <TableCell className="text-right font-mono">{k(r.gross ?? r.grossAmount ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{k(r.net ?? r.netAmount ?? 0)}</TableCell>
                      <TableCell className="text-right font-mono">{k((r.paye ?? 0) + (r.napsa ?? 0) + (r.nhima ?? 0))}</TableCell>
                      <TableCell><Chip size="small" label={r.status} sx={badgeSx(r.status === "Posted" ? "secondary" : "outline")} /></TableCell>
                      <TableCell className="text-muted-foreground">{(r.paid ?? r.paidDate ?? "—").slice(0, 10)}</TableCell>
                    </TableRow>
                  ))}
                  {runs.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No payroll runs yet. Click "Run payroll" to create one.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </TableContainer>
            )}
          </div>
        </Box>
      )}

      {tab === "statutory" && (
        <Box className="grid gap-4 md:grid-cols-3">
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
                <Button size="small" variant="outlined" sx={{ flex: 1 }} onClick={() => downloadCsv([{
                  "Statutory Body": s.body,
                  "Return Type": s.name,
                  "Amount (K)": s.amount,
                  "Due Date": s.due,
                  "Period": new Date().toLocaleString("en", { month: "long", year: "numeric" }),
                  "Status": "Pending",
                }], `statutory-${s.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 7)}`)}>Schedule</Button>
                <Button size="small" sx={{ flex: 1 }} onClick={() => toast.info("Direct ZRA/NAPSA/NHIMA online filing is not supported. Please file via the respective authority's web portal.")}>File</Button>
              </div>
            </div>
          ))}
        </Box>
      )}

      <Dialog open={!!printSlip} onClose={() => setPrintSlip(null)} maxWidth="sm" fullWidth>
        <DialogContent>
          {printSlip && (
            <div className="print-area divide-y divide-border text-sm print:rounded-none print:border-0 print:shadow-none">
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
        </DialogContent>
        <DialogActions className="print:hidden">
          <Button variant="outlined" color="inherit" onClick={() => setPrintSlip(null)}>Close</Button>
          <Button onClick={() => window.print()} startIcon={<Printer className="h-4 w-4" />}>Print</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
