import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, Copy, KeyRound, Plug, Plus, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth";
import { appendDeveloperApiKey, appendDeveloperWebhook, appendPlatformAuditEvent, appendSupportTicket, formatPlatformTimestamp } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";
import { badgeSx } from "@/lib/utils";

type KeyStatus = "Active" | "Rotating" | "Paused";
type WebhookStatus = "Healthy" | "Retrying" | "Paused";
type SandboxStatus = "Ready" | "Provisioning" | "Expired";

type ApiKeyRecord = {
  id: string;
  client: string;
  scope: string;
  lastUsed: string;
  status: KeyStatus;
  /** Masked display hint only (e.g. "sk_live_****ab12"). The raw secret is never
   *  stored here -- see the create-key flow below for why. */
  secretHint?: string;
};

function generateApiSecret() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `sk_live_${hex}`;
}

function maskSecret(secret: string) {
  return `sk_live_${"•".repeat(8)}${secret.slice(-4)}`;
}

type WebhookRecord = {
  id: string;
  endpoint: string;
  owner: string;
  failures: number;
  status: WebhookStatus;
};

type SandboxRecord = {
  id: string;
  name: string;
  owner: string;
  status: SandboxStatus;
  expiresOn: string;
  lastCredentialRefresh?: string;
};

export const Route = createFileRoute("/developer-console")({
  head: () => ({ meta: [{ title: "Developer Console - SRMS" }] }),
  component: DeveloperConsolePage,
});

