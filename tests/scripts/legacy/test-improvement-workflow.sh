#!/bin/bash

###############################################################################
# LEGACY TEST SCRIPT: CLAUDE.md Improvement Workflow (Superseded)
# Description: This script tested the complete flow from creating an improvement
#              task to saving structured output.
#
# Status: LEGACY - Superseded by test-improvement-comprehensive.sh
# Location: tests/scripts/legacy/
# Archive Date: 2026-03-19
#
# Reason for Legacy Status:
#   - Functionality merged into test-improvement-comprehensive.sh
#   - New comprehensive test includes all features from this test plus:
#     * Better error handling and reporting
#     * Test tracking with pass/fail counters
#     * Edge case testing (empty content, long content, invalid IDs)
#     * Improved workspace selection logic
#     * Better cleanup and logging
#
# Current Replacement:
#   - Use: tests/scripts/e2e/test-improvement-comprehensive.sh
#   - Provides: Complete coverage of this test plus additional features
#
# Original Location: tests/scripts/workflow/
# Original Category: Automated Workflow Test
#
# Usage (for reference only):
#   ./tests/scripts/legacy/test-improvement-workflow.sh
#
# Original Prerequisites:
#   - API server running on http://localhost:3001
#   - Valid API token configured
#   - At least one workspace available
#
# Environment Variables:
#   API_URL - API endpoint (default: http://localhost:3001/api)
#   API_BEARER_TOKEN - Authentication token (default: dev-token-change-in-production)
#   WORKSPACE_ID - Specific workspace to test (optional)
#
# Retention Policy: 6 months (until 2026-09-19)
###############################################################################

set -e

echo "=== Testing CLAUDE.md Improvement Workflow ==="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3001/api}"
TOKEN="${API_BEARER_TOKEN:-dev-token-change-in-production}"
WORKSPACE_ID="${WORKSPACE_ID:-}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_api() {
    log_info "Checking API connection..."
    response=$(curl -s -w "\n%{http_code}" "${API_URL}/daemon/status" -H "Authorization: Bearer $TOKEN")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        log_info "API is reachable"
        return 0
    else
        log_error "API is not reachable (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# Test 1: Check if we can list workspaces
test_list_workspaces() {
    log_info "Test 1: Listing workspaces..."
    response=$(curl -s "${API_URL}/workspaces" -H "Authorization: Bearer $TOKEN")
    echo "$response" | jq '.' > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_info "Workspaces listed successfully"
        echo "$response" | jq '.data[] | {id, name, role}' | head -20
        return 0
    else
        log_error "Failed to list workspaces"
        echo "$response"
        return 1
    fi
}

# Test 2: Get first workspace ID
get_test_workspace() {
    log_info "Test 2: Getting a test workspace..."
    response=$(curl -s "${API_URL}/workspaces" -H "Authorization: Bearer $TOKEN")

    # Try to get the planner workspace
    WORKSPACE_ID=$(echo "$response" | jq -r '.data[] | select(.role == "planner") | .id' | head -1)

    if [ -z "$WORKSPACE_ID" ]; then
        # Fallback to any workspace
        WORKSPACE_ID=$(echo "$response" | jq -r '.data[0].id')
    fi

    if [ -n "$WORKSPACE_ID" ]; then
        log_info "Using workspace: $WORKSPACE_ID"
        return 0
    else
        log_error "No workspace found"
        return 1
    fi
}

# Test 3: Create an improvement task
test_create_improvement() {
    log_info "Test 3: Creating CLAUDE.md improvement task..."

    if [ -z "$WORKSPACE_ID" ]; then
        log_error "No workspace ID set"
        return 1
    fi

    # Sample content to improve
    CONTENT="This is a test agent that does stuff.
It should write better code.
Make it work good."

    response=$(curl -s -X POST "${API_URL}/workspaces/${WORKSPACE_ID}/improve-claude-md" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$CONTENT\"}")

    echo "$response" | jq '.' > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        PLAN_ID=$(echo "$response" | jq -r '.data.planId')
        TASK_ID=$(echo "$response" | jq -r '.data.taskId')
        log_info "Improvement task created successfully"
        log_info "Plan ID: $PLAN_ID"
        log_info "Task ID: $TASK_ID"
        echo "$PLAN_ID" > /tmp/test_plan_id.txt
        return 0
    else
        log_error "Failed to create improvement task"
        echo "$response"
        return 1
    fi
}

