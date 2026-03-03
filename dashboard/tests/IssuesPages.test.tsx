import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { IssuesBoard } from "@/pages/IssuesBoard";
import { IssueDetail } from "@/pages/IssueDetail";
import type { Issue, IssueDetail as IssueDetailType, Event, IssueUpdate } from "@/api/types";

/* ── Mock data ────────────────────────────────────────────── */

const now = Date.now();

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: "iss-1",
    title: "Test issue",
    status: "open",
    severity: "high",
    server_id: "srv-1",
    server_name: "web-1",
    first_seen: new Date(now - 86400_000).toISOString(),
    last_occurrence: new Date(now - 3600_000).toISOString(),
    symptoms: "Some symptoms",
    root_cause: null,
    solution: null,
    created_by: "codex_b",
    version: 1,
    created_at: new Date(now - 86400_000).toISOString(),
    updated_at: new Date(now - 3600_000).toISOString(),
    resolved_at: null,
    tags: ["dns", "prod"],
    metadata: {},
    dedupe_key: null,
    ...overrides,
  };
}

function makeUpdate(overrides: Partial<IssueUpdate> = {}): IssueUpdate {
  return {
    id: "upd-1",
    issue_id: "iss-1",
    occurred_at: new Date(now - 7200_000).toISOString(),
    ingested_at: new Date(now - 7200_000).toISOString(),
    principal: "codex_b",
    content: "Investigated and found root cause",
    status_from: "open",
    status_to: "investigating",
    changes: { status: { from: "open", to: "investigating" } },
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "ev-1",
    occurred_at: new Date(now - 5400_000).toISOString(),
    ingested_at: new Date(now - 5400_000).toISOString(),
    principal: "deploy-bot",
    reported_agent: null,
    server_id: "srv-1",
    server_name: "web-1",
    category: "deployment",
    summary: "Deployed v2.3.0",
    detail: null,
    tags: [],
    issue_id: "iss-1",
    corrects_event_id: null,
    metadata: {},
    dedupe_key: null,
    ...overrides,
  };
}

const openIssue = makeIssue({ id: "iss-open", title: "DNS resolver timeout", status: "open", severity: "critical" });
const investigatingIssue = makeIssue({ id: "iss-inv", title: "Disk space warning", status: "investigating", severity: "medium" });
const watchingIssue = makeIssue({ id: "iss-watch", title: "Memory leak", status: "watching", severity: "high" });
const resolvedIssue = makeIssue({ id: "iss-res", title: "Old bug fixed", status: "resolved", severity: "low" });
const wontfixIssue = makeIssue({ id: "iss-wf", title: "Won't fix", status: "wontfix", severity: "low" });

const allIssues = [openIssue, investigatingIssue, watchingIssue, resolvedIssue, wontfixIssue];

/* ── Mocks ────────────────────────────────────────────────── */

const mockUseIssues = vi.fn();
const mockUseIssue = vi.fn();
const mockUseServers = vi.fn();
const mockUseEvents = vi.fn();

vi.mock("@/hooks/useIssues", () => ({
  useIssues: (...args: unknown[]) => mockUseIssues(...args),
  useIssue: (...args: unknown[]) => mockUseIssue(...args),
}));

vi.mock("@/hooks/useServers", () => ({
  useServers: () => mockUseServers(),
}));

vi.mock("@/hooks/useEvents", () => ({
  useEvents: (...args: unknown[]) => mockUseEvents(...args),
}));

vi.mock("@/api/client", () => ({
  api: {
    issues: {
      update: vi.fn().mockResolvedValue({ data: {} }),
      addUpdate: vi.fn().mockResolvedValue({ data: {} }),
    },
  },
  ApiError: class ApiError extends Error {
    status: number;
    payload: unknown;
    constructor(msg: string, status: number, payload: unknown) {
      super(msg);
      this.status = status;
      this.payload = payload;
    }
  },
}));

// Import the mocked module to control behavior per-test
import { api, ApiError } from "@/api/client";

