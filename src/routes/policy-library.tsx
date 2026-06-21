import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, FileText, FolderOpen, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/policy-library")({
  head: () => ({ meta: [{ title: "Policy Library — SRMS" }] }),
  component: PolicyLibraryPage,
});

function PolicyLibraryPage() {
  const [docs, setDocs] = useState<Array<{ title: string; category: string; status: string; updated: string }>>([]);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Governance", status: "Review" });

  const visibleDocs = useMemo(
    () => (reviewOnly ? docs.filter((doc) => doc.status === "Review") : docs),
    [docs, reviewOnly],
  );

  const addPolicy = () => {
    if (!form.title.trim()) {
      toast.error("Policy title is required");
      return;
    }

    const next = {
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      updated: new Date().toISOString().slice(0, 10),
    };

    setDocs((prev) => [next, ...prev]);
    setForm({ title: "", category: "Governance", status: "Review" });
    setOpen(false);
    toast.success(`${next.title} added to the library`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy library"
        description="Centralized repository for policies, guides and approval documents across the institution."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Upload policy</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Upload policy</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Policy title *</Label>
                  <Input className="mt-1" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Safeguarding handbook" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Governance", "Safety", "Procurement", "Discipline", "Finance", "ICT"].map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Review", "Approved", "Draft"].map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addPolicy}>Add policy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <FolderOpen className="h-4 w-4" />
            Documents
          </div>
          <p className="mt-4 text-2xl font-semibold text-foreground">{docs.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">Total documents in the library.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4" />
            Approved
          </div>
          <p className="mt-4 text-2xl font-semibold text-foreground">{docs.filter((doc) => doc.status === "Approved").length}</p>
          <p className="mt-2 text-sm text-muted-foreground">Documents currently approved.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <ClipboardCheck className="h-4 w-4" />
            Pending review
          </div>
          <p className="mt-4 text-2xl font-semibold text-foreground">{docs.filter((doc) => doc.status === "Review").length}</p>
          <p className="mt-2 text-sm text-muted-foreground">Documents waiting for approval.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <FileText className="h-4 w-4" />
            Latest update
          </div>
          <p className="mt-4 text-2xl font-semibold text-foreground">{docs[0]?.title ?? "No documents"}</p>
          <p className="mt-2 text-sm text-muted-foreground">Updated {docs[0]?.updated ?? "n/a"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Policy documents</h2>
            <p className="text-xs text-muted-foreground">Review and manage institution policies.</p>
          </div>
          <Button variant="outline" onClick={() => setReviewOnly((value) => !value)}>
            {reviewOnly ? "Show all" : "Review queue"}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleDocs.map((doc) => (
              <TableRow key={doc.title}>
                <TableCell>{doc.title}</TableCell>
                <TableCell>{doc.category}</TableCell>
                <TableCell>
                  <Badge variant={doc.status === "Approved" ? "secondary" : doc.status === "Review" ? "warning" : "outline"}>
                    {doc.status}
                  </Badge>
                </TableCell>
                <TableCell>{doc.updated}</TableCell>
              </TableRow>
            ))}
            {visibleDocs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No documents match the current review filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
