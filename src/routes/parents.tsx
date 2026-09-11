import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import {
  Search, Mail, Phone, MessageSquare, CreditCard,
  FileText, Receipt, GraduationCap, Printer, Download,
  AlertCircle, CheckCircle2, ChevronRight, CircleAlert, Loader2,
  ShieldCheck, Smartphone, UserPlus, UsersRound, X, Pencil,
} from "lucide-react";
import { toast } from "sonner";

import {
  Chip, Divider, Button, IconButton, InputAdornment, MenuItem, TextField,
  Drawer, Box, Dialog, DialogContent, DialogActions, DialogTitle,
  Tabs, Tab, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { PageHeader, StatCard } from "@/components/page-header";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";
import { isSchoolLeadershipRole, useAuth } from "@/lib/auth";
import { badgeSx, downloadCsv } from "@/lib/utils";
import { SchoolDocumentHeader } from "@/components/school-document-header";
import { EmptyState } from "@/components/empty-state";
import { usePagedRows, ListPagination } from "@/components/list-pagination";

export const Route = createFileRoute("/parents")({
  head: () => ({ meta: [{ title: "Parents — SRMS" }] }),
  component: ParentsPage,
});

type GuardianRecord = {
  name: string;
  relationship: string;
  phone: string;
  altPhone: string;
  email: string;
  children: any[];
};

type ChildBalance = {
  child: any;
  structure: any | null;
  termFee: number;
  paid: number;
  outstanding: number;
  payments: any[];
};

const PAYMENT_METHODS = ["Cash", "Mobile Money", "Bank Transfer", "Cheque"];

function gradeNum(grade: any): number {
  if (typeof grade === "number") return grade;
  const m = String(grade ?? "").match(/\d+/);
  return m ? parseInt(m[0]) : 0;
}

function fmtK(n: number) {
  return `K ${n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";
}

// Mirrors the backend's PhoneUtils.normalize (Zambian numbers only) so two guardians typed
// as "+260 977 123 456" and "0977123456" are recognized as the same phone here too.
function normalizeZmPhone(phone: string): string {
  let digits = (phone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("00260")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = "260" + digits.slice(1);
  else if (digits.length === 9) digits = "260" + digits;
  return digits;
}

// A guardian's real identity is their phone or email, not their name — two unrelated
// families can easily share a common name (or a blank/generic one from a bulk import), and
// keying the grouping below by name alone was silently merging their children into one
// "parent" card with one blended balance. Falls back to name only when there's truly no
// phone or email to go on.
function guardianKey(student: any): string {
  const email = (student.guardianEmail || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = normalizeZmPhone(student.guardianPhone || "");
  if (phone) return `phone:${phone}`;
  const altPhone = normalizeZmPhone(student.guardianAltPhone || "");
  if (altPhone) return `phone:${altPhone}`;
  const name = (student.guardian || student.guardianName || "").trim().toLowerCase();
  return name ? `name:${name}` : "";
}

function ParentsPage() {
  const { active } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedParent, setSelectedParent] = useState<GuardianRecord | null>(null);
  const [messageTarget, setMessageTarget] = useState<GuardianRecord | null>(null);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  // GUARDIAN_DIRECTORY_ROLES (route-access.ts) lets FINANCE view this page, but FINANCE has no
  // "access" (Users & Roles) module permission — GET /schools/{id}/users and POST .../users
  // both 403 for them server-side. Without this, a finance user saw every guardian's portal
  // status as a misleading "Not created"/"Contact needed" (the 403'd query just came back
  // empty) and a "Create login" button that failed every time with a confusing "email or phone
  // may already be registered" error that had nothing to do with the real (permission) cause.
  const canManageAccounts = isSchoolLeadershipRole(user?.role);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", active.id],
    queryFn: () => api.students.list(active.id),
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ["school-users", active.id],
    queryFn: () => api.users.list(active.id),
    enabled: canManageAccounts,
  });
  const userEmails = new Set((appUsers as any[]).map((u: any) => (u.email ?? "").toLowerCase()));
  const userPhones = new Set((appUsers as any[]).map((u: any) => normalizeZmPhone(u.phone ?? "")));

  const createLoginMutation = useMutation({
    mutationFn: ({ name, email, phone }: { name: string; email?: string; phone?: string }) =>
      api.users.create(active.id, { name, ...(email ? { email } : { phone: phone! }), role: "PARENT" }),
    onSuccess: (created, vars) => {
      void qc.invalidateQueries({ queryKey: ["school-users", active.id] });
      // No password supplied above -> the backend generates a random one-time password
      // (returned as temporaryPassword) rather than the old hardcoded "password123", which
      // no longer actually works and must never be shown as if it does.
      toast.success(
        created.temporaryPassword
          ? `Login created — ${vars.email ?? vars.phone} / ${created.temporaryPassword}`
          : `Login created — ${vars.email ?? vars.phone}`,
      );
    },
    onError: () => toast.error("Could not create login — email or phone may already be registered"),
  });

  // The message icon used to just navigate to the general Communication inbox with no
  // recipient at all — it looked like it would message this specific guardian but actually
  // opened the shared, unfiltered messages tab. This actually sends to them.
  const sendMessageMutation = useMutation({
    mutationFn: () =>
      api.communication.createMessage(active.id, {
        senderEmail: user?.email,
        senderName: user?.name,
        recipientEmail: messageTarget?.email || undefined,
        studentId: messageTarget?.children[0]?.id,
        studentName: messageTarget ? `${messageTarget.children[0]?.firstName ?? ""} ${messageTarget.children[0]?.lastName ?? ""}`.trim() : undefined,
        subject: messageSubject.trim(),
        body: messageBody.trim(),
        status: "OPEN",
      }),
    onSuccess: () => {
      toast.success(`Message sent to ${messageTarget?.name}`);
      setMessageTarget(null);
      setMessageSubject("");
      setMessageBody("");
    },
    onError: () => toast.error("Failed to send message"),
  });

  const { data: structures = [] } = useQuery({
    queryKey: ["fee-structures", active.id],
    queryFn: () => api.fees.structures(active.id),
  });

  const guardianMap = new Map<string, GuardianRecord>();
  for (const student of students as any[]) {
    const guardianName: string = student.guardian || student.guardianName || "";
    if (!guardianName) continue;
    const key = guardianKey(student);
    if (!key) continue;
    const phone: string = student.guardianPhone || "";
    const altPhone: string = student.guardianAltPhone || "";
    const email: string = student.guardianEmail || "";
    const relationship: string = student.guardianRelationship || "";
    if (guardianMap.has(key)) {
      const existing = guardianMap.get(key)!;
      existing.children.push(student);
      if (!existing.relationship && relationship) existing.relationship = relationship;
      if (!existing.altPhone && altPhone) existing.altPhone = altPhone;
      if (!existing.email && email) existing.email = email;
    } else {
      guardianMap.set(key, { name: guardianName, relationship, phone, altPhone, email, children: [student] });
    }
  }

  const parents = Array.from(guardianMap.values());
  const filtered = parents.filter((p) =>
    `${p.name} ${p.relationship} ${p.phone} ${p.altPhone} ${p.email} ${p.children.map((c) => `${c.firstName} ${c.lastName}`).join(" ")}`
      .toLowerCase().includes(q.toLowerCase())
  );
  const { page, setPage, pageSize, setPageSize, pagedRows: pagedParents, totalCount: parentsTotalCount } = usePagedRows(filtered);
  const hasPortalLogin = (parent: GuardianRecord) =>
    Boolean(
      (parent.email && userEmails.has(parent.email.toLowerCase())) ||
      (parent.phone && userPhones.has(normalizeZmPhone(parent.phone))),
    );
  const reachableCount = parents.filter((p) => p.phone || p.altPhone || p.email).length;
  const portalAccessCount = parents.filter(hasPortalLogin).length;
  const studentLinks = parents.reduce((total, parent) => total + parent.children.length, 0);
  const recordsToReview = (students as any[]).filter((student) => {
    const name = student.guardian || student.guardianName;
    const contact = student.guardianPhone || student.guardianAltPhone || student.guardianEmail;
    return !name || !contact;
  }).length;
  const reachabilityPercent = parents.length > 0 ? Math.round((reachableCount / parents.length) * 100) : 0;

  const createParentLogin = (parent: GuardianRecord) => {
    createLoginMutation.mutate(
      parent.email
        ? { name: parent.name, email: parent.email }
        : { name: parent.name, phone: parent.phone },
    );
  };

  const portalStatus = (parent: GuardianRecord) => {
    // appUsers is only fetched for canManageAccounts (see its query above) — without that
    // gate, this would otherwise show every guardian as "Not created" for a role (e.g.
    // finance) that simply never gets to see real login status at all.
    if (!canManageAccounts) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Not visible to your role
        </span>
      );
    }
    if (hasPortalLogin(parent)) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Active
        </span>
      );
    }
    if (parent.email || parent.phone) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
          <CircleAlert className="h-3.5 w-3.5" /> Not created
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <CircleAlert className="h-3.5 w-3.5" /> Contact needed
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parents & Guardians"
        description="Manage family contacts, parent portal access, fee accounts and learner records."
        actions={
          <>
            <Button variant="outlined" startIcon={<Download size={16} />} onClick={() => {
              if (parents.length === 0) { toast.error("No guardian records to export"); return; }
              downloadCsv(parents.map((p) => ({
                "Guardian Name": p.name,
                Relationship: p.relationship,
                Phone: p.phone,
                "Alt Phone": p.altPhone,
                Email: p.email,
                "Number of Children": p.children.length,
                Children: p.children.map((c: any) => `${c.firstName} ${c.lastName} (${c.className || c.grade || ""})`).join("; "),
              })), `guardians-${new Date().toISOString().slice(0, 10)}`);
            }}>
              Export contacts
            </Button>
            <Button
              variant="contained"
              startIcon={<MessageSquare size={16} />}
              onClick={() => navigate({ to: "/communication", hash: "broadcast" })}
            >
              Send message
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Guardian households"
          value={parents.length}
          hint={`${studentLinks} linked learner${studentLinks === 1 ? "" : "s"}`}
          accent="primary"
          icon={<UsersRound className="h-5 w-5" />}
        />
        <StatCard
          label="Reachable contacts"
          value={reachableCount}
          hint={`${reachabilityPercent}% have a phone number or email`}
          accent="success"
          icon={<Smartphone className="h-5 w-5" />}
        />
        <StatCard
          label="Parent portal"
          value={portalAccessCount}
          hint={`${Math.max(parents.length - portalAccessCount, 0)} account${parents.length - portalAccessCount === 1 ? "" : "s"} not active`}
          accent="accent"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Records to review"
          value={recordsToReview}
          hint="Missing a guardian name or contact method"
          accent={recordsToReview > 0 ? "warning" : "success"}
          icon={recordsToReview > 0 ? <CircleAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/[0.07] via-card to-accent/[0.08] px-4 py-5 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Guardian directory</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a record to review children, balances, payments and report cards.
              </p>
            </div>
            <div className="w-full lg:max-w-md">
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
                placeholder="Search guardian, learner, phone or email"
              fullWidth
              size="small"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
            />
              <p className="mt-2 text-right text-xs text-muted-foreground">
                Showing {filtered.length} of {parents.length} guardian record{parents.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading guardian records…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={q.trim() ? "No matching guardians" : "No guardian records yet"}
            description={q.trim() ? "Try a different name, contact detail or learner." : "Guardian records appear here when details are added to a learner profile."}
          />
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {filtered.map((parent) => {
                const key = guardianKey(parent.children[0]) || parent.name;
                const canCreateLogin = canManageAccounts && Boolean(parent.email || parent.phone) && !hasPortalLogin(parent);
                return (
                  <article
                    key={key}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer p-4 transition-colors hover:bg-muted/30 focus-visible:bg-muted/30"
                    onClick={() => setSelectedParent(parent)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedParent(parent);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                        {initials(parent.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{parent.name}</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">{parent.relationship || "Guardian"}</p>
                          </div>
                          {portalStatus(parent)}
                        </div>
                        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                          {parent.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{parent.phone}</p>}
                          {parent.email && <p className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5" />{parent.email}</p>}
                          {!parent.phone && !parent.email && <p className="italic">No primary contact captured</p>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-muted/45 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {parent.children.length} linked learner{parent.children.length === 1 ? "" : "s"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {parent.children.map((child) => (
                          <span key={child.id} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground">
                            {child.firstName} {child.lastName} · {child.className || child.grade || "Unassigned"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2" onClick={(event) => event.stopPropagation()}>
                      {canCreateLogin ? (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<UserPlus className="h-4 w-4" />}
                          disabled={createLoginMutation.isPending}
                          onClick={() => createParentLogin(parent)}
                        >
                          Create login
                        </Button>
                      ) : <span />}
                      <Button size="small" endIcon={<ChevronRight className="h-4 w-4" />} onClick={() => setSelectedParent(parent)}>
                        View record
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <TableContainer className="hidden md:block">
              <Table sx={{ minWidth: 880 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Guardian</TableCell>
                    <TableCell>Linked learners</TableCell>
                    <TableCell>Contact details</TableCell>
                    <TableCell>Portal access</TableCell>
                    <TableCell className="text-right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedParents.map((parent) => {
                    const key = guardianKey(parent.children[0]) || parent.name;
                    const canCreateLogin = canManageAccounts && Boolean(parent.email || parent.phone) && !hasPortalLogin(parent);
                    return (
                      <TableRow
                        key={key}
                        className="cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => setSelectedParent(parent)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                              {initials(parent.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{parent.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{parent.relationship || "Guardian"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            {parent.children.slice(0, 2).map((child) => (
                              <div key={child.id} className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-foreground">{child.firstName} {child.lastName}</span>
                                <Chip size="small" label={child.className || child.grade || "Unassigned"} sx={{ ...badgeSx("outline"), fontSize: 11 }} />
                              </div>
                            ))}
                            {parent.children.length > 2 && (
                              <p className="text-xs text-muted-foreground">+{parent.children.length - 2} more learner{parent.children.length - 2 === 1 ? "" : "s"}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5 text-sm text-muted-foreground">
                            {parent.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{parent.phone}</p>}
                            {parent.email && <p className="flex max-w-[16rem] items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{parent.email}</span></p>}
                            {!parent.phone && !parent.email && <p className="italic">No primary contact captured</p>}
                          </div>
                        </TableCell>
                        <TableCell>{portalStatus(parent)}</TableCell>
                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {canCreateLogin && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<UserPlus className="h-4 w-4" />}
                                disabled={createLoginMutation.isPending}
                                onClick={() => createParentLogin(parent)}
                              >
                                Create login
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              aria-label={`Message ${parent.name}`}
                              title={parent.email ? "Send a message" : "No email on file for this guardian"}
                              disabled={!parent.email}
                              onClick={() => { setMessageTarget(parent); setMessageSubject(""); setMessageBody(""); }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              size="small"
                              aria-label={`View ${parent.name}`}
                              title="View guardian record"
                              onClick={() => setSelectedParent(parent)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {parentsTotalCount > 0 && (
              <div className="hidden md:block">
                <ListPagination
                  count={parentsTotalCount}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </>
        )}
      </section>

      {selectedParent && (
        <ParentPortalSheet
          parent={selectedParent}
          structures={structures as any[]}
          school={active}
          onClose={() => setSelectedParent(null)}
          onViewReportCard={(studentId) => {
            setSelectedParent(null);
            void navigate({ to: "/report-card", search: { studentId } });
          }}
          onViewStudent={(studentId) => {
            setSelectedParent(null);
            void navigate({ to: "/students/$studentId", params: { studentId } });
          }}
        />
      )}

      <Dialog open={!!messageTarget} onClose={() => setMessageTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Message {messageTarget?.name}</DialogTitle>
        <DialogContent className="space-y-3 pt-2">
          <TextField
            label="Subject *"
            value={messageSubject}
            onChange={(e) => setMessageSubject(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Message *"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            multiline
            minRows={4}
            fullWidth
            size="small"
            sx={{ mt: 2 }}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Sends to {messageTarget?.email || "—"}. {messageTarget?.name} will see your reply in
            their own message list.
          </p>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setMessageTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!messageSubject.trim() || !messageBody.trim() || sendMessageMutation.isPending}
            onClick={() => sendMessageMutation.mutate()}
          >
            {sendMessageMutation.isPending ? "Sending…" : "Send"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function ParentPortalSheet({
  parent, structures, school, onClose, onViewReportCard, onViewStudent,
}: {
  parent: GuardianRecord;
  structures: any[];
  school: any;
  onClose: () => void;
  onViewReportCard: (studentId: string) => void;
  onViewStudent: (studentId: string) => void;
}) {
  const { active } = useTenant();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("fees");
  const [payForm, setPayForm] = useState({
    studentId: parent.children[0]?.id ?? "",
    amount: "",
    method: "Cash",
    reference: "",
    description: `Term ${school.currentTerm} school fees`,
    paymentDate: todayStr(),
  });
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);
  const [paymentCleared, setPaymentCleared] = useState<{ studentName: string; amount: number } | null>(null);

  const paymentQueries = useQueries({
    queries: parent.children.map((child) => ({
      queryKey: ["student-payments", active.id, child.id],
      queryFn: () => api.fees.studentPayments(active.id, child.id),
    })),
  });

  const childBalances: ChildBalance[] = parent.children.map((child, idx) => {
    const payments: any[] = (paymentQueries[idx]?.data ?? []) as any[];
    const grade = child.className || child.grade || "";
    const n = gradeNum(grade);
    const structure = structures.find((s: any) => s.active && s.gradeFrom <= n && n <= s.gradeTo) ?? null;
    const termFee = structure?.termFee ?? 0;
    const paid = payments
      .filter((p: any) => p.status === "completed")
      .reduce((sum: number, p: any) => sum + p.amount, 0);
    const outstanding = Math.max(termFee - paid, 0);
    return { child, structure, termFee, paid, outstanding, payments };
  });

  const totalOutstanding = childBalances.reduce((s, b) => s + b.outstanding, 0);
  const isLoadingPayments = paymentQueries.some((q) => q.isLoading);

  const payMut = useMutation({
    mutationFn: (data: any) => api.fees.recordPayment(active.id, data),
    onSuccess: (payment: any, vars: any) => {
      parent.children.forEach((c) => {
        void qc.invalidateQueries({ queryKey: ["student-payments", active.id, c.id] });
      });
      void qc.invalidateQueries({ queryKey: ["students", active.id] });
      const child = parent.children.find((c) => c.id === vars.studentId);
      const childBalance = childBalances.find((b) => b.child.id === vars.studentId);
      const remaining = childBalance ? Math.max(0, childBalance.outstanding - Number(vars.amount)) : null;
      if (remaining === 0) {
        setPaymentCleared({ studentName: `${child?.firstName ?? ""} ${child?.lastName ?? ""}`.trim(), amount: Number(vars.amount) });
        toast.success(`Account cleared — K ${Number(vars.amount).toLocaleString()} received`, { duration: 6000 });
      } else {
        toast.success(
          remaining != null
            ? `Payment of K ${Number(vars.amount).toLocaleString()} recorded · Remaining: K ${remaining.toLocaleString()}`
            : "Payment recorded",
          { duration: 5000 }
        );
      }
      setActiveTab("history");
      setReceiptPayment(payment);
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const submitPayment = () => {
    if (!payForm.studentId) { toast.error("Select a pupil"); return; }
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    const child = parent.children.find((c) => c.id === payForm.studentId);
    const receiptNo = `RCP-${active.id.slice(0, 6).toUpperCase()}-${Date.now()}`;
    payMut.mutate({
      schoolId: active.id,
      studentId: payForm.studentId,
      studentName: child ? `${child.firstName} ${child.lastName}` : "",
      grade: child?.className || child?.grade || "",
      amount: amt,
      method: payForm.method,
      referenceNumber: payForm.reference.trim() || null,
      description: payForm.description,
      paymentDate: payForm.paymentDate,
      feeCategory: "SCHOOL_FEES",
      receiptNumber: receiptNo,
      status: "completed",
      collectedBy: "Admin",
    });
  };

  return (
    <>
      <Drawer anchor="right" open onClose={onClose}>
        <Box sx={{ width: { xs: "100vw", sm: 680 } }} className="flex h-full flex-col overflow-hidden bg-background">
          <Box className="relative shrink-0 overflow-hidden border-b border-border bg-gradient-to-br from-primary/[0.10] via-card to-accent/[0.09] px-4 py-5 sm:px-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-card text-sm font-semibold text-primary shadow-sm">
                {initials(parent.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Guardian record</p>
                <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">{parent.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {parent.relationship || "Guardian"} · {parent.children.length} linked learner{parent.children.length === 1 ? "" : "s"}
                </p>
              </div>
              <IconButton size="small" aria-label="Close guardian record" onClick={onClose}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {parent.phone && <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1.5"><Phone className="h-3.5 w-3.5" />{parent.phone}</span>}
                {parent.altPhone && <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1.5"><Phone className="h-3.5 w-3.5" />{parent.altPhone} (alternate)</span>}
                {parent.email && <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-card/80 px-2.5 py-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{parent.email}</span></span>}
                {!parent.phone && !parent.altPhone && !parent.email && <span className="italic">No contact details captured</span>}
              </div>
              <div className="rounded-xl border border-border bg-card/90 px-4 py-2.5 shadow-sm sm:min-w-44 sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding balance</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${totalOutstanding > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {isLoadingPayments ? "Calculating…" : fmtK(totalOutstanding)}
                </p>
              </div>
            </div>
            {!isLoadingPayments && totalOutstanding > 0 && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.08] px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive">Fee balance outstanding</p>
                  <p className="mt-0.5 text-xs leading-5 text-destructive/80">
                    {fmtK(totalOutstanding)} is due for Term {school.currentTerm}, {school.currentYear}.
                    {childBalances.filter((b) => b.outstanding > 0).map((b) => ` ${b.child.firstName}: ${fmtK(b.outstanding)}`).join(" ·")}
                  </p>
                </div>
                <Button size="small" variant="contained" className="shrink-0" onClick={() => setActiveTab("pay")}>
                  Record payment
                </Button>
              </div>
            )}
            {!isLoadingPayments && totalOutstanding === 0 && childBalances.length > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All fee accounts are cleared for this term</p>
              </div>
            )}
          </Box>

          <div className="flex-1 overflow-y-auto">
            <Box className="px-4 pt-4 sm:px-6">
              <Tabs
                value={activeTab}
                onChange={(_e, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons={false}
                aria-label="Guardian record sections"
                sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
              >
                <Tab value="fees" label="Fee Summary" />
                <Tab value="pay" label="Record Payment" />
                <Tab value="history" label="History" />
                <Tab value="reports" label="Report Cards" />
              </Tabs>

              {/* FEE SUMMARY */}
              {activeTab === "fees" && (
                <Box className="space-y-4 pb-6">
                {isLoadingPayments ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Loading balances…</p>
                ) : childBalances.map(({ child, structure, termFee, paid, outstanding }) => (
                  <div key={child.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div>
                          <p className="font-semibold">{child.firstName} {child.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {child.className || child.grade || "—"} · Adm: {child.admissionNumber || child.admissionNo || "—"}
                          </p>
                        </div>
                        {/* Guardian info is grouped from each pupil's own guardianPhone/Email/name —
                            if several unrelated pupils were bulk-imported with the same placeholder
                            contact, they'll wrongly land under one guardian here. Fixing that means
                            correcting the specific pupil's own guardian details, which live on their
                            profile, not on this computed view — so jump straight there. */}
                        <IconButton
                          size="small"
                          aria-label={`Edit ${child.firstName} ${child.lastName}'s guardian details`}
                          title="Edit this pupil's guardian details"
                          onClick={() => onViewStudent(child.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                      <Chip size="small" label={outstanding > 0 ? "Balance due" : "Paid up"} sx={badgeSx(outstanding > 0 ? "destructive" : "secondary")} />
                    </div>
                    <Divider sx={{ my: 1.5 }} />
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Term fee</p>
                        <p className="mt-0.5 font-medium">{structure ? fmtK(termFee) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Paid</p>
                        <p className="mt-0.5 font-medium text-green-600">{fmtK(paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
                        <p className={`mt-0.5 font-bold ${outstanding > 0 ? "text-destructive" : "text-green-600"}`}>{fmtK(outstanding)}</p>
                      </div>
                    </div>
                    {structure ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {structure.name} · Due: {structure.dueDate || "—"}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amber-600">No active fee structure found for this grade.</p>
                    )}
                    {outstanding > 0 && (
                      <div className="mt-3">
                        <Button size="small" variant="contained" startIcon={<CreditCard size={14} />} onClick={() => { setPayForm((f) => ({ ...f, studentId: child.id })); setActiveTab("pay"); }}>
                          Pay now
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outlined" startIcon={<FileText size={16} />} onClick={() => setInvoiceOpen(true)}>
                    Generate invoice
                  </Button>
                </div>
                </Box>
              )}

              {/* RECORD PAYMENT */}
              {activeTab === "pay" && (
                <Box className="pb-6">
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="font-semibold">Record payment</h3>
                  <div>
                    <TextField
                      select
                      label="Pupil *"
                      value={payForm.studentId}
                      onChange={(e) => setPayForm((f) => ({ ...f, studentId: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {parent.children.map((c) => {
                        const bal = childBalances.find((b) => b.child.id === c.id);
                        return (
                          <MenuItem key={c.id} value={c.id}>
                            {c.firstName} {c.lastName} ({c.className || c.grade || ""})
                            {bal && bal.outstanding > 0 ? ` — owes ${fmtK(bal.outstanding)}` : ""}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                    {payForm.studentId && (() => {
                      const bal = childBalances.find((b) => b.child.id === payForm.studentId);
                      if (!bal) return null;
                      return bal.outstanding > 0 ? (
                        <p className="mt-1.5 text-xs font-medium text-destructive">
                          Outstanding: {fmtK(bal.outstanding)} · Due {bal.structure?.dueDate || `Term ${school.currentTerm}`}
                        </p>
                      ) : (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />Account is cleared for this term
                        </p>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      type="number"
                      label="Amount (K) *"
                      slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                      value={payForm.amount}
                      placeholder="0.00"
                      onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      select
                      label="Method"
                      value={payForm.method}
                      onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                    </TextField>
                    <TextField
                      type="date"
                      label="Date"
                      value={payForm.paymentDate}
                      onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))}
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Reference / transaction ID"
                      value={payForm.reference}
                      placeholder="e.g. MTN-XXXX"
                      onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                      fullWidth
                      size="small"
                    />
                    <div className="col-span-2">
                      <TextField
                        label="Description"
                        value={payForm.description}
                        onChange={(e) => setPayForm((f) => ({ ...f, description: e.target.value }))}
                        fullWidth
                        size="small"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outlined" onClick={() => setActiveTab("fees")}>Cancel</Button>
                    <Button variant="contained" onClick={submitPayment} disabled={payMut.isPending}>
                      {payMut.isPending ? "Saving…" : "Record & generate receipt"}
                    </Button>
                  </div>
                </div>
                </Box>
              )}

              {/* PAYMENT HISTORY */}
              {activeTab === "history" && (
                <Box className="pb-6 space-y-4">
                {paymentCleared && (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Account cleared!</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                        K {paymentCleared.amount.toLocaleString()} received for {paymentCleared.studentName} — balance is fully settled for this term.
                      </p>
                    </div>
                    <button className="text-emerald-600 text-sm hover:text-emerald-800" onClick={() => setPaymentCleared(null)}>✕</button>
                  </div>
                )}
                {isLoadingPayments ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
                ) : childBalances.map(({ child, payments }) => (
                  <ChildPaymentHistory
                    key={child.id}
                    child={child}
                    payments={payments}
                    onViewReceipt={(p) =>
                      setReceiptPayment({
                        ...p,
                        studentName: `${child.firstName} ${child.lastName}`,
                        grade: child.className || child.grade || "",
                      })
                    }
                  />
                ))}
                </Box>
              )}

              {/* REPORT CARDS */}
              {activeTab === "reports" && (
                <Box className="pb-6 space-y-3">
                {parent.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {child.className || child.grade || "—"} · Term {school.currentTerm}, {school.currentYear}
                        </p>
                      </div>
                    </div>
                    <Button size="small" variant="contained" onClick={() => onViewReportCard(child.id)}>
                      View report card
                    </Button>
                  </div>
                ))}
                </Box>
              )}
            </Box>
          </div>
        </Box>
      </Drawer>

      {invoiceOpen && (
        <InvoiceDialog
          parent={parent}
          childBalances={childBalances}
          school={school}
          onClose={() => setInvoiceOpen(false)}
        />
      )}

      {receiptPayment && (
        <ReceiptDialog
          payment={receiptPayment}
          parent={parent}
          school={school}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </>
  );
}

function ChildPaymentHistory({
  child, payments, onViewReceipt,
}: {
  child: any;
  payments: any[];
  onViewReceipt: (payment: any) => void;
}) {
  const { page, setPage, pageSize, setPageSize, pagedRows: pagedPayments, totalCount } = usePagedRows(payments);

  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{child.firstName} {child.lastName}</p>
      {payments.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Method</TableCell>
                <TableCell className="text-right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedPayments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{p.paymentDate || "—"}</TableCell>
                  <TableCell className="text-xs">{p.description || "—"}</TableCell>
                  <TableCell className="text-xs">{p.method || "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-sm">{fmtK(p.amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.status} sx={{ ...badgeSx(p.status === "completed" ? "default" : "secondary"), fontSize: 12, textTransform: "capitalize" }} />
                  </TableCell>
                  <TableCell>
                    {p.status === "completed" && (
                      <IconButton size="small" aria-label="View receipt" title="View receipt" onClick={() => onViewReceipt(p)}>
                        <Receipt className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
          {totalCount > 0 && (
            <ListPagination
              count={totalCount}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}
    </div>
  );
}

function InvoiceDialog({
  parent, childBalances, school, onClose,
}: {
  parent: GuardianRecord;
  childBalances: ChildBalance[];
  school: any;
  onClose: () => void;
}) {
  const invoiceNo = `INV-${school.id.slice(0, 6).toUpperCase()}-${Date.now()}`;
  const today = new Date().toLocaleDateString("en-ZM", { day: "2-digit", month: "long", year: "numeric" });
  const totalDue = childBalances.reduce((s, b) => s + b.outstanding, 0);

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle className="print:hidden">Invoice · {invoiceNo}</DialogTitle>
      <DialogContent>
        <div className="overflow-y-auto flex-1 pr-1">
        <div className="print-area space-y-4 text-sm print:text-black">
          <SchoolDocumentHeader title="INVOICE" subtitle={`${invoiceNo} · ${today} · Term ${school.currentTerm}, ${school.currentYear}`} />

          {/* Bill to */}
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To</p>
            <p className="mt-1 font-semibold">{parent.name}</p>
            {parent.relationship && <p className="text-xs text-muted-foreground">{parent.relationship}</p>}
            {parent.phone && <p className="text-xs text-muted-foreground">{parent.phone}</p>}
            {parent.email && <p className="text-xs text-muted-foreground">{parent.email}</p>}
          </div>

          {/* Per-child line items */}
          {childBalances.map(({ child, structure, termFee, paid, outstanding }) => (
            <div key={child.id} className="rounded-lg border border-border p-3">
              <p className="font-semibold">{child.firstName} {child.lastName}</p>
              <p className="mb-2 text-xs text-muted-foreground">
                {child.className || child.grade || "—"} · Adm: {child.admissionNumber || child.admissionNo || "—"}
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>{structure?.name || "Term fee"} (Term {school.currentTerm})</span>
                  <span className="font-mono">{fmtK(termFee)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Payments received</span>
                  <span className="font-mono">− {fmtK(paid)}</span>
                </div>
                <Divider sx={{ my: 0.75 }} />
                <div className="flex justify-between font-semibold">
                  <span>Balance due</span>
                  <span className={`font-mono ${outstanding > 0 ? "text-destructive" : "text-green-600"}`}>{fmtK(outstanding)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="flex justify-end">
            <div className="rounded-lg bg-muted/50 px-6 py-3 text-right">
              <p className="text-xs uppercase text-muted-foreground">Total amount due</p>
              <p className={`mt-0.5 text-3xl font-bold ${totalDue > 0 ? "text-destructive" : "text-green-600"}`}>{fmtK(totalDue)}</p>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Please present this invoice when making payment. Payments can be made at the school bursar's office.<br />
            Thank you for your continued support of {school.name}.
          </p>
        </div>
        </div>
      </DialogContent>

      <DialogActions className="mt-2 print:hidden">
        <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<Printer size={16} />} onClick={() => window.print()}>Print invoice</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReceiptDialog({
  payment, parent, school, onClose,
}: {
  payment: any;
  parent: GuardianRecord;
  school: any;
  onClose: () => void;
}) {
  const dateStr = payment.paymentDate
    ? new Date(payment.paymentDate).toLocaleDateString("en-ZM", { day: "2-digit", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-ZM", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle className="print:hidden">Receipt · {payment.receiptNumber || "—"}</DialogTitle>
      <DialogContent>
        <div className="overflow-y-auto flex-1 pr-1">
        <div className="print-area space-y-4 text-sm">
          <SchoolDocumentHeader title="OFFICIAL RECEIPT" subtitle={dateStr} />

          {/* Details */}
          <div className="space-y-2 rounded-lg border border-border p-4">
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Receipt no.</span>
              <span className="font-mono text-xs font-semibold">{payment.receiptNumber || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Date</span>
              <span className="text-xs">{dateStr}</span>
            </div>
            <Divider />
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Received from</span>
              <span className="text-xs font-medium">{parent.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Pupil</span>
              <span className="text-xs">{payment.studentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Grade</span>
              <span className="text-xs">{payment.grade}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">For</span>
              <span className="text-xs">{payment.description || "School fees"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-muted-foreground">Method</span>
              <span className="text-xs">{payment.method}</span>
            </div>
            {payment.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Reference</span>
                <span className="font-mono text-xs">{payment.referenceNumber}</span>
              </div>
            )}
            <Divider />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Amount paid</span>
              <span className="text-2xl font-bold text-green-600">{fmtK(payment.amount)}</span>
            </div>
          </div>

          {/* Paid stamp */}
          <div className="rounded-lg border-2 border-green-500/40 bg-green-500/10 p-3 text-center">
            <p className="text-lg font-bold tracking-widest text-green-600">✓ PAID</p>
            <p className="text-xs text-muted-foreground">This receipt is official proof of payment</p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {school.name} · {school.district}, {school.province}
          </p>
        </div>
        </div>
      </DialogContent>

      <DialogActions className="mt-2 print:hidden">
        <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<Printer size={16} />} onClick={() => window.print()}>Print receipt</Button>
      </DialogActions>
    </Dialog>
  );
}
