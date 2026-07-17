import { QueryClient, QueryCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if ((error as Error)?.message?.startsWith("demo-mode:")) return;
        console.error("[query]", error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        throwOnError: false,
        // Without this, staleTime defaults to 0 — every remount (e.g. navigating back to a
        // page you already visited) and every window refocus refetches from the network even
        // though most school data (teachers, classes, departments, etc.) doesn't change from
        // one moment to the next. 60s keeps navigation snappy without noticeably hurting
        // freshness; any mutation already invalidates its own query keys explicitly.
        staleTime: 60_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 60_000,
  });

  return router;
};
