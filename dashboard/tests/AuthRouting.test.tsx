import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "@/App";

const mockUseAuth = vi.fn();

vi.mock("@/auth/context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useServers", () => ({
  useServers: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/pages/FleetOverview", () => ({
  FleetOverview: () => <h2>Fleet Overview</h2>,
}));

vi.mock("@/pages/EventStream", () => ({
  EventStream: () => <h2>Event Stream</h2>,
}));

vi.mock("@/pages/IssuesBoard", () => ({
  IssuesBoard: () => <h2>Issues Board</h2>,
}));

vi.mock("@/pages/IssueDetail", () => ({
  IssueDetail: () => <h2>Issue Detail</h2>,
}));

vi.mock("@/pages/ServerDetail", () => ({
  ServerDetail: () => <h2>Server Detail</h2>,
}));

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <App initialEntries={[path]} />
    </QueryClientProvider>,
  );
}

describe("Auth routing", () => {
  it("renders app routes when authenticated", async () => {
    mockUseAuth.mockReturnValue({
      mode: "token",
      status: "authenticated",
      canWrite: true,
      principal: "mark",
      role: "admin",
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshIdentity: vi.fn(),
    });

    renderApp("/");
    expect(await screen.findByRole("heading", { level: 2, name: "Fleet Overview" })).toBeInTheDocument();
  });

  it("kicks off login when unauthenticated in oidc mode", async () => {
    const login = vi.fn();
    mockUseAuth.mockReturnValue({
      mode: "oidc",
      status: "unauthenticated",
      canWrite: false,
      principal: null,
      role: null,
      error: null,
      login,
      logout: vi.fn(),
      refreshIdentity: vi.fn(),
    });

    renderApp("/");
    expect(await screen.findByText("Authenticating...")).toBeInTheDocument();
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
  });

  it("shows unavailable message in token mode without auth", async () => {
    mockUseAuth.mockReturnValue({
      mode: "token",
      status: "unauthenticated",
      canWrite: false,
      principal: null,
      role: null,
      error: "missing_dashboard_token",
      login: vi.fn(),
      logout: vi.fn(),
      refreshIdentity: vi.fn(),
    });

    renderApp("/");
    expect(await screen.findByText("Authentication Unavailable")).toBeInTheDocument();
    expect(screen.getByText("missing_dashboard_token")).toBeInTheDocument();
  });
});
