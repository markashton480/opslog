import { useEffect, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  createBrowserRouter,
  type RouteObject,
  useLocation,
} from "react-router-dom";

import { useServers } from "@/hooks/useServers";
import { EventStream } from "@/pages/EventStream";
import { FleetOverview } from "@/pages/FleetOverview";
import { IssueDetail } from "@/pages/IssueDetail";
import { IssuesBoard } from "@/pages/IssuesBoard";
import { ServerDetail } from "@/pages/ServerDetail";

function navClassName({ isActive }: { isActive: boolean }): string {
  return [
    "block rounded-md px-3 py-2 text-sm font-medium transition",
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
  ].join(" ");
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const serversQuery = useServers();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#dbeafe_0,#f8fafc_45%,#eef2ff_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Lintel</p>
            <h1 className="text-xl font-semibold">OpsLog Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            aria-controls="opslog-sidebar"
            className="rounded-md border border-slate-300 px-3 py-1 text-sm lg:hidden"
          >
            {sidebarOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside
          id="opslog-sidebar"
          className={`${sidebarOpen ? "block" : "hidden"} rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:block`}
        >
          <nav className="space-y-1">
            <NavLink to="/" end className={navClassName}>
              Fleet Overview
            </NavLink>
            <NavLink to="/events" className={navClassName}>
              Event Stream
            </NavLink>
            <NavLink to="/issues" className={navClassName}>
              Issues Board
            </NavLink>
          </nav>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Servers</h2>
            {serversQuery.isLoading ? <p className="mt-2 text-sm text-slate-500">Loading...</p> : null}
            <ul className="mt-2 space-y-1">
              {(serversQuery.data ?? []).map((server) => (
                <li key={server.id}>
                  <NavLink to={`/servers/${server.name}`} className={navClassName}>
                    {server.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const appRoutes: RouteObject[] = [
  {
    path: "/",
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
];

const router = createBrowserRouter(appRoutes);

export default router;
