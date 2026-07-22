import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle } from "@mui/material";
import { PageHeader } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendar - SRMS" }] }),
  component: CalendarPage,
});

const CATEGORY_COLORS: Record<string, string> = {
  Academic: "bg-blue-500",
  Parents: "bg-purple-500",
  Sports: "bg-emerald-500",
  Finance: "bg-amber-500",
  Cultural: "bg-rose-500",
  Staff: "bg-cyan-500",
  Other: "bg-slate-500",
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function createForm(year: number, month: number) {
  return {
    title: "",
    date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    category: "Academic",
    startTime: "08:00",
    endTime: "17:00",
    location: "",
    attendees: "All",
    visibility: "All staff",
    owner: "",
    transport: "",
    description: "",
  };
}

function buildEventDescription(form: ReturnType<typeof createForm>) {
  return form.description.trim();
}

function parseEventDescription(description: string | null | undefined) {
  const meta: Record<string, string> = {};
  for (const line of (description ?? "").split("\n").map((item) => item.trim()).filter(Boolean)) {
    const [label, ...rest] = line.split(":");
    if (!rest.length) continue;
    meta[label.toLowerCase()] = rest.join(":").trim();
  }
  return meta;
}

function CalendarPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => createForm(2026, 4));

  const { data: events = [] } = useQuery({
    queryKey: ["calendar", active.id],
    queryFn: () => api.calendar.list(active.id),
  });

  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["calendar-picker-users", active.id],
    queryFn: () => api.users.list(active.id),
    enabled: open,
  });
  const staffOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));

  const createMut = useMutation({
    mutationFn: (data: any) => api.calendar.create(active.id, data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["calendar", active.id] });
      toast.success(`"${variables.title}" added to the calendar`);
      setOpen(false);
    },
    onError: () => toast.error("Failed to add event"),
  });

  const addEvent = () => {
    if (!form.title.trim() || !form.date) {
      toast.error("Title and date are required");
      return;
    }

    createMut.mutate({
      title: form.title.trim(),
      eventDate: form.date,
      category: form.category,
      term: active.currentTerm,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location.trim() || null,
      attendees: form.attendees.trim() || null,
      visibility: form.visibility,
      owner: form.owner.trim() || null,
      transport: form.transport.trim() || null,
      description: buildEventDescription(form) || null,
    });
    setForm(createForm(year, month));
  };

  const cells = buildCalendar(year, month);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const eventByDay = new Map<number, any[]>();

  for (const event of events as any[]) {
    const dateStr: string = event.eventDate || event.date || "";
    if (!dateStr.startsWith(monthKey)) continue;
    const day = parseInt(dateStr.split("-")[2], 10);
    const dayEvents = eventByDay.get(day) ?? [];
    dayEvents.push(event);
    eventByDay.set(day, dayEvents);
  }

  const goToPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((currentYear) => currentYear - 1);
      return;
    }
    setMonth((currentMonth) => currentMonth - 1);
  };

  const goToNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((currentYear) => currentYear + 1);
      return;
    }
    setMonth((currentMonth) => currentMonth + 1);
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setForm(createForm(today.getFullYear(), today.getMonth()));
  };

  const todayStr = today.toISOString().slice(0, 10);
  const upcomingEvents = [...(events as any[])]
    .sort((left, right) => (left.eventDate || left.date || "").localeCompare(right.eventDate || right.date || ""))
    .filter((event) => (event.eventDate || event.date || "") >= todayStr);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Calendar"
        description={`Term ${active.currentTerm} - ${active.currentYear} - ${active.shortCode}`}
        actions={
          <>
          <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Add event</Button>
          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
            <DialogTitle>Add calendar event</DialogTitle>
            <DialogContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <TextField
                    label="Event title *"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Sports Day"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    fullWidth
                    size="small"
                  />
                </div>
                <TextField
                  select
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  fullWidth
                  size="small"
                >
                  {Object.keys(CATEGORY_COLORS).map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
                </TextField>
                <TextField
                  type="date"
                  label="Date *"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  type="time"
                  label="Start time"
                  value={form.startTime}
                  onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  type="time"
                  label="End time"
                  value={form.endTime}
                  onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Location / venue"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="School grounds, Hall A, Board room"
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Visibility"
                  value={form.visibility}
                  onChange={(event) => setForm({ ...form, visibility: event.target.value })}
                  fullWidth
                  size="small"
                >
                  {["All staff", "Teachers only", "Management only", "Parents & students", "Public"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </TextField>
                <TextField
                  label="Attendees / target group"
                  value={form.attendees}
                  onChange={(event) => setForm({ ...form, attendees: event.target.value })}
                  placeholder="All, Form 3-6, Parents, Board members"
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  fullWidth
                  size="small"
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Event owner</p>
                  <div className="space-y-1.5">
                    <PersonCombobox
                      options={staffOptions}
                      loading={pickerUsersLoading}
                      placeholder="Search school staff…"
                      emptyText="No staff found."
                      onSelect={(option) => setForm((prev) => ({ ...prev, owner: option.label }))}
                    />
                    <TextField
                      value={form.owner}
                      onChange={(event) => setForm({ ...form, owner: event.target.value })}
                      placeholder="Deputy Head, Sports Office, PTA Chair"
                      slotProps={{ htmlInput: { maxLength: 100 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                </div>
                <TextField
                  label="Transport / logistics"
                  value={form.transport}
                  onChange={(event) => setForm({ ...form, transport: event.target.value })}
                  placeholder="2 buses, PA system, hall setup, security team"
                  slotProps={{ htmlInput: { maxLength: 120 } }}
                  fullWidth
                  size="small"
                />
                <div className="col-span-2">
                  <TextField
                    label="Description / notes"
                    multiline
                    minRows={4}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="Agenda, dress code, student briefing, parent note, or operational checklist"
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    fullWidth
                    size="small"
                  />
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={addEvent} disabled={createMut.isPending}>Add event</Button>
            </DialogActions>
          </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              {MONTH_NAMES[month]} {year}
            </h2>
            <div className="flex gap-1">
              <Button variant="outlined" size="small" onClick={goToPrev}>Prev</Button>
              <Button variant="outlined" size="small" onClick={goToToday}>Today</Button>
              <Button variant="outlined" size="small" onClick={goToNext}>Next</Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
              <div key={dayName} className="bg-muted px-2 py-2 text-center font-medium uppercase tracking-wide text-muted-foreground">{dayName}</div>
            ))}
            {cells.map((day, index) => {
              const isToday = day !== null && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
              return (
                <div key={index} className={`min-h-24 bg-card p-2 ${isToday ? "ring-2 ring-inset ring-primary" : ""}`}>
                  {day && (
                    <>
                      <p className={`text-xs font-medium ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{day}</p>
                      <div className="mt-1 space-y-1">
                        {(eventByDay.get(day) ?? []).map((event: any) => {
                          const color = CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.Other;
                          return (
                            <div key={event.id || event.title} className={`truncate rounded px-1.5 py-0.5 text-[10px] text-white ${color}`}>
                              {event.title}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Upcoming events</h2>
          <ul className="mt-4 space-y-3">
            {upcomingEvents.slice(0, 8).map((event: any) => {
              const dateStr: string = event.eventDate || event.date || "";
              const meta = parseEventDescription(event.description);
              const timeLabel = event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : meta.time;
              const venueLabel = event.location || meta.venue;
              const audienceLabel = event.attendees || meta.audience;
              return (
                <li key={event.id || `${dateStr}-${event.title}`} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-muted px-2 py-1.5 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground">{dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleString("en", { month: "short" }) : ""}</span>
                    <span className="text-sm font-bold">{dateStr ? parseInt(dateStr.split("-")[2], 10) : ""}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <Chip size="small" label={event.category} sx={{ ...badgeSx("secondary"), mt: 0.5, fontSize: 10 }} />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[timeLabel, venueLabel, audienceLabel].filter(Boolean).join(" - ")}
                    </div>
                  </div>
                </li>
              );
            })}
            {upcomingEvents.length === 0 && <li className="text-sm text-muted-foreground">No upcoming events.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
