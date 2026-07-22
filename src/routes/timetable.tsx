import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab } from "@mui/material";
import { PageHeader } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx, downloadCsv } from "@/lib/utils";

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
  const [tab, setTab] = useState("class");
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
            <Button variant="outlined" onClick={exportCsv} startIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
            <Button variant="outlined" onClick={() => window.print()} startIcon={<Printer className="h-4 w-4" />}>Print</Button>
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={() => setNewSlotOpen(true)}>Add slot</Button>
            <Dialog open={newSlotOpen} onClose={() => setNewSlotOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Add timetable slot</DialogTitle>
              <DialogContent>
                <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      {(classesData as any[]).length > 0 ? (
                        <TextField
                          select
                          label="Class"
                          value={form.classId}
                          onChange={(e) => {
                            const v = e.target.value;
                            const c = (classesData as any[]).find((x: any) => x.id === v);
                            setForm({ ...form, classId: v, className: c?.name ?? c?.className ?? "" });
                          }}
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="" disabled>Select class</MenuItem>
                          {(classesData as any[]).map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name ?? c.className}</MenuItem>)}
                        </TextField>
                      ) : (
                        <TextField label="Class" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="Form 1 A" fullWidth size="small" />
                      )}
                    </div>
                    <div>
                      <TextField
                        select
                        label="Day"
                        value={form.day}
                        onChange={(e) => setForm({ ...form, day: e.target.value })}
                        fullWidth
                        size="small"
                      >
                        {DAYS.map((d) => <MenuItem key={d} value={d}>{DAY_LABELS[d]}</MenuItem>)}
                      </TextField>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <TextField
                        label="Start"
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                        fullWidth
                        size="small"
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </div>
                    <div>
                      <TextField
                        label="End"
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                        fullWidth
                        size="small"
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </div>
                    <div>
                      <TextField
                        label="Period"
                        type="number"
                        slotProps={{ htmlInput: { min: "1" } }}
                        value={form.period}
                        onChange={(e) => setForm({ ...form, period: e.target.value })}
                        fullWidth
                        size="small"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      {allSubjectNames.length > 0 ? (
                        <TextField
                          select
                          label="Subject"
                          value={form.subjectName}
                          onChange={(e) => {
                            const v = e.target.value;
                            const s = (subjectsData as any[]).find((x: any) => x.name === v);
                            setForm({ ...form, subjectName: v, subjectId: s?.id ?? "" });
                          }}
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="" disabled>Select subject</MenuItem>
                          {allSubjectNames.map((s: string) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </TextField>
                      ) : (
                        <TextField label="Subject" value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} placeholder="Mathematics" fullWidth size="small" />
                      )}
                    </div>
                    <div>
                      {(teachersData as any[]).length > 0 ? (
                        <TextField
                          select
                          label="Teacher"
                          value={form.teacherId}
                          onChange={(e) => {
                            const v = e.target.value;
                            const t = (teachersData as any[]).find((x: any) => x.id === v);
                            setForm({ ...form, teacherId: v, teacherName: t ? `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() : "" });
                          }}
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="" disabled>Select teacher</MenuItem>
                          {(teachersData as any[]).map((t: any) => <MenuItem key={t.id} value={t.id}>{`${t.firstName ?? ""} ${t.lastName ?? ""}`.trim()}</MenuItem>)}
                        </TextField>
                      ) : (
                        <TextField label="Teacher" value={form.teacherName} onChange={(e) => setForm({ ...form, teacherName: e.target.value })} placeholder="Mr. Phiri" fullWidth size="small" />
                      )}
                    </div>
                  </div>
                  <div>
                    <TextField label="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Room 101" fullWidth size="small" />
                  </div>
                </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setNewSlotOpen(false)}>Cancel</Button>
                <Button onClick={addSlot}>Add slot</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      {isLoading && <div className="py-10 text-center text-sm text-muted-foreground">Loading timetable...</div>}

      {!isLoading && (
        <Box>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab value="class" label="By class" />
            <Tab value="teacher" label="By teacher" />
          </Tabs>

          {tab === "class" && (
          <Box className="space-y-4">
            <div className="flex items-center gap-3">
              <TextField select value={selectedClass} onChange={(e) => setKlass(e.target.value)} size="small" sx={{ width: 224 }}>
                <MenuItem value="" disabled>Select class</MenuItem>
                {classes.map((c: string) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              <Chip size="small" label={`Term ${active.currentTerm}`} sx={badgeSx("outline")} />
              <Chip size="small" label={`${classPeriods.length} periods`} sx={badgeSx("secondary")} />
            </div>
            {timetableTable(allPeriods, classGrid, () => "No timetable data for this class. Add slots above.")}
          </Box>
          )}

          {tab === "teacher" && (
          <Box className="space-y-4">
            <div className="flex items-center gap-3">
              <TextField select value={selectedTeacher} onChange={(e) => setTeacher(e.target.value)} size="small" sx={{ width: 256 }}>
                <MenuItem value="" disabled>Select teacher</MenuItem>
                {teachers.map((t: string) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </div>
            {timetableTable(allPeriods, teacherGrid, () => "No timetable data for this teacher.")}
          </Box>
          )}
        </Box>
      )}
    </div>
    </AccessGuard>
  );
}
