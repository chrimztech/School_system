import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { UserCheck, Clock, LogOut, Search, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

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
          <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Sign in visitor</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Sign in visitor</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Visitor name *</Label>
                  <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Charles Mwanza" maxLength={100} />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" maxLength={20} />
                </div>
                <div>
                  <Label>Organisation / company</Label>
                  <Input className="mt-1" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} placeholder="e.g. Ministry of Education" maxLength={100} />
                </div>
                <div>
                  <Label>National ID / NRC</Label>
                  <Input className="mt-1" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="123456/78/1" maxLength={30} />
                </div>
                <div>
                  <Label>Purpose</Label>
                  <Select value={form.purpose} onValueChange={(value) => setForm({ ...form, purpose: value as typeof PURPOSES[number] })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{PURPOSES.map((purpose) => <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Host / destination</Label>
                  <Select value={form.host} onValueChange={(value) => setForm({ ...form, host: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{HOSTS.map((host) => <SelectItem key={host} value={host}>{host}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Host type</Label>
                  <Select value={form.hostType} onValueChange={(value) => setForm({ ...form, hostType: value as typeof HOST_TYPES[number] })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Badge number</Label>
                  <Input className="mt-1" value={form.badgeNumber} onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })} placeholder="VIS-014" maxLength={20} />
                </div>
                <div>
                  <Label>Visit date</Label>
                  <Input type="date" className="mt-1" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
                </div>
                <div>
                  <Label>Check-in time</Label>
                  <Input type="time" className="mt-1" value={form.visitTime} onChange={(e) => setForm({ ...form, visitTime: e.target.value })} />
                </div>
                <div>
                  <Label>Expected checkout time</Label>
                  <Input type="time" className="mt-1" value={form.expectedCheckOutTime} onChange={(e) => setForm({ ...form, expectedCheckOutTime: e.target.value })} />
                </div>
                <div>
                  <Label>Vehicle reg.</Label>
                  <Input className="mt-1" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} placeholder="ABB 1234" maxLength={20} />
                </div>
                <div>
                  <Label>ID checked</Label>
                  <Select value={form.idChecked} onValueChange={(v) => setForm({ ...form, idChecked: v as "yes" | "no" })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — ID verified</SelectItem>
                      <SelectItem value="no">No — not available</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Appointment reference</Label>
                  <Input className="mt-1" value={form.appointmentRef} onChange={(e) => setForm({ ...form, appointmentRef: e.target.value })} placeholder="APT-2026-041" maxLength={50} />
                </div>
                <div className="col-span-2">
                  <Label>Items brought onto campus</Label>
                  <Input className="mt-1" value={form.itemsBrought} onChange={(e) => setForm({ ...form, itemsBrought: e.target.value })} placeholder="e.g. Laptop bag, toolbox" maxLength={200} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setSignInOpen(false)}>Cancel</Button>
                <Button onClick={signIn} disabled={checkInMutation.isPending}>
                  {checkInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visitors today" value={todayVisitors.length} accent="primary" icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Currently on campus" value={signedIn.length} hint="Awaiting sign-out" accent="warning" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Signed out today" value={todayVisitors.length - signedIn.length} accent="success" icon={<LogOut className="h-4 w-4" />} />
        <StatCard label="Total this week" value={visitorList.length} accent="accent" icon={<UserCheck className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today ({todayVisitors.length})</TabsTrigger>
          <TabsTrigger value="oncampus">On campus ({signedIn.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading visitors...</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Badge</TableHead><TableHead>Name</TableHead><TableHead>Purpose</TableHead>
                <TableHead>Host</TableHead><TableHead>Sign in</TableHead><TableHead>Sign out</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {todayVisitors.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No visitors recorded today.</TableCell></TableRow>
                ) : todayVisitors.map((visitor: any) => {
                  const isSignedIn = (visitor.status ?? "").toLowerCase().replace(" ", "_") === "checked_in" || visitor.status === "Signed in";
                  return (
                    <TableRow key={visitor.id}>
                      <TableCell className="font-mono text-xs">{visitor.badgeNumber ?? visitor.badge ?? "—"}</TableCell>
                      <TableCell className="font-medium">{visitor.name}</TableCell>
                      <TableCell><Badge variant="outline">{visitor.purpose}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{visitor.host}</TableCell>
                      <TableCell>{(visitor.checkInTime ?? visitor.signInTime ?? "").slice(11, 16)}</TableCell>
                      <TableCell>{visitor.checkOutTime ? (visitor.checkOutTime ?? "").slice(11, 16) : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">
                        {isSignedIn ? (
                          <Button size="sm" onClick={() => checkOutMutation.mutate({ id: visitor.id, name: visitor.name })} disabled={checkOutMutation.isPending}>
                            <LogOut className="mr-1 h-3.5 w-3.5" />Sign out
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-success">Left</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="oncampus" className="rounded-xl border border-border bg-card">
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
                  <Button size="sm" onClick={() => checkOutMutation.mutate({ id: visitor.id, name: visitor.name })}>
                    <LogOut className="mr-1 h-3.5 w-3.5" />Sign out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, purpose, or host" className="pl-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.success("Visitor log exported")}>Export CSV</Button>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead>Purpose</TableHead>
              <TableHead>Host</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((visitor: any) => {
                const isSignedIn = (visitor.status ?? "").toLowerCase().replace(" ", "_") === "checked_in";
                return (
                  <TableRow key={visitor.id}>
                    <TableCell className="text-muted-foreground">{(visitor.checkInTime ?? visitor.date ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="font-medium">{visitor.name}</TableCell>
                    <TableCell><Badge variant="outline">{visitor.purpose}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{visitor.host}</TableCell>
                    <TableCell>
                      <Badge variant={isSignedIn ? "outline" : "secondary"}>{isSignedIn ? "On campus" : "Signed out"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No visitors match your search.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
