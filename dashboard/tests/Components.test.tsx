import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CategoryPill } from "@/components/CategoryPill";
import { FilterBar } from "@/components/FilterBar";
import { Pagination } from "@/components/Pagination";
import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";

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

  it("updates filter values and supports clear", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    render(
      <FilterBar
        values={{ search: "", server: "", category: "", principal: "" }}
        onChange={onChange}
        onClear={onClear}
        serverOptions={[{ label: "agent-workspace", value: "agent-workspace" }]}
        categoryOptions={[{ label: "deployment", value: "deployment" }]}
        principalOptions={[{ label: "codex_b", value: "codex_b" }]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Search summary"), {
      target: { name: "search", value: "deploy" },
    });
    expect(onChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("fires load more when pagination button is clicked", () => {
    const onLoadMore = vi.fn();
    render(<Pagination hasMore loading={false} onLoadMore={onLoadMore} />);

    fireEvent.click(screen.getByRole("button", { name: "Load More" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
