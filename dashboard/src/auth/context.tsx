import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { UserManager, type User, type UserManagerSettings } from "oidc-client-ts";

import { setTokenProvider, setUnauthorizedHandler } from "@/api/client";
import type { ApiResponse, MeResponse } from "@/api/types";

type AuthMode = "token" | "oidc";
type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "logging_out" | "error";
type AuthRole = MeResponse["role"] | null;

interface AuthContextValue {
  mode: AuthMode;
  status: AuthStatus;
  token: string | null;
  principal: string | null;
  role: AuthRole;
  error: string | null;
  canWrite: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
}

const DEFAULT_AUTH_CONTEXT: AuthContextValue = {
  mode: "token",
  status: "unauthenticated",
  token: null,
  principal: null,
  role: null,
  error: null,
  canWrite: false,
  login: async () => {},
  logout: async () => {},
  refreshIdentity: async () => {},
};

const AuthContext = createContext<AuthContextValue>(DEFAULT_AUTH_CONTEXT);

const BASE_URL = import.meta.env.VITE_OPSLOG_API_URL || "/api/v1";
const TOKEN_FROM_ENV = import.meta.env.VITE_OPSLOG_TOKEN || null;

function resolveAuthMode(): AuthMode {
  const mode = import.meta.env.VITE_AUTH_MODE;
  if (mode === "oidc" || mode === "token") {
    return mode;
  }

  const fallbackMode = import.meta.env.PROD ? "oidc" : "token";
  if (mode) {
    console.warn(`Invalid VITE_AUTH_MODE '${mode}', falling back to '${fallbackMode}'.`);
  }
  return fallbackMode;
}

function buildOidcSettings(): UserManagerSettings | null {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
  if (!authority || !clientId) {
    return null;
  }

  const origin = window.location.origin;
  const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI || `${origin}/auth/callback`;
  const postLogoutRedirectUri = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || `${origin}/`;
  const silentRedirectUri = import.meta.env.VITE_OIDC_SILENT_REDIRECT_URI;

  return {
    authority,
    client_id: clientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutRedirectUri,
    response_type: "code",
    scope: import.meta.env.VITE_OIDC_SCOPE || "openid profile email",
    automaticSilentRenew: Boolean(silentRedirectUri),
    silent_redirect_uri: silentRedirectUri || undefined,
    monitorSession: false,
    loadUserInfo: false,
  };
}

function hasAuthorizationParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("code") || params.has("error");
}

