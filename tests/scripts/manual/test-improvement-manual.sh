#!/bin/bash

###############################################################################
# Manual Test Guide: 'Improve with AI' Feature
# Description: Provides step-by-step instructions for manual testing of the
#              improvement workflow. This is an interactive guide that walks
#              testers through the complete user experience.
#
# Location: tests/scripts/manual/
# Category: Manual/Interactive Test
#
# Prerequisites:
#   - API server running on http://localhost:3000
#   - Dashboard running on http://localhost:5173
#   - Browser with console open (F12)
#   - User interaction required throughout
#
# Usage:
#   ./tests/scripts/manual/test-improvement-manual.sh
#
# Estimated Time: 10-15 minutes
#
# Test Coverage:
#   - Basic improvement workflow
#   - Modal display and interaction
#   - Approval and discard flows
#   - Error handling
#   - Race condition prevention
###############################################################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

###############################################################################
# Utility Functions
###############################################################################

print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  $1${NC}"
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo ""
    echo -e "${BLUE}▶ ${BOLD}Step $1:${NC} $2"
    echo ""
}

print_check() {
    echo -e "${GREEN}  ✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}  ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}  ⚠${NC} $1"
}

print_error() {
    echo -e "${RED}  ✗${NC} $1"
}

print_code() {
    echo -e "${CYAN}  $1${NC}"
}

prompt_continue() {
    echo ""
    read -p "$(echo -e ${YELLOW}Press Enter to continue...${NC})"
}

prompt_yes_no() {
    local prompt_text=$1
    local response

    while true; do
        read -p "$(echo -e ${YELLOW}${prompt_text} (y/n): ${NC})" response
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer y or n";;
        esac
    done
}

###############################################################################
# Test Functions
###############################################################################

check_prerequisites() {
    print_header "Checking Prerequisites"

    local all_good=true

    # Check API
    if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
        print_check "API server running on http://localhost:3000"
    else
        print_error "API server not running on http://localhost:3000"
        print_info "Start with: cd api && npm run dev"
        all_good=false
    fi

    # Check Dashboard
    if curl -s -f http://localhost:5173 > /dev/null 2>&1; then
        print_check "Dashboard running on http://localhost:5173"
    else
        print_error "Dashboard not running on http://localhost:5173"
        print_info "Start with: cd dashboard && npm run dev"
        all_good=false
    fi

    # Check browser
    print_info "Ensure you have a browser window open to:"
    print_code "http://localhost:5173"

    # Check console
    print_info "Open browser console (F12) and keep it visible"

    if [ "$all_good" = false ]; then
        echo ""
        print_error "Prerequisites not met. Please fix above issues before continuing."
        exit 1
    fi

    prompt_continue
}

test_basic_workflow() {
    print_header "Test 1: Basic Improvement Workflow"

    print_step "1" "Create Test Agent"
    echo "In the dashboard:"
    echo "  1. Select or create a workspace"
    echo "  2. Click 'New Agent'"
    echo "  3. Name it: ${CYAN}test-improvement${NC}"
    echo "  4. Description: ${CYAN}Test agent for improvement${NC}"
    echo ""
    echo "Add the following code:"
    print_code "
export function calculateTax(amount: number, rate: number): number {
  // Missing semicolon
  const tax = amount * rate
  return tax
}

export function calculateTotal(amount: number, tax: number): number {
  return amount + tax
}"
    echo ""
    echo "  5. Click 'Save'"

    if ! prompt_yes_no "Agent created successfully?"; then
        print_error "Failed to create agent. Please fix and retry."
        return 1
    fi

    print_step "2" "Open Browser Console"
    echo "  1. Press F12 (or Cmd+Option+I on Mac)"
    echo "  2. Click on 'Console' tab"
    echo "  3. Keep console visible"

    prompt_continue

    print_step "3" "Trigger Improvement"
    echo "  1. Find the 'Improve with AI' button (✨ icon)"
    echo "  2. Click it"
    echo "  3. Enter prompt: ${CYAN}Fix the syntax error and improve code${NC}"
    echo "  4. Click 'Improve'"

    prompt_continue

    print_step "4" "Check Console Logs"
    echo "Look for these logs in order:"
    echo ""
    print_check "[ClaudeMdTab] 🚀 Triggering improvement workflow"
    print_check "[ClaudeMdTab] 📋 API Response: {\"planId\":\"...\"}"
    print_check "[ClaudeMdTab] ✅ Plan ID stored"
    print_check "[useImprovementStatus] 🚀 Starting polling for plan: ..."
    print_check "[useImprovementStatus] 📡 Poll attempt 1: status=running"
    print_check "[useImprovementStatus] 📡 Poll attempt N: status=success"
    print_check "[useImprovementStatus] ✅ Status changed to: success"
    print_check "[useImprovementStatus] 🎉 Improvement completed! Opening modal"
    echo ""

    if ! prompt_yes_no "All expected logs appeared?"; then
        print_warning "Some logs missing. Check console for errors."
        return 1
    fi

    print_step "5" "Verify Modal Display"
    echo "Modal should appear with:"
    print_check "Title: 'AI Suggested Improvements'"
    print_check "Comparison view (original vs improved)"
    print_check "Diff highlighting"
    print_check "'Apply Changes' button"
    print_check "'Discard' button"

    if ! prompt_yes_no "Modal displayed correctly?"; then
        print_error "Modal not showing. Check console for errors."
        return 1
    fi

    print_step "6" "Test Approval"
    echo "  1. Click 'Apply Changes'"
    echo "  2. Verify modal closes"
    echo "  3. Verify success toast appears"
    echo "  4. Verify code in editor is updated"
    echo "  5. Check console for: ${CYAN}[ClaudeMdTab] ✅ User approved changes${NC}"

    if ! prompt_yes_no "Approval worked correctly?"; then
        print_error "Approval failed. Check console and network tab."
        return 1
    fi

    echo ""
    print_check "Basic workflow test PASSED"
    return 0
}

