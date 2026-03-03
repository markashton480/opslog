#!/usr/bin/env bash
# tests/smoke_test.sh — Load/smoke test for OpsLog API (M9.3)
#
# Generates N events and M issues, then verifies:
#   - Briefing endpoint responds in < 200ms with realistic volume
#   - Pagination handles large result sets
#
# Usage:
#   OPSLOG_API=http://localhost:8600 OPSLOG_TOKEN=opslog_codex_b_test \
#     OPSLOG_ADMIN_TOKEN=opslog_mark_test ./tests/smoke_test.sh
#
# Note: OPSLOG_ADMIN_TOKEN is required for server creation (PUT /servers requires admin role).
#       OPSLOG_TOKEN (writer) is used for events, issues, and queries.

set -euo pipefail

API="${OPSLOG_API:-http://localhost:8600}"
TOKEN="${OPSLOG_TOKEN:-opslog_codex_b_test}"
ADMIN_TOKEN="${OPSLOG_ADMIN_TOKEN:-opslog_mark_test}"
NUM_EVENTS="${NUM_EVENTS:-200}"
NUM_ISSUES="${NUM_ISSUES:-20}"
BRIEFING_MAX_MS="${BRIEFING_MAX_MS:-200}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0

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

auth_header="Authorization: Bearer ${TOKEN}"

echo "================================================="
echo " OpsLog Smoke / Load Test"
echo " API: ${API}"
echo " Events: ${NUM_EVENTS}, Issues: ${NUM_ISSUES}"
echo "================================================="
echo ""

# --- Health check ---
echo "1. Health check"
health=$(curl -sf "${API}/api/v1/health" 2>/dev/null || echo "FAIL")
if echo "$health" | grep -q '"ok"'; then
  check "API is healthy" 0
else
  check "API is healthy" 1
  echo "   Cannot proceed. Is the API running at ${API}?"
  exit 1
fi

# --- Ensure test server exists ---
echo ""
echo "2. Ensure smoke-test server"
admin_auth_header="Authorization: Bearer ${ADMIN_TOKEN}"
srv_rc=0
curl -sf -X PUT "${API}/api/v1/servers/smoke-test-server" \
  -H "Content-Type: application/json" \
  -H "$admin_auth_header" \
  -d '{"display_name":"Smoke Test Server","environment":"test"}' > /dev/null 2>&1 || srv_rc=$?
check "Server smoke-test-server created/updated" $srv_rc

# --- Generate events ---
echo ""
echo "3. Generating ${NUM_EVENTS} events..."
categories=("deployment" "observation" "config_change" "ci" "security" "service" "other")
ev_ok=0
ev_fail=0
for i in $(seq 1 "$NUM_EVENTS"); do
  cat="${categories[$((i % ${#categories[@]}))]}"
  resp=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${API}/api/v1/events" \
    -H "Content-Type: application/json" \
    -H "$auth_header" \
    -d "{\"server\":\"smoke-test-server\",\"category\":\"${cat}\",\"summary\":\"Smoke event ${i}\",\"tags\":[\"smoke\"],\"dedupe_key\":\"smoke-ev-${i}\"}" 2>/dev/null || echo "000")
  if [ "$resp" = "201" ] || [ "$resp" = "200" ]; then
    ev_ok=$((ev_ok + 1))
  else
    ev_fail=$((ev_fail + 1))
  fi
  # Progress indicator
  if [ $((i % 50)) -eq 0 ]; then
    echo "   ... ${i}/${NUM_EVENTS}"
  fi
done
echo "   Created: ${ev_ok}, Failed: ${ev_fail}"
check "All events created" $([[ $ev_fail -eq 0 ]] && echo 0 || echo 1)

