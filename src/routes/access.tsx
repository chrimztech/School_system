import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Shield, Trash2, UserPlus, Check, X, Pencil, Loader2, Save, KeyRound, Copy } from "lucide-react";
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
  DialogContentText,
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
import { isSchoolLeadershipRole, useAuth, ACCESS, MODULE_MATRIX, ROLE_META, type Role } from "@/lib/auth";
import { AccessGuard } from "@/components/access-guard";
import { api } from "@/lib/api";
import { useTenant } from "@/lib/tenant";
import { badgeSx } from "@/lib/utils";

export const Route = createFileRoute("/access")({
  head: () => ({ meta: [{ title: "Access Management — SRMS" }] }),
  component: AccessPage,
});

// Platform-level modules (system-admin console pages) are false for every school-tenant
// role and never appear in a school's nav — showing them here is 17 rows of dead "×" that
// a school admin has to scroll past to find anything relevant to running their school.
const PLATFORM_ONLY_MODULES = new Set([
  "onboarding", "district-management", "platform-ops", "tenant-success", "plan-catalog",
  "support-desk", "platform-config", "tenant-lifecycle", "platform-audit", "revenue-ops",
  "data-governance", "partner-management", "contract-center", "status-center",
  "approval-center", "developer-console", "tenant-workbench",
]);
const modules = MODULE_MATRIX.filter((m) => !PLATFORM_ONLY_MODULES.has(m));

// A handful of module keys don't read well as a plain "replace dashes, capitalize" — most
// notably "canteen", which is the sidebar's "Dining Hall" everywhere else in the app now.
const MODULE_LABEL_OVERRIDES: Record<string, string> = { canteen: "Dining Hall", ptc: "PTC Committee", hr: "HR" };
function moduleLabel(m: string): string {
  return MODULE_LABEL_OVERRIDES[m] ?? m.replace(/-/g, " ");
}

// Access level options for custom role permission cells
const ACCESS_OPTIONS = [
  { value: "full", label: "Full" },
  { value: "read", label: "Read" },
  { value: "none", label: "None" },
];

// System roles start from the hardcoded baseline every non-super-admin sees below — "default"
// removes any override for that cell rather than persisting a redundant "same as baseline" row.
const SYSTEM_ACCESS_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "full", label: "Full" },
  { value: "read", label: "Read" },
  { value: "none", label: "None" },
];