# Test 4: Check plan status
test_check_plan_status() {
    log_info "Test 4: Checking plan status..."

    if [ ! -f /tmp/test_plan_id.txt ]; then
        log_error "No plan ID found"
        return 1
    fi

    PLAN_ID=$(cat /tmp/test_plan_id.txt)
    response=$(curl -s "${API_URL}/plans/${PLAN_ID}" -H "Authorization: Bearer $TOKEN")

    echo "$response" | jq '.' > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        STATUS=$(echo "$response" | jq -r '.data.status')
        log_info "Plan status: $STATUS"
        echo "$response" | jq '.data | {id, name, status, type}'
        return 0
    else
        log_error "Failed to get plan status"
        echo "$response"
        return 1
    fi
}

# Test 5: Save structured output (simulate what the agent should do)
test_save_structured_output() {
    log_info "Test 5: Testing structured output endpoint..."

    if [ ! -f /tmp/test_plan_id.txt ]; then
        log_error "No plan ID found"
        return 1
    fi

    PLAN_ID=$(cat /tmp/test_plan_id.txt)

    # Sample improved content
    IMPROVED_CONTENT="# Test Agent

This is a test agent designed to demonstrate functionality.

## Purpose
Performs specific tasks with high quality standards.

## Instructions
1. Write clean, maintainable code
2. Follow best practices
3. Include appropriate error handling
4. Add documentation for complex logic"

    # Escape the content for JSON
    ESCAPED_CONTENT=$(echo "$IMPROVED_CONTENT" | jq -Rs .)

    response=$(curl -s -X POST "${API_URL}/plans/${PLAN_ID}/structured-output" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"output\": {\"improvedContent\": $ESCAPED_CONTENT}}")

    echo "$response" | jq '.' > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        log_info "Structured output saved successfully"
        echo "$response"
        return 0
    else
        log_error "Failed to save structured output"
        echo "$response"
        return 1
    fi
}

# Test 6: Verify structured output was saved
test_verify_structured_output() {
    log_info "Test 6: Verifying structured output was saved..."

    if [ ! -f /tmp/test_plan_id.txt ]; then
        log_error "No plan ID found"
        return 1
    fi

    PLAN_ID=$(cat /tmp/test_plan_id.txt)
    response=$(curl -s "${API_URL}/plans/${PLAN_ID}" -H "Authorization: Bearer $TOKEN")

    echo "$response" | jq '.' > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        STRUCTURED_OUTPUT=$(echo "$response" | jq -r '.data.structured_output')
        if [ "$STRUCTURED_OUTPUT" != "null" ] && [ -n "$STRUCTURED_OUTPUT" ]; then
            log_info "Structured output verified"
            echo "$response" | jq '.data.structured_output.improvedContent' | head -5
            return 0
        else
            log_warn "Structured output is empty"
            return 1
        fi
    else
        log_error "Failed to verify structured output"
        echo "$response"
        return 1
    fi
}

# Cleanup
cleanup() {
    log_info "Cleaning up..."
    if [ -f /tmp/test_plan_id.txt ]; then
        rm -f /tmp/test_plan_id.txt
    fi
}

# Main test execution
main() {
    log_info "Starting workflow tests..."
    echo ""

    # Check if API is running
    if ! check_api; then
        log_error "API is not accessible. Please start the API server first."
        exit 1
    fi
    echo ""

    # Run tests
    test_list_workspaces
    echo ""

    get_test_workspace
    echo ""

    test_create_improvement
    echo ""

    sleep 2
    test_check_plan_status
    echo ""

    test_save_structured_output
    echo ""

    sleep 1
    test_verify_structured_output
    echo ""

    log_info "Tests completed!"
    echo ""
    echo "Summary:"
    echo "- API endpoint: ${API_URL}"
    echo "- Workspace ID: ${WORKSPACE_ID}"
    echo "- Plan ID: $(cat /tmp/test_plan_id.txt 2>/dev/null || echo 'N/A')"
    echo ""
    echo "Next steps:"
    echo "1. Start the daemon to execute the plan: npm run start:daemon"
    echo "2. Monitor the plan execution via the dashboard or API"
    echo "3. Check if the planner agent saves the structured output"
    echo "4. Verify the improved content appears in the frontend"
}

# Trap cleanup
trap cleanup EXIT

# Run main function
main
