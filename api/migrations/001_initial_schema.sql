CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS principals (
    name TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'writer', 'reader')),
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    private_ipv4 INET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'decommissioned')),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS server_aliases (
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (server_id, alias_name)
);

CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'watching', 'resolved', 'wontfix')),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    server_id UUID NULL REFERENCES servers(id),
    server_name TEXT NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symptoms TEXT NULL,
    root_cause TEXT NULL,
    solution TEXT NULL,
    created_by TEXT NOT NULL REFERENCES principals(name),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    dedupe_key TEXT NULL,
    CHECK (char_length(title) <= 512),
    CHECK (jsonb_typeof(metadata) = 'object'),
    CHECK (last_occurrence >= first_seen),
    CHECK ((status IN ('resolved', 'wontfix')) = (resolved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    principal TEXT NOT NULL REFERENCES principals(name),
    reported_agent TEXT NULL,
    server_id UUID NULL REFERENCES servers(id),
    server_name TEXT NULL,
    category TEXT NOT NULL CHECK (category IN ('deployment', 'config_change', 'dns', 'service', 'security', 'backup', 'network', 'account', 'infra', 'ci', 'observation', 'other')),
    summary TEXT NOT NULL,
    detail TEXT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    issue_id UUID NULL REFERENCES issues(id),
    corrects_event_id UUID NULL REFERENCES events(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    dedupe_key TEXT NULL,
    CHECK (char_length(summary) <= 1024),
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS issue_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    principal TEXT NOT NULL REFERENCES principals(name),
    content TEXT NOT NULL,
    status_from TEXT NULL,
    status_to TEXT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (jsonb_typeof(changes) = 'object')
);

CREATE TABLE IF NOT EXISTS related_issues (
    src_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    dst_issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK (relationship IN ('related', 'caused_by', 'duplicate_of')),
    PRIMARY KEY (src_issue_id, dst_issue_id, relationship),
    CHECK (src_issue_id <> dst_issue_id),
    CHECK (relationship <> 'related' OR src_issue_id < dst_issue_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_issues_dedupe_key
    ON issues(created_by, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_dedupe_key
    ON events(principal, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_related_issues_duplicate
    ON related_issues(src_issue_id)
    WHERE relationship = 'duplicate_of';
