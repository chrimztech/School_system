import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Plus, Search, RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

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
    <div className="space-y-6">
      <PageHeader
        title="School Library"
        description={`Catalogue and lending · ${active.shortCode}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Add title</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add new title</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Title *</Label>
                  <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="New General Mathematics 9" maxLength={150} />
                </div>
                <div>
                  <Label>Author *</Label>
                  <Input className="mt-1" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Channon, Smith" maxLength={100} />
                </div>
                <div>
                  <Label>Publisher</Label>
                  <Input className="mt-1" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} placeholder="Longman Zambia" maxLength={100} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Edition</Label>
                  <Input className="mt-1" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} placeholder="3rd Edition" maxLength={30} />
                </div>
                <div>
                  <Label>ISBN</Label>
                  <Input className="mt-1" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} placeholder="9789982999999" maxLength={30} />
                </div>
                <div>
                  <Label>Year published</Label>
                  <Input type="number" className="mt-1" min={1900} max={new Date().getFullYear()} value={form.yearPublished} onChange={(e) => setForm({ ...form, yearPublished: e.target.value })} placeholder="2024" />
                </div>
                <div>
                  <Label>No. of copies</Label>
                  <Input type="number" className="mt-1" value={form.copies} onChange={(e) => setForm({ ...form, copies: e.target.value })} min={1} />
                </div>
                <div>
                  <Label>Shelf location</Label>
                  <Input className="mt-1" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Shelf B3" maxLength={40} />
                </div>
                <div>
                  <Label>Reading level / grade range</Label>
                  <Input className="mt-1" value={form.readingLevel} onChange={(e) => setForm({ ...form, readingLevel: e.target.value })} placeholder="e.g. Grade 9–12, Junior" maxLength={40} />
                </div>
                <div>
                  <Label>Condition</Label>
                  <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["New", "Good", "Fair", "Poor", "Damaged"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Acquisition cost (K)</Label>
                  <Input type="number" min={0} className="mt-1" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} placeholder="e.g. 250" />
                </div>
                <div>
                  <Label>Acquisition date</Label>
                  <Input type="date" className="mt-1" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Damage notes</Label>
                  <Input className="mt-1" value={form.damageNotes} onChange={(e) => setForm({ ...form, damageNotes: e.target.value })} placeholder="e.g. Torn cover on copy 2 of 5" maxLength={200} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addBook} disabled={addBookMutation.isPending}>
                  {addBookMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add title
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or author" className="pl-9" />
          </div>
        </div>
        {booksLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /><span>Loading catalogue…</span>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Copies</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Out</TableHead>
              </TableRow>
            </TableHeader>
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
                    <TableCell><Badge variant="secondary">{b.category}</Badge></TableCell>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
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
                      <TableCell><Badge variant={isOverdue ? "destructive" : "outline"}>{isOverdue ? "Overdue" : "On time"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => returnMutation.mutate(l.id)} disabled={returnMutation.isPending}>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />Return
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
