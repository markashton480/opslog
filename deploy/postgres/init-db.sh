#!/bin/bash
set -e

# This script runs as part of postgres docker-entrypoint-initdb.d
# The default database and user are already created by POSTGRES_USER/POSTGRES_DB env vars.
# Add any additional roles or extensions here.

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Ensure uuid-ossp extension is available
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Create a read-only login role for infra monitoring/reporting.
    -- Note: application roles (opslog_app / opslog_read) are managed
    -- by API migrations (004_roles.sql). This role is for external
    -- monitoring tools that need direct DB access.
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opslog_readonly') THEN
            CREATE ROLE opslog_readonly LOGIN;
        END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO opslog_readonly;
    GRANT USAGE ON SCHEMA public TO opslog_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO opslog_readonly;
EOSQL
