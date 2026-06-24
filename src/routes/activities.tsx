import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trophy, Users, Star, CalendarDays, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

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
  const qc = useQueryClient();

  const [clubOpen, setClubOpen] = useState(false);
  const [clubForm, setClubForm] = useState(createClubForm);

  const { data: clubsData = [], isLoading } = useQuery({
    queryKey: ["activities", schoolId],
    queryFn: () => api.activities.list(schoolId),
  });

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
      members: club.members ?? club.memberCount ?? club.maxParticipants ?? 0,
      maxParticipants: club.maxParticipants ?? 0,
    };
  });

  const activeClubs = clubs.filter((club) => String(club.status).toUpperCase() === "ACTIVE");
  const totalMembers = activeClubs.reduce((sum: number, club: any) => sum + (club.members ?? 0), 0);
  const upcomingFixtures = 0;

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
    <div className="space-y-6">
      <PageHeader
        title="Activities & Clubs"
        description="Co-curricular clubs, sports teams, memberships, and fixture calendar."
        actions={<Button variant="outline" onClick={() => toast.success("Activities report exported")}>Export report</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active clubs" value={activeClubs.length} accent="primary" icon={<Star className="h-4 w-4" />} />
        <StatCard label="Total members" value={totalMembers} hint="Club enrolments" accent="accent" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Sports teams" value={0} accent="success" icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Upcoming fixtures" value={upcomingFixtures} accent="warning" icon={<CalendarDays className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubs & societies</TabsTrigger>
          <TabsTrigger value="teams">Sports teams</TabsTrigger>
          <TabsTrigger value="membership">Membership</TabsTrigger>
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
        </TabsList>

        <TabsContent value="clubs" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={clubOpen} onOpenChange={setClubOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />New club</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Create club / society</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Club name *</Label>
                      <Input className="mt-1" value={clubForm.name} onChange={(event) => setClubForm({ ...clubForm, name: event.target.value })} placeholder="Robotics Club" maxLength={80} />
                    </div>
                    <div>
                      <Label>Activity type</Label>
                      <Select value={clubForm.type} onValueChange={(value) => setClubForm({ ...clubForm, type: value as (typeof CLUB_TYPES)[number] })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{CLUB_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Category</Label>
                      <Select value={clubForm.category} onValueChange={(value) => setClubForm({ ...clubForm, category: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Patron / leader *</Label>
                      <Input className="mt-1" value={clubForm.leader} onChange={(event) => setClubForm({ ...clubForm, leader: event.target.value })} placeholder="Mr. Phiri" maxLength={80} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Meeting day</Label>
                      <Select value={clubForm.meetingDay} onValueChange={(value) => setClubForm({ ...clubForm, meetingDay: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{DAYS.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Meeting time</Label>
                      <Input type="time" className="mt-1" value={clubForm.meetingTime} onChange={(event) => setClubForm({ ...clubForm, meetingTime: event.target.value })} />
                    </div>
                    <div>
                      <Label>Capacity</Label>
                      <Input className="mt-1" type="number" min={1} value={clubForm.maxParticipants} onChange={(event) => setClubForm({ ...clubForm, maxParticipants: event.target.value })} placeholder="30" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Venue</Label>
                      <Input className="mt-1" value={clubForm.venue} onChange={(event) => setClubForm({ ...clubForm, venue: event.target.value })} placeholder="Room 12 / Science Lab / Chapel" maxLength={80} />
                    </div>
                    <div>
                      <Label>Target group</Label>
                      <Input className="mt-1" value={clubForm.targetGroup} onChange={(event) => setClubForm({ ...clubForm, targetGroup: event.target.value })} placeholder="Grade 8-10, girls only, open to all" maxLength={100} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Meeting duration (mins)</Label>
                      <Input className="mt-1" type="number" min={15} max={240} value={clubForm.meetingDuration} onChange={(event) => setClubForm({ ...clubForm, meetingDuration: event.target.value })} placeholder="60" />
                    </div>
                    <div>
                      <Label>Start date</Label>
                      <Input type="date" className="mt-1" value={clubForm.startDate} onChange={(event) => setClubForm({ ...clubForm, startDate: event.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Budget allocated (K)</Label>
                      <Input className="mt-1" type="number" min={0} value={clubForm.budgetAllocated} onChange={(event) => setClubForm({ ...clubForm, budgetAllocated: event.target.value })} placeholder="2000" />
                    </div>
                    <div>
                      <Label>Membership fee (K)</Label>
                      <Input className="mt-1" type="number" min={0} value={clubForm.membershipFee} onChange={(event) => setClubForm({ ...clubForm, membershipFee: event.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <Label>Insurance required</Label>
                      <Select value={clubForm.insuranceRequired} onValueChange={(value) => setClubForm({ ...clubForm, insuranceRequired: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">Not required</SelectItem>
                          <SelectItem value="yes">Yes — cover needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Club constitution / policy ref.</Label>
                    <Input className="mt-1" value={clubForm.clubConstitutionRef} onChange={(event) => setClubForm({ ...clubForm, clubConstitutionRef: event.target.value })} placeholder="e.g. DOC-CLB-2026-007 or Google Drive link" maxLength={120} />
                  </div>

                  <div>
                    <Label>Programme notes</Label>
                    <Textarea className="mt-1" rows={3} value={clubForm.description} onChange={(event) => setClubForm({ ...clubForm, description: event.target.value })} placeholder="Purpose of the club, showcase goals, weekly agenda, equipment needed, or competition pathway" maxLength={500} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setClubOpen(false)}>Cancel</Button>
                  <Button onClick={addClub} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create club
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading clubs...</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Club</TableHead><TableHead>Category</TableHead><TableHead>Leader</TableHead>
                <TableHead>Members</TableHead><TableHead>Meets</TableHead><TableHead>Venue</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {clubs.map((club) => {
                  const isActive = String(club.status).toUpperCase() === "ACTIVE";
                  return (
                    <TableRow key={club.id} className={!isActive ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium">{club.name}</div>
                        <div className="text-xs text-muted-foreground">{club.targetGroup || `${club.maxParticipants} capacity`}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{club.category}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{club.leader}</TableCell>
                      <TableCell>{club.members}</TableCell>
                      <TableCell>{club.meetingDay}</TableCell>
                      <TableCell>{club.venue}</TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "secondary"}>{club.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={toggleMutation.isPending}
                            onClick={() => toggleMutation.mutate({ id: club.id, data: { ...club, status: isActive ? "INACTIVE" : "ACTIVE" } })}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => { if (window.confirm(`Remove ${club.name}?`)) deleteMutation.mutate(club.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {clubs.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No clubs registered yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="teams" className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>

        <TabsContent value="membership" className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>

        <TabsContent value="fixtures" className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