async function fetchIdentity(token: string): Promise<MeResponse> {
  const response = await fetch(`${BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load identity: ${response.status}`);
  }
  const payload = (await response.json()) as ApiResponse<MeResponse>;
  return payload.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = resolveAuthMode();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [role, setRole] = useState<AuthRole>(null);
  const [error, setError] = useState<string | null>(null);
  const userManagerRef = useRef<UserManager | null>(null);
  const loginInFlightRef = useRef(false);
  const logoutInFlightRef = useRef(false);

  const loadIdentity = useCallback(async (value: string) => {
    const identity = await fetchIdentity(value);
    setPrincipal(identity.principal);
    setRole(identity.role);
  }, []);

  const setAuthenticatedState = useCallback(
    async (value: string) => {
      setToken(value);
      setTokenProvider(() => value);
      await loadIdentity(value);
      setStatus("authenticated");
      setError(null);
    },
    [loadIdentity],
  );

  const setUnauthenticatedState = useCallback((message: string | null = null) => {
    setToken(null);
    setPrincipal(null);
    setRole(null);
    setTokenProvider(() => null);
    setStatus("unauthenticated");
    setError(message);
  }, []);

  const login = useCallback(async () => {
    if (mode !== "oidc") {
      return;
    }
    if (logoutInFlightRef.current) {
      return;
    }
    const manager = userManagerRef.current;
    if (!manager || loginInFlightRef.current) {
      return;
    }
    loginInFlightRef.current = true;
    try {
      await manager.signinRedirect();
    } finally {
      loginInFlightRef.current = false;
    }
  }, [mode]);

  const logout = useCallback(async () => {
    if (mode !== "oidc") {
      return;
    }
    const manager = userManagerRef.current;
    if (!manager || logoutInFlightRef.current) {
      return;
    }
    logoutInFlightRef.current = true;
    setStatus("logging_out");
    setToken(null);
    setPrincipal(null);
    setRole(null);
    setTokenProvider(() => null);
    setError(null);
    try {
      await manager.removeUser();
      await manager.signoutRedirect();
    } catch {
      setUnauthenticatedState("logout_failed");
    } finally {
      logoutInFlightRef.current = false;
    }
  }, [mode, setUnauthenticatedState]);

  const refreshIdentity = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      await loadIdentity(token);
    } catch {
      setUnauthenticatedState("session_expired");
    }
  }, [loadIdentity, setUnauthenticatedState, token]);

  useEffect(() => {
    setTokenProvider(() => token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      if (mode === "oidc" && !logoutInFlightRef.current) {
        setUnauthenticatedState("session_expired");
        await login();
      }
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [login, mode, setUnauthenticatedState]);

  useEffect(() => {
    let cancelled = false;
    let manager: UserManager | null = null;
    let onTokenExpired: (() => void) | null = null;
    let onUserLoaded: ((user: User) => void) | null = null;

    async function initialiseTokenMode() {
      if (!TOKEN_FROM_ENV) {
        if (!cancelled) {
          setUnauthenticatedState("missing_dashboard_token");
        }
        return;
      }

      try {
        await setAuthenticatedState(TOKEN_FROM_ENV);
      } catch {
        if (!cancelled) {
          setUnauthenticatedState("invalid_dashboard_token");
        }
      }
    }

    async function initialiseOidcMode() {
      const settings = buildOidcSettings();
      if (!settings) {
        if (!cancelled) {
          setStatus("error");
          setError("missing_oidc_configuration");
        }
        return;
      }

      manager = new UserManager(settings);
      userManagerRef.current = manager;

      onTokenExpired = () => {
        if (!logoutInFlightRef.current) {
          void login();
        }
      };
      manager.events.addAccessTokenExpired(onTokenExpired);
      onUserLoaded = (user: User) => {
        if (cancelled || logoutInFlightRef.current || !user.access_token) {
          return;
        }
        void setAuthenticatedState(user.access_token).catch(() => {
          if (!cancelled) {
            setUnauthenticatedState("session_expired");
          }
        });
      };
      manager.events.addUserLoaded(onUserLoaded);

      try {
        const callbackPath = new URL(settings.redirect_uri, window.location.origin).pathname;
        if (window.location.pathname === callbackPath && hasAuthorizationParams(window.location.search)) {
          await manager.signinCallback();
          window.history.replaceState({}, document.title, "/");
        }

        let user = await manager.getUser();
        if (user?.expired) {
          try {
            user = await manager.signinSilent();
          } catch {
            user = null;
          }
        }

        if (!user || !user.access_token) {
          if (!cancelled) {
            setUnauthenticatedState(null);
          }
          return;
        }

        await setAuthenticatedState(user.access_token);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("oidc_initialization_failed");
        }
      }
    }

    if (mode === "token") {
      void initialiseTokenMode();
    } else {
      void initialiseOidcMode();
    }

    return () => {
      cancelled = true;
      if (manager && onTokenExpired) {
        manager.events.removeAccessTokenExpired(onTokenExpired);
      }
      if (manager && onUserLoaded) {
        manager.events.removeUserLoaded(onUserLoaded);
      }
    };
  }, [login, mode, setAuthenticatedState, setUnauthenticatedState]);

  const canWrite = role === "admin" || role === "writer";

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      status,
      token,
      principal,
      role,
      error,
      canWrite,
      login,
      logout,
      refreshIdentity,
    }),
    [canWrite, error, login, logout, mode, principal, refreshIdentity, role, status, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
