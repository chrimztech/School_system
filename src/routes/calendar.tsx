import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Add event</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add calendar event</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Event title *</Label>
                  <Input className="mt-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Sports Day" maxLength={100} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(CATEGORY_COLORS).map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" className="mt-1" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                </div>
                <div>
                  <Label>Start time</Label>
                  <Input type="time" className="mt-1" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
                </div>
                <div>
                  <Label>End time</Label>
                  <Input type="time" className="mt-1" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
                </div>
                <div>
                  <Label>Location / venue</Label>
                  <Input className="mt-1" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="School grounds, Hall A, Board room" maxLength={100} />
                </div>
                <div>
                  <Label>Visibility</Label>
                  <Select value={form.visibility} onValueChange={(value) => setForm({ ...form, visibility: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["All staff", "Teachers only", "Management only", "Parents & students", "Public"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Attendees / target group</Label>
                  <Input className="mt-1" value={form.attendees} onChange={(event) => setForm({ ...form, attendees: event.target.value })} placeholder="All, Form 3-6, Parents, Board members" maxLength={100} />
                </div>
                <div>
                  <Label>Event owner</Label>
                  <Input className="mt-1" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} placeholder="Deputy Head, Sports Office, PTA Chair" maxLength={100} />
                </div>
                <div>
                  <Label>Transport / logistics</Label>
                  <Input className="mt-1" value={form.transport} onChange={(event) => setForm({ ...form, transport: event.target.value })} placeholder="2 buses, PA system, hall setup, security team" maxLength={120} />
                </div>
                <div className="col-span-2">
                  <Label>Description / notes</Label>
                  <Textarea className="mt-1" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Agenda, dress code, student briefing, parent note, or operational checklist" maxLength={500} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addEvent} disabled={createMut.isPending}>Add event</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <Button variant="outline" size="sm" onClick={goToPrev}>Prev</Button>
              <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
              <Button variant="outline" size="sm" onClick={goToNext}>Next</Button>
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
                    <Badge variant="secondary" className="mt-1 text-[10px]">{event.category}</Badge>
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