# --- Generate issues ---
echo ""
echo "4. Generating ${NUM_ISSUES} issues..."
severities=("critical" "high" "medium" "low")
iss_ok=0
iss_fail=0
for i in $(seq 1 "$NUM_ISSUES"); do
  sev="${severities[$((i % ${#severities[@]}))]}"
  resp=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${API}/api/v1/issues" \
    -H "Content-Type: application/json" \
    -H "$auth_header" \
    -d "{\"title\":\"Smoke issue ${i}\",\"severity\":\"${sev}\",\"server\":\"smoke-test-server\",\"symptoms\":\"Automated smoke test\",\"tags\":[\"smoke\"]}" 2>/dev/null || echo "000")
  if [ "$resp" = "201" ]; then
    iss_ok=$((iss_ok + 1))
  else
    iss_fail=$((iss_fail + 1))
  fi
done
echo "   Created: ${iss_ok}, Failed: ${iss_fail}"
check "All issues created" $([[ $iss_fail -eq 0 ]] && echo 0 || echo 1)

# --- Briefing latency ---
echo ""
echo "5. Briefing endpoint latency (< ${BRIEFING_MAX_MS}ms)"
# Warm up (non-fatal — server may need a moment)
curl -sf "${API}/api/v1/servers/smoke-test-server/briefing" \
  -H "$auth_header" > /dev/null 2>&1 || true

# Measure 5 requests
total_ms=0
max_ms=0
for i in $(seq 1 5); do
  ms=$(curl -sf -o /dev/null -w "%{time_total}" "${API}/api/v1/servers/smoke-test-server/briefing" \
    -H "$auth_header" 2>/dev/null || echo "9.999")
  ms_int=$(python3 -c "print(int(float('$ms') * 1000))")
  total_ms=$((total_ms + ms_int))
  if [ "$ms_int" -gt "$max_ms" ]; then
    max_ms=$ms_int
  fi
done
avg_ms=$((total_ms / 5))
echo "   Average: ${avg_ms}ms, Max: ${max_ms}ms"
check "Avg briefing < ${BRIEFING_MAX_MS}ms" $([[ $avg_ms -lt $BRIEFING_MAX_MS ]] && echo 0 || echo 1)
check "Max briefing < $((BRIEFING_MAX_MS * 2))ms" $([[ $max_ms -lt $((BRIEFING_MAX_MS * 2)) ]] && echo 0 || echo 1)

# --- Pagination ---
echo ""
echo "6. Pagination tests"
# Use a smaller page size to guarantee multiple pages
page1=$(curl -sf "${API}/api/v1/events?server=smoke-test-server&limit=10" \
  -H "$auth_header" 2>/dev/null)
count1=$(echo "$page1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo 0)
check "First page returns 10 events" $([[ "$count1" -eq 10 ]] && echo 0 || echo 1)

# Check pagination metadata exists
has_meta=$(echo "$page1" | python3 -c "import sys,json; d=json.load(sys.stdin); print('has_more' in d or 'next_cursor' in d)" 2>/dev/null || echo "False")
check "Pagination metadata present" $([[ "$has_meta" = "True" ]] && echo 0 || echo 1)

# Fetch page 2 using cursor
next_cursor=$(echo "$page1" | python3 -c "import sys,json; d=json.load(sys.stdin); c=d.get('next_cursor',''); print(c if c else '')" 2>/dev/null || echo "")
if [ -n "$next_cursor" ]; then
  page2=$(curl -sf "${API}/api/v1/events?server=smoke-test-server&limit=10&cursor=${next_cursor}" \
    -H "$auth_header" 2>/dev/null)
  count2=$(echo "$page2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo 0)
  check "Second page returns events" $([[ "$count2" -gt 0 ]] && echo 0 || echo 1)
else
  check "Second page returns events (no cursor)" 1
fi

# --- Issues listing ---
echo ""
echo "7. Issues listing"
issues=$(curl -sf "${API}/api/v1/issues?server=smoke-test-server" \
  -H "$auth_header" 2>/dev/null)
iss_count=$(echo "$issues" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo 0)
check "Issues listing returns data" $([[ "$iss_count" -gt 0 ]] && echo 0 || echo 1)

# --- Summary ---
echo ""
echo "================================================="
echo -e " Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "================================================="

if [ "$fail" -gt 0 ]; then
  exit 1
fi
