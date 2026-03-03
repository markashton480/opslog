import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { TimelineEntry, type TimelineItem } from "@/components/TimelineEntry";
import {
  IssueFilterBar,
  EMPTY_ISSUE_FILTERS,
  ACTIVE_STATUSES,
  ALL_STATUSES,
  ALL_SEVERITIES,
  type IssueFilterValues,
} from "@/components/IssueFilterBar";
import type { Event, IssueUpdate } from "@/api/types";

const now = Date.now();

/* ── TimelineEntry ────────────────────────────────────────── */

describe("TimelineEntry", () => {
  const updateItem: TimelineItem = {
    kind: "update",
    data: {
      id: "upd-1",
      issue_id: "iss-1",
      occurred_at: new Date(now - 3600_000).toISOString(),
      ingested_at: new Date(now - 3600_000).toISOString(),
      principal: "codex_b",
      content: "Applied DNS fix",
      status_from: "open",
      status_to: "investigating",
      changes: { status: { from: "open", to: "investigating" } },
    } satisfies IssueUpdate,
  };

  const eventItem: TimelineItem = {
    kind: "event",
    data: {
      id: "ev-1",
      occurred_at: new Date(now - 1800_000).toISOString(),
      ingested_at: new Date(now - 1800_000).toISOString(),
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
    } satisfies Event,
  };

  it("renders an update with principal and content", () => {
    render(<TimelineEntry item={updateItem} />);
    expect(screen.getByTestId("timeline-update")).toBeInTheDocument();
    expect(screen.getByText("codex_b")).toBeInTheDocument();
    expect(screen.getByText("Applied DNS fix")).toBeInTheDocument();
  });

  it("renders status transition pills for updates", () => {
    render(<TimelineEntry item={updateItem} />);
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("investigating")).toBeInTheDocument();
    expect(screen.getByText("→")).toBeInTheDocument();
  });

  it("renders structured change diffs", () => {
    render(<TimelineEntry item={updateItem} />);
    expect(screen.getByText(/Changed status from "open" to "investigating"/)).toBeInTheDocument();
  });

  it("renders an event with distinct styling", () => {
    render(<TimelineEntry item={eventItem} />);
    expect(screen.getByTestId("timeline-event")).toBeInTheDocument();
    expect(screen.getByText("deploy-bot")).toBeInTheDocument();
    expect(screen.getByText("Deployed v2.3.0")).toBeInTheDocument();
    expect(screen.getByText("deployment")).toBeInTheDocument();
  });

  it("shows server name for events", () => {
    render(<TimelineEntry item={eventItem} />);
    expect(screen.getByText("web-1")).toBeInTheDocument();
  });
});

/* ── IssueFilterBar ────────────────────────────────────────── */

describe("IssueFilterBar", () => {
  const serverOptions = [
    { label: "web-1", value: "web-1" },
    { label: "db-1", value: "db-1" },
  ];

  function renderFilterBar(values?: Partial<IssueFilterValues>, onChange = () => {}) {
    const merged = { ...EMPTY_ISSUE_FILTERS, ...values };
    return render(
      <IssueFilterBar values={merged} serverOptions={serverOptions} onChange={onChange} onClear={() => {}} />,
    );
  }

  it("renders all status checkboxes", () => {
    renderFilterBar();
    for (const status of ALL_STATUSES) {
      expect(screen.getByTestId(`status-${status}`)).toBeInTheDocument();
    }
  });

  it("renders all severity checkboxes", () => {
    renderFilterBar();
    for (const sev of ALL_SEVERITIES) {
      expect(screen.getByTestId(`severity-${sev}`)).toBeInTheDocument();
    }
  });

  it("checks active statuses by default", () => {
    renderFilterBar();
    for (const s of ACTIVE_STATUSES) {
      expect(screen.getByTestId(`status-${s}`)).toBeChecked();
    }
    expect(screen.getByTestId("status-resolved")).not.toBeChecked();
    expect(screen.getByTestId("status-wontfix")).not.toBeChecked();
  });

  it("calls onChange when status checkbox toggled", () => {
    const onChange = vi.fn();
    renderFilterBar(undefined, onChange);
    fireEvent.click(screen.getByTestId("status-resolved"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const called = onChange.mock.calls[0][0] as IssueFilterValues;
    expect(called.statuses).toContain("resolved");
  });

  it("calls onChange when severity checkbox toggled", () => {
    const onChange = vi.fn();
    renderFilterBar(undefined, onChange);
    fireEvent.click(screen.getByTestId("severity-critical"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const called = onChange.mock.calls[0][0] as IssueFilterValues;
    expect(called.severities).toContain("critical");
  });

  it("renders server dropdown with options", () => {
    renderFilterBar();
    const select = screen.getByLabelText("Server") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(3); // All servers + 2 options
  });

  it("renders tag input", () => {
    renderFilterBar();
    expect(screen.getByPlaceholderText("Filter by tag…")).toBeInTheDocument();
  });

  it("has Active only preset button", () => {
    renderFilterBar();
    expect(screen.getByText("Active only")).toBeInTheDocument();
  });

  it("shows Reset Filters button", () => {
    renderFilterBar();
    expect(screen.getByText("Reset Filters")).toBeInTheDocument();
  });
});

/* ── Exports/constants ────────────────────────────────────── */

import { vi } from "vitest";

describe("IssueFilterBar constants", () => {
  it("ACTIVE_STATUSES contains open, investigating, watching", () => {
    expect(ACTIVE_STATUSES).toEqual(["open", "investigating", "watching"]);
  });

  it("ALL_STATUSES contains all five statuses", () => {
    expect(ALL_STATUSES).toHaveLength(5);
  });

  it("ALL_SEVERITIES contains all four severities", () => {
    expect(ALL_SEVERITIES).toHaveLength(4);
  });

  it("EMPTY_ISSUE_FILTERS defaults to active statuses", () => {
    expect(EMPTY_ISSUE_FILTERS.statuses).toEqual(ACTIVE_STATUSES);
    expect(EMPTY_ISSUE_FILTERS.severities).toEqual([]);
    expect(EMPTY_ISSUE_FILTERS.server).toBe("");
    expect(EMPTY_ISSUE_FILTERS.tag).toBe("");
  });
});
