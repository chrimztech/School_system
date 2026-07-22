import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, Globe2, Users2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/district-management")({
  head: () => ({ meta: [{ title: "District Management — SRMS" }] }),
  component: DistrictManagementPage,
});

function DistrictManagementPage() {
  const { tenants } = useTenant();
  const [showAll, setShowAll] = useState(false);

  const totalStudents = tenants.reduce((s, t) => s + t.totalStudents, 0);
  const activeCount = tenants.filter((t) => ["active", "trial"].includes(t.subscription.status)).length;
  const visibleSchools = showAll ? tenants : tenants.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="District management"
        description="Central oversight for multi-school operations, capacity planning and performance benchmarking."
        actions={<Button variant="contained" onClick={() => toast.success("District roll-up sync queued")}>Sync school data</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active schools" value={activeCount} hint={`${tenants.length} total on platform`} accent="primary" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Total enrollment" value={totalStudents.toLocaleString() || "—"} hint="Across all schools" accent="success" icon={<Users2 className="h-4 w-4" />} />
        <StatCard label="Provinces" value={new Set(tenants.map((t) => t.province)).size} hint="Geographic spread" accent="accent" icon={<Globe2 className="h-4 w-4" />} />
        <StatCard label="School types" value={new Set(tenants.map((t) => t.type)).size} hint="Distinct configurations" accent="warning" icon={<Building2 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Enrollment by school</h2>
              <p className="text-xs text-muted-foreground">Student headcount across the network.</p>
            </div>
            <Chip size="small" label="Live" sx={badgeSx("secondary")} />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenants.map((t) => ({ name: t.shortCode, students: t.totalStudents }))} margin={{ top: 12, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="students" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Network health</h2>
              <p className="text-xs text-muted-foreground">School performance and capacity risk.</p>
            </div>
            <Chip size="small" label="Stable" sx={badgeSx("outline")} />
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="text-sm font-medium text-foreground">Capacity utilization</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">87%</p>
            </div>
            <div className="rounded-xl bg-muted/70 p-4">
              <p className="text-sm font-medium text-foreground">Outstanding school actions</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">5</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">School network overview</h2>
            <p className="text-xs text-muted-foreground">{tenants.length} school{tenants.length !== 1 ? "s" : ""} on the platform.</p>
          </div>
          {tenants.length > 4 && (
            <Button variant="outlined" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `View all ${tenants.length}`}
            </Button>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Province</TableCell>
                <TableCell>Students</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleSchools.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.type}</TableCell>
                  <TableCell>{t.province}</TableCell>
                  <TableCell>{t.totalStudents.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t.subscription.status}
                      sx={badgeSx(t.subscription.status === "active" ? "secondary" : "outline")}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </div>
      </div>
    </div>
  );
}