test_discard_flow() {
    print_header "Test 2: Discard Flow"

    print_step "1" "Trigger Another Improvement"
    echo "  1. Click 'Improve with AI' button"
    echo "  2. Enter any prompt"
    echo "  3. Click 'Improve'"
    echo "  4. Wait for modal to appear"

    prompt_continue

    print_step "2" "Test Discard"
    echo "  1. Click 'Discard' button"
    echo "  2. Verify modal closes"
    echo "  3. Verify info toast appears"
    echo "  4. Verify code in editor is UNCHANGED"
    echo "  5. Check console for: ${CYAN}[ClaudeMdTab] ❌ User discarded changes${NC}"

    if prompt_yes_no "Discard worked correctly?"; then
        print_check "Discard flow test PASSED"
        return 0
    else
        print_error "Discard failed"
        return 1
    fi
}

test_error_handling() {
    print_header "Test 3: Error Handling"

    print_warning "This test requires stopping the API server temporarily"

    if ! prompt_yes_no "Ready to test error handling?"; then
        print_info "Skipping error handling test"
        return 0
    fi

    print_step "1" "Stop API Server"
    echo "  1. Go to terminal running API server"
    echo "  2. Press Ctrl+C to stop it"

    prompt_continue

    print_step "2" "Try to Trigger Improvement"
    echo "  1. Click 'Improve with AI' button"
    echo "  2. Enter prompt"
    echo "  3. Click 'Improve'"

    prompt_continue

    print_step "3" "Verify Error Handling"
    echo "Should see:"
    print_check "Error toast/notification"
    print_check "Console error logged"
    print_check "Button spinner stops"
    print_check "No modal opens"

    if ! prompt_yes_no "Error handled correctly?"; then
        print_error "Error handling test FAILED"
    fi

    print_step "4" "Restart API Server"
    echo "  1. Go to API terminal"
    echo "  2. Run: ${CYAN}npm run dev${NC}"

    prompt_continue

    print_check "Error handling test PASSED"
    return 0
}

test_race_conditions() {
    print_header "Test 4: Race Condition Prevention"

    print_step "1" "Create Two Agents"
    echo "  1. Create agent: ${CYAN}agent-1${NC}"
    echo "  2. Create agent: ${CYAN}agent-2${NC}"
    echo "  3. Add simple code to both"

    prompt_continue

    print_step "2" "Quick Switch Test"
    echo "  1. Open agent-1"
    echo "  2. Click 'Improve with AI'"
    echo "  3. Immediately switch to agent-2"
    echo "  4. Click 'Improve with AI' on agent-2"
    echo "  5. Wait for both to complete"

    prompt_continue

    print_step "3" "Verify No Race Conditions"
    echo "Check console:"
    print_check "No multiple concurrent polls for same agent"
    print_check "Old polling stops when switching agents"
    print_check "Correct modal opens for correct agent"
    print_check "No 'modal already open' errors"

    if prompt_yes_no "No race conditions detected?"; then
        print_check "Race condition test PASSED"
        return 0
    else
        print_error "Race condition test FAILED"
        return 1
    fi
}

print_summary() {
    print_header "Test Summary"

    echo "Review your test results:"
    echo ""
    print_check "Basic workflow completed"
    print_check "Modal displayed correctly"
    print_check "Approval worked"
    print_check "Discard worked"
    print_check "Error handling tested"
    print_check "No race conditions"
    echo ""
    echo "If all tests passed, the feature is working correctly!"
    echo ""
    print_info "For automated testing, run:"
    print_code "./test-improvement-fix.sh"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    clear

    print_header "🧪 Manual Test Guide: Improve with AI Feature"

    echo "This guide will walk you through manual testing of the"
    echo "'Improve with AI' feature step by step."
    echo ""
    print_warning "Estimated time: 10-15 minutes"
    print_info "Have your browser console open (F12) throughout testing"

    prompt_continue

    # Check prerequisites
    check_prerequisites

    # Run tests
    local result=0

    test_basic_workflow || result=1
    test_discard_flow || result=1

    if prompt_yes_no "Run error handling test? (requires stopping API)"; then
        test_error_handling || result=1
    fi

    if prompt_yes_no "Run race condition test?"; then
        test_race_conditions || result=1
    fi

    # Print summary
    print_summary

    if [ $result -eq 0 ]; then
        echo ""
        print_check "All manual tests PASSED!"
        exit 0
    else
        echo ""
        print_error "Some tests failed. Please review and fix issues."
        exit 1
    fi
}

# Run main
main
