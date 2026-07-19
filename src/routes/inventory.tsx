import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Package, ShoppingCart, Truck, AlertTriangle, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { downloadCsv } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory & Procurement — SRMS" }] }),
  component: InventoryPage,
});

const CATEGORIES = ["Stationery", "Cleaning", "Furniture", "ICT", "Sports", "Medical", "Kitchen", "Other"];
const LOCATIONS = ["Store A", "Store B", "ICT Lab", "Workshop", "Sports Stores", "Medical Room", "Kitchen"];

function InventoryPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [lowOnly, setLowOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    category: CATEGORIES[0],
    qty: "",
    min: "10",
    unit: "pcs",
    location: LOCATIONS[0],
    cost: "",
    lastRestockedDate: new Date().toISOString().slice(0, 10),
    status: "IN_STOCK",
    supplierName: "",
    barcode: "",
    serialNumber: "",
    condition: "Good",
    expiryDate: "",
    warrantyExpiry: "",
    assetTag: "",
  });

  const { data: itemsData = [], isLoading } = useQuery({
    queryKey: ["inventory", schoolId],
    queryFn: () => api.inventory.items(schoolId),
  });

  const reorderMutation = useMutation({
    mutationFn: (item: any) => api.inventory.recordMovement(schoolId, {
      itemId: item.id,
      itemCode: item.code ?? item.itemCode,
      itemName: item.name,
      movementType: "REORDER",
      quantity: item.min ?? item.reorderLevel ?? 10,
      notes: "Reorder request triggered from stock register",
    }),
    onSuccess: (_: any, item: any) => {
      toast.success(`Reorder request logged for ${item.name}`);
    },
    onError: () => toast.error("Failed to log reorder request"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.inventory.create(schoolId, data),
    onSuccess: (item: any) => {
      qc.invalidateQueries({ queryKey: ["inventory", schoolId] });
      toast.success(`${item.name ?? form.name} added to stock register`);
      setForm({
        code: "",
        name: "",
        category: CATEGORIES[0],
        qty: "",
        min: "10",
        unit: "pcs",
        location: LOCATIONS[0],
        cost: "",
        lastRestockedDate: new Date().toISOString().slice(0, 10),
        status: "IN_STOCK",
        supplierName: "",
        barcode: "",
        serialNumber: "",
        condition: "Good",
        expiryDate: "",
        warrantyExpiry: "",
        assetTag: "",
      });
      setAddOpen(false);
    },
    onError: () => toast.error("Failed to add item"),
  });

  const addItem = () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Code and name are required"); return; }
    createMutation.mutate({
      itemCode: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      quantityInStock: Number(form.qty) || 0,
      reorderLevel: Number(form.min) || 10,
      unit: form.unit.trim() || "pcs",
      location: form.location,
      unitCost: Number(form.cost) || 0,
      lastRestockedDate: form.lastRestockedDate,
      status: form.status,
      supplierName: form.supplierName.trim() || null,
      barcode: form.barcode.trim() || null,
      serialNumber: form.serialNumber.trim() || null,
      condition: form.condition,
      expiryDate: form.expiryDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
      assetTag: form.assetTag.trim() || null,
    });
  };

  const stockItems = (itemsData as any[]).map((item: any) => ({
    ...item,
    qty: item.qty ?? item.quantity ?? item.quantityInStock ?? 0,
    min: item.min ?? item.minQuantity ?? item.reorderLevel ?? 10,
    code: item.code ?? item.itemCode ?? "",
    cost: item.cost ?? item.unitCost ?? 0,
  }));
  const lowCount = stockItems.filter((i: any) => i.qty < i.min).length;
  const visible = lowOnly ? stockItems.filter((i: any) => i.qty < i.min) : stockItems;

  return (
    <AccessGuard module="inventory">
      <div className="space-y-6">
      <PageHeader
        title="Inventory & Procurement"
        description="Stock control, suppliers, purchase orders and goods-received notes."
        actions={
          <>
            <Button variant="outline" onClick={() => {
              if (stockItems.length === 0) { toast.error("No items to export"); return; }
              downloadCsv(stockItems.map((i: any) => ({
                Code: i.code ?? i.itemCode ?? "",
                Name: i.name ?? "",
                Category: i.category ?? "",
                Quantity: i.qty ?? i.quantityInStock ?? 0,
                Unit: i.unit ?? "",
                "Min Reorder": i.min ?? i.reorderLevel ?? 0,
                Location: i.location ?? "",
                "Unit Cost": i.cost ?? i.unitCost ?? 0,
                Condition: i.condition ?? "",
                Status: i.status ?? "",
                Supplier: i.supplierName ?? "",
                "Last Restocked": i.lastRestockedDate ?? "",
              })), `stock-take-${new Date().toISOString().slice(0, 10)}`);
            }}>Stock take</Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add item</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add stock item</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Item code *</Label>
                    <Input className="mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="STA-022" maxLength={20} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Item name *</Label>
                    <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Printer ink cartridges" maxLength={100} />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input className="mt-1" type="number" min={0} value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <Label>Min reorder</Label>
                    <Input className="mt-1" type="number" min={1} value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input className="mt-1" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" maxLength={20} />
                  </div>
                  <div>
                    <Label>Unit cost (K)</Label>
                    <Input className="mt-1" type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["New", "Good", "Fair", "Poor"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Supplier name</Label>
                    <Input className="mt-1" value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} placeholder="Saro Agro Stationers" maxLength={100} />
                  </div>
                  <div>
                    <Label>Barcode / SKU</Label>
                    <Input className="mt-1" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="6009880123456" maxLength={50} />
                  </div>
                  <div>
                    <Label>Serial number</Label>
                    <Input className="mt-1" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-2026-00123" maxLength={50} />
                  </div>
                  <div>
                    <Label>Asset tag</Label>
                    <Input className="mt-1" value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} placeholder="ASSET-00441" maxLength={30} />
                  </div>
                  <div>
                    <Label>Last restocked</Label>
                    <Input className="mt-1" type="date" value={form.lastRestockedDate} onChange={(e) => setForm({ ...form, lastRestockedDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Expiry date</Label>
                    <Input className="mt-1" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Warranty expiry</Label>
                    <Input className="mt-1" type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN_STOCK">In stock</SelectItem>
                        <SelectItem value="LOW_STOCK">Low stock</SelectItem>
                        <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={addItem} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add item
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" asChild><Link to="/procurement"><Plus className="mr-1 h-4 w-4" />New PO</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stock items" value={stockItems.length} accent="primary" icon={<Package className="h-4 w-4" />} />
        <StatCard label="Low-stock alerts" value={lowCount} hint="Below reorder level" accent="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Open POs" value={0} accent="accent" icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Suppliers" value={0} accent="success" icon={<Truck className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="po">Purchase orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="grn">Goods received</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-medium">All items</p>
            <Button size="sm" variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly((v) => !v)}>
              {lowOnly ? "Show all" : `Show low stock (${lowCount})`}
            </Button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading stock…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead>
                <TableHead>Qty</TableHead><TableHead>Unit</TableHead><TableHead>Location</TableHead>
                <TableHead>Unit cost</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {visible.map((i: any) => {
                  const qty = i.qty ?? i.quantity ?? 0;
                  const min = i.min ?? i.minQuantity ?? 10;
                  const low = qty < min;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.code ?? i.itemCode}</TableCell>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>{i.category}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={low ? "text-destructive" : "text-success"}>{qty}</Badge>
                      </TableCell>
                      <TableCell>{i.unit}</TableCell>
                      <TableCell className="text-muted-foreground">{i.location}</TableCell>
                      <TableCell>K {(i.cost ?? i.unitCost ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" disabled={reorderMutation.isPending} onClick={() => reorderMutation.mutate(i)}>
                          Reorder
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visible.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No items in stock register.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="po" className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={ShoppingCart}
            title="No purchase orders yet"
            description="Purchase orders raised against suppliers will appear here."
          />
        </TabsContent>

        <TabsContent value="suppliers" className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Truck}
            title="No suppliers on file yet"
            description="Registered suppliers and their contact details will appear here."
          />
        </TabsContent>

        <TabsContent value="grn" className="rounded-xl border border-border bg-card p-5">
          <EmptyState
            icon={Package}
            title="No goods received yet"
            description="Delivery records against purchase orders will appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
    </AccessGuard>
  );
}
