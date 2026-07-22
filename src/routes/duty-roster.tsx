import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, Shield, Users, Plus } from "lucide-react";
import { toast } from "sonner";

import { Chip, Button, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx } from "@/lib/utils";

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
  const [tab, setTab] = useState("weekly");
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
          <>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAssignOpen(true)}>Assign duty</Button>
            <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Assign duty</DialogTitle>
              <DialogContent>
              <div className="grid grid-cols-2 gap-3">
                <TextField select label="Day" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value as Day })} fullWidth size="small">
                  {DAYS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </TextField>
                <TextField select label="Duty type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DutyType })} fullWidth size="small">
                  {DUTY_TYPES.map((t) => <MenuItem key={t} value={t}>{t} · {SLOT_TIMES[t]}</MenuItem>)}
                </TextField>
                <TextField
                  label="Primary staff"
                  value={form.staff}
                  onChange={(e) => setForm({ ...form, staff: e.target.value })}
                  placeholder="Staff member name"
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Backup staff"
                  value={form.backupStaff || "__none__"}
                  onChange={(e) => setForm({ ...form, backupStaff: e.target.value === "__none__" ? "" : e.target.value })}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="__none__">None</MenuItem>
                  {STAFF.filter((s) => s !== form.staff).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField select label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} fullWidth size="small">
                  {LOCATIONS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
                <TextField
                  label="Effective date"
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  fullWidth
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField select label="Rotation cycle" value={form.rotationCycle} onChange={(e) => setForm({ ...form, rotationCycle: e.target.value })} fullWidth size="small">
                  {["Weekly", "Fortnightly", "Monthly", "Per term", "Permanent"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField select label="Approval status" value={form.approvalStatus} onChange={(e) => setForm({ ...form, approvalStatus: e.target.value })} fullWidth size="small">
                  {["Draft", "Pending approval", "Approved"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField
                  className="col-span-2"
                  label="Special instructions / notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Check visitor IDs, assist with late bus arrivals"
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                  fullWidth
                  size="small"
                />
                <div className="col-span-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Time slot: <span className="font-medium text-foreground">{SLOT_TIMES[form.type]}</span>
                </div>
              </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setAssignOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={assignDuty} disabled={createMut.isPending}>Assign</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Duties this week" value={normalizedDuties.length} accent="primary" icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="On duty today" value={todayDuties.length} hint={today} accent="success" icon={<Shield className="h-4 w-4" />} />
        <StatCard label="Staff assigned" value={new Set(normalizedDuties.map((d) => d.staff)).size} accent="accent" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Unassigned slots" value={unassignedSlots} accent="warning" icon={<Clock className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="weekly" label="Weekly roster" />
        <Tab value="today" label="Today's duties" />
        <Tab value="bystaff" label="By staff" />
        <Tab value="types" label="Duty types" />
      </Tabs>

      {/* WEEKLY GRID */}
      {tab === "weekly" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
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
        </div>
      )}

      {/* TODAY */}
      {tab === "today" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <p className="text-sm font-medium">{today} — duty schedule</p>
          </div>
          {todayDuties.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No duties assigned for today.</p>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Duty</TableCell><TableCell>Time</TableCell><TableCell>Staff</TableCell>
                <TableCell>Location</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
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
                      <Button size="small" variant="text" color="inherit" onClick={() => toast.success(`Reminder sent to ${d.staff}`)}>Remind</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </div>
      )}

      {/* BY STAFF */}
      {tab === "bystaff" && (
        <div className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Staff</TableCell><TableCell>Total duties</TableCell><TableCell>Days</TableCell>
              <TableCell>Duty types</TableCell><TableCell className="text-right">Action</TableCell>
            </TableRow></TableHead>
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
                      <Button size="small" variant="text" color="inherit" onClick={() => toast.info(`${staff}: ${staffDuties.length} duties this week`)}>Details</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      )}

      {/* DUTY TYPES */}
      {tab === "types" && (
        <div className="rounded-xl border border-border bg-card p-5">
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
                    <Chip size="small" label={`${count} assigned`} sx={badgeSx("secondary")} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{SLOT_TIMES[type]}</p>
                  <p className="mt-2 text-sm">{descriptions[type]}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full week list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-medium">All assignments this week</p>
          <Button size="small" variant="outlined" onClick={() => { window.print(); toast.success("Roster exported"); }}>Export PDF</Button>
        </div>
        <TableContainer>
        <Table>
          <TableHead><TableRow>
            <TableCell>Day</TableCell><TableCell>Duty</TableCell><TableCell>Time</TableCell>
            <TableCell>Staff</TableCell><TableCell>Location</TableCell><TableCell className="text-right">Remove</TableCell>
          </TableRow></TableHead>
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
                  <Button size="small" variant="text" color="inherit" onClick={() => deleteMut.mutate({ id: d.id, staff: d.staff })}>Remove</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </div>
    </div>
    </AccessGuard>
  );
}
