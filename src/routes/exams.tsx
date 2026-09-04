import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, MapPin, Users, FileSpreadsheet, Plus, Loader2, UserPlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button, Chip, Checkbox, IconButton, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, Box, Tabs, Tab, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";
import { ImportDialog, type ImportResult } from "@/components/import-dialog";
import { useTenant, gradeFormLabels } from "@/lib/tenant";
import { api } from "@/lib/api";
import { downloadCsv, badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/exams")({
  head: () => ({ meta: [{ title: "Exams — SRMS" }] }),
  component: ExamsPage,
});

function shuffledIndices(n: number) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function SeatingPlanTab({ papers, schoolId }: { papers: any[]; schoolId: string }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const paper = papers.find((p) => p.id === selectedId) ?? papers[0];
  const [seatOrder, setSeatOrder] = useState<number[] | null>(null);

  const { data: candidates = [] } = useQuery({
    queryKey: ["examCandidates", schoolId, paper?.id],
    queryFn: () => api.exams.candidates(schoolId, paper.id),
    enabled: !!paper,
  });

  if (!paper) return <p className="py-8 text-center text-muted-foreground">No papers scheduled. Schedule a paper to generate a seating plan.</p>;

  const cols = 12;
  const roster = candidates as any[];
  const count = roster.length;
  const order = seatOrder && seatOrder.length === count ? seatOrder : Array.from({ length: count }, (_, i) => i);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
        <TextField
          select
          value={paper.id}
          onChange={(e) => { setSelectedId(e.target.value); setSeatOrder(null); }}
          size="small"
          sx={{ width: { xs: "100%", sm: 288 } }}
        >
          {papers.map((p) => <MenuItem key={p.id} value={p.id}>{p.subject} — {p.grade} ({p.examDate})</MenuItem>)}
        </TextField>
        <span className="text-sm text-muted-foreground">{paper.room} · {count} registered candidates · {cols} cols × {Math.ceil(count / cols)} rows</span>
      </div>
      <div className="mb-3 hidden print:block">
        <h2 className="text-base font-semibold">{paper.subject} — {paper.grade} — {paper.room}</h2>
        <p className="text-sm text-muted-foreground">{paper.examDate} · {count} candidates</p>
      </div>
      {count > 0 ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {order.map((candidateIdx, seatIdx) => {
            const candidate = roster[candidateIdx];
            return (
              <div
                key={seatIdx}
                title={candidate?.candidateName ?? `Seat ${seatIdx + 1}`}
                className="aspect-square flex flex-col items-center justify-center rounded border border-primary/20 bg-primary/10 text-center leading-none"
              >
                <span className="text-[10px] font-mono">{String(seatIdx + 1).padStart(3, "0")}</span>
                <span className="mt-0.5 w-full truncate px-0.5 text-[7px] text-muted-foreground">
                  {candidate?.candidateName?.split(" ")[0] ?? ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          No candidates registered for this paper yet — add candidates from the Schedule tab before generating a seating plan.
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <Button
          variant="outlined"
          disabled={count === 0}
          onClick={() => { setSeatOrder(shuffledIndices(count)); toast.success("Seating order reshuffled"); }}
        >
          Reshuffle
        </Button>
        <Button variant="contained" disabled={count === 0} onClick={() => window.print()}>
          Print seating plan
        </Button>
      </div>
    </>
  );
}

function CandidatesDialog({ open, onOpenChange, paper, schoolId }: { open: boolean; onOpenChange: (open: boolean) => void; paper: any; schoolId: string }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [selectedGce, setSelectedGce] = useState<string[]>([]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["examCandidates", schoolId, paper?.id],
    queryFn: () => api.exams.candidates(schoolId, paper.id),
    enabled: open && !!paper,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => api.classes.list(schoolId),
    enabled: open,
  });

  const { data: gceCandidates = [] } = useQuery({
    queryKey: ["gceCandidates", schoolId],
    queryFn: () => api.gce.list(schoolId),
    enabled: open,
  });

  const registeredGceIds = new Set((candidates as any[]).filter((c) => c.candidateType === "GCE").map((c) => c.gceCandidateId));
  const availableGce = (gceCandidates as any[]).filter((g) => !registeredGceIds.has(g.id));

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["examCandidates", schoolId, paper?.id] });
    void qc.invalidateQueries({ queryKey: ["exams", schoolId] });
  };

  const addFromClassMut = useMutation({
    mutationFn: () => api.exams.addFromClass(schoolId, paper.id, classId),
    onSuccess: (res) => { invalidate(); toast.success(`${res.added} candidate${res.added !== 1 ? "s" : ""} added${res.skipped ? `, ${res.skipped} already registered` : ""}`); setClassId(""); },
    onError: () => toast.error("Failed to add class candidates"),
  });

  const addGceMut = useMutation({
    mutationFn: () => api.exams.addGceCandidates(schoolId, paper.id, selectedGce),
    onSuccess: (res) => { invalidate(); toast.success(`${res.added} GCE candidate${res.added !== 1 ? "s" : ""} added${res.skipped ? `, ${res.skipped} skipped` : ""}`); setSelectedGce([]); },
    onError: () => toast.error("Failed to add GCE candidates"),
  });

  const removeMut = useMutation({
    mutationFn: (candidateId: string) => api.exams.removeCandidate(schoolId, paper.id, candidateId),
    onSuccess: () => { invalidate(); toast.success("Candidate removed"); },
    onError: () => toast.error("Failed to remove candidate"),
  });

  if (!paper) return null;

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth="lg" fullWidth>
      <DialogTitle>Candidates — {paper.subject} ({paper.grade})</DialogTitle>
      <DialogContent>
        <div className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium mb-2">Add examination class</p>
              <div className="flex gap-2">
                <TextField select value={classId} onChange={(e) => setClassId(e.target.value)} size="small" sx={{ flex: 1 }}>
                  <MenuItem value="" disabled>Select class</MenuItem>
                  {(classes as any[]).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}{c.section ? ` ${c.section}` : ""}</MenuItem>)}
                </TextField>
                <Button variant="contained" size="small" disabled={!classId || addFromClassMut.isPending} onClick={() => addFromClassMut.mutate()}>
                  {addFromClassMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Registers every actively enrolled student in the selected class as an internal candidate.</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium mb-2">Add GCE candidates</p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto">
                {availableGce.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No unregistered GCE candidates. Add candidates in the GCE tab.</p>
                ) : availableGce.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      size="small"
                      checked={selectedGce.includes(g.id)}
                      onChange={(e) => setSelectedGce((prev) => e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id))}
                    />
                    {g.firstName} {g.lastName} {g.examNumber ? `· ${g.examNumber}` : ""}
                  </label>
                ))}
              </div>
              <Button variant="contained" size="small" sx={{ mt: 1 }} disabled={selectedGce.length === 0 || addGceMut.isPending} onClick={() => addGceMut.mutate()}>
                {addGceMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${selectedGce.length || ""} selected`}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Registered candidates ({(candidates as any[]).length})</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <TableContainer>
              <Table>
                <TableHead><TableRow>
                  <TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>Form</TableCell><TableCell className="text-right">Remove</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : (candidates as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No candidates registered yet.</TableCell></TableRow>
                  ) : (candidates as any[]).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.candidateName}</TableCell>
                      <TableCell><Chip size="small" label={c.candidateType} sx={{ ...badgeSx(c.candidateType === "GCE" ? "secondary" : "outline"), fontSize: 10 }} /></TableCell>
                      <TableCell>{c.grade}</TableCell>
                      <TableCell className="text-right">
                        <IconButton size="small" aria-label={`Remove ${c.candidateName}`} disabled={removeMut.isPending} onClick={() => removeMut.mutate(c.id)}>
                          <Trash2 size={14} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TableContainer>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

const GCE_IMPORT_COLUMNS = [
  { key: "firstName", label: "First Name", required: true, example: "Chola" },
  { key: "lastName", label: "Last Name", required: true, example: "Banda" },
  { key: "grade", label: "Form", required: true, example: "Form 5" },
  { key: "examNumber", label: "Exam Number", example: "0012345" },
  { key: "nrc", label: "NRC", example: "123456/78/1" },
  { key: "gender", label: "Gender", example: "Female" },
  { key: "dateOfBirth", label: "Date of Birth", example: "2004-03-12" },
  { key: "subjects", label: "Subjects", example: "Mathematics, English, Biology" },
  { key: "centerNumber", label: "Center Number", example: "70123" },
  { key: "phone", label: "Phone", example: "+260 977 000002" },
  { key: "email", label: "Email", example: "chola@example.com" },
  { key: "previousSchool", label: "Previous School", example: "Kabulonga Boys" },
];

function blankGceForm() {
  return { firstName: "", lastName: "", grade: "", examNumber: "", nrc: "", subjects: "", phone: "" };
}

function GceAddDialog({ open, onOpenChange, schoolId, onDone, candidate }: { open: boolean; onOpenChange: (open: boolean) => void; schoolId: string; onDone: () => void; candidate?: any | null }) {
  const [form, setForm] = useState(blankGceForm());

  useEffect(() => {
    if (!open) return;
    setForm(candidate
      ? { firstName: candidate.firstName ?? "", lastName: candidate.lastName ?? "", grade: candidate.grade ?? "", examNumber: candidate.examNumber ?? "", nrc: candidate.nrc ?? "", subjects: candidate.subjects ?? "", phone: candidate.phone ?? "" }
      : blankGceForm());
  }, [open, candidate]);

  const createMut = useMutation({
    mutationFn: () => api.gce.create(schoolId, form),
    onSuccess: () => { toast.success("GCE candidate added"); onDone(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to add candidate"),
  });

  const updateMut = useMutation({
    mutationFn: () => api.gce.update(schoolId, candidate.id, form),
    onSuccess: () => { toast.success("GCE candidate updated"); onDone(); onOpenChange(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update candidate"),
  });

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} maxWidth="sm" fullWidth>
      <DialogTitle>{candidate ? "Edit GCE candidate" : "Add GCE candidate"}</DialogTitle>
      <DialogContent>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} fullWidth size="small" />
          <TextField label="Last name *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} fullWidth size="small" />
          <TextField label="Form *" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Form 5" fullWidth size="small" />
          <TextField label="Exam number" value={form.examNumber} onChange={(e) => setForm({ ...form, examNumber: e.target.value })} fullWidth size="small" />
          <TextField label="NRC" value={form.nrc} onChange={(e) => setForm({ ...form, nrc: e.target.value })} fullWidth size="small" />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} fullWidth size="small" />
          <TextField className="col-span-2" label="Subjects" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Mathematics, English, Biology" fullWidth size="small" />
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!form.firstName.trim() || !form.lastName.trim() || !form.grade.trim() || pending}
          onClick={() => (candidate ? updateMut.mutate() : createMut.mutate())}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{candidate ? "Save changes" : "Add candidate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function GceRoster({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const { data: gceCandidates = [], isLoading } = useQuery({
    queryKey: ["gceCandidates", schoolId],
    queryFn: () => api.gce.list(schoolId),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["gceCandidates", schoolId] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.gce.delete(schoolId, id),
    onSuccess: () => { toast.success("Candidate removed"); invalidate(); setDeleteTarget(null); },
    onError: () => { toast.error("Failed to remove candidate"); setDeleteTarget(null); },
  });

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">GCE candidate roster</h3>
          <p className="text-sm text-muted-foreground">Private / repeat candidates registered directly with ECZ, not tied to a class.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" startIcon={<Upload size={16} />} onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button variant="contained" startIcon={<UserPlus size={16} />} onClick={() => setAddOpen(true)}>Add candidate</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <TableContainer>
        <Table>
          <TableHead><TableRow>
            <TableCell>Name</TableCell><TableCell>Exam number</TableCell><TableCell>Form</TableCell>
            <TableCell>Subjects</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : (gceCandidates as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No GCE candidates yet. Add one or import a CSV.</TableCell></TableRow>
            ) : (gceCandidates as any[]).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                <TableCell className="font-mono text-xs">{c.examNumber || "—"}</TableCell>
                <TableCell>{c.grade}</TableCell>
                <TableCell className="text-muted-foreground">{c.subjects || "—"}</TableCell>
                <TableCell><Chip size="small" label={c.status} sx={{ ...badgeSx("secondary"), fontSize: 10 }} /></TableCell>
                <TableCell align="right">
                  <Button size="small" variant="text" color="inherit" onClick={() => setEditingCandidate(c)}>Edit</Button>
                  <Button size="small" variant="text" color="error" onClick={() => setDeleteTarget(c)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </TableContainer>
      </div>

      <GceAddDialog open={addOpen} onOpenChange={setAddOpen} schoolId={schoolId} onDone={invalidate} />
      <GceAddDialog open={!!editingCandidate} onOpenChange={(o) => !o && setEditingCandidate(null)} schoolId={schoolId} onDone={invalidate} candidate={editingCandidate} />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove this candidate?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted-foreground">
            <strong>{deleteTarget?.firstName} {deleteTarget?.lastName}</strong> will be removed from the GCE roster. This cannot be undone.
          </p>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" disabled={deleteMut.isPending} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMut.isPending} onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}>
            {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete
          </Button>
        </DialogActions>
      </Dialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import GCE candidates"
        entityName="GCE candidate"
        columns={GCE_IMPORT_COLUMNS}
        onDone={invalidate}
        onImport={async (rows) => {
          const result: ImportResult = { imported: 0, errors: [] };
          const valid: { row: number; dto: any }[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row["First Name"]?.trim() || !row["Last Name"]?.trim()) {
              result.errors.push({ row: i + 2, error: "First Name and Last Name are required" });
              continue;
            }
            if (!row["Form"]?.trim()) {
              result.errors.push({ row: i + 2, error: "Form is required" });
              continue;
            }
            valid.push({
              row: i + 2,
              dto: {
                firstName: row["First Name"].trim(),
                lastName: row["Last Name"].trim(),
                grade: row["Form"].trim(),
                examNumber: row["Exam Number"]?.trim() || null,
                nrc: row["NRC"]?.trim() || null,
                gender: row["Gender"]?.trim() || null,
                dateOfBirth: row["Date of Birth"]?.trim() || null,
                subjects: row["Subjects"]?.trim() || null,
                centerNumber: row["Center Number"]?.trim() || null,
                phone: row["Phone"]?.trim() || null,
                email: row["Email"]?.trim() || null,
                previousSchool: row["Previous School"]?.trim() || null,
              },
            });
          }
          if (valid.length > 0) {
            try {
              const bulk = await api.gce.bulkCreate(schoolId, valid.map((v) => v.dto));
              result.imported += bulk.imported;
              bulk.errors.forEach((e) => result.errors.push({ row: valid[e.row]?.row ?? -1, error: e.error }));
            } catch (e: any) {
              valid.forEach((v) => result.errors.push({ row: v.row, error: e?.response?.data?.message ?? e?.message ?? "Unknown error" }));
            }
          }
          result.errors.sort((a, b) => a.row - b.row);
          return result;
        }}
      />
    </div>
  );
}

function EczTab({ papers, schoolId }: { papers: any[]; schoolId: string }) {
  const eczPapers = papers.filter((p) => p.examBoard === "ECZ");

  const byGrade = eczPapers.reduce<Record<string, { papers: any[]; candidates: number }>>((acc, p) => {
    const key = p.grade ?? "Other";
    if (!acc[key]) acc[key] = { papers: [], candidates: 0 };
    acc[key].papers.push(p);
    acc[key].candidates += Number(p.candidates) || 0;
    return acc;
  }, {});

  return (
    <>
      <GceRoster schoolId={schoolId} />

      {!eczPapers.length ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>No ECZ papers scheduled.</p>
          <p className="mt-1 text-sm">Schedule a paper with Exam Board set to "ECZ" to see it here.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">ECZ Candidate Registration</h3>
              <p className="text-sm text-muted-foreground">{eczPapers.length} ECZ paper{eczPapers.length !== 1 ? "s" : ""} · {eczPapers.reduce((a, p) => a + (Number(p.candidates) || 0), 0)} total candidates</p>
            </div>
            <Button variant="contained" onClick={() => { downloadCsv(eczPapers.map((p) => ({ "Paper Code": p.code, Subject: p.subject, Grade: p.grade, Candidates: p.candidates, "Exam Date": p.examDate, "Start Time": p.startTime, Duration: p.duration, Room: p.room, Invigilator: p.invigilator, "Exam Board": p.examBoard })), "ecz-candidate-batch"); toast.success("Candidate file (.csv) exported for ECZ portal upload"); }}>Export ECZ batch</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(byGrade).map(([grade, { candidates }]) => (
              <div key={grade} className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase text-muted-foreground">{grade}</p>
                <p className="mt-1 text-2xl font-bold">{candidates}</p>
                <p className="text-xs text-muted-foreground">candidates</p>
                <Chip size="small" label="Scheduled" sx={{ ...badgeSx("secondary"), mt: 1 }} />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
const ROOMS = ["Hall A", "Hall B", "Lab Block", "Bio Lab", "ICT Lab", "Room 201"];
const DURATIONS = ["1h", "1h 30m", "2h", "2h 30m", "3h"];
const EXAM_BOARDS = ["Internal", "ECZ", "Cambridge", "IB", "UNZA"];
const PAPER_TYPES = ["Paper 1", "Paper 2", "Paper 3", "Practical", "Oral", "Coursework"];

function ExamsPage() {
  const { active } = useTenant();
  const gradeOptions = gradeFormLabels(active.type);
  const qc = useQueryClient();
  const [tab, setTab] = useState("schedule");
  const [open, setOpen] = useState(false);
  const [candidatesPaper, setCandidatesPaper] = useState<any>(null);
  const [form, setForm] = useState({
    subject: "", grade: gradeOptions[0], examDate: "", startTime: "08:00",
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

  const confirmMut = useMutation({
    mutationFn: (id: string) => api.exams.update(active.id, id, { status: "CONFIRMED" }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["exams", active.id] }); toast.success("Invigilator confirmed"); },
    onError: () => toast.error("Failed to confirm invigilator"),
  });

  const [deletePaperTarget, setDeletePaperTarget] = useState<any | null>(null);
  const deletePaperMut = useMutation({
    mutationFn: (id: string) => api.exams.delete(active.id, id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["exams", active.id] }); toast.success("Exam paper deleted"); setDeletePaperTarget(null); },
    onError: () => { toast.error("Failed to delete exam paper"); setDeletePaperTarget(null); },
  });

  const schedulePaper = () => {
    if (!form.subject.trim() || !form.examDate.trim()) { toast.error("Subject and date are required"); return; }
    const gradeCode = form.grade.replace("Grade ", "G");
    const subCode = form.subject.toUpperCase().replace(/\s+/g, "-").slice(0, 8);
    const code = `INT-${gradeCode}-${subCode}-P${(papers as any[]).length + 1}`;
    createMut.mutate({ code, subject: form.subject, grade: form.grade, examDate: form.examDate, startTime: form.startTime, duration: form.duration, room: form.room, candidates: Number(form.candidates) || 30, invigilator: form.invigilator, examBoard: form.examBoard, paperType: form.paperType, totalMarks: Number(form.totalMarks) || 100, passMark: Number(form.passMark) || 50, examFee: Number(form.examFee) || 0, syllabusCode: form.syllabusCode.trim() || null, secondInvigilator: form.secondInvigilator.trim() || null, markSchemeLocation: form.markSchemeLocation.trim() || null, specialArrangements: form.specialArrangements.trim() || null, status: "SCHEDULED" });
    setForm({ subject: "", grade: gradeOptions[0], examDate: "", startTime: "08:00", duration: "2h", room: ROOMS[0], candidates: "30", invigilator: "", examBoard: EXAM_BOARDS[0], paperType: PAPER_TYPES[0], totalMarks: "100", passMark: "50", examFee: "", syllabusCode: "", secondInvigilator: "", markSchemeLocation: "", specialArrangements: "" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations"
        description="ECZ & internal exam scheduling, seating plans, invigilation roster and candidate registers."
        actions={
          <>
            <Button variant="outlined" startIcon={<FileSpreadsheet size={16} />} onClick={() => setTab("seating")}>
              Seating plan
            </Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Schedule paper</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Schedule exam paper</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    className="col-span-2"
                    label="Subject / paper title *"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Mathematics Paper 1"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField select label="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} fullWidth size="small">
                    {gradeOptions.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                  </TextField>
                  <TextField select label="Exam board" value={form.examBoard} onChange={(e) => setForm({ ...form, examBoard: e.target.value })} fullWidth size="small">
                    {EXAM_BOARDS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Date *"
                    type="date"
                    value={form.examDate}
                    onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                    fullWidth
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Start time"
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    fullWidth
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField select label="Duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} fullWidth size="small">
                    {DURATIONS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </TextField>
                  <TextField select label="Paper type" value={form.paperType} onChange={(e) => setForm({ ...form, paperType: e.target.value })} fullWidth size="small">
                    {PAPER_TYPES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </TextField>
                  <TextField select label="Room / venue" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} fullWidth size="small">
                    {ROOMS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Candidates"
                    type="number"
                    value={form.candidates}
                    onChange={(e) => setForm({ ...form, candidates: e.target.value })}
                    slotProps={{ htmlInput: { min: 1 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Total marks"
                    type="number"
                    value={form.totalMarks}
                    onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
                    slotProps={{ htmlInput: { min: 1 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Pass mark"
                    type="number"
                    value={form.passMark}
                    onChange={(e) => setForm({ ...form, passMark: e.target.value })}
                    slotProps={{ htmlInput: { min: 0 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Exam fee (K)"
                    type="number"
                    value={form.examFee}
                    onChange={(e) => setForm({ ...form, examFee: e.target.value })}
                    placeholder="0"
                    slotProps={{ htmlInput: { min: 0 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Syllabus / paper code"
                    value={form.syllabusCode}
                    onChange={(e) => setForm({ ...form, syllabusCode: e.target.value })}
                    placeholder="ECZ-MATH-7P1"
                    slotProps={{ htmlInput: { maxLength: 30 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Lead invigilator"
                    value={form.invigilator}
                    onChange={(e) => setForm({ ...form, invigilator: e.target.value })}
                    placeholder="e.g. Mr. Phiri"
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Second invigilator"
                    value={form.secondInvigilator}
                    onChange={(e) => setForm({ ...form, secondInvigilator: e.target.value })}
                    placeholder="Name of assistant invigilator"
                    slotProps={{ htmlInput: { maxLength: 80 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    className="col-span-2"
                    label="Mark scheme / answer sheet location"
                    value={form.markSchemeLocation}
                    onChange={(e) => setForm({ ...form, markSchemeLocation: e.target.value })}
                    placeholder="e.g. Server: /exams/2026/Math-P1-MS.pdf"
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    className="col-span-2"
                    label="Special arrangements / notes"
                    value={form.specialArrangements}
                    onChange={(e) => setForm({ ...form, specialArrangements: e.target.value })}
                    placeholder="e.g. 3 SEN candidates need extra time"
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    fullWidth
                    size="small"
                  />
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={schedulePaper}>Schedule paper</Button>
              </DialogActions>
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

      <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="schedule" label="Timetable" />
          <Tab value="seating" label="Seating plan" />
          <Tab value="invig" label="Invigilation" />
          <Tab value="ecz" label="ECZ candidates" />
        </Tabs>

        {tab === "schedule" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Paper code</TableCell><TableCell>Subject</TableCell><TableCell>Grade / Form</TableCell>
              <TableCell>Date</TableCell><TableCell>Start</TableCell><TableCell>Duration</TableCell>
              <TableCell>Room</TableCell><TableCell>Candidates</TableCell><TableCell>Status</TableCell><TableCell className="text-right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Loading...</TableCell></TableRow>
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
                  <TableCell className="text-right">
                    <Button size="small" variant="text" color="inherit" startIcon={<UserPlus size={14} />} onClick={() => setCandidatesPaper(p)}>
                      Manage
                    </Button>
                    <Button size="small" variant="text" color="error" startIcon={<Trash2 size={14} />} onClick={() => setDeletePaperTarget(p)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )}

        <Dialog open={!!deletePaperTarget} onClose={() => setDeletePaperTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Delete this exam paper?</DialogTitle>
          <DialogContent>
            <p className="text-sm text-muted-foreground">
              <strong>{deletePaperTarget?.code}</strong> ({deletePaperTarget?.subject}) will be removed, including its registered candidates. This cannot be undone.
            </p>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" disabled={deletePaperMut.isPending} onClick={() => setDeletePaperTarget(null)}>Cancel</Button>
            <Button variant="contained" color="error" disabled={deletePaperMut.isPending} onClick={() => deletePaperTarget && deletePaperMut.mutate(deletePaperTarget.id)}>
              {deletePaperMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete
            </Button>
          </DialogActions>
        </Dialog>

        {tab === "seating" && (
        <Box className="rounded-xl border border-border bg-card p-5">
          <SeatingPlanTab papers={papers as any[]} schoolId={active.id} />
        </Box>
        )}

        {tab === "invig" && (
        <Box className="rounded-xl border border-border bg-card">
          <TableContainer>
          <Table>
            <TableHead><TableRow>
              <TableCell>Paper</TableCell><TableCell>Date</TableCell><TableCell>Lead invigilator</TableCell>
              <TableCell>Assistants</TableCell><TableCell className="text-right">Confirm</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {(papers as any[]).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.subject}</TableCell>
                  <TableCell>{p.examDate}</TableCell>
                  <TableCell>{p.invigilator}</TableCell>
                  <TableCell className="text-muted-foreground">{p.assistants || "—"}</TableCell>
                  <TableCell className="text-right">
                    {p.status === "CONFIRMED" ? (
                      <span className="text-xs text-muted-foreground">Confirmed</span>
                    ) : (
                      <Button size="small" variant="text" color="inherit" disabled={confirmMut.isPending} onClick={() => confirmMut.mutate(p.id)}>
                        {confirmMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        </Box>
        )}

        {tab === "ecz" && (
        <Box className="rounded-xl border border-border bg-card p-5">
          <EczTab papers={papers as any[]} schoolId={active.id} />
        </Box>
        )}
      </Box>

      <CandidatesDialog
        open={!!candidatesPaper}
        onOpenChange={(v) => { if (!v) setCandidatesPaper(null); }}
        paper={candidatesPaper}
        schoolId={active.id}
      />
    </div>
  );
}
