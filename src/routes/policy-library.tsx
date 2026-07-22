import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, FileText, FolderOpen, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogTitle from "@mui/material/DialogTitle";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";

import { PageHeader } from "@/components/page-header";
import { badgeSx } from "@/lib/utils";

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
          <>
          <Button variant="contained" onClick={() => setOpen(true)}>Upload policy</Button>
          <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Upload policy</DialogTitle>
            <DialogContent>
              <div className="grid gap-3">
                <TextField
                  label="Policy title *"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Safeguarding handbook"
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  fullWidth
                  size="small"
                >
                  {["Governance", "Safety", "Procurement", "Discipline", "Finance", "ICT"].map((category) => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  fullWidth
                  size="small"
                >
                  {["Review", "Approved", "Draft"].map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </TextField>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={addPolicy}>Add policy</Button>
            </DialogActions>
          </Dialog>
          </>
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
          <Button variant="outlined" onClick={() => setReviewOnly((value) => !value)}>
            {reviewOnly ? "Show all" : "Review queue"}
          </Button>
        </div>
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Policy</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleDocs.map((doc) => (
              <TableRow key={doc.title}>
                <TableCell>{doc.title}</TableCell>
                <TableCell>{doc.category}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={doc.status}
                    sx={badgeSx(doc.status === "Approved" ? "secondary" : doc.status === "Review" ? "warning" : "outline")}
                  />
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
        </TableContainer>
      </div>
    </div>
  );
}
