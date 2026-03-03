// API types - to be generated from API schema
export interface Event {
  id: string;
  occurred_at: string;
  ingested_at: string;
  principal: string;
  reported_agent: string | null;
  server_id: string | null;
  server_name: string | null;
  category: string;
  summary: string;
  detail: string | null;
  tags: string[];
  issue_id: string | null;
  corrects_event_id: string | null;
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
}

export interface Issue {
  id: string;
  title: string;
  status: string;
  severity: string;
  server_id: string | null;
  server_name: string | null;
  first_seen: string;
  last_occurrence: string;
  symptoms: string | null;
  root_cause: string | null;
  solution: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
}

export interface Server {
  id: string;
  name: string;
  display_name: string;
  private_ipv4: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Briefing {
  server: Server;
  recent_events: Event[];
  open_issues: Issue[];
  summary: {
    events_last_24h: number;
    events_last_7d: number;
    open_issue_count: number;
    last_deployment: string | null;
  };
}
