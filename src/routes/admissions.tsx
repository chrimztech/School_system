import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, FileText, School, Send, UserPlus, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { type ApplicantPriority, type ApplicantStage } from "@/lib/enterprise-data";
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

export const Route = createFileRoute("/admissions")({
  head: () => ({ meta: [{ title: "Admissions - SRMS" }] }),
  component: AdmissionsPage,
});

const STAGES: ApplicantStage[] = ["Inquiry", "Assessment", "Offer", "Enrolled"];
const PRIORITIES: ApplicantPriority[] = ["High", "Normal", "Watch"];
const GENDERS = ["Male", "Female"];
const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Aunt", "Uncle", "Grandparent", "Sibling", "Other"];

function createInitialForm() {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    preferredName: "",
    applyingFor: "Form 1",
    dateOfBirth: "",
    gender: "Male",
    nationality: "Zambian",
    birthCertificateNo: "",
    previousSchool: "",
    lastCompletedGrade: "",
    address: "",
    city: "",
    guardianName: "",
    guardianRelationship: "Mother",
    guardianPhone: "",
    guardianAltPhone: "",
    guardianEmail: "",
    guardianOccupation: "",
    guardianWorkplace: "",
    guardianNationalId: "",
    guardianAddress: "",
    emergencyContactName: "",
    emergencyContactRelationship: "Father",
    emergencyContactPhone: "",
    source: "Website",
    priority: "Normal" as ApplicantPriority,
    medicalNotes: "",
    notes: "",
    entranceExamScore: "",
    interviewDate: "",
    interviewResult: "Pending",
    boardingRequired: "no",
    languageAtHome: "",
    siblingsAtSchool: "",
    hearAboutUs: "",
  };
}

function applicantFullName(applicant: Record<string, unknown>) {
  return [applicant.firstName, applicant.middleName, applicant.lastName].filter(Boolean).join(" ");
}

function AdmissionsPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState("pipeline");
  const [open, setOpen] = useState(false);
  const [formTab, setFormTab] = useState("learner");
  const [localStages, setLocalStages] = useState<Record<string, ApplicantStage>>({});
  const [form, setForm] = useState(createInitialForm);

  const { data: applicantsData = [], isLoading } = useQuery({
    queryKey: ["admissions", schoolId],
    queryFn: () => api.admissions.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.admissions.create(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions", schoolId] });
      toast.success(`${form.firstName} ${form.lastName} added to the admissions pipeline`);
      setForm(createInitialForm());
      setFormTab("learner");
      setOpen(false);
      setTab("pipeline");
    },
    onError: () => toast.error("Failed to add applicant"),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.admissions.accept(schoolId, id),
    onSuccess: (applicant: any, id) => {
      qc.invalidateQueries({ queryKey: ["admissions", schoolId] });
      qc.invalidateQueries({ queryKey: ["students", schoolId] });
      setLocalStages((prev) => ({ ...prev, [id]: "Enrolled" }));
      toast.success(
        applicant?.enrolledAdmissionNumber
          ? `Applicant accepted and learner ${applicant.enrolledAdmissionNumber} is ready`
          : "Applicant accepted and learner record is ready",
      );
    },
    onError: () => toast.error("Failed to accept applicant"),
  });

  const rawApplicants = applicantsData as any[];

  function mapStage(applicant: any): ApplicantStage {
    const override = localStages[applicant.id];
    if (override) return override;
    const status = (applicant.status ?? applicant.stage ?? "").toUpperCase();
    if (status === "ACCEPTED") return "Enrolled";
    if (status === "REVIEWING") return "Assessment";
    if (status === "PENDING") return "Inquiry";
    return (applicant.stage ?? "Inquiry") as ApplicantStage;
  }

  const applicants = rawApplicants.map((applicant: any) => ({
    ...applicant,
    id: applicant.id,
    learner: applicantFullName(applicant) || applicant.learnerName || applicant.name || "",
    applyingFor: applicant.applyingForGrade ? `Grade ${applicant.applyingForGrade}` : (applicant.applyingFor ?? applicant.grade ?? ""),
    guardian: applicant.guardianName ?? applicant.guardian ?? "",
    guardianRelationship: applicant.guardianRelationship ?? "",
    contact: applicant.guardianPhone ?? applicant.contact ?? applicant.phone ?? "",
    email: applicant.guardianEmail ?? "",
    source: applicant.source ?? applicant.leadSource ?? "â€”",
    stage: mapStage(applicant),
    priority: (applicant.priority ?? "Normal") as ApplicantPriority,
    studentId: applicant.enrolledStudentId ?? "",
    admissionNumber: applicant.enrolledAdmissionNumber ?? "",
    updatedAt: (applicant.updatedAt ?? applicant.lastUpdated ?? applicant.createdAt ?? "").slice(0, 10),
  }));

  const stageCounts = useMemo(
    () => STAGES.map((stage) => ({ stage, count: applicants.filter((applicant) => applicant.stage === stage).length })),
    [applicants],
  );

  const advanceApplicant = (id: string) => {
    const applicant = applicants.find((item) => item.id === id);
    if (!applicant) return;
    const currentIndex = STAGES.indexOf(applicant.stage);
    const nextStage = STAGES[Math.min(currentIndex + 1, STAGES.length - 1)];
    if (nextStage === applicant.stage) return;
    if (nextStage === "Enrolled") {
      acceptMutation.mutate(id);
    } else {
      setLocalStages((prev) => ({ ...prev, [id]: nextStage }));
      toast.success(`${applicant.learner} moved to ${nextStage}`);
    }
  };

  const addApplicant = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Applicant first and last name are required");
      setFormTab("learner");
      return;
    }
    if (!form.guardianName.trim() || !form.guardianPhone.trim()) {
      toast.error("Parent / guardian name and phone are required");
      setFormTab("parent");
      return;
    }

    const gradeNum = parseInt(form.applyingFor.replace(/\D/g, ""), 10) || 1;
    createMutation.mutate({
      ...form,
      applyingForGrade: gradeNum,
      submittedDate: new Date().toISOString().slice(0, 10),
      status: "PENDING",
    });
  };

  const offers = applicants.filter((applicant) => applicant.stage === "Offer" || applicant.stage === "Enrolled");
  const followUps = applicants.filter((applicant) => applicant.stage !== "Enrolled").slice(0, 5);
  const conversionRate = applicants.length === 0
    ? 0
    : Math.round((applicants.filter((applicant) => applicant.stage === "Enrolled").length / applicants.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions Hub"
        description="Manage applicant flow, offers, and the final handoff into active learner records."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Applicant import template downloaded")}>
              <Download className="mr-2 h-4 w-4" />Import leads
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-2 h-4 w-4" />New applicant</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-4xl">
                <DialogHeader><DialogTitle>Add applicant</DialogTitle></DialogHeader>
                <div className="overflow-y-auto flex-1 pr-1">
                <Tabs value={formTab} onValueChange={setFormTab} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="learner">Learner profile</TabsTrigger>
                    <TabsTrigger value="parent">Parent / guardian</TabsTrigger>
                    <TabsTrigger value="intake">Intake notes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="learner" className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First name *</Label>
                      <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Mwaka" />
                    </div>
                    <div>
                      <Label>Middle name</Label>
                      <Input className="mt-1" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} placeholder="Chipo" />
                    </div>
                    <div>
                      <Label>Last name *</Label>
                      <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Tembo" />
                    </div>
                    <div>
                      <Label>Preferred name</Label>
                      <Input className="mt-1" value={form.preferredName} onChange={(e) => setForm({ ...form, preferredName: e.target.value })} placeholder="Mwa" />
                    </div>
                    <div>
                      <Label>Applying for</Label>
                      <Select value={form.applyingFor} onValueChange={(value) => setForm({ ...form, applyingFor: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Grade 1", "Grade 4", "Grade 6", "Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6"].map((grade) => (
                            <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Last completed grade</Label>
                      <Input className="mt-1" value={form.lastCompletedGrade} onChange={(e) => setForm({ ...form, lastCompletedGrade: e.target.value })} placeholder="Grade 6 / Form 4" />
                    </div>
                    <div>
                      <Label>Date of birth</Label>
                      <Input type="date" className="mt-1" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Select value={form.gender} onValueChange={(value) => setForm({ ...form, gender: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{GENDERS.map((gender) => <SelectItem key={gender} value={gender}>{gender}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Nationality</Label>
                      <Input className="mt-1" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="Zambian" />
                    </div>
                    <div>
                      <Label>Birth certificate no.</Label>
                      <Input className="mt-1" value={form.birthCertificateNo} onChange={(e) => setForm({ ...form, birthCertificateNo: e.target.value })} placeholder="BC-2020-00981" />
                    </div>
                    <div>
                      <Label>Previous school</Label>
                      <Input className="mt-1" value={form.previousSchool} onChange={(e) => setForm({ ...form, previousSchool: e.target.value })} placeholder="Kabulonga Basic School" />
                    </div>
                    <div>
                      <Label>Town / city</Label>
                      <Input className="mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lusaka" />
                    </div>
                    <div className="col-span-2">
                      <Label>Residential address</Label>
                      <Textarea className="mt-1 min-h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Plot 88, Meanwood, Lusaka" />
                    </div>
                  </TabsContent>

                  <TabsContent value="parent" className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Primary parent / guardian *</Label>
                      <Input className="mt-1" value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} placeholder="Joseph Tembo" />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Select value={form.guardianRelationship} onValueChange={(value) => setForm({ ...form, guardianRelationship: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{RELATIONSHIPS.map((relationship) => <SelectItem key={relationship} value={relationship}>{relationship}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Primary phone *</Label>
                      <Input className="mt-1" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} placeholder="+260 977 000 000" />
                    </div>
                    <div>
                      <Label>Alternate phone</Label>
                      <Input className="mt-1" value={form.guardianAltPhone} onChange={(e) => setForm({ ...form, guardianAltPhone: e.target.value })} placeholder="+260 966 000 000" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" className="mt-1" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} placeholder="guardian@example.com" />
                    </div>
                    <div>
                      <Label>Occupation</Label>
                      <Input className="mt-1" value={form.guardianOccupation} onChange={(e) => setForm({ ...form, guardianOccupation: e.target.value })} placeholder="Accountant" />
                    </div>
                    <div>
                      <Label>Workplace</Label>
                      <Input className="mt-1" value={form.guardianWorkplace} onChange={(e) => setForm({ ...form, guardianWorkplace: e.target.value })} placeholder="ZESCO" />
                    </div>
                    <div>
                      <Label>National ID / NRC</Label>
                      <Input className="mt-1" value={form.guardianNationalId} onChange={(e) => setForm({ ...form, guardianNationalId: e.target.value })} placeholder="123456/78/1" />
                    </div>
                    <div className="col-span-2">
                      <Label>Guardian address</Label>
                      <Textarea className="mt-1 min-h-20" value={form.guardianAddress} onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })} placeholder="House 22, Olympia Park, Lusaka" />
                    </div>
                    <div>
                      <Label>Emergency contact</Label>
                      <Input className="mt-1" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Mary Tembo" />
                    </div>
                    <div>
                      <Label>Emergency relationship</Label>
                      <Select value={form.emergencyContactRelationship} onValueChange={(value) => setForm({ ...form, emergencyContactRelationship: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{RELATIONSHIPS.map((relationship) => <SelectItem key={relationship} value={relationship}>{relationship}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Emergency phone</Label>
                      <Input className="mt-1" value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+260 955 000 000" />
                    </div>
                  </TabsContent>

                  <TabsContent value="intake" className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Lead source</Label>
                      <Input className="mt-1" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Website" />
                    </div>
                    <div>
                      <Label>How did they hear about us?</Label>
                      <Input className="mt-1" value={form.hearAboutUs} onChange={(e) => setForm({ ...form, hearAboutUs: e.target.value })} placeholder="e.g. Referral, social media, church" maxLength={100} />
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as ApplicantPriority })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Boarding required</Label>
                      <Select value={form.boardingRequired} onValueChange={(v) => setForm({ ...form, boardingRequired: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">Day scholar</SelectItem>
                          <SelectItem value="yes">Boarding required</SelectItem>
                          <SelectItem value="maybe">Undecided</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Entrance exam score</Label>
                      <Input className="mt-1" type="number" min={0} max={100} value={form.entranceExamScore} onChange={(e) => setForm({ ...form, entranceExamScore: e.target.value })} placeholder="e.g. 78" />
                    </div>
                    <div>
                      <Label>Interview date</Label>
                      <Input type="date" className="mt-1" value={form.interviewDate} onChange={(e) => setForm({ ...form, interviewDate: e.target.value })} />
                    </div>
                    <div>
                      <Label>Interview result</Label>
                      <Select value={form.interviewResult} onValueChange={(v) => setForm({ ...form, interviewResult: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Pass">Pass</SelectItem>
                          <SelectItem value="Conditional pass">Conditional pass</SelectItem>
                          <SelectItem value="Deferred">Deferred</SelectItem>
                          <SelectItem value="Declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Primary language at home</Label>
                      <Input className="mt-1" value={form.languageAtHome} onChange={(e) => setForm({ ...form, languageAtHome: e.target.value })} placeholder="e.g. English, Bemba, Nyanja" maxLength={60} />
                    </div>
                    <div className="col-span-2">
                      <Label>Siblings currently at school</Label>
                      <Input className="mt-1" value={form.siblingsAtSchool} onChange={(e) => setForm({ ...form, siblingsAtSchool: e.target.value })} placeholder="e.g. Chanda Tembo — Grade 10A" maxLength={120} />
                    </div>
                    <div className="col-span-2">
                      <Label>Medical or support notes</Label>
                      <Textarea className="mt-1 min-h-20" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} placeholder="Allergies, learning support, medical alerts, dietary needs, accommodations" />
                    </div>
                    <div className="col-span-2">
                      <Label>Admissions notes</Label>
                      <Textarea className="mt-1 min-h-20" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Interview notes, fee discussions, scholarship eligibility, follow-up context" />
                    </div>
                  </TabsContent>
                </Tabs>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={addApplicant} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add applicant
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applicants this term" value={applicants.length} accent="primary" icon={<School className="h-4 w-4" />} />
        <StatCard label="Assessments pending" value={stageCounts.find((item) => item.stage === "Assessment")?.count ?? 0} accent="warning" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Offers out" value={stageCounts.find((item) => item.stage === "Offer")?.count ?? 0} accent="accent" icon={<Send className="h-4 w-4" />} />
        <StatCard label="Conversion rate" value={`${conversionRate}%`} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /><span>Loading applicants...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Applying for</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicants.map((applicant) => (
                    <TableRow key={applicant.id}>
                      <TableCell>
                        <div className="font-medium">{applicant.learner}</div>
                        <div className="text-xs text-muted-foreground">
                          {applicant.guardian}
                          {applicant.guardianRelationship ? ` (${applicant.guardianRelationship})` : ""}
                          {applicant.contact ? ` - ${applicant.contact}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>{applicant.applyingFor}</TableCell>
                      <TableCell>
                        <Badge variant={applicant.stage === "Enrolled" ? "success" : applicant.stage === "Offer" ? "secondary" : "outline"}>
                          {applicant.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={applicant.priority === "High" ? "destructive" : applicant.priority === "Watch" ? "warning" : "outline"}>
                          {applicant.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{applicant.source}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {applicant.stage !== "Enrolled" ? (
                            <Button size="sm" variant="outline" onClick={() => advanceApplicant(applicant.id)} disabled={acceptMutation.isPending}>
                              Advance
                            </Button>
                          ) : applicant.studentId ? (
                            <Button size="sm" asChild>
                              <Link to="/students/$studentId" params={{ studentId: applicant.studentId }}>
                                Open learner
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => acceptMutation.mutate(applicant.id)} disabled={acceptMutation.isPending}>
                              {acceptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Create learner
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {applicants.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No applicants in the pipeline.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {offers.map((applicant) => (
              <div key={applicant.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{applicant.learner}</p>
                    <p className="text-sm text-muted-foreground">{applicant.applyingFor} - updated {applicant.updatedAt}</p>
                  </div>
                  <Badge variant={applicant.stage === "Enrolled" ? "success" : "secondary"}>{applicant.stage}</Badge>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>Parent / guardian: {applicant.guardian}{applicant.guardianRelationship ? ` (${applicant.guardianRelationship})` : ""}</p>
                  <p>Contact: {applicant.contact || "Not captured"}</p>
                  <p>Email: {applicant.email || "Not captured"}</p>
                  <p>Lead source: {applicant.source}</p>
                  {applicant.admissionNumber ? <p>Learner admission #: {applicant.admissionNumber}</p> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success(`Offer resent to ${applicant.guardian}`)}>
                    Resend offer
                  </Button>
                  {applicant.studentId ? (
                    <Button size="sm" asChild>
                      <Link to="/students/$studentId" params={{ studentId: applicant.studentId }}>
                        Open learner
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => acceptMutation.mutate(applicant.id)} disabled={acceptMutation.isPending}>
                      {acceptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Convert to learner
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {offers.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground lg:col-span-2">
                No offers are active right now.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Admissions follow-up</h2>
              <div className="mt-4 space-y-3">
                {followUps.map((applicant) => (
                  <div key={applicant.id} className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{applicant.learner}</p>
                      <p className="text-xs text-muted-foreground">
                        {applicant.guardian || "Guardian not captured"}
                        {applicant.contact ? ` - ${applicant.contact}` : ""}
                      </p>
                    </div>
                    <Badge variant={applicant.stage === "Offer" ? "secondary" : applicant.stage === "Assessment" ? "warning" : "outline"}>
                      {applicant.stage}
                    </Badge>
                  </div>
                ))}
                {followUps.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    No admissions follow-up items are currently available from backend data.
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Next actions</h2>
              <div className="mt-4 space-y-3">
                <Button className="w-full" variant="outline" onClick={() => toast.success("Document request reminders queued")}>
                  Send document reminders
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/onboarding">Open onboarding workflow</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link to="/students">Go to learner register</Link>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
