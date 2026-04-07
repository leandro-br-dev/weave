#!/bin/bash

# Verification script to check if all workflow components are in place

echo "=== Verifying CLAUDE.md Improvement Workflow Setup ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

success_count=0
fail_count=0

check_file() {
    local file=$1
    local description=$2

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        ((success_count++))
        return 0
    else
        echo -e "${RED}✗${NC} $description: $file"
        ((fail_count++))
        return 1
    fi
}

check_content() {
    local file=$1
    local pattern=$2
    local description=$3

    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((success_count++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((fail_count++))
        return 1
    fi
}

echo "Checking files..."
echo ""

# Core files
check_file "/root/projects/weave/projects/weave/agents/planner/CLAUDE.md" \
    "Planner agent CLAUDE.md"

check_file "/root/projects/weave/api/src/routes/workspaces.ts" \
    "Workspaces routes"

check_file "/root/projects/weave/api/src/routes/plans.ts" \
    "Plans routes"

echo ""
echo "Checking planner agent configuration..."
echo ""

# Check planner agent has instructions about structured output
check_content "/root/projects/weave/projects/weave/agents/planner/CLAUDE.md" \
    "structured.*output" \
    "Planner agent has structured output instructions"

check_content "/root/projects/weave/projects/weave/agents/planner/CLAUDE.md" \
    "POST.*structured-output" \
    "Planner agent knows about the endpoint"

check_content "/root/projects/weave/projects/weave/agents/planner/CLAUDE.md" \
    "API_BEARER_TOKEN" \
    "Planner agent knows about authentication"

check_content "/root/projects/weave/projects/weave/agents/planner/CLAUDE.md" \
    "curl" \
    "Planner agent has curl examples"

echo ""
echo "Checking API endpoints..."
echo ""

# Check workspaces.ts has the improvement endpoint
check_content "/root/projects/weave/api/src/routes/workspaces.ts" \
    "improve-claude-md" \
    "Workspaces has improvement endpoint"

check_content "/root/projects/weave/api/src/routes/workspaces.ts" \
    "improvedContent" \
    "Workspaces mentions improvedContent in prompt"

check_content "/root/projects/weave/api/src/routes/workspaces.ts" \
    "structured-output" \
    "Workspaces instructs to save structured output"

# Check plans.ts has the structured output endpoint
check_content "/root/projects/weave/api/src/routes/plans.ts" \
    "/structured-output" \
    "Plans has structured output endpoint"

check_content "/root/projects/weave/api/src/routes/plans.ts" \
    "structured_output.*=" \
    "Plans endpoint saves structured_output to database"

echo ""
echo "Checking prompt instructions..."
echo ""

# Verify the prompt is clear about JSON format
check_content "/root/projects/weave/api/src/routes/workspaces.ts" \
    'JSON block' \
    "Prompt specifies JSON block format"

check_content "/root/projects/weave/api/src/routes/workspaces.ts" \
    'curl.*POST.*structured-output' \
    "Prompt includes curl example"

echo ""
echo "Checking documentation..."
echo ""

check_file "/root/projects/weave/IMPROVEMENT_WORKFLOW.md" \
    "Workflow documentation"

check_file "/root/projects/weave/test-improvement-workflow.sh" \
    "Test script"

check_content "/root/projects/weave/test-improvement-workflow.sh" \
    "test_save_structured_output" \
    "Test script includes structured output test"

echo ""
echo "=== Summary ==="
echo -e "${GREEN}Passed:${NC} $success_count"
echo -e "${RED}Failed:${NC} $fail_count"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run the test script: ./test-improvement-workflow.sh"
    echo "2. Or test manually via the dashboard"
    echo "3. Check that planner agent saves structured output when executing improvement tasks"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review the output above.${NC}"
    exit 1
fi
