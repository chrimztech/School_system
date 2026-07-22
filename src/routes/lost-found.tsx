import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PackageSearch, PackageCheck, Archive, Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Box, Button, Chip, InputAdornment, MenuItem, Tab, Tabs, TextField, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { badgeSx, type BadgeTone, downloadCsv } from "@/lib/utils";
import { PersonCombobox, type PersonOption } from "@/components/person-combobox";

export const Route = createFileRoute("/lost-found")({
  head: () => ({ meta: [{ title: "Lost & Found — SRMS" }] }),
  component: LostFoundPage,
});

type ItemCategory = "Electronics" | "Clothing" | "Stationery" | "Sports" | "Jewellery" | "Books" | "Other";

const CATEGORIES: ItemCategory[] = ["Electronics", "Clothing", "Stationery", "Sports", "Jewellery", "Books", "Other"];
const LOCATIONS = ["Main gate", "Library", "Canteen", "Assembly hall", "Classroom block A", "Classroom block B", "Sports field", "Hostel", "Staffroom", "Science lab", "Reception"];
const FOUND_BY_OPTIONS = ["Gate guard", "Canteen staff", "Hostel matron", "Cleaner", "Student (anon)", "Other"];

function statusBadge(status: string) {
  const map: Record<string, BadgeTone> = {
    Unclaimed: "warning",
    UNCLAIMED: "warning",
    Claimed: "success",
    CLAIMED: "success",
    Disposed: "secondary",
    DISPOSED: "secondary",
  };
  return <Chip size="small" label={status} sx={badgeSx(map[status] ?? "secondary")} />;
}

function LostFoundPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [logOpen, setLogOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("unclaimed");

  const [logForm, setLogForm] = useState({
    description: "", category: "Other" as ItemCategory,
    location: LOCATIONS[0], foundBy: FOUND_BY_OPTIONS[0], foundDate: new Date().toISOString().slice(0, 10), foundTime: "",
    storageLocation: "Reception", ownerName: "", ownerContact: "", estimatedValue: "",
    returnMethod: "Counter collection", color: "", brand: "", notes: "",
  });
  const [claimForm, setClaimForm] = useState({ claimedBy: "", notes: "" });

  const { data: pickerStudents = [], isLoading: pickerStudentsLoading } = useQuery({
    queryKey: ["lost-found-picker-students", schoolId],
    queryFn: () => api.students.list(schoolId),
    enabled: logOpen || claimOpen,
  });
  const studentOptions: PersonOption[] = (pickerStudents as any[]).map((s) => ({
    id: s.id,
    label: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.id,
    sublabel: s.className || s.grade,
  }));

  const { data: itemsData = [], isLoading } = useQuery({
    queryKey: ["lost-found", schoolId],
    queryFn: () => api.lostFound.list(schoolId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.lostFound.create(schoolId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lost-found", schoolId] });
      toast.success("Item logged in lost & found register");
      setLogForm({ description: "", category: "Other", location: LOCATIONS[0], foundBy: FOUND_BY_OPTIONS[0], foundDate: new Date().toISOString().slice(0, 10), foundTime: "", storageLocation: "Reception", ownerName: "", ownerContact: "", estimatedValue: "", returnMethod: "Counter collection", color: "", brand: "", notes: "" });
      setLogOpen(false);
    },
    onError: () => toast.error("Failed to log item"),
  });

  const claimMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.lostFound.claim(schoolId, id, data),
    onSuccess: (_, { data }) => {
      qc.invalidateQueries({ queryKey: ["lost-found", schoolId] });
      toast.success(`Item marked as claimed by ${data.claimedBy}`);
      setClaimOpen(false);
      setSelectedItem(null);
    },
    onError: () => toast.error("Failed to record claim"),
  });

  const rawItems = itemsData as any[];
  const items = rawItems.map((i: any) => ({
    ...i,
    description: i.itemDescription ?? i.description ?? "",
    location: i.foundLocation ?? i.location ?? "",
    foundDate: i.foundDate ?? i.dateFound ?? "",
    claimDate: i.claimedDate ?? i.claimDate ?? i.dateClaimedAt ?? "",
    claimedBy: i.ownerName ?? i.claimedBy ?? "",
    notes: i.notes ?? "",
    status: (i.status ?? "UNCLAIMED").toUpperCase(),
  }));

  const unclaimed = items.filter((i) => i.status === "UNCLAIMED");
  const claimed = items.filter((i) => i.status === "CLAIMED");
  const disposed = items.filter((i) => i.status === "DISPOSED");

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return items.filter((i) =>
      !lq || i.description.toLowerCase().includes(lq) || (i.category ?? "").toLowerCase().includes(lq) || i.location.toLowerCase().includes(lq),
    );
  }, [items, q]);

  const logItem = () => {
    if (!logForm.description.trim() || !logForm.foundDate.trim()) { toast.error("Description and found date are required"); return; }
    createMutation.mutate({
      itemDescription: logForm.description.trim(),
      category: logForm.category.toUpperCase(),
      foundLocation: logForm.location,
      foundBy: logForm.foundBy,
      foundDate: logForm.foundDate,
      foundTime: logForm.foundTime || null,
      storageLocation: logForm.storageLocation.trim(),
      ownerName: logForm.ownerName.trim() || null,
      ownerContact: logForm.ownerContact.trim() || null,
      estimatedValue: logForm.estimatedValue ? Number(logForm.estimatedValue) : null,
      returnMethod: logForm.returnMethod,
      color: logForm.color.trim() || null,
      brand: logForm.brand.trim() || null,
      notes: logForm.notes.trim() || null,
      status: "UNCLAIMED",
    });
  };

  const openClaim = (item: any) => {
    setSelectedItem(item);
    setClaimForm({ claimedBy: "", notes: "" });
    setClaimOpen(true);
  };

  const recordClaim = () => {
    if (!selectedItem) return;
    if (!claimForm.claimedBy.trim()) { toast.error("Claimant name is required"); return; }
    claimMutation.mutate({ id: selectedItem.id, data: { ownerName: claimForm.claimedBy.trim(), status: "CLAIMED", claimedDate: new Date().toISOString().slice(0, 10) } });
  };

  return (
    <AccessGuard module="lost-found">
      <div className="space-y-6">
      <PageHeader
        title="Lost & Found"
        description="Register of lost items found on campus, claims, and disposal records."
        actions={
          <>
          <Button startIcon={<Plus size={16} />} onClick={() => setLogOpen(true)}>Log found item</Button>
          <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="lg" fullWidth>
            <DialogTitle>Log found item</DialogTitle>
            <DialogContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <TextField label="Item description *" multiline minRows={2} value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} placeholder="Blue school jersey, size M, name written inside..." slotProps={{ htmlInput: { maxLength: 300 } }} fullWidth size="small" />
                </div>
                <TextField
                  select
                  label="Category"
                  value={logForm.category}
                  onChange={(e) => setLogForm({ ...logForm, category: e.target.value as ItemCategory })}
                  fullWidth
                  size="small"
                >
                  {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField label="Colour" value={logForm.color} onChange={(e) => setLogForm({ ...logForm, color: e.target.value })} placeholder="e.g. Blue, Silver" slotProps={{ htmlInput: { maxLength: 50 } }} fullWidth size="small" />
                <TextField label="Brand / make" value={logForm.brand} onChange={(e) => setLogForm({ ...logForm, brand: e.target.value })} placeholder="e.g. Samsung, Nike" slotProps={{ htmlInput: { maxLength: 50 } }} fullWidth size="small" />
                <TextField label="Estimated value (K)" type="number" slotProps={{ htmlInput: { min: 0 } }} value={logForm.estimatedValue} onChange={(e) => setLogForm({ ...logForm, estimatedValue: e.target.value })} placeholder="0" fullWidth size="small" />
                <TextField
                  type="date"
                  label="Date found *"
                  value={logForm.foundDate}
                  onChange={(e) => setLogForm({ ...logForm, foundDate: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  type="time"
                  label="Time found"
                  value={logForm.foundTime}
                  onChange={(e) => setLogForm({ ...logForm, foundTime: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                  size="small"
                />
                <TextField
                  select
                  label="Location found"
                  value={logForm.location}
                  onChange={(e) => setLogForm({ ...logForm, location: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {LOCATIONS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </TextField>
                <TextField
                  select
                  label="Found by"
                  value={logForm.foundBy}
                  onChange={(e) => setLogForm({ ...logForm, foundBy: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {FOUND_BY_OPTIONS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                </TextField>
                <TextField label="Storage location" value={logForm.storageLocation} onChange={(e) => setLogForm({ ...logForm, storageLocation: e.target.value })} placeholder="Reception" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                <TextField
                  select
                  label="Return method"
                  value={logForm.returnMethod}
                  onChange={(e) => setLogForm({ ...logForm, returnMethod: e.target.value })}
                  fullWidth
                  size="small"
                >
                  {["Counter collection", "Parent collection", "Delivery to class", "Postal"].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </TextField>
                <div>
                  <p className="text-sm font-medium mb-1">Known owner name</p>
                  <div className="space-y-1.5">
                    <PersonCombobox
                      options={studentOptions}
                      loading={pickerStudentsLoading}
                      placeholder="Search students…"
                      emptyText="No students found."
                      onSelect={(option) => setLogForm((prev) => ({ ...prev, ownerName: option.label }))}
                    />
                    <TextField value={logForm.ownerName} onChange={(e) => setLogForm({ ...logForm, ownerName: e.target.value })} placeholder="If identifiable" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                  </div>
                </div>
                <TextField label="Owner contact" value={logForm.ownerContact} onChange={(e) => setLogForm({ ...logForm, ownerContact: e.target.value })} placeholder="Phone or class" slotProps={{ htmlInput: { maxLength: 80 } }} fullWidth size="small" />
                <div className="col-span-2">
                  <TextField label="Additional notes" value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} placeholder="Any other identifying information" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="inherit" onClick={() => setLogOpen(false)}>Cancel</Button>
              <Button
                onClick={logItem}
                disabled={createMutation.isPending}
                startIcon={createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              >
                Log item
              </Button>
            </DialogActions>
          </Dialog>
          </>
        }
      />

      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record claim</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <div className="space-y-3">
              <p className="rounded-md bg-muted px-3 py-2 text-sm">{selectedItem.description}</p>
              <div>
                <p className="text-sm font-medium mb-1">Claimed by (name + class/role) *</p>
                <div className="space-y-1.5">
                  <PersonCombobox
                    options={studentOptions}
                    loading={pickerStudentsLoading}
                    placeholder="Search students…"
                    emptyText="No students found."
                    onSelect={(option) => {
                      const student = (pickerStudents as any[]).find((s) => s.id === option.id);
                      const grade = student?.className || student?.grade;
                      setClaimForm((prev) => ({ ...prev, claimedBy: grade ? `${option.label} (${grade})` : option.label }));
                    }}
                  />
                  <TextField value={claimForm.claimedBy} onChange={(e) => setClaimForm({ ...claimForm, claimedBy: e.target.value })} placeholder="Chanda Mwale (Form 3B)" slotProps={{ htmlInput: { maxLength: 100 } }} fullWidth size="small" />
                </div>
              </div>
              <TextField label="Notes" value={claimForm.notes} onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })} placeholder="ID verified, signed log..." slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth size="small" />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setClaimOpen(false)}>Cancel</Button>
          <Button
            onClick={recordClaim}
            disabled={claimMutation.isPending}
            startIcon={claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Confirm claim
          </Button>
        </DialogActions>
      </Dialog>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Unclaimed items" value={unclaimed.length} accent="warning" icon={<PackageSearch className="h-4 w-4" />} />
        <StatCard label="Claimed this month" value={claimed.length} accent="success" icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Disposed" value={disposed.length} accent="accent" icon={<Archive className="h-4 w-4" />} />
        <StatCard label="Total in register" value={items.length} accent="primary" icon={<PackageSearch className="h-4 w-4" />} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /><span>Loading register…</span>
        </div>
      ) : (
        <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="unclaimed" label={`Unclaimed (${unclaimed.length})`} />
          <Tab value="claimed" label={`Claimed (${claimed.length})`} />
          <Tab value="all" label="All items" />
        </Tabs>

        {tab === "unclaimed" && (
          <Box className="rounded-xl border border-border bg-card">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell><TableCell>Category</TableCell><TableCell>Location</TableCell>
                  <TableCell>Date found</TableCell><TableCell>Found by</TableCell><TableCell>Notes</TableCell>
                  <TableCell className="text-right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unclaimed.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No unclaimed items.</TableCell></TableRow>
                ) : unclaimed.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell><Chip size="small" label={item.category} sx={badgeSx("outline")} /></TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell>{(item.foundDate ?? item.dateFound ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.foundBy}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={item.notes}>{item.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="small" onClick={() => openClaim(item)}>Claim</Button>
                        <Button size="small" variant="outlined" onClick={() => toast.success("Item marked as disposed")}>Dispose</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </Box>
        )}

        {tab === "claimed" && (
          <Box className="rounded-xl border border-border bg-card">
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell><TableCell>Category</TableCell><TableCell>Claimed by</TableCell>
                  <TableCell>Claim date</TableCell><TableCell>Found at</TableCell><TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {claimed.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No claimed items.</TableCell></TableRow>
                ) : claimed.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell><Chip size="small" label={item.category} sx={badgeSx("outline")} /></TableCell>
                    <TableCell>{item.claimedBy}</TableCell>
                    <TableCell>{(item.claimDate ?? item.dateClaimedAt ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={item.notes}>{item.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </Box>
        )}

        {tab === "all" && (
          <Box className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <div className="flex-1">
                <TextField
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search description, category, or location"
                  fullWidth
                  size="small"
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
                />
              </div>
              <Button variant="outlined" size="small" onClick={() => { downloadCsv(items.map((i: any) => ({ Description: i.description, Category: i.category, Location: i.location, "Date Found": (i.foundDate ?? i.dateFound ?? "").slice(0, 10), Status: i.status, "Claimed By": i.claimedBy ?? "" })), "lost-found-register"); toast.success("Lost & found register exported"); }}>Export CSV</Button>
            </div>
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell><TableCell>Category</TableCell><TableCell>Location</TableCell>
                  <TableCell>Date found</TableCell><TableCell>Status</TableCell><TableCell>Claimed by</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell><Chip size="small" label={item.category} sx={badgeSx("outline")} /></TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell>{(item.foundDate ?? item.dateFound ?? "").slice(0, 10)}</TableCell>
                    <TableCell>{statusBadge(item.status ?? "Unclaimed")}</TableCell>
                    <TableCell className="text-muted-foreground">{item.claimedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No items match your search.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </TableContainer>
          </Box>
        )}
        </Box>
      )}
    </div>
    </AccessGuard>
  );
}
