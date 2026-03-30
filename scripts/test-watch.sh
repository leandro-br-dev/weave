#!/bin/bash

# Test Watch Mode for Agents Manager
# Runs tests in watch mode for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [FILTER]

Watch mode test runner for Agents Manager

OPTIONS:
    -a, --all         Watch all test suites (default)
    -p, --python      Watch Python tests only
    -d, --dashboard   Watch Dashboard tests only
    -i, --integration Watch Integration tests only
    -h, --help        Show this help message

FILTER:
    Optional filter pattern to run specific tests
    Example: $0 --api "auth.*test"

EXAMPLES:
    $0                    # Watch all tests
    $0 --api             # Watch API tests only
    $0 --python "test_*"  # Watch Python tests matching pattern
EOF
}

# Default values
WATCH_ALL=false
WATCH_PYTHON=false
WATCH_API=false
WATCH_DASHBOARD=false
WATCH_INTEGRATION=false
FILTER=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            WATCH_ALL=true
            shift
            ;;
        -p|--python)
            WATCH_PYTHON=true
            shift
            ;;
        --api)
            WATCH_API=true
            shift
            ;;
        -d|--dashboard)
            WATCH_DASHBOARD=true
            shift
            ;;
        -i|--integration)
            WATCH_INTEGRATION=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            FILTER="$1"
            shift
            ;;
    esac
done

# If no specific watch mode selected, watch all
if [ "$WATCH_ALL" = false ] && [ "$WATCH_PYTHON" = false ] && [ "$WATCH_API" = false ] && [ "$WATCH_DASHBOARD" = false ] && [ "$WATCH_INTEGRATION" = false ]; then
    WATCH_ALL=true
fi

print_status "${YELLOW}" "👀 Watch Mode Test Runner"
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to run watch mode for a test suite
run_watch() {
    local suite_name=$1
    local command=$2
    local directory=$3

    print_status "${GREEN}" "▶ Starting watch mode for: ${suite_name}"
    echo ""

    if [ -n "$directory" ]; then
        cd "$directory" || exit 1
    fi

    eval "$command"

    if [ -n "$directory" ]; then
        cd - > /dev/null
    fi
}

# Run watch modes based on selection
if [ "$WATCH_ALL" = true ] || [ "$WATCH_API" = true ]; then
    if [ -f "api/package.json" ]; then
        if [ -n "$FILTER" ]; then
            run_watch "API Tests" "npm run test --prefix api -- --watch -- $FILTER" ""
        else
            run_watch "API Tests" "npm run test --prefix api -- --watch" ""
        fi
    else
        print_status "${YELLOW}" "⚠ API directory not found, skipping"
    fi
fi

if [ "$WATCH_ALL" = true ] || [ "$WATCH_DASHBOARD" = true ]; then
    if [ -f "dashboard/package.json" ]; then
        if [ -n "$FILTER" ]; then
            run_watch "Dashboard Tests" "npm run test --prefix dashboard -- --watch -- $FILTER" ""
        else
            run_watch "Dashboard Tests" "npm run test --prefix dashboard -- --watch" ""
        fi
    else
        print_status "${YELLOW}" "⚠ Dashboard directory not found, skipping"
    fi
fi

if [ "$WATCH_ALL" = true ] || [ "$WATCH_PYTHON" = true ]; then
    if command_exists pytest; then
        if [ -n "$FILTER" ]; then
            run_watch "Python Tests" "pytest tests/ -v -f \"$FILTER\"" ""
        else
            # Python doesn't have native watch mode, suggest pytest-watch
            print_status "${YELLOW}" "⚠ Python tests don't have native watch mode"
            print_status "${YELLOW}" "💡 Install pytest-watch for watch mode: pip install pytest-watch"
            print_status "${YELLOW}" "   Then run: ptw tests/ -- -v"
        fi
    else
        print_status "${YELLOW}" "⚠ pytest not found, skipping Python tests"
    fi
fi

if [ "$WATCH_ALL" = true ] || [ "$WATCH_INTEGRATION" = true ]; then
    if [ -f "tests/integration/vitest.config.ts" ]; then
        if [ -n "$FILTER" ]; then
            run_watch "Integration Tests" "vitest --config tests/integration/vitest.config.ts --watch -- $FILTER" ""
        else
            run_watch "Integration Tests" "vitest --config tests/integration/vitest.config.ts --watch" ""
        fi
    else
        print_status "${YELLOW}" "⚠ Integration tests not found, skipping"
    fi
fi

echo ""
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_status "${GREEN}" "✓ Watch mode started for selected test suites"
print_status "${YELLOW}" "💡 Press Ctrl+C to stop watching"
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Keep script running
wait
