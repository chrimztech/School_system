import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Menu,
  ListItemIcon,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";

import { PageHeader, StatCard } from "@/components/page-header";
import { api, type BackendAppUser } from "@/lib/api";
import { ROLE_META, type Role, useAuth } from "@/lib/auth";
import { badgeSx } from "@/lib/utils";
import { useTenant } from "@/lib/tenant";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/user-management")({
  head: () => ({ meta: [{ title: "User Management - SRMS" }] }),
  component: UserManagementPage,
});

const ROLE_OPTIONS: Role[] = ["super_admin", "school_admin", "principal", "deputy_head", "teacher", "hod", "career_guidance", "finance", "parent"];

type CreateForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  schoolId: string;
};

type EditForm = {
  role: Role;
  phone: string;
  schoolId: string;
  active: boolean;
};

function normaliseRole(role: string | null | undefined): Role {
  switch ((role ?? "").toLowerCase()) {
    case "super_admin":
    case "super admin":
      return "super_admin";
    case "school_admin":
    case "school admin":
      return "school_admin";
    case "teacher":
      return "teacher";
    case "hod":
    case "head_of_department":
    case "head of department":
      return "hod";
    case "finance":
    case "finance_officer":
    case "finance officer":
      return "finance";
    case "parent":
      return "parent";
    case "principal":
    case "head_master":
    case "headmaster":
    case "head master":
      return "principal";
    case "deputy_head":
    case "deputy_headteacher":
    case "deputy head":
      return "deputy_head";
    case "career_guidance":
    case "career_guidance_teacher":
    case "career guidance":
    case "career guidance teacher":
      return "career_guidance";
    default:
      return "school_admin";
  }
}

const ROLE_CHIP_COLORS: Record<Role, { bg: string; fg: string }> = {
  super_admin: { bg: "rgba(168,85,247,0.15)", fg: "#7e22ce" },
  school_admin: { bg: "rgba(59,130,246,0.15)", fg: "#1d4ed8" },
  teacher: { bg: "rgba(16,185,129,0.15)", fg: "#047857" },
  hod: { bg: "rgba(20,184,166,0.15)", fg: "#0f766e" },
  finance: { bg: "rgba(245,158,11,0.15)", fg: "#b45309" },
  parent: { bg: "rgba(244,63,94,0.15)", fg: "#be123c" },
  principal: { bg: "rgba(99,102,241,0.15)", fg: "#4338ca" },
  deputy_head: { bg: "rgba(99,102,241,0.15)", fg: "#4338ca" },
  career_guidance: { bg: "rgba(6,182,212,0.15)", fg: "#0e7490" },
};

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  const colors = ROLE_CHIP_COLORS[role];
  return (
    <Chip
      size="small"
      label={meta.label}
      sx={{
        bgcolor: colors.bg,
        color: colors.fg,
        border: "1px solid transparent",
        fontSize: 11,
        fontWeight: 600,
        height: "auto",
        "& .MuiChip-label": { px: 1.25, py: 0.4 },
      }}
    />
  );
}

