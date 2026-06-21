import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, KeyRound, Plug, ShieldAlert, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { appendPlatformAuditEvent, appendSupportTicket, formatPlatformTimestamp } from "@/lib/platform-workspace-actions";
import { usePlatformWorkspace, useSavePlatformWorkspace } from "@/lib/platform-workspace";

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
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
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
            <Button variant="outline" asChild>
              <Link to="/integrations">Open integrations</Link>
            </Button>
            <Button onClick={provisionSandbox}>
              <Wrench className="mr-2 h-4 w-4" />
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

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sandboxes">Sandboxes</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Badge className={item.status === "Active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : item.status === "Rotating" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => rotateKey(item.id)}>
                      {item.status === "Paused" ? "Resume" : item.status === "Active" ? "Rotate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="webhooks" className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Failures</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
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
                    <Badge className={item.status === "Healthy" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : item.status === "Retrying" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => updateWebhook(item.id)}>
                      {item.status === "Paused" ? "Resume" : item.status === "Retrying" ? "Mark healthy" : "Pause"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="sandboxes" className="grid gap-4 lg:grid-cols-3">
          {sandboxes.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.owner}</p>
                </div>
                <Badge className={item.status === "Ready" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : item.status === "Provisioning" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-slate-500/15 text-slate-700 dark:text-slate-300"}>
                  {item.status}
                </Badge>
              </div>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                <p>Expires on {item.expiresOn}</p>
                {item.lastCredentialRefresh && <p>Credentials refreshed {item.lastCredentialRefresh}</p>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => refreshCredentials(item.id)}>Refresh creds</Button>
                <Button size="sm" asChild>
                  <Link to="/tenant-workbench">Open workbench</Link>
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
