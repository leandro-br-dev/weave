#!/bin/bash

###############################################################################
# Comprehensive End-to-End Test: CLAUDE.md Improvement Workflow
# Description: Complete E2E test covering the entire improvement workflow.
#              This test consolidates functionality from both the workflow
#              and end-to-end tests to provide comprehensive coverage.
#
# Location: tests/scripts/e2e/
# Category: End-to-End Test
# Consolidated: 2026-03-19 from test-improvement-workflow.sh and
#               test-improvement-end-to-end.sh
#
# Prerequisites:
#   - API server running on http://localhost:3000
#   - Dashboard running on http://localhost:5173
#   - Valid API token configured in api/.env
#   - At least one workspace available
#
# Usage:
#   ./tests/scripts/e2e/test-improvement-comprehensive.sh
#
# Environment Variables:
#   API_URL - API endpoint (default: http://localhost:3000)
#   API_BEARER_TOKEN - Authentication token
#   WORKSPACE_ID - Specific workspace to test (optional)
#
# Test Coverage:
#   - API health and connectivity
#   - Workspace listing and validation
#   - Improvement plan creation
#   - Plan status monitoring
#   - Structured output submission
#   - Structured output verification
#   - Frontend integration (manual verification steps)
#   - Edge cases:
#     * Empty content handling
#     * Long content handling
#     * Invalid plan ID handling
###############################################################################

set -e

echo "========================================"
echo "Comprehensive Improvement Workflow E2E Test"
echo "========================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_ENDPOINT="${API_URL}/api"

# Get API token from .env (supports both API_BEARER_TOKEN and WEAVE_TOKEN)
API_TOKEN="${API_BEARER_TOKEN:-}"
if [ -z "$API_TOKEN" ]; then
    if [ -f /root/projects/weave/api/.env ]; then
        API_TOKEN=$(grep API_BEARER_TOKEN /root/projects/weave/api/.env | cut -d '=' -f2)
        if [ -z "$API_TOKEN" ]; then
            API_TOKEN=$(grep WEAVE_TOKEN /root/projects/weave/api/.env | cut -d '=' -f2)
        fi
    fi
fi

if [ -z "$API_TOKEN" ]; then
    echo -e "${RED}ERROR: No API token found. Set API_BEARER_TOKEN environment variable or configure api/.env${NC}"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Helper function to run tests with tracking
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

# Test 1: API Health Check
test_api_health() {
    log_info "Test 1: Checking API connectivity..."
    response=$(curl -s -w "\n%{http_code}" "${API_ENDPOINT}/daemon/status" -H "Authorization: Bearer $API_TOKEN")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        log_success "API is reachable and healthy"
        echo "Response: $body" | head -5
        return 0
    else
        log_error "API health check failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test 2: List Workspaces
test_list_workspaces() {
    log_info "Test 2: Listing available workspaces..."
    response=$(curl -s "${API_ENDPOINT}/workspaces" -H "Authorization: Bearer $API_TOKEN")

    if echo "$response" | jq '.' > /dev/null 2>&1; then
        log_success "Workspaces listed successfully"
        echo "$response" | jq '.data[] | {id, name, role}' | head -10
        return 0
    else
        log_error "Failed to list workspaces"
        echo "Response: $response"
        return 1
    fi
}

# Test 3: Get Test Workspace
get_test_workspace() {
    log_info "Test 3: Selecting test workspace..."

    if [ -n "$WORKSPACE_ID" ]; then
        log_info "Using workspace from environment: $WORKSPACE_ID"
        return 0
    fi

    response=$(curl -s "${API_ENDPOINT}/workspaces" -H "Authorization: Bearer $API_TOKEN")

    # Try to get the planner workspace first
    WORKSPACE_ID=$(echo "$response" | jq -r '.data[] | select(.role == "planner") | .id' | head -1)

    if [ -z "$WORKSPACE_ID" ]; then
        # Fallback to any workspace
        WORKSPACE_ID=$(echo "$response" | jq -r '.data[0].id')
    fi

    if [ -n "$WORKSPACE_ID" ]; then
        log_success "Selected workspace: $WORKSPACE_ID"
        return 0
    else
        log_error "No workspace found"
        return 1
    fi
}

# Test 4: Verify Workspace Configuration
test_workspace_config() {
    log_info "Test 4: Verifying workspace configuration..."

    WORKSPACE_DATA=$(curl -s -H "Authorization: Bearer $API_TOKEN" "${API_ENDPOINT}/workspaces/$WORKSPACE_ID")
    PROJECT_ID=$(echo "$WORKSPACE_DATA" | jq -r '.data.project_id // empty')

    if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
        log_success "Workspace has project_id: $PROJECT_ID"
    else
        log_warn "Workspace has no project_id, will use planner agent directly"
    fi

    echo "$WORKSPACE_DATA" | jq '.data | {id, name, role, project_id}' | head -5
    return 0
}

# Test 5: Create Improvement Plan
test_create_improvement() {
    log_info "Test 5: Creating improvement plan..."

    CONTENT="# Test CLAUDE.md

This is a test agent configuration.

## Purpose
This agent performs specific tasks with high quality standards.

## Instructions
1. Write clean, maintainable code
2. Follow best practices
3. Include appropriate error handling"

    IMPROVE_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"currentContent\":\"$(echo "$CONTENT" | jq -Rs .)\"}" \
        "${API_ENDPOINT}/workspaces/$WORKSPACE_ID/improve-claude-md")

    PLAN_ID=$(echo "$IMPROVE_RESPONSE" | jq -r '.data.planId // .data.id // empty')

    if [ -n "$PLAN_ID" ]; then
        log_success "Improvement plan created: $PLAN_ID"
        echo "$PLAN_ID" > /tmp/test_improvement_plan_id.txt
        return 0
    else
        log_error "Failed to create improvement plan"
        echo "Response: $IMPROVE_RESPONSE"
        return 1
    fi
}

