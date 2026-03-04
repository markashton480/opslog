CREATE INDEX IF NOT EXISTS idx_events_server_ingested
    ON events(server_id, ingested_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_events_server_occurred
    ON events(server_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_events_category
    ON events(category);

CREATE INDEX IF NOT EXISTS idx_events_principal
    ON events(principal);

CREATE INDEX IF NOT EXISTS idx_events_tags
    ON events USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_events_issue_id
    ON events(issue_id);

CREATE INDEX IF NOT EXISTS idx_events_corrects
    ON events(corrects_event_id)
    WHERE corrects_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_deploy
    ON events(server_id, occurred_at DESC)
    WHERE category = 'deployment';

CREATE INDEX IF NOT EXISTS idx_issues_server_status
    ON issues(server_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_issues_open
    ON issues(server_id, updated_at DESC)
    WHERE status IN ('open', 'investigating', 'watching');

CREATE INDEX IF NOT EXISTS idx_issues_severity
    ON issues(severity, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_issue_updates_timeline
    ON issue_updates(issue_id, occurred_at ASC, id ASC);
