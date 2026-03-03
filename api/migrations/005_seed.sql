INSERT INTO servers (name, display_name, private_ipv4, status, notes)
VALUES
    ('agent-workspace', 'Agent Workspace', '10.44.0.2', 'active', 'Shared agent development host'),
    ('lintel-prod-01', 'Production', '10.44.0.3', 'active', 'Primary production VPS'),
    ('lintel-tools-01', 'Internal Tools 01', '10.44.0.4', 'active', 'OpsLog + Gitea + OpenBao host'),
    ('lintel-tools-02', 'Internal Tools 02', '10.44.0.5', 'active', 'Secondary internal tooling host')
ON CONFLICT (name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    private_ipv4 = EXCLUDED.private_ipv4,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes;

INSERT INTO server_aliases (server_id, alias_name)
SELECT s.id, 'coolify'
FROM servers s
WHERE s.name = 'lintel-tools-01'
ON CONFLICT (alias_name) DO NOTHING;

INSERT INTO principals (name, role, token_hash, status)
VALUES
    ('mark', 'admin', '58de3ee277756a4eef976cb7c39f0d4a9b4ab08f592cf0aa1070a445cfedeea5', 'active'),
    ('claude', 'writer', '1671e4b554fd6d1c7dddfc19884c8590424a0bd083b5153e77963b5fd8b01d1c', 'active'),
    ('codex_a', 'writer', '940a8382ed921730d7acc7a8800c854a572c0bc41d3796011ce74e6cc13ec062', 'active'),
    ('codex_b', 'writer', '8934095b9df600bdfafa8b3fda6b7d83e605929f2f6ca6f36fdb9fef47653bb0', 'active'),
    ('codex_c', 'writer', 'f92e348c72b3878dd0c3a2d3306d4b7b7d9fda2c2dd2f475ab9ebd9a905840af', 'active'),
    ('sum-cli', 'writer', '49b5bd179fc564eace5d38dd74cde9b1c015a587f3a426fa55f8e09a957ddacc', 'active'),
    ('ci_runner', 'writer', 'bcb8a83870703953f5b0c09fe95dd79ef473d4c400ba30000e73c6116a0f4356', 'active'),
    ('readonly', 'reader', 'd403e9099fff01c4af9ee7eb55fccecc5971d41e6c6ac730e4ec2467a9d2ad9f', 'active'),
    ('revoked_user', 'writer', '256e1e951c1a83a5f0d446e051872a2d3de93f77f25ac35e53c3368591095dbd', 'revoked')
ON CONFLICT (name) DO UPDATE
SET role = EXCLUDED.role,
    token_hash = EXCLUDED.token_hash,
    status = EXCLUDED.status;
