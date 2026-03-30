#!/bin/bash

###############################################################################
# LEGACY TEST SCRIPT: Comprehensive Improvement Workflow (Superseded)
# Description: This script tested the entire improvement workflow from backend
#              to frontend, including API endpoints, database operations,
#              frontend polling, and user interactions.
#
# Status: LEGACY - Superseded by test-improvement-comprehensive.sh
# Location: tests/scripts/legacy/
# Archive Date: 2026-03-19
#
# Reason for Legacy Status:
#   - Functionality merged into test-improvement-comprehensive.sh
#   - New comprehensive test includes all features from this test plus:
#     * Better API health checking
#     * Improved workspace selection logic (prioritizes planner workspaces)
#     * More robust error handling and validation
#     * Better structured output verification
#     * Enhanced logging and reporting
#     * Cleaner code structure and maintainability
#
# Current Replacement:
#   - Use: tests/scripts/e2e/test-improvement-comprehensive.sh
#   - Provides: Complete coverage of this test plus improved reliability
#
# Original Location: tests/scripts/e2e/
# Original Category: End-to-End Test
#
# Usage (for reference only):
#   ./tests/scripts/legacy/test-improvement-end-to-end.sh
#
# Original Prerequisites:
#   - API server running on http://localhost:3000
#   - Dashboard running on http://localhost:5173
#   - Valid API token configured in api/.env
#   - At least one workspace available
#
# Environment Variables:
#   API_URL - API endpoint (default: http://localhost:3000)
#   API_BEARER_TOKEN - Authentication token
#
# Original Test Coverage:
#   - Backend API endpoints
#   - Workspace and agent creation
#   - Improvement plan creation and execution
#   - Structured output submission and retrieval
#   - Frontend polling compatibility
#   - Edge cases (empty content, long content, invalid IDs)
#
# Retention Policy: 6 months (until 2026-09-19)
###############################################################################

set -e

