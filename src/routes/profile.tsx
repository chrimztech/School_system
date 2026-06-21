import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, Smartphone, Key, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
            <Label>Full name</Label>
            <Input value={user.name} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Contact an administrator to change your name.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={user.email} disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Contact an administrator to change your email.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+260 977 000 000" maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Input value={ROLE_META[user.role].label} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label>Tenant scope</Label>
            <Input value={user.role === "super_admin" ? "Platform-wide access" : `${active.name} (${active.shortCode})`} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label>Active plan</Label>
            <Input value={user.role === "super_admin" ? `Managing ${activePlan.name} tenant` : activePlan.name} disabled className="bg-muted/50" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => updatePhoneMutation.mutate()} disabled={updatePhoneMutation.isPending}>
            {updatePhoneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <Button variant="outline" onClick={() => toast.info("Contact your administrator to reset your password")}>Change password</Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Notification preferences</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="font-medium">Email</p><p className="text-xs text-muted-foreground">Receive daily digest of activity.</p></div>
            <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div><p className="font-medium">SMS</p><p className="text-xs text-muted-foreground">Critical alerts only.</p></div>
            <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={() => toast.success("Preferences saved")}>Save</Button>
        </div>
      </section>
    </div>
  );
}
