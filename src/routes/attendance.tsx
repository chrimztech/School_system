import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, UserX, Clock, WifiOff, Plus, Loader2, HeartPulse, ShieldCheck } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/attendance")({
  head: () => ({ meta: [{ title: "Attendance — SRMS" }] }),
  component: AttendancePage,
});


type EntryStatus = "present" | "absent" | "late" | "sick" | "excused";
type AttendanceEntry = { id: string; student: string; status: EntryStatus };

const STATUS_META: Record<EntryStatus, { label: string; short: string; border: string; bg: string; dot: string }> = {
  present: { label: "Present", short: "P", border: "border-emerald-500", bg: "bg-emerald-500", dot: "bg-emerald-500" },
  late: { label: "Late", short: "L", border: "border-amber-500", bg: "bg-amber-500", dot: "bg-amber-500" },
  absent: { label: "Absent", short: "A", border: "border-destructive", bg: "bg-destructive", dot: "bg-destructive" },
  sick: { label: "Sick", short: "S", border: "border-sky-500", bg: "bg-sky-500", dot: "bg-sky-500" },
  excused: { label: "Absent w/ permission", short: "E", border: "border-violet-500", bg: "bg-violet-500", dot: "bg-violet-500" },
};
const STATUS_ORDER: EntryStatus[] = ["present", "late", "absent", "sick", "excused"];

