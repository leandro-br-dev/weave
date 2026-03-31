#!/bin/bash

# Coverage Report Generator for Weave
# Generates and combines coverage reports for all test types

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Coverage thresholds
MIN_COVERAGE=70
BRANCH_COVERAGE=60

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Create coverage directory
mkdir -p coverage-reports

print_status "${YELLOW}" "📊 Coverage Report Generator"
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Python coverage
print_status "${BLUE}" "Generating Python coverage..."
if command_exists pytest; then
    cd tests
    pytest --cov=client \
           --cov-report=html:../coverage-reports/python-html \
           --cov-report=term-missing \
           --cov-report=json:../coverage-reports/python-coverage.json \
           --cov-fail-under=${MIN_COVERAGE} || {
        print_status "${YELLOW}" "⚠ Python coverage below threshold or tests failed"
    }
    cd ..

    # Extract coverage percentage from JSON
    if [ -f coverage-reports/python-coverage.json ]; then
        PYTHON_COV=$(python3 -c "import json; print(json.load(open('coverage-reports/python-coverage.json'))['totals']['percent_covered'])" 2>/dev/null || echo "0")
        print_status "${GREEN}" "✓ Python Coverage: ${PYTHON_COV}%"
    fi
else
    print_status "${YELLOW}" "⚠ pytest not found, skipping Python coverage"
    PYTHON_COV="N/A"
fi

echo ""

# API coverage
print_status "${BLUE}" "Generating API coverage..."
if [ -f "api/package.json" ]; then
    cd api
    npm run test -- --coverage \
        --coverageReporters="html" \
        --coverageReporters="json" \
        --coverageReporters="lcov" \
        --coverageReporters="text" \
        --coverageThreshold='{"global":{"lines":'${MIN_COVERAGE}',"branches":'${BRANCH_COVERAGE}'}}' || {
        print_status "${YELLOW}" "⚠ API coverage below threshold or tests failed"
    }

    # Move coverage reports to main directory
    if [ -d coverage ]; then
        mv coverage ../coverage-reports/api-html
    fi
    if [ -f coverage/coverage-final.json ]; then
        mv coverage/coverage-final.json ../coverage-reports/api-coverage.json
    fi
    if [ -f coverage/lcov.info ]; then
        mv coverage/lcov.info ../coverage-reports/api-lcov.info
    fi

    cd ..

    # Extract coverage percentage
    if [ -f coverage-reports/api-coverage.json ]; then
        API_COV=$(node -e "const data=require('./coverage-reports/api-coverage.json'); console.log(Math.round(data.total.lines.pct))" 2>/dev/null || echo "0")
        print_status "${GREEN}" "✓ API Coverage: ${API_COV}%"
    fi
else
    print_status "${YELLOW}" "⚠ API directory not found, skipping API coverage"
    API_COV="N/A"
fi

echo ""

# Dashboard coverage
print_status "${BLUE}" "Generating Dashboard coverage..."
if [ -f "dashboard/package.json" ]; then
    cd dashboard
    npm run test -- --coverage \
        --coverageReporters="html" \
        --coverageReporters="json" \
        --coverageReporters="lcov" \
        --coverageReporters="text" \
        --coverageThreshold='{"global":{"lines":'${MIN_COVERAGE}',"branches":'${BRANCH_COVERAGE}'}}' || {
        print_status "${YELLOW}" "⚠ Dashboard coverage below threshold or tests failed"
    }

    # Move coverage reports to main directory
    if [ -d coverage ]; then
        mv coverage ../coverage-reports/dashboard-html
    fi
    if [ -f coverage/coverage-final.json ]; then
        mv coverage/coverage-final.json ../coverage-reports/dashboard-coverage.json
    fi
    if [ -f coverage/lcov.info ]; then
        mv coverage/lcov.info ../coverage-reports/dashboard-lcov.info
    fi

    cd ..

    # Extract coverage percentage
    if [ -f coverage-reports/dashboard-coverage.json ]; then
        DASHBOARD_COV=$(node -e "const data=require('./coverage-reports/dashboard-coverage.json'); console.log(Math.round(data.total.lines.pct))" 2>/dev/null || echo "0")
        print_status "${GREEN}" "✓ Dashboard Coverage: ${DASHBOARD_COV}%"
    fi
else
    print_status "${YELLOW}" "⚠ Dashboard directory not found, skipping Dashboard coverage"
    DASHBOARD_COV="N/A"
