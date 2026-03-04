import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await api.categories();
      return response.data.categories;
    },
    staleTime: 5 * 60_000,
  });
}
