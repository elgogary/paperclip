#!/bin/bash
# Pre-deploy verification script for Paperclip
# Run BEFORE every deploy: ./scripts/pre-deploy.sh
#
# Tests every split module + every service + every route
# Exit code: 0 = safe to deploy, 1 = DO NOT deploy

set -e
cd "$(dirname "$0")/.."

PASS=0
FAIL=0

run_test() {
  local label="$1"
  shift
  echo -n "  [$label] "
  local output
  output=$(npx vitest run "$@" 2>&1)
  if echo "$output" | grep -q "Tests.*passed" && ! echo "$output" | grep -q "Tests.*failed"; then
    local count
    count=$(echo "$output" | grep "Tests" | grep -o "[0-9]* passed" | head -1)
    echo "PASS ($count)"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    echo "$output" | grep -E "FAIL|error|Error" | head -3
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "  Paperclip Pre-Deploy Verification"
echo "========================================"
echo ""

# Step 1: TypeScript strict check (same as Docker build)
echo "[1/4] TypeScript strict compilation..."
if npx tsc -p server/tsconfig.json --noEmit 2>&1 | grep "error TS"; then
  echo "  FAIL: TypeScript errors. Fix before deploying."
  exit 1
fi
echo "  PASS: Zero TypeScript errors"
echo ""

# Step 2: Core wiring tests (split module integrity)
echo "[2/4] Split module wiring tests..."
run_test "smoke-33"    server/src/__tests__/pre-deploy-smoke.test.ts
run_test "heartbeat-wiring-19" server/src/__tests__/heartbeat-wiring.test.ts
echo ""

# Step 3: Service-level tests (every split service)
echo "[3/4] Service tests..."
run_test "portability-27"      server/src/__tests__/company-portability.test.ts
run_test "skills-12"           server/src/__tests__/company-skills.test.ts
run_test "heartbeat-session-21" server/src/__tests__/heartbeat-workspace-session.test.ts
run_test "heartbeat-summary-2" server/src/__tests__/heartbeat-run-summary.test.ts
run_test "issues-context-6"    server/src/__tests__/issues-user-context.test.ts
run_test "issues-mention-9"    server/src/__tests__/normalize-agent-mention-token.test.ts
run_test "workspace-13"        server/src/__tests__/workspace-runtime.test.ts
run_test "budgets-5"           server/src/__tests__/budgets-service.test.ts
run_test "approvals-5"         server/src/__tests__/approvals-service.test.ts
echo ""

# Step 4: Route-level tests (every split route)
echo "[4/4] Route tests..."
run_test "agent-skills-10"     server/src/__tests__/agent-skills-routes.test.ts
run_test "agent-instructions-8" server/src/__tests__/agent-instructions-routes.test.ts
run_test "agent-instructions-svc-5" server/src/__tests__/agent-instructions-service.test.ts
run_test "agent-permissions-3" server/src/__tests__/agent-permissions-routes.test.ts
run_test "cli-auth-5"          server/src/__tests__/cli-auth-routes.test.ts
run_test "attachments-71"      server/src/__tests__/attachments-routes.test.ts server/src/__tests__/attachment-context.test.ts server/src/__tests__/attachment-types.test.ts
run_test "adapters-16"         server/src/__tests__/adapter-models.test.ts server/src/__tests__/adapter-session-codecs.test.ts
run_test "auth-11"             server/src/__tests__/agent-auth-jwt.test.ts server/src/__tests__/board-mutation-guard.test.ts
run_test "skill-contract-2"    server/src/__tests__/agent-skill-contract.test.ts
run_test "approval-routes-2"   server/src/__tests__/approval-routes-idempotency.test.ts
echo ""

# Summary
TOTAL=$((PASS + FAIL))
echo "========================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL $TOTAL TEST GROUPS PASSED ($PASS/$TOTAL)"
  echo "  Safe to deploy"
else
  echo "  FAILED: $FAIL/$TOTAL test groups failed"
  echo "  DO NOT DEPLOY"
  exit 1
fi
echo "========================================"
echo ""
echo "Deploy commands:"
echo "  ssh eslam@65.109.65.159"
echo "  git fetch origin main-sanad-eoi-app"
echo "  git checkout -f origin/main-sanad-eoi-app -- ."
echo "  docker compose build server && docker compose up -d server"
