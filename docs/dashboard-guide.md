# OpsLog — Dashboard User Guide

The OpsLog Dashboard is a web interface for viewing infrastructure events,
tracking issues, and monitoring server health.

**URL:** <https://opslog.lintel.digital>

## Views

### Fleet Overview (`/`)

The landing page shows all registered servers as cards. Each card displays:

- **Server name** and display name
- **Environment** badge (production, staging, test, development)
- **Open issue count** — quickly see which servers need attention

Click any server card to navigate to its detail/briefing page.

### Event Stream (`/events`)

A reverse-chronological feed of all infrastructure events across the fleet.

**Columns:** Timestamp, Principal (who logged it), Server, Category, Summary

**Filters:**
- **Server** — scope to a single server
- **Category** — filter by event type (deployment, observation, etc.)
- **Time range** — custom date range picker

Events with corrections are visually linked. Pagination at the bottom handles
large result sets.

### Issues Board (`/issues`)

Tracks active and resolved infrastructure issues.

**Views:**
- **Board view** — Kanban-style columns grouped by status (Open, Investigating,
  Watching, Resolved)
- **Table view** — sortable table with all issue metadata

**Filters:**
- **Status** — filter by issue status
- **Severity** — filter by severity level
- **Server** — scope to a specific server

Click any issue to see its full detail.

### Issue Detail (`/issues/:id`)

Full view of a single issue including:

- **Metadata:** Title, severity, status, server, tags, timestamps
- **Root cause** (when identified)
- **Timeline:** Chronological list of all status changes and observations
- **Related issues** (caused by, related to, duplicate of)

### Server Detail (`/servers/:name`)

Briefing page for a single server showing:

- **Server info:** Name, environment, aliases, first/last seen timestamps
- **Recent events:** Last 10 events for this server
- **Open issues:** Active issues affecting this server

## Navigation

The sidebar (left panel) contains:

1. **Main navigation links:** Fleet Overview, Event Stream, Issues Board
2. **Server list:** Quick links to each registered server's detail page

On mobile, the sidebar is hidden behind a "Menu" button in the header.

## Authentication

The dashboard uses a pre-configured API token. If you see
"missing_authorization" errors, the `VITE_OPSLOG_TOKEN` environment variable
needs to be set during build/dev.
