#!/bin/bash

###############################################################################
# LEGACY TEST SCRIPT: 'Improve with AI' Feature (Superseded)
# Description: This script tests the complete improvement workflow from
#              trigger to completion. NOTE: This test has been superseded by
#              more comprehensive tests in the e2e/ directory.
#
# Status: LEGACY - Superseded by test-improvement-end-to-end.sh
# Location: tests/scripts/legacy/
# Archive Date: 2025-03-19
#
# Reason for Legacy Status:
#   - Functionality covered by more comprehensive E2E tests
#   - Newer tests provide better coverage and reporting
#   - Maintained for historical reference and rollback purposes
#
# Current Replacement:
#   - Use: tests/scripts/e2e/test-improvement-end-to-end.sh
#   - Provides: Better test coverage, improved error handling, detailed reporting
#
# Usage (for reference only):
#   ./tests/scripts/legacy/test-improvement-fix.sh
#
# Retention Policy: 6 months (until 2025-09-19)
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
API_URL="http://localhost:3000"
DASHBOARD_URL="http://localhost:5173"
TEST_WORKSPACE_NAME="test-improvement-$(date +%s)"
TEST_AGENT_NAME="test-agent"
TEST_PROMPT="Fix the syntax error in the calculate function"
POLL_INTERVAL=2
MAX_POLL_TIME=60
LOG_FILE="/tmp/improvement-test-$(date +%s).log"

# Test results tracking
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

###############################################################################
# Utility Functions
###############################################################################

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✓ PASS${NC} $1" | tee -a "$LOG_FILE"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_failure() {
    echo -e "${RED}✗ FAIL${NC} $1" | tee -a "$LOG_FILE"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_info() {
    echo -e "${YELLOW}ℹ INFO${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${YELLOW}▶ $1${NC}"
    echo ""
}

###############################################################################
# Test Functions
###############################################################################

# Test 1: Check if services are running
test_services_running() {
    print_section "Test 1: Checking if services are running"

    # Check API
    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        log_success "API is running at $API_URL"
    else
        log_failure "API is not running at $API_URL"
        return 1
    fi

    # Check Dashboard
    if curl -s -f "$DASHBOARD_URL" > /dev/null 2>&1; then
        log_success "Dashboard is running at $DASHBOARD_URL"
    else
        log_failure "Dashboard is not running at $DASHBOARD_URL"
        return 1
    fi
}

# Test 2: Create test workspace
test_create_workspace() {
    print_section "Test 2: Creating test workspace"

    WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$TEST_WORKSPACE_NAME\"}")

    WORKSPACE_ID=$(echo "$WORKSPACE_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

    if [ -n "$WORKSPACE_ID" ]; then
        log_success "Workspace created with ID: $WORKSPACE_ID"
        echo "WORKSPACE_ID=$WORKSPACE_ID" >> "$LOG_FILE"
    else
        log_failure "Failed to create workspace. Response: $WORKSPACE_RESPONSE"
        return 1
    fi
}

# Test 3: Create test agent with problematic code
test_create_agent() {
    print_section "Test 3: Creating test agent with code to improve"

    AGENT_CODE='export function calculateTax(amount: number, rate: number): number {
  // This has a syntax error
  const tax = amount * rate
  return tax
}

export function calculateTotal(amount: number, tax: number): number {
  return amount + tax
}'

    AGENT_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/agents" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$TEST_AGENT_NAME\",\"description\":\"Test agent for improvement\",\"code\":\"$(echo "$AGENT_CODE" | jq -Rs .)\"}")

    AGENT_ID=$(echo "$AGENT_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

    if [ -n "$AGENT_ID" ]; then
        log_success "Agent created with ID: $AGENT_ID"
        echo "AGENT_ID=$AGENT_ID" >> "$LOG_FILE"
        echo "ORIGINAL_CODE=$AGENT_CODE" >> "$LOG_FILE"
    else
        log_failure "Failed to create agent. Response: $AGENT_RESPONSE"
        return 1
    fi
}

