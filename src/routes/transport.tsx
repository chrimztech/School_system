import { createFileRoute } from "@tanstack/react-router";
import { Bus, Plus, MapPin, Users, Loader2, Truck, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Chip, LinearProgress, Button, IconButton, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/transport")({
  head: () => ({ meta: [{ title: "Transport - SRMS" }] }),
  component: TransportPage,
});

function extractDriver(description: string | undefined) {
  if (!description) return "Driver pending";
  const line = description.split("\n").find((entry) => entry.startsWith("Driver:"));
  return line ? line.replace("Driver:", "").trim() : "Driver pending";
}

function createInitialRouteForm() {
  return {
    name: "",
    vehicleId: "",
    departureTime: "06:15",
    arrivalTime: "07:10",
    stops: "",
    description: "",
    fare: "400",
  };
}

function createInitialVehicleForm() {
  return {
    plateNumber: "",
    make: "",
    model: "",
    capacity: "45",
    driverName: "",
    driverPhone: "",
    status: "ACTIVE" as "ACTIVE" | "MAINTENANCE" | "INACTIVE",
  };
}

function createInitialRiderForm() {
  return { studentId: "", studentName: "", grade: "", pickupStop: "" };
}

function TransportPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();
  const term = String(active.currentTerm ?? "1");
  const year = String(active.currentYear ?? new Date().getFullYear());

  const [routeOpen, setRouteOpen] = useState(false);
  const [routeForm, setRouteForm] = useState(createInitialRouteForm);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleForm, setVehicleForm] = useState(createInitialVehicleForm);
  const [ridersRoute, setRidersRoute] = useState<any | null>(null);
  const [addRiderOpen, setAddRiderOpen] = useState(false);
  const [riderForm, setRiderForm] = useState(createInitialRiderForm);
  const [tab, setTab] = useState("routes");

  const { data: routes = [], isLoading: routesLoading } = useQuery({
    queryKey: ["transport-routes", schoolId],
    queryFn: () => api.transport.routes(schoolId),
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["transport-vehicles", schoolId],
    queryFn: () => api.transport.vehicles(schoolId),
  });

  const { data: enrolments = [] } = useQuery({
    queryKey: ["transport-enrolments", schoolId],
    queryFn: () => api.transport.enrolments(schoolId),
  });

  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["transport-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: addRiderOpen,
  });

  const createRouteMutation = useMutation({
    mutationFn: (data: any) => api.transport.createRoute(schoolId, data),
    onSuccess: (route: any) => {
      qc.invalidateQueries({ queryKey: ["transport-routes", schoolId] });
      toast.success(`Route "${route.routeName ?? route.name}" added`);
      setRouteForm(createInitialRouteForm());
      setRouteOpen(false);
    },
    onError: () => toast.error("Failed to add route"),
  });

  const createVehicleMutation = useMutation({
    mutationFn: (data: any) => api.transport.createVehicle(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-vehicles", schoolId] });
      toast.success("Vehicle added to fleet");
      setVehicleForm(createInitialVehicleForm());
      setVehicleOpen(false);
    },
    onError: () => toast.error("Failed to add vehicle"),
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.transport.updateVehicle(schoolId, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-vehicles", schoolId] });
      toast.success("Vehicle updated");
      setEditingVehicle(null);
      setVehicleForm(createInitialVehicleForm());
      setVehicleOpen(false);
    },
    onError: () => toast.error("Failed to update vehicle"),
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: string) => api.transport.deleteVehicle(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-vehicles", schoolId] });
      toast.success("Vehicle removed");
    },
    onError: () => toast.error("Failed to remove vehicle — it may still be linked to a route"),
  });

  const enrolMutation = useMutation({
    mutationFn: (data: any) => api.transport.enrolStudent(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-enrolments", schoolId] });
      toast.success("Rider added to route");
      setRiderForm(createInitialRiderForm());
      setAddRiderOpen(false);
    },
    onError: () => toast.error("Failed to add rider"),
  });

  const removeRiderMutation = useMutation({
    mutationFn: (id: string) => api.transport.deleteEnrolment(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport-enrolments", schoolId] });
      toast.success("Rider removed from route");
    },
    onError: () => toast.error("Failed to remove rider"),
  });

  if (!active.features.transport) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transport" description="Bus routes and rider management" />
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <Bus className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Transport module is disabled</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enable it from Settings to start managing routes for {active.shortCode}.</p>
        </div>
      </div>
    );
  }

  const addRoute = () => {
    if (!routeForm.name.trim() || !routeForm.vehicleId) {
      toast.error("Route name and vehicle are required");
      return;
    }
    createRouteMutation.mutate({
      routeName: routeForm.name.trim(),
      description: routeForm.description.trim() || null,
      stops: routeForm.stops.trim() || null,
      departureTime: routeForm.departureTime,
      arrivalTime: routeForm.arrivalTime,
      vehicleId: routeForm.vehicleId,
      feePerTerm: Number(routeForm.fare) || 0,
    });
  };

  const openAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm(createInitialVehicleForm());
    setVehicleOpen(true);
  };

  const openEditVehicle = (vehicle: any) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      plateNumber: vehicle.plateNumber ?? "",
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      capacity: String(vehicle.capacity ?? "45"),
      driverName: vehicle.driverName ?? "",
      driverPhone: vehicle.driverPhone ?? "",
      status: vehicle.status ?? "ACTIVE",
    });
    setVehicleOpen(true);
  };

  const saveVehicle = () => {
    if (!vehicleForm.plateNumber.trim()) {
      toast.error("Plate number is required");
      return;
    }
    const payload = {
      plateNumber: vehicleForm.plateNumber.trim(),
      make: vehicleForm.make.trim() || null,
      model: vehicleForm.model.trim() || null,
      capacity: Number(vehicleForm.capacity) || 0,
      driverName: vehicleForm.driverName.trim() || null,
      driverPhone: vehicleForm.driverPhone.trim() || null,
      status: vehicleForm.status,
    };
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data: payload });
    } else {
      createVehicleMutation.mutate(payload);
    }
  };

  const closeRidersDialog = () => {
    setRidersRoute(null);
    setAddRiderOpen(false);
    setRiderForm(createInitialRiderForm());
  };

  const addRider = () => {
    if (!riderForm.studentId || !ridersRoute) {
      toast.error("Select a student to add");
      return;
    }
    enrolMutation.mutate({
      studentId: riderForm.studentId,
      studentName: riderForm.studentName,
      grade: riderForm.grade || null,
      routeId: ridersRoute.id,
      routeName: ridersRoute.name,
      pickupStop: riderForm.pickupStop.trim() || null,
      term,
      academicYear: year,
    });
  };

  const vehicleById = new Map((vehicles as any[]).map((v: any) => [v.id, v]));

  const riderCountByRoute = new Map<string, number>();
  (enrolments as any[]).forEach((e: any) => {
    if (e.status === "INACTIVE") return;
    const key = e.routeId || e.routeName;
    if (!key) return;
    riderCountByRoute.set(key, (riderCountByRoute.get(key) ?? 0) + 1);
  });

  const routeList = (routes as any[]).map((route: any) => {
    const vehicle = vehicleById.get(route.vehicleId);
    return {
      ...route,
      name: route.routeName ?? route.name ?? "",
      driver: vehicle?.driverName ?? extractDriver(route.description),
      plate: vehicle?.plateNumber ?? route.vehicleId ?? "Unassigned",
      capacity: vehicle?.capacity ?? 0,
      fare: Number(route.feePerTerm ?? route.fare ?? 0),
      departureTime: route.departureTime ?? "",
      arrivalTime: route.arrivalTime ?? "",
      riders: riderCountByRoute.get(route.id) ?? riderCountByRoute.get(route.routeName) ?? 0,
    };
  });

  const totalRiders = routeList.reduce((sum: number, route: any) => sum + route.riders, 0);
  const totalCap = routeList.reduce((sum: number, route: any) => sum + route.capacity, 0);
  const monthly = routeList.reduce((sum: number, route: any) => sum + route.riders * route.fare, 0);

  const routeEnrolments = ridersRoute
    ? (enrolments as any[]).filter((e: any) => (e.routeId === ridersRoute.id || e.routeName === ridersRoute.name) && e.status !== "INACTIVE")
    : [];
  const alreadyRidingIds = new Set(routeEnrolments.map((e: any) => e.studentId));
  const studentOptions: PersonOption[] = (pickerStudents as any[])
    .filter((s: any) => !alreadyRidingIds.has(s.id))
    .map((s: any) => ({
      id: s.id,
      label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
      sublabel: s.className || s.grade || undefined,
    }));

  const selectRiderStudent = (option: PersonOption) => {
    const student = (pickerStudents as any[]).find((s: any) => s.id === option.id);
    if (!student) return;
    setRiderForm({
      studentId: student.id,
      studentName: `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim(),
      grade: student.className ?? student.grade ?? "",
      pickupStop: "",
    });
  };

  return (
    <AccessGuard module="transport">
      <div className="space-y-6">
        <PageHeader title="School Transport" description={`${routeList.length} routes serving ${active.name}`} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Active routes" value={routeList.length} accent="primary" icon={<Bus className="h-4 w-4" />} />
          <StatCard label="Total riders" value={totalRiders} hint={totalCap > 0 ? `of ${totalCap} seats` : "Add vehicles to set capacity"} accent="success" icon={<Users className="h-4 w-4" />} />
          <StatCard label="Utilisation" value={totalCap > 0 ? `${Math.round((totalRiders / totalCap) * 100)}%` : "—"} accent="accent" />
          <StatCard label="Monthly revenue" value={`K ${monthly.toLocaleString()}`} accent="warning" />
        </div>

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="routes" label="Routes" />
          <Tab value="vehicles" label="Vehicles" />
        </Tabs>

        {tab === "routes" && (
          <div className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setRouteOpen(true)}>Add route</Button>
              <Dialog open={routeOpen} onClose={() => setRouteOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add bus route</DialogTitle>
                <DialogContent>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Route name *" fullWidth size="small" className="col-span-2" value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} placeholder="Route E · Makeni - Ibex Hill" slotProps={{ htmlInput: { maxLength: 100 } }} />
                    <TextField
                      select
                      label="Vehicle *"
                      fullWidth
                      size="small"
                      className="col-span-2"
                      value={routeForm.vehicleId}
                      onChange={(e) => setRouteForm({ ...routeForm, vehicleId: e.target.value })}
                    >
                      <MenuItem value="" disabled>{(vehicles as any[]).length === 0 ? "No vehicles yet — add one in the Vehicles tab" : "Select a vehicle"}</MenuItem>
                      {(vehicles as any[]).map((v: any) => (
                        <MenuItem key={v.id} value={v.id}>{v.plateNumber} · {v.driverName || "Driver pending"} ({v.capacity} seats)</MenuItem>
                      ))}
                    </TextField>
                    <TextField type="time" label="Departure time" fullWidth size="small" value={routeForm.departureTime} onChange={(e) => setRouteForm({ ...routeForm, departureTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField type="time" label="Arrival time" fullWidth size="small" value={routeForm.arrivalTime} onChange={(e) => setRouteForm({ ...routeForm, arrivalTime: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField type="number" label="Termly fare (K)" fullWidth size="small" className="col-span-2" value={routeForm.fare} onChange={(e) => setRouteForm({ ...routeForm, fare: e.target.value })} slotProps={{ htmlInput: { min: 0 } }} />
                    <TextField label="Route stops" fullWidth size="small" multiline minRows={2} className="col-span-2" value={routeForm.stops} onChange={(e) => setRouteForm({ ...routeForm, stops: e.target.value })} placeholder="Makeni Mall, Chalala Turnoff, Crossroads, Ibex Hill" />
                    <TextField label="Route notes / special instructions" fullWidth size="small" multiline minRows={2} className="col-span-2" value={routeForm.description} onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })} placeholder="Pickup marshal waits at Crossroads." />
                  </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setRouteOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={addRoute} disabled={createRouteMutation.isPending}>
                    {createRouteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add route
                  </Button>
                </DialogActions>
              </Dialog>
            </div>

            {routesLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading routes...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {routeList.map((route: any) => {
                  const riders = route.riders;
                  const cap = route.capacity || 1;
                  const util = route.capacity > 0 ? Math.round((riders / cap) * 100) : 0;
                  return (
                    <div key={route.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-accent-foreground" />
                            <h3 className="text-sm font-semibold">{route.name}</h3>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{route.driver} · {route.plate}</p>
                          {(route.departureTime || route.arrivalTime) && (
                            <p className="mt-1 text-xs text-muted-foreground">{route.departureTime || "--:--"} - {route.arrivalTime || "--:--"}</p>
                          )}
                        </div>
                        <Chip size="small" label="Active" sx={badgeSx("default")} />
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Capacity</span>
                          <span className="font-medium">{riders} / {route.capacity > 0 ? route.capacity : "—"}</span>
                        </div>
                        <LinearProgress variant="determinate" value={util} sx={{ height: 8, borderRadius: 999 }} />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Termly fare</p>
                          <p className="mt-0.5 text-sm font-medium">K {route.fare.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly est.</p>
                          <p className="mt-0.5 text-sm font-medium">K {(riders * route.fare).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="small" variant="text" color="inherit" startIcon={<Users size={14} />} onClick={() => setRidersRoute(route)}>
                          Riders
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {routeList.length === 0 && (
                  <div className="lg:col-span-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
                    <p className="text-sm text-muted-foreground">No routes configured yet. Add the first route using the button above.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "vehicles" && (
          <div className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={openAddVehicle}>Add vehicle</Button>
            </div>

            {vehiclesLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading fleet...</span>
              </div>
            ) : (vehicles as any[]).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No vehicles registered yet. Add a bus before creating routes.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Plate</TableCell>
                      <TableCell>Make / model</TableCell>
                      <TableCell>Capacity</TableCell>
                      <TableCell>Driver</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell className="text-right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(vehicles as any[]).map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.plateNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>{v.capacity} seats</TableCell>
                        <TableCell className="text-muted-foreground">{v.driverName || "Driver pending"}{v.driverPhone ? ` · ${v.driverPhone}` : ""}</TableCell>
                        <TableCell>
                          <Chip size="small" label={v.status} sx={badgeSx(v.status === "ACTIVE" ? "default" : v.status === "MAINTENANCE" ? "secondary" : "outline")} />
                        </TableCell>
                        <TableCell className="text-right">
                          <IconButton size="small" aria-label={`Edit vehicle ${v.plateNumber}`} onClick={() => openEditVehicle(v)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                          <IconButton
                            size="small"
                            aria-label={`Remove vehicle ${v.plateNumber}`}
                            onClick={() => {
                              if (window.confirm(`Remove vehicle ${v.plateNumber} from the fleet?`)) deleteVehicleMutation.mutate(v.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TableContainer>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={vehicleOpen} onClose={() => { setVehicleOpen(false); setEditingVehicle(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVehicle ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
        <DialogContent>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Plate number *" fullWidth size="small" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })} placeholder="BAF 7890" slotProps={{ htmlInput: { maxLength: 15 } }} />
            <TextField type="number" label="Seating capacity" fullWidth size="small" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} slotProps={{ htmlInput: { min: 1 } }} />
            <TextField label="Make" fullWidth size="small" value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} placeholder="Toyota" slotProps={{ htmlInput: { maxLength: 50 } }} />
            <TextField label="Model" fullWidth size="small" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} placeholder="Coaster" slotProps={{ htmlInput: { maxLength: 50 } }} />
            <TextField label="Driver name" fullWidth size="small" value={vehicleForm.driverName} onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })} placeholder="Driver full name" slotProps={{ htmlInput: { maxLength: 100 } }} />
            <TextField label="Driver phone" fullWidth size="small" value={vehicleForm.driverPhone} onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })} placeholder="+260 977 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} />
            <TextField select label="Status" fullWidth size="small" className="col-span-2" value={vehicleForm.status} onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value as any })}>
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="MAINTENANCE">In maintenance</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setVehicleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveVehicle} disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}>
            {(createVehicleMutation.isPending || updateVehicleMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingVehicle ? "Save changes" : "Add vehicle"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!ridersRoute} onClose={closeRidersDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Riders — {ridersRoute?.name}</DialogTitle>
        <DialogContent>
          {routeEnrolments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No riders enrolled on this route yet.</p>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Stop</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {routeEnrolments.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.studentName ?? e.student}</TableCell>
                    <TableCell>{e.grade ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.stop ?? e.pickupStop ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <IconButton
                        size="small"
                        aria-label={`Remove ${e.studentName ?? "this student"} from route`}
                        onClick={() => {
                          if (window.confirm(`Remove ${e.studentName ?? "this student"} from ${ridersRoute?.name}?`)) removeRiderMutation.mutate(e.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}

          {addRiderOpen ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div>
                <span className="mb-1 block text-sm font-medium leading-none">Student</span>
                <div className="mt-1">
                  <PersonCombobox
                    options={studentOptions}
                    loading={pickerStudentsLoading}
                    placeholder="Search enrolled students…"
                    emptyText="No matching students found."
                    onSelect={selectRiderStudent}
                  />
                </div>
              </div>
              {riderForm.studentId && (
                <p className="text-xs text-muted-foreground">Selected: {riderForm.studentName}{riderForm.grade ? ` · ${riderForm.grade}` : ""}</p>
              )}
              <TextField label="Pickup stop" fullWidth size="small" value={riderForm.pickupStop} onChange={(e) => setRiderForm({ ...riderForm, pickupStop: e.target.value })} placeholder="Crossroads" slotProps={{ htmlInput: { maxLength: 100 } }} />
              <div className="flex justify-end gap-2">
                <Button size="small" variant="outlined" onClick={() => { setAddRiderOpen(false); setRiderForm(createInitialRiderForm()); }}>Cancel</Button>
                <Button size="small" variant="contained" onClick={addRider} disabled={enrolMutation.isPending}>
                  {enrolMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add rider
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
        {!addRiderOpen && (
          <DialogActions sx={{ justifyContent: "flex-start" }}>
            <Button size="small" variant="contained" startIcon={<UserPlus size={16} />} onClick={() => setAddRiderOpen(true)}>
              Add rider
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </AccessGuard>
  );
}