function AccessPage() {
  const [tab, setTab] = useState("users");
  const [userSearch, setUserSearch] = useState("");
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
      // Backend sends the role as its uppercase enum name (e.g. "TEACHER"); every MenuItem
      // value in this page's role selects is the lowercase Role type ("teacher"). Left
      // un-normalized, MUI's Select can never match the current value against any option
      // and silently renders blank — which is exactly what makes changing a role feel unsafe
      // (you can't see what it currently is before picking something else).
      role: ((u.role as string) ?? "teacher").toLowerCase(),
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

  // ── Generated-credential reveal dialog ─────────────────────────────────────
  // Shown once, right after creating a user/login with no password specified — the backend
  // generates a random temporary password and returns it only in that response, never again,
  // so this is the one chance to hand it to the admin.
  const [generatedCredential, setGeneratedCredential] = useState<{ name: string; email: string; password: string } | null>(null);
  const copyGeneratedPassword = () => {
    if (!generatedCredential) return;
    navigator.clipboard?.writeText(generatedCredential.password).then(
      () => toast.success("Password copied"),
      () => toast.error("Couldn't copy — select and copy it manually"),
    );
  };

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
  // Track which roles have unsaved edits, so a "Save" affordance only appears where it's
  // actually needed instead of one button per role permanently sitting below the table.
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());
  const [dirtySysRoles, setDirtySysRoles] = useState<Set<string>>(new Set());

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
      setDirtyRoles((prev) => { const next = new Set(prev); next.delete(vars.roleName); return next; });
    },
    onError: (_e: any, vars: any) => {
      toast.error(`Failed to save permissions for "${vars.roleName}"`);
      setSavingRole(null);
    },
  });

  // ── System role permission overrides ────────────────────────────────────────
  // A super admin can grant or revoke a built-in role's (Teacher, HOD, Finance Officer, ...)
  // module access for this school, on top of the hardcoded baseline every other admin sees as
  // read-only below. Stored separately from custom-role permissions (see api.ts) so a school's
  // own custom role names can never collide with a system role's override.
  const [sysPendingPerms, setSysPendingPerms] = useState<Record<string, Record<string, string>>>({});
  const [sysLoadedRoles, setSysLoadedRoles] = useState<Set<string>>(new Set());
  const [savingSysRole, setSavingSysRole] = useState<string | null>(null);
  const overridableSystemRoles = (Object.keys(ROLE_META) as Role[]).filter((r) => r !== "super_admin");

  useQuery({
    queryKey: ["system-role-permissions-all", schoolId],
    queryFn: async () => {
      const results: Record<string, Record<string, string>> = {};
      await Promise.all(
        overridableSystemRoles.map(async (role) => {
          if (sysLoadedRoles.has(role)) return;
          try {
            const perms = await api.systemRolePermissions.get(schoolId, role);
            const map: Record<string, string> = {};
            (perms as any[]).forEach((p: any) => { map[p.module] = p.access; });
            results[role] = map;
          } catch {
            results[role] = {};
          }
        })
      );
      if (Object.keys(results).length > 0) {
        setSysPendingPerms((prev) => ({ ...results, ...prev }));
        setSysLoadedRoles((prev) => {
          const next = new Set(prev);
          Object.keys(results).forEach((n) => next.add(n));
          return next;
        });
      }
      return results;
    },
    enabled: Boolean(schoolId),
  });

  const saveSysPermsMut = useMutation({
    mutationFn: ({ role, perms }: { role: string; perms: { module: string; access: string }[] }) =>
      api.systemRolePermissions.save(schoolId, role, perms),
    onSuccess: (_data: any, vars: any) => {
      void qc.invalidateQueries({ queryKey: ["system-role-permissions-all", schoolId] });
      toast.success(`Permissions saved for "${ROLE_META[vars.role as Role].label}"`);
      setSavingSysRole(null);
      setDirtySysRoles((prev) => { const next = new Set(prev); next.delete(vars.role); return next; });
    },
    onError: (_e: any, vars: any) => {
      toast.error(`Failed to save permissions for "${ROLE_META[vars.role as Role].label}"`);
      setSavingSysRole(null);
    },
  });

  const handleSysPermChange = (role: string, module: string, value: string) => {
    setSysPendingPerms((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [module]: value },
    }));
    setDirtySysRoles((prev) => new Set(prev).add(role));
  };

  const handleSaveSysPerms = (role: string) => {
    const rolePerms = sysPendingPerms[role] ?? {};
    // "default" means no override for that module — omit it so the row is simply absent
    // (and thus falls back to the hardcoded baseline) rather than persisting a redundant row.
    const payload = modules
      .filter((m) => (rolePerms[m] ?? "default") !== "default")
      .map((m) => ({ module: m, access: rolePerms[m] }));
    setSavingSysRole(role);
    saveSysPermsMut.mutate({ role, perms: payload });
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const submitAddUser = async () => {
    if (!form.name || !form.email) { toast.error("Name and email required"); return; }
    try {
      const created = await api.users.create(schoolId, {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone || undefined,
        password: form.password || undefined,
      });
      toast.success(`${form.name} added as ${ROLE_META[form.role as Role]?.label ?? form.role}`);
      void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
      setOpen(false);
      if (created.temporaryPassword) {
        setGeneratedCredential({ name: form.name, email: form.email, password: created.temporaryPassword });
      }
      setForm({ name: "", email: "", phone: "", password: "", role: "teacher" });
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
    if (!window.confirm(`Remove ${userName}'s login? They will no longer be able to sign in.`)) return;
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
      const created = await api.users.create(schoolId, {
        name: createLoginTarget.name,
        email: createLoginTarget.email,
        role: "teacher",
        phone: createLoginTarget.phone || undefined,
        password: createLoginPassword || undefined,
      });
      toast.success(`Login created for ${createLoginTarget.name}`);
      void qc.invalidateQueries({ queryKey: ["school-users", schoolId] });
      if (created.temporaryPassword) {
        setGeneratedCredential({ name: createLoginTarget.name, email: createLoginTarget.email, password: created.temporaryPassword });
      }
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
    setDirtyRoles((prev) => new Set(prev).add(roleName));
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

  if (!user || !isSchoolLeadershipRole(user.role)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users & Roles" />
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Restricted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only school leadership and the System Administrator can manage users and roles.
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

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return [u.name, u.email, u.role].some((v) => (v ?? "").toLowerCase().includes(q));
  });

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
                  <TextField label="Temporary password" type="password" fullWidth size="small" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to auto-generate one" />
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
          <TextField
            size="small"
            className="mb-3 max-w-xs"
            fullWidth
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by name, email, or role"
          />
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
                {filteredUsers.map((u) => (
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
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      {users.length === 0
                        ? <>No users found. Use <strong>Add user</strong> to invite staff.</>
                        : "No users match your search."}
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
                  {/* System role columns — editable by super admin only; read-only (but still
                      reflecting any override a super admin has set) for everyone else. Each
                      editable column carries its own Save button, shown only once that column
                      has an unsaved edit, rather than a permanent wall of buttons below the
                      table for every role regardless of whether it changed. */}
                  {visibleSystemRoles.map((r) => (
                    <th key={r} className="p-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span>{ROLE_META[r].label}</span>
                        {isSystemAdmin && r !== "super_admin" && (
                          dirtySysRoles.has(r) ? (
                            <Button
                              size="small"
                              variant="contained"
                              color="secondary"
                              sx={{ minWidth: 0, height: 22, px: 1, fontSize: 10, textTransform: "none" }}
                              disabled={savingSysRole === r || saveSysPermsMut.isPending}
                              onClick={() => handleSaveSysPerms(r)}
                              startIcon={savingSysRole === r ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save size={11} />}
                            >
                              Save
                            </Button>
                          ) : (
                            <span className="text-[10px] font-normal normal-case text-muted-foreground/70">Editable</span>
                          )
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Custom role columns — editable, same per-column Save-when-dirty pattern */}
                  {customRoles.map((cr: any) => (
                    <th key={cr.id} className="p-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap min-w-[130px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="rounded bg-violet-500/15 px-2 py-0.5 text-violet-700 dark:text-violet-300">{cr.name}</span>
                        {dirtyRoles.has(cr.name) ? (
                          <Button
                            size="small"
                            variant="contained"
                            sx={{ minWidth: 0, height: 22, px: 1, fontSize: 10, textTransform: "none" }}
                            disabled={savingRole === cr.name || savePermsMut.isPending}
                            onClick={() => handleSavePerms(cr.name)}
                            startIcon={savingRole === cr.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save size={11} />}
                          >
                            Save
                          </Button>
                        ) : (
                          <span className="text-[10px] font-normal text-muted-foreground/70">Custom</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m} className="border-b border-border last:border-0">
                    <td className="p-3 font-medium capitalize sticky left-0 bg-card z-10 border-r border-border/40">
                      {moduleLabel(m)}
                    </td>
                    {/* System roles — editable (super admin) or effective-value read-only (everyone else) */}
                    {visibleSystemRoles.map((r) => {
                      const baseline = ACCESS[r][m];
                      const override = r === "super_admin" ? undefined : sysPendingPerms[r]?.[m];

                      if (isSystemAdmin && r !== "super_admin") {
                        return (
                          <td key={r} className="p-2 text-center">
                            <TextField
                              select
                              size="small"
                              className="mx-auto w-24"
                              value={override ?? "default"}
                              onChange={(e) => handleSysPermChange(r, m, e.target.value)}
                              sx={override && override !== "default" ? { "& .MuiOutlinedInput-notchedOutline": { borderColor: "primary.main" } } : undefined}
                            >
                              {SYSTEM_ACCESS_OPTIONS.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.value === "default" ? `Default (${baseline === true ? "Full" : baseline === "read" ? "Read" : "None"})` : opt.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </td>
                        );
                      }

                      const effective: typeof baseline = override === "full" ? true : override === "read" ? "read" : override === "none" ? false : baseline;
                      return (
                        <td key={r} className="p-3 text-center">
                          {effective === true && <Chip size="small" icon={<Check size={12} />} label="Full" sx={badgeSx("default")} />}
                          {effective === "read" && <Chip size="small" label="Read" sx={badgeSx("secondary")} />}
                          {effective === false && <X className="mx-auto h-4 w-4 text-muted-foreground/40" />}
                          {override && override !== "default" && (
                            <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide text-primary">Overridden</span>
                          )}
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

          {/* Each editable column now carries its own Save button once it has an unsaved
              edit (see the table header above). This bar is just a discoverability aid for
              wide tables, since a changed column's Save button can scroll out of view. */}
          {(dirtySysRoles.size > 0 || dirtyRoles.size > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Unsaved changes:</span>
              {[...dirtySysRoles].map((r) => <Chip key={`sys-${r}`} size="small" label={ROLE_META[r as Role].label} sx={badgeSx("secondary")} />)}
              {[...dirtyRoles].map((name) => <Chip key={`custom-${name}`} size="small" label={name} sx={badgeSx("secondary")} />)}
              <span className="ml-auto">Use the Save button in that column's header.</span>
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
                        label={moduleLabel(m)}
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
              placeholder="Leave blank to auto-generate one"
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

      {/* ── Generated-credential reveal dialog ─────────────────────────────── */}
      <Dialog open={!!generatedCredential} onClose={() => setGeneratedCredential(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Temporary password generated</DialogTitle>
        <DialogContent>
          <div className="space-y-3">
            <DialogContentText>
              No password was entered for <strong>{generatedCredential?.name}</strong>, so a random one was
              generated. Share it with them now — it won't be shown again, and they'll be asked to set
              their own password the first time they sign in.
            </DialogContentText>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">{generatedCredential?.email}</p>
                <p className="font-mono text-lg font-semibold tracking-wide">{generatedCredential?.password}</p>
              </div>
              <Button size="small" variant="outlined" startIcon={<Copy size={14} />} onClick={copyGeneratedPassword}>
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setGeneratedCredential(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </div>
    </AccessGuard>
  );
}
