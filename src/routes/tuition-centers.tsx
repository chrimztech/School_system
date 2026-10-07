import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, Star, Trash2 } from "lucide-react";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { api } from "@/lib/api";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/tuition-centers")({
  head: () => ({ meta: [{ title: "Tuition Centres - SRMS" }] }),
  component: TuitionCentersPage,
});

function emptyForm() {
  return { name: "", subjects: "", district: "", province: "", address: "", phone: "", email: "", website: "", rating: "", ratingNote: "", active: true };
}

function toForm(c: any) {
  return {
    name: c.name ?? "", subjects: c.subjectsText ?? "", district: c.district ?? "", province: c.province ?? "",
    address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "", website: c.website ?? "",
    rating: c.rating != null ? String(c.rating) : "", ratingNote: c.ratingNote ?? "", active: c.active ?? true,
  };
}

function TuitionCentersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: centers = [], isLoading } = useQuery({ queryKey: ["tuition-centers"], queryFn: () => api.tuitionCenters.listPlatform() });
  const active = (centers as any[]).filter((c) => c.active);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["tuition-centers"] });

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        subjects: form.subjects.split(",").map((s) => s.trim()).filter(Boolean),
        district: form.district.trim() || null,
        province: form.province.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        rating: form.rating.trim() ? Number(form.rating) : null,
        ratingNote: form.ratingNote.trim() || null,
        active: form.active,
      };
      return editingId ? api.tuitionCenters.update(editingId, payload) : api.tuitionCenters.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Tuition centre updated" : "Tuition centre added");
      setOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not save"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.tuitionCenters.delete(id),
    onSuccess: () => { toast.success("Tuition centre removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Could not remove"),
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (c: any) => { setEditingId(c.id); setForm(toForm(c)); setOpen(true); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tuition Centres"
        description="The platform-wide directory parents' performance insights are matched against — one shared list every school draws from, ranked by district and rating."
        actions={<Button variant="contained" startIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add centre</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Listed" value={(centers as any[]).length} accent="primary" icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Active" value={active.length} accent="success" icon={<GraduationCap className="h-4 w-4" />} />
      </div>

      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (centers as any[]).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No tuition centres yet. Add the first one.</p>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Subjects</TableCell><TableCell>District / Province</TableCell><TableCell>Rating</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {(centers as any[]).map((c) => (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }}>
                    <TableCell onClick={() => openEdit(c)} className="font-medium">{c.name}</TableCell>
                    <TableCell onClick={() => openEdit(c)} className="max-w-[260px] truncate text-xs text-muted-foreground">{c.subjectsText}</TableCell>
                    <TableCell onClick={() => openEdit(c)}>{[c.district, c.province].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell onClick={() => openEdit(c)}>
                      {c.rating != null ? (
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{c.rating}/5</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell onClick={() => openEdit(c)}>
                      <Chip size="small" label={c.active ? "Active" : "Inactive"} sx={badgeSx(c.active ? "success" : "outline")} />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" aria-label="Delete" onClick={() => { if (window.confirm(`Remove ${c.name}?`)) deleteMut.mutate(c.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </section>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? "Edit tuition centre" : "Add tuition centre"}</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-2">
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} size="small" fullWidth required />
            <TextField label="Subjects (comma-separated)" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })}
              size="small" fullWidth required placeholder="Mathematics, Physics, English" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} size="small" />
              <TextField label="Province" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} size="small" />
            </div>
            <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} size="small" fullWidth />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} size="small" />
              <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} size="small" />
            </div>
            <TextField label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} size="small" fullWidth />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Rating (0-5)" type="number" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}
                size="small" slotProps={{ htmlInput: { min: 0, max: 5, step: 0.1 } }} />
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span className="text-sm">Active</span>
              </div>
            </div>
            <TextField label="Rating note" value={form.ratingNote} onChange={(e) => setForm({ ...form, ratingNote: e.target.value })}
              size="small" fullWidth multiline minRows={2} placeholder="e.g. Based on feedback from parents at three schools nearby" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.name.trim() || !form.subjects.trim() || saveMut.isPending} onClick={() => saveMut.mutate()}>
            {editingId ? "Save" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
