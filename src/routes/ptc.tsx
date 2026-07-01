import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users2, Plus, CalendarClock, Wallet, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{meeting.minutes ? "Edit minutes" : "Add minutes"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Meeting minutes — {meeting.meetingDate}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Minutes</Label>
            <Textarea className="mt-1" rows={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="What was discussed…" maxLength={2000} />
          </div>
          <div>
            <Label>Decisions / resolutions</Label>
            <Textarea className="mt-1" rows={3} value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder="What was decided…" maxLength={1000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => updateMutation.mutate({ minutes, decisions, status: "HELD" })} disabled={updateMutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMemberForm());
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState(emptyMeetingForm(term, year));
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState(emptyTxForm());

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
                <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add member</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Add committee member</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <div>
                        <Label>Name *</Label>
                        <Input className="mt-1" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="Full name" maxLength={100} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Position</Label>
                          <Select value={memberForm.position} onValueChange={(v) => setMemberForm({ ...memberForm, position: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Seat</Label>
                          <Select value={memberForm.memberType} onValueChange={(v) => setMemberForm({ ...memberForm, memberType: v })}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>{MEMBER_TYPES.map((t) => <SelectItem key={t} value={t}>{t === "PARENT" ? "Parent representative" : t === "TEACHER" ? "Teacher representative" : "School administration"}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      {memberForm.memberType === "PARENT" && (
                        <div>
                          <Label>Child's name</Label>
                          <Input className="mt-1" value={memberForm.studentName} onChange={(e) => setMemberForm({ ...memberForm, studentName: e.target.value })} placeholder="Links this parent to their enrolled child" maxLength={100} />
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Email</Label>
                          <Input className="mt-1" type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input className="mt-1" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} placeholder="+260 966 000001" />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Term start</Label>
                          <Input type="date" className="mt-1" value={memberForm.termStartDate} onChange={(e) => setMemberForm({ ...memberForm, termStartDate: e.target.value })} />
                        </div>
                        <div>
                          <Label>Term end</Label>
                          <Input type="date" className="mt-1" value={memberForm.termEndDate} onChange={(e) => setMemberForm({ ...memberForm, termEndDate: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMemberOpen(false)}>Cancel</Button>
                      <Button onClick={addMember} disabled={createMemberMutation.isPending}>Add member</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Schedule meeting</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>Schedule PTC meeting</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>Date *</Label>
                          <Input type="date" className="mt-1" value={meetingForm.meetingDate} onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })} />
                        </div>
                        <div>
                          <Label>Expected attendees</Label>
                          <Input type="number" min={0} className="mt-1" value={meetingForm.attendeesCount} onChange={(e) => setMeetingForm({ ...meetingForm, attendeesCount: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label>Agenda</Label>
                        <Textarea className="mt-1" rows={4} value={meetingForm.agenda} onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })} placeholder="Items to discuss…" maxLength={1000} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMeetingOpen(false)}>Cancel</Button>
                      <Button onClick={addMeeting} disabled={createMeetingMutation.isPending}>Schedule</Button>
                    </DialogFooter>
                  </DialogContent>
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

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members">Membership</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            {!isParent && <TabsTrigger value="budget">Budget</TabsTrigger>}
          </TabsList>

          <TabsContent value="members" className="rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  {canEditCommittee && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
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
                    <TableCell><Badge variant={m.position === "Chairperson" ? "default" : "secondary"}>{m.position}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.memberType}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.email || m.phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.termStartDate ?? "—"}{m.termEndDate ? ` – ${m.termEndDate}` : ""}</TableCell>
                    <TableCell><Badge variant={m.status === "INACTIVE" ? "outline" : "secondary"}>{m.status ?? "ACTIVE"}</Badge></TableCell>
                    {canEditCommittee && (
                      <TableCell>
                        <Button
                          size="sm" variant="ghost"
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
          </TabsContent>

          <TabsContent value="meetings" className="grid gap-4 lg:grid-cols-2">
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
                    {m.published && <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3" />Published</Badge>}
                    <Badge variant={m.status === "HELD" ? "secondary" : m.status === "CANCELLED" ? "outline" : "default"}>{m.status}</Badge>
                  </div>
                </div>
                {m.agenda && <p className="text-sm"><span className="font-medium">Agenda: </span>{m.agenda}</p>}
                {m.minutes && <p className="text-sm"><span className="font-medium">Minutes: </span>{m.minutes}</p>}
                {m.decisions && <p className="text-sm"><span className="font-medium">Decisions: </span>{m.decisions}</p>}
                {canEditCommittee && (
                  <div className="flex gap-2 pt-2">
                    <MinutesDialog schoolId={schoolId} meeting={m} canEdit={canEditCommittee} />
                    {!m.published && (
                      <Button size="sm" onClick={() => publishMeetingMutation.mutate(m.id)} disabled={publishMeetingMutation.isPending}>
                        Publish to parents
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          {!isParent && (
            <TabsContent value="budget" className="space-y-4">
              {canEditBudget && (
                <div className="flex justify-end">
                  <Dialog open={txOpen} onOpenChange={setTxOpen}>
                    <DialogTrigger asChild>
                      <Button><Plus className="mr-2 h-4 w-4" /> Record transaction</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader><DialogTitle>Record PTC transaction</DialogTitle></DialogHeader>
                      <div className="grid gap-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label>Date</Label>
                            <Input type="date" className="mt-1" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Select value={txForm.type} onValueChange={(v) => setTxForm({ ...txForm, type: v })}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INCOME">Income</SelectItem>
                                <SelectItem value="EXPENSE">Expense</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label>Category</Label>
                            <Select value={txForm.category} onValueChange={(v) => setTxForm({ ...txForm, category: v })}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>{TX_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Amount (K) *</Label>
                            <Input type="number" min={1} className="mt-1" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
                          </div>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Input className="mt-1" value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} placeholder="e.g. Term 1 bake sale proceeds" maxLength={200} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTxOpen(false)}>Cancel</Button>
                        <Button onClick={addTransaction} disabled={createTxMutation.isPending}>Record</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txLoading ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading transactions…</TableCell></TableRow>
                    ) : transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No transactions recorded yet.</TableCell></TableRow>
                    ) : transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground">{t.date}</TableCell>
                        <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.description || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.recordedBy || "—"}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${t.type === "EXPENSE" ? "text-destructive" : "text-emerald-600"}`}>
                          {t.type === "EXPENSE" ? "-" : "+"}K {Number(t.amount ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AccessGuard>
  );
}
