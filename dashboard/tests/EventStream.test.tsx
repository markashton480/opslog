import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { EventStream } from "@/pages/EventStream";
import * as useEventsHook from "@/hooks/useEvents";
import type { Event } from "@/api/types";

/* ── Mock data ────────────────────────────────────────────── */

const now = Date.now();

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "ev-1",
    occurred_at: new Date(now - 1000).toISOString(),
    ingested_at: new Date(now - 1000).toISOString(),
    principal: "codex_b",
    reported_agent: null,
    server_id: "srv-1",
    server_name: "agent-workspace",
    category: "deployment",
    summary: "Deployed v1.2.3",
    detail: null,
    tags: ["release"],
    issue_id: null,
    corrects_event_id: null,
    metadata: {},
    dedupe_key: null,
    ...overrides,
  };
}

const mockEvents = [
  makeEvent({ id: "ev-1", summary: "Deployed v1.2.3", tags: ["release"] }),
  makeEvent({ id: "ev-2", principal: "mark", category: "config_change", summary: "Updated nginx config" }),
  makeEvent({ id: "ev-3", server_name: "lintel-prod-01", category: "backup", summary: "Backup completed" }),
];

/* ── Mocks ────────────────────────────────────────────────── */

const loadMoreSpy = vi.fn();

vi.mock("@/hooks/useEvents", () => ({
  useEvents: vi.fn(),
}));

vi.mock("@/hooks/useServers", () => ({
  useServers: () => ({
    data: [
      { id: "srv-1", name: "agent-workspace", display_name: "Agent Workspace" },
      { id: "srv-2", name: "lintel-prod-01", display_name: "Production" },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "deployment" },
      { id: "cat-2", name: "config_change" },
      { id: "cat-3", name: "backup" },
    ],
    isLoading: false,
    isError: false,
  }),
}));

function renderEventStream(initialEntries?: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <EventStream />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ── Tests ────────────────────────────────────────────────── */

describe("EventStream page", () => {
  beforeEach(() => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: mockEvents,
      warnings: [],
      hasMore: true,
      isLoading: false,
      isError: false,
      isFetching: false,
      isFetchingNextPage: false,
      loadMore: loadMoreSpy,
      pageCount: 1,
    } as any);
  });

  it("renders page header and subtitle", () => {
    renderEventStream();
    expect(screen.getByText("Event Stream")).toBeInTheDocument();
    expect(screen.getByText(/Filterable timeline/)).toBeInTheDocument();
  });

  it("renders event rows from hook", () => {
    renderEventStream();
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(3);
    expect(screen.getByText("Deployed v1.2.3")).toBeInTheDocument();
  });
});

describe("EventStream pagination", () => {
  beforeEach(() => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: mockEvents,
      warnings: [],
      hasMore: true,
      isLoading: false,
      isError: false,
      loadMore: loadMoreSpy,
      pageCount: 1,
    } as any);
  });

  it("calls loadMore when LOAD MORE is clicked", () => {
    renderEventStream();

    fireEvent.click(screen.getByRole("button", { name: /LOAD MORE/ }));
    expect(loadMoreSpy).toHaveBeenCalledTimes(1);
  });
});

describe("EventStream client-side search", () => {
  beforeEach(() => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: mockEvents,
      warnings: [],
      hasMore: true,
      isLoading: false,
      isError: false,
      loadMore: vi.fn(),
      pageCount: 1,
    } as any);
  });

  it("filters events locally based on search text", () => {
    renderEventStream();
    const searchInput = screen.getByPlaceholderText(/Search summary/i);

    fireEvent.change(searchInput, { target: { name: "search", value: "nginx" } });

    // Only "Updated nginx config" should remain
    expect(screen.queryByText("Deployed v1.2.3")).not.toBeInTheDocument();
    expect(screen.getByText("Updated nginx config")).toBeInTheDocument();
  });
});

describe("EventStream URL sync", () => {
  beforeEach(() => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: mockEvents,
      warnings: [],
      hasMore: true,
      isLoading: false,
      isError: false,
      loadMore: vi.fn(),
      pageCount: 1,
    } as any);
  });

  it("syncs filter values from search params", () => {
    renderEventStream(["/events?server=lintel-prod-01&tag=urgent"]);

    expect(screen.getByDisplayValue("PRODUCTION")).toBeInTheDocument();
    expect(screen.getByDisplayValue("urgent")).toBeInTheDocument();
    expect(screen.getByText(/2 active filters/i)).toBeInTheDocument();
  });
});

describe("EventStream empty state", () => {
  it("shows empty state when no events returned", () => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: [],
      warnings: [],
      hasMore: false,
      isLoading: false,
      isError: false,
      loadMore: vi.fn(),
      pageCount: 0,
    } as any);

    renderEventStream();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});

describe("EventStream error state", () => {
  it("shows error card when hook returns error", () => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: [],
      warnings: [],
      hasMore: false,
      isLoading: false,
      isError: true,
      loadMore: vi.fn(),
      pageCount: 0,
    } as any);

    renderEventStream();
    expect(screen.getByText(/Unable to load events/i)).toBeInTheDocument();
  });
});

describe("EventRow expand/collapse", () => {
  beforeEach(() => {
    vi.mocked(useEventsHook.useEvents).mockReturnValue({
      events: [
        makeEvent({
          id: "ev-detailed",
          summary: "Event with detail",
          detail: "Markdown content",
          metadata: { key: "value" },
          corrects_event_id: "ev-prev",
          tags: ["release", "hotfix"],
          issue_id: "iss-1",
        }),
      ],
      warnings: [],
      hasMore: false,
      isLoading: false,
      isError: false,
      loadMore: vi.fn(),
      pageCount: 1,
    } as any);
  });

  it("expands event detail on click", () => {
    renderEventStream();
    const row = screen.getByTestId("event-row");
    const clickable = within(row).getByRole("button");

    fireEvent.click(clickable);

    const detail = screen.getByTestId("event-detail");
    expect(detail).toBeInTheDocument();
    expect(within(detail).getByText("Markdown content")).toBeInTheDocument();
  });

  it("shows correction indicator for correction events", () => {
    renderEventStream();
    expect(screen.getByText(/CORRECTION/)).toBeInTheDocument();
  });

  it("shows tags on event row", () => {
    renderEventStream();
    expect(screen.getByText("#release")).toBeInTheDocument();
    expect(screen.getByText("#hotfix")).toBeInTheDocument();
  });
});