function DeveloperConsolePage() {
  const [tab, setTab] = useState("keys");
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({ client: "", scope: "" });
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [newWebhookOpen, setNewWebhookOpen] = useState(false);
  const [newWebhookForm, setNewWebhookForm] = useState({ endpoint: "", owner: "" });
  const { user } = useAuth();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const keys = (workspace?.developerApiKeys ?? []) as ApiKeyRecord[];
  const webhooks = (workspace?.developerWebhooks ?? []) as WebhookRecord[];
  const sandboxes = (workspace?.developerSandboxes ?? []) as SandboxRecord[];

  const stats = useMemo(() => ({
    activeKeys: keys.filter((item) => item.status === "Active").length,
    retryingWebhooks: webhooks.filter((item) => item.status === "Retrying").length,
    readySandboxes: sandboxes.filter((item) => item.status === "Ready").length,
    totalFailures: webhooks.reduce((sum, item) => sum + item.failures, 0),
  }), [keys, sandboxes, webhooks]);

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">This area is restricted to System Administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
      </div>
    );
  }

  const rotateKey = (id: string) => {
    const currentKey = keys.find((item) => item.id === id);
    if (!currentKey) return;
    let nextStatus: KeyStatus = currentKey.status;
    const nextKeys = keys.map((item) => (
      item.id === id
        ? {
          ...item,
          status: (() => {
            nextStatus = item.status === "Paused" ? "Active" : item.status === "Active" ? "Rotating" : "Active";
            return nextStatus;
          })(),
        }
        : item
    ));
    saveWorkspace.mutate({
      developerApiKeys: nextKeys,
      ...(nextStatus === "Rotating"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: currentKey.id,
            tenantName: currentKey.client,
            subject: `Confirm credential rotation for ${currentKey.client}`,
            category: "Security",
            priority: "Medium",
            owner: "Platform desk",
            article: "General knowledge base",
            slaHours: 12,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Access",
        severity: nextStatus === "Paused" ? "Warning" : "Info",
        action: `Changed API key ${currentKey.id} from ${currentKey.status} to ${nextStatus}`,
      }),
    }, { onSuccess: () => toast.success("API key state updated") });
  };

  const createApiKey = () => {
    if (!newKeyForm.client.trim() || !newKeyForm.scope.trim()) {
      toast.error("Enter a client name and a scope");
      return;
    }
    // The raw secret lives only in this closure and in the one-time reveal dialog below --
    // it is never included in the saveWorkspace.mutate() payload, so it never round-trips
    // through the shared platform-workspace blob in plaintext. Only the masked hint persists.
    const rawSecret = generateApiSecret();
    saveWorkspace.mutate({
      developerApiKeys: appendDeveloperApiKey(workspace, {
        client: newKeyForm.client.trim(),
        scope: newKeyForm.scope.trim(),
        secretHint: maskSecret(rawSecret),
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Access",
        action: `Issued new API key for ${newKeyForm.client.trim()}`,
      }),
    }, {
      onSuccess: () => {
        setNewKeyOpen(false);
        setNewKeyForm({ client: "", scope: "" });
        setRevealedSecret(rawSecret);
      },
    });
  };

  const createWebhook = () => {
    if (!newWebhookForm.endpoint.trim() || !newWebhookForm.owner.trim()) {
      toast.error("Enter an endpoint URL and an owner");
      return;
    }
    saveWorkspace.mutate({
      developerWebhooks: appendDeveloperWebhook(workspace, {
        endpoint: newWebhookForm.endpoint.trim(),
        owner: newWebhookForm.owner.trim(),
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Registered new webhook endpoint for ${newWebhookForm.owner.trim()}`,
      }),
    }, {
      onSuccess: () => {
        toast.success("Webhook registered");
        setNewWebhookOpen(false);
        setNewWebhookForm({ endpoint: "", owner: "" });
      },
    });
  };

  const updateWebhook = (id: string) => {
    const currentWebhook = webhooks.find((item) => item.id === id);
    if (!currentWebhook) return;
    let nextStatus: WebhookStatus = currentWebhook.status;
    const nextWebhooks = webhooks.map((item) => (
      item.id === id
        ? {
          ...item,
          status: (() => {
            nextStatus = item.status === "Paused" ? "Healthy" : item.status === "Healthy" ? "Paused" : "Healthy";
            return nextStatus;
          })(),
          failures: item.status === "Retrying" ? 0 : item.failures,
        }
        : item
    ));
    saveWorkspace.mutate({
      developerWebhooks: nextWebhooks,
      ...(nextStatus !== "Healthy"
        ? {
          supportTickets: appendSupportTicket(workspace, {
            tenantId: currentWebhook.id,
            tenantName: currentWebhook.owner,
            subject: `Investigate webhook health for ${currentWebhook.id}`,
            category: "Integrations",
            priority: currentWebhook.status === "Retrying" ? "High" : "Medium",
            owner: "Platform desk",
            article: "Platform incident playbook",
            slaHours: currentWebhook.status === "Retrying" ? 4 : 12,
          }),
        }
        : {}),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        severity: currentWebhook.status === "Retrying" ? "Warning" : "Info",
        action: `Changed webhook ${currentWebhook.id} from ${currentWebhook.status} to ${nextStatus}`,
      }),
    }, { onSuccess: () => toast.success("Webhook state updated") });
  };

  const provisionSandbox = () => {
    const nextSandboxes = [
      { id: `sbx-${Date.now().toString().slice(-3)}`, name: "Fresh partner lab", owner: "Platform admin", status: "Provisioning", expiresOn: "30 Jun 2026", lastCredentialRefresh: formatPlatformTimestamp() },
      ...sandboxes,
    ];
    saveWorkspace.mutate({
      developerSandboxes: nextSandboxes,
      supportTickets: appendSupportTicket(workspace, {
        tenantId: nextSandboxes[0]?.id ?? "sandbox",
        tenantName: nextSandboxes[0]?.name ?? "Fresh partner lab",
        subject: "Prepare sandbox credentials and initial dataset",
        category: "Enablement",
        priority: "Medium",
        owner: "Platform desk",
        article: "General knowledge base",
        slaHours: 24,
      }),
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: "Provisioned new partner sandbox workspace",
      }),
    }, { onSuccess: () => toast.success("Sandbox provisioning started") });
  };

  const refreshCredentials = (sandboxId: string) => {
    const nextSandboxes = sandboxes.map((item) => (
      item.id === sandboxId
        ? { ...item, status: "Ready" as SandboxStatus, expiresOn: "30 Jun 2026", lastCredentialRefresh: formatPlatformTimestamp() }
        : item
    ));
    saveWorkspace.mutate({
      developerSandboxes: nextSandboxes,
      platformAuditEvents: appendPlatformAuditEvent(workspace, {
        actor: user?.name ?? "System Administrator",
        tenant: "Platform",
        area: "Operations",
        action: `Refreshed sandbox credentials for ${sandboxes.find((item) => item.id === sandboxId)?.name ?? "sandbox"}`,
      }),
    }, {
      onSuccess: () => toast.success(`Credentials refreshed for ${sandboxes.find((item) => item.id === sandboxId)?.name ?? "sandbox"}`),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Developer Console"
        description="Manage API clients, webhook health, partner sandboxes, and operational access for platform integrations."
        actions={(
          <>
            <Button variant="outlined" component={Link} to="/integrations">Open integrations</Button>
            <Button onClick={provisionSandbox} startIcon={<Wrench className="h-4 w-4" />}>
              Provision sandbox
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active API keys" value={stats.activeKeys} accent="primary" icon={<KeyRound className="h-4 w-4" />} />
        <StatCard label="Retrying webhooks" value={stats.retryingWebhooks} accent="warning" icon={<Plug className="h-4 w-4" />} />
        <StatCard label="Ready sandboxes" value={stats.readySandboxes} accent="success" icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Webhook failures" value={stats.totalFailures} accent="destructive" icon={<Activity className="h-4 w-4" />} />
      </div>

      <Box>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="keys" label="API Keys" />
        <Tab value="webhooks" label="Webhooks" />
        <Tab value="sandboxes" label="Sandboxes" />
      </Tabs>

      {tab === "keys" && (
        <Box className="rounded-xl border border-border bg-card">
          <Box className="flex items-center justify-between gap-3 p-3">
            <p className="text-sm text-muted-foreground">Issued keys show a masked hint only -- the full secret is shown once at creation.</p>
            <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={() => setNewKeyOpen(true)}>
              New API key
            </Button>
          </Box>
          {keys.length === 0 && (
            <EmptyState
              icon={KeyRound}
              title="No API keys issued"
              description="Issue a key to let a partner or integration authenticate against the platform API."
              action={{ label: "New API key", onClick: () => setNewKeyOpen(true) }}
            />
          )}
          {keys.length > 0 && (
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Scope</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.client}</p>
                      <p className="text-xs text-muted-foreground">{item.secretHint ?? item.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.scope}</TableCell>
                  <TableCell>{item.lastUsed}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={badgeSx(item.status === "Active" ? "success" : item.status === "Rotating" ? "warning" : "secondary")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" onClick={() => rotateKey(item.id)}>
                      {item.status === "Paused" ? "Resume" : item.status === "Active" ? "Rotate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
          )}
        </Box>
      )}

      {tab === "webhooks" && (
        <Box className="rounded-xl border border-border bg-card">
          <Box className="flex justify-end p-3">
            <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={() => setNewWebhookOpen(true)}>
              New webhook
            </Button>
          </Box>
          {webhooks.length === 0 && (
            <EmptyState
              icon={Plug}
              title="No webhooks registered"
              description="Register an endpoint to receive platform event notifications."
              action={{ label: "New webhook", onClick: () => setNewWebhookOpen(true) }}
            />
          )}
          {webhooks.length > 0 && (
          <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Endpoint</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Failures</TableCell>
                <TableCell>Status</TableCell>
                <TableCell className="text-right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {webhooks.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.endpoint}</p>
                      <p className="text-xs text-muted-foreground">{item.id}</p>
                    </div>
                  </TableCell>
                  <TableCell>{item.owner}</TableCell>
                  <TableCell>{item.failures}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.status}
                      sx={badgeSx(item.status === "Healthy" ? "success" : item.status === "Retrying" ? "warning" : "secondary")}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="small" variant="outlined" onClick={() => updateWebhook(item.id)}>
                      {item.status === "Paused" ? "Resume" : item.status === "Retrying" ? "Mark healthy" : "Pause"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
          )}
        </Box>
      )}

      {tab === "sandboxes" && (
        <Box className="grid gap-4 lg:grid-cols-3">
          {sandboxes.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.owner}</p>
                </div>
                <Chip
                  size="small"
                  label={item.status}
                  sx={badgeSx(item.status === "Ready" ? "success" : item.status === "Provisioning" ? "warning" : "secondary")}
                />
              </div>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <p>Expires on {item.expiresOn}</p>
                {item.lastCredentialRefresh && <p>Credentials refreshed {item.lastCredentialRefresh}</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="small" variant="outlined" onClick={() => refreshCredentials(item.id)}>Refresh creds</Button>
                <Button size="small" component={Link} to="/tenant-workbench">Open workbench</Button>
              </div>
            </div>
          ))}
        </Box>
      )}
      </Box>

      <Dialog open={newKeyOpen} onClose={() => setNewKeyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Issue API key</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField
              label="Client / integration name"
              placeholder="e.g. Zamtel BulkSMS bridge"
              value={newKeyForm.client}
              onChange={(e) => setNewKeyForm({ ...newKeyForm, client: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Scope"
              placeholder="e.g. read:students, write:attendance"
              value={newKeyForm.scope}
              onChange={(e) => setNewKeyForm({ ...newKeyForm, scope: e.target.value })}
              fullWidth
              size="small"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setNewKeyOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createApiKey} disabled={saveWorkspace.isPending}>Issue key</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revealedSecret} onClose={() => setRevealedSecret(null)} maxWidth="xs" fullWidth>
        <DialogTitle>API key issued</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted-foreground">
            Copy this key now -- for security it is shown only this once. Afterwards the console only ever
            shows a masked hint, never the full secret.
          </p>
          <Box
            sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: "action.hover", fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}
          >
            {revealedSecret}
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Copy size={14} />}
            sx={{ mt: 1.5 }}
            onClick={() => {
              if (revealedSecret) {
                void navigator.clipboard?.writeText(revealedSecret);
                toast.success("Copied to clipboard");
              }
            }}
          >
            Copy key
          </Button>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setRevealedSecret(null)}>Done -- I've saved it</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={newWebhookOpen} onClose={() => setNewWebhookOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Register webhook</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 pt-1">
            <TextField
              label="Endpoint URL"
              placeholder="https://partner.example.com/webhooks/srms"
              value={newWebhookForm.endpoint}
              onChange={(e) => setNewWebhookForm({ ...newWebhookForm, endpoint: e.target.value })}
              fullWidth
              size="small"
            />
            <TextField
              label="Owner"
              placeholder="e.g. Partner integrations team"
              value={newWebhookForm.owner}
              onChange={(e) => setNewWebhookForm({ ...newWebhookForm, owner: e.target.value })}
              fullWidth
              size="small"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setNewWebhookOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createWebhook} disabled={saveWorkspace.isPending}>Register</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
