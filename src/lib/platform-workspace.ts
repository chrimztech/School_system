import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, type BackendPlatformWorkspace } from "@/lib/api";

export const PLATFORM_WORKSPACE_QUERY_KEY = ["platform-workspace"] as const;

const EMPTY_PLATFORM_WORKSPACE: BackendPlatformWorkspace = {
  plans: [],
  addOns: [],
  promotions: [],
  supportTickets: [],
  supportSettings: {},
  approvalItems: [],
  approvalPolicies: {},
  statusIncidents: [],
  maintenanceWindows: [],
  statusSettings: {},
  tenantHandoffs: [],
  tenantSuccessOverrides: {},
  tenantLifecycleOverrides: {},
  partners: [],
  partnerDeals: [],
  contracts: [],
  revenueCases: [],
  dataRequests: [],
  exportJobs: [],
  retentionRules: [],
  residencySettings: {},
  rollouts: [],
  platformSecurity: {},
  platformCommunications: {},
  platformDefaults: {},
  developerApiKeys: [],
  developerWebhooks: [],
  developerSandboxes: [],
  platformAuditEvents: [],
  services: [],
  queues: [],
  opsIncidents: [],
  releases: [],
};

export function usePlatformWorkspace() {
  return useQuery({
    queryKey: PLATFORM_WORKSPACE_QUERY_KEY,
    queryFn: () => api.platform.getWorkspace(),
    placeholderData: EMPTY_PLATFORM_WORKSPACE,
    retry: false,
  });
}

export function useSavePlatformWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<BackendPlatformWorkspace>) => api.platform.updateWorkspace(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(PLATFORM_WORKSPACE_QUERY_KEY, data);
    },
    onError: (error: any) => {
      // Every platform page below (sys-admin, plan-catalog, tenant-success, etc.) calls
      // .mutate() and immediately shows its own success toast without waiting for the
      // result — this was the only error feedback in the entire save path. Without it, a
      // failed save (network error, validation, expired auth) looked identical to a
      // successful one: green toast, no indication anything was actually lost.
      toast.error(
        error?.response?.data?.message ?? "Failed to save — your change was not persisted. Please try again.",
      );
    },
  });
}
