#!/bin/bash

# Unified Test Runner for Agents Manager
# This script runs all test suites in the correct order and generates combined reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
FAILED_TESTS=0
PASSED_TESTS=0
TOTAL_TESTS=0
declare -a FAILED_SUITES=()

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run a test suite
run_test_suite() {
    local suite_name=$1
    local suite_command=$2
    local suite_dir=$3

    print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_status "${BLUE}" "Running: ${suite_name}"
    print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ -n "$suite_dir" ]; then
        cd "$suite_dir" || exit 1
    fi

    if eval "$suite_command"; then
        print_status "${GREEN}" "✓ ${suite_name} PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        [ -n "$suite_dir" ] && cd - > /dev/null
        return 0
    else
        print_status "${RED}" "✗ ${suite_name} FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_SUITES+=("$suite_name")
        [ -n "$suite_dir" ] && cd - > /dev/null
        return 1
    fi
}

# Function to print summary
print_summary() {
    echo ""
    print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_status "${BLUE}" "Test Summary"
    print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Total Suites: ${TOTAL_TESTS}"
    print_status "${GREEN}" "Passed: ${PASSED_TESTS}"
    [ ${FAILED_TESTS} -gt 0 ] && print_status "${RED}" "Failed: ${FAILED_TESTS}"

    if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
        echo ""
        print_status "${RED}" "Failed Suites:"
        for suite in "${FAILED_SUITES[@]}"; do
            echo "  - ${suite}"
        done
    fi

    print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main execution
main() {
    local test_type=${1:-all}
    local start_time=$(date +%s)

    print_status "${YELLOW}" "🧪 Agents Manager Test Runner"
    print_status "${YELLOW}" "Test Type: ${test_type}"
    echo ""

    case "$test_type" in
        all)
            run_test_suite "Python Unit Tests" "pytest tests/ -v" ""
            run_test_suite "API Tests" "npm run test --prefix api" ""
            run_test_suite "Dashboard Tests" "npm run test --prefix dashboard" ""
            run_test_suite "Integration Tests" "vitest --config tests/integration/vitest.config.ts --run" ""
            ;;
        python)
            run_test_suite "Python Tests" "pytest tests/ -v" ""
            ;;
        api)
            run_test_suite "API Tests" "npm run test --prefix api" ""
            ;;
        dashboard)
            run_test_suite "Dashboard Tests" "npm run test --prefix dashboard" ""
            ;;
        integration)
            run_test_suite "Integration Tests" "vitest --config tests/integration/vitest.config.ts --run" ""
            ;;
        unit)
            run_test_suite "Python Unit Tests" "pytest tests/unit -v" ""
            run_test_suite "API Unit Tests" "npm run test --prefix api -- --run" ""
            ;;
        ci)
            print_status "${BLUE}" "Running tests in CI mode..."
            run_test_suite "Python Unit Tests" "pytest tests/ -v --tb=short" ""
            run_test_suite "API Tests" "npm run test --prefix api -- --run --reporter=verbose" ""
            run_test_suite "Dashboard Tests" "npm run test --prefix dashboard -- --run --reporter=verbose" ""
            run_test_suite "Integration Tests" "vitest --config tests/integration/vitest.config.ts --run" ""
            ;;
        *)
            print_status "${RED}" "Unknown test type: ${test_type}"
            echo "Usage: $0 [all|python|api|dashboard|integration|unit|ci]"
            exit 1
            ;;
    esac

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    print_summary
    echo "Duration: ${duration}s"
    echo ""

    # Exit with error if any tests failed
    if [ ${FAILED_TESTS} -gt 0 ]; then
        exit 1
    fi

    exit 0
}

# Run main function
main "$@"
