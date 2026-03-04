import { useEffect, useState, type ReactNode } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  createBrowserRouter,
  type RouteObject,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AlertCircle,
  LayoutGrid,
  ListRestart,
  Menu,
  ChevronRight,
  X,
} from "lucide-react";

import { useAuth } from "@/auth/context";
import { useServers } from "@/hooks/useServers";
import { EventStream } from "@/pages/EventStream";
import { FleetOverview } from "@/pages/FleetOverview";
import { IssueDetail } from "@/pages/IssueDetail";
import { IssuesBoard } from "@/pages/IssuesBoard";
import { ServerDetail } from "@/pages/ServerDetail";

function SidebarLink({
  to,
  icon,
  label,
  end = false,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-3 font-bold border-2 border-neo-gray-950 transition-all
        ${isActive 
          ? "bg-brand text-white shadow-neo translate-x-1 translate-y-1" 
          : "bg-white text-neo-gray-800 hover:bg-neo-gray-100"}
      `}
    >
      {({ isActive }) => (
        <>
          {icon}
          <span className="flex-1">{label}</span>
          <ChevronRight size={16} className={`${isActive ? "opacity-100" : "opacity-0"}`} />
        </>
      )}
    </NavLink>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const serversQuery = useServers();
  const auth = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-neo-gray-200 flex flex-col">
      {/* Header */}
      <header className="bg-brand border-2 border-neo-gray-950 shadow-neo-sm sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            className="lg:hidden bg-white text-neo-gray-950 border-2 border-neo-gray-950 p-2 font-bold shadow-neo-sm active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">
            OpsLog <span className="text-neo-gray-950 bg-white px-2 border-2 border-neo-gray-950">Fleet</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {auth.status === "authenticated" && auth.principal && auth.role ? (
            <div className="hidden sm:flex items-center gap-3 px-3 py-2 bg-white border-2 border-neo-gray-950 font-bold text-xs shadow-neo-sm uppercase">
              <span>{auth.principal}</span>
              <span className="text-neo-gray-500">({auth.role})</span>
              {auth.mode === "oidc" ? (
                <button
                  type="button"
                  onClick={() => {
                    void auth.logout();
                  }}
                  className="ml-2 border-2 border-neo-gray-950 px-2 py-1 bg-neo-gray-100 hover:bg-neo-gray-200"
                >
                  Logout
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="hidden sm:block px-4 py-2 bg-white border-2 border-neo-gray-950 font-bold text-xs shadow-neo-sm">
            STATUS: <span className="text-green-600 animate-pulse">LIVE</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          id="app-sidebar"
          className={`
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:translate-x-0 transition-transform duration-300
            fixed lg:static z-40 w-72 h-full bg-white border-r-2 border-neo-gray-950 p-6
            flex flex-col gap-6 overflow-y-auto
          `}
        >
          <nav className="flex flex-col gap-3">
            <SidebarLink to="/" icon={<LayoutGrid size={20} />} label="Fleet Overview" end />
            <SidebarLink to="/events" icon={<ListRestart size={20} />} label="Event Stream" />
            <SidebarLink to="/issues" icon={<AlertCircle size={20} />} label="Issues Board" />
          </nav>

          <div className="mt-4 pt-4 border-t-2 border-neo-gray-950">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-neo-gray-400 mb-4">Servers</h2>
            {serversQuery.isLoading ? (
              <div className="animate-pulse flex flex-col gap-2">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-neo-gray-100 border-2 border-neo-gray-950 shadow-neo-sm" />)}
              </div>
            ) : null}
            <ul className="space-y-2">
              {(serversQuery.data ?? []).map((server) => (
                <li key={server.id}>
                  <NavLink
                    to={`/servers/${server.name}`}
                    className={({ isActive }) => `
                      flex items-center gap-2 px-3 py-2 font-bold border-2 border-neo-gray-950 text-sm transition-all
                      ${isActive 
                        ? "bg-neo-gray-950 text-white shadow-neo-sm translate-x-0.5 translate-y-0.5" 
                        : "bg-white text-neo-gray-700 hover:bg-neo-gray-50"}
                    `}
                  >
                    <span className={`w-2 h-2 border border-neo-gray-950 ${server.status === "active" ? "bg-green-400" : "bg-neo-gray-300"}`} />
                    {server.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto pt-6">
            <div className="p-4 bg-brand-light border-2 border-neo-gray-950 text-white text-xs font-black shadow-neo-sm italic uppercase tracking-widest">
              OpsLog
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <section className="rounded-xl border-2 border-neo-gray-950 bg-white p-8 text-center shadow-neo">
      <h2 className="text-2xl font-black uppercase text-neo-gray-900">Authenticating...</h2>
      <p className="mt-2 text-sm font-bold text-neo-gray-500">
        Verifying your session with OpsLog.
      </p>
    </section>
  );
}

function AuthUnavailableScreen({ message }: { message: string }) {
  return (
    <section className="rounded-xl border-2 border-red-600 bg-white p-8 text-center shadow-neo">
      <h2 className="text-2xl font-black uppercase text-red-700">Authentication Unavailable</h2>
      <p className="mt-2 text-sm font-bold text-neo-gray-700">{message}</p>
    </section>
  );
}

function AuthScreenFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neo-gray-200 p-8">
      <div className="mx-auto max-w-xl">{children}</div>
    </div>
  );
}

function AuthCallbackPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.status === "authenticated") {
      navigate("/", { replace: true });
    }
  }, [auth.status, navigate]);

  return (
    <AuthScreenFrame>
      {auth.status === "error" ? (
        <AuthUnavailableScreen message={auth.error || "OIDC callback failed."} />
      ) : (
        <AuthLoadingScreen />
      )}
    </AuthScreenFrame>
  );
}

function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (auth.mode === "oidc" && auth.status === "unauthenticated" && location.pathname !== "/auth/callback") {
      void auth.login();
    }
  }, [auth.login, auth.mode, auth.status, location.pathname]);

  if (auth.status === "loading" || auth.status === "logging_out") {
    return (
      <AuthScreenFrame>
        <AuthLoadingScreen />
      </AuthScreenFrame>
    );
  }

  if (auth.status === "error") {
    return (
      <AuthScreenFrame>
        <AuthUnavailableScreen message={auth.error || "OIDC configuration or startup failed."} />
      </AuthScreenFrame>
    );
  }

  if (auth.status === "unauthenticated") {
    if (auth.mode === "oidc") {
      return (
        <AuthScreenFrame>
          <AuthLoadingScreen />
        </AuthScreenFrame>
      );
    }
    return (
      <AuthScreenFrame>
        <AuthUnavailableScreen message={auth.error || "Dashboard token mode is not configured."} />
      </AuthScreenFrame>
    );
  }

  return <Outlet />;
}

export const appRoutes: RouteObject[] = [
  {
    path: "/auth/callback",
    element: <AuthCallbackPage />,
  },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <FleetOverview /> },
          { path: "events", element: <EventStream /> },
          { path: "issues", element: <IssuesBoard /> },
          { path: "issues/:id", element: <IssueDetail /> },
          { path: "servers/:name", element: <ServerDetail /> },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(appRoutes);

export default router;
