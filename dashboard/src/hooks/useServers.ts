import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export function useServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const response = await api.servers.list();
      return response.data;
    },
  });
}
