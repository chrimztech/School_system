import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingBag, AlertTriangle, TrendingUp, Plus, Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Chip, Button, TextField, MenuItem, Dialog, DialogContent, DialogActions, DialogTitle, DialogContentText, Box, Tabs, Tab, TableContainer, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { badgeSx, downloadCsv } from "@/lib/utils";

export const Route = createFileRoute("/canteen")({
  head: () => ({ meta: [{ title: "Canteen - SRMS" }] }),
  component: CanteenPage,
});

const MENU_CATEGORIES = ["Meals", "Snacks", "Beverages", "Fruits", "Confectionery"];
const PAYMENT_METHODS = ["Cash", "MoMo", "POS"] as const;
const CUSTOMER_TYPES = ["STUDENT", "STAFF", "WALK_IN"] as const;
const SALE_STATUSES = ["PAID", "PENDING", "CANCELLED"] as const;

function gradeNum(grade: string): number {
  const m = String(grade ?? "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function createSaleForm() {
  return {
    item: "",
    qty: "1",
    method: PAYMENT_METHODS[0] as (typeof PAYMENT_METHODS)[number],
    customerType: CUSTOMER_TYPES[0] as (typeof CUSTOMER_TYPES)[number],
    customerName: "",
    customerId: "",
    orderDate: new Date().toISOString().slice(0, 10),
    reference: "",
    notes: "",
    status: SALE_STATUSES[0] as (typeof SALE_STATUSES)[number],
  };
}

function createMenuForm() {
  return {
    name: "",
    category: MENU_CATEGORIES[0],
    price: "",
    costPrice: "",
    stock: "",
    minStock: "10",
    servingSize: "",
    unitOfMeasure: "each",
    issuePoint: "",
    allergens: "",
    description: "",
    available: "yes",
    isVegetarian: "no",
    isHalal: "no",
    supplier: "",
    preparationTime: "",
  };
}

function parseMenuDescription(description: string | null | undefined) {
  const meta: Record<string, string> = {};
  const body: string[] = [];
  for (const line of (description ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith("Serving size:")) meta.servingSize = line.replace("Serving size:", "").trim();
    else if (line.startsWith("Unit:")) meta.unitOfMeasure = line.replace("Unit:", "").trim();
    else if (line.startsWith("Issue point:")) meta.issuePoint = line.replace("Issue point:", "").trim();
    else if (line.startsWith("Opening stock:")) meta.stock = line.replace("Opening stock:", "").trim();
    else if (line.startsWith("Reorder level:")) meta.minStock = line.replace("Reorder level:", "").trim();
    else if (line.startsWith("Cost price:")) meta.costPrice = line.replace("Cost price:", "").trim();
    else if (line.startsWith("Supplier:")) meta.supplier = line.replace("Supplier:", "").trim();
    else if (line.startsWith("Prep time:")) meta.preparationTime = line.replace("Prep time:", "").trim();
    else if (line.startsWith("Allergens:")) meta.allergens = line.replace("Allergens:", "").trim();
    else if (line === "Vegetarian: yes") meta.isVegetarian = "yes";
    else if (line === "Halal: yes") meta.isHalal = "yes";
    else body.push(line);
  }
  meta.summary = body.join(" ");
  return meta;
}

function parseOrderItems(items: string | null | undefined) {
  const lines = (items ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const headline = lines[0] ?? "";
  const qtyMatch = headline.match(/x(\d+)/i);
  return {
    headline,
    quantity: qtyMatch ? Number(qtyMatch[1]) : 1,
    reference: lines.find((l) => l.startsWith("Reference:"))?.replace("Reference:", "").trim() ?? "",
    notes: lines.find((l) => l.startsWith("Notes:"))?.replace("Notes:", "").trim() ?? "",
  };
}

function CanteenPage() {
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [tab, setTab] = useState("access");
  const [saleOpen, setSaleOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessSearch, setAccessSearch] = useState("");
  const [saleForm, setSaleForm] = useState(createSaleForm);
  const [menuForm, setMenuForm] = useState(createMenuForm);

  // ── Data loading ──────────────────────────────────────────────
  const { data: menuData = [], isLoading: menuLoading } = useQuery({
    queryKey: ["canteen-menu", schoolId],
    queryFn: () => api.canteen.menu(schoolId),
  });

  const { data: ordersData = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["canteen-orders", schoolId],
    queryFn: () => api.canteen.orders(schoolId),
  });

  const { data: studentsData = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["students", schoolId],
    queryFn: () => api.students.list(schoolId),
  });

  const { data: paymentsData = [] } = useQuery({
    queryKey: ["fee-payments", schoolId],
    queryFn: () => api.fees.payments(schoolId),
  });

  const { data: structuresData = [] } = useQuery({
    queryKey: ["fee-structures", schoolId],
    queryFn: () => api.fees.structures(schoolId),
  });

  // ── Normalised data ───────────────────────────────────────────
  const menu = (menuData as any[]).map((item: any) => {
    const meta = parseMenuDescription(item.description);
    const stock = item.openingStock ?? item.stock ?? item.stockLevel ?? (meta.stock ? Number(meta.stock) : Number.POSITIVE_INFINITY);
    const minStock = item.reorderLevel ?? item.minStock ?? item.minStockLevel ?? (meta.minStock ? Number(meta.minStock) : 10);
    return {
      ...item,
      stock,
      minStock,
      servingSize: item.servingSize ?? meta.servingSize ?? "",
      unitOfMeasure: item.unitOfMeasure ?? meta.unitOfMeasure ?? "",
      issuePoint: item.issuePoint ?? meta.issuePoint ?? "",
      allergens: item.allergens ?? meta.allergens ?? "",
      costPrice: item.costPrice ?? meta.costPrice ?? "",
      supplier: item.supplier ?? meta.supplier ?? "",
      preparationTime: item.preparationTime ?? meta.preparationTime ?? "",
      isVegetarian: item.vegetarian ?? (meta.isVegetarian === "yes"),
      isHalal: item.halal ?? (meta.isHalal === "yes"),
    };
  });

  const sales = (ordersData as any[]).map((order: any) => {
    const parsed = parseOrderItems(order.items);
    return {
      ...order,
      displayItem: order.itemName || parsed.headline || order.item || "Mixed order",
      quantity: order.quantity ?? order.qty ?? parsed.quantity,
      total: Number(order.totalAmount ?? order.total ?? 0),
      customerName: order.customerName ?? order.studentName ?? order.student ?? "Walk-in",
      date: order.orderDate ?? order.createdAt ?? "",
      reference: order.referenceNumber ?? parsed.reference,
      notes: order.notes ?? parsed.notes,
      method: order.paymentMethod ?? order.method ?? "Cash",
      status: order.status ?? "PAID",
    };
  });

  // ── Dining access computation ─────────────────────────────────
  // Group all payments by studentId so we can sum per student
  const paidByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paymentsData as any[]) {
      const sid = p.studentId ?? p.student?.id ?? "";
      if (!sid) continue;
      map.set(sid, (map.get(sid) ?? 0) + Number(p.amount ?? p.amountPaid ?? 0));
    }
    return map;
  }, [paymentsData]);

  // For each student compute expected term fee from fee structures
  const accessList = useMemo(() => {
    const structs = structuresData as any[];
    return (studentsData as any[]).map((s: any) => {
      const grade = s.grade ?? s.class ?? s.className ?? "";
      const n = gradeNum(grade);
      const structure = structs.find(
        (fs: any) => fs.active !== false && (fs.gradeFrom ?? 0) <= n && n <= (fs.gradeTo ?? 99),
      );
      const termFee = Number(structure?.amount ?? structure?.termFee ?? structure?.totalFee ?? 0);
      const paid = paidByStudent.get(s.id) ?? 0;
      const hasAccess = paid > 0; // any payment recorded = dining access granted
      return { ...s, grade, termFee, paid, hasAccess, balance: Math.max(0, termFee - paid) };
    });
  }, [studentsData, structuresData, paidByStudent]);

  const filteredAccess = useMemo(() => {
    const q = accessSearch.toLowerCase();
    if (!q) return accessList;
    return accessList.filter(
      (s: any) =>
        (s.firstName + " " + s.lastName).toLowerCase().includes(q) ||
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.grade ?? "").toLowerCase().includes(q) ||
        (s.admissionNumber ?? "").toLowerCase().includes(q),
    );
  }, [accessList, accessSearch]);

  const accessGranted = accessList.filter((s: any) => s.hasAccess).length;
  const pendingClearance = accessList.filter((s: any) => !s.hasAccess).length;

  // ── Menu helpers ──────────────────────────────────────────────
  const selectedMenuItem = useMemo(
    () => menu.find((item: any) => item.id === saleForm.item || item.name === saleForm.item),
    [menu, saleForm.item],
  );

  const availableItems = menu.filter((item: any) => {
    const stockAvailable = Number.isFinite(item.stock) ? item.stock > 0 : true;
    return item.available !== false && stockAvailable;
  });

  const extraSalesTotal = sales.reduce((sum: number, s: any) => sum + s.total, 0);
  const lowStockCount = menu.filter((item: any) => Number.isFinite(item.stock) && item.stock < item.minStock).length;

  // ── Mutations ─────────────────────────────────────────────────
  const createOrderMutation = useMutation({
    mutationFn: (data: any) => api.canteen.createOrder(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["canteen-orders", schoolId] });
      toast.success("Extra sale recorded");
      setSaleForm(createSaleForm());
      setSaleOpen(false);
    },
    onError: () => toast.error("Failed to record sale"),
  });

  const createMenuMutation = useMutation({
    mutationFn: (data: any) => api.canteen.createMenuItem(schoolId, data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["canteen-menu", schoolId] });
      toast.success(`${variables.name} added to the menu`);
      setMenuForm(createMenuForm());
      setMenuOpen(false);
    },
    onError: () => toast.error("Failed to add menu item"),
  });

  // ── Submit handlers ───────────────────────────────────────────
  const recordSale = () => {
    const qty = Number(saleForm.qty);
    if (!selectedMenuItem || !Number.isFinite(qty) || qty < 1) {
      toast.error("Select a valid item and quantity"); return;
    }
    const unitPrice = Number(selectedMenuItem.price ?? selectedMenuItem.unitPrice ?? 0);
    const customerName = saleForm.customerType === "WALK_IN" ? "Walk-in" : saleForm.customerName.trim();
    if (saleForm.customerType !== "WALK_IN" && !customerName) {
      toast.error("Customer name is required"); return;
    }
    createOrderMutation.mutate({
      menuItemId: selectedMenuItem.id,
      itemName: selectedMenuItem.name,
      quantity: qty,
      customerId: saleForm.customerId.trim() || null,
      customerType: saleForm.customerType,
      customerName,
      orderDate: saleForm.orderDate,
      items: `${selectedMenuItem.name} x${qty} @ K ${unitPrice.toFixed(2)}`,
      totalAmount: unitPrice * qty,
      paymentMethod: saleForm.method,
      referenceNumber: saleForm.reference.trim() || null,
      notes: saleForm.notes.trim() || null,
      status: saleForm.status,
    });
  };

  const addMenuItem = () => {
    const price = Number(menuForm.price);
    if (!menuForm.name.trim() || !Number.isFinite(price) || price <= 0) {
      toast.error("Name and a valid price are required"); return;
    }
    createMenuMutation.mutate({
      name: menuForm.name.trim(),
      category: menuForm.category,
      price,
      costPrice: Number(menuForm.costPrice) || null,
      available: menuForm.available === "yes",
      openingStock: menuForm.stock ? Number(menuForm.stock) : null,
      reorderLevel: menuForm.minStock ? Number(menuForm.minStock) : null,
      servingSize: menuForm.servingSize.trim() || null,
      unitOfMeasure: menuForm.unitOfMeasure,
      issuePoint: menuForm.issuePoint.trim() || null,
      allergens: menuForm.allergens.trim() || null,
      vegetarian: menuForm.isVegetarian === "yes",
      halal: menuForm.isHalal === "yes",
      supplier: menuForm.supplier.trim() || null,
      preparationTime: menuForm.preparationTime ? Number(menuForm.preparationTime) : null,
      description: menuForm.description.trim() || null,
    });
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Canteen & Dining Hall"
        description="Standard meals are included in school fees — pupils with cleared fees have automatic dining access. Use extra sales for snacks and supplements purchased separately."
        actions={
          <>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setSaleOpen(true)}>Record extra sale</Button>
            <Dialog open={saleOpen} onClose={() => setSaleOpen(false)} maxWidth="md" fullWidth>
              <DialogTitle>Record extra sale</DialogTitle>
              <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>For snacks, supplements, or items not covered by school fees.</DialogContentText>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField select label="Item" fullWidth size="small" value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value })}>
                    <MenuItem value="" disabled>Select item</MenuItem>
                    {availableItems.map((item: any) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name} — K {item.price ?? item.unitPrice}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField type="date" label="Sale date" fullWidth size="small" value={saleForm.orderDate} onChange={(e) => setSaleForm({ ...saleForm, orderDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField label="Quantity" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1 } }} value={saleForm.qty} onChange={(e) => setSaleForm({ ...saleForm, qty: e.target.value })} />
                  <TextField select label="Payment method" fullWidth size="small" value={saleForm.method} onChange={(e) => setSaleForm({ ...saleForm, method: e.target.value as (typeof PAYMENT_METHODS)[number] })}>
                    {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                  <TextField select label="Status" fullWidth size="small" value={saleForm.status} onChange={(e) => setSaleForm({ ...saleForm, status: e.target.value as (typeof SALE_STATUSES)[number] })}>
                    {SALE_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField select label="Customer type" fullWidth size="small" value={saleForm.customerType} onChange={(e) => setSaleForm({ ...saleForm, customerType: e.target.value as (typeof CUSTOMER_TYPES)[number] })}>
                    <MenuItem value="STUDENT">Student</MenuItem>
                    <MenuItem value="STAFF">Staff</MenuItem>
                    <MenuItem value="WALK_IN">Walk-in</MenuItem>
                  </TextField>
                  <TextField
                    className="sm:col-span-2"
                    label={saleForm.customerType === "STUDENT" ? "Student name" : saleForm.customerType === "STAFF" ? "Staff name" : "Walk-in label"}
                    fullWidth
                    size="small"
                    value={saleForm.customerType === "WALK_IN" ? "Walk-in" : saleForm.customerName}
                    onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                    placeholder={saleForm.customerType === "STUDENT" ? "Mwila Chanda" : saleForm.customerType === "STAFF" ? "Mrs. Lungu" : "Walk-in"}
                    disabled={saleForm.customerType === "WALK_IN"}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Admission / staff no." fullWidth size="small" value={saleForm.customerId} onChange={(e) => setSaleForm({ ...saleForm, customerId: e.target.value })} placeholder="Optional" />
                  <TextField label="Receipt / reference" fullWidth size="small" value={saleForm.reference} onChange={(e) => setSaleForm({ ...saleForm, reference: e.target.value })} placeholder="POS slip, MoMo ref" />
                </div>

                <TextField label="Notes" fullWidth size="small" multiline minRows={2} value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder="Packed lunch, dietary note, etc." slotProps={{ htmlInput: { maxLength: 300 } }} />

                {selectedMenuItem && (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <div className="font-medium">{selectedMenuItem.name}</div>
                    <div className="mt-1 text-muted-foreground">
                      {selectedMenuItem.servingSize ? `${selectedMenuItem.servingSize} · ` : ""}{selectedMenuItem.issuePoint || "Counter service"}
                    </div>
                    <div className="mt-2">
                      Total: <span className="font-semibold">K {(Number(selectedMenuItem.price ?? selectedMenuItem.unitPrice ?? 0) * (Number(saleForm.qty) || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setSaleOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={recordSale} disabled={createOrderMutation.isPending}>
                  {createOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record sale
                </Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      {/* Policy banner */}
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
        <div>
          <span className="font-medium">Fee-inclusive dining policy</span> — All enrolled pupils who have paid school fees are automatically granted access to the dining hall for standard meals (breakfast, lunch, supper). No separate canteen payment is required at the counter.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Dining access granted" value={accessGranted} hint="Pupils with fee payment" accent="success" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Pending fee clearance" value={pendingClearance} hint={pendingClearance === 0 ? "All pupils cleared" : "No payment on record"} accent={pendingClearance === 0 ? "primary" : "warning"} icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="Menu items" value={menu.length} accent="accent" icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Extra sales today" value={`K ${extraSalesTotal.toLocaleString()}`} hint={`${sales.length} transactions`} accent="primary" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <Box>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="access" label="Dining access" />
          <Tab value="sales" label="Extra sales" />
          <Tab value="menu" label="Menu & stock" />
        </Tabs>

        {/* DINING ACCESS */}
        {tab === "access" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <TextField
              size="small"
              className="max-w-xs"
              placeholder="Search by name, grade, admission no."
              value={accessSearch}
              onChange={(e) => setAccessSearch(e.target.value)}
            />
            <p className="ml-auto text-sm text-muted-foreground">
              {accessGranted} / {accessList.length} pupils cleared
            </p>
          </div>
          {studentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading pupils…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Pupil</TableCell>
                <TableCell>Grade / Class</TableCell>
                <TableCell>Amount paid</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Dining access</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {filteredAccess.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {accessSearch ? "No pupils match your search." : "No pupils enrolled yet."}
                  </TableCell></TableRow>
                ) : filteredAccess.map((s: any) => {
                  const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
                  const name = s.name ?? (fullName || "—");
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        {s.admissionNumber && <div className="text-xs text-muted-foreground">{s.admissionNumber}</div>}
                      </TableCell>
                      <TableCell>{s.grade || "—"}</TableCell>
                      <TableCell className="font-medium text-green-700">
                        {s.paid > 0 ? `K ${s.paid.toLocaleString()}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {s.termFee > 0
                          ? s.balance > 0
                            ? <span className="font-medium text-amber-600">K {s.balance.toLocaleString()}</span>
                            : <span className="text-green-600">Fully paid</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell>
                        {s.hasAccess ? (
                          <Chip
                            size="small"
                            icon={<CheckCircle2 size={12} />}
                            label="Access granted"
                            sx={badgeSx("success")}
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<XCircle size={12} />}
                            label="Pending payment"
                            sx={badgeSx("warning")}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
        )}

        {/* EXTRA SALES */}
        {tab === "sales" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-medium">{sales.length} extra sale{sales.length !== 1 ? "s" : ""} · K {extraSalesTotal.toLocaleString()} total</p>
            <Button size="small" variant="outlined" onClick={() => { downloadCsv(sales.map((s: any) => ({ Item: s.displayItem, Quantity: s.quantity, Total: s.total, Method: s.method, Customer: s.customerName, Date: String(s.date).slice(0, 10), Status: s.status })), "canteen-sales-report"); toast.success("Sales report exported"); }}>Export</Button>
          </div>
          {ordersLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading sales…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Item</TableCell><TableCell>Qty</TableCell><TableCell>Total</TableCell>
                <TableCell>Method</TableCell><TableCell>Customer</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No extra sales recorded yet.</TableCell></TableRow>
                ) : sales.map((sale: any) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <div className="font-medium">{sale.displayItem}</div>
                      {sale.reference && <div className="text-xs text-muted-foreground">Ref: {sale.reference}</div>}
                    </TableCell>
                    <TableCell>{sale.quantity}</TableCell>
                    <TableCell>K {sale.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={sale.method}
                        sx={badgeSx(sale.method === "Cash" ? "secondary" : sale.method === "MoMo" ? "default" : "outline")}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sale.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{String(sale.date).slice(0, 10)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={sale.status}
                        sx={badgeSx(sale.status === "PAID" ? "secondary" : sale.status === "PENDING" ? "outline" : "destructive")}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
        )}

        {/* MENU & STOCK */}
        {tab === "menu" && (
        <Box className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={() => setMenuOpen(true)}>Add item</Button>
            <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Add menu item</DialogTitle>
                <DialogContent>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Item name *" fullWidth size="small" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Egg sandwich" slotProps={{ htmlInput: { maxLength: 80 } }} />
                    <TextField select label="Category" fullWidth size="small" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}>
                      {MENU_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField label="Price (K) *" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1 } }} value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="25" />
                    <TextField label="Opening stock" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} value={menuForm.stock} onChange={(e) => setMenuForm({ ...menuForm, stock: e.target.value })} placeholder="50" />
                    <TextField label="Reorder level" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 1 } }} value={menuForm.minStock} onChange={(e) => setMenuForm({ ...menuForm, minStock: e.target.value })} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField label="Serving size" fullWidth size="small" value={menuForm.servingSize} onChange={(e) => setMenuForm({ ...menuForm, servingSize: e.target.value })} placeholder="1 plate / 500ml" />
                    <TextField label="Issue point" fullWidth size="small" value={menuForm.issuePoint} onChange={(e) => setMenuForm({ ...menuForm, issuePoint: e.target.value })} placeholder="Main counter" />
                    <TextField select label="Available for sale" fullWidth size="small" value={menuForm.available} onChange={(e) => setMenuForm({ ...menuForm, available: e.target.value })}>
                      <MenuItem value="yes">Yes — available</MenuItem>
                      <MenuItem value="no">No — hold item</MenuItem>
                    </TextField>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField label="Cost price (K)" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 0, step: 0.01 } }} value={menuForm.costPrice} onChange={(e) => setMenuForm({ ...menuForm, costPrice: e.target.value })} placeholder="12.50" />
                    <TextField select label="Unit of measure" fullWidth size="small" value={menuForm.unitOfMeasure} onChange={(e) => setMenuForm({ ...menuForm, unitOfMeasure: e.target.value })}>
                      {["each", "plate", "cup", "litre", "500ml", "250ml", "portion", "kg", "bag", "slice"].map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </TextField>
                    <TextField label="Prep time (mins)" fullWidth size="small" type="number" slotProps={{ htmlInput: { min: 0 } }} value={menuForm.preparationTime} onChange={(e) => setMenuForm({ ...menuForm, preparationTime: e.target.value })} placeholder="15" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Supplier / source" fullWidth size="small" value={menuForm.supplier} onChange={(e) => setMenuForm({ ...menuForm, supplier: e.target.value })} placeholder="Freshmark, local farm" slotProps={{ htmlInput: { maxLength: 80 } }} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField select label="Vegetarian" fullWidth size="small" value={menuForm.isVegetarian} onChange={(e) => setMenuForm({ ...menuForm, isVegetarian: e.target.value })}>
                        <MenuItem value="no">No</MenuItem>
                        <MenuItem value="yes">Yes</MenuItem>
                      </TextField>
                      <TextField select label="Halal" fullWidth size="small" value={menuForm.isHalal} onChange={(e) => setMenuForm({ ...menuForm, isHalal: e.target.value })}>
                        <MenuItem value="no">No</MenuItem>
                        <MenuItem value="yes">Yes</MenuItem>
                      </TextField>
                    </div>
                  </div>

                  <TextField label="Allergens / diet notes" fullWidth size="small" value={menuForm.allergens} onChange={(e) => setMenuForm({ ...menuForm, allergens: e.target.value })} placeholder="Contains gluten, dairy, peanuts, egg…" slotProps={{ htmlInput: { maxLength: 120 } }} />

                  <TextField label="Item description" fullWidth size="small" multiline minRows={3} value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Recipe summary, prep notes, meal window" slotProps={{ htmlInput: { maxLength: 400 } }} />
                </div>
                </DialogContent>
                <DialogActions>
                  <Button variant="outlined" color="inherit" onClick={() => setMenuOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={addMenuItem} disabled={createMenuMutation.isPending}>
                    {createMenuMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add item
                  </Button>
                </DialogActions>
            </Dialog>
          </div>
          {menuLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading menu…</span>
            </div>
          ) : (
            <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Item</TableCell><TableCell>Category</TableCell><TableCell>Price</TableCell>
                <TableCell>Stock</TableCell><TableCell>Status</TableCell><TableCell className="text-right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {menu.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No menu items configured yet.</TableCell></TableRow>
                ) : menu.map((item: any) => {
                  const low = Number.isFinite(item.stock) && item.stock < item.minStock;
                  const available = item.available !== false && (!Number.isFinite(item.stock) || item.stock > 0);
                  return (
                    <TableRow key={item.id} className={!available ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.servingSize || "Standard serving"}{item.issuePoint ? ` · ${item.issuePoint}` : ""}
                        </div>
                      </TableCell>
                      <TableCell><Chip size="small" label={item.category} sx={badgeSx("outline")} /></TableCell>
                      <TableCell>K {item.price ?? item.unitPrice}</TableCell>
                      <TableCell>
                        {Number.isFinite(item.stock) ? (
                          <>
                            <span className={low ? "font-medium text-destructive" : ""}>{item.stock}</span>
                            {low && <span className="ml-1 text-xs text-muted-foreground">(low)</span>}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Counter-managed</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={item.available === false ? "Unavailable" : Number.isFinite(item.stock) && item.stock === 0 ? "Out of stock" : "Available"}
                          sx={badgeSx(available ? "default" : "secondary")}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="small" variant="text" color="inherit" onClick={() => toast.success(`Restock request raised for ${item.name}`)}>Restock</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </TableContainer>
          )}
        </Box>
        )}
      </Box>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          {lowStockCount} menu item{lowStockCount !== 1 ? "s are" : " is"} below reorder level and may need restocking.
        </div>
      )}
    </div>
  );
}
