import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api, type QueryParams } from "@/api/client";
import type { Event } from "@/api/types";

interface UseEventsOptions {
  refetchInterval?: number;
}

interface UseEventsResult {
  events: Event[];
  warnings: string[];
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => Promise<unknown>;
  dataUpdatedAt: number;
}

export function useEvents(params?: QueryParams, options?: UseEventsOptions): UseEventsResult {
  const query = useInfiniteQuery({
    queryKey: ["events", params],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.events.list({
        ...params,
        cursor: pageParam ?? undefined,
      }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
    refetchInterval: options?.refetchInterval,
    refetchOnWindowFocus: true,
  });

  const pages = query.data?.pages ?? [];

  return {
    events: pages.flatMap((page) => page.data),
    warnings: pages.flatMap((page) => page.warnings),
    hasMore: query.hasNextPage ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore: () => query.fetchNextPage(),
    dataUpdatedAt: query.dataUpdatedAt,
  };
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
