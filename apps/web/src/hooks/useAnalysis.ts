import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

/** Poll analysis status every 2 s while queued or running */
export function useAnalysisStatus(id: string | undefined) {
  return useQuery({
    queryKey: ["analysis", id, "status"],
    queryFn: () => api.getAnalysisStatus(id!),
    enabled: !!id,
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
    }) => api.startAnalysis(seedAddress, seedLabel, depth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
  });
}

/** Fetch the full list of past analyses */
export function useAnalysisHistory() {
  return useQuery({
    queryKey: ["analyses"],
    queryFn: () => api.getAnalysisHistory(),
  });
}
