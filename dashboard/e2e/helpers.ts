/**
 * Shared helpers for Playwright E2E tests.
 * Seeds test data via the API before running dashboard tests.
 */

const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8601";
const TOKEN = process.env.PLAYWRIGHT_API_TOKEN || "opslog_codex_b_test";
const ADMIN_TOKEN = process.env.PLAYWRIGHT_ADMIN_TOKEN || "opslog_mark_test";

interface SeedResult {
  servers: string[];
  eventIds: string[];
  issueIds: string[];
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  // 200 = deduplicated (existing record returned), 201 = created
  if (!res.ok && res.status !== 200) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function apiPut(path: string, body: Record<string, unknown>, token?: string) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function apiPatch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Seeds the database with realistic test data for E2E tests.
 * Assumes the stack is running with seed data already applied.
 * Adds extra events and issues for rich test scenarios.
 */
export async function seedTestData(): Promise<SeedResult> {
  const eventIds: string[] = [];
  const issueIds: string[] = [];

  // Ensure servers exist (seed has agent-workspace and lintel-prod-01)
  // Server creation requires admin role
  await apiPut("/servers/e2e-test-server", {
    display_name: "E2E Test Server",
    environment: "test",
  }, ADMIN_TOKEN);

  // Create events across servers and categories (dedupe_key for idempotent re-runs)
  const events = [
    { server: "agent-workspace", category: "deployment", summary: "E2E: Deployed v4.0.0", tags: ["e2e", "release"], dedupe_key: "e2e-deploy-v4" },
    { server: "agent-workspace", category: "observation", summary: "E2E: High CPU usage observed", tags: ["e2e", "cpu"], dedupe_key: "e2e-cpu-obs" },
    { server: "agent-workspace", category: "ci", summary: "E2E: CI pipeline passed", tags: ["e2e", "ci"], metadata: { run_id: 999 }, dedupe_key: "e2e-ci-pass" },
    { server: "e2e-test-server", category: "config_change", summary: "E2E: Updated nginx config", tags: ["e2e", "nginx"], dedupe_key: "e2e-nginx-cfg" },
    { server: "e2e-test-server", category: "security", summary: "E2E: SSL cert renewed", tags: ["e2e", "ssl"], dedupe_key: "e2e-ssl-renew" },
  ];

  for (const ev of events) {
    const r = await apiPost("/events", ev);
    eventIds.push(r.data.id);
  }

  // Create issues at different severities and statuses (dedupe_key for idempotent re-runs)
  const issue1 = await apiPost("/issues", {
    title: "E2E: Memory leak in API",
    severity: "critical",
    server: "agent-workspace",
    symptoms: "RSS grows unbounded",
    tags: ["e2e", "memory"],
    dedupe_key: "e2e-memory-leak",
  });
  issueIds.push(issue1.data.id);

  // Move to investigating
  const patched1 = await apiPatch(`/issues/${issue1.data.id}`, {
    version: issue1.data.version,
    status: "investigating",
  });

  const issue2 = await apiPost("/issues", {
    title: "E2E: Disk space low on test server",
    severity: "medium",
    server: "e2e-test-server",
    symptoms: "Disk at 90%",
    tags: ["e2e", "disk"],
    dedupe_key: "e2e-disk-low",
  });
  issueIds.push(issue2.data.id);

  const issue3 = await apiPost("/issues", {
    title: "E2E: Resolved cert issue",
    severity: "low",
    server: "e2e-test-server",
    symptoms: "Cert expired",
    tags: ["e2e"],
    dedupe_key: "e2e-cert-resolved",
  });
  issueIds.push(issue3.data.id);

  // Move issue3 through to resolved
  const inv3 = await apiPatch(`/issues/${issue3.data.id}`, {
    version: issue3.data.version,
    status: "investigating",
  });
  const watch3 = await apiPatch(`/issues/${issue3.data.id}`, {
    version: inv3.data.version,
    status: "watching",
  });
  await apiPatch(`/issues/${issue3.data.id}`, {
    version: watch3.data.version,
    status: "resolved",
  });

  // Add an observation to issue1
  await apiPost(`/issues/${issue1.data.id}/updates`, {
    content: "E2E: Observed memory spike after deploy",
  });

  return {
    servers: ["agent-workspace", "e2e-test-server"],
    eventIds,
    issueIds,
  };
}

export { API_URL, TOKEN, ADMIN_TOKEN };
