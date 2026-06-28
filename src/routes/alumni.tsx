import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Heart, Calendar, Send, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
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
  const donorCount = list.filter((a: any) => a.donor || a.isDonor).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumni Relations"
        description="Old scholars network, giving, mentorship and reunion management."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Newsletter scheduled")}>
              <Send className="mr-2 h-4 w-4" />Send newsletter
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Register alumni</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Register alumni</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First name *</Label>
                      <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Chanda" maxLength={60} />
                    </div>
                    <div>
                      <Label>Last name *</Label>
                      <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Mulenga" maxLength={60} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Admission #</Label>
                      <Input className="mt-1" value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} placeholder="SCH-2020-112" maxLength={30} />
                    </div>
                    <div>
                      <Label>Year of graduation</Label>
                      <Input className="mt-1" type="number" min={1950} max={new Date().getFullYear()} value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>Last grade</Label>
                      <Input className="mt-1" type="number" min={1} max={12} value={form.lastGrade} onChange={(e) => setForm({ ...form, lastGrade: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Current position *</Label>
                      <Input className="mt-1" value={form.currentPosition} onChange={(e) => setForm({ ...form, currentPosition: e.target.value })} placeholder="Software Engineer" maxLength={120} />
                    </div>
                    <div>
                      <Label>Employer</Label>
                      <Input className="mt-1" value={form.currentEmployer} onChange={(e) => setForm({ ...form, currentEmployer: e.target.value })} placeholder="Airtel Zambia" maxLength={120} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input type="email" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alumni@example.com" maxLength={120} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input className="mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" maxLength={30} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Location / city</Label>
                      <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lusaka" maxLength={50} />
                    </div>
                    <div>
                      <Label>Industry sector</Label>
                      <Input className="mt-1" value={form.industrySector} onChange={(e) => setForm({ ...form, industrySector: e.target.value })} placeholder="e.g. ICT, Medicine, Finance" maxLength={80} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Highest qualification</Label>
                      <Input className="mt-1" value={form.highestQualification} onChange={(e) => setForm({ ...form, highestQualification: e.target.value })} placeholder="e.g. BSc Computer Science (UNZA)" maxLength={120} />
                    </div>
                    <div>
                      <Label>Qualifications achieved at school</Label>
                      <Input className="mt-1" value={form.qualificationsAchieved} onChange={(e) => setForm({ ...form, qualificationsAchieved: e.target.value })} placeholder="e.g. ECZ Form 6 · 7 points" maxLength={100} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>LinkedIn profile URL</Label>
                      <Input className="mt-1" value={form.linkedIn} onChange={(e) => setForm({ ...form, linkedIn: e.target.value })} placeholder="linkedin.com/in/..." maxLength={200} />
                    </div>
                    <div>
                      <Label>Engagement status</Label>
                      <Select value={form.engagementStatus} onValueChange={(v) => setForm({ ...form, engagementStatus: v as typeof form.engagementStatus })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Mentor">Mentor</SelectItem>
                          <SelectItem value="Donor">Donor</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Record status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="INACTIVE">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={registerAlumni} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Register
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Alumni on file" value={list.length} hint="On register" accent="primary" icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Active donors" value={donorCount} accent="success" icon={<Heart className="h-4 w-4" />} />
        <StatCard label="Giving this year" value="K 412,500" hint="Bursary fund" accent="accent" />
        <StatCard label="Upcoming events" value={0} accent="warning" icon={<Calendar className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="dir">
        <TabsList>
          <TabsTrigger value="dir">Directory</TabsTrigger>
          <TabsTrigger value="events">Events & reunions</TabsTrigger>
          <TabsTrigger value="giving">Giving</TabsTrigger>
          <TabsTrigger value="mentor">Mentorship</TabsTrigger>
        </TabsList>

        <TabsContent value="dir" className="rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading alumni...</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Class of</TableHead><TableHead>Position</TableHead>
                <TableHead>Employer</TableHead><TableHead>Location</TableHead><TableHead className="text-right">Connect</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {list.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.name} {(a.donor || a.isDonor) && <Badge variant="secondary" className="ml-2 text-success">Donor</Badge>}
                      {a.admissionNumber && <div className="text-xs text-muted-foreground">{a.admissionNumber}</div>}
                    </TableCell>
                    <TableCell>{a.graduationYear ?? a.year}</TableCell>
                    <TableCell className="text-muted-foreground">{a.currentPosition ?? a.career}</TableCell>
                    <TableCell className="text-muted-foreground">{a.employer}</TableCell>
                    <TableCell>{a.location ?? a.city}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toast.success(`Message sent to ${a.name}`)}>Message</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No alumni registered yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="events" className="rounded-xl border border-border bg-card">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>

        <TabsContent value="giving" className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="font-medium text-muted-foreground">No fundraising campaigns created yet</p>
            <p className="text-sm text-muted-foreground">Campaigns will appear here once they are set up.</p>
          </div>
        </TabsContent>

        <TabsContent value="mentor" className="rounded-xl border border-border bg-card p-5">
          <div className="py-12 text-center text-muted-foreground text-sm">No records yet.</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
