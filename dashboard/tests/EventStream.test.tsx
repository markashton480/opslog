import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventStream } from "@/pages/EventStream";

const loadMoreSpy = vi.fn();

vi.mock("@/hooks/useServers", () => ({
  useServers: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useEvents", () => ({
  useEvents: () => ({
    events: [],
    warnings: [],
    hasMore: true,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    loadMore: loadMoreSpy,
  }),
}));

describe("EventStream pagination", () => {
  it("calls loadMore when Load More is clicked", () => {
    render(<EventStream />);

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(loadMoreSpy).toHaveBeenCalledTimes(1);
  });
});
