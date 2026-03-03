import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { EventStream } from "@/pages/EventStream";
import type { Event } from "@/api/types";

const loadMoreSpy = vi.fn();

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    principal: "codex_b",
    reported_agent: null,
    server_id: "s1",
    server_name: "agent-workspace",
    category: "deployment",
    summary: "Deployed v1.2.3",
    detail: null,
    tags: [],
    issue_id: null,
    corrects_event_id: null,
    metadata: {},
    dedupe_key: null,
    ...overrides,
  };
}

const mockEvents: Event[] = [
  makeEvent({ summary: "Deployed v1.2.3", category: "deployment", tags: ["release"] }),
  makeEvent({ summary: "Updated nginx config", category: "config_change", principal: "mark" }),
  makeEvent({ summary: "Backup completed", category: "backup", server_name: "lintel-prod-01" }),
];

let mockEventsData = mockEvents;
let mockHasMore = true;
let mockIsLoading = false;
let mockIsError = false;

vi.mock("@/hooks/useServers", () => ({
  useServers: () => ({
    data: [
      { id: "s1", name: "agent-workspace", display_name: "Agent Workspace", aliases: [] },
      { id: "s2", name: "lintel-prod-01", display_name: "Production", aliases: [] },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    data: [
      { name: "deployment", description: "Deployments" },
      { name: "config_change", description: "Configuration changes" },
      { name: "backup", description: "Backups" },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useEvents", () => ({
  useEvents: () => ({
    events: mockEventsData,
    warnings: [],
    hasMore: mockHasMore,
    isLoading: mockIsLoading,
    isError: mockIsError,
    isFetching: false,
    isFetchingNextPage: false,
    loadMore: loadMoreSpy,
    dataUpdatedAt: Date.now(),
    pageCount: 1,
  }),
}));

function renderEventStream(initialEntries: string[] = ["/events"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <EventStream />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockEventsData = mockEvents;
  mockHasMore = true;
  mockIsLoading = false;
  mockIsError = false;
  loadMoreSpy.mockClear();
});

describe("EventStream page", () => {
  it("renders page heading and event rows", () => {
    renderEventStream();

    expect(screen.getByText("Event Stream")).toBeInTheDocument();
    expect(screen.getAllByTestId("event-row")).toHaveLength(3);
    expect(screen.getByText("Deployed v1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Updated nginx config")).toBeInTheDocument();
    expect(screen.getByText("Backup completed")).toBeInTheDocument();
  });

  it("renders filter bar with all filter controls", () => {
    renderEventStream();

    expect(screen.getByPlaceholderText("Search summary…")).toBeInTheDocument();
    expect(screen.getByLabelText("Server")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Principal")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Filter by tag…")).toBeInTheDocument();
  });

  it("renders time range presets", () => {
    renderEventStream();

    expect(screen.getByTestId("preset-1h")).toBeInTheDocument();
    expect(screen.getByTestId("preset-24h")).toBeInTheDocument();
    expect(screen.getByTestId("preset-7d")).toBeInTheDocument();
  });

  it("shows active filter count", () => {
    renderEventStream(["/events?server=agent-workspace&category=deployment"]);
    // The component syncs from URL
    expect(screen.getByText(/filter/)).toBeInTheDocument();
  });
});

describe("EventStream pagination", () => {
  it("calls loadMore when Load More is clicked", () => {
    renderEventStream();

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(loadMoreSpy).toHaveBeenCalledTimes(1);
  });

  it("shows event count footer", () => {
    renderEventStream();

    expect(screen.getByText(/Showing 3 events/)).toBeInTheDocument();
  });
});

describe("EventStream client-side search", () => {
  it("filters events by summary text", () => {
    renderEventStream();

    const searchInput = screen.getByPlaceholderText("Search summary…");
    fireEvent.change(searchInput, { target: { name: "search", value: "nginx" } });

    expect(screen.getAllByTestId("event-row")).toHaveLength(1);
    expect(screen.getByText("Updated nginx config")).toBeInTheDocument();
  });
});

describe("EventStream empty state", () => {
  it("shows empty state when no events match", () => {
    mockEventsData = [];
    renderEventStream();

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No events found")).toBeInTheDocument();
  });
});

describe("EventStream error state", () => {
  it("shows error message when API fails", () => {
    mockEventsData = [];
    mockIsError = true;
    renderEventStream();

    expect(screen.getByText(/Unable to load events/)).toBeInTheDocument();
  });
});

describe("EventRow expand/collapse", () => {
  it("expands event detail on click", () => {
    const eventsWithDetail = [
      makeEvent({
        summary: "Deployed with detail",
        detail: "# Deployment notes\n\nSome markdown content",
        metadata: { version: "1.2.3" },
      }),
    ];
    mockEventsData = eventsWithDetail;
    renderEventStream();

    const row = screen.getByTestId("event-row");
    fireEvent.click(within(row).getByRole("button"));

    expect(screen.getByTestId("event-detail")).toBeInTheDocument();
  });

  it("shows correction indicator for correction events", () => {
    mockEventsData = [
      makeEvent({
        summary: "Corrected event",
        corrects_event_id: "abc123-def456",
      }),
    ];
    renderEventStream();

    expect(screen.getByText("correction")).toBeInTheDocument();
  });

  it("shows tags on event row", () => {
    mockEventsData = [
      makeEvent({ summary: "Tagged event", tags: ["release", "hotfix"] }),
    ];
    renderEventStream();

    expect(screen.getByText("release")).toBeInTheDocument();
    expect(screen.getByText("hotfix")).toBeInTheDocument();
  });

  it("renders server name as a clickable link in compact row", () => {
    mockEventsData = [
      makeEvent({ summary: "Deploy event", server_name: "lintel-prod-01" }),
    ];
    renderEventStream();

    const serverLink = screen.getByTestId("server-link");
    expect(serverLink).toBeInTheDocument();
    expect(serverLink.tagName).toBe("A");
    expect(serverLink).toHaveAttribute("href", "/servers/lintel-prod-01");
  });

  it("renders issue link as a clickable link in compact row", () => {
    mockEventsData = [
      makeEvent({ summary: "Issue event", issue_id: "issue-uuid-123" }),
    ];
    renderEventStream();

    const issueLink = screen.getByTestId("issue-link");
    expect(issueLink).toBeInTheDocument();
    expect(issueLink.tagName).toBe("A");
    expect(issueLink).toHaveAttribute("href", "/issues/issue-uuid-123");
  });
});
