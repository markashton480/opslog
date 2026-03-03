#!/usr/bin/env bash
# tests/agent_dryrun.sh — Simulates an agent session against OpsLog API (M9.4)
#
# Walks through the full agent workflow:
#   1. Get server briefing
#   2. Log observation events
#   3. Report an issue
#   4. Update the issue (add observation, change status)
#   5. Resolve the issue
#   6. Verify the full loop via briefing
#
# Usage:
#   OPSLOG_API=http://localhost:8600 OPSLOG_TOKEN=opslog_codex_b_test ./tests/agent_dryrun.sh
#   OPSLOG_API=https://opslog.lintel.digital OPSLOG_TOKEN=<token> ./tests/agent_dryrun.sh

set -euo pipefail

API="${OPSLOG_API:-http://localhost:8600}"
TOKEN="${OPSLOG_TOKEN:-opslog_codex_b_test}"
SERVER="agent-workspace"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

auth_header="Authorization: Bearer ${TOKEN}"
pass=0
fail=0

step() { echo -e "\n${BOLD}${CYAN}▸ $1${NC}"; }
check() {
  local desc="$1" result="$2"
  if [ "$result" = "0" ]; then
    echo -e "  ${GREEN}✓${NC} $desc"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} $desc"
    fail=$((fail + 1))
  fi
}

api_get()  { curl -sf "${API}/api/v1$1" -H "$auth_header"; }
api_post() { curl -sf -X POST "${API}/api/v1$1" -H "Content-Type: application/json" -H "$auth_header" -d "$2"; }
api_patch(){ curl -sf -X PATCH "${API}/api/v1$1" -H "Content-Type: application/json" -H "$auth_header" -d "$2"; }

echo "================================================="
echo " OpsLog Agent Dry-Run"
echo " API:    ${API}"
echo " Server: ${SERVER}"
echo " Agent:  codex_b (simulated)"
echo "================================================="

# -------------------------------------------------------
step "1. Get server briefing"
briefing=$(api_get "/servers/${SERVER}/briefing")
srv_name=$(echo "$briefing" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['server']['name'])")
check "Briefing returned for ${srv_name}" $([[ "$srv_name" = "$SERVER" ]] && echo 0 || echo 1)
ev_count=$(echo "$briefing" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['recent_events']))")
iss_count=$(echo "$briefing" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['open_issues']))")
echo "   Recent events: ${ev_count}, Open issues: ${iss_count}"

# -------------------------------------------------------
step "2. Log deployment event"
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
ev_resp=$(api_post "/events" "{
  \"server\": \"${SERVER}\",
  \"category\": \"deployment\",
  \"summary\": \"Agent dry-run: deployed v99.0.0 at ${ts}\",
  \"tags\": [\"dryrun\", \"release\"],
  \"metadata\": {\"ref\": \"v99.0.0\", \"agent\": \"codex_b\"},
  \"dedupe_key\": \"dryrun-deploy-${ts}\"
}")
ev_id=$(echo "$ev_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
check "Event created: ${ev_id}" $([[ -n "$ev_id" ]] && echo 0 || echo 1)

# -------------------------------------------------------
step "3. Log observation event"
obs_resp=$(api_post "/events" "{
  \"server\": \"${SERVER}\",
  \"category\": \"observation\",
  \"summary\": \"Agent dry-run: noticed high latency after deploy\",
  \"tags\": [\"dryrun\", \"latency\"]
}")
obs_id=$(echo "$obs_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
check "Observation event created: ${obs_id}" $([[ -n "$obs_id" ]] && echo 0 || echo 1)

# -------------------------------------------------------
step "4. Report an issue"
iss_resp=$(api_post "/issues" "{
  \"title\": \"Agent dry-run: High latency after v99 deploy\",
  \"severity\": \"high\",
  \"server\": \"${SERVER}\",
  \"symptoms\": \"P99 latency > 500ms on all endpoints\",
  \"tags\": [\"dryrun\", \"latency\"]
}")
iss_id=$(echo "$iss_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
iss_ver=$(echo "$iss_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
check "Issue created: ${iss_id} (version ${iss_ver})" $([[ -n "$iss_id" && -n "$iss_ver" ]] && echo 0 || echo 1)

# -------------------------------------------------------
step "5. Begin investigation — transition to investigating"
inv_resp=$(api_patch "/issues/${iss_id}" "{\"version\": ${iss_ver}, \"status\": \"investigating\"}")
iss_ver=$(echo "$inv_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
status=$(echo "$inv_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
check "Issue status: ${status}" $([[ "$status" = "investigating" ]] && echo 0 || echo 1)

# -------------------------------------------------------
step "6. Add observation to issue"
obs_result=$(api_post "/issues/${iss_id}/updates" "{
  \"content\": \"Agent dry-run: Traced to connection pool exhaustion. Pool size was not updated for v99.\"
}")
# Observation may bump the issue version; re-read the issue to get the latest
issue_now=$(api_get "/issues/${iss_id}")
iss_ver=$(echo "$issue_now" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['issue']['version'])")
check "Observation added to issue" 0

# -------------------------------------------------------
step "7. Set root cause and move to watching"
watch_resp=$(api_patch "/issues/${iss_id}" "{
  \"version\": ${iss_ver},
  \"status\": \"watching\",
  \"root_cause\": \"Connection pool size mismatch after v99 deploy\"
}")
iss_ver=$(echo "$watch_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])")
status=$(echo "$watch_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
check "Issue status: ${status}" $([[ "$status" = "watching" ]] && echo 0 || echo 1)

# -------------------------------------------------------
step "8. Log fix deployment"
fix_resp=$(api_post "/events" "{
  \"server\": \"${SERVER}\",
  \"category\": \"deployment\",
  \"summary\": \"Agent dry-run: deployed v99.0.1 hotfix\",
  \"tags\": [\"dryrun\", \"hotfix\"],
  \"metadata\": {\"ref\": \"v99.0.1\"}
}")
check "Fix deployment event logged" 0

# -------------------------------------------------------
step "9. Resolve issue"
res_resp=$(api_patch "/issues/${iss_id}" "{\"version\": ${iss_ver}, \"status\": \"resolved\"}")
status=$(echo "$res_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
resolved_at=$(echo "$res_resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['resolved_at'])")
check "Issue resolved at ${resolved_at}" $([[ "$status" = "resolved" ]] && echo 0 || echo 1)

# -------------------------------------------------------
step "10. Verify final briefing"
final=$(api_get "/servers/${SERVER}/briefing")
final_ev=$(echo "$final" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['recent_events']))")
check "Briefing shows recent events (${final_ev})" $([[ "$final_ev" -gt 0 ]] && echo 0 || echo 1)

# The resolved issue should NOT appear in open_issues
open_ids=$(echo "$final" | python3 -c "
import sys, json
ids = [i['id'] for i in json.load(sys.stdin)['data']['open_issues']]
print(' '.join(ids))
")
if echo "$open_ids" | grep -q "$iss_id"; then
  check "Resolved issue absent from open issues" 1
else
  check "Resolved issue absent from open issues" 0
fi

# -------------------------------------------------------
echo ""
echo "================================================="
echo -e " Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "================================================="

if [ "$fail" -gt 0 ]; then
  exit 1
fi
