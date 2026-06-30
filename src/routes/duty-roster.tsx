import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, Shield, Users, Plus } from "lucide-react";
import { toast } from "sonner";

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

export const Route = createFileRoute("/duty-roster")({
  head: () => ({ meta: [{ title: "Duty Roster — SRMS" }] }),
  component: DutyRosterPage,
});

type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
type DutyType = "Gate" | "Assembly" | "Break" | "Lunch" | "Prep" | "Evening";

const DAYS: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DUTY_TYPES: DutyType[] = ["Gate", "Assembly", "Break", "Lunch", "Prep", "Evening"];
const LOCATIONS = ["Main Gate", "Assembly Ground", "Playground", "Canteen", "Library Block", "Hostel Block", "Science Block"];

const SLOT_TIMES: Record<DutyType, string> = {
  Gate: "06:30 – 07:45", Assembly: "07:45 – 08:00", Break: "10:20 – 10:40",
  Lunch: "12:30 – 13:15", Prep: "18:00 – 21:00", Evening: "21:00 – 22:00",
};

const TYPE_COLOR: Record<string, string> = {
  Gate: "bg-blue-500/10 text-blue-700", Assembly: "bg-purple-500/10 text-purple-700",
  Break: "bg-emerald-500/10 text-emerald-700", Lunch: "bg-amber-500/10 text-amber-700",
  Prep: "bg-rose-500/10 text-rose-700", Evening: "bg-slate-500/10 text-slate-700",
};

const today: Day = "Wednesday";

function DutyRosterPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState<{ day: Day; type: DutyType; staff: string; location: string; backupStaff: string; effectiveDate: string; rotationCycle: string; notes: string; approvalStatus: string }>({
    day: "Monday", type: "Gate", staff: "", location: LOCATIONS[0],
    backupStaff: "", effectiveDate: new Date().toISOString().slice(0, 10),
    rotationCycle: "Weekly", notes: "", approvalStatus: "Approved",
  });

  const { data: duties = [], isLoading } = useQuery({
    queryKey: ["duty-roster", active.id],
    queryFn: () => api.dutyRoster.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.dutyRoster.create(active.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["duty-roster", active.id] });
      toast.success(`${form.type} duty assigned to ${form.staff} on ${form.day}`);
      setAssignOpen(false);
    },
    onError: () => toast.error("Failed to assign duty"),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id }: { id: string; staff: string }) => api.dutyRoster.delete(active.id, id),
    onSuccess: (_d, { staff }) => { void qc.invalidateQueries({ queryKey: ["duty-roster", active.id] }); toast.success(`Duty removed for ${staff}`); },
    onError: () => toast.error("Failed to remove duty"),
  });

  const assignDuty = () => {
    const conflict = (duties as any[]).find((d: any) => (d.dayOfWeek || d.day) === form.day && (d.role || d.type) === form.type && (d.staffName || d.staff) === form.staff);
    if (conflict) { toast.error(`${form.staff} already has ${form.type} duty on ${form.day}`); return; }
    const slot = SLOT_TIMES[form.type];
    const [startTime, endTime] = slot.split(" – ");
    createMut.mutate({ staffName: form.staff, role: form.type, dayOfWeek: form.day, location: form.location, startTime, endTime, week: 1, term: active.currentTerm, backupStaff: form.backupStaff || null, effectiveDate: form.effectiveDate, rotationCycle: form.rotationCycle, notes: form.notes.trim() || null, approvalStatus: form.approvalStatus });
  };

  // Normalize duty records from backend
  const normalizedDuties = (duties as any[]).map((d: any) => ({
    id: d.id,
    day: (d.dayOfWeek || d.day) as Day,
    type: (d.role || d.type) as DutyType,
    staff: d.staffName || d.staff || "",
    location: d.location || "",
    slot: d.startTime && d.endTime ? `${d.startTime} – ${d.endTime}` : SLOT_TIMES[(d.role || d.type) as DutyType] || "",
  }));

  const STAFF = [...new Set(normalizedDuties.map((d) => d.staff).filter(Boolean))];
  const todayDuties = normalizedDuties.filter((d) => d.day === today);
  const unassignedSlots = Math.max(0, DAYS.length * 2 - normalizedDuties.filter((d) => ["Gate", "Assembly"].includes(d.type)).length);

  return (
    <AccessGuard module="duty-roster">
      <div className="space-y-6">
      <PageHeader
        title="Duty Roster"
        description="Weekly staff duty assignments — gate, assembly, break supervision, prep and evening."
        actions={
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Assign duty</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Assign duty</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Day</Label>
                  <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v as Day })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duty type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as DutyType })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{DUTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t} · {SLOT_TIMES[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Primary staff</Label>
                  <Input className="mt-1" value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })} placeholder="Staff member name" maxLength={100} />
                </div>
                <div>
                  <Label>Backup staff</Label>
                  <Select value={form.backupStaff || "__none__"} onValueChange={(v) => setForm({ ...form, backupStaff: v === "__none__" ? "" : v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {STAFF.filter((s) => s !== form.staff).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Effective date</Label>
                  <Input type="date" className="mt-1" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
                </div>
                <div>
                  <Label>Rotation cycle</Label>
                  <Select value={form.rotationCycle} onValueChange={(v) => setForm({ ...form, rotationCycle: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Weekly", "Fortnightly", "Monthly", "Per term", "Permanent"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Approval status</Label>
                  <Select value={form.approvalStatus} onValueChange={(v) => setForm({ ...form, approvalStatus: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Draft", "Pending approval", "Approved"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Special instructions / notes</Label>
                  <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Check visitor IDs, assist with late bus arrivals" maxLength={200} />
                </div>
                <div className="col-span-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Time slot: <span className="font-medium text-foreground">{SLOT_TIMES[form.type]}</span>
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
                <Button onClick={assignDuty} disabled={createMut.isPending}>Assign</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Duties this week" value={normalizedDuties.length} accent="primary" icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="On duty today" value={todayDuties.length} hint={today} accent="success" icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Staff assigned" value={new Set(normalizedDuties.map((d) => d.staff)).size} accent="accent" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Unassigned slots" value={unassignedSlots} accent="warning" icon={<Clock className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">Weekly roster</TabsTrigger>
          <TabsTrigger value="today">Today's duties</TabsTrigger>
          <TabsTrigger value="bystaff">By staff</TabsTrigger>
          <TabsTrigger value="types">Duty types</TabsTrigger>
        </TabsList>

        {/* WEEKLY GRID */}
        <TabsContent value="weekly" className="overflow-x-auto rounded-xl border border-border bg-card">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>
          ) : (
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="w-36 px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Duty</th>
                  {DAYS.map((d) => (
                    <th key={d} className={`px-4 py-3 text-left text-xs font-medium uppercase ${d === today ? "text-primary" : "text-muted-foreground"}`}>
                      {d}{d === today && " ★"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DUTY_TYPES.map((type) => (
                  <tr key={type} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{type}</p>
                        <p className="text-xs text-muted-foreground">{SLOT_TIMES[type]}</p>
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const assigned = normalizedDuties.filter((d) => d.day === day && d.type === type);
                      return (
                        <td key={day} className="px-4 py-3">
                          {assigned.length > 0 ? (
                            <div className="space-y-1">
                              {assigned.map((a) => (
                                <span key={a.id} className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[type] ?? "bg-muted text-foreground"}`}>
                                  {a.staff.split(" ").slice(-1)[0]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        {/* TODAY */}
        <TabsContent value="today" className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <p className="text-sm font-medium">{today} — duty schedule</p>
          </div>
          {todayDuties.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No duties assigned for today.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Duty</TableHead><TableHead>Time</TableHead><TableHead>Staff</TableHead>
                <TableHead>Location</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {todayDuties.sort((a, b) => a.slot.localeCompare(b.slot)).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[d.type] ?? "bg-muted text-foreground"}`}>{d.type}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.slot}</TableCell>
                    <TableCell className="font-medium">{d.staff}</TableCell>
                    <TableCell>{d.location}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toast.success(`Reminder sent to ${d.staff}`)}>Remind</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* BY STAFF */}
        <TabsContent value="bystaff" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Staff</TableHead><TableHead>Total duties</TableHead><TableHead>Days</TableHead>
              <TableHead>Duty types</TableHead><TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {[...new Set(normalizedDuties.map((d) => d.staff))].map((staff) => {
                const staffDuties = normalizedDuties.filter((d) => d.staff === staff);
                const days = [...new Set(staffDuties.map((d) => d.day))];
                const types = [...new Set(staffDuties.map((d) => d.type))];
                return (
                  <TableRow key={staff}>
                    <TableCell className="font-medium">{staff}</TableCell>
                    <TableCell>{staffDuties.length}</TableCell>
                    <TableCell className="text-muted-foreground">{days.join(", ")}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {types.map((t) => (
                          <span key={t} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLOR[t] ?? "bg-muted text-foreground"}`}>{t}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toast.info(`${staff}: ${staffDuties.length} duties this week`)}>Details</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        {/* DUTY TYPES */}
        <TabsContent value="types" className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {DUTY_TYPES.map((type) => {
              const count = normalizedDuties.filter((d) => d.type === type).length;
              const descriptions: Record<DutyType, string> = {
                Gate: "Manage student and visitor entry. Enforce uniform and ID checks.",
                Assembly: "Supervise morning assembly, flag-raising and announcements.",
                Break: "Supervise playground, corridors and common areas during break.",
                Lunch: "Manage canteen queues and outdoor areas during lunch.",
                Prep: "Supervise evening prep sessions in hostel study halls.",
                Evening: "Night watch and boarding house lights-out supervision.",
              };
              return (
                <div key={type} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${TYPE_COLOR[type]}`}>{type}</span>
                    <Badge variant="secondary">{count} assigned</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{SLOT_TIMES[type]}</p>
                  <p className="mt-2 text-sm">{descriptions[type]}</p>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Full week list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-medium">All assignments this week</p>
          <Button size="sm" variant="outline" onClick={() => { window.print(); toast.success("Roster exported"); }}>Export PDF</Button>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Day</TableHead><TableHead>Duty</TableHead><TableHead>Time</TableHead>
            <TableHead>Staff</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Remove</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {DAYS.flatMap((day) => normalizedDuties.filter((d) => d.day === day)).map((d) => (
              <TableRow key={d.id}>
                <TableCell className={d.day === today ? "font-semibold text-primary" : ""}>{d.day}</TableCell>
                <TableCell>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[d.type] ?? "bg-muted text-foreground"}`}>{d.type}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.slot}</TableCell>
                <TableCell className="font-medium">{d.staff}</TableCell>
                <TableCell>{d.location}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate({ id: d.id, staff: d.staff })}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
    </AccessGuard>
  );
}