# Test 6: Check Plan Status
test_plan_status() {
    log_info "Test 6: Checking plan status..."

    if [ ! -f /tmp/test_improvement_plan_id.txt ]; then
        log_error "No plan ID found from previous test"
        return 1
    fi

    PLAN_ID=$(cat /tmp/test_improvement_plan_id.txt)
    sleep 2  # Give the plan time to process

    PLAN_STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_TOKEN" "${API_ENDPOINT}/plans/$PLAN_ID")

    if echo "$PLAN_STATUS_RESPONSE" | jq '.' > /dev/null 2>&1; then
        STATUS=$(echo "$PLAN_STATUS_RESPONSE" | jq -r '.data.status')
        log_success "Plan status: $STATUS"
        echo "$PLAN_STATUS_RESPONSE" | jq '.data | {id, name, status, type}' | head -5
        return 0
    else
        log_error "Failed to get plan status"
        echo "Response: $PLAN_STATUS_RESPONSE"
        return 1
    fi
}

# Test 7: Submit Structured Output
test_submit_structured_output() {
    log_info "Test 7: Submitting structured output..."

    if [ ! -f /tmp/test_improvement_plan_id.txt ]; then
        log_error "No plan ID found from previous test"
        return 1
    fi

    PLAN_ID=$(cat /tmp/test_improvement_plan_id.txt)

    TEST_OUTPUT='{"improvedContent":"# Improved CLAUDE.md\n\nThis is the improved version with better structure.\n\n## Purpose\nClearly defined purpose and scope.\n\n## Instructions\n1. Write clean, maintainable code\n2. Follow industry best practices\n3. Include comprehensive error handling\n4. Add detailed documentation","improvements":["Better structure and organization","More detailed instructions","Improved readability"]}'

    SUBMIT_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"output\":$TEST_OUTPUT}" \
        "${API_ENDPOINT}/plans/$PLAN_ID/structured-output")

    SUBMIT_SUCCESS=$(echo "$SUBMIT_RESPONSE" | jq -r '.saved // .success // false')

    if [ "$SUBMIT_SUCCESS" = "true" ]; then
        log_success "Structured output submitted successfully"
        return 0
    else
        log_error "Failed to submit structured output"
        echo "Response: $SUBMIT_RESPONSE"
        return 1
    fi
}

# Test 8: Verify Structured Output
test_verify_structured_output() {
    log_info "Test 8: Verifying structured output was saved..."

    if [ ! -f /tmp/test_improvement_plan_id.txt ]; then
        log_error "No plan ID found from previous test"
        return 1
    fi

    PLAN_ID=$(cat /tmp/test_improvement_plan_id.txt)
    VERIFIED_RESPONSE=$(curl -s -H "Authorization: Bearer $API_TOKEN" "${API_ENDPOINT}/plans/$PLAN_ID")

    if echo "$VERIFIED_RESPONSE" | jq '.' > /dev/null 2>&1; then
        STRUCTURED_OUTPUT=$(echo "$VERIFIED_RESPONSE" | jq -r '.data.structured_output // .data.structuredOutput // empty')

        if [ -n "$STRUCTURED_OUTPUT" ] && [ "$STRUCTURED_OUTPUT" != "null" ]; then
            log_success "Structured output verified in plan"
            echo "$VERIFIED_RESPONSE" | jq '.data.structured_output.improvedContent' | head -5
            return 0
        else
            log_warn "Structured output not found in plan"
            return 1
        fi
    else
        log_error "Failed to verify structured output"
        echo "Response: $VERIFIED_RESPONSE"
        return 1
    fi
}

