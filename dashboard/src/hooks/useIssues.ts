import { useQuery } from "@tanstack/react-query";

import { api, type QueryParams } from "@/api/client";

interface UseIssuesOptions {
  refetchInterval?: number;
}

export function useIssues(params?: QueryParams, options?: UseIssuesOptions) {
  return useQuery({
    queryKey: ["issues", params],
    queryFn: () => api.issues.list(params),
    refetchInterval: options?.refetchInterval,
  });
}

export function useIssue(id?: string) {
  return useQuery({
    queryKey: ["issue", id],
    queryFn: async () => {
      const response = await api.issues.get(id ?? "");
      return response.data;
    },
    enabled: Boolean(id),
  });
}