# Test 4: Trigger improvement workflow
test_trigger_improvement() {
    print_section "Test 4: Triggering improvement workflow"

    IMPROVE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID/improve" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\":\"$TEST_PROMPT\"}")

    PLAN_ID=$(echo "$IMPROVE_RESPONSE" | grep -o '"planId":"[^"]*' | cut -d'"' -f4)

    if [ -n "$PLAN_ID" ]; then
        log_success "Improvement triggered with Plan ID: $PLAN_ID"
        echo "PLAN_ID=$PLAN_ID" >> "$LOG_FILE"
    else
        log_failure "Failed to trigger improvement. Response: $IMPROVE_RESPONSE"
        return 1
    fi
}

# Test 5: Verify plan status progression
test_plan_status_progression() {
    print_section "Test 5: Monitoring plan status progression"

    local elapsed=0
    local status=""
    local previous_status=""

    log_info "Polling plan status (max ${MAX_POLL_TIME}s)..."

    while [ $elapsed -lt $MAX_POLL_TIME ]; do
        STATUS_RESPONSE=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID/improvement-status")

        status=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

        if [ "$status" != "$previous_status" ]; then
            log_info "Status changed: $previous_status → $status"
            previous_status="$status"
        fi

        # Check if we reached success
        if [ "$status" = "success" ]; then
            log_success "Plan status reached 'success' in ${elapsed}s"

            # Verify structured_output exists
            STRUCTURED_OUTPUT=$(echo "$STATUS_RESPONSE" | grep -o '"structured_output":{[^}]*}' | head -1)

            if [ -n "$STRUCTURED_OUTPUT" ]; then
                log_success "Structured output found in response"
                echo "STRUCTURED_OUTPUT=$STRUCTURED_OUTPUT" >> "$LOG_FILE"
            else
                log_failure "No structured_output found in success response"
                return 1
            fi

            return 0
        fi

        # Check for terminal failure states
        if [ "$status" = "failed" ] || [ "$status" = "cancelled" ]; then
            log_failure "Plan reached terminal state: $status"
            return 1
        fi

        sleep $POLL_INTERVAL
        elapsed=$((elapsed + POLL_INTERVAL))
    done

    log_failure "Plan did not reach success status within ${MAX_POLL_TIME}s"
    return 1
}

# Test 6: Verify improved content is retrievable
test_improved_content_retrieval() {
    print_section "Test 6: Verifying improved content is retrievable"

    STATUS_RESPONSE=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID/improvement-status")

    # Extract improvedContent if it exists
    IMPROVED_CONTENT=$(echo "$STATUS_RESPONSE" | jq -r '.improvedContent // empty')

    if [ -n "$IMPROVED_CONTENT" ]; then
        log_success "Improved content retrieved successfully"
        echo "IMPROVED_CONTENT=$IMPROVED_CONTENT" >> "$LOG_FILE"
    else
        log_failure "No improved content found"
        return 1
    fi
}

# Test 7: Verify frontend can poll the endpoint
test_frontend_polling() {
    print_section "Test 7: Verifying frontend polling compatibility"

    # Simulate frontend polling
    local poll_count=0
    local max_polls=5
    local success=0

    for i in $(seq 1 $max_polls); do
        POLL_RESPONSE=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID/improvement-status")

        PLAN_STATUS=$(echo "$POLL_RESPONSE" | jq -r '.status // empty')
        HAS_STRUCTURED_OUTPUT=$(echo "$POLL_RESPONSE" | jq -e '.structured_output' > /dev/null 2>&1 && echo "true" || echo "false")
        HAS_IMPROVED_CONTENT=$(echo "$POLL_RESPONSE" | jq -e '.improvedContent' > /dev/null 2>&1 && echo "true" || echo "false")

        log_info "Poll $i: status=$PLAN_STATUS, has_structured_output=$HAS_STRUCTURED_OUTPUT, has_improved_content=$HAS_IMPROVED_CONTENT"

        if [ "$PLAN_STATUS" = "success" ] && [ "$HAS_STRUCTURED_OUTPUT" = "true" ] && [ "$HAS_IMPROVED_CONTENT" = "true" ]; then
            success=1
            break
        fi

        sleep 2
    done

    if [ $success -eq 1 ]; then
        log_success "Frontend polling simulation successful"
    else
        log_failure "Frontend polling simulation failed"
        return 1
    fi
}

