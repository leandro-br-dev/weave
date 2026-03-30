#!/bin/bash

###############################################################################
# Workflow Test: Structured Output Race Condition
# Description: Verifies the race condition between plan completion and
#              structured output saving. Demonstrates the issue where the
#              frontend may not see structured_output immediately after
#              plan completion due to asynchronous operations.
#
# Location: tests/scripts/workflow/
# Category: Automated Workflow Test
#
# Prerequisites:
#   - API server running on http://localhost:3000
#   - Valid test token configured
#
# Usage:
#   ./tests/scripts/workflow/test-structured-output-race-condition.sh
#
# Tests:
#   1. Plan completes BEFORE structured output is saved
#   2. Structured output saved BEFORE plan completion
#   3. Structured output included IN completion request (recommended)
###############################################################################

set -e

BASE_URL="http://localhost:3000"
TOKEN="test-token"  # Using test token from mocked auth

echo "=========================================="
echo "Structured Output Race Condition Test"
echo "=========================================="
echo ""

# Step 1: Create a plan
echo "1. Creating a test plan..."
PLAN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Improvement Plan",
    "tasks": [
      {
        "id": "task-1",
        "name": "Improvement Task",
        "prompt": "Test improvement task",
        "cwd": "/root/projects/weave",
        "workspace": "/root/projects/weave"
      }
    ]
  }')

PLAN_ID=$(echo "$PLAN_RESPONSE" | jq -r '.data.id')
echo "   Created plan: $PLAN_ID"
echo ""

# Step 2: Start the plan
echo "2. Starting the plan..."
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "test-client"}' > /dev/null
echo "   Plan started"
echo ""

# Step 3: Simulate the race condition - Test 1
echo "3. TEST 1: Complete plan BEFORE structured output is saved"
echo "   This simulates the daemon completing before agent saves structured output"

# Complete the plan first
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "result": "Plan completed successfully"
  }' > /dev/null

# Check plan status immediately after completion
PLAN_STATUS=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.status')

echo "   Plan status after completion: $PLAN_STATUS"

# Check if structured_output exists
STRUCTURED_OUTPUT=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.structured_output')

echo "   Structured output immediately after completion: $STRUCTURED_OUTPUT"

if [ "$STRUCTURED_OUTPUT" = "null" ]; then
  echo "   ❌ RACE CONDITION DETECTED: Plan is success but no structured_output!"
else
  echo "   ✓ No race condition in this case"
fi

# Now save structured output
echo ""
echo "   Saving structured output after completion..."
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/structured-output" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "output": {
      "improvedContent": "# Improved CLAUDE.md\n\nThis is the improved content."
    }
  }' > /dev/null

# Check again
STRUCTURED_OUTPUT_AFTER=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.structured_output')

echo "   Structured output after saving: $STRUCTURED_OUTPUT_AFTER"
echo ""

# Reset for Test 2
echo "4. Resetting plan for TEST 2..."
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/execute" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "test-client"}' > /dev/null
echo ""

# Step 5: Test 2 - Save structured output BEFORE completion
echo "5. TEST 2: Save structured output BEFORE plan completion"

# Save structured output first
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/structured-output" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "output": {
      "improvedContent": "# Improved CLAUDE.md\n\nThis is the improved content."
    }
  }' > /dev/null

echo "   Structured output saved before completion"

# Now complete the plan
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "result": "Plan completed successfully"
  }' > /dev/null

# Check plan status and structured output
PLAN_STATUS=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.status')

STRUCTURED_OUTPUT=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.structured_output')

echo "   Plan status: $PLAN_STATUS"
echo "   Structured output: $STRUCTURED_OUTPUT"

if [ "$STRUCTURED_OUTPUT" != "null" ]; then
  echo "   ✓ Both status and structured_output are available"
else
  echo "   ❌ Structured output was lost during completion!"
fi
echo ""

# Step 6: Test 3 - Include structured output in completion request
echo "6. TEST 3: Include structured output IN completion request (recommended fix)"

# Reset plan
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/execute" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "test-client"}' > /dev/null

# Complete with structured output included
curl -s -X POST "$BASE_URL/api/plans/$PLAN_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "result": "Plan completed successfully",
    "structured_output": {
      "improvedContent": "# Improved CLAUDE.md\n\nThis is the improved content."
    }
  }' > /dev/null

# Check both fields
PLAN_STATUS=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.status')

STRUCTURED_OUTPUT=$(curl -s "$BASE_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.structured_output.improvedContent')

echo "   Plan status: $PLAN_STATUS"
echo "   Structured output available: $STRUCTURED_OUTPUT"

if [ "$STRUCTURED_OUTPUT" != "null" ] && [ "$PLAN_STATUS" = "success" ]; then
  echo "   ✓ SUCCESS: Both available atomically - NO RACE CONDITION"
else
  echo "   ❌ Failed to include structured output in completion"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "The tests demonstrate that:"
echo "1. When plan completes BEFORE structured output is saved → Race condition"
echo "2. When structured output is saved BEFORE completion → Works but not atomic"
echo "3. When structured output is included IN completion request → Atomic, no race condition"
echo ""
echo "RECOMMENDED FIX: Always include structured_output in the /complete request"
echo "=========================================="