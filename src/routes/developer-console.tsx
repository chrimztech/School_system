import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, KeyRound, Plug, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
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

import { PageHeader, StatCard } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent, appendSupportTicket, formatPlatformTimestamp } from "@/lib/platform-workspace-actions";
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
};

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
  const { user } = useAuth();
  const { data: workspace } = usePlatformWorkspace();
  const saveWorkspace = useSavePlatformWorkspace();
  const keys = (workspace?.developerApiKeys ?? []) as ApiKeyRecord[];
  const webhooks = (workspace?.developerWebhooks ?? []) as WebhookRecord[];
  const sandboxes = (workspace?.developerSandboxes ?? []) as SandboxRecord[];

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

  const stats = useMemo(() => ({
    activeKeys: keys.filter((item) => item.status === "Active").length,
    retryingWebhooks: webhooks.filter((item) => item.status === "Retrying").length,
    readySandboxes: sandboxes.filter((item) => item.status === "Ready").length,
    totalFailures: webhooks.reduce((sum, item) => sum + item.failures, 0),
  }), [keys, sandboxes, webhooks]);

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
    });
    toast.success("API key state updated");
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
    });
    toast.success("Webhook state updated");
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
    });
    toast.success("Sandbox provisioning started");
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
    });
    toast.success(`Credentials refreshed for ${sandboxes.find((item) => item.id === sandboxId)?.name ?? "sandbox"}`);
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
                      <p className="text-xs text-muted-foreground">{item.id}</p>
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
        </Box>
      )}

      {tab === "webhooks" && (
        <Box className="rounded-xl border border-border bg-card">
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
    </div>
  );
}
