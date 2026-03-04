import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { FleetOverview } from "@/pages/FleetOverview";
import { ServerDetail } from "@/pages/ServerDetail";

/* ── Shared mock data ────────────────────────────────────── */

const now = Date.now();

const mockServer = {
  id: "srv-1",
  name: "agent-workspace",
  display_name: "Agent Workspace",
  private_ipv4: "10.44.0.2",
  status: "active" as const,
  notes: "Primary dev box",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
  aliases: ["workspace", "aws-1"],
};

const mockBriefing = {
  server: mockServer,
  summary: {
    events_last_24h: 12,
    events_last_7d: 47,
    open_issue_count: 2,
    last_deployment: new Date(now - 2 * 86400_000).toISOString(),
  },
  recent_events: [
    {
      id: "ev-1",
      occurred_at: new Date(now - 3600_000).toISOString(),
      ingested_at: new Date(now - 3600_000).toISOString(),
      principal: "codex_b",
      reported_agent: null,
      server_id: "srv-1",
      server_name: "agent-workspace",
      category: "deployment" as const,
      summary: "Deployed v1.2",
      detail: null,
      tags: ["release"],
      issue_id: null,
      corrects_event_id: null,
      metadata: {},
      dedupe_key: null,
    },
  ],
  open_issues: [
    {
      id: "issue-1",
      title: "High CPU usage",
      status: "open" as const,
      severity: "high" as const,
      server_id: "srv-1",
      server_name: "agent-workspace",
      first_seen: "2026-03-01T00:00:00Z",
      last_occurrence: new Date(now - 7200_000).toISOString(),
      symptoms: null,
      root_cause: null,
      solution: null,
      created_by: "codex_b",
      version: 1,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
      resolved_at: null,
      tags: [],
      metadata: {},
      dedupe_key: null,
    },
    {
      id: "issue-2",
      title: "Disk space warning",
      status: "investigating" as const,
      severity: "medium" as const,
      server_id: "srv-1",
      server_name: "agent-workspace",
      first_seen: "2026-03-02T00:00:00Z",
      last_occurrence: new Date(now - 3600_000).toISOString(),
      symptoms: null,
      root_cause: null,
      solution: null,
      created_by: "mark",
      version: 1,
      created_at: "2026-03-02T00:00:00Z",
      updated_at: "2026-03-02T00:00:00Z",
      resolved_at: null,
      tags: [],
      metadata: {},
      dedupe_key: null,
    },
  ],
};

/* ── Hook mocks ──────────────────────────────────────────── */

const useServersMock = vi.fn();
vi.mock("@/hooks/useServers", () => ({
  useServers: (...args: unknown[]) => useServersMock(...args),
}));

const useBriefingMock = vi.fn();
vi.mock("@/hooks/useBriefing", () => ({
  useBriefing: (...args: unknown[]) => useBriefingMock(...args),
}));

const useEventsMock = vi.fn();
vi.mock("@/hooks/useEvents", () => ({
  useEvents: (...args: unknown[]) => useEventsMock(...args),
}));

const useIssuesMock = vi.fn();
vi.mock("@/hooks/useIssues", () => ({
  useIssues: (...args: unknown[]) => useIssuesMock(...args),
}));

// FleetOverview uses useQueries via the api client — provide valid shape
vi.mock("@/api/client", () => ({
  api: {
    servers: {
      briefing: vi.fn().mockResolvedValue({
        data: {
          server: { id: "srv-1", name: "agent-workspace", display_name: "Agent Workspace", private_ipv4: "10.44.0.2", status: "active", notes: null, created_at: "2026-03-01T00:00:00Z", updated_at: "2026-03-01T00:00:00Z", aliases: [] },
          summary: { events_last_24h: 0, events_last_7d: 0, open_issue_count: 0, last_deployment: null },
          recent_events: [],
          open_issues: [],
        },
      }),
    },
  },
}));

beforeEach(() => {
  useServersMock.mockReturnValue({
    data: [mockServer],
    isLoading: false,
    isError: false,
  });
  useBriefingMock.mockReturnValue({
    data: mockBriefing,
    isLoading: false,
    isError: false,
  });
  useEventsMock.mockReturnValue({
    events: mockBriefing.recent_events,
    warnings: [],
    hasMore: false,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    loadMore: vi.fn(),
    dataUpdatedAt: Date.now(),
    pageCount: 1,
  });
  useIssuesMock.mockReturnValue({
    data: { data: mockBriefing.open_issues, has_more: false },
    isLoading: false,
    isError: false,
  });
});

