import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

interface UseBriefingOptions {
  refetchInterval?: number;
}

export function useBriefing(name?: string, options?: UseBriefingOptions) {
  return useQuery({
    queryKey: ["briefing", name],
    queryFn: async () => {
      const response = await api.servers.briefing(name ?? "");
      return response.data;
    },
    enabled: Boolean(name),
    refetchInterval: options?.refetchInterval,
  });
}
