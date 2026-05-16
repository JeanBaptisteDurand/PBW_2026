import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/index.js";

/** Poll analysis status every 2 s while queued or running */
export function useAnalysisStatus(id: string | undefined) {
  return useQuery({
    queryKey: ["analysis", id, "status"],
    queryFn: () => api.path.getAnalysis(id ?? ""),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
  });
}

/** Mutation to kick off a new analysis */
export function useStartAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      seedAddress,
      seedLabel,
      depth,
    }: {
      seedAddress: string;
      seedLabel?: string;
      depth?: number;
    }) => api.path.startAnalysis(seedAddress, seedLabel, depth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}

/** Fetch the full list of past analyses for the current user (paginated 1..100) */
export function useAnalysisHistory(limit = 20) {
  return useQuery({
    queryKey: ["analyses", limit],
    queryFn: () => api.path.listAnalyses(limit),
  });
}
