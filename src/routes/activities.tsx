import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trophy, Users, Star, CalendarDays, Plus, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Chip, IconButton, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { isSchoolLeadershipRole, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx, downloadCsv } from "@/lib/utils";

export const Route = createFileRoute("/activities")({
  head: () => ({ meta: [{ title: "Activities & Clubs - SRMS" }] }),
  component: ActivitiesPage,
});

const CLUB_TYPES = ["CLUB", "ACADEMIC", "CULTURAL", "COMMUNITY", "SPORT"] as const;
const CATEGORIES = ["Academic", "Arts & Culture", "Community Service", "Environmental", "Religious", "STEM", "Debate & Drama", "Other"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function createClubForm() {
  return {
    name: "",
    type: CLUB_TYPES[0] as (typeof CLUB_TYPES)[number],
    category: CATEGORIES[0],
    leader: "",
    meetingDay: DAYS[0],
    meetingTime: "14:30",
    meetingDuration: "60",
    venue: "",
    maxParticipants: "30",
    targetGroup: "",
    description: "",
    budgetAllocated: "",
    membershipFee: "0",
    insuranceRequired: "no",
    startDate: new Date().toISOString().slice(0, 10),
    clubConstitutionRef: "",
  };
}

function buildClubDescription(form: ReturnType<typeof createClubForm>) {
  return form.description.trim();
}

function parseClubDescription(description: string | null | undefined) {
  const meta: Record<string, string> = {};
  for (const line of (description ?? "").split("\n").map((item) => item.trim()).filter(Boolean)) {
    const [label, ...rest] = line.split(":");
    if (!rest.length) continue;
    meta[label.toLowerCase()] = rest.join(":").trim();
  }
  return meta;
}

function ActivitiesPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const { user } = useAuth();
  const canManage = isSchoolLeadershipRole(user?.role);
  const qc = useQueryClient();

  const [clubOpen, setClubOpen] = useState(false);
  const [clubForm, setClubForm] = useState(createClubForm);
  const [tab, setTab] = useState("clubs");
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolClubId, setEnrolClubId] = useState("");
  const [enrolStudent, setEnrolStudent] = useState<PersonOption | null>(null);

  const { data: clubsData = [], isLoading } = useQuery({
    queryKey: ["activities", schoolId],
    queryFn: () => api.activities.list(schoolId),
  });

  const { data: enrolmentsData = [], isLoading: enrolmentsLoading } = useQuery({
    queryKey: ["activities-enrolments", schoolId],
    queryFn: () => api.activities.allEnrolments(schoolId),
  });

  const { data: studentsData = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: enrolOpen,
  });
  const studentOptions: PersonOption[] = (studentsData as any[]).map((s: any) => ({
    id: s.id,
    label: s.name ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
    sublabel: [s.grade ?? s.class ?? s.className, s.admissionNumber].filter(Boolean).join(" · "),
  }));

  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["activities-picker-users", schoolId],
    queryFn: () => api.users.list(schoolId),
    enabled: clubOpen,
  });
  const staffOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));

  const createMutation = useMutation({
    mutationFn: (data: any) => api.activities.create(schoolId, data),
    onSuccess: (club: any) => {
      void qc.invalidateQueries({ queryKey: ["activities", schoolId] });
      toast.success(`${club.name ?? clubForm.name} club created`);
      setClubForm(createClubForm());
      setClubOpen(false);
    },
    onError: () => toast.error("Failed to create club"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.activities.update(schoolId, id, data),
    onSuccess: (updated: any) => {
      void qc.invalidateQueries({ queryKey: ["activities", schoolId] });
      const active = String(updated.status).toUpperCase() === "ACTIVE";
      toast.success(`${updated.name} ${active ? "activated" : "deactivated"}`);
    },
    onError: () => toast.error("Failed to update club status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.activities.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activities", schoolId] });
      toast.success("Club removed");
    },
    onError: () => toast.error("Failed to remove club"),
  });

  const activeEnrolments = (enrolmentsData as any[]).filter((e: any) => e.status !== "WITHDRAWN");
  const enrolmentCountByClub = new Map<string, number>();
  for (const e of activeEnrolments) {
    enrolmentCountByClub.set(e.activityId, (enrolmentCountByClub.get(e.activityId) ?? 0) + 1);
  }

  const clubs = (clubsData as any[]).map((club: any) => {
    const meta = parseClubDescription(club.description);
    return {
      ...club,
      category: meta.category ?? club.category ?? club.type ?? "CLUB",
      leader: club.coordinator ?? club.leader ?? club.patron ?? "",
      meetingDay: club.meetingSchedule ?? club.meetingDay ?? "",
      targetGroup: club.targetGroup ?? meta["target group"] ?? "",
      notes: club.description ?? meta.notes ?? "",
      status: club.status ?? "ACTIVE",
      members: enrolmentCountByClub.get(club.id) ?? 0,
      maxParticipants: club.maxParticipants ?? 0,
    };
  });

  const activeClubs = clubs.filter((club) => String(club.status).toUpperCase() === "ACTIVE");
  const totalMembers = activeEnrolments.length;

  const enrolMutation = useMutation({
    mutationFn: ({ activityId, data }: { activityId: string; data: any }) => api.activities.enrol(schoolId, activityId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activities-enrolments", schoolId] });
      toast.success("Student enrolled");
      setEnrolStudent(null);
      setEnrolClubId("");
      setEnrolOpen(false);
    },
    onError: () => toast.error("Failed to enrol student"),
  });

  const withdrawMutation = useMutation({
    mutationFn: (enrolmentId: string) => api.activities.withdraw(schoolId, enrolmentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["activities-enrolments", schoolId] });
      toast.success("Membership withdrawn");
    },
    onError: () => toast.error("Failed to withdraw membership"),
  });

  const submitEnrolment = () => {
    if (!enrolClubId || !enrolStudent) { toast.error("Select a club and a student"); return; }
    const club = clubs.find((c) => c.id === enrolClubId);
    enrolMutation.mutate({
      activityId: enrolClubId,
      data: { activityName: club?.name, studentId: enrolStudent.id, studentName: enrolStudent.label, grade: enrolStudent.sublabel?.split(" · ")[0] ?? "" },
    });
  };

  const addClub = () => {
    if (!clubForm.name.trim() || !clubForm.leader.trim()) {
      toast.error("Club name and leader are required");
      return;
    }

    createMutation.mutate({
      name: clubForm.name.trim(),
      type: clubForm.type,
      category: clubForm.category,
      description: buildClubDescription(clubForm) || null,
      coordinator: clubForm.leader.trim(),
      meetingSchedule: `${clubForm.meetingDay} at ${clubForm.meetingTime}`,
      meetingDay: clubForm.meetingDay,
      meetingTime: clubForm.meetingTime,
      meetingDuration: Number(clubForm.meetingDuration) || 60,
      venue: clubForm.venue.trim() || "TBD",
      status: "ACTIVE",
      targetGroup: clubForm.targetGroup.trim() || null,
      maxParticipants: Math.max(1, Number(clubForm.maxParticipants) || 30),
      startDate: clubForm.startDate || null,
      budgetAllocated: Number(clubForm.budgetAllocated) || null,
      membershipFee: Number(clubForm.membershipFee) || 0,
      insuranceRequired: clubForm.insuranceRequired === "yes",
      clubConstitutionRef: clubForm.clubConstitutionRef.trim() || null,
    });
  };

  return (
    <AccessGuard module="activities">
      <div className="space-y-6">
      <PageHeader
        title="Activities & Clubs"
        description="Co-curricular clubs, sports teams, memberships, and fixture calendar."
        actions={<Button variant="outlined" onClick={() => { downloadCsv(clubs.map((club) => ({ Name: club.name, Category: club.category, Leader: club.leader, Members: club.members, "Meeting Day": club.meetingDay, Venue: club.venue, Status: club.status })), "activities-report"); toast.success("Activities report exported"); }}>Export report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active clubs" value={activeClubs.length} accent="primary" icon={<Star className="h-4 w-4" />} />
        <StatCard label="Total members" value={totalMembers} hint="Club enrolments" accent="accent" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Sports teams" value="—" hint="Not tracked yet" accent="success" icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Upcoming fixtures" value="—" hint="Not tracked yet" accent="warning" icon={<CalendarDays className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="clubs" label="Clubs & societies" />
        <Tab value="teams" label="Sports teams" />
        <Tab value="membership" label="Membership" />
        <Tab value="fixtures" label="Fixtures" />
      </Tabs>

      {tab === "clubs" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            {canManage && <>
              <Button size="small" startIcon={<Plus size={14} />} onClick={() => setClubOpen(true)}>New club</Button>
              <Dialog open={clubOpen} onClose={() => setClubOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Create club / society</DialogTitle>
                <DialogContent>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Club name *" value={clubForm.name} onChange={(event) => setClubForm({ ...clubForm, name: event.target.value })} placeholder="Robotics Club" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                    <TextField
                      select
                      label="Activity type"
                      value={clubForm.type}
                      onChange={(event) => setClubForm({ ...clubForm, type: event.target.value as (typeof CLUB_TYPES)[number] })}
                      fullWidth
                      size="small"
                    >
                      {CLUB_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                    </TextField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      select
                      label="Category"
                      value={clubForm.category}
                      onChange={(event) => setClubForm({ ...clubForm, category: event.target.value })}
                      fullWidth
                      size="small"
                    >
                      {CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}
                    </TextField>
                    <div>
                      <p className="text-sm font-medium mb-1">Patron / leader *</p>
                      <div className="space-y-1.5">
                        <PersonCombobox
                          options={staffOptions}
                          loading={pickerUsersLoading}
                          placeholder="Search school staff…"
                          emptyText="No staff found."
                          onSelect={(option) => setClubForm((prev) => ({ ...prev, leader: option.label }))}
                        />
                        <TextField value={clubForm.leader} onChange={(event) => setClubForm({ ...clubForm, leader: event.target.value })} placeholder="Mr. Phiri" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField
                      select
                      label="Meeting day"
                      value={clubForm.meetingDay}
                      onChange={(event) => setClubForm({ ...clubForm, meetingDay: event.target.value })}
                      fullWidth
                      size="small"
                    >
                      {DAYS.map((day) => <MenuItem key={day} value={day}>{day}</MenuItem>)}
                    </TextField>
                    <TextField
                      type="time"
                      label="Meeting time"
                      value={clubForm.meetingTime}
                      onChange={(event) => setClubForm({ ...clubForm, meetingTime: event.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField label="Capacity" type="number" slotProps={{ htmlInput: { min: 1 } }} value={clubForm.maxParticipants} onChange={(event) => setClubForm({ ...clubForm, maxParticipants: event.target.value })} placeholder="30" fullWidth size="small" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Venue" value={clubForm.venue} onChange={(event) => setClubForm({ ...clubForm, venue: event.target.value })} placeholder="Room 12 / Science Lab / Chapel" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                    <TextField label="Target group" value={clubForm.targetGroup} onChange={(event) => setClubForm({ ...clubForm, targetGroup: event.target.value })} placeholder="Form 1-3, girls only, open to all" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Meeting duration (mins)" type="number" slotProps={{ htmlInput: { min: 15, max: 240 } }} value={clubForm.meetingDuration} onChange={(event) => setClubForm({ ...clubForm, meetingDuration: event.target.value })} placeholder="60" fullWidth size="small" />
                    <TextField
                      type="date"
                      label="Start date"
                      value={clubForm.startDate}
                      onChange={(event) => setClubForm({ ...clubForm, startDate: event.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField label="Budget allocated (K)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={clubForm.budgetAllocated} onChange={(event) => setClubForm({ ...clubForm, budgetAllocated: event.target.value })} placeholder="2000" fullWidth size="small" />
                    <TextField label="Membership fee (K)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={clubForm.membershipFee} onChange={(event) => setClubForm({ ...clubForm, membershipFee: event.target.value })} placeholder="0" fullWidth size="small" />
                    <TextField
                      select
                      label="Insurance required"
                      value={clubForm.insuranceRequired}
                      onChange={(event) => setClubForm({ ...clubForm, insuranceRequired: event.target.value })}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="no">Not required</MenuItem>
                      <MenuItem value="yes">Yes — cover needed</MenuItem>
                    </TextField>
                  </div>

                  <TextField label="Club constitution / policy ref." value={clubForm.clubConstitutionRef} onChange={(event) => setClubForm({ ...clubForm, clubConstitutionRef: event.target.value })} placeholder="e.g. DOC-CLB-2026-007 or Google Drive link" slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth size="small" />

                  <TextField label="Programme notes" multiline minRows={3} value={clubForm.description} onChange={(event) => setClubForm({ ...clubForm, description: event.target.value })} placeholder="Purpose of the club, showcase goals, weekly agenda, equipment needed, or competition pathway" slotProps={{ htmlInput: { maxLength: 500 } }} fullWidth size="small" />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setClubOpen(false)}>Cancel</Button>
                  <Button
                    onClick={addClub}
                    disabled={createMutation.isPending}
                    startIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                  >
                    Create club
                  </Button>
                </DialogActions>
              </Dialog>
            </>}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading clubs...</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Club</TableCell><TableCell>Category</TableCell><TableCell>Leader</TableCell>
                <TableCell>Members</TableCell><TableCell>Meets</TableCell><TableCell>Venue</TableCell>
                <TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {clubs.map((club) => {
                  const isActive = String(club.status).toUpperCase() === "ACTIVE";
                  return (
                    <TableRow key={club.id} className={!isActive ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium">{club.name}</div>
                        <div className="text-xs text-muted-foreground">{club.targetGroup || `${club.maxParticipants} capacity`}</div>
                      </TableCell>
                      <TableCell><Chip size="small" label={club.category} sx={badgeSx("outline")} /></TableCell>
                      <TableCell className="text-muted-foreground">{club.leader}</TableCell>
                      <TableCell>{club.members}</TableCell>
                      <TableCell>{club.meetingDay}</TableCell>
                      <TableCell>{club.venue}</TableCell>
                      <TableCell>
                        <Chip size="small" label={club.status} sx={badgeSx(isActive ? "default" : "secondary")} />
                      </TableCell>
                      {canManage && <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ height: 28, fontSize: 12 }}
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate({ id: club.id, data: { ...club, status: isActive ? "INACTIVE" : "ACTIVE" } })}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <IconButton
                            aria-label="Remove club"
                            size="small"
                            color="error"
                            disabled={deleteMutation.isPending}
                            onClick={() => { if (window.confirm(`Remove ${club.name}?`)) deleteMutation.mutate(club.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </TableCell>}
                    </TableRow>
                  );
                })}
                {clubs.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No clubs registered yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </div>
      )}

      {tab === "teams" && (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Trophy}
            title="Sports team rosters aren't tracked separately yet"
            description="Manage sports as a club on the Clubs & societies tab for now — team rosters use the same membership tracking."
          />
        </div>
      )}

      {tab === "membership" && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button size="small" startIcon={<UserPlus size={14} />} onClick={() => setEnrolOpen(true)}>Enrol student</Button>
          </div>
          {enrolmentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading memberships...</span>
            </div>
          ) : activeEnrolments.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No memberships recorded yet"
              description="Enrol a student into a club or society to start tracking individual membership."
              action={{ label: "Enrol student", onClick: () => setEnrolOpen(true) }}
            />
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Student</TableCell><TableCell>Club</TableCell><TableCell>Grade</TableCell>
                <TableCell>Enrolled</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {activeEnrolments.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.studentName}</TableCell>
                    <TableCell>{e.activityName}</TableCell>
                    <TableCell>{e.grade || "—"}</TableCell>
                    <TableCell>{e.enrolmentDate}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        disabled={withdrawMutation.isPending}
                        onClick={() => { if (window.confirm(`Withdraw ${e.studentName} from ${e.activityName}?`)) withdrawMutation.mutate(e.id); }}
                      >
                        Withdraw
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}

          <Dialog open={enrolOpen} onClose={() => setEnrolOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Enrol student in a club</DialogTitle>
            <DialogContent>
              <div className="grid gap-3 pt-1">
                <TextField select label="Club / society *" fullWidth size="small" value={enrolClubId} onChange={(e) => setEnrolClubId(e.target.value)}>
                  {activeClubs.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
                <div>
                  <p className="mb-1 text-sm font-medium">Student *</p>
                  <PersonCombobox
                    options={studentOptions}
                    loading={studentsLoading}
                    placeholder="Search students…"
                    emptyText="No students found."
                    onSelect={(option) => setEnrolStudent(option)}
                  />
                  {enrolStudent && <p className="mt-1 text-xs text-muted-foreground">Selected: {enrolStudent.label}</p>}
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={() => setEnrolOpen(false)}>Cancel</Button>
              <Button onClick={submitEnrolment} disabled={enrolMutation.isPending}>Enrol</Button>
            </DialogActions>
          </Dialog>
        </div>
      )}

      {tab === "fixtures" && (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={CalendarDays}
            title="A fixtures calendar isn't tracked here yet"
            description="Use the school Calendar to schedule matches, competitions, and events."
          />
        </div>
      )}
    </div>
    </AccessGuard>
  );
}
