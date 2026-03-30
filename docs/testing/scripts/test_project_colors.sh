#!/bin/bash

# Project Colors - Automated Setup and Testing Script
# This script helps set up the testing environment and run basic checks

set -e  # Exit on error

echo "=================================="
echo "Project Colors - Testing Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if API is running
echo -n "Checking API server... "
if curl -s http://localhost:3000/api/projects > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Starting API server..."
    cd /root/projects/weave/api
    npx tsx src/index.ts > /tmp/api-server.log 2>&1 &
    echo -e "${YELLOW}Waiting for API to start...${NC}"
    sleep 5
fi

# Check if Dashboard is running
echo -n "Checking Dashboard... "
if curl -s http://localhost:5179 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Starting Dashboard..."
    cd /root/projects/weave/dashboard
    npm run dev > /tmp/dashboard.log 2>&1 &
    echo -e "${YELLOW}Waiting for Dashboard to start...${NC}"
    sleep 5
fi

echo ""
echo "=================================="
echo "Environment Status"
echo "=================================="
echo ""
echo "API Server: http://localhost:3000"
echo "Dashboard:  http://localhost:5179"
echo ""

# Test API endpoint
echo "Testing API endpoint..."
curl -s http://localhost:3000/api/projects | head -20

echo ""
echo "=================================="
echo "Ready for Manual Testing!"
echo "=================================="
echo ""
echo "Next Steps:"
echo "1. Open browser: http://localhost:5179"
echo "2. Navigate to Projects page"
echo "3. Create test projects with different colors"
echo "4. Verify colors appear on all pages"
echo ""
echo "Documentation:"
echo "- Quick Reference: QUICK_TEST_REFERENCE.md"
echo "- Full Guide:      PROJECT_COLORS_TESTING_GUIDE.md"
echo "- Summary:         TESTING_SUMMARY.md"
echo ""

# Open browser (optional - uncomment if needed)
# if command -v xdg-open > /dev/null; then
#     xdg-open http://localhost:5179
# fi
