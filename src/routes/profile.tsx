import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, Smartphone, Key, Loader2, Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import Switch from "@mui/material/Switch";
import { Button, IconButton, InputAdornment, TextField, Dialog, DialogContent, DialogActions, DialogTitle } from "@mui/material";

import { PageHeader } from "@/components/page-header";
import { useAuth, ROLE_META } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — SRMS" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, isSystemAdmin } = useAuth();
  const { active, activePlan } = useTenant();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const changePwMutation = useMutation({
    mutationFn: () => api.auth.changePassword(current, next),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setPwOpen(false);
      setCurrent(""); setNext(""); setConfirm("");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to change password"),
  });

  const updatePhoneMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Not logged in");
      return isSystemAdmin
        ? api.users.update(user.id, { phone: phone.trim() || undefined })
        : api.users.updateForSchool(user.tenantId ?? active.id, user.id, { phone: phone.trim() || undefined });
    },
    onSuccess: () => toast.success("Profile updated"),
    onError: () => toast.error("Failed to save profile"),
  });

  const saveNotifMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Not logged in");
      const payload = { notifyEmail: String(emailNotif), notifySms: String(smsNotif) };
      return isSystemAdmin
        ? api.users.update(user.id, payload as any)
        : api.users.updateForSchool(user.tenantId ?? active.id, user.id, payload as any);
    },
    onSuccess: () => toast.success("Notification preferences saved"),
    onError: () => toast.error("Failed to save preferences"),
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Manage your personal account, security, and notifications." />

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">{user.initials}</div>
          <div>
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_META[user.role].label}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <TextField label="Full name" value={user.name} disabled fullWidth size="small" className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Contact an administrator to change your name.</p>
          </div>
          <div className="space-y-1.5">
            <TextField type="email" label="Email" value={user.email ?? ""} disabled fullWidth size="small" className="bg-muted/50" placeholder="No email on file" />
            <p className="text-xs text-muted-foreground">Contact an administrator to change your email.</p>
          </div>
          <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+260 977 000 000" slotProps={{ htmlInput: { maxLength: 20 } }} fullWidth size="small" />
          <TextField label="Role" value={ROLE_META[user.role].label} disabled fullWidth size="small" className="bg-muted/50" />
          <TextField label="Tenant scope" value={user.role === "super_admin" ? "Platform-wide access" : `${active.name} (${active.shortCode})`} disabled fullWidth size="small" className="bg-muted/50" />
          <TextField label="Active plan" value={user.role === "super_admin" ? `Managing ${activePlan.name} tenant` : activePlan.name} disabled fullWidth size="small" className="bg-muted/50" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => updatePhoneMutation.mutate()}
            disabled={updatePhoneMutation.isPending}
            startIcon={updatePhoneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Save changes
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Shield className="h-4 w-4" />Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4" />Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">Require an authenticator code on every sign-in.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="flex items-center gap-2 font-medium"><Key className="h-4 w-4" />Password</p>
              <p className="text-xs text-muted-foreground">Update your account password.</p>
            </div>
            <Button variant="outlined" onClick={() => setPwOpen(true)}>Change password</Button>
          </div>
        </div>
      </section>

      <Dialog
        open={pwOpen}
        onClose={() => { setPwOpen(false); setCurrent(""); setNext(""); setConfirm(""); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change password</DialogTitle>
        <DialogContent>
          <div className="space-y-3">
            <TextField
              label="Current password"
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              fullWidth
              size="small"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrent((v) => !v)} edge="end">
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <div>
              <TextField
                label="New password"
                type={showNext ? "text" : "password"}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowNext((v) => !v)} edge="end">
                          {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>
            <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} fullWidth size="small" />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setPwOpen(false)}>Cancel</Button>
          <Button
            disabled={changePwMutation.isPending || !current || next.length < 8 || next !== confirm}
            onClick={() => changePwMutation.mutate()}
            startIcon={changePwMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Update password
          </Button>
        </DialogActions>
      </Dialog>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Notification preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-medium">Email</p><p className="text-xs text-muted-foreground">Receive daily digest of activity.</p></div>
            <Switch checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div><p className="font-medium">SMS</p><p className="text-xs text-muted-foreground">Critical alerts only.</p></div>
            <Switch checked={smsNotif} onChange={(e) => setSmsNotif(e.target.checked)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="outlined"
            disabled={saveNotifMutation.isPending}
            onClick={() => saveNotifMutation.mutate()}
            startIcon={saveNotifMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            Save
          </Button>
        </div>
      </section>
    </div>
  );
}
