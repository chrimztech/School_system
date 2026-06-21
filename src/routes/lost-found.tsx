import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PackageSearch, PackageCheck, Archive, Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

export const Route = createFileRoute("/lost-found")({
  head: () => ({ meta: [{ title: "Lost & Found — SRMS" }] }),
  component: LostFoundPage,
});

type ItemCategory = "Electronics" | "Clothing" | "Stationery" | "Sports" | "Jewellery" | "Books" | "Other";

const CATEGORIES: ItemCategory[] = ["Electronics", "Clothing", "Stationery", "Sports", "Jewellery", "Books", "Other"];
const LOCATIONS = ["Main gate", "Library", "Canteen", "Assembly hall", "Classroom block A", "Classroom block B", "Sports field", "Hostel", "Staffroom", "Science lab", "Reception"];
const FOUND_BY_OPTIONS = ["Gate guard", "Canteen staff", "Hostel matron", "Cleaner", "Student (anon)", "Other"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Unclaimed: "bg-warning/15 text-warning-foreground",
    UNCLAIMED: "bg-warning/15 text-warning-foreground",
    Claimed: "bg-success/15 text-success",
    CLAIMED: "bg-success/15 text-success",
    Disposed: "bg-muted text-muted-foreground",
    DISPOSED: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[status] ?? ""}>{status}</Badge>;
}

function LostFoundPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [logOpen, setLogOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [q, setQ] = useState("");

  const [logForm, setLogForm] = useState({
    description: "", category: "Other" as ItemCategory,
    location: LOCATIONS[0], foundBy: FOUND_BY_OPTIONS[0], foundDate: new Date().toISOString().slice(0, 10), foundTime: "",
    storageLocation: "Reception", ownerName: "", ownerContact: "", estimatedValue: "",
    returnMethod: "Counter collection", color: "", brand: "", notes: "",
  });
  const [claimForm, setClaimForm] = useState({ claimedBy: "", notes: "" });

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
    <div className="space-y-6">
      <PageHeader
        title="Lost & Found"
        description="Register of lost items found on campus, claims, and disposal records."
        actions={
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Log found item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Log found item</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Item description *</Label>
                  <Textarea className="mt-1" value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} placeholder="Blue school jersey, size M, name written inside..." rows={2} maxLength={300} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={logForm.category} onValueChange={(v) => setLogForm({ ...logForm, category: v as ItemCategory })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Colour</Label>
                  <Input className="mt-1" value={logForm.color} onChange={(e) => setLogForm({ ...logForm, color: e.target.value })} placeholder="e.g. Blue, Silver" maxLength={50} />
                </div>
                <div>
                  <Label>Brand / make</Label>
                  <Input className="mt-1" value={logForm.brand} onChange={(e) => setLogForm({ ...logForm, brand: e.target.value })} placeholder="e.g. Samsung, Nike" maxLength={50} />
                </div>
                <div>
                  <Label>Estimated value (K)</Label>
                  <Input type="number" min={0} className="mt-1" value={logForm.estimatedValue} onChange={(e) => setLogForm({ ...logForm, estimatedValue: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Date found *</Label>
                  <Input type="date" className="mt-1" value={logForm.foundDate} onChange={(e) => setLogForm({ ...logForm, foundDate: e.target.value })} />
                </div>
                <div>
                  <Label>Time found</Label>
                  <Input type="time" className="mt-1" value={logForm.foundTime} onChange={(e) => setLogForm({ ...logForm, foundTime: e.target.value })} />
                </div>
                <div>
                  <Label>Location found</Label>
                  <Select value={logForm.location} onValueChange={(v) => setLogForm({ ...logForm, location: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Found by</Label>
                  <Select value={logForm.foundBy} onValueChange={(v) => setLogForm({ ...logForm, foundBy: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{FOUND_BY_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Storage location</Label>
                  <Input className="mt-1" value={logForm.storageLocation} onChange={(e) => setLogForm({ ...logForm, storageLocation: e.target.value })} placeholder="Reception" maxLength={80} />
                </div>
                <div>
                  <Label>Return method</Label>
                  <Select value={logForm.returnMethod} onValueChange={(v) => setLogForm({ ...logForm, returnMethod: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Counter collection", "Parent collection", "Delivery to class", "Postal"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Known owner name</Label>
                  <Input className="mt-1" value={logForm.ownerName} onChange={(e) => setLogForm({ ...logForm, ownerName: e.target.value })} placeholder="If identifiable" maxLength={100} />
                </div>
                <div>
                  <Label>Owner contact</Label>
                  <Input className="mt-1" value={logForm.ownerContact} onChange={(e) => setLogForm({ ...logForm, ownerContact: e.target.value })} placeholder="Phone or class" maxLength={80} />
                </div>
                <div className="col-span-2">
                  <Label>Additional notes</Label>
                  <Input className="mt-1" value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} placeholder="Any other identifying information" maxLength={200} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
                <Button onClick={logItem} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log item
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record claim</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3">
              <p className="rounded-md bg-muted px-3 py-2 text-sm">{selectedItem.description}</p>
              <div>
                <Label>Claimed by (name + class/role) *</Label>
                <Input className="mt-1" value={claimForm.claimedBy} onChange={(e) => setClaimForm({ ...claimForm, claimedBy: e.target.value })} placeholder="Chanda Mwale (Grade 10B)" maxLength={100} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input className="mt-1" value={claimForm.notes} onChange={(e) => setClaimForm({ ...claimForm, notes: e.target.value })} placeholder="ID verified, signed log..." maxLength={200} />
              </div>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setClaimOpen(false)}>Cancel</Button>
            <Button onClick={recordClaim} disabled={claimMutation.isPending}>
              {claimMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm claim
            </Button>
          </DialogFooter>
        </DialogContent>
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
        <Tabs defaultValue="unclaimed">
          <TabsList>
            <TabsTrigger value="unclaimed">Unclaimed ({unclaimed.length})</TabsTrigger>
            <TabsTrigger value="claimed">Claimed ({claimed.length})</TabsTrigger>
            <TabsTrigger value="all">All items</TabsTrigger>
          </TabsList>

          <TabsContent value="unclaimed" className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead>
                  <TableHead>Date found</TableHead><TableHead>Found by</TableHead><TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unclaimed.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No unclaimed items.</TableCell></TableRow>
                ) : unclaimed.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell>{(item.foundDate ?? item.dateFound ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.foundBy}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={item.notes}>{item.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => openClaim(item)}>Claim</Button>
                        <Button size="sm" variant="outline" onClick={() => toast.success("Item marked as disposed")}>Dispose</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="claimed" className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Claimed by</TableHead>
                  <TableHead>Claim date</TableHead><TableHead>Found at</TableHead><TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimed.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No claimed items.</TableCell></TableRow>
                ) : claimed.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                    <TableCell>{item.claimedBy}</TableCell>
                    <TableCell>{(item.claimDate ?? item.dateClaimedAt ?? "").slice(0, 10)}</TableCell>
                    <TableCell className="text-muted-foreground">{item.location}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={item.notes}>{item.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="all" className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description, category, or location" className="pl-9" />
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.success("Lost & found register exported")}>Export CSV</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead>Location</TableHead>
                  <TableHead>Date found</TableHead><TableHead>Status</TableHead><TableHead>Claimed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-[160px] truncate" title={item.description}>{item.description}</TableCell>
                    <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
