import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";

import { EventStream } from "@/pages/EventStream";
import { FleetOverview } from "@/pages/FleetOverview";
import { IssuesBoard } from "@/pages/IssuesBoard";

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
    pageCount: 0,
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

// Mock the Sidebar component partially or just use Links
function TestNav() {
  return (
    <nav>
      <Link to="/">Overview</Link>
      <Link to="/events">Events</Link>
      <Link to="/issues">Issues</Link>
    </nav>
  );
}

function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <TestNav />
        <Routes>
          <Route path="/" element={<FleetOverview />} />
          <Route path="/events" element={<EventStream />} />
          <Route path="/issues" element={<IssuesBoard />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("App routing", () => {
  it("navigates between main dashboard routes", async () => {
    renderApp(["/"]);

    expect(await screen.findByText(/Fleet Overview/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Events/i }));
    expect(await screen.findByText(/Event Stream/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Issues/i }));
    expect(await screen.findByText(/Issues Board/i)).toBeInTheDocument();
  });
});
