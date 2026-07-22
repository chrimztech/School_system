import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Plus, Search, RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Chip, InputAdornment, MenuItem, TextField, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Library — SRMS" }] }),
  component: LibraryPage,
});

const CATEGORIES = ["Textbook", "Literature", "Reference", "Fiction", "Non-fiction", "Science", "History", "Biography"];

function LibraryPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    author: "",
    category: CATEGORIES[0],
    isbn: "",
    publisher: "",
    yearPublished: "",
    edition: "",
    location: "",
    copies: "1",
    readingLevel: "",
    condition: "Good",
    acquisitionCost: "",
    acquisitionDate: new Date().toISOString().slice(0, 10),
    damageNotes: "",
  });

  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["library-books", schoolId],
    queryFn: () => api.library.books(schoolId),
  });

  const { data: loans = [], isLoading: loansLoading } = useQuery({
    queryKey: ["library-loans", schoolId],
    queryFn: () => api.library.loans(schoolId),
  });

  const addBookMutation = useMutation({
    mutationFn: (data: any) => api.library.createBook(schoolId, data),
    onSuccess: (b: any) => {
      qc.invalidateQueries({ queryKey: ["library-books", schoolId] });
      toast.success(`"${b.title}" added to catalogue`);
      setForm({
        title: "",
        author: "",
        category: CATEGORIES[0],
        isbn: "",
        publisher: "",
        yearPublished: "",
        edition: "",
        location: "",
        copies: "1",
        readingLevel: "",
        condition: "Good",
        acquisitionCost: "",
        acquisitionDate: new Date().toISOString().slice(0, 10),
        damageNotes: "",
      });
      setOpen(false);
    },
    onError: () => toast.error("Failed to add book"),
  });

  const returnMutation = useMutation({
    mutationFn: (id: string) => api.library.returnLoan(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-loans", schoolId] });
      qc.invalidateQueries({ queryKey: ["library-books", schoolId] });
      toast.success("Book returned — catalogue updated");
    },
    onError: () => toast.error("Failed to record return"),
  });

  if (!active.features.library) {
    return (
      <div className="space-y-6">
        <PageHeader title="Library" description="Catalogue and circulation tracking" />
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Library module is disabled</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enable it from Settings → System preferences to start managing books for {active.shortCode}.</p>
        </div>
      </div>
    );
  }

  const addBook = () => {
    if (!form.title.trim() || !form.author.trim()) { toast.error("Title and author are required"); return; }
    const copies = Math.max(1, Number(form.copies) || 1);
    addBookMutation.mutate({
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category,
      isbn: form.isbn.trim() || null,
      publisher: form.publisher.trim() || null,
      yearPublished: form.yearPublished ? Number(form.yearPublished) : null,
      edition: form.edition.trim() || null,
      location: form.location.trim() || null,
      totalCopies: copies,
      availableCopies: copies,
      readingLevel: form.readingLevel.trim() || null,
      condition: form.condition,
      acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : null,
      acquisitionDate: form.acquisitionDate || null,
      damageNotes: form.damageNotes.trim() || null,
    });
  };

  const bookList = books as any[];
  const loanList = loans as any[];

  const filtered = bookList.filter((b: any) => `${b.title} ${b.author}`.toLowerCase().includes(q.toLowerCase()));
  const totalCopies = bookList.reduce((s: number, b: any) => s + (b.totalCopies ?? b.copies ?? 0), 0);
  const totalAvailable = bookList.reduce((s: number, b: any) => s + (b.availableCopies ?? b.available ?? 0), 0);
  const overdueCount = loanList.filter((l: any) => l.overdue || (l.status ?? "").toLowerCase() === "overdue").length;

  return (
    <AccessGuard module="library">
      <div className="space-y-6">
      <PageHeader
        title="School Library"
        description={`Catalogue and lending · ${active.shortCode}`}
        actions={
          <>
            <Button startIcon={<Plus size={16} />} onClick={() => setOpen(true)}>Add title</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Add new title</DialogTitle>
              <DialogContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <TextField
                    label="Title *"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="New General Mathematics 9"
                    slotProps={{ htmlInput: { maxLength: 150 } }}
                    fullWidth
                    size="small"
                  />
                </div>
                <TextField
                  label="Author *"
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="Channon, Smith"
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Publisher"
                  value={form.publisher}
                  onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                  placeholder="Longman Zambia"
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField
                  label="Edition"
                  value={form.edition}
                  onChange={(e) => setForm({ ...form, edition: e.target.value })}
                  placeholder="3rd Edition"
                  slotProps={{ htmlInput: { maxLength: 30 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="ISBN"
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  placeholder="9789982999999"
                  slotProps={{ htmlInput: { maxLength: 30 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  type="number"
                  label="Year published"
                  slotProps={{ htmlInput: { min: 1900, max: new Date().getFullYear() } }}
                  value={form.yearPublished}
                  onChange={(e) => setForm({ ...form, yearPublished: e.target.value })}
                  placeholder="2024"
                  fullWidth
                  size="small"
                />
                <TextField
                  type="number"
                  label="No. of copies"
                  value={form.copies}
                  onChange={(e) => setForm({ ...form, copies: e.target.value })}
                  slotProps={{ htmlInput: { min: 1 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Shelf location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Shelf B3"
                  slotProps={{ htmlInput: { maxLength: 40 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Reading level / grade range"
                  value={form.readingLevel}
                  onChange={(e) => setForm({ ...form, readingLevel: e.target.value })}
                  placeholder="e.g. Form 2–6, Junior"
                  slotProps={{ htmlInput: { maxLength: 40 } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Condition"
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {["New", "Good", "Fair", "Poor", "Damaged"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField
                  type="number"
                  label="Acquisition cost (K)"
                  slotProps={{ htmlInput: { min: 0 } }}
                  value={form.acquisitionCost}
                  onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                  placeholder="e.g. 250"
                  fullWidth
                  size="small"
                />
                <TextField
                  type="date"
                  label="Acquisition date"
                  value={form.acquisitionDate}
                  onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <div className="col-span-2">
                  <TextField
                    label="Damage notes"
                    value={form.damageNotes}
                    onChange={(e) => setForm({ ...form, damageNotes: e.target.value })}
                    placeholder="e.g. Torn cover on copy 2 of 5"
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    fullWidth
                    size="small"
                  />
                </div>
              </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={addBook}
                  disabled={addBookMutation.isPending}
                  startIcon={addBookMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                >
                  Add title
                </Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Titles" value={bookList.length} accent="primary" />
        <StatCard label="Total copies" value={totalCopies} accent="accent" />
        <StatCard label="Available" value={totalAvailable} accent="success" />
        <StatCard label="Overdue" value={overdueCount} accent="destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-sm font-semibold">Catalogue</h2>
          <div className="max-w-xs flex-1">
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title or author"
              size="small"
              fullWidth
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
            />
          </div>
        </div>
        {booksLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading catalogue…</span>
          </div>
        ) : (
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell className="text-right">Copies</TableCell>
                <TableCell className="text-right">Available</TableCell>
                <TableCell className="text-right">Out</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((b: any) => {
                const available = b.availableCopies ?? b.available ?? 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{b.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.author}
                        {b.publisher ? ` · ${b.publisher}` : ""}
                        {b.location ? ` · ${b.location}` : ""}
                      </div>
                    </TableCell>
                    <TableCell><Chip size="small" label={b.category} sx={badgeSx("secondary")} /></TableCell>
                    <TableCell className="text-right">{b.totalCopies ?? b.copies}</TableCell>
                    <TableCell className="text-right"><span className={available === 0 ? "text-destructive" : ""}>{available}</span></TableCell>
                    <TableCell className="text-right">{b.borrowedCopies ?? b.borrowed ?? 0}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No books in catalogue yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Active loans</h2>
        </div>
        {loansLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading loans…</span>
          </div>
        ) : (
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Due date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loanList.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No active loans.</TableCell></TableRow>
              ) : (
                loanList.map((l: any) => {
                  const isOverdue = l.overdue || (l.status ?? "").toLowerCase() === "overdue";
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.studentName ?? l.student}</TableCell>
                      <TableCell>{l.bookTitle ?? l.title}</TableCell>
                      <TableCell className={isOverdue ? "text-destructive" : "text-muted-foreground"}>{(l.dueDate ?? "").slice(0, 10)}</TableCell>
                      <TableCell><Chip size="small" label={isOverdue ? "Overdue" : "On time"} sx={badgeSx(isOverdue ? "destructive" : "outline")} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="small"
                          variant="text"
                          color="inherit"
                          startIcon={<RotateCcw size={14} />}
                          onClick={() => returnMutation.mutate(l.id)}
                          disabled={returnMutation.isPending}
                        >
                          Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </div>
    </div>
    </AccessGuard>
  );
}
