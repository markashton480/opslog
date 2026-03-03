import { useQuery } from "@tanstack/react-query";

import { api, type QueryParams } from "@/api/client";

export function useEvents(params?: QueryParams) {
  return useQuery({
    queryKey: ["events", params],
    queryFn: () => api.events.list(params),
  });
}

export function useEvent(id?: string) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const response = await api.events.get(id ?? "");
      return response.data;
    },
    enabled: Boolean(id),
  });
}
