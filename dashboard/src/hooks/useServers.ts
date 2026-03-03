import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

interface UseServersOptions {
  refetchInterval?: number;
}

export function useServers(options?: UseServersOptions) {
  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const response = await api.servers.list();
      return response.data;
    },
    refetchInterval: options?.refetchInterval,
  });
}
