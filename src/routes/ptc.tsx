import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users2, Plus, CalendarClock, Wallet, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Chip, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/ptc")({
  head: () => ({ meta: [{ title: "PTC Committee — SRMS" }] }),
  component: PtcPage,
});

const POSITIONS = ["Chairperson", "Vice Chairperson", "Secretary", "Treasurer", "Member"];
const MEMBER_TYPES = ["PARENT", "TEACHER", "ADMIN"];
const TX_CATEGORIES = ["Fundraiser", "Donation", "Membership dues", "Event costs", "Supplies", "Refreshments", "Other"];

const emptyMemberForm = () => ({
  name: "", position: POSITIONS[4], memberType: MEMBER_TYPES[0], studentName: "",
  email: "", phone: "", termStartDate: new Date().toISOString().slice(0, 10), termEndDate: "",
});

const emptyMeetingForm = (term: string, year: string) => ({
  meetingDate: new Date().toISOString().slice(0, 10), term, academicYear: year,
  agenda: "", attendeesCount: "",
});

const emptyTxForm = () => ({
  date: new Date().toISOString().slice(0, 10), type: "INCOME", category: TX_CATEGORIES[0],
  description: "", amount: "",
});

function MinutesDialog({ schoolId, meeting, canEdit }: { schoolId: string; meeting: any; canEdit: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(meeting.minutes ?? "");
  const [decisions, setDecisions] = useState(meeting.decisions ?? "");

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.ptc.meetings.update(schoolId, meeting.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ptc-meetings", schoolId] });
      toast.success("Minutes saved");
      setOpen(false);
    },
    onError: () => toast.error("Failed to save minutes"),
  });

  if (!canEdit) return null;

  return (
    <>
      <Button size="small" variant="outlined" onClick={() => setOpen(true)}>{meeting.minutes ? "Edit minutes" : "Add minutes"}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Meeting minutes — {meeting.meetingDate}</DialogTitle>
        <DialogContent>
          <div className="grid gap-3">
            <TextField label="Minutes" fullWidth size="small" multiline minRows={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="What was discussed…" slotProps={{ htmlInput: { maxLength: 2000 } }} />
            <TextField label="Decisions / resolutions" fullWidth size="small" multiline minRows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="What was decided…" slotProps={{ htmlInput: { maxLength: 1000 } }} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => updateMutation.mutate({ minutes, decisions, status: "HELD" })} disabled={updateMutation.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function PtcPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const schoolId = active.id;
  const qc = useQueryClient();

  const isParent = user?.role === "parent";
  const canEditCommittee = !!user && ["school_admin", "principal", "deputy_head", "super_admin"].includes(user.role);
  const canEditBudget = canEditCommittee || user?.role === "finance";

  const term = String(active.currentTerm ?? "1");
  const year = String(active.currentYear ?? new Date().getFullYear());

  const [tab, setTab] = useState("members");
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMemberForm());
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState(emptyMeetingForm(term, year));
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState(emptyTxForm());

  // Picker data — only fetched while the dialog is open and the matching seat type is selected.
  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["ptc-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: memberOpen && memberForm.memberType === "PARENT",
  });
  const { data: pickerTeachers = [], isLoading: pickerTeachersLoading } = useQuery({
    queryKey: ["ptc-picker-teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
    enabled: memberOpen && memberForm.memberType === "TEACHER",
  });
  const { data: pickerUsers = [], isLoading: pickerUsersLoading } = useQuery({
    queryKey: ["ptc-picker-users", schoolId],
    queryFn: () => api.users.list(schoolId),
    enabled: memberOpen && memberForm.memberType === "ADMIN",
  });

  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: [s.className || s.grade, s.guardian ? `Guardian: ${s.guardian}` : null].filter(Boolean).join(" · "),
  }));
  const teacherOptions: PersonOption[] = (pickerTeachers as any[]).map((t) => ({
    id: t.id,
    label: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim() || t.id,
    sublabel: t.email,
  }));
  const userOptions: PersonOption[] = (pickerUsers as any[])
    .filter((u) => u.role !== "parent")
    .map((u) => ({ id: u.id, label: u.name, sublabel: u.email }));

  const selectStudentForMember = (option: PersonOption) => {
    const student = (pickerStudents as any[]).find((s) => s.id === option.id);
    if (!student) return;
    setMemberForm((prev) => ({
      ...prev,
      name: student.guardian || prev.name,
      studentName: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
      email: student.guardianEmail || prev.email,
      phone: student.guardianPhone || prev.phone,
    }));
  };

  const selectTeacherForMember = (option: PersonOption) => {
    const teacher = (pickerTeachers as any[]).find((t) => t.id === option.id);
    if (!teacher) return;
    setMemberForm((prev) => ({
      ...prev,
      name: `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim() || prev.name,
      email: teacher.email || prev.email,
      phone: teacher.phone || prev.phone,
    }));
  };

  const selectUserForMember = (option: PersonOption) => {
    const person = (pickerUsers as any[]).find((u) => u.id === option.id);
    if (!person) return;
    setMemberForm((prev) => ({ ...prev, name: person.name || prev.name, email: person.email || prev.email, phone: person.phone || prev.phone }));
  };

  const { data: membersRaw = [], isLoading: membersLoading } = useQuery({
    queryKey: ["ptc-members", schoolId],
    queryFn: () => api.ptc.members.list(schoolId),
  });
  const { data: meetingsRaw = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ["ptc-meetings", schoolId, isParent],
    queryFn: () => api.ptc.meetings.list(schoolId, isParent),
  });
  const { data: txRaw = [], isLoading: txLoading } = useQuery({
    queryKey: ["ptc-transactions", schoolId],
    queryFn: () => api.ptc.transactions.list(schoolId),
    enabled: !isParent,
  });

  const members = membersRaw as any[];
  const meetings = meetingsRaw as any[];
  const transactions = txRaw as any[];

  const createMemberMutation = useMutation({
    mutationFn: (data: any) => api.ptc.members.create(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ptc-members", schoolId] });
      toast.success("Committee member added");
      setMemberForm(emptyMemberForm());
      setMemberOpen(false);
    },
    onError: () => toast.error("Failed to add member"),
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => api.ptc.members.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ptc-members", schoolId] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const createMeetingMutation = useMutation({
    mutationFn: (data: any) => api.ptc.meetings.create(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ptc-meetings", schoolId] });
      toast.success("Meeting scheduled");
      setMeetingForm(emptyMeetingForm(term, year));
      setMeetingOpen(false);
    },
    onError: () => toast.error("Failed to schedule meeting"),
  });

  const publishMeetingMutation = useMutation({
    mutationFn: (id: string) => api.ptc.meetings.publish(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ptc-meetings", schoolId] });
      toast.success("Minutes published — visible to parents");
    },
    onError: () => toast.error("Failed to publish"),
  });

  const createTxMutation = useMutation({
    mutationFn: (data: any) => api.ptc.transactions.create(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ptc-transactions", schoolId] });
      toast.success("Transaction recorded");
      setTxForm(emptyTxForm());
      setTxOpen(false);
    },
    onError: () => toast.error("Failed to record transaction"),
  });

  const addMember = () => {
    if (!memberForm.name.trim()) { toast.error("Member name is required"); return; }
    createMemberMutation.mutate({
      name: memberForm.name.trim(), position: memberForm.position, memberType: memberForm.memberType,
      studentName: memberForm.studentName.trim() || null, email: memberForm.email.trim() || null,
      phone: memberForm.phone.trim() || null, termStartDate: memberForm.termStartDate || null,
      termEndDate: memberForm.termEndDate || null,
    });
  };

  const addMeeting = () => {
    if (!meetingForm.meetingDate) { toast.error("Meeting date is required"); return; }
    createMeetingMutation.mutate({
      meetingDate: meetingForm.meetingDate, term: meetingForm.term, academicYear: meetingForm.academicYear,
      agenda: meetingForm.agenda.trim() || null, attendeesCount: Number(meetingForm.attendeesCount) || 0,
    });
  };

  const addTransaction = () => {
    const amount = Number(txForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    createTxMutation.mutate({
      date: txForm.date, type: txForm.type, category: txForm.category,
      description: txForm.description.trim() || null, amount, recordedBy: user?.name ?? null,
    });
  };

  const activeMembers = members.filter((m) => (m.status ?? "ACTIVE") !== "INACTIVE").length;
  const nextMeeting = meetings
    .filter((m) => m.status === "SCHEDULED")
    .slice()
    .sort((a, b) => (a.meetingDate < b.meetingDate ? -1 : 1))[0];
  const balance = transactions.reduce((sum, t) => sum + (t.type === "EXPENSE" ? -Number(t.amount || 0) : Number(t.amount || 0)), 0);

  return (
    <AccessGuard module="ptc">
      <div className="space-y-6">
        <PageHeader
          title="Parent-Teacher Committee"
          description="Committee membership, meeting minutes, and fundraising/budget tracking."
          actions={
            canEditCommittee ? (
              <>
                <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setMemberOpen(true)}>Add member</Button>
                <Dialog open={memberOpen} onClose={() => setMemberOpen(false)} maxWidth="md" fullWidth>
                  <DialogTitle>Add committee member</DialogTitle>
                  <DialogContent>
                    <div className="grid gap-3">
                      <TextField label="Name *" fullWidth size="small" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="Full name" slotProps={{ htmlInput: { maxLength: 100 } }} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField select label="Position" fullWidth size="small" value={memberForm.position} onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}>
                          {POSITIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        </TextField>
                        <TextField select label="Seat" fullWidth size="small" value={memberForm.memberType} onChange={(e) => setMemberForm({ ...memberForm, memberType: e.target.value })}>
                          {MEMBER_TYPES.map((t) => <MenuItem key={t} value={t}>{t === "PARENT" ? "Parent representative" : t === "TEACHER" ? "Teacher representative" : "School administration"}</MenuItem>)}
                        </TextField>
                      </div>
                      <div>
                        <span className="mb-1 block text-sm font-medium leading-none">Find existing {memberForm.memberType === "PARENT" ? "student" : memberForm.memberType === "TEACHER" ? "teacher" : "staff member"}</span>
                        <div className="mt-1">
                          {memberForm.memberType === "PARENT" ? (
                            <PersonCombobox
                              options={studentOptions}
                              loading={pickerStudentsLoading}
                              placeholder="Search enrolled students…"
                              emptyText="No students found."
                              onSelect={selectStudentForMember}
                            />
                          ) : memberForm.memberType === "TEACHER" ? (
                            <PersonCombobox
                              options={teacherOptions}
                              loading={pickerTeachersLoading}
                              placeholder="Search teaching staff…"
                              emptyText="No teachers found."
                              onSelect={selectTeacherForMember}
                            />
                          ) : (
                            <PersonCombobox
                              options={userOptions}
                              loading={pickerUsersLoading}
                              placeholder="Search school staff…"
                              emptyText="No staff found."
                              onSelect={selectUserForMember}
                            />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Fills in the fields below — you can still edit them afterwards.</p>
                      </div>
                      {memberForm.memberType === "PARENT" && (
                        <TextField label="Child's name" fullWidth size="small" value={memberForm.studentName} onChange={(e) => setMemberForm({ ...memberForm, studentName: e.target.value })} placeholder="Links this parent to their enrolled child" slotProps={{ htmlInput: { maxLength: 100 } }} />
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label="Email" type="email" fullWidth size="small" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
                        <TextField label="Phone" fullWidth size="small" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} placeholder="+260 966 000001" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField type="date" label="Term start" fullWidth size="small" value={memberForm.termStartDate} onChange={(e) => setMemberForm({ ...memberForm, termStartDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField type="date" label="Term end" fullWidth size="small" value={memberForm.termEndDate} onChange={(e) => setMemberForm({ ...memberForm, termEndDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                      </div>
                    </div>
                  </DialogContent>
                  <DialogActions>
                    <Button variant="outlined" color="inherit" onClick={() => setMemberOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={addMember} disabled={createMemberMutation.isPending}>Add member</Button>
                  </DialogActions>
                </Dialog>

                <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setMeetingOpen(true)}>Schedule meeting</Button>
                <Dialog open={meetingOpen} onClose={() => setMeetingOpen(false)} maxWidth="md" fullWidth>
                  <DialogTitle>Schedule PTC meeting</DialogTitle>
                  <DialogContent>
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField type="date" label="Date *" fullWidth size="small" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField type="number" label="Expected attendees" fullWidth size="small" slotProps={{ htmlInput: { min: 0 } }} value={meetingForm.attendeesCount} onChange={(e) => setMeetingForm({ ...meetingForm, attendeesCount: e.target.value })} />
                      </div>
                      <TextField label="Agenda" fullWidth size="small" multiline minRows={4} value={meetingForm.agenda} onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })} placeholder="Items to discuss…" slotProps={{ htmlInput: { maxLength: 1000 } }} />
                    </div>
                  </DialogContent>
                  <DialogActions>
                    <Button variant="outlined" color="inherit" onClick={() => setMeetingOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={addMeeting} disabled={createMeetingMutation.isPending}>Schedule</Button>
                  </DialogActions>
                </Dialog>
              </>
            ) : undefined
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Active members" value={activeMembers} accent="primary" icon={<Users2 className="h-4 w-4" />} />
          <StatCard label="Next meeting" value={nextMeeting?.meetingDate ?? "—"} accent="accent" icon={<CalendarClock className="h-4 w-4" />} />
          {!isParent && (
            <StatCard label="Fund balance" value={`K ${balance.toLocaleString()}`} accent={balance >= 0 ? "success" : "warning"} icon={<Wallet className="h-4 w-4" />} />
          )}
        </div>

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="members" label="Membership" />
          <Tab value="meetings" label="Meetings" />
          {!isParent && <Tab value="budget" label="Budget" />}
        </Tabs>

        {tab === "members" && (
          <Box className="rounded-xl border border-border bg-card shadow-sm">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Seat</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Term</TableCell>
                  <TableCell>Status</TableCell>
                  {canEditCommittee && <TableCell className="w-8" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {membersLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading committee…</TableCell></TableRow>
                ) : members.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No committee members recorded yet.</TableCell></TableRow>
                ) : members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      {m.studentName && <div className="text-xs text-muted-foreground">Parent of {m.studentName}</div>}
                    </TableCell>
                    <TableCell><Chip size="small" label={m.position} sx={badgeSx(m.position === "Chairperson" ? "default" : "secondary")} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.memberType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.email || m.phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.termStartDate ?? "—"}{m.termEndDate ? ` – ${m.termEndDate}` : ""}</TableCell>
                    <TableCell><Chip size="small" label={m.status ?? "ACTIVE"} sx={badgeSx(m.status === "INACTIVE" ? "outline" : "secondary")} /></TableCell>
                    {canEditCommittee && (
                      <TableCell>
                        <Button
                          size="small" variant="text" color="inherit"
                          onClick={() => { if (window.confirm(`Remove ${m.name} from the committee?`)) deleteMemberMutation.mutate(m.id); }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </Box>
        )}

        {tab === "meetings" && (
          <Box className="grid gap-4 lg:grid-cols-2">
            {meetingsLoading ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground lg:col-span-2">Loading meetings…</div>
            ) : meetings.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground lg:col-span-2">No meetings recorded yet.</div>
            ) : meetings.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">PTC Meeting — {m.meetingDate}</p>
                    <p className="text-xs text-muted-foreground">Term {m.term} · {m.academicYear} · {m.attendeesCount || 0} attendees</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.published && <Chip size="small" icon={<CheckCircle2 size={12} />} label="Published" sx={badgeSx("secondary")} />}
                    <Chip size="small" label={m.status} sx={badgeSx(m.status === "HELD" ? "secondary" : m.status === "CANCELLED" ? "outline" : "default")} />
                  </div>
                </div>
                {m.agenda && <p className="text-sm"><span className="font-medium">Agenda: </span>{m.agenda}</p>}
                {m.minutes && <p className="text-sm"><span className="font-medium">Minutes: </span>{m.minutes}</p>}
                {m.decisions && <p className="text-sm"><span className="font-medium">Decisions: </span>{m.decisions}</p>}
                {canEditCommittee && (
                  <div className="flex gap-2 pt-2">
                    <MinutesDialog schoolId={schoolId} meeting={m} canEdit={canEditCommittee} />
                    {!m.published && (
                      <Button size="small" variant="contained" onClick={() => publishMeetingMutation.mutate(m.id)} disabled={publishMeetingMutation.isPending}>
                        Publish to parents
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Box>
        )}

        {!isParent && tab === "budget" && (
          <Box className="space-y-4">
              {canEditBudget && (
                <div className="flex justify-end">
                  <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setTxOpen(true)}>Record transaction</Button>
                  <Dialog open={txOpen} onClose={() => setTxOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Record PTC transaction</DialogTitle>
                    <DialogContent>
                      <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField type="date" label="Date" fullWidth size="small" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                          <TextField select label="Type" fullWidth size="small" value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })}>
                            <MenuItem value="INCOME">Income</MenuItem>
                            <MenuItem value="EXPENSE">Expense</MenuItem>
                          </TextField>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField select label="Category" fullWidth size="small" value={txForm.category} onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}>
                            {TX_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                          </TextField>
                          <TextField type="number" label="Amount (K) *" fullWidth size="small" slotProps={{ htmlInput: { min: 1 } }} value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
                        </div>
                        <TextField label="Description" fullWidth size="small" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="e.g. Term 1 bake sale proceeds" slotProps={{ htmlInput: { maxLength: 200 } }} />
                      </div>
                    </DialogContent>
                    <DialogActions>
                      <Button variant="outlined" color="inherit" onClick={() => setTxOpen(false)}>Cancel</Button>
                      <Button variant="contained" onClick={addTransaction} disabled={createTxMutation.isPending}>Record</Button>
                    </DialogActions>
                  </Dialog>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Recorded by</TableCell>
                      <TableCell className="text-right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {txLoading ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading transactions…</TableCell></TableRow>
                    ) : transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No transactions recorded yet.</TableCell></TableRow>
                    ) : transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground">{t.date}</TableCell>
                        <TableCell><Chip size="small" label={t.category} sx={badgeSx("outline")} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.description || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.recordedBy || "—"}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${t.type === "EXPENSE" ? "text-destructive" : "text-emerald-600"}`}>
                          {t.type === "EXPENSE" ? "-" : "+"}K {Number(t.amount ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              </div>
          </Box>
        )}
      </div>
    </AccessGuard>
  );
}