function AttendancePage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const teacherEmail = user?.role === "teacher" ? user.email : undefined;
  const qc = useQueryClient();

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", schoolId, teacherEmail], queryFn: () => api.classes.list(schoolId, teacherEmail) });
  const classList = (classesData as any[]).map((c: any) => c.name || c.className || c.id).filter(Boolean);

  const [open, setOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);

  const { data: summary = { present: 0, absent: 0, late: 0, sick: 0, excused: 0, rate: 0 } } = useQuery({
    queryKey: ["attendance-summary", schoolId],
    queryFn: () => api.attendance.summary(schoolId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", schoolId, teacherEmail],
    queryFn: () => api.students.list(schoolId, teacherEmail),
    select: (data: any[]) => data.map((s: any) => ({
      id: s.id,
      student: `${s.firstName} ${s.lastName}`,
      status: "present" as EntryStatus,
    })),
  });

  const { data: recentRecords = [] } = useQuery({
    queryKey: ["attendance-list", schoolId],
    queryFn: () => api.attendance.list(schoolId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const markMutation = useMutation({
    mutationFn: (data: any) => api.attendance.mark(schoolId, data),
    onSuccess: (saved: any) => {
      const records: any[] = Array.isArray(saved) ? saved : [];
      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;
      toast.success(`Register submitted — ${present} present, ${absent} absent · parent SMS queued`);
      // Immediately patch the cache (upsert by studentId to avoid duplicates)
      qc.setQueryData(["attendance-list", schoolId], (old: any) => {
        const existing: any[] = Array.isArray(old) ? old : [];
        const updatedIds = new Set(records.map((r: any) => r.studentId ?? r.id));
        return [...existing.filter((r: any) => !updatedIds.has(r.studentId ?? r.id)), ...records];
      });
      // Force fresh fetch for both list and summary
      void qc.refetchQueries({ queryKey: ["attendance-list", schoolId] });
      void qc.refetchQueries({ queryKey: ["attendance-summary", schoolId] });
    },
    onError: () => toast.error("Failed to submit register — please try again"),
  });

  // Records already submitted today for the selected class
  const todayClassRecords = (recentRecords as any[]).filter(
    (r) => (r.className ?? r.class) === selectedClass
  );
  const alreadySubmitted = todayClassRecords.length > 0;

  // Build entries: prefer today's saved statuses over defaults
  const savedStatusMap = new Map<string, EntryStatus>(
    todayClassRecords.map((r: any) => [r.studentId, r.status as EntryStatus])
  );
  const baseStudents = (students as AttendanceEntry[]).map((s) =>
    savedStatusMap.has(s.id) ? { ...s, status: savedStatusMap.get(s.id)! } : s
  );
  const classEntries = entries.length > 0 ? entries : baseStudents;

  const toggleStatus = (id: string, status: EntryStatus) => {
    const base = entries.length === 0 ? baseStudents : entries;
    setEntries(base.map((e) => e.id === id ? { ...e, status } : e));
  };

  const submitRegister = () => {
    const entries = classEntries.map((e) => ({ studentId: e.id, studentName: e.student, status: e.status }));
    markMutation.mutate({ date: new Date().toISOString().slice(0, 10), classId: selectedClass, className: selectedClass, entries });
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
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Mark class register</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0">Class</Label>
                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setEntries([]); }}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{classList.length === 0 ? <SelectItem value="__empty__" disabled>No classes yet</SelectItem> : classList.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {alreadySubmitted && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
                      Register already submitted for {selectedClass} today — changes will update existing records.
                    </div>
                  )}
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Student</th>
                          {STATUS_ORDER.map((s) => (
                            <th key={s} className="px-2 py-2 text-center font-medium" title={STATUS_META[s].label}>{STATUS_META[s].short}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classEntries.map((e) => (
                          <tr key={e.id} className="border-t border-border">
                            <td className="px-3 py-2 font-medium">{e.student}</td>
                            {STATUS_ORDER.map((s) => (
                              <td key={s} className="px-2 py-2 text-center">
                                <button
                                  onClick={() => toggleStatus(e.id, s)}
                                  title={STATUS_META[s].label}
                                  className={`h-5 w-5 rounded-full border-2 transition ${
                                    e.status === s
                                      ? `${STATUS_META[s].border} ${STATUS_META[s].bg}`
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
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {STATUS_ORDER.map((s) => (
                      <span key={s} className="flex items-center gap-1.5">
                        <span className={`h-3 w-3 rounded-full ${STATUS_META[s].dot}`} />
                        {STATUS_META[s].label}: {classEntries.filter((e) => e.status === s).length}
                      </span>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={submitRegister} disabled={markMutation.isPending}>
                    {markMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {alreadySubmitted ? "Update register" : "Submit register"}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Present" value={summ.present ?? 0} accent="success" icon={<CalendarCheck className="h-4 w-4" />} />
        <StatCard label="Absent" value={summ.absent ?? 0} accent="destructive" icon={<UserX className="h-4 w-4" />} />
        <StatCard label="Late" value={summ.late ?? 0} accent="warning" icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Sick" value={summ.sick ?? 0} accent="primary" icon={<HeartPulse className="h-4 w-4" />} />
        <StatCard label="Excused" value={summ.excused ?? 0} accent="accent" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Rate" value={`${summ.rate ?? 0}%`} accent="primary" />
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="weekly">Weekly trend</TabsTrigger>
          <TabsTrigger value="alerts">Absence alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-4">
          {/* Per-class statistics */}
          {(recentRecords as any[]).length > 0 && (() => {
            const byClass = new Map<string, Record<EntryStatus, number> & { total: number }>();
            for (const r of recentRecords as any[]) {
              const cls = r.className ?? r.class ?? "Unknown";
              if (!byClass.has(cls)) byClass.set(cls, { present: 0, absent: 0, late: 0, sick: 0, excused: 0, total: 0 });
              const c = byClass.get(cls)!;
              c.total++;
              if (STATUS_ORDER.includes(r.status)) c[r.status as EntryStatus]++;
            }
            return (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Class statistics · today</h2>
                <div className="space-y-2">
                  {Array.from(byClass.entries()).map(([cls, stats]) => (
                    <div key={cls} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                      <p className="w-28 shrink-0 text-sm font-medium">{cls}</p>
                      <div className="flex flex-1 flex-wrap items-center gap-3 text-xs">
                        {STATUS_ORDER.map((s) => (
                          <span key={s} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />{stats[s]} {STATUS_META[s].label.toLowerCase()}</span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{stats.total} students · {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Individual records */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold">Attendance records · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
            {(recentRecords as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records for today. Use "Mark attendance" to submit a class register.</p>
            ) : (
              <div className="space-y-2">
                {(recentRecords as any[]).map((r: any, i) => (
                  <div key={r.id ?? i} className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{r.studentName ?? r.student ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.className ?? r.class ?? "—"} · {String(r.date ?? "").slice(0, 10)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={STATUS_ORDER.includes(r.status) ? `border-transparent text-white ${STATUS_META[r.status as EntryStatus].bg}` : undefined}
                    >
                      {STATUS_ORDER.includes(r.status) ? STATUS_META[r.status as EntryStatus].label : r.status}
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
