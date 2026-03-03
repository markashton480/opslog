import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "@/App";

vi.mock("@/hooks/useServers", () => ({
  useServers: () => ({
    data: [
      {
        id: "srv-1",
        name: "agent-workspace",
        display_name: "Agent Workspace",
        private_ipv4: "10.44.0.2",
        status: "active",
        notes: null,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
        aliases: ["workspace"],
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useEvents", () => ({
  useEvents: () => ({
    events: [],
    warnings: [],
    hasMore: false,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    loadMore: vi.fn(),
  }),
  useEvent: () => ({ data: null, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useIssues", () => ({
  useIssues: () => ({ data: { data: [], has_more: false }, isLoading: false, isError: false }),
  useIssue: () => ({
    data: {
      issue: {
        id: "i-1",
        title: "Issue title",
        status: "open",
        severity: "medium",
      },
      updates: [],
      related_issues: [],
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useBriefing", () => ({
  useBriefing: () => ({
    data: {
      server: { name: "agent-workspace", display_name: "Agent Workspace", aliases: [] },
      summary: { events_last_24h: 0, open_issue_count: 0 },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({ data: [], isLoading: false, isError: false }),
}));

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe("App routing", () => {
  it("navigates between main dashboard routes", async () => {
    renderApp();

    expect(screen.getByRole("heading", { level: 2, name: "Fleet Overview" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Event Stream" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Event Stream" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Issues Board" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Issues Board" })).toBeInTheDocument();
  });
});