/* ── Helpers ─────────────────────────────────────────────── */

function renderWithRouter(ui: React.ReactElement, initialRoute = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ── Fleet Overview tests ────────────────────────────────── */

describe("FleetOverview", () => {
  it("renders heading", () => {
    renderWithRouter(<FleetOverview />);
    expect(screen.getByRole("heading", { level: 2, name: "Fleet Overview" })).toBeInTheDocument();
  });

  it("shows loading skeletons when servers are loading", () => {
    useServersMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithRouter(<FleetOverview />);
    expect(screen.getByTestId("skeleton-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("server-card-skeleton")).toHaveLength(3);
  });

  it("shows empty state when no servers", () => {
    useServersMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderWithRouter(<FleetOverview />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No servers registered")).toBeInTheDocument();
  });

  it("shows error state when servers fail to load", () => {
    useServersMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithRouter(<FleetOverview />);
    expect(screen.getByText("Unable to load servers.")).toBeInTheDocument();
  });
});

/* ── Server Detail tests ─────────────────────────────────── */

describe("ServerDetail", () => {
  function renderDetail(name = "agent-workspace") {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/servers/${name}`]}>
          <Routes>
            <Route path="/servers/:name" element={<ServerDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("renders server name in header", () => {
    renderDetail();
    expect(screen.getByRole("heading", { level: 2, name: "agent-workspace" })).toBeInTheDocument();
    expect(screen.getByText("Agent Workspace")).toBeInTheDocument();
  });

  it("shows status dot", () => {
    renderDetail();
    const dot = screen.getByTestId("status-dot");
    expect(dot.className).toContain("bg-emerald-500");
  });

  it("displays aliases with 'formerly known as' label", () => {
    renderDetail();
    expect(screen.getByText(/formerly known as/)).toBeInTheDocument();
    expect(screen.getByText("workspace, aws-1")).toBeInTheDocument();
  });

  it("shows private IPv4 and notes", () => {
    renderDetail();
    expect(screen.getByText("10.44.0.2")).toBeInTheDocument();
    expect(screen.getByText("Primary dev box")).toBeInTheDocument();
  });

  it("renders summary stat cards", () => {
    renderDetail();
    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards.length).toBe(4);

    // Events 24h
    expect(within(statCards[0]).getByText("12")).toBeInTheDocument();
    // Events 7d
    expect(within(statCards[1]).getByText("47")).toBeInTheDocument();
    // Open issues
    expect(within(statCards[2]).getByText("2")).toBeInTheDocument();
  });

  it("displays severity breakdown in open issues stat card", () => {
    renderDetail();
    const statCards = screen.getAllByTestId("stat-card");
    // The "Open issues" stat card (3rd) should contain the severity breakdown
    const issuesCard = statCards[2];
    expect(within(issuesCard).getByText("high")).toBeInTheDocument();
    expect(within(issuesCard).getByText("medium")).toBeInTheDocument();
  });

  it("renders Recent Events panel with event rows", () => {
    renderDetail();
    expect(screen.getByText("Recent Events")).toBeInTheDocument();
    expect(screen.getByText("Deployed v1.2")).toBeInTheDocument();
  });

  it("renders Open Issues panel with issue badges", () => {
    renderDetail();
    expect(screen.getByText("Open Issues")).toBeInTheDocument();
    expect(screen.getByText("High CPU usage")).toBeInTheDocument();
    expect(screen.getByText("Disk space warning")).toBeInTheDocument();
  });

  it("shows loading skeleton when briefing is loading", () => {
    useBriefingMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderDetail();
    expect(screen.getByTestId("detail-loading")).toBeInTheDocument();
  });

  it("shows error state when briefing fails", () => {
    useBriefingMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderDetail();
    expect(screen.getByText(/Unable to load briefing/)).toBeInTheDocument();
  });

  it("has a back link to Fleet Overview on error", () => {
    useBriefingMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderDetail();
    const backLink = screen.getByText("← Back to Fleet Overview");
    expect(backLink.getAttribute("href")).toBe("/");
  });
});