fi

echo ""

# Integration test coverage
print_status "${BLUE}" "Generating Integration test coverage..."
if [ -f "tests/integration/vitest.config.ts" ]; then
    cd tests/integration
    vitest run --coverage \
        --coverage.reporter="html" \
        --coverage.reporter="json" \
        --coverage.reporter="lcov" \
        --coverage.reporter="text" || {
        print_status "${YELLOW}" "⚠ Integration coverage below threshold or tests failed"
    }

    # Move coverage reports to main directory
    if [ -d coverage ]; then
        mv coverage ../../coverage-reports/integration-html
    fi
    if [ -f coverage/coverage-final.json ]; then
        mv coverage/coverage-final.json ../../coverage-reports/integration-coverage.json
    fi
    if [ -f coverage/lcov.info ]; then
        mv coverage/lcov.info ../../coverage-reports/integration-lcov.info
    fi

    cd ../..

    # Extract coverage percentage
    if [ -f coverage-reports/integration-coverage.json ]; then
        INT_COV=$(node -e "const data=require('./coverage-reports/integration-coverage.json'); console.log(Math.round(data.total.lines.pct))" 2>/dev/null || echo "0")
        print_status "${GREEN}" "✓ Integration Coverage: ${INT_COV}%"
    fi
else
    print_status "${YELLOW}" "⚠ Integration tests not found, skipping Integration coverage"
    INT_COV="N/A"
fi

echo ""

# Combine LCOV reports
print_status "${BLUE}" "Combining coverage reports..."
if ls coverage-reports/*-lcov.info 1> /dev/null 2>&1; then
    cat coverage-reports/*-lcov.info > coverage-reports/lcov.info
    print_status "${GREEN}" "✓ Combined LCOV report created: coverage-reports/lcov.info"
else
    print_status "${YELLOW}" "⚠ No LCOV reports found to combine"
fi

# Create combined HTML summary
print_status "${BLUE}" "Creating coverage summary..."
cat > coverage-reports/SUMMARY.md << EOF
# Coverage Report Summary

Generated: $(date)

## Coverage by Module

| Module | Coverage |
|--------|----------|
| Python | ${PYTHON_COV}% |
| API | ${API_COV}% |
| Dashboard | ${DASHBOARD_COV}% |
| Integration | ${INT_COV}% |

## Thresholds

- Minimum Coverage: ${MIN_COVERAGE}%
- Branch Coverage: ${BRANCH_COVERAGE}%

## Reports

- Python HTML: \`coverage-reports/python-html/index.html\`
- API HTML: \`coverage-reports/api-html/index.html\`
- Dashboard HTML: \`coverage-reports/dashboard-html/index.html\`
- Integration HTML: \`coverage-reports/integration-html/index.html\`
- Combined LCOV: \`coverage-reports/lcov.info\`

## Viewing Reports

Open individual HTML reports in your browser to view detailed coverage information.

EOF

print_status "${GREEN}" "✓ Coverage summary created: coverage-reports/SUMMARY.md"

echo ""
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_status "${YELLOW}" "📊 Coverage Summary"
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Python:        ${PYTHON_COV}%"
echo "API:           ${API_COV}%"
echo "Dashboard:     ${DASHBOARD_COV}%"
echo "Integration:   ${INT_COV}%"
print_status "${BLUE}" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_status "${GREEN}" "✓ Coverage reports generated in coverage-reports/"
print_status "${YELLOW}" "💡 Open coverage-reports/*/index.html in your browser to view detailed reports"

# Check if overall coverage meets threshold
if [ "$PYTHON_COV" != "N/A" ] && [ "$API_COV" != "N/A" ] && [ "$DASHBOARD_COV" != "N/A" ]; then
    # Convert to integers for comparison
    PYTHON_INT=${PYTHON_COV%.*}
    API_INT=${API_COV%.*}
    DASHBOARD_INT=${DASHBOARD_COV%.*}

    if [ "$PYTHON_INT" -lt ${MIN_COVERAGE} ] || [ "$API_INT" -lt ${MIN_COVERAGE} ] || [ "$DASHBOARD_INT" -lt ${MIN_COVERAGE} ]; then
        print_status "${RED}" "✗ Coverage below ${MIN_COVERAGE}% threshold"
        exit 1
    fi
fi

exit 0
