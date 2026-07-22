import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Package, ShoppingCart, Truck, AlertTriangle, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { PageHeader, StatCard } from "@/components/page-header";
import { Box, Button, Chip, MenuItem, Tab, Tabs, TextField, Dialog, DialogContent, DialogActions, DialogTitle, TableContainer, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { AccessGuard } from "@/components/access-guard";
import { downloadCsv, badgeSx } from "@/lib/utils";

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
  const [tab, setTab] = useState("stock");
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
            <Button variant="outlined" onClick={() => {
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
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>Add item</Button>
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Add stock item</DialogTitle>
              <DialogContent>
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Item code *"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="STA-022"
                    slotProps={{ htmlInput: { maxLength: 20 } }}
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
                  <div className="col-span-2">
                    <TextField
                      label="Item name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Printer ink cartridges"
                      slotProps={{ htmlInput: { maxLength: 100 } }}
                      fullWidth
                      size="small"
                    />
                  </div>
                  <TextField
                    label="Quantity"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.qty}
                    onChange={(e) => setForm({ ...form, qty: e.target.value })}
                    placeholder="0"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Min reorder"
                    type="number"
                    slotProps={{ htmlInput: { min: 1 } }}
                    value={form.min}
                    onChange={(e) => setForm({ ...form, min: e.target.value })}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Unit"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="pcs"
                    slotProps={{ htmlInput: { maxLength: 20 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Unit cost (K)"
                    type="number"
                    slotProps={{ htmlInput: { min: 0 } }}
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    placeholder="0"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Location"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {LOCATIONS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                  </TextField>
                  <TextField
                    select
                    label="Condition"
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    {["New", "Good", "Fair", "Poor"].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Supplier name"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                    placeholder="Saro Agro Stationers"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Barcode / SKU"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="6009880123456"
                    slotProps={{ htmlInput: { maxLength: 50 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Serial number"
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    placeholder="SN-2026-00123"
                    slotProps={{ htmlInput: { maxLength: 50 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Asset tag"
                    value={form.assetTag}
                    onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
                    placeholder="ASSET-00441"
                    slotProps={{ htmlInput: { maxLength: 30 } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Last restocked"
                    type="date"
                    value={form.lastRestockedDate}
                    onChange={(e) => setForm({ ...form, lastRestockedDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Expiry date"
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Warranty expiry"
                    type="date"
                    value={form.warrantyExpiry}
                    onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    select
                    label="Status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="IN_STOCK">In stock</MenuItem>
                    <MenuItem value="LOW_STOCK">Low stock</MenuItem>
                    <MenuItem value="OUT_OF_STOCK">Out of stock</MenuItem>
                  </TextField>
                </div>
              </DialogContent>
              <DialogActions className="mt-2">
                <Button variant="outlined" color="inherit" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={addItem} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add item
                </Button>
              </DialogActions>
            </Dialog>
            <Button variant="outlined" component={Link} to="/procurement" startIcon={<Plus className="h-4 w-4" />}>New PO</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Stock items" value={stockItems.length} accent="primary" icon={<Package className="h-4 w-4" />} />
        <StatCard label="Low-stock alerts" value={lowCount} hint="Below reorder level" accent="warning" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Open POs" value={0} accent="accent" icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Suppliers" value={0} accent="success" icon={<Truck className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="stock" label="Stock" />
        <Tab value="po" label="Purchase orders" />
        <Tab value="suppliers" label="Suppliers" />
        <Tab value="grn" label="Goods received" />
      </Tabs>

      {tab === "stock" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-medium">All items</p>
            <Button size="small" variant={lowOnly ? "contained" : "outlined"} onClick={() => setLowOnly((v) => !v)}>
              {lowOnly ? "Show all" : `Show low stock (${lowCount})`}
            </Button>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading stock…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Code</TableCell><TableCell>Item</TableCell><TableCell>Category</TableCell>
                <TableCell>Qty</TableCell><TableCell>Unit</TableCell><TableCell>Location</TableCell>
                <TableCell>Unit cost</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
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
                        <Chip size="small" label={qty} sx={badgeSx(low ? "destructive" : "success")} />
                      </TableCell>
                      <TableCell>{i.unit}</TableCell>
                      <TableCell className="text-muted-foreground">{i.location}</TableCell>
                      <TableCell>K {(i.cost ?? i.unitCost ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="small" variant="text" color="inherit" disabled={reorderMutation.isPending} onClick={() => reorderMutation.mutate(i)}>
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
            </TableContainer>
          )}
        </Box>
      )}

      {tab === "po" && (
        <Box className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={ShoppingCart}
            title="No purchase orders yet"
            description="Purchase orders raised against suppliers will appear here."
          />
        </Box>
      )}

      {tab === "suppliers" && (
        <Box className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={Truck}
            title="No suppliers on file yet"
            description="Registered suppliers and their contact details will appear here."
          />
        </Box>
      )}

      {tab === "grn" && (
        <Box className="rounded-xl border border-border bg-card p-5">
          <EmptyState
            icon={Package}
            title="No goods received yet"
            description="Delivery records against purchase orders will appear here."
          />
        </Box>
      )}
      </Box>
    </div>
    </AccessGuard>
  );
}