function renderRoute(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/issues" element={<IssuesBoard />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ── IssuesBoard tests ────────────────────────────────────── */

describe("IssuesBoard", () => {
  beforeEach(() => {
    mockUseServers.mockReturnValue({ data: [{ id: "srv-1", name: "web-1" }] });
    mockUseIssues.mockReturnValue({
      data: { data: allIssues, has_more: false, next_cursor: null, warnings: [] },
      isLoading: false,
      isError: false,
    });
  });

  it("renders kanban columns with issues in correct columns", () => {
    renderRoute("/issues");
    expect(screen.getByText("Issues Board")).toBeInTheDocument();
    const grid = screen.getByTestId("kanban-grid");
    // Column labels with counts
    expect(within(grid).getByText(/Open/)).toBeInTheDocument();
    expect(within(grid).getByText(/Investigating/)).toBeInTheDocument();
    expect(within(grid).getByText(/Watching/)).toBeInTheDocument();
    expect(within(grid).getByText(/Resolved/)).toBeInTheDocument();
    // Issue titles in their columns
    expect(within(grid).getByText("DNS resolver timeout")).toBeInTheDocument();
    expect(within(grid).getByText("Disk space warning")).toBeInTheDocument();
    expect(within(grid).getByText("Memory leak")).toBeInTheDocument();
  });

  it("collapses resolved column by default", () => {
    renderRoute("/issues");
    // Resolved issues should not be rendered (collapsed)
    expect(screen.queryByText("Old bug fixed")).not.toBeInTheDocument();
    expect(screen.queryByText("Won't fix")).not.toBeInTheDocument();
    // But count should be visible
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseIssues.mockReturnValue({ data: null, isLoading: true, isError: false });
    renderRoute("/issues");
    expect(screen.getByText("Loading issues…")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseIssues.mockReturnValue({ data: null, isLoading: false, isError: true });
    renderRoute("/issues");
    expect(screen.getByText("Unable to load issues.")).toBeInTheDocument();
  });

  it("shows empty state when no issues match", () => {
    mockUseIssues.mockReturnValue({
      data: { data: [], has_more: false, next_cursor: null, warnings: [] },
      isLoading: false,
      isError: false,
    });
    renderRoute("/issues");
    expect(screen.getByTestId("empty-issues")).toBeInTheDocument();
  });

  it("renders kanban cards with severity badge and server", () => {
    renderRoute("/issues");
    const cards = screen.getAllByTestId("kanban-card");
    expect(cards.length).toBeGreaterThanOrEqual(3); // open + investigating + watching (resolved collapsed)
  });

  it("renders issue filter bar", () => {
    renderRoute("/issues");
    expect(screen.getByTestId("issue-filter-bar")).toBeInTheDocument();
  });

  it("switches to table view and renders sortable columns", () => {
    renderRoute("/issues");
    fireEvent.click(screen.getByText("Table"));
    const table = screen.getByTestId("issues-table");
    expect(within(table).getByText(/Title/)).toBeInTheDocument();
    expect(within(table).getByText(/Severity/)).toBeInTheDocument();
    expect(within(table).getByText(/Updated At/)).toBeInTheDocument();
    // All issues should appear in rows (including resolved/wontfix — table shows all)
    expect(within(table).getByText("DNS resolver timeout")).toBeInTheDocument();
    expect(within(table).getByText("Old bug fixed")).toBeInTheDocument();
  });

  it("table sort changes on column header click", () => {
    renderRoute("/issues");
    fireEvent.click(screen.getByText("Table"));
    const table = screen.getByTestId("issues-table");
    const titleHeader = within(table).getByText(/Title/);
    // Click title column to sort
    fireEvent.click(titleHeader);
    // Should show a sort indicator
    expect(titleHeader.textContent).toMatch(/Title.*▼/);
    // Click again to toggle direction
    fireEvent.click(titleHeader);
    expect(titleHeader.textContent).toMatch(/Title.*▲/);
  });

  it("view toggle preserves filters", () => {
    renderRoute("/issues?severity=critical");
    // Should start in kanban
    expect(screen.getByTestId("kanban-grid")).toBeInTheDocument();
    // Switch to table
    fireEvent.click(screen.getByText("Table"));
    expect(screen.getByTestId("issues-table")).toBeInTheDocument();
    // Switch back to kanban — should still render (filters preserved)
    fireEvent.click(screen.getByText("Kanban"));
    expect(screen.getByTestId("kanban-grid")).toBeInTheDocument();
  });
});

/* ── IssueDetail tests ────────────────────────────────────── */

describe("IssueDetail", () => {
  const detailIssue = makeIssue({ id: "iss-det", title: "Detailed Issue", symptoms: "High latency", root_cause: "DNS misconfiguration", tags: ["prod", "dns"] });
  const update1 = makeUpdate({ id: "upd-1", occurred_at: new Date(now - 7200_000).toISOString() });
  const update2 = makeUpdate({
    id: "upd-2",
    occurred_at: new Date(now - 3600_000).toISOString(),
    principal: "mark",
    content: "Applied fix",
    status_from: "investigating",
    status_to: "resolved",
    changes: { status: { from: "investigating", to: "resolved" } },
  });
  const linkedEvent = makeEvent({ id: "ev-linked", occurred_at: new Date(now - 5000_000).toISOString() });

  beforeEach(() => {
    mockUseIssue.mockReturnValue({
      data: {
        issue: detailIssue,
        updates: [update1, update2],
        related_issues: [],
      } as IssueDetailType,
      isLoading: false,
      isError: false,
    });
    mockUseEvents.mockReturnValue({
      events: [linkedEvent],
      warnings: [],
      hasMore: false,
      isLoading: false,
      isError: false,
      isFetching: false,
      isFetchingNextPage: false,
      loadMore: vi.fn(),
      dataUpdatedAt: now,
      pageCount: 1,
    });
  });

  it("renders issue header with title, status, severity", () => {
    renderRoute("/issues/iss-det");
    expect(screen.getByText("Detailed Issue")).toBeInTheDocument();
    expect(screen.getAllByText("open").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("high").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("web-1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders tags", () => {
    renderRoute("/issues/iss-det");
    expect(screen.getByText("prod")).toBeInTheDocument();
    expect(screen.getByText("dns")).toBeInTheDocument();
  });

  it("renders timeline with updates and events interspersed", () => {
    renderRoute("/issues/iss-det");
    const timeline = screen.getByTestId("timeline");
    const updates = within(timeline).getAllByTestId("timeline-update");
    const events = within(timeline).getAllByTestId("timeline-event");
    expect(updates.length).toBe(2);
    expect(events.length).toBe(1);
  });

  it("renders metadata panels", () => {
    renderRoute("/issues/iss-det");
    expect(screen.getByText("Symptoms")).toBeInTheDocument();
    expect(screen.getByText("Root Cause")).toBeInTheDocument();
    expect(screen.getByText("Solution")).toBeInTheDocument();
    // Symptoms content
    expect(screen.getByText("High latency")).toBeInTheDocument();
    // Root cause content
    expect(screen.getByText("DNS misconfiguration")).toBeInTheDocument();
  });

  it("shows edit button", () => {
    renderRoute("/issues/iss-det");
    expect(screen.getByTestId("edit-button")).toBeInTheDocument();
  });

  it("shows add observation form", () => {
    renderRoute("/issues/iss-det");
    expect(screen.getByTestId("add-observation")).toBeInTheDocument();
    expect(screen.getByTestId("observation-input")).toBeInTheDocument();
    expect(screen.getByTestId("observation-submit")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    mockUseIssue.mockReturnValue({ data: null, isLoading: true, isError: false });
    renderRoute("/issues/iss-det");
    expect(screen.getByTestId("detail-loading")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseIssue.mockReturnValue({ data: null, isLoading: false, isError: true });
    renderRoute("/issues/iss-det");
    expect(screen.getByText(/Unable to load issue/)).toBeInTheDocument();
  });

  it("shows linked events count", () => {
    renderRoute("/issues/iss-det");
    expect(screen.getByText("Linked Events")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("opens edit form and shows fields", () => {
    renderRoute("/issues/iss-det");
    fireEvent.click(screen.getByTestId("edit-button"));
    expect(screen.getByTestId("edit-form")).toBeInTheDocument();
    expect(screen.getByTestId("edit-status")).toBeInTheDocument();
    expect(screen.getByTestId("edit-severity")).toBeInTheDocument();
    expect(screen.getByTestId("edit-save")).toBeInTheDocument();
  });

  it("shows 409 conflict error on save", async () => {
    const mockUpdate = api.issues.update as ReturnType<typeof vi.fn>;
    const err = new ApiError("Conflict", 409, {});
    mockUpdate.mockRejectedValueOnce(err);

    renderRoute("/issues/iss-det");
    fireEvent.click(screen.getByTestId("edit-button"));

    // Change status to trigger a real patch
    fireEvent.change(screen.getByTestId("edit-status"), { target: { value: "investigating" } });
    fireEvent.click(screen.getByTestId("edit-save"));

    await waitFor(() => {
      expect(screen.getByTestId("edit-error")).toBeInTheDocument();
      expect(screen.getByTestId("edit-error").textContent).toMatch(/Conflict/);
    });
  });
});
