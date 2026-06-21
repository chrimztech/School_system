import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Shield, Trash2, UserPlus, Check, X, Pencil, Loader2, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, ACCESS, MODULE_MATRIX, ROLE_META, type Role } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTenant } from "@/lib/tenant";

export const Route = createFileRoute("/access")({
  head: () => ({ meta: [{ title: "Access Management — SRMS" }] }),
  component: AccessPage,
});

const modules = [...MODULE_MATRIX];

// Access level options for custom role permission cells
const ACCESS_OPTIONS = [
  { value: "full", label: "Full" },
  { value: "read", label: "Read" },
  { value: "none", label: "None" },
];

function AccessPage() {
  const { user, assignableRoles, loadingSession } = useAuth();
  const { active } = useTenant();
  const schoolId = user?.tenantId ?? active.id;
  const qc = useQueryClient();

  // ── Fetch login accounts ───────────────────────────────────────────────────
  const { data: rawUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["school-users", schoolId],
    queryFn: () => api.users.list(schoolId),
    enabled: Boolean(schoolId),
  });

  // ── Fetch teachers (staff records without login accounts) ──────────────────
  const { data: rawTeachers = [] } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: () => api.teachers.list(schoolId),
    enabled: Boolean(schoolId),
  });

  // Build merged user list: all login accounts + teachers who have no login yet
  const userEmails = new Set((rawUsers as any[]).map((u: any) => u.email?.toLowerCase()));
  const users = [
    ...(rawUsers as any[]).map((u: any) => ({
      id: u.id as string,
      name: u.name as string,
      email: u.email as string,
      role: (u.role as string) ?? "teacher",
      phone: u.phone as string | undefined,
      initials: (u.initials as string | undefined) ?? (u.name as string)?.slice(0, 2).toUpperCase() ?? "??",
      hasLogin: true,
    })),
    ...(rawTeachers as any[])
      .filter((t: any) => t.email && !userEmails.has(t.email.toLowerCase()))
      .map((t: any) => ({
        id: t.id as string,
        name: `${t.firstName ?? ""} ${t.lastName ?? ""}`.trim(),
        email: t.email as string,
        role: "teacher",
        phone: t.phone as string | undefined,
        initials: `${t.firstName?.[0] ?? ""}${t.lastName?.[0] ?? ""}`.toUpperCase() || "??",
        hasLogin: false,
      })),
  ];

  // ── Add-user dialog state ──────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "teacher" as Role });

  // ── Create-login dialog state ──────────────────────────────────────────────
  const [createLoginTarget, setCreateLoginTarget] = useState<{ id: string; name: string; email: string; phone?: string } | null>(null);
  const [createLoginPassword, setCreateLoginPassword] = useState("");
  const [creatingLogin, setCreatingLogin] = useState(false);

  // ── Custom role dialogs ────────────────────────────────────────────────────
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const [editRoleTarget, setEditRoleTarget] = useState<any | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ name: "", description: "" });

  // ── Permission matrix local state ──────────────────────────────────────────
  // Map of roleName → module → access value (local edits before save)
  const [pendingPerms, setPendingPerms] = useState<Record<string, Record<string, string>>>({});
  // Track which role's permissions are currently being saved
  const [savingRole, setSavingRole] = useState<string | null>(null);
  // Track which role's permissions have been loaded into pendingPerms
  const [loadedRoles, setLoadedRoles] = useState<Set<string>>(new Set());

  // ── Fetch custom roles ─────────────────────────────────────────────────────
  const { data: rawCustomRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["custom-roles", schoolId],
    queryFn: () => api.roles.list(schoolId),
    enabled: Boolean(schoolId),
  });
  const customRoles = rawCustomRoles as any[];

  // ── Fetch permissions for each custom role and seed pendingPerms ───────────
  // We do a single bulk fetch per role by watching customRoles list
  useQuery({
    queryKey: ["custom-role-permissions-all", schoolId, customRoles.map((r: any) => r.name).join(",")],
    queryFn: async () => {
      const results: Record<string, Record<string, string>> = {};
      await Promise.all(
        customRoles.map(async (role: any) => {
          if (loadedRoles.has(role.name)) return;
          try {
            const perms = await api.roles.getPermissions(schoolId, role.name);
            const map: Record<string, string> = {};
            (perms as any[]).forEach((p: any) => { map[p.module] = p.access; });
            results[role.name] = map;
          } catch {
            results[role.name] = {};
          }
        })
      );
      if (Object.keys(results).length > 0) {
        setPendingPerms((prev) => ({ ...results, ...prev }));
        setLoadedRoles((prev) => {
          const next = new Set(prev);
          Object.keys(results).forEach((n) => next.add(n));
          return next;
        });
      }
      return results;
    },
    enabled: customRoles.length > 0,
  });

  // ── Custom role mutations ──────────────────────────────────────────────────
  const createRoleMut = useMutation({
    mutationFn: (data: any) => api.roles.create(schoolId, data),
    onSuccess: (created: any) => {
      void qc.invalidateQueries({ queryKey: ["custom-roles", schoolId] });
      toast.success(`Role "${created.name}" created`);
      setRoleForm({ name: "", description: "" });
      setCreateRoleOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to create role"),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.roles.update(schoolId, id, data),
    onSuccess: (updated: any) => {
      void qc.invalidateQueries({ queryKey: ["custom-roles", schoolId] });
      toast.success(`Role "${updated.name}" updated`);
      setEditRoleTarget(null);
      setEditRoleForm({ name: "", description: "" });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Failed to update role"),
  });

  const deleteRoleMut = useMutation({
    mutationFn: (id: string) => api.roles.delete(schoolId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["custom-roles", schoolId] });
      toast.success("Role deleted");
    },
    onError: () => toast.error("Failed to delete role"),
  });

  const savePermsMut = useMutation({
    mutationFn: ({ roleName, perms }: { roleName: string; perms: { module: string; access: string }[] }) =>
      api.roles.savePermissions(schoolId, roleName, perms),
    onSuccess: (_data: any, vars: any) => {
      void qc.invalidateQueries({ queryKey: ["custom-role-permissions-all", schoolId] });
      toast.success(`Permissions saved for "${vars.roleName}"`);
      setSavingRole(null);
    },
    onError: (_e: any, vars: any) => {
      toast.error(`Failed to save permissions for "${vars.roleName}"`);
      setSavingRole(null);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const submitAddUser = async () => {
    if (!form.name || !form.email) { toast.error("Name and email required"); return; }
    try {
      await api.users.create(schoolId, {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone || undefined,
        password: form.password || undefined,
      });
      toast.success(`${form.name} added as ${ROLE_META[form.role as Role]?.label ?? form.role}`);
      void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
      setForm({ name: "", email: "", phone: "", password: "", role: "teacher" });
      setOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? error?.message ?? "Unable to add user");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.users.updateForSchool(schoolId, userId, { role: newRole });
      toast.success("Role updated");
      void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Unable to update role");
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    try {
      await api.users.deleteForSchool(schoolId, userId);
      toast.success(`${userName} removed`);
      void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Unable to remove user");
    }
  };

  const handleCreateLogin = async () => {
    if (!createLoginTarget) return;
    setCreatingLogin(true);
    try {
      await api.users.create(schoolId, {
        name: createLoginTarget.name,
        email: createLoginTarget.email,
        role: "teacher",
        phone: createLoginTarget.phone || undefined,
        password: createLoginPassword || undefined,
      });
      toast.success(`Login created for ${createLoginTarget.name}`);
      void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
      setCreateLoginTarget(null);
      setCreateLoginPassword("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Unable to create login");
    } finally {
      setCreatingLogin(false);
    }
  };

  const handlePermChange = (roleName: string, module: string, value: string) => {
    setPendingPerms((prev) => ({
      ...prev,
      [roleName]: { ...(prev[roleName] ?? {}), [module]: value },
    }));
  };

  const handleSavePerms = (roleName: string) => {
    const rolePerms = pendingPerms[roleName] ?? {};
    const payload = modules.map((m) => ({ module: m, access: rolePerms[m] ?? "none" }));
    setSavingRole(roleName);
    savePermsMut.mutate({ roleName, perms: payload });
  };

  const openEditRole = (role: any) => {
    setEditRoleTarget(role);
    setEditRoleForm({ name: role.name ?? "", description: role.description ?? "" });
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (loadingSession) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users & Roles" />
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /><span>Loading…</span>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== "super_admin" && user.role !== "school_admin")) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users & Roles" />
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Restricted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only School Admins and System Admins can manage users and roles.
            {user && <span className="block mt-1 text-xs font-mono text-muted-foreground/60">Detected role: {user.role}</span>}
          </p>
        </div>
      </div>
    );
  }

  const counts = (Object.keys(ROLE_META) as Role[]).map((r) => ({
    role: r,
    count: users.filter((u) => {
      const normalised = (u.role ?? "").toLowerCase().replace(/[_ ]/g, "_");
      return normalised === r;
    }).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Add users, assign roles, create custom roles, and configure module permissions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-1 h-4 w-4" />Add user</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Invite user</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" placeholder="+260 977 000 000" />
                </div>
                <div>
                  <Label>Temporary password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" placeholder="Optional starter password" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submitAddUser}>Send invite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {counts.map((c) => (
          <StatCard key={c.role} label={ROLE_META[c.role].label} value={c.count} accent="primary" />
        ))}
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="matrix">Permission matrix</TabsTrigger>
          <TabsTrigger value="roles">Role definitions</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Users ──────────────────────────────────────────────── */}
        <TabsContent value="users">
          <p className="mb-3 text-sm text-muted-foreground">Change a user's role using the <strong>Role</strong> dropdown on each row. Use <strong>Add user</strong> above to invite new staff.</p>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            {usersLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Loading users…
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                    <TableRow key={u.id} className={!u.hasLogin ? "opacity-70" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{u.initials}</div>
                          <div>
                            <div className="font-medium">{u.name}</div>
                            {!u.hasLogin && <span className="text-[10px] font-medium text-amber-600">No login — staff record only</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{u.email}</div>
                        {u.phone && <div className="text-xs">{u.phone}</div>}
                      </TableCell>
                      <TableCell>
                        {u.hasLogin ? (
                          <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {assignableRoles.map((r) => (
                                <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">Staff only</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.hasLogin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(u.id, u.name)}
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => setCreateLoginTarget({ id: u.id, name: u.name, email: u.email, phone: u.phone })}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Create login
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No users found. Use <strong>Add user</strong> to invite staff.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Tab 2: Permission matrix ───────────────────────────────────── */}
        <TabsContent value="matrix">
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sticky left-0 bg-muted/40 z-10">
                    Module
                  </th>
                  {/* System role columns — read-only */}
                  {(Object.keys(ROLE_META) as Role[]).map((r) => (
                    <th key={r} className="p-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      {ROLE_META[r].label}
                    </th>
                  ))}
                  {/* Custom role columns — editable */}
                  {customRoles.map((cr: any) => (
                    <th key={cr.id} className="p-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap min-w-[130px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="rounded bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">{cr.name}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">Custom</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium capitalize sticky left-0 bg-card z-10 border-r border-border/40">
                      {m.replace(/-/g, " ")}
                    </td>
                    {/* System roles — read-only badges */}
                    {(Object.keys(ROLE_META) as Role[]).map((r) => {
                      const a = ACCESS[r][m];
                      return (
                        <td key={r} className="p-3 text-center">
                          {a === true && <Badge variant="default" className="gap-1"><Check className="h-3 w-3" />Full</Badge>}
                          {a === "read" && <Badge variant="secondary">Read</Badge>}
                          {a === false && <X className="mx-auto h-4 w-4 text-muted-foreground/40" />}
                        </td>
                      );
                    })}
                    {/* Custom role columns — editable selects */}
                    {customRoles.map((cr: any) => {
                      const val = pendingPerms[cr.name]?.[m] ?? "none";
                      return (
                        <td key={cr.id} className="p-2 text-center">
                          <Select value={val} onValueChange={(v) => handlePermChange(cr.name, m, v)}>
                            <SelectTrigger className="h-7 w-24 text-xs mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACCESS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save buttons per custom role */}
          {customRoles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {customRoles.map((cr: any) => (
                <Button
                  key={cr.id}
                  size="sm"
                  variant="outline"
                  disabled={savingRole === cr.name || savePermsMut.isPending}
                  onClick={() => handleSavePerms(cr.name)}
                >
                  {savingRole === cr.name
                    ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    : <Save className="mr-1.5 h-3.5 w-3.5" />}
                  Save "{cr.name}" permissions
                </Button>
              ))}
            </div>
          )}

          {rolesLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Loading custom roles…
            </div>
          )}
          {!rolesLoading && customRoles.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              No custom roles yet. Create one in the <strong>Role definitions</strong> tab to configure per-module permissions here.
            </p>
          )}
        </TabsContent>

        {/* ── Tab 3: Role definitions ────────────────────────────────────── */}
        <TabsContent value="roles">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              System roles are built-in and cannot be changed. <strong>Create a custom role</strong> to define a new position with specific module permissions — then assign it to users on the <strong>Users</strong> tab.
            </p>
            <Button size="sm" onClick={() => { setRoleForm({ name: "", description: "" }); setCreateRoleOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" />Create custom role
            </Button>
          </div>

          {/* System roles — read-only cards */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">System roles</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(Object.keys(ROLE_META) as Role[]).map((r) => (
                <div key={r} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${ROLE_META[r].tone}`}>{ROLE_META[r].label}</span>
                    <span className="text-xs text-muted-foreground">{users.filter((u) => u.role === r).length} users</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{ROLE_META[r].description}</p>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {modules.filter((m) => ACCESS[r][m] === true).slice(0, 6).map((m) => (
                      <Badge key={m} variant="outline" className="capitalize">{m.replace(/-/g, " ")}</Badge>
                    ))}
                    {modules.filter((m) => ACCESS[r][m] === true).length > 6 && (
                      <Badge variant="outline">+{modules.filter((m) => ACCESS[r][m] === true).length - 6}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom roles — editable cards */}
          {(rolesLoading || customRoles.length > 0) && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom roles</p>
              {rolesLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading…
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {customRoles.map((cr: any) => {
                    const permCount = Object.values(pendingPerms[cr.name] ?? {}).filter((v) => v === "full" || v === "read").length;
                    return (
                      <div key={cr.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded bg-violet-500/15 px-2 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                            {cr.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditRole(cr)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              disabled={deleteRoleMut.isPending}
                              onClick={() => deleteRoleMut.mutate(cr.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {cr.description && (
                          <p className="mt-3 text-sm text-muted-foreground">{cr.description}</p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {permCount > 0 ? `${permCount} module${permCount !== 1 ? "s" : ""} with access configured` : "No permissions configured yet — edit via the Permission matrix tab"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Create custom role dialog ──────────────────────────────────────── */}
      <Dialog open={createRoleOpen} onOpenChange={(v) => { if (!v) setCreateRoleOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create custom role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role name <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                placeholder="e.g. Registrar"
                maxLength={60}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1 min-h-16 resize-none"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="What does this role do?"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
            <Button
              disabled={createRoleMut.isPending || !roleForm.name.trim()}
              onClick={() => createRoleMut.mutate({ name: roleForm.name.trim(), description: roleForm.description.trim() || null })}
            >
              {createRoleMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create login dialog ───────────────────────────────────────────── */}
      <Dialog open={!!createLoginTarget} onOpenChange={(v) => { if (!v) { setCreateLoginTarget(null); setCreateLoginPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create login for {createLoginTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={createLoginTarget?.name ?? ""} disabled className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={createLoginTarget?.email ?? ""} disabled className="mt-1 bg-muted" />
            </div>
            <div>
              <Label>Temporary password</Label>
              <Input
                type="password"
                value={createLoginPassword}
                onChange={(e) => setCreateLoginPassword(e.target.value)}
                className="mt-1"
                placeholder="Optional — they can reset later"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Role will be set to <strong>Teacher</strong>. The staff member can log in with this email immediately after account creation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateLoginTarget(null); setCreateLoginPassword(""); }}>Cancel</Button>
            <Button onClick={handleCreateLogin} disabled={creatingLogin}>
              {creatingLogin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit custom role dialog ────────────────────────────────────────── */}
      <Dialog open={!!editRoleTarget} onOpenChange={(v) => { if (!v) setEditRoleTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role name <span className="text-destructive">*</span></Label>
              <Input
                className="mt-1"
                value={editRoleForm.name}
                onChange={(e) => setEditRoleForm({ ...editRoleForm, name: e.target.value })}
                maxLength={60}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                className="mt-1 min-h-16 resize-none"
                value={editRoleForm.description}
                onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleTarget(null)}>Cancel</Button>
            <Button
              disabled={updateRoleMut.isPending || !editRoleForm.name.trim()}
              onClick={() => editRoleTarget && updateRoleMut.mutate({
                id: editRoleTarget.id,
                data: { name: editRoleForm.name.trim(), description: editRoleForm.description.trim() || null },
              })}
            >
              {updateRoleMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
