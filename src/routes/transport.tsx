import { createFileRoute } from "@tanstack/react-router";
import { Bus, Plus, MapPin, Users, Loader2, Truck, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";

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

        <Tabs defaultValue="routes">
          <TabsList>
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          </TabsList>

          <TabsContent value="routes" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-1 h-4 w-4" />Add route</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader><DialogTitle>Add bus route</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Route name *</Label>
                      <Input className="mt-1" value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} placeholder="Route E · Makeni - Ibex Hill" maxLength={100} />
                    </div>
                    <div className="col-span-2">
                      <Label>Vehicle *</Label>
                      <Select value={routeForm.vehicleId} onValueChange={(v) => setRouteForm({ ...routeForm, vehicleId: v })}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder={(vehicles as any[]).length === 0 ? "No vehicles yet — add one in the Vehicles tab" : "Select a vehicle"} /></SelectTrigger>
                        <SelectContent>
                          {(vehicles as any[]).map((v: any) => (
                            <SelectItem key={v.id} value={v.id}>{v.plateNumber} · {v.driverName || "Driver pending"} ({v.capacity} seats)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Departure time</Label>
                      <Input type="time" className="mt-1" value={routeForm.departureTime} onChange={(e) => setRouteForm({ ...routeForm, departureTime: e.target.value })} />
                    </div>
                    <div>
                      <Label>Arrival time</Label>
                      <Input type="time" className="mt-1" value={routeForm.arrivalTime} onChange={(e) => setRouteForm({ ...routeForm, arrivalTime: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Label>Termly fare (K)</Label>
                      <Input type="number" className="mt-1" value={routeForm.fare} onChange={(e) => setRouteForm({ ...routeForm, fare: e.target.value })} min={0} />
                    </div>
                    <div className="col-span-2">
                      <Label>Route stops</Label>
                      <Textarea className="mt-1" rows={2} value={routeForm.stops} onChange={(e) => setRouteForm({ ...routeForm, stops: e.target.value })} placeholder="Makeni Mall, Chalala Turnoff, Crossroads, Ibex Hill" />
                    </div>
                    <div className="col-span-2">
                      <Label>Route notes / special instructions</Label>
                      <Textarea className="mt-1" rows={2} value={routeForm.description} onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })} placeholder="Pickup marshal waits at Crossroads." />
                    </div>
                  </div>
                  <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => setRouteOpen(false)}>Cancel</Button>
                    <Button onClick={addRoute} disabled={createRouteMutation.isPending}>
                      {createRouteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add route
                    </Button>
                  </DialogFooter>
                </DialogContent>
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
                        <Badge variant="default">Active</Badge>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Capacity</span>
                          <span className="font-medium">{riders} / {route.capacity > 0 ? route.capacity : "—"}</span>
                        </div>
                        <Progress value={util} />
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
                        <Button size="sm" variant="ghost" onClick={() => setRidersRoute(route)}>
                          <Users className="mr-1 h-3.5 w-3.5" />Riders
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
          </TabsContent>

          <TabsContent value="vehicles" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={openAddVehicle}><Plus className="mr-1 h-4 w-4" />Add vehicle</Button>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plate</TableHead>
                      <TableHead>Make / model</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(vehicles as any[]).map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.plateNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>{v.capacity} seats</TableCell>
                        <TableCell className="text-muted-foreground">{v.driverName || "Driver pending"}{v.driverPhone ? ` · ${v.driverPhone}` : ""}</TableCell>
                        <TableCell>
                          <Badge variant={v.status === "ACTIVE" ? "default" : v.status === "MAINTENANCE" ? "secondary" : "outline"}>{v.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEditVehicle(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Remove vehicle ${v.plateNumber} from the fleet?`)) deleteVehicleMutation.mutate(v.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={vehicleOpen} onOpenChange={(v) => { setVehicleOpen(v); if (!v) setEditingVehicle(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingVehicle ? "Edit vehicle" : "Add vehicle"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plate number *</Label>
              <Input className="mt-1" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })} placeholder="BAF 7890" maxLength={15} />
            </div>
            <div>
              <Label>Seating capacity</Label>
              <Input type="number" className="mt-1" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: e.target.value })} min={1} />
            </div>
            <div>
              <Label>Make</Label>
              <Input className="mt-1" value={vehicleForm.make} onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })} placeholder="Toyota" maxLength={50} />
            </div>
            <div>
              <Label>Model</Label>
              <Input className="mt-1" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} placeholder="Coaster" maxLength={50} />
            </div>
            <div>
              <Label>Driver name</Label>
              <Input className="mt-1" value={vehicleForm.driverName} onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })} placeholder="Driver full name" maxLength={100} />
            </div>
            <div>
              <Label>Driver phone</Label>
              <Input className="mt-1" value={vehicleForm.driverPhone} onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })} placeholder="+260 977 000 000" maxLength={20} />
            </div>
            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={vehicleForm.status} onValueChange={(v: any) => setVehicleForm({ ...vehicleForm, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="MAINTENANCE">In maintenance</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setVehicleOpen(false)}>Cancel</Button>
            <Button onClick={saveVehicle} disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}>
              {(createVehicleMutation.isPending || updateVehicleMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVehicle ? "Save changes" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ridersRoute} onOpenChange={(v) => { if (!v) closeRidersDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Riders — {ridersRoute?.name}</DialogTitle>
          </DialogHeader>

          {routeEnrolments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No riders enrolled on this route yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Stop</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {routeEnrolments.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.studentName ?? e.student}</TableCell>
                    <TableCell>{e.grade ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.stop ?? e.pickupStop ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Remove ${e.studentName ?? "this student"} from ${ridersRoute?.name}?`)) removeRiderMutation.mutate(e.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {addRiderOpen ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div>
                <Label>Student</Label>
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
              <div>
                <Label>Pickup stop</Label>
                <Input className="mt-1" value={riderForm.pickupStop} onChange={(e) => setRiderForm({ ...riderForm, pickupStop: e.target.value })} placeholder="Crossroads" maxLength={100} />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAddRiderOpen(false); setRiderForm(createInitialRiderForm()); }}>Cancel</Button>
                <Button size="sm" onClick={addRider} disabled={enrolMutation.isPending}>
                  {enrolMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add rider
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter className="mt-2 sm:justify-start">
              <Button size="sm" onClick={() => setAddRiderOpen(true)}>
                <UserPlus className="mr-1 h-4 w-4" />Add rider
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </AccessGuard>
  );
}
