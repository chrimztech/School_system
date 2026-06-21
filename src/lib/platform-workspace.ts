import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  });
}
