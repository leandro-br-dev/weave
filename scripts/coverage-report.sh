#!/bin/bash
set -e

# Comprehensive Coverage Report Generator
# This script runs all tests with coverage and generates combined reports

PROJECT_ROOT="/root/projects/weave"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Comprehensive Coverage Report${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create coverage directory
COVERAGE_DIR="$PROJECT_ROOT/coverage-reports"
mkdir -p "$COVERAGE_DIR"

# Clean previous coverage data
echo -e "${YELLOW}Cleaning previous coverage data...${NC}"
rm -rf "$COVERAGE_DIR"/*
rm -rf "$PROJECT_ROOT/htmlcov"*
rm -rf "$PROJECT_ROOT/api/coverage"
rm -rf "$PROJECT_ROOT/dashboard/coverage"
rm -rf "$PROJECT_ROOT/tests/integration/coverage-integration"
rm -f "$PROJECT_ROOT"/*.xml
rm -f "$PROJECT_ROOT"/*.json
find . -name ".coverage" -delete
find . -name "coverage.xml" -delete
find . -name "coverage.json" -delete
echo -e "${GREEN}✓ Cleaned previous coverage data${NC}"
echo ""

# Track coverage results
declare -A RESULTS

# ========================================
# 1. Python Tests Coverage
# ========================================
echo -e "${BLUE}1. Running Python tests with coverage...${NC}"
cd "$PROJECT_ROOT"
if pytest --cov=client --cov=api --cov-report=term-missing \
    --cov-report=html:"$COVERAGE_DIR/htmlcov-python" \
    --cov-report=xml:"$COVERAGE_DIR/coverage-python.xml" \
    --cov-report=json:"$COVERAGE_DIR/coverage-python.json" \
    --no-cov-on-fail -x; then
    PYTHON_PASSED=true
    echo -e "${GREEN}✓ Python tests passed${NC}"
else
    PYTHON_PASSED=false
    echo -e "${RED}✗ Python tests failed${NC}"
fi
echo ""

# Extract Python coverage percentage
if [ -f "$COVERAGE_DIR/coverage-python.json" ]; then
    PYTHON_COV=$(python3 -c "import json; print(json.load(open('$COVERAGE_DIR/coverage-python.json'))['totals']['percent_covered'])" 2>/dev/null || echo "0")
    RESULTS["Python"]=$PYTHON_COV
    echo -e "${GREEN}Python Coverage: ${PYTHON_COV}%${NC}"
else
    RESULTS["Python"]="0"
    echo -e "${RED}Python Coverage: N/A${NC}"
fi
echo ""

# ========================================
# 2. API Tests Coverage
# ========================================
echo -e "${BLUE}2. Running API tests with coverage...${NC}"
cd "$PROJECT_ROOT/api"
if npm run test:coverage -- --run --reporter=verbose; then
    API_PASSED=true
    echo -e "${GREEN}✓ API tests passed${NC}"
else
    API_PASSED=false
    echo -e "${RED}✗ API tests failed${NC}"
fi
echo ""

# Move API coverage to reports directory
if [ -d "coverage" ]; then
    mv coverage "$COVERAGE_DIR/coverage-api"
fi

# Extract API coverage percentage
if [ -f "$COVERAGE_DIR/coverage-api/coverage-final.json" ]; then
    API_COV=$(node -e "const data = require('$COVERAGE_DIR/coverage-api/coverage-final.json'); const total = Object.values(data).reduce((acc, file) => acc + (file.t?.p?.pct || 0), 0); const count = Object.keys(data).length; console.log(count > 0 ? Math.round(total / count) : 0)" 2>/dev/null || echo "0")
    RESULTS["API"]=$API_COV
    echo -e "${GREEN}API Coverage: ${API_COV}%${NC}"
else
    RESULTS["API"]="0"
    echo -e "${RED}API Coverage: N/A${NC}"
fi
echo ""

# ========================================
# 3. Dashboard Tests Coverage
# ========================================
echo -e "${BLUE}3. Running Dashboard tests with coverage...${NC}"
cd "$PROJECT_ROOT/dashboard"
if npm run test:coverage -- --run --reporter=verbose; then
    DASHBOARD_PASSED=true
    echo -e "${GREEN}✓ Dashboard tests passed${NC}"
else
    DASHBOARD_PASSED=false
    echo -e "${RED}✗ Dashboard tests failed${NC}"
fi
echo ""

# Move Dashboard coverage to reports directory
if [ -d "coverage" ]; then
    mv coverage "$COVERAGE_DIR/coverage-dashboard"
fi

# Extract Dashboard coverage percentage
if [ -f "$COVERAGE_DIR/coverage-dashboard/coverage-final.json" ]; then
    DASHBOARD_COV=$(node -e "const data = require('$COVERAGE_DIR/coverage-dashboard/coverage-final.json'); const total = Object.values(data).reduce((acc, file) => acc + (file.t?.p?.pct || 0), 0); const count = Object.keys(data).length; console.log(count > 0 ? Math.round(total / count) : 0)" 2>/dev/null || echo "0")
    RESULTS["Dashboard"]=$DASHBOARD_COV
    echo -e "${GREEN}Dashboard Coverage: ${DASHBOARD_COV}%${NC}"
else
    RESULTS["Dashboard"]="0"
    echo -e "${RED}Dashboard Coverage: N/A${NC}"
fi
echo ""

# ========================================
# 4. Integration Tests Coverage
# ========================================
echo -e "${BLUE}4. Running Integration tests with coverage...${NC}"
cd "$PROJECT_ROOT"
if npx vitest --config tests/integration/vitest.config.ts run --coverage; then
    INTEGRATION_PASSED=true
    echo -e "${GREEN}✓ Integration tests passed${NC}"
else
    INTEGRATION_PASSED=false
    echo -e "${RED}✗ Integration tests failed${NC}"
fi
echo ""

# Move Integration coverage to reports directory
if [ -d "tests/integration/coverage-integration" ]; then
    mv tests/integration/coverage-integration "$COVERAGE_DIR/coverage-integration"
fi

# Extract Integration coverage percentage
if [ -f "$COVERAGE_DIR/coverage-integration/coverage-final.json" ]; then
    INTEGRATION_COV=$(node -e "const data = require('$COVERAGE_DIR/coverage-integration/coverage-final.json'); const total = Object.values(data).reduce((acc, file) => acc + (file.t?.p?.pct || 0), 0); const count = Object.keys(data).length; console.log(count > 0 ? Math.round(total / count) : 0)" 2>/dev/null || echo "0")
    RESULTS["Integration"]=$INTEGRATION_COV
    echo -e "${GREEN}Integration Coverage: ${INTEGRATION_COV}%${NC}"
else
    RESULTS["Integration"]="0"
    echo -e "${RED}Integration Coverage: N/A${NC}"
fi
echo ""

# ========================================
# 5. Generate Combined Report
# ========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Coverage Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Calculate overall coverage
TOTAL_COV=0
COUNT=0
for key in "${!RESULTS[@]}"; do
    value=${RESULTS[$key]}
    if [ "$value" != "0" ] && [ "$value" != "N/A" ]; then
        TOTAL_COV=$((TOTAL_COV + value))
        COUNT=$((COUNT + 1))
    fi
    echo -e "${NC}$key: ${value}%"
done

OVERALL_COV=0
if [ $COUNT -gt 0 ]; then
    OVERALL_COV=$((TOTAL_COV / COUNT))
fi

echo ""
echo -e "${BLUE}Overall Coverage: ${OVERALL_COV}%${NC}"
echo ""

# Check against thresholds
OVERALL_THRESHOLD=70
if [ $OVERALL_COV -lt $OVERALL_THRESHOLD ]; then
    echo -e "${RED}✗ Overall coverage ${OVERALL_COV}% is below threshold ${OVERALL_THRESHOLD}%${NC}"
else
    echo -e "${GREEN}✓ Overall coverage ${OVERALL_COV}% meets threshold ${OVERALL_THRESHOLD}%${NC}"
fi
echo ""

# ========================================
# 6. Generate Coverage Badge
# ========================================
echo -e "${BLUE}Generating coverage badge...${NC}"
BADGE_COLOR="red"
if [ $OVERALL_COV -ge 70 ]; then
    BADGE_COLOR="green"
elif [ $OVERALL_COV -ge 50 ]; then
    BADGE_COLOR="yellow"
fi

cat > "$COVERAGE_DIR/coverage-badge.svg" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="120" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h70v20H0z"/>
    <path fill="$BADGE_COLOR" d="M70 0h50v20H70z"/>
    <path fill="url(#b)" d="M0 0h120v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="35" y="15" fill="#010101" fill-opacity=".3">coverage</text>
    <text x="35" y="14">coverage</text>
    <text x="95" y="15" fill="#010101" fill-opacity=".3">${OVERALL_COV}%</text>
    <text x="95" y="14">${OVERALL_COV}%</text>
  </g>
</svg>
EOF
echo -e "${GREEN}✓ Badge generated: $COVERAGE_DIR/coverage-badge.svg${NC}"
echo ""

# ========================================
# 7. Generate JSON Summary
# ========================================
echo -e "${BLUE}Generating JSON summary...${NC}"
cat > "$COVERAGE_DIR/coverage-summary.json" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "overall_coverage": $OVERALL_COV,
  "threshold": $OVERALL_THRESHOLD,
  "meets_threshold": $( [ $OVERALL_COV -ge $OVERALL_THRESHOLD ] && echo "true" || echo "false" ),
  "modules": {
    "python": {
      "coverage": ${RESULTS[Python]},
      "passed": $PYTHON_PASSED
    },
    "api": {
      "coverage": ${RESULTS[API]},
      "passed": $API_PASSED
    },
    "dashboard": {
      "coverage": ${RESULTS[Dashboard]},
      "passed": $DASHBOARD_PASSED
    },
    "integration": {
      "coverage": ${RESULTS[Integration]},
      "passed": $INTEGRATION_PASSED
    }
  }
}
EOF
echo -e "${GREEN}✓ JSON summary generated: $COVERAGE_DIR/coverage-summary.json${NC}"
echo ""

# ========================================
# 8. Print Report Locations
# ========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Report Locations${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "All reports saved to: ${GREEN}$COVERAGE_DIR${NC}"
echo ""
echo -e "HTML Reports:"
echo -e "  Python:       $COVERAGE_DIR/htmlcov-python/index.html"
echo -e "  API:          $COVERAGE_DIR/coverage-api/index.html"
echo -e "  Dashboard:    $COVERAGE_DIR/coverage-dashboard/index.html"
echo -e "  Integration:  $COVERAGE_DIR/coverage-integration/index.html"
echo ""
echo -e "Other Reports:"
echo -e "  Summary:      $COVERAGE_DIR/coverage-summary.json"
echo -e "  Badge:        $COVERAGE_DIR/coverage-badge.svg"
echo ""

# ========================================
# 9. Open HTML Report (optional)
# ========================================
if [ "$1" == "--open" ] || [ "$1" == "-o" ]; then
    echo -e "${BLUE}Opening HTML report in browser...${NC}"
    if command -v xdg-open > /dev/null; then
        xdg-open "$COVERAGE_DIR/htmlcov-python/index.html"
    elif command -v open > /dev/null; then
        open "$COVERAGE_DIR/htmlcov-python/index.html"
    else
        echo -e "${YELLOW}Could not open browser automatically${NC}"
        echo -e "Please open the HTML report manually at:"
        echo -e "$COVERAGE_DIR/htmlcov-python/index.html"
    fi
fi

# ========================================
# 10. Exit with appropriate code
# ========================================
if [ $OVERALL_COV -lt $OVERALL_THRESHOLD ]; then
    echo -e "${RED}Exiting with error code 1 (coverage below threshold)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Coverage report generated successfully${NC}"
exit 0
