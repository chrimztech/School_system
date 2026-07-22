import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Shield, Trash2, UserPlus, Check, X, Pencil, Loader2, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Tabs,
  Tab,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth, ACCESS, MODULE_MATRIX, ROLE_META, type Role } from "@/lib/auth";
import { AccessGuard } from "@/components/access-guard";
import { api } from "@/lib/api";
import { useTenant } from "@/lib/tenant";
import { badgeSx } from "@/lib/utils";

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
  const [tab, setTab] = useState("users");
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

  // ── Reset-password dialog state ────────────────────────────────────────────
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const resetPasswordMut = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      api.users.updateForSchool(schoolId, userId, { password } as any),
    onSuccess: (_, vars) => {
      toast.success(`Password reset — share the new temporary password with ${resetTarget?.name}`);
      setResetTarget(null);
      setResetPassword("");
    },
    onError: () => toast.error("Failed to reset password"),
  });

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

  // School admins don't manage platform-level roles
  const isSystemAdmin = user.role === "super_admin";
  const visibleSystemRoles = (Object.keys(ROLE_META) as Role[]).filter(
    (r) => isSystemAdmin || r !== "super_admin"
  );

  const counts = visibleSystemRoles.map((r) => ({
    role: r,
    count: users.filter((u) => {
      const normalised = (u.role ?? "").toLowerCase().replace(/[_ ]/g, "_");
      return normalised === r;
    }).length,
  }));

  return (
    <AccessGuard module="access">
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Add users, assign roles, create custom roles, and configure module permissions"
        actions={
          <>
            <Button startIcon={<UserPlus size={16} />} onClick={() => setOpen(true)}>Add user</Button>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Invite user</DialogTitle>
              <DialogContent>
                <div className="space-y-3">
                  <TextField label="Name" fullWidth size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <TextField label="Email" type="email" fullWidth size="small" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <TextField label="Phone" fullWidth size="small" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+260 977 000 000" />
                  <TextField label="Temporary password" type="password" fullWidth size="small" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Optional starter password" />
                  <TextField select label="Role" fullWidth size="small" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    {assignableRoles.map((r) => (
                      <MenuItem key={r} value={r}>{ROLE_META[r].label}</MenuItem>
                    ))}
                  </TextField>
                </div>
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submitAddUser}>Send invite</Button>
              </DialogActions>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {counts.map((c) => (
          <StatCard key={c.role} label={ROLE_META[c.role].label} value={c.count} accent="primary" />
        ))}
      </div>

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="users" label="Users" />
        <Tab value="matrix" label="Permission matrix" />
        <Tab value="roles" label="Role definitions" />
      </Tabs>

      {/* ── Tab 1: Users ──────────────────────────────────────────────── */}
      {tab === "users" && (
        <Box>
          <p className="mb-3 text-sm text-muted-foreground">Change a user's role using the <strong>Role</strong> dropdown on each row. Use <strong>Add user</strong> above to invite new staff.</p>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            {usersLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Loading users…
              </div>
            ) : (
            <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell className="w-32 text-right">Actions</TableCell>
                </TableRow>
              </TableHead>
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
                          <TextField select size="small" className="w-44" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                            {assignableRoles.map((r) => (
                              <MenuItem key={r} value={r}>{ROLE_META[r].label}</MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <Chip size="small" label="Staff only" sx={badgeSx("warning")} />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {u.hasLogin ? (
                            <>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<KeyRound size={12} />}
                                sx={{ height: 28 }}
                                onClick={() => { setResetTarget({ id: u.id, name: u.name, email: u.email }); setResetPassword(""); }}
                              >
                                Reset password
                              </Button>
                              <IconButton
                                aria-label="Remove user"
                                size="small"
                                onClick={() => handleRemoveUser(u.id, u.name)}
                                disabled={u.id === user?.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </>
                          ) : (
                            <Button
                              variant="outlined"
                              color="warning"
                              size="small"
                              startIcon={<KeyRound size={14} />}
                              onClick={() => setCreateLoginTarget({ id: u.id, name: u.name, email: u.email, phone: u.phone })}
                            >
                              Create login
                            </Button>
                          )}
                        </div>
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
            </TableContainer>
            )}
          </div>
        </Box>
      )}

      {/* ── Tab 2: Permission matrix ───────────────────────────────────── */}
      {tab === "matrix" && (
        <Box>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sticky left-0 bg-muted/40 z-10">
                    Module
                  </th>
                  {/* System role columns — read-only */}
                  {visibleSystemRoles.map((r) => (
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
                    {visibleSystemRoles.map((r) => {
                      const a = ACCESS[r][m];
                      return (
                        <td key={r} className="p-3 text-center">
                          {a === true && <Chip size="small" icon={<Check size={12} />} label="Full" sx={badgeSx("default")} />}
                          {a === "read" && <Chip size="small" label="Read" sx={badgeSx("secondary")} />}
                          {a === false && <X className="mx-auto h-4 w-4 text-muted-foreground/40" />}
                        </td>
                      );
                    })}
                    {/* Custom role columns — editable selects */}
                    {customRoles.map((cr: any) => {
                      const val = pendingPerms[cr.name]?.[m] ?? "none";
                      return (
                        <td key={cr.id} className="p-2 text-center">
                          <TextField select size="small" className="mx-auto w-24" value={val} onChange={(e) => handlePermChange(cr.name, m, e.target.value)}>
                            {ACCESS_OPTIONS.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </MenuItem>
                            ))}
                          </TextField>
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
                  size="small"
                  variant="outlined"
                  disabled={savingRole === cr.name || savePermsMut.isPending}
                  onClick={() => handleSavePerms(cr.name)}
                  startIcon={savingRole === cr.name
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Save size={14} />}
                >
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
        </Box>
      )}

      {/* ── Tab 3: Role definitions ────────────────────────────────────── */}
      {tab === "roles" && (
        <Box>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              System roles are built-in and cannot be changed. <strong>Create a custom role</strong> to define a new position with specific module permissions — then assign it to users on the <strong>Users</strong> tab.
            </p>
            <Button size="small" startIcon={<Plus size={16} />} onClick={() => { setRoleForm({ name: "", description: "" }); setCreateRoleOpen(true); }}>
              Create custom role
            </Button>
          </div>

          {/* System roles — read-only cards */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">System roles</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visibleSystemRoles.map((r) => (
                <div key={r} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${ROLE_META[r].tone}`}>{ROLE_META[r].label}</span>
                    <span className="text-xs text-muted-foreground">{users.filter((u) => u.role === r).length} users</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{ROLE_META[r].description}</p>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {modules.filter((m) => ACCESS[r][m] === true).slice(0, 6).map((m) => (
                      <Chip
                        key={m}
                        size="small"
                        label={m.replace(/-/g, " ")}
                        sx={{ ...badgeSx("outline"), textTransform: "capitalize" }}
                      />
                    ))}
                    {modules.filter((m) => ACCESS[r][m] === true).length > 6 && (
                      <Chip
                        size="small"
                        label={`+${modules.filter((m) => ACCESS[r][m] === true).length - 6}`}
                        sx={badgeSx("outline")}
                      />
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
                            <IconButton
                              aria-label="Edit role"
                              size="small"
                              onClick={() => openEditRole(cr)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                              aria-label="Delete role"
                              size="small"
                              color="error"
                              disabled={deleteRoleMut.isPending}
                              onClick={() => deleteRoleMut.mutate(cr.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
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
        </Box>
      )}

      {/* ── Create custom role dialog ──────────────────────────────────────── */}
      <Dialog open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create custom role</DialogTitle>
        <DialogContent>
          <div className="space-y-3">
            <TextField
              label={<>Role name <span className="text-destructive">*</span></>}
              fullWidth
              size="small"
              value={roleForm.name}
              onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              placeholder="e.g. Registrar"
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              label="Description"
              fullWidth
              size="small"
              multiline
              minRows={3}
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              placeholder="What does this role do?"
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
          <Button
            disabled={createRoleMut.isPending || !roleForm.name.trim()}
            onClick={() => createRoleMut.mutate({ name: roleForm.name.trim(), description: roleForm.description.trim() || null })}
            startIcon={createRoleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Create role
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create login dialog ───────────────────────────────────────────── */}
      <Dialog open={!!createLoginTarget} onClose={() => { setCreateLoginTarget(null); setCreateLoginPassword(""); }} maxWidth="sm" fullWidth>
        <DialogTitle>Create login for {createLoginTarget?.name}</DialogTitle>
        <DialogContent>
          <div className="space-y-3">
            <TextField label="Name" fullWidth size="small" value={createLoginTarget?.name ?? ""} disabled />
            <TextField label="Email" fullWidth size="small" value={createLoginTarget?.email ?? ""} disabled />
            <TextField
              label="Temporary password"
              type="password"
              fullWidth
              size="small"
              value={createLoginPassword}
              onChange={(e) => setCreateLoginPassword(e.target.value)}
              placeholder="Optional — they can reset later"
            />
            <p className="text-xs text-muted-foreground">
              Role will be set to <strong>Teacher</strong>. The staff member can log in with this email immediately after account creation.
            </p>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => { setCreateLoginTarget(null); setCreateLoginPassword(""); }}>Cancel</Button>
          <Button onClick={handleCreateLogin} disabled={creatingLogin} startIcon={creatingLogin ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>
            Create login
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset password dialog ─────────────────────────────────────────── */}
      <Dialog open={!!resetTarget} onClose={() => { setResetTarget(null); setResetPassword(""); }} maxWidth="sm" fullWidth>
        <DialogTitle>Reset password — {resetTarget?.name}</DialogTitle>
        <DialogContent>
          <div className="space-y-3 py-1">
            <TextField label="Email" fullWidth size="small" value={resetTarget?.email ?? ""} disabled />
            <div>
              <TextField
                label={<>New temporary password <span className="text-destructive">*</span></>}
                fullWidth
                size="small"
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="e.g. Welcome2026!"
                slotProps={{ htmlInput: { maxLength: 60 } }}
              />
              <p className="mt-1 text-xs text-muted-foreground">Share this with the user — they should change it after signing in.</p>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => { setResetTarget(null); setResetPassword(""); }}>Cancel</Button>
          <Button
            disabled={resetPasswordMut.isPending || !resetPassword.trim() || resetPassword.length < 6}
            onClick={() => resetTarget && resetPasswordMut.mutate({ userId: resetTarget.id, password: resetPassword.trim() })}
            startIcon={resetPasswordMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Reset password
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit custom role dialog ────────────────────────────────────────── */}
      <Dialog open={!!editRoleTarget} onClose={() => setEditRoleTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit role</DialogTitle>
        <DialogContent>
          <div className="space-y-3">
            <TextField
              label={<>Role name <span className="text-destructive">*</span></>}
              fullWidth
              size="small"
              value={editRoleForm.name}
              onChange={(e) => setEditRoleForm({ ...editRoleForm, name: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              label="Description"
              fullWidth
              size="small"
              multiline
              minRows={3}
              value={editRoleForm.description}
              onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setEditRoleTarget(null)}>Cancel</Button>
          <Button
            disabled={updateRoleMut.isPending || !editRoleForm.name.trim()}
            onClick={() => editRoleTarget && updateRoleMut.mutate({
              id: editRoleTarget.id,
              data: { name: editRoleForm.name.trim(), description: editRoleForm.description.trim() || null },
            })}
            startIcon={updateRoleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Save changes
          </Button>
        </DialogActions>
      </Dialog>
    </div>
    </AccessGuard>
  );
}
