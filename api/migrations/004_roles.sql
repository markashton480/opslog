DO $$
BEGIN
    CREATE ROLE opslog_app;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END;
$$;

DO $$
BEGIN
    CREATE ROLE opslog_read;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END;
$$;

GRANT USAGE ON SCHEMA public TO opslog_app, opslog_read;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO opslog_app, opslog_read;
GRANT INSERT ON events, issue_updates TO opslog_app;
GRANT INSERT, UPDATE ON issues, servers, server_aliases, principals TO opslog_app;
