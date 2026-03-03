import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-800">OpsLog Dashboard</h1>
        </header>
        <main className="p-6">
          <Routes>
            <Route path="/" element={<FleetOverview />} />
            <Route path="/events" element={<EventStream />} />
            <Route path="/issues" element={<IssuesBoard />} />
            <Route path="/issues/:id" element={<IssueDetail />} />
            <Route path="/servers/:name" element={<ServerDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function FleetOverview() {
  return <div className="text-slate-600">Fleet Overview - Loading...</div>;
}

function EventStream() {
  return <div className="text-slate-600">Event Stream - Loading...</div>;
}

function IssuesBoard() {
  return <div className="text-slate-600">Issues Board - Loading...</div>;
}

function IssueDetail() {
  return <div className="text-slate-600">Issue Detail - Loading...</div>;
}

function ServerDetail() {
  return <div className="text-slate-600">Server Detail - Loading...</div>;
}

export default App;
