import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plug, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";

type Integration = {
  id: string;
  code: string;
  name: string;
  category: "Payments" | "Messaging" | "Government" | "Identity" | "Analytics" | "Productivity";
  description: string;
  connected: boolean;
  status?: "healthy" | "degraded";
  owner?: string;
  webhook?: string;
};

type MarketplaceItem = {
  code: string;
  name: string;
  category: Integration["category"];
  description: string;
};

const marketplace: MarketplaceItem[] = [
  { code: "momo", name: "MTN Mobile Money", category: "Payments", description: "Collect tuition via MoMo Collect API." },
  { code: "airtel", name: "Airtel Money", category: "Payments", description: "Collect fees through Airtel Money Merchant." },
  { code: "ecz", name: "ECZ Sync", category: "Government", description: "Candidate registration and results download." },
  { code: "sms", name: "Africa's Talking SMS", category: "Messaging", description: "Bulk SMS to parents and guardians." },
  { code: "powerbi", name: "Power BI", category: "Analytics", description: "Publish curated dashboards for district and board reporting." },
  { code: "google", name: "Google Workspace", category: "Identity", description: "Single sign-on for staff accounts." },
  { code: "zoom", name: "Zoom Education", category: "Productivity", description: "Sync virtual classes, webinars, and staff meetings." },
];

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations - SRMS" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { user } = useAuth();
  const { active } = useTenant();
  const schoolId = active.id;

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">Integration settings are managed by System Administrators.</p>
        <Button asChild variant="outline"><Link to="/">Go to dashboard</Link></Button>
      </div>
    );
  }
  const qc = useQueryClient();
  const [tab, setTab] = useState("installed");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [config, setConfig] = useState({ owner: "", webhook: "" });

  const { data: itemsRaw = [], isLoading } = useQuery({
    queryKey: ["integrations", schoolId],
    queryFn: () => api.integrations.list(schoolId),
  });
  const createIntegrationMutation = useMutation({
    mutationFn: (data: any) => api.integrations.create(schoolId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", schoolId] });
    },
  });
  const updateIntegrationMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: any }) => api.integrations.update(schoolId, code, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", schoolId] });
    },
  });

  const items: Integration[] = (itemsRaw as any[]).map((item) => ({
    id: item.id,
    code: item.code ?? item.id,
    name: item.name ?? "Unnamed integration",
    category: (item.category ?? "Productivity") as Integration["category"],
    description: item.description ?? "",
    connected: item.connected === true,
    status: (item.status ?? undefined) as Integration["status"],
    owner: item.owner ?? "",
    webhook: item.webhook ?? "",
  }));

  const selected = items.find((item) => item.code === selectedCode) ?? null;
  const connected = items.filter((item) => item.connected);
  const categories = Array.from(new Set(items.map((item) => item.category)));

  const toggle = (item: Integration) => {
    updateIntegrationMutation.mutate(
      {
        code: item.code,
        data: {
          connected: !item.connected,
          status: !item.connected ? item.status ?? "healthy" : "degraded",
        },
      },
      {
        onSuccess: () => {
          toast.success(`${item.name} ${item.connected ? "disconnected" : "connected"}`);
        },
        onError: () => toast.error(`Failed to update ${item.name}`),
      },
    );
  };

  const openConfigure = (item: Integration) => {
    setSelectedCode(item.code);
    setConfig({
      owner: item.owner || "",
      webhook: item.webhook || `/integrations/${item.code}/events`,
    });
  };

  const saveConfig = () => {
    if (!selected) return;
    updateIntegrationMutation.mutate(
      {
        code: selected.code,
        data: {
          owner: config.owner.trim() || null,
          webhook: config.webhook.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${selected.name} settings saved`);
          setSelectedCode(null);
        },
        onError: () => toast.error("Failed to save settings"),
      },
    );
  };

  const installMarketplaceItem = (candidate: MarketplaceItem) => {
    const existing = items.find((item) => item.code === candidate.code);
    if (existing) {
      updateIntegrationMutation.mutate(
        {
          code: candidate.code,
          data: { connected: true, status: existing.status ?? "healthy" },
        },
        {
          onSuccess: () => {
            setTab("installed");
            toast.success(`${candidate.name} connected`);
          },
          onError: () => toast.error(`Failed to connect ${candidate.name}`),
        },
      );
      return;
    }

    createIntegrationMutation.mutate(
      {
        code: candidate.code,
        name: candidate.name,
        category: candidate.category,
        description: candidate.description,
        connected: true,
        status: "healthy",
      },
      {
        onSuccess: () => {
          setTab("installed");
          toast.success(`${candidate.name} added to your integration stack`);
        },
        onError: () => toast.error(`Failed to add ${candidate.name}`),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect payment, messaging, identity, and government services to extend the platform."
        actions={<Button onClick={() => setTab("marketplace")}><Plug className="mr-1 h-4 w-4" />Browse marketplace</Button>}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="installed">Installed</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="health">Connection health</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-6">
          {isLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">Loading integrations...</div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">No integration connections found in the database.</div>
          ) : categories.map((category) => (
            <section key={category} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.filter((item) => item.category === category).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{item.name}</h3>
                          {item.connected && item.status === "healthy" && (
                            <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-success" />Live</Badge>
                          )}
                          {item.connected && item.status === "degraded" && (
                            <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3 text-warning" />Degraded</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch checked={item.connected} onCheckedChange={() => toggle(item)} />
                    </div>
                    {item.connected && (
                      <div className="mt-4 flex gap-2 border-t border-border pt-3">
                        <Button variant="outline" size="sm" onClick={() => openConfigure(item)}>Configure</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="marketplace" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {marketplace.map((candidate) => {
            const installed = items.some((item) => item.code === candidate.code && item.connected);
            return (
              <div key={candidate.code} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{candidate.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{candidate.description}</p>
                  </div>
                  <Badge variant="outline">{candidate.category}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{installed ? "Already connected" : "Ready to add"}</span>
                  <Button
                    size="sm"
                    variant={installed ? "outline" : "default"}
                    disabled={installed || createIntegrationMutation.isPending}
                    onClick={() => installMarketplaceItem(candidate)}
                  >
                    {installed ? "Connected" : "Add integration"}
                  </Button>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="health" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {connected.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground lg:col-span-2">No connected integrations found in the database.</div>
          ) : connected.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Badge variant={item.status === "degraded" ? "warning" : "secondary"}>{item.status === "degraded" ? "Attention" : "Healthy"}</Badge>
              </div>
              <div className="mt-4 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Owner: {item.owner || "Not configured"}<br />
                Webhook: {item.webhook || "Not configured"}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={selectedCode !== null} onOpenChange={(open) => !open && setSelectedCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Configure {selected?.name ?? "integration"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Integration owner</Label>
              <Input className="mt-1" value={config.owner} onChange={(event) => setConfig({ ...config, owner: event.target.value })} />
            </div>
            <div>
              <Label>Webhook endpoint</Label>
              <Input className="mt-1" value={config.webhook} onChange={(event) => setConfig({ ...config, webhook: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCode(null)}>Cancel</Button>
            <Button onClick={saveConfig} disabled={!selected || updateIntegrationMutation.isPending}>Save settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