function UserManagementPage() {
  const { user } = useAuth();
  const { tenants, setActive } = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "school_admin",
    schoolId: tenants[0]?.id ?? "",
  });
  const [editTarget, setEditTarget] = useState<BackendAppUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    role: "school_admin",
    phone: "",
    schoolId: "",
    active: true,
  });
  const [resetTarget, setResetTarget] = useState<BackendAppUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [actionsAnchor, setActionsAnchor] = useState<{ element: HTMLElement; record: BackendAppUser } | null>(null);

  const schoolOptions = useMemo(
    () => tenants.map((tenant) => ({ id: tenant.id, name: tenant.name })),
    [tenants],
  );

  const schoolNameById = useMemo(
    () =>
      Object.fromEntries(
        schoolOptions.map((school) => [school.id, school.name] as const),
      ),
    [schoolOptions],
  );

  const usersQuery = useQuery({
    queryKey: ["platform-users"],
    queryFn: () => api.users.all(),
    enabled: user?.role === "super_admin",
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      email: string;
      role: string;
      phone?: string;
      password?: string;
      schoolId?: string;
    }) => api.users.createGlobal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: {
        role?: string;
        phone?: string;
        active?: boolean;
        schoolId?: string;
        password?: string;
      };
    }) => api.users.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-users"] });
    },
  });

  if (user?.role === "school_admin") {
    return <Navigate to="/access" replace />;
  }

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">
          This area is restricted to System Administrators.
        </p>
        <Button component={Link} to="/" variant="outlined">
          Go to dashboard
        </Button>
      </div>
    );
  }

  const users = usersQuery.data ?? [];

  const filteredUsers = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return users.filter((record) => {
      const role = normaliseRole(record.role);
      if (roleFilter !== "all" && role !== roleFilter) return false;

      if (!lowered) return true;

      const schoolName = record.schoolId ? schoolNameById[record.schoolId] ?? record.schoolId : "Platform";
      return [
        record.name,
        record.email ?? "",
        record.phone ?? "",
        schoolName,
        role.replaceAll("_", " "),
      ].some((value) => value.toLowerCase().includes(lowered));
    });
  }, [query, roleFilter, schoolNameById, users]);

  const activeUsers = users.filter((record) => record.active !== false).length;
  const platformAdmins = users.filter((record) => normaliseRole(record.role) === "super_admin").length;
  const schoolAdmins = users.filter((record) => normaliseRole(record.role) === "school_admin").length;
  const inactiveUsers = users.length - activeUsers;

  const openEdit = (record: BackendAppUser) => {
    const role = normaliseRole(record.role);
    setEditTarget(record);
    setEditForm({
      role,
      phone: record.phone ?? "",
      schoolId: role === "super_admin" ? "" : record.schoolId ?? "",
      active: record.active !== false,
    });
  };

  const handleCreateUser = async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (createForm.role !== "super_admin" && !createForm.schoolId) {
      toast.error("Select a school for non-platform users");
      return;
    }

    try {
      await createUserMutation.mutateAsync({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        phone: createForm.phone.trim() || undefined,
        password: createForm.password.trim() || undefined,
        schoolId: createForm.role === "super_admin" ? undefined : createForm.schoolId,
      });
      toast.success("User account created");
      setCreateOpen(false);
      setCreateForm({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "school_admin",
        schoolId: schoolOptions[0]?.id ?? "",
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Failed to create user");
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (editForm.role !== "super_admin" && !editForm.schoolId) {
      toast.error("Select a school for non-platform users");
      return;
    }

    try {
      await updateUserMutation.mutateAsync({
        userId: editTarget.id,
        data: {
          role: editForm.role,
          phone: editForm.phone.trim() || undefined,
          schoolId: editForm.role === "super_admin" ? undefined : editForm.schoolId,
          active: editForm.active,
        },
      });
      toast.success("User access updated");
      setEditTarget(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Failed to update user");
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.trim().length < 6) {
      toast.error("Temporary password must be at least 6 characters");
      return;
    }

    try {
      await updateUserMutation.mutateAsync({
        userId: resetTarget.id,
        data: {
          schoolId:
            normaliseRole(resetTarget.role) === "super_admin"
              ? undefined
              : resetTarget.schoolId ?? undefined,
          password: resetPassword.trim(),
        },
      });
      toast.success("Password reset");
      setResetPassword("");
      setResetTarget(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Failed to reset password");
    }
  };

  const toggleActive = async (record: BackendAppUser) => {
    const role = normaliseRole(record.role);
    try {
      await updateUserMutation.mutateAsync({
        userId: record.id,
        data: {
          role,
          schoolId: role === "super_admin" ? undefined : record.schoolId ?? undefined,
          active: record.active === false,
        },
      });
      toast.success(record.active === false ? "User reactivated" : "User deactivated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Failed to update account status");
    }
  };

  const openSchoolAccess = (record: BackendAppUser) => {
    if (!record.schoolId) return;
    setActive(record.schoolId);
    navigate({ to: "/access" });
  };

  return (
    <AccessGuard module="user-management">
      <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage platform administrators and school accounts across every active tenant."
        actions={
          <>
            <Button variant="outlined" component={Link} to="/sys-admin">Open system admin</Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              Add user
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active users" value={activeUsers} accent="primary" icon={<Users className="h-4 w-4" />} />
        <StatCard label="System admins" value={platformAdmins} accent="accent" icon={<ShieldAlert className="h-4 w-4" />} />
        <StatCard label="School admins" value={schoolAdmins} accent="success" icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Inactive accounts" value={inactiveUsers} accent="warning" icon={<XCircle className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <TextField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user name, email, phone, role, or school"
              fullWidth
              size="small"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> } }}
            />
          </div>
          <TextField
            select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as Role | "all")}
            size="small"
            className="w-full md:w-56"
          >
            <MenuItem value="all">All roles</MenuItem>
            {ROLE_OPTIONS.map((role) => (
              <MenuItem key={role} value={role}>
                {ROLE_META[role].label}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>School</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell className="text-right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading platform users...
                  </span>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No users match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((record) => {
                const role = normaliseRole(record.role);
                const schoolName = record.schoolId ? schoolNameById[record.schoolId] ?? record.schoolId : "Platform";
                const active = record.active !== false;

                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.name}</p>
                        <p className="text-xs text-muted-foreground">{record.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={role} />
                    </TableCell>
                    <TableCell>{schoolName}</TableCell>
                    <TableCell>{record.phone || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={active ? "Active" : "Inactive"}
                        sx={badgeSx(active ? "success" : "secondary")}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <IconButton
                        size="small"
                        aria-label={`Actions for ${record.name}`}
                        onClick={(event) => setActionsAnchor({ element: event.currentTarget, record })}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </TableContainer>
      </div>

      <Menu
        anchorEl={actionsAnchor?.element ?? null}
        open={Boolean(actionsAnchor)}
        onClose={() => setActionsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {actionsAnchor ? (
          [
            <MenuItem
              key="edit"
              onClick={() => {
                openEdit(actionsAnchor.record);
                setActionsAnchor(null);
              }}
            >
              <ListItemIcon><UserCog className="h-4 w-4" /></ListItemIcon>
              Edit access
            </MenuItem>,
            <MenuItem
              key="reset"
              onClick={() => {
                setResetTarget(actionsAnchor.record);
                setActionsAnchor(null);
              }}
            >
              <ListItemIcon><KeyRound className="h-4 w-4" /></ListItemIcon>
              Reset password
            </MenuItem>,
            actionsAnchor.record.schoolId ? (
              <MenuItem
                key="manage-school"
                onClick={() => {
                  openSchoolAccess(actionsAnchor.record);
                  setActionsAnchor(null);
                }}
              >
                <ListItemIcon><Building2 className="h-4 w-4" /></ListItemIcon>
                Manage school users
              </MenuItem>
            ) : null,
            <Divider key="divider" />,
            <MenuItem
              key="toggle-active"
              onClick={() => {
                toggleActive(actionsAnchor.record);
                setActionsAnchor(null);
              }}
              sx={actionsAnchor.record.active !== false ? { color: "error.main" } : undefined}
            >
              {actionsAnchor.record.active !== false ? (
                <>
                  <ListItemIcon><XCircle className="h-4 w-4" /></ListItemIcon>
                  Deactivate
                </>
              ) : (
                <>
                  <ListItemIcon><CheckCircle2 className="h-4 w-4" /></ListItemIcon>
                  Reactivate
                </>
              )}
            </MenuItem>,
          ]
        ) : null}
      </Menu>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create user account</DialogTitle>
        <DialogContent>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Name"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                type="email"
                label="Email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                fullWidth
                size="small"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                select
                label="Role"
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as Role,
                    schoolId:
                      event.target.value === "super_admin"
                        ? ""
                        : current.schoolId || schoolOptions[0]?.id || "",
                  }))
                }
                fullWidth
                size="small"
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role} value={role}>
                    {ROLE_META[role].label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Phone"
                value={createForm.phone}
                onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
                fullWidth
                size="small"
              />
            </div>
            {createForm.role !== "super_admin" ? (
              <TextField
                select
                label="School"
                value={createForm.schoolId}
                onChange={(event) => setCreateForm((current) => ({ ...current, schoolId: event.target.value }))}
                fullWidth
                size="small"
              >
                {schoolOptions.map((school) => (
                  <MenuItem key={school.id} value={school.id}>
                    {school.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              type="password"
              label="Temporary password"
              value={createForm.password}
              onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Optional - defaults to password123"
              fullWidth
              size="small"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateUser} disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create user
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit user access</DialogTitle>
        <DialogContent>
          {editTarget ? (
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-medium">{editTarget.name}</p>
                <p className="text-sm text-muted-foreground">{editTarget.email}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  select
                  label="Role"
                  value={editForm.role}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      role: event.target.value as Role,
                      schoolId:
                        event.target.value === "super_admin"
                          ? ""
                          : current.schoolId || editTarget.schoolId || schoolOptions[0]?.id || "",
                    }))
                  }
                  fullWidth
                  size="small"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <MenuItem key={role} value={role}>
                      {ROLE_META[role].label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Phone"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                  fullWidth
                  size="small"
                />
              </div>
              {editForm.role !== "super_admin" ? (
                <TextField
                  select
                  label="School"
                  value={editForm.schoolId}
                  onChange={(event) => setEditForm((current) => ({ ...current, schoolId: event.target.value }))}
                  fullWidth
                  size="small"
                >
                  {schoolOptions.map((school) => (
                    <MenuItem key={school.id} value={school.id}>
                      {school.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Active account</p>
                  <p className="text-sm text-muted-foreground">
                    Disable this to block sign-in without deleting the record.
                  </p>
                </div>
                <Button
                  variant="outlined"
                  color={editForm.active ? undefined : "inherit"}
                  size="small"
                  onClick={() => setEditForm((current) => ({ ...current, active: !current.active }))}
                >
                  {editForm.active ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setEditTarget(null)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={updateUserMutation.isPending}>
            {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onClose={() => setResetTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          {resetTarget ? (
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-medium">{resetTarget.name}</p>
                <p className="text-sm text-muted-foreground">{resetTarget.email}</p>
              </div>
              <TextField
                label="Temporary password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="e.g. Welcome2026!"
                fullWidth
                size="small"
              />
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => {
              setResetTarget(null);
              setResetPassword("");
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleResetPassword} disabled={updateUserMutation.isPending}>
            {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reset password
          </Button>
        </DialogActions>
      </Dialog>
    </div>
    </AccessGuard>
  );
}
