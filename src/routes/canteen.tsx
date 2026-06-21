import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingBag, AlertTriangle, TrendingUp, Plus, Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
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
          <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Record extra sale</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Record extra sale</DialogTitle>
                <p className="text-sm text-muted-foreground">For snacks, supplements, or items not covered by school fees.</p>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Item</Label>
                    <Select value={saleForm.item} onValueChange={(v) => setSaleForm({ ...saleForm, item: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {availableItems.map((item: any) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} — K {item.price ?? item.unitPrice}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sale date</Label>
                    <Input type="date" className="mt-1" value={saleForm.orderDate} onChange={(e) => setSaleForm({ ...saleForm, orderDate: e.target.value })} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Quantity</Label>
                    <Input className="mt-1" type="number" min={1} value={saleForm.qty} onChange={(e) => setSaleForm({ ...saleForm, qty: e.target.value })} />
                  </div>
                  <div>
                    <Label>Payment method</Label>
                    <Select value={saleForm.method} onValueChange={(v) => setSaleForm({ ...saleForm, method: v as (typeof PAYMENT_METHODS)[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={saleForm.status} onValueChange={(v) => setSaleForm({ ...saleForm, status: v as (typeof SALE_STATUSES)[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{SALE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Customer type</Label>
                    <Select value={saleForm.customerType} onValueChange={(v) => setSaleForm({ ...saleForm, customerType: v as (typeof CUSTOMER_TYPES)[number] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STUDENT">Student</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="WALK_IN">Walk-in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>{saleForm.customerType === "STUDENT" ? "Student name" : saleForm.customerType === "STAFF" ? "Staff name" : "Walk-in label"}</Label>
                    <Input
                      className="mt-1"
                      value={saleForm.customerType === "WALK_IN" ? "Walk-in" : saleForm.customerName}
                      onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                      placeholder={saleForm.customerType === "STUDENT" ? "Mwila Chanda" : saleForm.customerType === "STAFF" ? "Mrs. Lungu" : "Walk-in"}
                      disabled={saleForm.customerType === "WALK_IN"}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Admission / staff no.</Label>
                    <Input className="mt-1" value={saleForm.customerId} onChange={(e) => setSaleForm({ ...saleForm, customerId: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <Label>Receipt / reference</Label>
                    <Input className="mt-1" value={saleForm.reference} onChange={(e) => setSaleForm({ ...saleForm, reference: e.target.value })} placeholder="POS slip, MoMo ref" />
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea className="mt-1" rows={2} value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder="Packed lunch, dietary note, etc." maxLength={300} />
                </div>

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
              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setSaleOpen(false)}>Cancel</Button>
                <Button onClick={recordSale} disabled={createOrderMutation.isPending}>
                  {createOrderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record sale
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="access">Dining access</TabsTrigger>
          <TabsTrigger value="sales">Extra sales</TabsTrigger>
          <TabsTrigger value="menu">Menu & stock</TabsTrigger>
        </TabsList>

        {/* DINING ACCESS */}
        <TabsContent value="access" className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <Input
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
            <Table>
              <TableHeader><TableRow>
                <TableHead>Pupil</TableHead>
                <TableHead>Grade / Class</TableHead>
                <TableHead>Amount paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Dining access</TableHead>
              </TableRow></TableHeader>
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
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                            <CheckCircle2 className="mr-1 h-3 w-3" />Access granted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            <XCircle className="mr-1 h-3 w-3" />Pending payment
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* EXTRA SALES */}
        <TabsContent value="sales" className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-3">
            <p className="text-sm font-medium">{sales.length} extra sale{sales.length !== 1 ? "s" : ""} · K {extraSalesTotal.toLocaleString()} total</p>
            <Button size="sm" variant="outline" onClick={() => toast.success("Sales report exported")}>Export</Button>
          </div>
          {ordersLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading sales…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Total</TableHead>
                <TableHead>Method</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
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
                      <Badge variant={sale.method === "Cash" ? "secondary" : sale.method === "MoMo" ? "default" : "outline"}>{sale.method}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sale.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{String(sale.date).slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant={sale.status === "PAID" ? "secondary" : sale.status === "PENDING" ? "outline" : "destructive"}>{sale.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* MENU & STOCK */}
        <TabsContent value="menu" className="rounded-xl border border-border bg-card">
          <div className="flex justify-end border-b border-border p-3">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" />Add item</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader><DialogTitle>Add menu item</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Item name *</Label>
                      <Input className="mt-1" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Egg sandwich" maxLength={80} />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={menuForm.category} onValueChange={(v) => setMenuForm({ ...menuForm, category: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{MENU_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Price (K) *</Label>
                      <Input className="mt-1" type="number" min={1} value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="25" />
                    </div>
                    <div>
                      <Label>Opening stock</Label>
                      <Input className="mt-1" type="number" min={0} value={menuForm.stock} onChange={(e) => setMenuForm({ ...menuForm, stock: e.target.value })} placeholder="50" />
                    </div>
                    <div>
                      <Label>Reorder level</Label>
                      <Input className="mt-1" type="number" min={1} value={menuForm.minStock} onChange={(e) => setMenuForm({ ...menuForm, minStock: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Serving size</Label>
                      <Input className="mt-1" value={menuForm.servingSize} onChange={(e) => setMenuForm({ ...menuForm, servingSize: e.target.value })} placeholder="1 plate / 500ml" />
                    </div>
                    <div>
                      <Label>Issue point</Label>
                      <Input className="mt-1" value={menuForm.issuePoint} onChange={(e) => setMenuForm({ ...menuForm, issuePoint: e.target.value })} placeholder="Main counter" />
                    </div>
                    <div>
                      <Label>Available for sale</Label>
                      <Select value={menuForm.available} onValueChange={(v) => setMenuForm({ ...menuForm, available: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes — available</SelectItem>
                          <SelectItem value="no">No — hold item</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Cost price (K)</Label>
                      <Input className="mt-1" type="number" min={0} step={0.01} value={menuForm.costPrice} onChange={(e) => setMenuForm({ ...menuForm, costPrice: e.target.value })} placeholder="12.50" />
                    </div>
                    <div>
                      <Label>Unit of measure</Label>
                      <Select value={menuForm.unitOfMeasure} onValueChange={(v) => setMenuForm({ ...menuForm, unitOfMeasure: v })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["each", "plate", "cup", "litre", "500ml", "250ml", "portion", "kg", "bag", "slice"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prep time (mins)</Label>
                      <Input className="mt-1" type="number" min={0} value={menuForm.preparationTime} onChange={(e) => setMenuForm({ ...menuForm, preparationTime: e.target.value })} placeholder="15" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Supplier / source</Label>
                      <Input className="mt-1" value={menuForm.supplier} onChange={(e) => setMenuForm({ ...menuForm, supplier: e.target.value })} placeholder="Freshmark, local farm" maxLength={80} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Vegetarian</Label>
                        <Select value={menuForm.isVegetarian} onValueChange={(v) => setMenuForm({ ...menuForm, isVegetarian: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Halal</Label>
                        <Select value={menuForm.isHalal} onValueChange={(v) => setMenuForm({ ...menuForm, isHalal: v })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Allergens / diet notes</Label>
                    <Input className="mt-1" value={menuForm.allergens} onChange={(e) => setMenuForm({ ...menuForm, allergens: e.target.value })} placeholder="Contains gluten, dairy, peanuts, egg…" maxLength={120} />
                  </div>

                  <div>
                    <Label>Item description</Label>
                    <Textarea className="mt-1" rows={3} value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Recipe summary, prep notes, meal window" maxLength={400} />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <Button variant="outline" onClick={() => setMenuOpen(false)}>Cancel</Button>
                  <Button onClick={addMenuItem} disabled={createMenuMutation.isPending}>
                    {createMenuMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add item
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {menuLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /><span>Loading menu…</span>
            </div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead>
                <TableHead>Stock</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
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
                      <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
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
                        <Badge variant={available ? "default" : "secondary"}>
                          {item.available === false ? "Unavailable" : Number.isFinite(item.stock) && item.stock === 0 ? "Out of stock" : "Available"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => toast.success(`Restock request raised for ${item.name}`)}>Restock</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          {lowStockCount} menu item{lowStockCount !== 1 ? "s are" : " is"} below reorder level and may need restocking.
        </div>
      )}
    </div>
  );
}
