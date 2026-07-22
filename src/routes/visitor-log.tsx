import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { UserCheck, Clock, LogOut, Search, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Chip, TextField, MenuItem, InputAdornment, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx, downloadCsv } from "@/lib/utils";

export const Route = createFileRoute("/visitor-log")({
  head: () => ({ meta: [{ title: "Visitor Log - SRMS" }] }),
  component: VisitorLogPage,
});

const PURPOSES = ["Meeting", "Delivery", "Parent", "Contractor", "Official", "Other"] as const;
const HOSTS = ["Reception", "Head Teacher", "Deputy Head", "Finance Office", "HR Office", "Other"];
const HOST_TYPES = ["ADMIN", "TEACHER", "STUDENT"] as const;

function createInitialForm() {
  return {
    name: "",
    phone: "",
    organisation: "",
    nationalId: "",
    purpose: "Meeting" as typeof PURPOSES[number],
    host: HOSTS[0],
    hostType: HOST_TYPES[0] as typeof HOST_TYPES[number],
    badgeNumber: "",
    vehicle: "",
    idChecked: "yes" as "yes" | "no",
    itemsBrought: "",
    appointmentRef: "",
    visitDate: new Date().toISOString().slice(0, 10),
    visitTime: new Date().toTimeString().slice(0, 5),
    expectedCheckOutTime: "",
  };
}

function VisitorLogPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState("today");
  const [signInOpen, setSignInOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(createInitialForm);

  const { data: visitors = [], isLoading } = useQuery({
    queryKey: ["visitors", schoolId],
    queryFn: () => api.visitors.list(schoolId),
  });

  const checkInMutation = useMutation({
    mutationFn: (data: any) => api.visitors.checkIn(schoolId, data),
    onSuccess: (visitor: any) => {
      qc.invalidateQueries({ queryKey: ["visitors", schoolId] });
      toast.success(`${visitor.visitorName ?? visitor.name ?? form.name} signed in — badge ${visitor.badgeNumber ?? form.badgeNumber ?? ""}`);
      setForm(createInitialForm());
      setSignInOpen(false);
    },
    onError: () => toast.error("Failed to sign in visitor"),
  });

  const checkOutMutation = useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => api.visitors.checkOut(schoolId, id),
    onSuccess: (_, { name }) => {
      qc.invalidateQueries({ queryKey: ["visitors", schoolId] });
      toast.success(`${name} signed out`);
    },
    onError: () => toast.error("Failed to sign out visitor"),
  });

  const signIn = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    checkInMutation.mutate({
      visitorName: form.name.trim(),
      visitorPhone: form.phone.trim(),
      organisation: form.organisation.trim() || null,
      nationalId: form.nationalId.trim() || null,
      purposeOfVisit: form.purpose,
      hostName: form.host,
      hostType: form.hostType,
      badgeNumber: form.badgeNumber.trim() || null,
      vehicleReg: form.vehicle.trim() || null,
      idChecked: form.idChecked === "yes",
      itemsBrought: form.itemsBrought.trim() || null,
      appointmentRef: form.appointmentRef.trim() || null,
      visitDate: form.visitDate,
      visitTime: form.visitTime || null,
      expectedCheckOutTime: form.expectedCheckOutTime || null,
    });
  };

  const visitorList = (visitors as any[]).map((visitor: any) => ({
    ...visitor,
    name: visitor.name ?? visitor.visitorName ?? "",
    purpose: visitor.purpose ?? visitor.purposeOfVisit ?? "",
    host: visitor.host ?? visitor.hostName ?? "",
  }));
  const today = new Date().toISOString().slice(0, 10);

  const todayVisitors = visitorList.filter((visitor: any) => {
    const date = (visitor.checkInTime ?? visitor.signInTime ?? visitor.date ?? "").slice(0, 10);
    return date === today || visitor.date === new Date().toLocaleDateString("en-GB");
  });
  const signedIn = visitorList.filter((visitor: any) => (visitor.status ?? "").toLowerCase().replace(" ", "_") === "checked_in" || visitor.status === "Signed in");

  const filtered = useMemo(() => {
    const lowerQuery = q.toLowerCase();
    return visitorList.filter((visitor: any) =>
      !lowerQuery || visitor.name.toLowerCase().includes(lowerQuery) || visitor.purpose.toLowerCase().includes(lowerQuery) || visitor.host.toLowerCase().includes(lowerQuery),
    );
  }, [visitorList, q]);

  return (
    <AccessGuard module="visitor-log">
      <div className="space-y-6">
      <PageHeader
        title="Visitor Log"
        description="Gate visitor sign-in and sign-out register for campus security."
        actions={
          <>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setSignInOpen(true)}>Sign in visitor</Button>
            <Dialog open={signInOpen} onClose={() => setSignInOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Sign in visitor</DialogTitle>
              <DialogContent>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Visitor name *" fullWidth size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Charles Mwanza" slotProps={{ htmlInput: { maxLength: 100 } }} />
                <TextField label="Phone *" fullWidth size="small" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} />
                <TextField label="Organisation / company" fullWidth size="small" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} placeholder="e.g. Ministry of Education" slotProps={{ htmlInput: { maxLength: 100 } }} />
                <TextField label="National ID / NRC" fullWidth size="small" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" slotProps={{ htmlInput: { maxLength: 30 } }} />
                <TextField select label="Purpose" fullWidth size="small" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as typeof PURPOSES[number] })}>
                  {PURPOSES.map((purpose) => <MenuItem key={purpose} value={purpose}>{purpose}</MenuItem>)}
                </TextField>
                <TextField select label="Host / destination" fullWidth size="small" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })}>
                  {HOSTS.map((host) => <MenuItem key={host} value={host}>{host}</MenuItem>)}
                </TextField>
                <TextField select label="Host type" fullWidth size="small" value={form.hostType} onChange={(e) => setForm({ ...form, hostType: e.target.value as typeof HOST_TYPES[number] })}>
                  <MenuItem value="ADMIN">Admin</MenuItem>
                  <MenuItem value="TEACHER">Teacher</MenuItem>
                  <MenuItem value="STUDENT">Student</MenuItem>
                </TextField>
                <TextField label="Badge number" fullWidth size="small" value={form.badgeNumber} onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })} placeholder="VIS-014" slotProps={{ htmlInput: { maxLength: 20 } }} />
                <TextField type="date" label="Visit date" fullWidth size="small" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="time" label="Check-in time" fullWidth size="small" value={form.visitTime} onChange={(e) => setForm({ ...form, visitTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="time" label="Expected checkout time" fullWidth size="small" value={form.expectedCheckOutTime} onChange={(e) => setForm({ ...form, expectedCheckOutTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField label="Vehicle reg." fullWidth size="small" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="ABB 1234" slotProps={{ htmlInput: { maxLength: 20 } }} />
                <TextField select label="ID checked" fullWidth size="small" value={form.idChecked} onChange={(e) => setForm({ ...form, idChecked: e.target.value as "yes" | "no" })}>
                  <MenuItem value="yes">Yes — ID verified</MenuItem>
                  <MenuItem value="no">No — not available</MenuItem>
                </TextField>
                <TextField label="Appointment reference" fullWidth size="small" value={form.appointmentRef} onChange={(e) => setForm({ ...form, appointmentRef: e.target.value })} placeholder="APT-2026-041" slotProps={{ htmlInput: { maxLength: 50 } }} />
                <TextField label="Items brought onto campus" fullWidth size="small" className="col-span-2" value={form.itemsBrought} onChange={(e) => setForm({ ...form, itemsBrought: e.target.value })} placeholder="e.g. Laptop bag, toolbox" slotProps={{ htmlInput: { maxLength: 200 } }} />
              </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setSignInOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={signIn} disabled={checkInMutation.isPending}>
                  {checkInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visitors today" value={todayVisitors.length} accent="primary" icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Currently on campus" value={signedIn.length} hint="Awaiting sign-out" accent="warning" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Signed out today" value={todayVisitors.length - signedIn.length} accent="success" icon={<LogOut className="h-4 w-4" />} />
        <StatCard label="Total this week" value={visitorList.length} accent="accent" icon={<UserCheck className="h-4 w-4" />} />
      </div>

      <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="today" label={`Today (${todayVisitors.length})`} />
          <Tab value="oncampus" label={`On campus (${signedIn.length})`} />
          <Tab value="history" label="History" />
        </Tabs>

        {tab === "today" && (
        <Box className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading visitors...</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Badge</TableCell><TableCell>Name</TableCell><TableCell>Purpose</TableCell>
                <TableCell>Host</TableCell><TableCell>Sign in</TableCell><TableCell>Sign out</TableCell>
                <TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {todayVisitors.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No visitors recorded today.</TableCell></TableRow>
                ) : todayVisitors.map((visitor: any) => {
                  const isSignedIn = (visitor.status ?? "").toLowerCase().replace(" ", "_") === "checked_in" || visitor.status === "Signed in";
                  return (
                    <TableRow key={visitor.id}>
                      <TableCell className="font-mono text-xs">{visitor.badgeNumber ?? visitor.badge ?? "—"}</TableCell>
                      <TableCell className="font-medium">{visitor.name}</TableCell>
                      <TableCell><Chip size="small" label={visitor.purpose} sx={badgeSx("outline")} /></TableCell>
                      <TableCell className="text-muted-foreground">{visitor.host}</TableCell>
                      <TableCell>{(visitor.checkInTime ?? visitor.signInTime ?? "").slice(11, 16)}</TableCell>
                      <TableCell>{visitor.checkOutTime ? (visitor.checkOutTime ?? "").slice(11, 16) : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">
                        {isSignedIn ? (
                          <Button variant="contained" size="small" startIcon={<LogOut size={14} />} onClick={() => checkOutMutation.mutate({ id: visitor.id, name: visitor.name })} disabled={checkOutMutation.isPending}>
                            Sign out
                          </Button>
                        ) : (
                          <Chip size="small" label="Left" sx={{ ...badgeSx("secondary"), color: "success.main" }} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
        )}

        {tab === "oncampus" && (
        <Box className="rounded-xl border border-border bg-card">
          {signedIn.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No visitors currently on campus.</p>
          ) : (
            <div className="divide-y divide-border">
              {signedIn.map((visitor: any) => (
                <div key={visitor.id} className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-sm font-bold text-warning-foreground">
                    {visitor.name.split(" ").map((part: string) => part[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{visitor.name}</p>
                    <p className="text-xs text-muted-foreground">{visitor.purpose} · Host: {visitor.host} · Badge: {visitor.badgeNumber ?? visitor.badge ?? "Pending"}</p>
                  </div>
                  <Button variant="contained" size="small" startIcon={<LogOut size={14} />} onClick={() => checkOutMutation.mutate({ id: visitor.id, name: visitor.name })}>
                    Sign out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Box>
        )}

        {tab === "history" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <TextField
              size="small"
              className="flex-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, purpose, or host"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
            />
            <Button variant="outlined" size="small" onClick={() => { downloadCsv(filtered.map((visitor: any) => ({ Date: (visitor.checkInTime ?? visitor.date ?? "").slice(0, 10), Name: visitor.name, Purpose: visitor.purpose, Host: visitor.host, Organisation: visitor.organisation ?? "", "Badge No": visitor.badgeNumber ?? visitor.badge ?? "", Status: visitor.status ?? "" })), "visitor-log"); toast.success("Visitor log exported"); }}>Export CSV</Button>
          </div>
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Date</TableCell><TableCell>Name</TableCell><TableCell>Purpose</TableCell>
              <TableCell>Host</TableCell><TableCell>Status</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.map((visitor: any) => {
                const isSignedIn = (visitor.status ?? "").toLowerCase().replace(" ", "_") === "checked_in";
                return (
                  <TableRow key={visitor.id}>
                    <TableCell className="text-muted-foreground">{(visitor.checkInTime ?? visitor.date ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="font-medium">{visitor.name}</TableCell>
                    <TableCell><Chip size="small" label={visitor.purpose} sx={badgeSx("outline")} /></TableCell>
                    <TableCell className="text-muted-foreground">{visitor.host}</TableCell>
                    <TableCell>
                      <Chip size="small" label={isSignedIn ? "On campus" : "Signed out"} sx={badgeSx(isSignedIn ? "outline" : "secondary")} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No visitors match your search.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )}
      </Box>
    </div>
    </AccessGuard>
  );
}
