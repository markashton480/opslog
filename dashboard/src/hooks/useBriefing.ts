import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export function useBriefing(name?: string) {
  return useQuery({
    queryKey: ["briefing", name],
    queryFn: async () => {
      const response = await api.servers.briefing(name ?? "");
      return response.data;
    },
    enabled: Boolean(name),
  });
}
