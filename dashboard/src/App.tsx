import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { 
  LayoutGrid, 
  ListRestart, 
  AlertCircle, 
  Server, 
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<FleetOverview />} />
          <Route path="/events" element={<EventStream />} />
          <Route path="/issues" element={<IssuesBoard />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/servers/:name" element={<ServerDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neo-gray-200 flex flex-col">
      {/* Header */}
      <header className="bg-brand neo-border shadow-neo-sm sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden neo-button p-2"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">
            OpsLog <span className="text-neo-gray-950 bg-white px-2 neo-border">Fleet</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <div className="hidden sm:block px-4 py-2 bg-white neo-border font-bold text-xs shadow-neo-sm">
            STATUS: <span className="text-green-600 animate-pulse">LIVE</span>
          </div>
          <div className="hidden sm:block px-4 py-2 bg-white neo-border font-bold text-xs shadow-neo-sm">
            USER: <span className="text-brand">MARK</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 transition-transform duration-300
          fixed lg:static z-40 w-64 h-full bg-white border-r-2 border-neo-gray-950 p-6
          flex flex-col gap-6
        `}>
          <nav className="flex flex-col gap-2">
            <SidebarLink to="/" icon={<LayoutGrid size={20} />} label="Overview" />
            <SidebarLink to="/events" icon={<ListRestart size={20} />} label="Events" />
            <SidebarLink to="/issues" icon={<AlertCircle size={20} />} label="Issues" />
          </nav>

          <div className="mt-auto">
            <div className="p-4 bg-brand-light neo-border text-white text-xs font-bold shadow-neo-sm">
              v0.3-BETA
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-3 font-bold neo-border transition-all
        ${isActive 
          ? "bg-brand text-white shadow-neo translate-x-1 translate-y-1" 
          : "bg-white text-neo-gray-800 hover:bg-neo-gray-100"}
      `}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function SectionHeader({ title, subtitle }: { title: string, subtitle?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">
        {title}
      </h2>
      {subtitle && <p className="text-neo-gray-800 font-bold italic">{subtitle}</p>}
    </div>
  );
}

function FleetOverview() {
  return (
    <div>
      <SectionHeader title="Fleet Overview" subtitle="System health and status across all servers." />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <ServerCard name="agent-workspace" status="active" events={12} issues={0} />
        <ServerCard name="lintel-prod-01" status="active" events={4} issues={2} />
        <ServerCard name="lintel-tools-01" status="active" events={8} issues={0} />
      </div>
    </div>
  );
}

function ServerCard({ name, status, events, issues }: { name: string, status: string, events: number, issues: number }) {
  return (
    <div className="neo-card neo-card-hover cursor-pointer group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-neo-gray-100 neo-border group-hover:bg-brand transition-colors group-hover:text-white">
          <Server size={32} />
        </div>
        <div className={`neo-badge ${status === "active" ? "bg-green-400" : "bg-neo-gray-400"}`}>
          {status}
        </div>
      </div>
      <h3 className="text-xl font-black mb-4 truncate uppercase tracking-tighter">{name}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neo-gray-100 p-2 neo-border">
          <div className="text-xs font-bold text-neo-gray-400 uppercase">Events (24h)</div>
          <div className="text-lg font-black">{events}</div>
        </div>
        <div className={`p-2 neo-border ${issues > 0 ? "bg-red-400" : "bg-neo-gray-100"}`}>
          <div className={`text-xs font-bold uppercase ${issues > 0 ? "text-white" : "text-neo-gray-400"}`}>Issues</div>
          <div className={`text-lg font-black ${issues > 0 ? "text-white" : ""}`}>{issues}</div>
        </div>
      </div>
    </div>
  );
}

function EventStream() {
  return (
    <div>
      <SectionHeader title="Event Stream" subtitle="Append-only log of all infrastructure events." />
      <div className="neo-card bg-neo-gray-100 flex flex-col gap-4">
        <EventRow category="deployment" summary="Deployed sum-platform v2.4.1 to lintel-prod-01" time="3h ago" principal="claude" />
        <EventRow category="config_change" summary="Updated Caddy config for api.lintel.digital" time="5h ago" principal="mark" />
        <EventRow category="service" summary="Restarted tailscaled on agent-workspace" time="12h ago" principal="ci_runner" />
      </div>
    </div>
  );
}

function EventRow({ category, summary, time, principal }: { category: string, summary: string, time: string, principal: string }) {
  return (
    <div className="bg-white neo-border p-4 flex gap-4 items-center">
      <div className="bg-brand text-white p-2 neo-border hidden sm:block">
        <ListRestart size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="neo-badge bg-blue-400">{category}</span>
          <span className="text-xs font-black text-neo-gray-400 italic uppercase">{time}</span>
        </div>
        <p className="font-bold text-neo-gray-800 truncate">{summary}</p>
      </div>
      <div className="px-3 py-1 bg-neo-gray-100 neo-border font-black text-xs uppercase italic">
        @{principal}
      </div>
    </div>
  );
}

function IssuesBoard() {
  return (
    <div>
      <SectionHeader title="Issues Board" subtitle="Active tickets and infrastructure problems." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="flex flex-col gap-4">
          <h4 className="text-lg font-black uppercase italic bg-white neo-border px-4 py-2">Open (2)</h4>
          <IssueCard title="Tailscale connection instability on WSL2" severity="high" server="agent-workspace" />
          <IssueCard title="Caddy failing to reload after config change" severity="critical" server="lintel-prod-01" />
        </div>
        <div className="flex flex-col gap-4 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
          <h4 className="text-lg font-black uppercase italic bg-white neo-border px-4 py-2">Resolved (0)</h4>
          <div className="neo-card border-dashed border-neo-gray-400 shadow-none text-center italic text-neo-gray-400">
            No resolved issues recently
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueCard({ title, severity, server }: { title: string, severity: string, server: string }) {
  const sevColor = severity === "critical" ? "bg-red-600 text-white" : severity === "high" ? "bg-orange-500 text-white" : "bg-yellow-400 text-neo-gray-950";
  return (
    <div className="neo-card neo-card-hover">
      <div className="flex items-center gap-2 mb-3">
        <span className={`neo-badge ${sevColor}`}>{severity}</span>
        <span className="text-xs font-bold text-neo-gray-400 uppercase italic">@{server}</span>
      </div>
      <h5 className="font-black text-lg leading-tight mb-2 tracking-tight">{title}</h5>
    </div>
  );
}

function IssueDetail() {
  return (
    <div>
      <SectionHeader title="Issue Detail" subtitle="Full timeline and root cause analysis." />
      <div className="neo-card bg-neo-gray-100 text-center py-20 italic font-bold">
        Detailed view coming soon
      </div>
    </div>
  );
}

function ServerDetail() {
  return (
    <div>
      <SectionHeader title="Server Detail" subtitle="Resource overview and local event history." />
      <div className="neo-card bg-neo-gray-100 text-center py-20 italic font-bold">
        Detailed view coming soon
      </div>
    </div>
  );
}

export default App;
