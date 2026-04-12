import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

/** Fetch the ReactFlow graph data for a completed analysis */
export function useGraph(analysisId: string | undefined) {
  return useQuery({
    queryKey: ["graph", analysisId],
    queryFn: () => api.getGraph(analysisId!),
    enabled: !!analysisId,
  });
}

/** Generate (or re-generate) a compliance report for an analysis */
export function useComplianceReport(analysisId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!analysisId) throw new Error("No analysisId provided");
      return api.generateComplianceReport(analysisId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["compliance", analysisId],
      });
    },
  });
}
