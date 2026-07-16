import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { downloadCsv } from "@/lib/utils";

export const Route = createFileRoute("/timetable")({
  head: () => ({ meta: [{ title: "Timetable - SRMS" }] }),
  component: TimetablePage,
});

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const DAY_LABELS: Record<string, string> = { MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri" };

const subjectColors: Record<string, string> = {
  Mathematics: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "English Language": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  Biology: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Chemistry: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Physics: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  Science: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  History: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Geography: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Civic Education": "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "Computer Studies": "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "Physical Education": "bg-teal-500/15 text-teal-700 dark:text-teal-300",
};

function TimetablePage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const teacherEmail = user?.role === "teacher" ? user.email : undefined;
  const [klass, setKlass] = useState<string>("");
  const [teacher, setTeacher] = useState<string>("");
  const [newSlotOpen, setNewSlotOpen] = useState(false);
  const [form, setForm] = useState({ classId: "", className: "", day: "MONDAY", startTime: "07:30", endTime: "08:10", period: "1", subjectId: "", subjectName: "", teacherId: "", teacherName: "", room: "" });

  const { data: slots = [], isLoading, refetch } = useQuery({
    queryKey: ["timetable", active.id],
    queryFn: () => api.timetable.list(active.id),
  });

  const { data: classesData = [] } = useQuery({ queryKey: ["classes", active.id, teacherEmail], queryFn: () => api.classes.list(active.id, teacherEmail) });
  const { data: teachersData = [] } = useQuery({ queryKey: ["teachers", active.id], queryFn: () => api.teachers.list(active.id) });
  const { data: subjectsData = [] } = useQuery({ queryKey: ["subjects", active.id], queryFn: () => api.subjects.list(active.id) });

  const allSubjectNames = [...new Set([
    ...(subjectsData as any[]).map((s: any) => s.name).filter(Boolean),
    ...Object.keys(subjectColors),
  ])].sort();

  // Auto-populate form when lists arrive or dialog opens
  useEffect(() => {
    if (!newSlotOpen) return;
    setForm((prev) => {
      const firstClass = (classesData as any[])[0];
      const firstSubject = (subjectsData as any[])[0];
      const firstTeacher = (teachersData as any[])[0];
      return {
        ...prev,
        classId: prev.classId || firstClass?.id || "",
        className: prev.className || firstClass?.name || firstClass?.className || "",
        subjectId: prev.subjectId || firstSubject?.id || "",
        subjectName: prev.subjectName || firstSubject?.name || allSubjectNames[0] || "",
        teacherId: prev.teacherId || firstTeacher?.id || "",
        teacherName: prev.teacherName || (firstTeacher ? `${firstTeacher.firstName ?? ""} ${firstTeacher.lastName ?? ""}`.trim() : ""),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSlotOpen, classesData, subjectsData, teachersData]);

  // Derive unique classes and teachers from slots
  const classes = [...new Set(slots.map((s: any) => s.className))].filter(Boolean).sort();
  const teachers = [...new Set(slots.map((s: any) => s.teacherName))].filter(Boolean).sort();
  const selectedClass = klass || classes[0] || "";
  const selectedTeacher = teacher || teachers[0] || "";

  // Get periods for selected class (sorted by period)
  const classPeriods = [...new Set(
    slots.filter((s: any) => s.className === selectedClass).map((s: any) => ({ p: s.period, label: `${s.startTime} - ${s.endTime}` }))
  )].sort((a: any, b: any) => a.p - b.p);

  // Build grid cell lookup: classSlots[day][period] = slot
  const buildGrid = (filtered: any[]) => {
    const grid: Record<string, Record<number, any>> = {};
    for (const slot of filtered) {
      if (!grid[slot.dayOfWeek]) grid[slot.dayOfWeek] = {};
      grid[slot.dayOfWeek][slot.period] = slot;
    }
    return grid;
  };

  const classSlots = slots.filter((s: any) => s.className === selectedClass);
  const teacherSlots = slots.filter((s: any) => s.teacherName === selectedTeacher);
  const classGrid = buildGrid(classSlots);
  const teacherGrid = buildGrid(teacherSlots);

  const allPeriods = [...new Set(slots.map((s: any) => s.period))].sort((a: any, b: any) => a - b);

  const addSlot = async () => {
    if (!form.className || !form.subjectName) { toast.error("Class and subject are required"); return; }
    try {
      await api.timetable.create(active.id, {
        classId: form.classId || form.className.toLowerCase().replace(/\s/g, "-"),
        className: form.className, dayOfWeek: form.day,
        startTime: form.startTime, endTime: form.endTime, period: Number(form.period),
        subjectId: form.subjectId || undefined, subjectName: form.subjectName,
        teacherId: form.teacherId || undefined, teacherName: form.teacherName,
        room: form.room, academicYear: String(active.currentYear), term: active.currentTerm,
      });
      toast.success("Slot added");
      setNewSlotOpen(false);
      void refetch();
    } catch { toast.error("Failed to add slot"); }
  };

  const exportCsv = () => {
    if (slots.length === 0) { toast.error("No timetable data to export"); return; }
    downloadCsv(
      (slots as any[])
        .slice()
        .sort((a: any, b: any) =>
          (a.className ?? "").localeCompare(b.className ?? "")
          || DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek)
          || Number(a.period) - Number(b.period))
        .map((s: any) => ({
          Class: s.className ?? "",
          Day: DAY_LABELS[s.dayOfWeek] ?? s.dayOfWeek ?? "",
          Period: s.period ?? "",
          Start: s.startTime ?? "",
          End: s.endTime ?? "",
          Subject: s.subjectName ?? "",
          Teacher: s.teacherName ?? "",
          Room: s.room ?? "",
        })),
      `timetable-${active.shortCode ?? active.id}-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success("Timetable exported");
  };

  const timetableTable = (periods: number[], grid: Record<string, Record<number, any>>, renderEmpty: () => React.ReactNode) => (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Period</th>
            {DAYS.map((day) => (
              <th key={day} className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{DAY_LABELS[day]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => {
            const sample = Object.values(grid).flatMap(Object.values).find((s: any) => s.period === period) as any;
            const timeLabel = sample ? `${sample.startTime} – ${sample.endTime}` : `Period ${period}`;
            return (
              <tr key={period} className="border-b border-border last:border-0">
                <td className="p-3 text-xs font-medium whitespace-nowrap text-muted-foreground">{timeLabel}</td>
                {DAYS.map((day) => {
                  const slot = grid[day]?.[period];
                  if (!slot) return <td key={day} className="p-3"><div className="rounded-md bg-muted/30 px-2 py-2 text-center text-xs text-muted-foreground">—</div></td>;
                  const color = subjectColors[slot.subjectName] ?? "bg-muted text-foreground";
                  return (
                    <td key={day} className="p-3">
                      <div className={`rounded-md px-2 py-2 ${color}`}>
                        <div className="text-sm font-medium">{slot.subjectName}</div>
                        <div className="text-[10px] opacity-80">{slot.teacherName}</div>
                        {slot.room && <div className="text-[10px] opacity-60">{slot.room}</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {periods.length === 0 && (
            <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">{renderEmpty()}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <AccessGuard module="timetable">
      <div className="space-y-6">
      <PageHeader
        title="Class Timetable"
        description={`Weekly schedule · ${active.name}`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" />Export CSV</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print</Button>
            <Dialog open={newSlotOpen} onOpenChange={setNewSlotOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Add slot</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add timetable slot</DialogTitle></DialogHeader>
                <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Class</Label>
                      {(classesData as any[]).length > 0 ? (
                        <Select
                          value={form.classId}
                          onValueChange={(v) => {
                            const c = (classesData as any[]).find((x: any) => x.id === v);
                            setForm({ ...form, classId: v, className: c?.name ?? c?.className ?? "" });
                          }}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
                          <SelectContent>{(classesData as any[]).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name ?? c.className}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input className="mt-1" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="Form 1 A" />
                      )}
                    </div>
                    <div>
                      <Label>Day</Label>
                      <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Start</Label>
                      <Input className="mt-1" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input className="mt-1" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                    </div>
                    <div>
                      <Label>Period</Label>
                      <Input className="mt-1" type="number" min="1" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Subject</Label>
                      {allSubjectNames.length > 0 ? (
                        <Select
                          value={form.subjectName}
                          onValueChange={(v) => {
                            const s = (subjectsData as any[]).find((x: any) => x.name === v);
                            setForm({ ...form, subjectName: v, subjectId: s?.id ?? "" });
                          }}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select subject" /></SelectTrigger>
                          <SelectContent>{allSubjectNames.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input className="mt-1" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} placeholder="Mathematics" />
                      )}
                    </div>
                    <div>
                      <Label>Teacher</Label>
                      {(teachersData as any[]).length > 0 ? (
                        <Select
                          value={form.teacherId}
                          onValueChange={(v) => {
                            const t = (teachersData as any[]).find((x: any) => x.id === v);
                            setForm({ ...form, teacherId: v, teacherName: t ? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() : "" });
                          }}
                        >
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                          <SelectContent>{(teachersData as any[]).map((t: any) => <SelectItem key={t.id} value={t.id}>{`${t.firstName ?? ""} ${t.lastName ?? ""}`.trim()}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input className="mt-1" value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} placeholder="Mr. Phiri" />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Room</Label>
                    <Input className="mt-1" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room 101" />
                  </div>
                </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewSlotOpen(false)}>Cancel</Button>
                  <Button onClick={addSlot}>Add slot</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Loading timetable...</div>}

      {!isLoading && (
        <Tabs defaultValue="class" className="space-y-4">
          <TabsList>
            <TabsTrigger value="class">By class</TabsTrigger>
            <TabsTrigger value="teacher">By teacher</TabsTrigger>
          </TabsList>

          <TabsContent value="class" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={selectedClass} onValueChange={setKlass}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Badge variant="outline">Term {active.currentTerm}</Badge>
              <Badge variant="secondary">{classPeriods.length} periods</Badge>
            </div>
            {timetableTable(allPeriods, classGrid, () => "No timetable data for this class. Add slots above.")}
          </TabsContent>

          <TabsContent value="teacher" className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={selectedTeacher} onValueChange={setTeacher}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>{teachers.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {timetableTable(allPeriods, teacherGrid, () => "No timetable data for this teacher.")}
          </TabsContent>
        </Tabs>
      )}
    </div>
    </AccessGuard>
  );
}
