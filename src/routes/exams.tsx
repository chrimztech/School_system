import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, MapPin, Users, FileSpreadsheet, Plus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/exams")({
  head: () => ({ meta: [{ title: "Exams — SRMS" }] }),
  component: ExamsPage,
});

// Zambia 2025: Secondary uses Forms; Grade 7 abolished (now Form 1)
const GRADES = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];

function SeatingPlanTab({ papers }: { papers: any[] }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const paper = papers.find((p) => p.id === selectedId) ?? papers[0];

  if (!paper) return <p className="py-8 text-center text-muted-foreground">No papers scheduled. Schedule a paper to generate a seating plan.</p>;

  const cols = 12;
  const count = Number(paper.candidates) || 0;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select value={paper.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {papers.map((p) => <SelectItem key={p.id} value={p.id}>{p.subject} — {p.grade} ({p.examDate})</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{paper.room} · {count} candidates · {cols} cols × {Math.ceil(count / cols)} rows</span>
      </div>
      {count > 0 ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="aspect-square flex items-center justify-center rounded border border-primary/20 bg-primary/10 text-center text-[10px] font-mono leading-none">
              {String(i + 1).padStart(3, "0")}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">Candidate count not set for this paper.</p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => toast.success("Seating plan reshuffled")}>Reshuffle</Button>
        <Button onClick={() => toast.success("Plan emailed to invigilators")}>Publish</Button>
      </div>
    </>
  );
}

function EczTab({ papers }: { papers: any[] }) {
  const eczPapers = papers.filter((p) => p.examBoard === "ECZ");

  if (!eczPapers.length) return (
    <div className="py-8 text-center text-muted-foreground">
      <p>No ECZ papers scheduled.</p>
      <p className="mt-1 text-sm">Schedule a paper with Exam Board set to "ECZ" to see it here.</p>
    </div>
  );

  const byGrade = eczPapers.reduce<Record<string, { papers: any[]; candidates: number }>>((acc, p) => {
    const key = p.grade ?? "Other";
    if (!acc[key]) acc[key] = { papers: [], candidates: 0 };
    acc[key].papers.push(p);
    acc[key].candidates += Number(p.candidates) || 0;
    return acc;
  }, {});

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">ECZ Candidate Registration</h3>
          <p className="text-sm text-muted-foreground">{eczPapers.length} ECZ paper{eczPapers.length !== 1 ? "s" : ""} · {eczPapers.reduce((a, p) => a + (Number(p.candidates) || 0), 0)} total candidates</p>
        </div>
        <Button onClick={() => toast.success("Candidate file (.csv) exported for ECZ portal upload")}>Export ECZ batch</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(byGrade).map(([grade, { candidates }]) => (
          <div key={grade} className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase text-muted-foreground">{grade}</p>
            <p className="mt-1 text-2xl font-bold">{candidates}</p>
            <p className="text-xs text-muted-foreground">candidates</p>
            <Badge variant="secondary" className="mt-2">Scheduled</Badge>
          </div>
        ))}
      </div>
    </>
  );
}
const ROOMS = ["Hall A", "Hall B", "Lab Block", "Bio Lab", "ICT Lab", "Room 201"];
const DURATIONS = ["1h", "1h 30m", "2h", "2h 30m", "3h"];
const EXAM_BOARDS = ["Internal", "ECZ", "Cambridge", "IB", "UNZA"];
const PAPER_TYPES = ["Paper 1", "Paper 2", "Paper 3", "Practical", "Oral", "Coursework"];

function ExamsPage() {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "", grade: GRADES[2], examDate: "", startTime: "08:00",
    duration: "2h", room: ROOMS[0], candidates: "30", invigilator: "",
    examBoard: EXAM_BOARDS[0], paperType: PAPER_TYPES[0], totalMarks: "100",
    passMark: "50", examFee: "", syllabusCode: "", secondInvigilator: "",
    markSchemeLocation: "", specialArrangements: "",
  });

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ["exams", active.id],
    queryFn: () => api.exams.list(active.id),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.exams.create(active.id, data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["exams", active.id] }); toast.success("Exam paper scheduled"); setOpen(false); },
    onError: () => toast.error("Failed to schedule paper"),
  });

  const schedulePaper = () => {
    if (!form.subject.trim() || !form.examDate.trim()) { toast.error("Subject and date are required"); return; }
    const gradeCode = form.grade.replace("Grade ", "G");
    const subCode = form.subject.toUpperCase().replace(/\s+/g, "-").slice(0, 8);
    const code = `INT-${gradeCode}-${subCode}-P${(papers as any[]).length + 1}`;
    createMut.mutate({ code, subject: form.subject, grade: form.grade, examDate: form.examDate, startTime: form.startTime, duration: form.duration, room: form.room, candidates: Number(form.candidates) || 30, invigilator: form.invigilator, examBoard: form.examBoard, paperType: form.paperType, totalMarks: Number(form.totalMarks) || 100, passMark: Number(form.passMark) || 50, examFee: Number(form.examFee) || 0, syllabusCode: form.syllabusCode.trim() || null, secondInvigilator: form.secondInvigilator.trim() || null, markSchemeLocation: form.markSchemeLocation.trim() || null, specialArrangements: form.specialArrangements.trim() || null, status: "SCHEDULED" });
    setForm({ subject: "", grade: GRADES[2], examDate: "", startTime: "08:00", duration: "2h", room: ROOMS[0], candidates: "30", invigilator: "", examBoard: EXAM_BOARDS[0], paperType: PAPER_TYPES[0], totalMarks: "100", passMark: "50", examFee: "", syllabusCode: "", secondInvigilator: "", markSchemeLocation: "", specialArrangements: "" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations"
        description="ECZ & internal exam scheduling, seating plans, invigilation roster and candidate registers."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Seating plan PDF generated")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />Seating plan
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Schedule paper</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Schedule exam paper</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Subject / paper title *</Label>
                    <Input className="mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathematics Paper 1" maxLength={100} />
                  </div>
                  <div>
                    <Label>Grade</Label>
                    <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{GRADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Exam board</Label>
                    <Select value={form.examBoard} onValueChange={(v) => setForm({ ...form, examBoard: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{EXAM_BOARDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date *</Label>
                    <Input type="date" className="mt-1" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Start time</Label>
                    <Input type="time" className="mt-1" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Select value={form.duration} onValueChange={(v) => setForm({ ...form, duration: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{DURATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Paper type</Label>
                    <Select value={form.paperType} onValueChange={(v) => setForm({ ...form, paperType: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAPER_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Room / venue</Label>
                    <Select value={form.room} onValueChange={(v) => setForm({ ...form, room: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROOMS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Candidates</Label>
                    <Input type="number" className="mt-1" value={form.candidates} onChange={(e) => setForm({ ...form, candidates: e.target.value })} min={1} />
                  </div>
                  <div>
                    <Label>Total marks</Label>
                    <Input type="number" className="mt-1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} min={1} />
                  </div>
                  <div>
                    <Label>Pass mark</Label>
                    <Input type="number" className="mt-1" value={form.passMark} onChange={(e) => setForm({ ...form, passMark: e.target.value })} min={0} />
                  </div>
                  <div>
                    <Label>Exam fee (K)</Label>
                    <Input type="number" className="mt-1" value={form.examFee} onChange={(e) => setForm({ ...form, examFee: e.target.value })} placeholder="0" min={0} />
                  </div>
                  <div>
                    <Label>Syllabus / paper code</Label>
                    <Input className="mt-1" value={form.syllabusCode} onChange={(e) => setForm({ ...form, syllabusCode: e.target.value })} placeholder="ECZ-MATH-7P1" maxLength={30} />
                  </div>
                  <div>
                    <Label>Lead invigilator</Label>
                    <Input className="mt-1" value={form.invigilator} onChange={(e) => setForm({ ...form, invigilator: e.target.value })} placeholder="e.g. Mr. Phiri" maxLength={80} />
                  </div>
                  <div>
                    <Label>Second invigilator</Label>
                    <Input className="mt-1" value={form.secondInvigilator} onChange={(e) => setForm({ ...form, secondInvigilator: e.target.value })} placeholder="Name of assistant invigilator" maxLength={80} />
                  </div>
                  <div className="col-span-2">
                    <Label>Mark scheme / answer sheet location</Label>
                    <Input className="mt-1" value={form.markSchemeLocation} onChange={(e) => setForm({ ...form, markSchemeLocation: e.target.value })} placeholder="e.g. Server: /exams/2026/Math-P1-MS.pdf" maxLength={200} />
                  </div>
                  <div className="col-span-2">
                    <Label>Special arrangements / notes</Label>
                    <Input className="mt-1" value={form.specialArrangements} onChange={(e) => setForm({ ...form, specialArrangements: e.target.value })} placeholder="e.g. 3 SEN candidates need extra time" maxLength={200} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={schedulePaper}>Schedule paper</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Papers scheduled" value={(papers as any[]).length} accent="primary" icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatCard label="Total candidates" value={(papers as any[]).reduce((a: number, p: any) => a + (p.candidates ?? 0), 0)} accent="accent" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Exam rooms" value={[...new Set((papers as any[]).map((p: any) => p.room).filter(Boolean))].length || "—"} hint="Distinct venues" accent="primary" icon={<MapPin className="h-4 w-4" />} />
        <StatCard label="ECZ papers" value={(papers as any[]).filter((p: any) => p.examBoard === "ECZ").length} hint="Registered with ECZ" accent="success" />
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Timetable</TabsTrigger>
          <TabsTrigger value="seating">Seating plan</TabsTrigger>
          <TabsTrigger value="invig">Invigilation</TabsTrigger>
          <TabsTrigger value="ecz">ECZ candidates</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Paper code</TableHead><TableHead>Subject</TableHead><TableHead>Grade</TableHead>
              <TableHead>Date</TableHead><TableHead>Start</TableHead><TableHead>Duration</TableHead>
              <TableHead>Room</TableHead><TableHead>Candidates</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (papers as any[]).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.subject}</TableCell>
                  <TableCell>{p.grade}</TableCell>
                  <TableCell>{p.examDate}</TableCell>
                  <TableCell>{p.startTime}</TableCell>
                  <TableCell>{p.duration}</TableCell>
                  <TableCell>{p.room}</TableCell>
                  <TableCell>{p.candidates}</TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{p.status}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="seating" className="rounded-xl border border-border bg-card p-5">
          <SeatingPlanTab papers={papers as any[]} />
        </TabsContent>

        <TabsContent value="invig" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Paper</TableHead><TableHead>Date</TableHead><TableHead>Lead invigilator</TableHead>
              <TableHead>Assistants</TableHead><TableHead className="text-right">Confirm</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(papers as any[]).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.subject}</TableCell>
                  <TableCell>{p.examDate}</TableCell>
                  <TableCell>{p.invigilator}</TableCell>
                  <TableCell className="text-muted-foreground">{p.assistants || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => toast.success(`${p.invigilator} confirmed`)}>Confirm</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="ecz" className="rounded-xl border border-border bg-card p-5">
          <EczTab papers={papers as any[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
