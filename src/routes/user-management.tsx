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

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type BackendAppUser } from "@/lib/api";
import { ROLE_META, type Role, useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { AccessGuard } from "@/components/access-guard";

export const Route = createFileRoute("/user-management")({
  head: () => ({ meta: [{ title: "User Management - SRMS" }] }),
  component: UserManagementPage,
});

const ROLE_OPTIONS: Role[] = ["super_admin", "school_admin", "teacher", "finance", "parent"];

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
    case "finance":
    case "finance_officer":
    case "finance officer":
      return "finance";
    case "parent":
      return "parent";
    default:
      return "school_admin";
  }
}

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return <Badge className={meta.tone}>{meta.label}</Badge>;
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
        <Button asChild variant="outline">
          <Link to="/">Go to dashboard</Link>
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
        record.email,
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
            <Button variant="outline" asChild>
              <Link to="/sys-admin">Open system admin</Link>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search user name, email, phone, role, or school"
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as Role | "all")}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_META[role].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
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
                      <Badge className={active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                        {active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(record)}>
                            <UserCog className="mr-2 h-4 w-4" />
                            Edit access
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetTarget(record)}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Reset password
                          </DropdownMenuItem>
                          {record.schoolId ? (
                            <DropdownMenuItem onClick={() => openSchoolAccess(record)}>
                              <Building2 className="mr-2 h-4 w-4" />
                              Manage school users
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleActive(record)} className={!active ? "" : "text-destructive focus:text-destructive"}>
                            {active ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Reactivate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create user account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  className="mt-1"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: value as Role,
                      schoolId:
                        value === "super_admin"
                          ? ""
                          : current.schoolId || schoolOptions[0]?.id || "",
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_META[role].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  className="mt-1"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </div>
            </div>
            {createForm.role !== "super_admin" ? (
              <div>
                <Label>School</Label>
                <Select
                  value={createForm.schoolId}
                  onValueChange={(value) => setCreateForm((current) => ({ ...current, schoolId: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolOptions.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label>Temporary password</Label>
                <Input
                  className="mt-1"
                  type="password"
                  value={createForm.password}
                  onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Optional - defaults to password123"
                />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user access</DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-medium">{editTarget.name}</p>
                <p className="text-sm text-muted-foreground">{editTarget.email}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Role</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value) =>
                      setEditForm((current) => ({
                        ...current,
                        role: value as Role,
                        schoolId:
                          value === "super_admin"
                            ? ""
                            : current.schoolId || editTarget.schoolId || schoolOptions[0]?.id || "",
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_META[role].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    className="mt-1"
                    value={editForm.phone}
                    onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                  />
                </div>
              </div>
              {editForm.role !== "super_admin" ? (
                <div>
                  <Label>School</Label>
                  <Select
                    value={editForm.schoolId}
                    onValueChange={(value) => setEditForm((current) => ({ ...current, schoolId: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Active account</p>
                  <p className="text-sm text-muted-foreground">
                    Disable this to block sign-in without deleting the record.
                  </p>
                </div>
                <Button
                  variant={editForm.active ? "outline" : "secondary"}
                  size="sm"
                  onClick={() => setEditForm((current) => ({ ...current, active: !current.active }))}
                >
                  {editForm.active ? "Active" : "Inactive"}
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          {resetTarget ? (
            <div className="grid gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-medium">{resetTarget.name}</p>
                <p className="text-sm text-muted-foreground">{resetTarget.email}</p>
              </div>
              <div>
                <Label>Temporary password</Label>
                <Input
                  className="mt-1"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="e.g. Welcome2026!"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetTarget(null);
                setResetPassword("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AccessGuard>
  );
}
