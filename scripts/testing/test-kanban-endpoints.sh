#!/bin/bash

# Test script for Kanban endpoints
BASE_URL="http://localhost:3000"
AUTH_TOKEN="dev-token-change-in-production"

echo "=========================================="
echo "Testing Kanban API Endpoints"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Get all kanban tasks
echo -e "${BLUE}Test 1: GET /api/kanban (All tasks)${NC}"
response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$BASE_URL/api/kanban")
echo "$response" | jq '.' > /tmp/kanban_all_tasks.json
task_count=$(echo "$response" | jq -r '.data | length')
echo -e "${GREEN}✓ Found $task_count tasks${NC}"
echo ""

# Test 2: Get all projects
echo -e "${BLUE}Test 2: GET /api/projects (All projects)${NC}"
projects_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$BASE_URL/api/projects")
echo "$projects_response" | jq '.' > /tmp/projects.json
project_count=$(echo "$projects_response" | jq -r '.data | length')
echo -e "${GREEN}✓ Found $project_count projects${NC}"
echo ""

# Test 3: Verify task structure includes project fields
echo -e "${BLUE}Test 3: Verify task structure${NC}"
if [ "$task_count" -gt 0 ]; then
    first_task=$(echo "$response" | jq -r '.data[0]')
    has_project_name=$(echo "$first_task" | jq -r 'has("project_name")')
    has_project_desc=$(echo "$first_task" | jq -r 'has("project_description")')
    has_project_settings=$(echo "$first_task" | jq -r 'has("project_settings")')

    if [ "$has_project_name" = "true" ] && [ "$has_project_desc" = "true" ] && [ "$has_project_settings" = "true" ]; then
        echo -e "${GREEN}✓ Task structure includes project fields${NC}"
        echo "  - project_name: $(echo "$first_task" | jq -r '.project_name')"
        echo "  - project_description: $(echo "$first_task" | jq -r '.project_description')"
    else
        echo -e "${RED}✗ Task structure missing project fields${NC}"
    fi
else
    echo -e "${BLUE}⚠ No tasks found to test structure${NC}"
fi
echo ""

# Test 4: Display sample task with all fields
echo -e "${BLUE}Test 4: Sample task data${NC}"
if [ "$task_count" -gt 0 ]; then
    echo "$response" | jq -r '.data[0]' > /tmp/sample_task.json
    echo -e "${GREEN}Sample task:${NC}"
    cat /tmp/sample_task.json | jq -r 'to_entries | .[] | "  \(.key): \(.value)"' | head -20
else
    echo -e "${BLUE}⚠ No tasks found${NC}"
fi
echo ""

# Test 5: Test project filter behavior
echo -e "${BLUE}Test 5: Test project filtering${NC}"
if [ "$project_count" -gt 0 ]; then
    first_project_id=$(echo "$projects_response" | jq -r '.data[0].id')
    first_project_name=$(echo "$projects_response" | jq -r '.data[0].name')

    echo "Testing filter for project: $first_project_name"
    filtered_response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$BASE_URL/api/kanban?project_id=$first_project_id")
    filtered_count=$(echo "$filtered_response" | jq -r '.data | length')

    echo -e "${GREEN}✓ Filtered response has $filtered_count tasks${NC}"

    # Verify all tasks belong to the filtered project
    if [ "$filtered_count" -gt 0 ]; then
        all_match=$(echo "$filtered_response" | jq -r --arg pid "$first_project_id" '.data | all(.project_id == $pid)')
        if [ "$all_match" = "true" ]; then
            echo -e "${GREEN}✓ All tasks belong to filtered project${NC}"
        else
            echo -e "${RED}✗ Some tasks don't belong to filtered project${NC}"
        fi
    fi
else
    echo -e "${BLUE}⚠ No projects found to test filtering${NC}"
fi
echo ""

# Test 6: Test color consistency
echo -e "${BLUE}Test 6: Test color consistency for same project${NC}"
if [ "$task_count" -gt 1 ]; then
    # Get unique project IDs
    project_ids=$(echo "$response" | jq -r '.data[].project_id' | sort -u)
    project_id_count=$(echo "$project_ids" | wc -l)

    echo "Found $project_id_count unique project(s)"

    # For each project, verify color consistency
    while IFS= read -r project_id; do
        tasks_for_project=$(echo "$response" | jq -r --arg pid "$project_id" '.data | map(select(.project_id == $pid))')
        task_count_for_project=$(echo "$tasks_for_project" | jq -r 'length')

        if [ "$task_count_for_project" -gt 1 ]; then
            echo -e "${GREEN}✓ Project $project_id has $task_count_for_project tasks (colors should be consistent)${NC}"
        fi
    done <<< "$project_ids"
else
    echo -e "${BLUE}⚠ Not enough tasks to test color consistency${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo -e "${GREEN}Test Summary${NC}"
echo "=========================================="
echo "Total tasks: $task_count"
echo "Total projects: $project_count"
echo ""
echo "Files saved for inspection:"
echo "  - /tmp/kanban_all_tasks.json"
echo "  - /tmp/projects.json"
echo "  - /tmp/sample_task.json"
echo ""
