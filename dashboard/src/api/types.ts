export type EventCategory =
  | "deployment"
  | "config_change"
  | "dns"
  | "service"
  | "security"
  | "backup"
  | "network"
  | "account"
  | "infra"
  | "ci"
  | "observation"
  | "other";

export type IssueStatus =
  | "open"
  | "investigating"
  | "watching"
  | "resolved"
  | "wontfix";

export type Severity = "critical" | "high" | "medium" | "low";

export interface ApiResponse<T> {
  data: T;
  warnings: string[];
}

export interface ApiListResponse<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
  limit?: number;
  warnings: string[];
}

export interface Health {
  status: string;
  version: string;
  db: string;
  uptime_seconds: number;
}

export interface Event {
  id: string;
  occurred_at: string;
  ingested_at: string;
  principal: string;
  reported_agent: string | null;
  server_id: string | null;
  server_name: string | null;
  category: EventCategory;
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
  status: IssueStatus;
  severity: Severity;
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

export interface IssueUpdate {
  id: string;
  issue_id: string;
  occurred_at: string;
  ingested_at: string;
  principal: string;
  content: string;
  status_from: IssueStatus | null;
  status_to: IssueStatus | null;
  changes: Record<string, unknown>;
}

export interface RelatedIssue {
  related_issue_id: string;
  relationship: "related" | "caused_by" | "duplicate_of";
  issue: Issue;
}

export interface IssueDetail {
  issue: Issue;
  updates: IssueUpdate[];
  related_issues: RelatedIssue[];
}

export interface Server {
  id: string;
  name: string;
  display_name: string;
  private_ipv4: string | null;
  status: "active" | "decommissioned";
  notes: string | null;
  created_at: string;
  updated_at: string;
  aliases: string[];
}

export interface BriefingSummary {
  events_last_24h: number;
  events_last_7d: number;
  open_issue_count: number;
  last_deployment: string | null;
}

export interface Briefing {
  server: Server;
  recent_events: Event[];
  open_issues: Issue[];
  summary: BriefingSummary;
}

export interface CategoryItem {
  name: EventCategory;
  description: string;
}

export interface CategoriesPayload {
  categories: CategoryItem[];
}
