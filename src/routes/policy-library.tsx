import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Download, FileText, FolderOpen, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/policy-library")({
  head: () => ({ meta: [{ title: "Policy Library — SRMS" }] }),
  component: PolicyLibraryPage,
});

const CATEGORIES = ["Governance", "Safety", "Procurement", "Discipline", "Finance", "ICT"];
const STATUSES = ["Review", "Approved", "Draft"];

function createForm() {
  return { title: "", category: CATEGORIES[0], status: "Review", fileName: "", fileUrl: "" };
}

function PolicyLibraryPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const schoolId = active.id;
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [reviewOnly, setReviewOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(createForm());

  const { data: docsRaw = [], isLoading } = useQuery({
    queryKey: ["policy-documents", schoolId],
    queryFn: () => api.policyDocuments.list(schoolId),
  });
  const docs = docsRaw as any[];

  const visibleDocs = useMemo(
    () => (reviewOnly ? docs.filter((doc) => doc.status === "Review") : docs),
    [docs, reviewOnly],
  );

  const createMutation = useMutation({
    mutationFn: (data: any) => api.policyDocuments.create(schoolId, data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", schoolId] });
      toast.success(`${variables.title} added to the library`);
      setForm(createForm());
      setOpen(false);
    },
    onError: () => toast.error("Failed to add policy"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.policyDocuments.update(schoolId, id, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", schoolId] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.policyDocuments.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy-documents", schoolId] });
      toast.success("Policy removed");
    },
    onError: () => toast.error("Failed to remove policy"),
  });

  const handleFile = (file: File) => {
    if (file.size > 5_000_000) {
      toast.error("File too large. Max 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, fileUrl: reader.result as string, fileName: file.name }));
    reader.readAsDataURL(file);
  };

  const addPolicy = () => {
    if (!form.title.trim()) {
      toast.error("Policy title is required");
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      uploadedBy: user?.name ?? "Unknown",
      fileUrl: form.fileUrl || null,
      fileName: form.fileName || null,
    });
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
              <div className="grid gap-3 pt-1">
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
                  {CATEGORIES.map((category) => (
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
                  {STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </TextField>
                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <Button variant="outlined" startIcon={<Upload size={16} />} onClick={() => fileInput.current?.click()} fullWidth>
                    {form.fileName || "Attach file (optional, max 5MB)"}
                  </Button>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={addPolicy}
                disabled={createMutation.isPending}
                startIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                Add policy
              </Button>
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
          <p className="mt-4 truncate text-2xl font-semibold text-foreground">{docs[0]?.title ?? "No documents"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {docs[0]?.updatedAt ? `Updated ${String(docs[0].updatedAt).slice(0, 10)}` : "n/a"}
          </p>
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
              <TableCell className="text-right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            ) : visibleDocs.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="font-medium">{doc.title}</div>
                  {doc.uploadedBy && <div className="text-xs text-muted-foreground">Uploaded by {doc.uploadedBy}</div>}
                </TableCell>
                <TableCell>{doc.category}</TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={STATUSES.includes(doc.status) ? doc.status : "Review"}
                    onChange={(e) => updateMutation.mutate({ id: doc.id, status: e.target.value })}
                    sx={{ minWidth: 130 }}
                  >
                    {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell>{String(doc.updatedAt ?? doc.createdAt ?? "").slice(0, 10) || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {doc.fileUrl && (
                      <Tooltip title="Download">
                        <IconButton size="small" component="a" href={doc.fileUrl} download={doc.fileName || doc.title}>
                          <Download size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Remove">
                      <IconButton size="small" onClick={() => deleteMutation.mutate(doc.id)} disabled={deleteMutation.isPending}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && visibleDocs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
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
