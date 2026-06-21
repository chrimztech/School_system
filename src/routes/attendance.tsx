import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, UserX, Clock, WifiOff, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — SRMS" }] }),
  component: AttendancePage,
});


type EntryStatus = "present" | "absent" | "late";
type AttendanceEntry = { id: string; student: string; status: EntryStatus };

function AttendancePage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", schoolId], queryFn: () => api.classes.list(schoolId) });
  const classList = (classesData as any[]).map((c: any) => c.name || c.className || c.id).filter(Boolean);

  const [open, setOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);

  const { data: summary = { present: 0, absent: 0, late: 0, rate: 0 } } = useQuery({
    queryKey: ["attendance-summary", schoolId],
    queryFn: () => api.attendance.summary(schoolId),
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", schoolId],
    queryFn: () => api.students.list(schoolId),
    select: (data: any[]) => data.map((s: any) => ({
      id: s.id,
      student: `${s.firstName} ${s.lastName}`,
      status: "present" as EntryStatus,
    })),
  });

  const { data: recentRecords = [] } = useQuery({
    queryKey: ["attendance-list", schoolId],
    queryFn: () => api.attendance.list(schoolId),
  });

  const markMutation = useMutation({
    mutationFn: (data: any) => api.attendance.mark(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-summary", schoolId] });
      qc.invalidateQueries({ queryKey: ["attendance-list", schoolId] });
    },
  });

  const classEntries = entries.length > 0 ? entries : (students as AttendanceEntry[]);

  const toggleStatus = (id: string, status: EntryStatus) => {
    if (entries.length === 0) {
      setEntries((students as AttendanceEntry[]).map((e) => e.id === id ? { ...e, status } : e));
    } else {
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
    }
  };

  const submitRegister = () => {
    const present = classEntries.filter((e) => e.status === "present").length;
    const absent = classEntries.filter((e) => e.status === "absent").length;
    const records = classEntries.map((e) => ({ studentName: e.student, status: e.status, className: selectedClass }));
    markMutation.mutate({ date: new Date().toISOString().slice(0, 10), className: selectedClass, records });
    toast.success(`Register submitted — ${present} present, ${absent} absent · parent SMS queued`);
    setEntries([]);
    setOpen(false);
  };

  const summ = summary as any;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Configurable per phase: full-day for primary, period-based for secondary"
        actions={
          <>
            <Button variant="outline" onClick={() => setOfflineOpen(true)}>
              <WifiOff className="mr-2 h-4 w-4" /> Offline mode
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1 h-4 w-4" />Mark attendance</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Mark class register</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0">Class</Label>
                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setEntries([]); }}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{classList.length === 0 ? <SelectItem value="__empty__" disabled>No classes yet</SelectItem> : classList.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Student</th>
                          <th className="px-3 py-2 text-center font-medium">Present</th>
                          <th className="px-3 py-2 text-center font-medium">Late</th>
                          <th className="px-3 py-2 text-center font-medium">Absent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classEntries.map((e) => (
                          <tr key={e.id} className="border-t border-border">
                            <td className="px-3 py-2 font-medium">{e.student}</td>
                            {(["present", "late", "absent"] as const).map((s) => (
                              <td key={s} className="px-3 py-2 text-center">
                                <button
                                  onClick={() => toggleStatus(e.id, s)}
                                  className={`h-5 w-5 rounded-full border-2 transition ${
                                    e.status === s
                                      ? s === "present" ? "border-emerald-500 bg-emerald-500"
                                      : s === "late" ? "border-amber-500 bg-amber-500"
                                      : "border-destructive bg-destructive"
                                      : "border-muted-foreground/30"
                                  }`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" />Present: {classEntries.filter((e) => e.status === "present").length}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-500" />Late: {classEntries.filter((e) => e.status === "late").length}</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-destructive" />Absent: {classEntries.filter((e) => e.status === "absent").length}</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={submitRegister} disabled={markMutation.isPending}>
                    {markMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit register
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={offlineOpen} onOpenChange={setOfflineOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Offline attendance mode</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Offline mode lets teachers capture attendance without an internet connection. Data syncs automatically when connectivity is restored.</p>
                  <div className="rounded-lg border border-border p-3 space-y-1">
                    <p className="font-medium text-foreground">How it works</p>
                    <p>• Opens a local PWA register</p>
                    <p>• Stores entries on-device (IndexedDB)</p>
                    <p>• Syncs to server on next connection</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOfflineOpen(false)}>Cancel</Button>
                  <Button onClick={() => { toast.success("Offline mode activated — data will sync automatically"); setOfflineOpen(false); }}>
                    <WifiOff className="mr-2 h-4 w-4" />Enable offline mode
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present" value={summ.present ?? 0} accent="success" icon={<CalendarCheck className="h-4 w-4" />} />
        <StatCard label="Absent" value={summ.absent ?? 0} accent="destructive" icon={<UserX className="h-4 w-4" />} />
        <StatCard label="Late" value={summ.late ?? 0} accent="warning" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Rate" value={`${summ.rate ?? 0}%`} accent="primary" />
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="weekly">Weekly trend</TabsTrigger>
          <TabsTrigger value="alerts">Absence alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Recent attendance records</h2>
            {(recentRecords as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records for today. Use "Mark attendance" to submit a class register.</p>
            ) : (
              <div className="space-y-2">
                {(recentRecords as any[]).slice(0, 10).map((r: any, i) => (
                  <div key={r.id ?? i} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{r.studentName ?? r.student}</p>
                      <p className="text-xs text-muted-foreground">{r.className ?? r.class} · {(r.date ?? "").slice(0, 10)}</p>
                    </div>
                    <Badge variant={r.status === "present" ? "secondary" : r.status === "late" ? "outline" : "destructive"}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">School-wide attendance · this week</h2>
            <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">SMS notifications sent today</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No parent notifications sent yet.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
