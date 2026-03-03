import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryPill } from "@/components/CategoryPill";
import { FilterBar, EMPTY_FILTERS } from "@/components/FilterBar";
import { NewEventsToast } from "@/components/NewEventsToast";
import { Pagination } from "@/components/Pagination";
import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { TimeRangePicker } from "@/components/TimeRangePicker";

describe("Shared components", () => {
  it("renders status and severity tokens", () => {
    render(
      <div>
        <StatusPill status="investigating" />
        <SeverityBadge severity="high" />
        <CategoryPill category="deployment" />
      </div>
    );

    expect(screen.getByText("investigating")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("deployment")).toBeInTheDocument();
  });

  it("renders principal avatar text", () => {
    render(<PrincipalAvatar principal="codex_b" />);
    expect(screen.getByText("codex_b")).toBeInTheDocument();
  });

  it("renders compact principal avatar with title", () => {
    render(<PrincipalAvatar principal="codex_b" compact />);
    expect(screen.getByTitle("codex_b")).toBeInTheDocument();
  });

  it("updates filter values and supports clear", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <FilterBar
        values={{ ...EMPTY_FILTERS, server: "agent-workspace" }}
        onChange={onChange}
        onClear={onClear}
        serverOptions={[{ label: "agent-workspace", value: "agent-workspace" }]}
        categoryOptions={[{ label: "deployment", value: "deployment" }]}
        principalOptions={[{ label: "codex_b", value: "codex_b" }]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search summary…"), {
      target: { name: "search", value: "deploy" },
    });
    expect(onChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders tag filter input in FilterBar", () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        values={EMPTY_FILTERS}
        onChange={onChange}
        onClear={vi.fn()}
        serverOptions={[]}
        categoryOptions={[]}
        principalOptions={[]}
      />
    );

    const tagInput = screen.getByPlaceholderText("Filter by tag…");
    expect(tagInput).toBeInTheDocument();

    fireEvent.change(tagInput, { target: { name: "tag", value: "release" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tag: "release" }));
  });

  it("fires load more when pagination button is clicked", () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore loading={false} onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

describe("TimeRangePicker", () => {
  it("renders all preset buttons", () => {
    render(
      <TimeRangePicker
        since=""
        until=""
        onSinceChange={vi.fn()}
        onUntilChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("preset-1h")).toBeInTheDocument();
    expect(screen.getByTestId("preset-6h")).toBeInTheDocument();
    expect(screen.getByTestId("preset-24h")).toBeInTheDocument();
    expect(screen.getByTestId("preset-7d")).toBeInTheDocument();
    expect(screen.getByTestId("preset-30d")).toBeInTheDocument();
  });

  it("calls onSinceChange when a preset is clicked", () => {
    const onSinceChange = vi.fn();
    const onUntilChange = vi.fn();

    render(
      <TimeRangePicker
        since=""
        until=""
        onSinceChange={onSinceChange}
        onUntilChange={onUntilChange}
      />
    );

    fireEvent.click(screen.getByTestId("preset-24h"));
    expect(onSinceChange).toHaveBeenCalledTimes(1);
    expect(onUntilChange).toHaveBeenCalledWith("");

    // The since value should be an ISO string roughly 24h ago
    const calledWith = onSinceChange.mock.calls[0][0] as string;
    const parsed = new Date(calledWith);
    const expected = Date.now() - 24 * 3600_000;
    expect(Math.abs(parsed.getTime() - expected)).toBeLessThan(5000);
  });

  it("renders custom date inputs", () => {
    render(
      <TimeRangePicker
        since=""
        until=""
        onSinceChange={vi.fn()}
        onUntilChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });
});

describe("NewEventsToast", () => {
  it("does not render when count is zero", () => {
    const { container } = render(<NewEventsToast count={0} onRefresh={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with correct count and calls onRefresh", () => {
    const onRefresh = vi.fn();
    render(<NewEventsToast count={5} onRefresh={onRefresh} />);

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/new events available/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows 99+ for large counts", () => {
    render(<NewEventsToast count={150} onRefresh={vi.fn()} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
