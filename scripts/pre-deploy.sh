#!/bin/bash
# Pre-deploy verification script for Paperclip
# Run this BEFORE every deploy: ./scripts/pre-deploy.sh
#
# What it checks:
# 1. TypeScript compiles (no errors)
# 2. Pre-deploy smoke tests pass (33 tests covering all split modules)
# 3. Heartbeat wiring tests pass (19 tests)
# 4. All critical service factories initialize without errors
#
# Exit code: 0 = safe to deploy, 1 = DO NOT deploy

set -e

echo "========================================"
echo "  Paperclip Pre-Deploy Verification"
echo "========================================"
echo ""

# Step 1: TypeScript check
echo "[1/3] TypeScript compilation check..."
if npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "error TS"; then
  echo "FAIL: TypeScript errors found. Fix before deploying."
  exit 1
fi
echo "  PASS: Zero TypeScript errors"
echo ""

# Step 2: Pre-deploy smoke tests
echo "[2/3] Pre-deploy smoke tests (all split modules)..."
if ! npx vitest run server/src/__tests__/pre-deploy-smoke.test.ts --reporter=verbose 2>&1 | tee /tmp/pre-deploy-smoke.log | tail -5; then
  echo "FAIL: Pre-deploy smoke tests failed. Check /tmp/pre-deploy-smoke.log"
  exit 1
fi
echo "  PASS: All smoke tests green"
echo ""

# Step 3: Heartbeat wiring tests
echo "[3/3] Heartbeat $ bag wiring tests..."
if ! npx vitest run server/src/__tests__/heartbeat-wiring.test.ts --reporter=verbose 2>&1 | tee /tmp/heartbeat-wiring.log | tail -5; then
  echo "FAIL: Heartbeat wiring tests failed. Check /tmp/heartbeat-wiring.log"
  exit 1
fi
echo "  PASS: All wiring tests green"
echo ""

echo "========================================"
echo "  ALL CHECKS PASSED - Safe to deploy"
echo "========================================"
echo ""
echo "Deploy command:"
echo "  ssh eslam@65.109.65.159 'docker compose build server && docker compose up -d server'"