echo "========================================"
echo "Improvement Workflow E2E Test"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to run tests
run_test() {
    local test_name="$1"
    local test_command="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "

    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Get API token from .env (supports both API_BEARER_TOKEN and WEAVE_TOKEN)
API_TOKEN=$(grep API_BEARER_TOKEN /root/projects/weave/api/.env | cut -d '=' -f2)
if [ -z "$API_TOKEN" ]; then
    API_TOKEN=$(grep WEAVE_TOKEN /root/projects/weave/api/.env | cut -d '=' -f2)
fi
if [ -z "$API_TOKEN" ]; then
    echo -e "${RED}ERROR: No API token found in .env${NC}"
    exit 1
fi

echo "Using API token: ${API_TOKEN:0:10}..."
echo ""

# ========================================
# BACKEND TESTS
# ========================================
echo "========================================"
echo "BACKEND TESTS"
echo "========================================"
echo ""

# Test 1: API Server is running
run_test "API server is running" "curl -s http://localhost:3000/api/workspaces"

# Test 2: Get list of workspaces
echo -n "Getting workspace list... "
WORKSPACES_RESPONSE=$(curl -s -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/api/workspaces)
WORKSPACE_ID=$(echo "$WORKSPACES_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$WORKSPACE_ID" ]; then
    echo -e "${GREEN}✓ Found workspace: $WORKSPACE_ID${NC}"
else
    echo -e "${RED}✗ No workspaces found${NC}"
    exit 1
fi

# Test 3: Verify workspace has valid project_id
echo -n "Verifying workspace configuration... "
WORKSPACE_DATA=$(curl -s -H "Authorization: Bearer $API_TOKEN" "http://localhost:3000/api/workspaces/$WORKSPACE_ID")
PROJECT_ID=$(echo "$WORKSPACE_DATA" | grep -o '"project_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    echo -e "${GREEN}✓ Workspace has project_id: $PROJECT_ID${NC}"
else
    echo -e "${YELLOW}⚠ Workspace has no project_id, using planner agent directly${NC}"
fi

# Test 4: Trigger improvement workflow
echo -n "Creating improvement plan... "
IMPROVE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"currentContent":"# Test CLAUDE.md\n\nThis is a test document for improvement."}' \
    "http://localhost:3000/api/workspaces/$WORKSPACE_ID/improve-claude-md")

PLAN_ID=$(echo "$IMPROVE_RESPONSE" | jq -r '.data.planId // empty')

if [ -n "$PLAN_ID" ]; then
    echo -e "${GREEN}✓ Plan created: $PLAN_ID${NC}"
else
    echo -e "${RED}✗ Failed to create plan${NC}"
    echo "Response: $IMPROVE_RESPONSE"
    exit 1
fi

# Test 5: Check plan status
echo -n "Checking plan status... "
sleep 2
PLAN_STATUS=$(curl -s -H "Authorization: Bearer $API_TOKEN" \
    "http://localhost:3000/api/plans/$PLAN_ID" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PLAN_STATUS" ]; then
    echo -e "${GREEN}✓ Plan status: $PLAN_STATUS${NC}"
else
    echo -e "${RED}✗ Failed to get plan status${NC}"
fi

# Test 6: Submit structured output
echo -n "Submitting structured output... "
TEST_OUTPUT='{"improvedContent":"# Improved CLAUDE.md\n\nThis is the improved version.","improvements":["Better structure","More details"]}'
SUBMIT_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"output\":$TEST_OUTPUT}" \
    "http://localhost:3000/api/plans/$PLAN_ID/structured-output")

SUBMIT_SUCCESS=$(echo "$SUBMIT_RESPONSE" | grep -o '"saved":true')

if [ -n "$SUBMIT_SUCCESS" ]; then
    echo -e "${GREEN}✓ Structured output saved${NC}"
else
    echo -e "${RED}✗ Failed to save structured output${NC}"
    echo "Response: $SUBMIT_RESPONSE"
fi

# Test 7: Verify structured output was saved
echo -n "Verifying structured output... "
VERIFIED_OUTPUT=$(curl -s -H "Authorization: Bearer $API_TOKEN" \
    "http://localhost:3000/api/plans/$PLAN_ID" | grep -o '"structured_output":"[^"]*"' | head -1)

if [ -n "$VERIFIED_OUTPUT" ]; then
    echo -e "${GREEN}✓ Structured output verified${NC}"
else
    echo -e "${YELLOW}⚠ Structured output not found in plan${NC}"
fi

echo ""
echo "========================================"
echo "BACKEND TESTS COMPLETE"
echo "========================================"
echo ""

# ========================================
# FRONTEND TESTS
# ========================================
echo "========================================"
echo "FRONTEND TESTS"
echo "========================================"
echo ""

echo -e "${YELLOW}Frontend tests require manual verification:${NC}"
echo ""
echo "1. Open dashboard at http://localhost:5173"
echo "2. Navigate to workspace: $WORKSPACE_ID"
echo "3. Click 'Improve with AI' button in the CLAUDE.md tab"
echo "4. Verify the following:"
echo "   - No redirect occurs (stay on agents page)"
echo "   - Loading indicator appears with gradient banner"
echo "   - Polling occurs every 2 seconds (check network tab)"
echo "   - Modal opens automatically when complete"
echo "   - Improved content is displayed in modal"
echo "   - Approve button saves content to file"
echo "   - Discard button closes modal without saving"
echo ""

# ========================================
# EDGE CASE TESTS
# ========================================
echo "========================================"
echo "EDGE CASE TESTS"
echo "========================================"
echo ""

# Test empty content
echo -n "Testing empty CLAUDE.md... "
EMPTY_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"currentContent":""}' \
    "http://localhost:3000/api/workspaces/$WORKSPACE_ID/improve-claude-md")

EMPTY_PLAN_ID=$(echo "$EMPTY_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$EMPTY_PLAN_ID" ]; then
    echo -e "${GREEN}✓ Plan created for empty content${NC}"
else
    echo -e "${YELLOW}⚠ Empty content handled differently${NC}"
fi

# Test very long content
echo -n "Testing long CLAUDE.md... "
LONG_CONTENT="# Test CLAUDE.md
$(for i in {1..100}; do echo "Line $i: This is a test line with some content"; done)"
LONG_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    "{\"currentContent\":\"$(echo "$LONG_CONTENT" | jq -Rs .)\"}" \
    "http://localhost:3000/api/workspaces/$WORKSPACE_ID/improve-claude-md")

LONG_PLAN_ID=$(echo "$LONG_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$LONG_PLAN_ID" ]; then
    echo -e "${GREEN}✓ Plan created for long content${NC}"
else
    echo -e "${RED}✗ Failed to create plan for long content${NC}"
fi

# Test invalid plan ID
echo -n "Testing invalid plan ID... "
INVALID_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"output":{"test":"data"}}' \
    "http://localhost:3000/api/plans/invalid-id-12345/structured-output")

if echo "$INVALID_RESPONSE" | grep -q "error"; then
    echo -e "${GREEN}✓ Invalid plan ID handled correctly${NC}"
else
    echo -e "${RED}✗ Invalid plan ID not handled${NC}"
fi

echo ""
echo "========================================"
echo "EDGE CASE TESTS COMPLETE"
echo "========================================"
echo ""

# ========================================
# SUMMARY
# ========================================
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL AUTOMATED TESTS PASSED${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
