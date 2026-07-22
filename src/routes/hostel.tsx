import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BedDouble, DoorOpen, UserCheck, ClipboardList, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Box, Chip, Button, IconButton, Tab, Tabs, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

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
  const [tab, setTab] = useState("rooms");

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
            <Button variant="outlined" component={Link} to="/duty-roster">Duty roster</Button>

            {/* Add room */}
            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={() => setRoomOpen(true)}>Add room</Button>
            <Dialog open={roomOpen} onClose={() => setRoomOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Create hostel room</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="House / hostel name *" fullWidth size="small" value={roomForm.hostelName} onChange={(e) => setRoomForm({ ...roomForm, hostelName: e.target.value })} placeholder="e.g. Kafue House" slotProps={{ htmlInput: { maxLength: 80 } }} />
                  <TextField label="Room number *" fullWidth size="small" value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="e.g. K-101" slotProps={{ htmlInput: { maxLength: 20 } }} />
                  <TextField select label="Room type" fullWidth size="small" value={roomForm.roomType} onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}>
                    {ROOM_TYPES.map((t) => <MenuItem key={t} value={t}>{t.replace("_", " ")}</MenuItem>)}
                  </TextField>
                  <TextField select label="Gender" fullWidth size="small" value={roomForm.gender} onChange={(e) => setRoomForm({ ...roomForm, gender: e.target.value })}>
                    {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                  <TextField type="number" label="Capacity (beds)" fullWidth size="small" slotProps={{ htmlInput: { min: 1 } }} value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} placeholder="6" />
                  <TextField label="Floor / block" fullWidth size="small" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} placeholder="Ground floor" slotProps={{ htmlInput: { maxLength: 40 } }} />
                </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setRoomOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={submitRoom} disabled={createRoomMut.isPending}>
                  {createRoomMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create room
                </Button>
              </DialogActions>
            </Dialog>

            {/* Allocate boarder */}
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAllocOpen(true)}>Allocate boarder</Button>
            <Dialog open={allocOpen} onClose={() => setAllocOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Allocate boarder</DialogTitle>
              <DialogContent>
                {rooms.length === 0 && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No rooms configured. Create rooms first using the "Add room" button.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <span className="mb-1 block text-sm font-medium leading-none">Find student</span>
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
                            emergencyContactName: student.guardian || student.guardianName || prev.emergencyContactName,
                            emergencyContactPhone: student.guardianPhone || prev.emergencyContactPhone,
                            medicalNeeds: student.medicalConditions || student.allergies || prev.medicalNeeds,
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <TextField label="Student name *" fullWidth size="small" value={allocForm.name} onChange={(e) => setAllocForm({ ...allocForm, name: e.target.value })} placeholder="Chanda Mwape" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField label="Grade *" fullWidth size="small" value={allocForm.grade} onChange={(e) => setAllocForm({ ...allocForm, grade: e.target.value })} placeholder="Form 3A" slotProps={{ htmlInput: { maxLength: 30 } }} />
                  <TextField
                    select
                    label="Room *"
                    fullWidth
                    size="small"
                    className="col-span-2"
                    value={allocForm.roomId}
                    onChange={(e) => setAllocForm({ ...allocForm, roomId: e.target.value })}
                  >
                    <MenuItem value="" disabled>{rooms.length === 0 ? "No rooms — create rooms first" : "Select room"}</MenuItem>
                    {rooms.map((r: any) => (
                      <MenuItem key={r.id} value={r.id} disabled={r.occupied >= r.capacity}>
                        {r.house} · {r.room} ({r.occupied}/{r.capacity} occupied){r.occupied >= r.capacity ? " — Full" : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Bed number" fullWidth size="small" value={allocForm.bedNumber} onChange={(e) => setAllocForm({ ...allocForm, bedNumber: e.target.value })} placeholder="Bed 04" slotProps={{ htmlInput: { maxLength: 20 } }} />
                  <TextField type="date" label="Check-in date" fullWidth size="small" value={allocForm.checkInDate} onChange={(e) => setAllocForm({ ...allocForm, checkInDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="number" label="Term" fullWidth size="small" slotProps={{ htmlInput: { min: 1, max: 3 } }} value={allocForm.term} onChange={(e) => setAllocForm({ ...allocForm, term: e.target.value })} />
                  <TextField label="Academic year" fullWidth size="small" value={allocForm.academicYear} onChange={(e) => setAllocForm({ ...allocForm, academicYear: e.target.value })} slotProps={{ htmlInput: { maxLength: 10 } }} />
                  <TextField type="number" label="Fee per term (K)" fullWidth size="small" slotProps={{ htmlInput: { min: 0 } }} value={allocForm.feePerTerm} onChange={(e) => setAllocForm({ ...allocForm, feePerTerm: e.target.value })} placeholder="3500" />
                  <TextField select label="Key issued" fullWidth size="small" value={allocForm.keyIssued} onChange={(e) => setAllocForm({ ...allocForm, keyIssued: e.target.value })}>
                    <MenuItem value="yes">Yes — key issued</MenuItem>
                    <MenuItem value="no">Not yet</MenuItem>
                  </TextField>
                  <TextField type="date" label="Key issue date" fullWidth size="small" value={allocForm.keyIssuedDate} onChange={(e) => setAllocForm({ ...allocForm, keyIssuedDate: e.target.value })} disabled={allocForm.keyIssued !== "yes"} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField select label="Parental approval" fullWidth size="small" value={allocForm.parentalApproval} onChange={(e) => setAllocForm({ ...allocForm, parentalApproval: e.target.value })}>
                    <MenuItem value="yes">Yes — consent received</MenuItem>
                    <MenuItem value="no">Pending</MenuItem>
                  </TextField>
                  <TextField label="Emergency contact name" fullWidth size="small" value={allocForm.emergencyContactName} onChange={(e) => setAllocForm({ ...allocForm, emergencyContactName: e.target.value })} placeholder="Parent / guardian" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField label="Emergency contact phone" fullWidth size="small" value={allocForm.emergencyContactPhone} onChange={(e) => setAllocForm({ ...allocForm, emergencyContactPhone: e.target.value })} placeholder="+260 9XX XXX XXX" slotProps={{ htmlInput: { maxLength: 20 } }} />
                  <TextField label="Medical needs" fullWidth size="small" value={allocForm.medicalNeeds} onChange={(e) => setAllocForm({ ...allocForm, medicalNeeds: e.target.value })} placeholder="e.g. Asthma inhaler" slotProps={{ htmlInput: { maxLength: 200 } }} />
                  <TextField label="Dietary requirements" fullWidth size="small" value={allocForm.dietaryRequirements} onChange={(e) => setAllocForm({ ...allocForm, dietaryRequirements: e.target.value })} placeholder="e.g. Halal, vegetarian" slotProps={{ htmlInput: { maxLength: 100 } }} />
                </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setAllocOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={submitAllocation} disabled={allocateMut.isPending || rooms.length === 0}>
                  {allocateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Allocate
                </Button>
              </DialogActions>
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

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="rooms" label="Rooms & houses" />
        <Tab value="register" label="Sign-in register" />
        <Tab value="leave" label="Leave of absence" />
        <Tab value="prep" label="Evening prep" />
      </Tabs>

      {/* ROOMS */}
      {tab === "rooms" && (
        <Box className="rounded-xl border border-border bg-card">
          {roomsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading rooms…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>House</TableCell><TableCell>Room</TableCell><TableCell>Type</TableCell>
                <TableCell>Gender</TableCell><TableCell>Capacity</TableCell>
                <TableCell>Occupied</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
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
                      <Chip size="small" label={`${r.occupied}/${r.capacity}`} sx={badgeSx(r.occupied >= r.capacity ? "outline" : "secondary")} />
                    </TableCell>
                    <TableCell className="text-right">
                      <IconButton size="small" aria-label={`Delete room ${r.room}`} className="text-destructive" onClick={() => { if (r.occupied > 0) { toast.error("Cannot delete — room has active boarders"); return; } deleteRoomMut.mutate(r.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* REGISTER */}
      {tab === "register" && (
        <Box className="rounded-xl border border-border bg-card">
          {allocLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading boarders…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Boarder</TableCell><TableCell>Class</TableCell><TableCell>House</TableCell>
                <TableCell>Room</TableCell><TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
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
                      <Chip size="small" label={b.statusLabel} sx={badgeSx(b.statusLabel === "In" ? "success" : "warning")} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="small"
                        variant="text"
                        color="inherit"
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
            </TableContainer>
          )}
        </Box>
      )}

      {/* LEAVE */}
      {tab === "leave" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setLeaveOpen(true)}>New request</Button>
            <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Submit leave request</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <span className="mb-1 block text-sm font-medium leading-none">Find student</span>
                    <div className="mt-1">
                      <PersonCombobox
                        options={studentOptions}
                        loading={pickerStudentsLoading}
                        placeholder="Search enrolled students…"
                        emptyText="No students found."
                        onSelect={(option) => {
                          const student = findPickerStudent(option.id);
                          if (!student) return;
                          setLeaveForm((prev) => ({
                            ...prev,
                            student: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
                            guardianPhone: student.guardianPhone || prev.guardianPhone,
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <TextField label="Student name *" fullWidth size="small" value={leaveForm.student} onChange={(e) => setLeaveForm({ ...leaveForm, student: e.target.value })} placeholder="Mwila Chanda" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField select label="Leave type" fullWidth size="small" value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as typeof LEAVE_TYPES[number] })}>
                    {LEAVE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <TextField type="date" label="From date *" fullWidth size="small" value={leaveForm.from} onChange={(e) => setLeaveForm({ ...leaveForm, from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField type="date" label="Return date *" fullWidth size="small" value={leaveForm.to} onChange={(e) => setLeaveForm({ ...leaveForm, to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Destination" fullWidth size="small" value={leaveForm.destination} onChange={(e) => setLeaveForm({ ...leaveForm, destination: e.target.value })} placeholder="e.g. Home (Lusaka), UTH hospital" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  <TextField label="Contact at destination" fullWidth size="small" value={leaveForm.contactAtDestination} onChange={(e) => setLeaveForm({ ...leaveForm, contactAtDestination: e.target.value })} placeholder="+260 9XX XXX XXX" slotProps={{ htmlInput: { maxLength: 60 } }} />
                  <TextField select label="Transport arrangement" fullWidth size="small" value={leaveForm.transportArrangement} onChange={(e) => setLeaveForm({ ...leaveForm, transportArrangement: e.target.value })}>
                    {["Self-arranged", "Parent pick-up", "School transport", "Public transport"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                  <TextField label="Guardian phone" fullWidth size="small" value={leaveForm.guardianPhone} onChange={(e) => setLeaveForm({ ...leaveForm, guardianPhone: e.target.value })} placeholder="+260 9XX XXX XXX" slotProps={{ htmlInput: { maxLength: 20 } }} />
                  <TextField label="Parental approval reference" fullWidth size="small" className="col-span-2" value={leaveForm.parentApprovalRef} onChange={(e) => setLeaveForm({ ...leaveForm, parentApprovalRef: e.target.value })} placeholder="e.g. WhatsApp message, signed letter ref" slotProps={{ htmlInput: { maxLength: 120 } }} />
                </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setLeaveOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={submitLeave} disabled={createLeaveMut.isPending}>
                  {createLeaveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit request
                </Button>
              </DialogActions>
            </Dialog>
          </div>
          {leavesLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading leave requests…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Student</TableCell><TableCell>Type</TableCell>
                <TableCell>From</TableCell><TableCell>Return</TableCell>
                <TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
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
                      <Chip
                        size="small"
                        label={l.status?.toLowerCase()}
                        sx={{ ...badgeSx(l.status === "APPROVED" ? "default" : l.status === "REJECTED" ? "destructive" : "outline"), textTransform: "capitalize" }}
                      />
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      {l.status === "PENDING" ? (
                        <>
                          <Button size="small" variant="outlined" onClick={() => leaveStatusMut.mutate({ id: l.id, status: "REJECTED" })}>Reject</Button>
                          <Button size="small" variant="contained" onClick={() => leaveStatusMut.mutate({ id: l.id, status: "APPROVED" })}>Approve</Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* PREP */}
      {tab === "prep" && (
        <Box className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="font-medium text-muted-foreground">Evening prep schedule not configured</p>
            <p className="text-sm text-muted-foreground">Contact your system administrator to set up the prep timetable.</p>
          </div>
        </Box>
      )}
      </Box>

      {/* Suppress unused HOUSES variable lint warning — derived but used conditionally */}
      {HOUSES.length === 0 && null}
    </div>
    </AccessGuard>
  );
}
