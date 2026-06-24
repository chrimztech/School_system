import { createFileRoute } from "@tanstack/react-router";
import { Bus, Plus, MapPin, Users, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/transport")({
  head: () => ({ meta: [{ title: "Transport - SRMS" }] }),
  component: TransportPage,
});


function extractDriver(description: string | undefined) {
  if (!description) return "Driver pending";
  const line = description.split("\n").find((entry) => entry.startsWith("Driver:"));
  return line ? line.replace("Driver:", "").trim() : "Driver pending";
}

function createInitialForm() {
  return {
    name: "",
    driver: "",
    driverPhone: "",
    plate: "",
    capacity: "45",
    departureTime: "06:15",
    arrivalTime: "07:10",
    stops: "",
    description: "",
    fare: "400",
    insurancePolicyNo: "",
    driverLicenseExpiry: "",
    gpsEnabled: "no",
  };
}

function TransportPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [ridersRoute, setRidersRoute] = useState<any | null>(null);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["transport-routes", schoolId],
    queryFn: () => api.transport.routes(schoolId),
  });

  const { data: enrolments = [] } = useQuery({
    queryKey: ["transport-enrolments", schoolId],
    queryFn: () => api.transport.enrolments(schoolId),
    enabled: !!ridersRoute,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.transport.createRoute(schoolId, data),
    onSuccess: (route: any) => {
      qc.invalidateQueries({ queryKey: ["transport-routes", schoolId] });
      toast.success(`Route "${route.routeName ?? route.name}" added`);
      setForm(createInitialForm());
      setOpen(false);
    },
    onError: () => toast.error("Failed to add route"),
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
    if (!form.name.trim() || !form.plate.trim()) {
      toast.error("Route name and plate number are required");
      return;
    }

    createMutation.mutate({
      routeName: form.name.trim(),
      description: [`Driver: ${form.driver}`, form.description.trim()].filter(Boolean).join("\n"),
      stops: form.stops.trim() || null,
      departureTime: form.departureTime,
      arrivalTime: form.arrivalTime,
      vehicleId: form.plate.trim(),
      capacity: Number(form.capacity) || 45,
      feePerTerm: Number(form.fare) || 400,
      driverPhone: form.driverPhone.trim() || null,
      insurancePolicyNo: form.insurancePolicyNo.trim() || null,
      driverLicenseExpiry: form.driverLicenseExpiry || null,
      gpsEnabled: form.gpsEnabled === "yes",
    });
  };

  const routeList = (routes as any[]).map((route: any) => ({
    ...route,
    name: route.name ?? route.routeName ?? "",
    driver: route.driver ?? route.driverName ?? extractDriver(route.description),
    plate: route.plate ?? route.plateNumber ?? route.vehicleId ?? "",
    fare: Number(route.fare ?? route.feePerTerm ?? 0),
    departureTime: route.departureTime ?? "",
    arrivalTime: route.arrivalTime ?? "",
  }));
  const totalRiders = routeList.reduce((sum: number, route: any) => sum + (route.riders ?? route.currentRiders ?? 0), 0);
  const totalCap = routeList.reduce((sum: number, route: any) => sum + (route.capacity ?? 0), 0);
  const monthly = routeList.reduce((sum: number, route: any) => sum + (route.riders ?? route.currentRiders ?? 0) * route.fare, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Transport"
        description={`${routeList.length} routes serving ${active.name}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Add route</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add bus route</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Route name *</Label>
                  <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Route E · Makeni - Ibex Hill" maxLength={100} />
                </div>
                <div>
                  <Label>Driver</Label>
                  <Input className="mt-1" value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} placeholder="Driver full name" maxLength={100} />
                </div>
                <div>
                  <Label>Driver phone</Label>
                  <Input className="mt-1" value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} placeholder="+260 977 000 000" maxLength={20} />
                </div>
                <div>
                  <Label>Plate no. *</Label>
                  <Input className="mt-1" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="BAF 7890" maxLength={15} />
                </div>
                <div>
                  <Label>Seating capacity</Label>
                  <Input type="number" className="mt-1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} min={1} />
                </div>
                <div>
                  <Label>Departure time</Label>
                  <Input type="time" className="mt-1" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} />
                </div>
                <div>
                  <Label>Arrival time</Label>
                  <Input type="time" className="mt-1" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} />
                </div>
                <div>
                  <Label>Termly fare (K)</Label>
                  <Input type="number" className="mt-1" value={form.fare} onChange={(e) => setForm({ ...form, fare: e.target.value })} min={0} />
                </div>
                <div>
                  <Label>Insurance policy no.</Label>
                  <Input className="mt-1" value={form.insurancePolicyNo} onChange={(e) => setForm({ ...form, insurancePolicyNo: e.target.value })} placeholder="INS-2026-00123" maxLength={50} />
                </div>
                <div>
                  <Label>Driver license expiry</Label>
                  <Input type="date" className="mt-1" value={form.driverLicenseExpiry} onChange={(e) => setForm({ ...form, driverLicenseExpiry: e.target.value })} />
                </div>
                <div>
                  <Label>GPS tracking</Label>
                  <Select value={form.gpsEnabled} onValueChange={(v) => setForm({ ...form, gpsEnabled: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Not installed</SelectItem>
                      <SelectItem value="yes">Enabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Route stops</Label>
                  <Textarea className="mt-1" rows={2} value={form.stops} onChange={(e) => setForm({ ...form, stops: e.target.value })} placeholder="Makeni Mall, Chalala Turnoff, Crossroads, Ibex Hill" />
                </div>
                <div className="col-span-2">
                  <Label>Route notes / special instructions</Label>
                  <Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Use Bus 2 on Mondays; pickup marshal at Crossroads." />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addRoute} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add route
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active routes" value={routeList.length} accent="primary" icon={<Bus className="h-4 w-4" />} />
        <StatCard label="Total riders" value={totalRiders} hint={totalCap > 0 ? `of ${totalCap} seats` : "Rider data pending"} accent="success" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Utilisation" value={totalCap > 0 ? `${Math.round((totalRiders / totalCap) * 100)}%` : "—"} accent="accent" />
        <StatCard label="Monthly revenue" value={`K ${monthly.toLocaleString()}`} accent="warning" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /><span>Loading routes...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {routeList.map((route: any) => {
            const riders = route.riders ?? route.currentRiders ?? 0;
            const cap = route.capacity ?? 1;
            const util = cap > 0 ? Math.round((riders / cap) * 100) : 0;
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
                    <span className="font-medium">{riders} / {cap}</span>
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
                  <Button size="sm" variant="ghost" onClick={() => setRidersRoute(route)}>Riders</Button>
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

      <Dialog open={!!ridersRoute} onOpenChange={(v) => { if (!v) setRidersRoute(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Riders — {ridersRoute?.name}</DialogTitle>
          </DialogHeader>
          {(() => {
            const routeEnrolments = (enrolments as any[]).filter((e: any) => e.routeId === ridersRoute?.id || e.routeName === ridersRoute?.name);
            return routeEnrolments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No riders enrolled on this route.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Stop</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {routeEnrolments.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.studentName ?? e.student}</TableCell>
                      <TableCell>{e.grade ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.stop ?? e.pickupStop ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