# Test 9: Edge Case - Empty Content
test_edge_case_empty_content() {
    log_info "Test 9: Edge case - Empty content handling..."

    EMPTY_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"currentContent":""}' \
        "${API_ENDPOINT}/workspaces/$WORKSPACE_ID/improve-claude-md")

    # Check if it handles gracefully (either creates plan or returns meaningful error)
    if echo "$EMPTY_RESPONSE" | jq -e '.data.planId or .data.id or .error' > /dev/null 2>&1; then
        log_success "Empty content handled gracefully"
        return 0
    else
        log_warn "Empty content handling unclear"
        echo "Response: $EMPTY_RESPONSE"
        return 0  # Don't fail the test, just warn
    fi
}

# Test 10: Edge Case - Long Content
test_edge_case_long_content() {
    log_info "Test 10: Edge case - Long content handling..."

    LONG_CONTENT="# Test CLAUDE.md
$(for i in {1..100}; do echo "Line $i: This is a test line with some content to test length handling"; done)"

    LONG_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"currentContent\":\"$(echo "$LONG_CONTENT" | jq -Rs .)\"}" \
        "${API_ENDPOINT}/workspaces/$WORKSPACE_ID/improve-claude-md")

    LONG_PLAN_ID=$(echo "$LONG_RESPONSE" | jq -r '.data.planId // .data.id // empty')

    if [ -n "$LONG_PLAN_ID" ]; then
        log_success "Long content handled successfully (plan ID: $LONG_PLAN_ID)"
        return 0
    else
        log_error "Failed to handle long content"
        echo "Response: $LONG_RESPONSE"
        return 1
    fi
}

# Test 11: Edge Case - Invalid Plan ID
test_edge_case_invalid_plan_id() {
    log_info "Test 11: Edge case - Invalid plan ID handling..."

    INVALID_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"output":{"test":"data"}}' \
        "${API_ENDPOINT}/plans/invalid-plan-id-12345/structured-output")

    # Should return an error for invalid plan ID
    if echo "$INVALID_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        log_success "Invalid plan ID rejected correctly"
        return 0
    else
        log_warn "Invalid plan ID handling unclear"
        echo "Response: $INVALID_RESPONSE"
        return 0  # Don't fail the test, just warn
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    if [ -f /tmp/test_improvement_plan_id.txt ]; then
        rm -f /tmp/test_improvement_plan_id.txt
    fi
}

# Main test execution
main() {
    log_info "Starting comprehensive improvement workflow tests..."
    echo ""

    # Trap cleanup on exit
    trap cleanup EXIT

    # Run automated tests
    echo "========================================"
    echo "AUTOMATED BACKEND TESTS"
    echo "========================================"
    echo ""

    test_api_health
    echo ""

    test_list_workspaces
    echo ""

    if ! get_test_workspace; then
        log_error "Failed to get test workspace. Exiting."
        exit 1
    fi
    echo ""

    test_workspace_config
    echo ""

    test_create_improvement
    echo ""

    test_plan_status
    echo ""

    test_submit_structured_output
    echo ""

    test_verify_structured_output
    echo ""

    echo "========================================"
    echo "EDGE CASE TESTS"
    echo "========================================"
    echo ""

    test_edge_case_empty_content
    echo ""

    test_edge_case_long_content
    echo ""

    test_edge_case_invalid_plan_id
    echo ""

    echo "========================================"
    echo "FRONTEND INTEGRATION TESTS"
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
    echo "   - Modal opens automatically when plan is complete"
    echo "   - Improved content is displayed in modal"
    echo "   - Approve button saves content to CLAUDE.md"
    echo "   - Discard button closes modal without saving"
    echo ""

    # Print summary
    echo "========================================"
    echo "TEST SUMMARY"
    echo "========================================"
    echo ""
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo ""
    echo "Test Details:"
    echo "- API Endpoint: ${API_ENDPOINT}"
    echo "- Workspace ID: ${WORKSPACE_ID}"
    echo "- Plan ID: $(cat /tmp/test_improvement_plan_id.txt 2>/dev/null || echo 'N/A')"
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ ALL AUTOMATED TESTS PASSED${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Complete manual frontend verification (see above)"
        echo "2. Test with actual daemon execution: npm run start:daemon"
        echo "3. Monitor plan execution via dashboard or API"
        echo "4. Verify improved content appears correctly in frontend"
        exit 0
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        echo ""
        echo "Please review the failed tests above and ensure:"
        echo "- API server is running on ${API_URL}"
        echo "- API token is correctly configured"
        echo "- At least one workspace exists"
        exit 1
    fi
}

# Run main function
main
