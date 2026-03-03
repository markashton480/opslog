# OpsLog — Operations Runbook

## Deployment (lintel-tools-02)

### First-time setup

```bash
# 1. Clone repo and enter directory
git clone git@github.com:markashton480/opslog.git /opt/opslog
cd /opt/opslog

# 2. Create .env from template
cp .env.example .env
# Edit .env — at minimum set POSTGRES_PASSWORD to a strong value
$EDITOR .env

# 3. Build and start
make build
make up

# 4. Generate auth tokens for principals
make tokens

# 5. Install systemd service
sudo cp deploy/opslog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opslog

# 6. Configure host Caddy (TLS termination)
# Merge deploy/Caddyfile into the host's main Caddy config:
#   opslog.lintel.digital {
#       reverse_proxy localhost:8601
#   }
sudo systemctl reload caddy
```

### Verify deployment

```bash
# Health check
curl -s http://localhost:8601/api/v1/health | jq .

# Dashboard
curl -s -o /dev/null -w "%{http_code}" http://localhost:8601/

# External (after Caddy TLS)
curl -s https://opslog.lintel.digital/api/v1/health | jq .
```

---

## Principal management

### Generate tokens for all principals

```bash
make tokens
# Tokens are printed to stdout — store securely
```

### Add a new principal

The recommended approach is to use `make tokens` which handles hashing.
For manual insertion, use pgcrypto's `digest()` function:

```sql
-- Connect to the database
make psql

-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add the principal (hash must match API's hex-encoded SHA-256)
INSERT INTO principals (name, role, token_hash, status)
VALUES ('new_agent', 'writer', encode(digest('YOUR_TOKEN_HERE', 'sha256'), 'hex'), 'active');
```

2. Distribute the token to the principal securely.

### Rotate a token

```sql
make psql

-- Update the token hash
UPDATE principals
SET token_hash = encode(digest('NEW_TOKEN_HERE', 'sha256'), 'hex')
WHERE name = 'the_principal';
```

---

## Server management

### Add a new server

```sql
make psql

INSERT INTO servers (name, display_name, private_ipv4, status, notes)
VALUES (
    'my-server-01',
    'My Server 01',
    '10.44.0.10',
    'active',
    'Added via runbook'
);
```

---

## Maintenance

### View logs

```bash
# API container logs
make logs

# All services
docker compose logs -f

# Via systemd/journald
journalctl -u opslog -f
```

### Database backup

```bash
docker compose exec postgres pg_dump -U opslog -d opslog > backup_$(date +%Y%m%d).sql
```

### Database restore

```bash
cat backup_20260301.sql | docker compose exec -T postgres psql -U opslog -d opslog
```

### Run migrations manually

```bash
make migrate
```

### Restart services

```bash
# Via systemd
sudo systemctl restart opslog

# Or directly
docker compose restart
```

### Update deployment

```bash
cd /opt/opslog
git pull origin main
make build
make up
# Or via systemd:
sudo systemctl reload opslog
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| API 500 errors | `make logs` — look for Python tracebacks |
| Dashboard blank page | Check browser console; verify `VITE_OPSLOG_API_URL` |
| DB connection refused | `docker compose ps` — is postgres healthy? |
| Migrations fail | Check `make logs` for migration errors at startup |
| 401 Unauthorized | Verify token is correct and principal status is `active` |
