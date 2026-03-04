import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oidcMockState = vi.hoisted(() => ({
  managers: [] as Array<{ emitUserLoaded: (token: string) => void }>,
}));

vi.mock("oidc-client-ts", () => {
  type UserLoadedHandler = (user: { access_token?: string | null }) => void;

  class UserManager {
    onUserLoaded: UserLoadedHandler | null = null;
    events: {
      addAccessTokenExpired: ReturnType<typeof vi.fn>;
      removeAccessTokenExpired: ReturnType<typeof vi.fn>;
      addUserLoaded: ReturnType<typeof vi.fn>;
      removeUserLoaded: ReturnType<typeof vi.fn>;
    };
    getUser: ReturnType<typeof vi.fn>;
    signinSilent: ReturnType<typeof vi.fn>;
    signinCallback: ReturnType<typeof vi.fn>;
    signinRedirect: ReturnType<typeof vi.fn>;
    removeUser: ReturnType<typeof vi.fn>;
    signoutRedirect: ReturnType<typeof vi.fn>;

    constructor() {
      this.events = {
        addAccessTokenExpired: vi.fn(),
        removeAccessTokenExpired: vi.fn(),
        addUserLoaded: vi.fn((handler: UserLoadedHandler) => {
          this.onUserLoaded = handler;
        }),
        removeUserLoaded: vi.fn((handler: UserLoadedHandler) => {
          if (this.onUserLoaded === handler) {
            this.onUserLoaded = null;
          }
        }),
      };
      this.getUser = vi.fn(async () => ({ access_token: "initial-token", expired: false }));
      this.signinSilent = vi.fn();
      this.signinCallback = vi.fn();
      this.signinRedirect = vi.fn();
      this.removeUser = vi.fn();
      this.signoutRedirect = vi.fn();
      oidcMockState.managers.push(this);
    }

    emitUserLoaded(token: string) {
      this.onUserLoaded?.({ access_token: token });
    }
  }

  return {
    UserManager,
  };
});

import { AuthProvider, useAuth } from "@/auth/context";

function AuthProbe() {
  const auth = useAuth();
  return (
    <div data-testid="auth-state">
      {auth.status}|{auth.token || "none"}|{auth.principal || "none"}|{auth.canWrite ? "write" : "read"}
    </div>
  );
}

beforeEach(() => {
  oidcMockState.managers.length = 0;
  vi.stubEnv("VITE_AUTH_MODE", "oidc");
  vi.stubEnv("VITE_OIDC_AUTHORITY", "https://id.example.com/realms/lintel");
  vi.stubEnv("VITE_OIDC_CLIENT_ID", "opslog-dev");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Auth context", () => {
  it("uses safe defaults outside AuthProvider", () => {
    render(<AuthProbe />);
    expect(screen.getByTestId("auth-state")).toHaveTextContent("unauthenticated|none|none|read");
  });

  it("updates auth state when oidc userLoaded fires", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const token = new Headers(init?.headers).get("Authorization");
      const principal = token?.includes("renewed-token") ? "mark-renewed" : "mark";
      return new Response(
        JSON.stringify({
          data: { principal, role: "admin", auth_source: "oidc" },
          warnings: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent("authenticated|initial-token|mark|write"),
    );

    expect(oidcMockState.managers[0]).toBeDefined();
    await act(async () => {
      oidcMockState.managers[0].emitUserLoaded("renewed-token");
    });

    await waitFor(() =>
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        "authenticated|renewed-token|mark-renewed|write",
      ),
    );
  });
});
