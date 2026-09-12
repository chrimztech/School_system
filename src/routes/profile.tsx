import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Shield, Smartphone, Key, Loader2, Eye, EyeOff, Upload, ImageIcon, PenTool } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Switch from "@mui/material/Switch";
import { Button, Chip, IconButton, InputAdornment, TextField, Tooltip, Dialog, DialogContent, DialogActions, DialogTitle } from "@mui/material";
import { badgeSx } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { useAuth, ROLE_META } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { api } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — SRMS" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
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

  // Editing your own contact details/notification prefs is self-service — it must never
  // depend on the "manage other accounts" permission that users.update/updateForSchool
  // require, which every non-leadership role (teacher, hod, finance, career_guidance, parent)
  // lacks and would 403 on for editing even their own profile.
  const updatePhoneMutation = useMutation({
    mutationFn: () => api.auth.updateMe({ phone: phone.trim() || undefined }),
    onSuccess: () => toast.success("Profile updated"),
    onError: () => toast.error("Failed to save profile"),
  });

  const saveNotifMutation = useMutation({
    mutationFn: () => api.auth.updateMe({ notifyEmail: emailNotif, notifySms: smsNotif }),
    onSuccess: () => toast.success("Notification preferences saved"),
    onError: () => toast.error("Failed to save preferences"),
  });

  // Only roles that plausibly have a linked Teacher (staff) record — resolved server-side by
  // matching this account's email, never trusted from the client. Parents and platform admins
  // never have one, so there's no point even asking.
  const STAFF_ROLES = new Set(["teacher", "hod", "principal", "deputy_head", "school_admin", "career_guidance"]);
  const canHaveStaffProfile = !!user && STAFF_ROLES.has(user.role);
  const { data: myTeacherProfile } = useQuery({
    queryKey: ["my-teacher-profile", active.id, user?.email],
    queryFn: () => api.teachers.getMyProfile(active.id),
    enabled: canHaveStaffProfile && !!active.id,
    retry: false,
  });
  const [photoUrl, setPhotoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (myTeacherProfile) {
      setPhotoUrl(myTeacherProfile.photoUrl ?? "");
      setSignatureUrl(myTeacherProfile.signatureUrl ?? "");
    }
  }, [myTeacherProfile]);

  const saveStaffProfileMutation = useMutation({
    mutationFn: (fields: Record<string, string>) => api.teachers.updateMyProfile(active.id, fields),
    onSuccess: () => toast.success("Staff profile updated"),
    onError: () => toast.error("Failed to update staff profile"),
  });

  const readAsDataUrl = (file: File, setter: (value: string) => void) => {
    if (file.size > 10_000_000) { toast.error("File too large. Max 10MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

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
          {user.role !== "parent" && (
            <>
              <TextField label="Tenant scope" value={user.role === "super_admin" ? "Platform-wide access" : `${active.name} (${active.shortCode})`} disabled fullWidth size="small" className="bg-muted/50" />
              <TextField label="Active plan" value={user.role === "super_admin" ? `Managing ${activePlan.name} tenant` : activePlan.name} disabled fullWidth size="small" className="bg-muted/50" />
            </>
          )}
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

      {canHaveStaffProfile && myTeacherProfile && (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-1 text-base font-semibold">Staff profile</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Your portrait and signature appear on report cards, ID cards, and other official documents.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Portrait</p>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40">
                  {photoUrl ? (
                    <img src={photoUrl} alt="My portrait" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readAsDataUrl(f, setPhotoUrl); }}
                />
                <Button variant="outlined" size="small" startIcon={<Upload className="h-4 w-4" />} onClick={() => photoInputRef.current?.click()}>
                  {photoUrl ? "Change" : "Upload"}
                </Button>
                {photoUrl && <Button variant="text" color="inherit" size="small" onClick={() => setPhotoUrl("")}>Remove</Button>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Signature</p>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
                  {signatureUrl ? (
                    <img src={signatureUrl} alt="My signature" className="h-full w-full object-contain" />
                  ) : (
                    <PenTool className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) readAsDataUrl(f, setSignatureUrl); }}
                />
                <Button variant="outlined" size="small" startIcon={<Upload className="h-4 w-4" />} onClick={() => signatureInputRef.current?.click()}>
                  {signatureUrl ? "Change" : "Upload"}
                </Button>
                {signatureUrl && <Button variant="text" color="inherit" size="small" onClick={() => setSignatureUrl("")}>Remove</Button>}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveStaffProfileMutation.mutate({ photoUrl, signatureUrl })}
              disabled={saveStaffProfileMutation.isPending}
              startIcon={saveStaffProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              Save changes
            </Button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><Shield className="h-4 w-4" />Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Smartphone className="h-4 w-4" />Two-factor authentication
                <Chip size="small" label="Coming soon" sx={badgeSx("outline")} />
              </p>
              <p className="text-xs text-muted-foreground">Require an authenticator code on every sign-in — not available yet.</p>
            </div>
            <Tooltip title="Two-factor authentication isn't implemented yet">
              <span>
                <Switch checked={false} disabled />
              </span>
            </Tooltip>
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
