import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Heart, Calendar, Send, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { Box, Button, Chip, Tab, Tabs, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/alumni")({
  head: () => ({ meta: [{ title: "Alumni - SRMS" }] }),
  component: AlumniPage,
});

function createInitialForm() {
  return {
    firstName: "",
    lastName: "",
    admissionNumber: "",
    graduationYear: new Date().getFullYear() - 1,
    lastGrade: "12",
    currentPosition: "",
    currentEmployer: "",
    industrySector: "",
    highestQualification: "",
    qualificationsAchieved: "",
    email: "",
    phone: "",
    location: "",
    linkedIn: "",
    engagementStatus: "Active" as "Active" | "Mentor" | "Donor" | "Inactive",
    status: "ACTIVE",
  };
}

function AlumniPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [tab, setTab] = useState("dir");

  const { data: alumniList = [], isLoading } = useQuery({
    queryKey: ["alumni", schoolId],
    queryFn: () => api.alumni.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.alumni.create(schoolId, data),
    onSuccess: (alumnus: any) => {
      qc.invalidateQueries({ queryKey: ["alumni", schoolId] });
      toast.success(`${alumnus.firstName ?? form.firstName} ${alumnus.lastName ?? form.lastName} added to the alumni register`);
      setForm(createInitialForm());
      setOpen(false);
    },
    onError: () => toast.error("Failed to register alumni"),
  });

  const registerAlumni = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.currentPosition.trim()) {
      toast.error("First name, last name, and current position are required");
      return;
    }

    createMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      admissionNumber: form.admissionNumber.trim() || null,
      graduationYear: form.graduationYear,
      lastGrade: Number(form.lastGrade) || 12,
      currentPosition: form.currentPosition.trim(),
      currentEmployer: form.currentEmployer.trim(),
      industrySector: form.industrySector.trim() || null,
      highestQualification: form.highestQualification.trim() || null,
      qualificationsAchieved: form.qualificationsAchieved.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      linkedIn: form.linkedIn.trim() || null,
      engagementStatus: form.engagementStatus,
      updatedByUser: true,
      status: form.status,
    });
  };

  const list = (alumniList as any[]).map((alumnus: any) => ({
    ...alumnus,
    name: alumnus.name ?? [alumnus.firstName, alumnus.lastName].filter(Boolean).join(" "),
    employer: alumnus.employer ?? alumnus.currentEmployer ?? "",
    year: alumnus.year ?? alumnus.graduationYear,
  }));
  const donorCount = list.filter((a: any) => a.engagementStatus === "Donor").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumni Relations"
        description="Old scholars network, giving, mentorship and reunion management."
        actions={
          <>
            <Button variant="outlined" component={Link} to="/communication" hash="broadcast" startIcon={<Send className="h-4 w-4" />}>
              Send newsletter
            </Button>
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Register alumni</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
              <DialogTitle>Register alumni</DialogTitle>
              <DialogContent>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="First name *" fullWidth size="small" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Chanda" slotProps={{ htmlInput: { maxLength: 60 } }} />
                    <TextField label="Last name *" fullWidth size="small" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Mulenga" slotProps={{ htmlInput: { maxLength: 60 } }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <TextField label="Admission #" fullWidth size="small" value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} placeholder="SCH-2020-112" slotProps={{ htmlInput: { maxLength: 30 } }} />
                    <TextField label="Year of graduation" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1950, max: new Date().getFullYear() } }} value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: Number(e.target.value) })} />
                    <TextField label="Last grade" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1, max: 12 } }} value={form.lastGrade} onChange={(e) => setForm({ ...form, lastGrade: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Current position *" fullWidth size="small" value={form.currentPosition} onChange={(e) => setForm({ ...form, currentPosition: e.target.value })} placeholder="Software Engineer" slotProps={{ htmlInput: { maxLength: 120 } }} />
                    <TextField label="Employer" fullWidth size="small" value={form.currentEmployer} onChange={(e) => setForm({ ...form, currentEmployer: e.target.value })} placeholder="Airtel Zambia" slotProps={{ htmlInput: { maxLength: 120 } }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Email" type="email" fullWidth size="small" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alumni@example.com" slotProps={{ htmlInput: { maxLength: 120 } }} />
                    <TextField label="Phone" fullWidth size="small" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" slotProps={{ htmlInput: { maxLength: 30 } }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Location / city" fullWidth size="small" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lusaka" slotProps={{ htmlInput: { maxLength: 50 } }} />
                    <TextField label="Industry sector" fullWidth size="small" value={form.industrySector} onChange={(e) => setForm({ ...form, industrySector: e.target.value })} placeholder="e.g. ICT, Medicine, Finance" slotProps={{ htmlInput: { maxLength: 80 } }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Highest qualification" fullWidth size="small" value={form.highestQualification} onChange={(e) => setForm({ ...form, highestQualification: e.target.value })} placeholder="e.g. BSc Computer Science (UNZA)" slotProps={{ htmlInput: { maxLength: 120 } }} />
                    <TextField label="Qualifications achieved at school" fullWidth size="small" value={form.qualificationsAchieved} onChange={(e) => setForm({ ...form, qualificationsAchieved: e.target.value })} placeholder="e.g. ECZ Form 6 · 7 points" slotProps={{ htmlInput: { maxLength: 100 } }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="LinkedIn profile URL" fullWidth size="small" value={form.linkedIn} onChange={(e) => setForm({ ...form, linkedIn: e.target.value })} placeholder="linkedin.com/in/..." slotProps={{ htmlInput: { maxLength: 200 } }} />
                    <TextField select label="Engagement status" fullWidth size="small" value={form.engagementStatus} onChange={(e) => setForm({ ...form, engagementStatus: e.target.value as typeof form.engagementStatus })}>
                      <MenuItem value="Active">Active</MenuItem>
                      <MenuItem value="Mentor">Mentor</MenuItem>
                      <MenuItem value="Donor">Donor</MenuItem>
                      <MenuItem value="Inactive">Inactive</MenuItem>
                    </TextField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField select label="Record status" fullWidth size="small" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <MenuItem value="ACTIVE">Active</MenuItem>
                      <MenuItem value="INACTIVE">Inactive</MenuItem>
                    </TextField>
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={registerAlumni} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register
                </Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Alumni on file" value={list.length} hint="On register" accent="primary" icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Active donors" value={donorCount} accent="success" icon={<Heart className="h-4 w-4" />} />
        <StatCard label="Giving this year" value="—" hint="Not yet tracked" accent="accent" />
        <StatCard label="Upcoming events" value={0} accent="warning" icon={<Calendar className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="dir" label="Directory" />
        <Tab value="events" label="Events & reunions" />
        <Tab value="giving" label="Giving" />
        <Tab value="mentor" label="Mentorship" />
      </Tabs>

      {tab === "dir" && (
        <Box className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading alumni...</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Name</TableCell><TableCell>Class of</TableCell><TableCell>Position</TableCell>
                <TableCell>Employer</TableCell><TableCell>Location</TableCell><TableCell className="text-right">Connect</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {list.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.name} {a.engagementStatus === "Donor" && <Chip size="small" label="Donor" sx={{ ...badgeSx("success"), ml: 1 }} />}
                      {a.admissionNumber && <div className="text-xs text-muted-foreground">{a.admissionNumber}</div>}
                    </TableCell>
                    <TableCell>{a.graduationYear ?? a.year}</TableCell>
                    <TableCell className="text-muted-foreground">{a.currentPosition ?? a.career}</TableCell>
                    <TableCell className="text-muted-foreground">{a.employer}</TableCell>
                    <TableCell>{a.location ?? a.city}</TableCell>
                    <TableCell className="text-right">
                      <Button size="small" variant="text" color="inherit" disabled title="Alumni messaging isn't set up yet">Message</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No alumni registered yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {tab === "events" && (
        <Box className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Calendar}
            title="No events or reunions yet"
            description="Alumni gatherings and reunions you schedule will appear here."
          />
        </Box>
      )}

      {tab === "giving" && (
        <Box className="rounded-xl border border-border bg-card p-6">
          <EmptyState
            title="No fundraising campaigns created yet"
            description="Campaigns will appear here once they are set up."
          />
        </Box>
      )}

      {tab === "mentor" && (
        <Box className="rounded-xl border border-border bg-card p-5">
          <EmptyState
            icon={Heart}
            title="No mentorship pairings yet"
            description="Alumni-to-student mentorship matches will appear here once set up."
          />
        </Box>
      )}
      </Box>
    </div>
  );
}
