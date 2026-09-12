import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plug, CheckCircle2, AlertCircle, ShieldAlert, Zap, Loader2, Video, BarChart3, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/page-header";
import { Button, Chip } from "@mui/material";
import { badgeSx } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/lib/tenant";
import { PROVIDER_SCHEMAS } from "@/lib/integration-providers";
import { IntegrationConfigDialog } from "@/components/integration-config-dialog";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations - SRMS" }] }),
  component: IntegrationsPage,
});

function statusChip(status: string | undefined) {
  if (status === "HEALTHY") return <Chip size="small" icon={<CheckCircle2 size={12} />} label="Healthy" sx={badgeSx("success")} />;
  if (status === "DEGRADED") return <Chip size="small" icon={<AlertCircle size={12} />} label="Degraded" sx={badgeSx("destructive")} />;
  return <Chip size="small" label="Not configured" sx={badgeSx("outline")} />;
}

function IntegrationsPage() {
  const { user } = useAuth();
  const { active } = useTenant();
  const schoolId = active.id;
  const qc = useQueryClient();

  const [openCode, setOpenCode] = useState<string | null>(null);
  const [actingCode, setActingCode] = useState<string | null>(null);
  const [testingCode, setTestingCode] = useState<string | null>(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["integration-configs", schoolId],
    queryFn: () => api.integrationConfigs.listForSchool(schoolId),
    enabled: user?.role === "super_admin" && !!schoolId,
  });

  const configFor = (code: string) => (configs as any[]).find((c) => c.providerCode === code) ?? null;

  const saveMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: any }) => api.integrationConfigs.saveForSchool(schoolId, code, data),
    onSuccess: (_res, { code }) => {
      toast.success(`${PROVIDER_SCHEMAS.find((p) => p.code === code)?.name ?? code} settings saved`);
      void qc.invalidateQueries({ queryKey: ["integration-configs", schoolId] });
      setOpenCode(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed to save settings"),
  });

  const testMutation = useMutation({
    mutationFn: (code: string) => api.integrationConfigs.test(schoolId, code),
    onMutate: (code) => setTestingCode(code),
    onSuccess: (_data, code) => {
      toast.success(`${PROVIDER_SCHEMAS.find((p) => p.code === code)?.name ?? code}: connection is healthy`);
      void qc.invalidateQueries({ queryKey: ["integration-configs", schoolId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Test failed");
      void qc.invalidateQueries({ queryKey: ["integration-configs", schoolId] });
    },
    onSettled: () => setTestingCode(null),
  });

  const zoomMeetingMutation = useMutation({
    mutationFn: () => api.integrationConfigs.createZoomMeeting(schoolId, "SRMS meeting"),
    onMutate: () => setActingCode("zoom"),
    onSuccess: (res) => {
      toast.success("Zoom meeting created");
      window.open(res.joinUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not create the Zoom meeting"),
    onSettled: () => setActingCode(null),
  });
  const powerBiPublishMutation = useMutation({
    mutationFn: () => api.integrationConfigs.publishToPowerBi(schoolId),
    onMutate: () => setActingCode("powerbi"),
    onSuccess: () => toast.success("Snapshot published to Power BI"),
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Could not publish to Power BI"),
    onSettled: () => setActingCode(null),
  });
  const eczSyncMutation = useMutation({
    mutationFn: () => api.integrationConfigs.syncEcz(schoolId),
    onMutate: () => setActingCode("ecz"),
    onSuccess: () => toast.success("ECZ sync request sent"),
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "ECZ sync failed"),
    onSettled: () => setActingCode(null),
  });

  if (user?.role !== "super_admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Access denied</p>
        <p className="text-sm text-muted-foreground">Integration settings are managed by System Administrators.</p>
        <Button component={Link} to="/" variant="outlined">Go to dashboard</Button>
      </div>
    );
  }

  const enabledCount = (configs as any[]).filter((c) => c.enabled).length;
  const healthyCount = (configs as any[]).filter((c) => c.connectionStatus === "HEALTHY").length;
  const degradedCount = (configs as any[]).filter((c) => c.connectionStatus === "DEGRADED").length;
  const categories = Array.from(new Set(PROVIDER_SCHEMAS.map((p) => p.category)));
  const openSchema = openCode ? PROVIDER_SCHEMAS.find((p) => p.code === openCode) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect payment, messaging, government, analytics, identity, and productivity services — configuration is visible only to System Administrators, and every credential is encrypted at rest."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Enabled" value={enabledCount} accent="primary" icon={<Plug className="h-4 w-4" />} />
        <StatCard label="Healthy" value={healthyCount} accent="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Needs attention" value={degradedCount} accent={degradedCount > 0 ? "warning" : "success"} icon={<AlertCircle className="h-4 w-4" />} />
        <StatCard label="Available providers" value={PROVIDER_SCHEMAS.length} accent="accent" icon={<Zap className="h-4 w-4" />} />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading integrations…</div>
      ) : categories.map((category) => (
        <section key={category} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PROVIDER_SCHEMAS.filter((p) => p.category === category).map((schema) => {
              const cfg = configFor(schema.code);
              return (
                <div key={schema.code} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{schema.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{schema.description}</p>
                    </div>
                  </div>
                  <div className="mt-3">{statusChip(cfg?.connectionStatus)}</div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button variant="outlined" size="small" onClick={() => setOpenCode(schema.code)}>Configure</Button>
                    {cfg?.enabled && schema.actions.includes("test") && (
                      <Button
                        variant="outlined" size="small"
                        startIcon={testingCode === schema.code ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        disabled={testMutation.isPending}
                        onClick={() => testMutation.mutate(schema.code)}
                      >
                        Test connection
                      </Button>
                    )}
                    {cfg?.enabled && schema.code === "zoom" && (
                      <Button variant="outlined" size="small" startIcon={actingCode === "zoom" ? <Loader2 size={12} className="animate-spin" /> : <Video size={12} />} disabled={zoomMeetingMutation.isPending} onClick={() => zoomMeetingMutation.mutate()}>
                        Create meeting
                      </Button>
                    )}
                    {cfg?.enabled && schema.code === "powerbi" && (
                      <Button variant="outlined" size="small" startIcon={actingCode === "powerbi" ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />} disabled={powerBiPublishMutation.isPending} onClick={() => powerBiPublishMutation.mutate()}>
                        Publish snapshot
                      </Button>
                    )}
                    {cfg?.enabled && schema.code === "ecz" && (
                      <Button variant="outlined" size="small" startIcon={actingCode === "ecz" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} disabled={eczSyncMutation.isPending} onClick={() => eczSyncMutation.mutate()}>
                        Sync now
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {openSchema && (
        <IntegrationConfigDialog
          open={!!openCode}
          onClose={() => setOpenCode(null)}
          schema={openSchema}
          current={configFor(openSchema.code)}
          saving={saveMutation.isPending}
          onSave={(payload) => saveMutation.mutate({ code: openSchema.code, data: payload })}
        />
      )}
    </div>
  );
}
