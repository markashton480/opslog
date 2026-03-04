CREATE OR REPLACE FUNCTION prevent_events_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'events are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_events_immutable ON events;
CREATE TRIGGER trg_events_immutable
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW
EXECUTE FUNCTION prevent_events_mutation();

CREATE OR REPLACE FUNCTION prevent_issue_updates_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'issue_updates are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_issue_updates_immutable ON issue_updates;
CREATE TRIGGER trg_issue_updates_immutable
BEFORE UPDATE OR DELETE ON issue_updates
FOR EACH ROW
EXECUTE FUNCTION prevent_issue_updates_mutation();

CREATE OR REPLACE FUNCTION set_updated_at_now()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_servers_updated_at ON servers;
CREATE TRIGGER trg_servers_updated_at
BEFORE UPDATE ON servers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_now();

DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
CREATE TRIGGER trg_issues_updated_at
BEFORE UPDATE ON issues
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_now();

CREATE OR REPLACE FUNCTION bump_issue_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issues_version_bump ON issues;
CREATE TRIGGER trg_issues_version_bump
BEFORE UPDATE ON issues
FOR EACH ROW
EXECUTE FUNCTION bump_issue_version();