# Test 8: Test approval endpoint (if it exists)
test_approval_endpoint() {
    print_section "Test 8: Testing approval endpoint"

    # Try to approve the improvement
    APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID/improvement-approve" \
        -H "Content-Type: application/json" \
        -d '{"approved":true}')

    # Check if endpoint exists
    if echo "$APPROVE_RESPONSE" | grep -q "Cannot.*POST"; then
        log_info "Approval endpoint not implemented (this is OK if using different endpoint)"
    else
        log_success "Approval endpoint response received: $APPROVE_RESPONSE"
    fi
}

# Test 9: Verify agent code was updated (if approval worked)
test_agent_code_updated() {
    print_section "Test 9: Verifying agent code after approval"

    AGENT_RESPONSE=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID")
    UPDATED_CODE=$(echo "$AGENT_RESPONSE" | jq -r '.code // empty')

    if [ -n "$UPDATED_CODE" ]; then
        log_success "Agent code retrieved after approval"
        echo "UPDATED_CODE=$UPDATED_CODE" >> "$LOG_FILE"

        # Check if code is different from original
        if [ "$UPDATED_CODE" != "$(echo "$AGENT_CODE" | jq -Rs .)" ]; then
            log_info "Agent code appears to have been updated"
        else
            log_info "Agent code unchanged (approval may not have been applied)"
        fi
    else
        log_failure "Failed to retrieve agent code"
        return 1
    fi
}

# Test 10: Cleanup test data
test_cleanup() {
    print_section "Test 10: Cleaning up test data"

    # Delete agent
    DELETE_AGENT_RESPONSE=$(curl -s -X DELETE "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID")

    if curl -s -f "$API_URL/workspaces/$WORKSPACE_ID/agents/$AGENT_ID" > /dev/null 2>&1; then
        log_failure "Failed to delete agent"
    else
        log_success "Test agent deleted successfully"
    fi

    # Delete workspace
    DELETE_WORKSPACE_RESPONSE=$(curl -s -X DELETE "$API_URL/workspaces/$WORKSPACE_ID")

    if curl -s -f "$API_URL/workspaces/$WORKSPACE_ID" > /dev/null 2>&1; then
        log_failure "Failed to delete workspace"
    else
        log_success "Test workspace deleted successfully"
    fi
}

###############################################################################
# Main Test Execution
###############################################################################

main() {
    print_header "Improve with AI - Comprehensive Test Suite"

    log "Test log file: $LOG_FILE"
    log "Test workspace: $TEST_WORKSPACE_NAME"

    # Run tests
    test_services_running || exit 1
    test_create_workspace || exit 1
    test_create_agent || exit 1
    test_trigger_improvement || exit 1
    test_plan_status_progression || exit 1
    test_improved_content_retrieval || exit 1
    test_frontend_polling || exit 1
    test_approval_endpoint || true  # Non-critical
    test_agent_code_updated || true  # Non-critical
    test_cleanup || true  # Always attempt cleanup

    # Print summary
    print_header "Test Summary"

    echo -e "Total Tests:  $TOTAL_TESTS"
    echo -e "${GREEN}Passed:       $PASSED_TESTS${NC}"
    echo -e "${RED}Failed:       $FAILED_TESTS${NC}"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}✗ Some tests failed. Check log: $LOG_FILE${NC}"
        echo ""
        exit 1
    fi
}

# Run main function
main
