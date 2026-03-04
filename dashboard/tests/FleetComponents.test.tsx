import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ServerCard, ServerCardSkeleton } from "@/components/ServerCard";
import { IssueBadge } from "@/components/IssueBadge";
import type { Briefing, Issue } from "@/api/types";

/* ── Test fixtures ───────────────────────────────────────── */

const now = Date.now();

function makeBriefing(overrides?: {
  status?: "active" | "decommissioned";
  openIssues?: Issue[];
  eventsLast24h?: number;
  lastDeployment?: string | null;
  recentEventAt?: string | null;
}): Briefing {
  const issues = overrides?.openIssues ?? [];
  return {
    server: {
      id: "srv-1",
      name: "agent-workspace",
      display_name: "Agent Workspace",
      private_ipv4: "10.44.0.2",
      status: overrides?.status ?? "active",
      notes: "Test server",
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
      aliases: ["workspace"],
    },
    summary: {
      events_last_24h: overrides?.eventsLast24h ?? 12,
      events_last_7d: 47,
      open_issue_count: issues.length,
      last_deployment: overrides?.lastDeployment ?? new Date(now - 2 * 86400_000).toISOString(),
    },
    recent_events:
      overrides?.recentEventAt !== null
        ? [
            {
              id: "ev-1",
              occurred_at: overrides?.recentEventAt ?? new Date(now - 3600_000).toISOString(),
              ingested_at: new Date(now - 3600_000).toISOString(),
              principal: "codex_b",
              reported_agent: null,
              server_id: "srv-1",
              server_name: "agent-workspace",
              category: "deployment",
              summary: "Deployed v1.2",
              detail: null,
              tags: [],
              issue_id: null,
              corrects_event_id: null,
              metadata: {},
              dedupe_key: null,
            },
          ]
        : [],
    open_issues: issues,
  };
}

function makeIssue(severity: "critical" | "high" | "medium" | "low", title?: string): Issue {
  return {
    id: `issue-${severity}`,
    title: title ?? `${severity} issue`,
    status: "open",
    severity,
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
  };
}

/* ── ServerCard tests ────────────────────────────────────── */

describe("ServerCard", () => {
  function renderCard(briefing: Briefing) {
    return render(
      <MemoryRouter>
        <ServerCard briefing={briefing} />
      </MemoryRouter>,
    );
  }

  it("renders server name and display name", () => {
    renderCard(makeBriefing());
    expect(screen.getByText("agent-workspace")).toBeInTheDocument();
    expect(screen.getByText("Agent Workspace")).toBeInTheDocument();
  });

  it("shows active status badge", () => {
    renderCard(makeBriefing({ status: "active" }));
    const badge = screen.getByText("active");
    expect(badge.className).toContain("bg-green-400");
  });

  it("shows decommissioned status badge", () => {
    renderCard(makeBriefing({ status: "decommissioned" }));
    const badge = screen.getByText("decommissioned");
    expect(badge.className).toContain("bg-neo-gray-400");
  });

  it("displays event count from summary", () => {
    renderCard(makeBriefing({ eventsLast24h: 42 }));
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows green issue count bg when no issues", () => {
    renderCard(makeBriefing({ openIssues: [] }));
    const issuesLink = screen.getByTestId("issues-link");
    expect(issuesLink.className).toContain("bg-green-400");
    expect(within(issuesLink).getByText("0")).toBeInTheDocument();
  });

  it("shows red issue count bg when critical/high issues exist", () => {
    renderCard(makeBriefing({ openIssues: [makeIssue("critical")] }));
    const issuesLink = screen.getByTestId("issues-link");
    expect(issuesLink.className).toContain("bg-red-400");
  });

  it("shows yellow issue count bg when only medium issues", () => {
    renderCard(makeBriefing({ openIssues: [makeIssue("medium")] }));
    const issuesLink = screen.getByTestId("issues-link");
    expect(issuesLink.className).toContain("bg-yellow-400");
  });

  it("shows relative last event time", () => {
    renderCard(makeBriefing({ recentEventAt: new Date(now - 3600_000).toISOString() }));
    expect(screen.getByTestId("last-event").textContent).toBe("1h ago");
  });

  it("shows dash when no last event", () => {
    renderCard(makeBriefing({ recentEventAt: null }));
    expect(screen.getByTestId("last-event").textContent).toBe("—");
  });

  it("shows relative last deploy time", () => {
    renderCard(makeBriefing({ lastDeployment: new Date(now - 2 * 86400_000).toISOString() }));
    expect(screen.getByTestId("last-deploy").textContent).toBe("2d ago");
  });

  it("issues link navigates to issues board filtered by server", () => {
    renderCard(makeBriefing());
    const issuesLink = screen.getByTestId("issues-link");
    expect(issuesLink.getAttribute("href")).toBe("/issues?server=agent-workspace");
  });
});

/* ── ServerCardSkeleton tests ────────────────────────────── */

describe("ServerCardSkeleton", () => {
  it("renders a skeleton placeholder", () => {
    render(<ServerCardSkeleton />);
    expect(screen.getByTestId("server-card-skeleton")).toBeInTheDocument();
  });
});

/* ── IssueBadge tests ────────────────────────────────────── */

describe("IssueBadge", () => {
  function renderBadge(issue: Issue) {
    return render(
      <MemoryRouter>
        <IssueBadge issue={issue} />
      </MemoryRouter>,
    );
  }

  it("renders issue title", () => {
    renderBadge(makeIssue("high", "DNS resolution failing"));
    expect(screen.getByText("DNS resolution failing")).toBeInTheDocument();
  });

  it("shows status and severity badges", () => {
    renderBadge(makeIssue("critical"));
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("shows server name", () => {
    renderBadge(makeIssue("low"));
    expect(screen.getByText("agent-workspace")).toBeInTheDocument();
  });

  it("links to issue detail page", () => {
    renderBadge(makeIssue("medium"));
    const link = screen.getByTestId("issue-badge");
    expect(link.getAttribute("href")).toBe("/issues/issue-medium");
  });
});
