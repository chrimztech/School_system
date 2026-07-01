import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BedDouble, DoorOpen, UserCheck, ClipboardList, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";

export const Route = createFileRoute("/hostel")({
  head: () => ({ meta: [{ title: "Hostel & Boarding — SRMS" }] }),
  component: HostelPage,
});

const LEAVE_TYPES = ["Weekend", "Medical", "Emergency"] as const;
const ROOM_TYPES = ["DORMITORY", "SEMI_PRIVATE", "PRIVATE"];
const GENDERS = ["MALE", "FEMALE", "MIXED"];

function blankRoomForm() {
  return { hostelName: "", roomNumber: "", roomType: "DORMITORY", capacity: "", gender: "MIXED", floor: "" };
}

function blankAllocForm(currentTerm: any, currentYear: any) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    name: "", grade: "", roomId: "", bedNumber: "", term: String(currentTerm),
    academicYear: String(currentYear), feePerTerm: "", checkInDate: today,
    keyIssued: "yes", keyIssuedDate: today, parentalApproval: "yes",
    emergencyContactName: "", emergencyContactPhone: "", medicalNeeds: "", dietaryRequirements: "",
  };
}

function blankLeaveForm() {
  return {
    student: "", type: "Weekend" as typeof LEAVE_TYPES[number],
    from: "", to: "", destination: "", contactAtDestination: "",
    parentApprovalRef: "", transportArrangement: "Self-arranged", guardianPhone: "",
  };
}

function HostelPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [roomOpen, setRoomOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [roomForm, setRoomForm] = useState(blankRoomForm());
  const [allocForm, setAllocForm] = useState(blankAllocForm(active.currentTerm, active.currentYear));
  const [leaveForm, setLeaveForm] = useState(blankLeaveForm());

  // ── Data loading ──────────────────────────────────────────────
  const { data: roomsData = [], isLoading: roomsLoading } = useQuery({
    queryKey: ["hostel-rooms", schoolId],
    queryFn: () => api.hostel.rooms(schoolId),
  });

  const { data: allocData = [], isLoading: allocLoading } = useQuery({
    queryKey: ["hostel-allocations", schoolId],
    queryFn: () => api.hostel.allocations(schoolId),
  });

  const { data: leavesData = [], isLoading: leavesLoading } = useQuery({
    queryKey: ["hostel-leaves", schoolId],
    queryFn: () => api.hostel.leaves(schoolId),
  });

  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["hostel-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: allocOpen || leaveOpen,
  });
  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: s.className || s.grade,
  }));
  const findPickerStudent = (id: string) => (pickerStudents as any[]).find((s) => s.id === id);

  // ── Normalised data ───────────────────────────────────────────
  const rooms = (roomsData as any[]).map((r: any) => ({
    ...r,
    house: r.hostelName ?? "",
    room: r.roomNumber ?? "",
    occupied: r.occupiedBeds ?? 0,
  }));

  const boarders = (allocData as any[]).map((a: any) => ({
    ...a,
    name: a.studentName ?? "",
    house: a.hostelName ?? "",
    room: a.roomNumber ?? "",
    grade: a.grade ?? "",
    statusLabel: (a.signInStatus ?? "IN") === "OUT" ? "Out" : "In",
  }));

  const leaves = (leavesData as any[]);

  // Derive house names from actual rooms so they're never hardcoded
  const HOUSES = [...new Set(rooms.map((r: any) => r.house).filter(Boolean))];

  const capacity = rooms.reduce((s: number, r: any) => s + (r.capacity ?? 0), 0);
  const occupied = rooms.reduce((s: number, r: any) => s + (r.occupied ?? 0), 0);
  const pendingLeaves = leaves.filter((l: any) => l.status === "PENDING").length;

  // ── Mutations ─────────────────────────────────────────────────
  const createRoomMut = useMutation({
    mutationFn: (data: any) => api.hostel.createRoom(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hostel-rooms", schoolId] });
      toast.success("Room created");
      setRoomForm(blankRoomForm());
      setRoomOpen(false);
    },
    onError: () => toast.error("Failed to create room"),
  });

  const deleteRoomMut = useMutation({
    mutationFn: (id: string) => api.hostel.deleteRoom(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hostel-rooms", schoolId] });
      toast.success("Room removed");
    },
    onError: () => toast.error("Failed to remove room"),
  });

  const allocateMut = useMutation({
    mutationFn: (data: any) => api.hostel.allocate(schoolId, data),
    onSuccess: (b: any) => {
      void qc.invalidateQueries({ queryKey: ["hostel-allocations", schoolId] });
      void qc.invalidateQueries({ queryKey: ["hostel-rooms", schoolId] });
      toast.success(`${b.studentName ?? allocForm.name} allocated`);
      setAllocForm(blankAllocForm(active.currentTerm, active.currentYear));
      setAllocOpen(false);
    },
    onError: () => toast.error("Failed to allocate boarder"),
  });

  const vacateMut = useMutation({
    mutationFn: (id: string) => api.hostel.vacate(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hostel-allocations", schoolId] });
      void qc.invalidateQueries({ queryKey: ["hostel-rooms", schoolId] });
      toast.success("Boarder vacated");
    },
    onError: () => toast.error("Failed to vacate boarder"),
  });

  const createLeaveMut = useMutation({
    mutationFn: (data: any) => api.hostel.createLeave(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hostel-leaves", schoolId] });
      toast.success("Leave request submitted");
      setLeaveForm(blankLeaveForm());
      setLeaveOpen(false);
    },
    onError: () => toast.error("Failed to submit leave request"),
  });

  const signInMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.hostel.updateSignIn(schoolId, id, status),
    onSuccess: (_, { status }) => {
      void qc.invalidateQueries({ queryKey: ["hostel-allocations", schoolId] });
      toast.success(status === "OUT" ? "Boarder marked Out" : "Boarder marked In");
    },
    onError: () => toast.error("Failed to update sign-in status"),
  });

  const leaveStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.hostel.updateLeaveStatus(schoolId, id, status),
    onSuccess: (_, { status }) => {
      void qc.invalidateQueries({ queryKey: ["hostel-leaves", schoolId] });
      toast.success(status === "APPROVED" ? "Leave approved · gate pass issued" : "Leave rejected");
    },
    onError: () => toast.error("Failed to update leave status"),
  });

  // ── Submit handlers ───────────────────────────────────────────
  const submitRoom = () => {
    if (!roomForm.hostelName.trim() || !roomForm.roomNumber.trim()) {
      toast.error("House name and room number are required"); return;
    }
    createRoomMut.mutate({
      hostelName: roomForm.hostelName.trim(),
      roomNumber: roomForm.roomNumber.trim(),
      roomType: roomForm.roomType,
      capacity: Number(roomForm.capacity) || 1,
      gender: roomForm.gender,
      floor: roomForm.floor.trim() || null,
      status: "ACTIVE",
    });
  };

  const submitAllocation = () => {
    if (!allocForm.name.trim() || !allocForm.grade.trim()) {
      toast.error("Student name and grade are required"); return;
    }
    if (!allocForm.roomId) { toast.error("Select a room to allocate"); return; }
    const selectedRoom = rooms.find((r: any) => r.id === allocForm.roomId);
    allocateMut.mutate({
      studentName: allocForm.name.trim(),
      grade: allocForm.grade.trim(),
      roomId: selectedRoom?.id ?? null,
      roomNumber: selectedRoom?.room ?? "",
      hostelName: selectedRoom?.house ?? "",
      bedNumber: allocForm.bedNumber.trim() || null,
      term: Number(allocForm.term) || active.currentTerm,
      academicYear: allocForm.academicYear,
      feePerTerm: Number(allocForm.feePerTerm) || 0,
      checkInDate: allocForm.checkInDate,
      keyIssued: allocForm.keyIssued === "yes",
      keyIssuedDate: allocForm.keyIssued === "yes" ? allocForm.keyIssuedDate : null,
      parentalApproval: allocForm.parentalApproval === "yes",
      emergencyContactName: allocForm.emergencyContactName.trim() || null,
      emergencyContactPhone: allocForm.emergencyContactPhone.trim() || null,
      medicalNeeds: allocForm.medicalNeeds.trim() || null,
      dietaryRequirements: allocForm.dietaryRequirements.trim() || null,
    });
  };

  const submitLeave = () => {
    if (!leaveForm.student.trim() || !leaveForm.from || !leaveForm.to) {
      toast.error("Student name and dates are required"); return;
    }
    createLeaveMut.mutate({
      studentName: leaveForm.student.trim(),
      leaveType: leaveForm.type,
      fromDate: leaveForm.from,
      toDate: leaveForm.to,
      destination: leaveForm.destination.trim() || null,
      contactAtDestination: leaveForm.contactAtDestination.trim() || null,
      parentApprovalRef: leaveForm.parentApprovalRef.trim() || null,
      transportArrangement: leaveForm.transportArrangement,
      guardianPhone: leaveForm.guardianPhone.trim() || null,
    });
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <AccessGuard module="hostel">
      <div className="space-y-6">
      <PageHeader
        title="Hostel & Boarding"
        description="House allocation, sign in/out register, leave of absence and prep oversight."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/duty-roster">Duty roster</Link>
            </Button>

            {/* Add room */}
            <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="mr-1 h-4 w-4" />Add room</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Create hostel room</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>House / hostel name *</Label>
                    <Input className="mt-1" value={roomForm.hostelName} onChange={(e) => setRoomForm({ ...roomForm, hostelName: e.target.value })} placeholder="e.g. Kafue House" maxLength={80} />
                  </div>
                  <div>
                    <Label>Room number *</Label>
                    <Input className="mt-1" value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="e.g. K-101" maxLength={20} />
                  </div>
                  <div>
                    <Label>Room type</Label>
                    <Select value={roomForm.roomType} onValueChange={(v) => setRoomForm({ ...roomForm, roomType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={roomForm.gender} onValueChange={(v) => setRoomForm({ ...roomForm, gender: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Capacity (beds)</Label>
                    <Input type="number" min={1} className="mt-1" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} placeholder="6" />
                  </div>
                  <div>
                    <Label>Floor / block</Label>
                    <Input className="mt-1" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} placeholder="Ground floor" maxLength={40} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setRoomOpen(false)}>Cancel</Button>
                  <Button onClick={submitRoom} disabled={createRoomMut.isPending}>
                    {createRoomMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create room
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Allocate boarder */}
            <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Allocate boarder</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader><DialogTitle>Allocate boarder</DialogTitle></DialogHeader>
                {rooms.length === 0 && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No rooms configured. Create rooms first using the "Add room" button.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Find student</Label>
                    <div className="mt-1">
                      <PersonCombobox
                        options={studentOptions}
                        loading={pickerStudentsLoading}
                        placeholder="Search enrolled students…"
                        emptyText="No students found."
                        onSelect={(option) => {
                          const student = findPickerStudent(option.id);
                          if (!student) return;
                          setAllocForm((prev) => ({
                            ...prev,
                            name: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
                            grade: student.className || student.grade || prev.grade,
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Student name *</Label>
                    <Input className="mt-1" value={allocForm.name} onChange={(e) => setAllocForm({ ...allocForm, name: e.target.value })} placeholder="Chanda Mwape" maxLength={100} />
                  </div>
                  <div>
                    <Label>Grade *</Label>
                    <Input className="mt-1" value={allocForm.grade} onChange={(e) => setAllocForm({ ...allocForm, grade: e.target.value })} placeholder="Form 3A" maxLength={30} />
                  </div>
                  <div className="col-span-2">
                    <Label>Room *</Label>
                    <Select value={allocForm.roomId} onValueChange={(v) => setAllocForm({ ...allocForm, roomId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={rooms.length === 0 ? "No rooms — create rooms first" : "Select room"} /></SelectTrigger>
                      <SelectContent>
                        {rooms.map((r: any) => (
                          <SelectItem key={r.id} value={r.id} disabled={r.occupied >= r.capacity}>
                            {r.house} · {r.room} ({r.occupied}/{r.capacity} occupied){r.occupied >= r.capacity ? " — Full" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bed number</Label>
                    <Input className="mt-1" value={allocForm.bedNumber} onChange={(e) => setAllocForm({ ...allocForm, bedNumber: e.target.value })} placeholder="Bed 04" maxLength={20} />
                  </div>
                  <div>
                    <Label>Check-in date</Label>
                    <Input type="date" className="mt-1" value={allocForm.checkInDate} onChange={(e) => setAllocForm({ ...allocForm, checkInDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Input type="number" min={1} max={3} className="mt-1" value={allocForm.term} onChange={(e) => setAllocForm({ ...allocForm, term: e.target.value })} />
                  </div>
                  <div>
                    <Label>Academic year</Label>
                    <Input className="mt-1" value={allocForm.academicYear} onChange={(e) => setAllocForm({ ...allocForm, academicYear: e.target.value })} maxLength={10} />
                  </div>
                  <div>
                    <Label>Fee per term (K)</Label>
                    <Input type="number" min={0} className="mt-1" value={allocForm.feePerTerm} onChange={(e) => setAllocForm({ ...allocForm, feePerTerm: e.target.value })} placeholder="3500" />
                  </div>
                  <div>
                    <Label>Key issued</Label>
                    <Select value={allocForm.keyIssued} onValueChange={(v) => setAllocForm({ ...allocForm, keyIssued: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — key issued</SelectItem>
                        <SelectItem value="no">Not yet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Key issue date</Label>
                    <Input type="date" className="mt-1" value={allocForm.keyIssuedDate} onChange={(e) => setAllocForm({ ...allocForm, keyIssuedDate: e.target.value })} disabled={allocForm.keyIssued !== "yes"} />
                  </div>
                  <div>
                    <Label>Parental approval</Label>
                    <Select value={allocForm.parentalApproval} onValueChange={(v) => setAllocForm({ ...allocForm, parentalApproval: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes — consent received</SelectItem>
                        <SelectItem value="no">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Emergency contact name</Label>
                    <Input className="mt-1" value={allocForm.emergencyContactName} onChange={(e) => setAllocForm({ ...allocForm, emergencyContactName: e.target.value })} placeholder="Parent / guardian" maxLength={100} />
                  </div>
                  <div>
                    <Label>Emergency contact phone</Label>
                    <Input className="mt-1" value={allocForm.emergencyContactPhone} onChange={(e) => setAllocForm({ ...allocForm, emergencyContactPhone: e.target.value })} placeholder="+260 9XX XXX XXX" maxLength={20} />
                  </div>
                  <div>
                    <Label>Medical needs</Label>
                    <Input className="mt-1" value={allocForm.medicalNeeds} onChange={(e) => setAllocForm({ ...allocForm, medicalNeeds: e.target.value })} placeholder="e.g. Asthma inhaler" maxLength={200} />
                  </div>
                  <div>
                    <Label>Dietary requirements</Label>
                    <Input className="mt-1" value={allocForm.dietaryRequirements} onChange={(e) => setAllocForm({ ...allocForm, dietaryRequirements: e.target.value })} placeholder="e.g. Halal, vegetarian" maxLength={100} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setAllocOpen(false)}>Cancel</Button>
                  <Button onClick={submitAllocation} disabled={allocateMut.isPending || rooms.length === 0}>
                    {allocateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Allocate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Occupancy" value={capacity > 0 ? `${occupied}/${capacity}` : boarders.filter((b) => b.statusLabel === "In").length} hint={capacity > 0 ? `${Math.round((occupied / capacity) * 100)}% utilised` : undefined} accent="primary" icon={<BedDouble className="h-4 w-4" />} />
        <StatCard label="Signed in tonight" value={boarders.filter((b) => b.statusLabel === "In").length} accent="success" icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="On leave / out" value={boarders.filter((b) => b.statusLabel === "Out").length} accent="warning" icon={<DoorOpen className="h-4 w-4" />} />
        <StatCard label="Leave requests" value={pendingLeaves} hint={pendingLeaves === 0 ? "None pending" : "Awaiting warden"} accent="accent" icon={<ClipboardList className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="rooms">
        <TabsList>
          <TabsTrigger value="rooms">Rooms & houses</TabsTrigger>
          <TabsTrigger value="register">Sign-in register</TabsTrigger>
          <TabsTrigger value="leave">Leave of absence</TabsTrigger>
          <TabsTrigger value="prep">Evening prep</TabsTrigger>
        </TabsList>

        {/* ROOMS */}
        <TabsContent value="rooms" className="rounded-xl border border-border bg-card">
          {roomsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading rooms…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>House</TableHead><TableHead>Room</TableHead><TableHead>Type</TableHead>
                <TableHead>Gender</TableHead><TableHead>Capacity</TableHead>
                <TableHead>Occupied</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No rooms configured yet. Use <strong>Add room</strong> to create houses and rooms before allocating boarders.
                    </TableCell>
                  </TableRow>
                ) : rooms.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.house}</TableCell>
                    <TableCell>{r.room}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(r.roomType ?? "").replace("_", " ")}</TableCell>
                    <TableCell className="text-xs">{r.gender ?? "—"}</TableCell>
                    <TableCell>{r.capacity ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={r.occupied >= r.capacity ? "outline" : "secondary"}>{r.occupied}/{r.capacity}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (r.occupied > 0) { toast.error("Cannot delete — room has active boarders"); return; } deleteRoomMut.mutate(r.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* REGISTER */}
        <TabsContent value="register" className="rounded-xl border border-border bg-card">
          {allocLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading boarders…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Boarder</TableHead><TableHead>Class</TableHead><TableHead>House</TableHead>
                <TableHead>Room</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {boarders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No boarders allocated yet.</TableCell></TableRow>
                ) : boarders.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.grade}</TableCell>
                    <TableCell>{b.house}</TableCell>
                    <TableCell>{b.room}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={b.statusLabel === "In" ? "text-green-600" : "text-amber-600"}>{b.statusLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={signInMut.isPending}
                        onClick={() => signInMut.mutate({ id: b.id, status: b.statusLabel === "In" ? "OUT" : "IN" })}
                      >
                        Mark {b.statusLabel === "In" ? "Out" : "In"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* LEAVE */}
        <TabsContent value="leave" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />New request</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Submit leave request</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Find student</Label>
                    <div className="mt-1">
                      <PersonCombobox
                        options={studentOptions}
                        loading={pickerStudentsLoading}
                        placeholder="Search enrolled students…"
                        emptyText="No students found."
                        onSelect={(option) => {
                          const student = findPickerStudent(option.id);
                          if (!student) return;
                          setLeaveForm((prev) => ({ ...prev, student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() }));
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Student name *</Label>
                    <Input className="mt-1" value={leaveForm.student} onChange={(e) => setLeaveForm({ ...leaveForm, student: e.target.value })} placeholder="Mwila Chanda" maxLength={100} />
                  </div>
                  <div>
                    <Label>Leave type</Label>
                    <Select value={leaveForm.type} onValueChange={(v) => setLeaveForm({ ...leaveForm, type: v as typeof LEAVE_TYPES[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>From date *</Label>
                    <Input type="date" className="mt-1" value={leaveForm.from} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value })} />
                  </div>
                  <div>
                    <Label>Return date *</Label>
                    <Input type="date" className="mt-1" value={leaveForm.to} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} />
                  </div>
                  <div>
                    <Label>Destination</Label>
                    <Input className="mt-1" value={leaveForm.destination} onChange={(e) => setLeaveForm({ ...leaveForm, destination: e.target.value })} placeholder="e.g. Home (Lusaka), UTH hospital" maxLength={100} />
                  </div>
                  <div>
                    <Label>Contact at destination</Label>
                    <Input className="mt-1" value={leaveForm.contactAtDestination} onChange={(e) => setLeaveForm({ ...leaveForm, contactAtDestination: e.target.value })} placeholder="+260 9XX XXX XXX" maxLength={60} />
                  </div>
                  <div>
                    <Label>Transport arrangement</Label>
                    <Select value={leaveForm.transportArrangement} onValueChange={(v) => setLeaveForm({ ...leaveForm, transportArrangement: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Self-arranged", "Parent pick-up", "School transport", "Public transport"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Guardian phone</Label>
                    <Input className="mt-1" value={leaveForm.guardianPhone} onChange={(e) => setLeaveForm({ ...leaveForm, guardianPhone: e.target.value })} placeholder="+260 9XX XXX XXX" maxLength={20} />
                  </div>
                  <div className="col-span-2">
                    <Label>Parental approval reference</Label>
                    <Input className="mt-1" value={leaveForm.parentApprovalRef} onChange={(e) => setLeaveForm({ ...leaveForm, parentApprovalRef: e.target.value })} placeholder="e.g. WhatsApp message, signed letter ref" maxLength={120} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
                  <Button onClick={submitLeave} disabled={createLeaveMut.isPending}>
                    {createLeaveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {leavesLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading leave requests…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Student</TableHead><TableHead>Type</TableHead>
                <TableHead>From</TableHead><TableHead>Return</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leaves.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No leave requests recorded.</TableCell></TableRow>
                ) : leaves.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.studentName}</TableCell>
                    <TableCell>{l.leaveType}</TableCell>
                    <TableCell className="text-xs">{l.fromDate}</TableCell>
                    <TableCell className="text-xs">{l.toDate}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "APPROVED" ? "default" : l.status === "REJECTED" ? "destructive" : "outline"} className="capitalize">
                        {l.status?.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {l.status === "PENDING" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => leaveStatusMut.mutate({ id: l.id, status: "REJECTED" })}>Reject</Button>
                          <Button size="sm" onClick={() => leaveStatusMut.mutate({ id: l.id, status: "APPROVED" })}>Approve</Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* PREP */}
        <TabsContent value="prep" className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="font-medium text-muted-foreground">Evening prep schedule not configured</p>
            <p className="text-sm text-muted-foreground">Contact your system administrator to set up the prep timetable.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Suppress unused HOUSES variable lint warning — derived but used conditionally */}
      {HOUSES.length === 0 && null}
    </div>
    </AccessGuard>
  );
}
