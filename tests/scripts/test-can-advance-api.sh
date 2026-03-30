#!/bin/bash

# Test script for GET /api/kanban/:projectId/can-advance endpoint
# This script tests the new API endpoint that checks if a task can advance based on workflow limits

BASE_URL="http://localhost:8000"
TOKEN=""  # Add your auth token here if needed

echo "======================================"
echo "Testing GET /api/kanban/:projectId/can-advance"
echo "======================================"
echo ""

# Test 1: Get a valid project ID first
echo "Step 1: Fetching available projects..."
PROJECTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Projects response:"
echo "$PROJECTS_RESPONSE" | jq '.'
echo ""

# Extract the first project ID
PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | jq -r '.data[0].id // empty')

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
  echo "❌ ERROR: No projects found. Please create a project first."
  exit 1
fi

echo "✅ Using project ID: $PROJECT_ID"
echo ""

# Test 2: Check if task can advance with default settings
echo "Test 1: Check can-advance with default settings"
echo "----------------------------------------------"
CAN_ADVANCE_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/kanban/${PROJECT_ID}/can-advance" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$CAN_ADVANCE_RESPONSE" | jq '.'
echo ""

# Extract can_advance value
CAN_ADVANCE=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.can_advance')
REASON=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.reason')

if [ "$CAN_ADVANCE" = "true" ]; then
  echo "✅ Task CAN advance: $REASON"
else
  echo "❌ Task CANNOT advance: $REASON"
fi
echo ""

# Test 3: Display current counts
echo "Test 2: Display current counts and limits"
echo "-----------------------------------------"
RUNNING_WORKFLOWS=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.current_counts.running_workflows')
PLANNING_TASKS=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.current_counts.planning_tasks')
IN_PROGRESS_TASKS=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.current_counts.in_progress_tasks')
MAX_CONCURRENT=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.limits.max_concurrent_workflows')
MAX_PLANNING=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.limits.max_planning_tasks')
MAX_IN_PROGRESS=$(echo "$CAN_ADVANCE_RESPONSE" | jq -r '.data.limits.max_in_progress_tasks')

echo "Current Counts:"
echo "  - Running workflows: $RUNNING_WORKFLOWS"
echo "  - Planning tasks: $PLANNING_TASKS"
echo "  - In-progress tasks: $IN_PROGRESS_TASKS"
echo ""
echo "Limits:"
echo "  - Max concurrent workflows: $MAX_CONCURRENT (0 = unlimited)"
echo "  - Max planning tasks: $MAX_PLANNING"
echo "  - Max in-progress tasks: $MAX_IN_PROGRESS"
echo ""

# Test 4: Test with invalid project ID (should return 404)
echo "Test 3: Test with invalid project ID (should return 404)"
echo "--------------------------------------------------------"
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/kanban/invalid-project-id/can-advance" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$INVALID_RESPONSE" | head -n-1)

echo "HTTP Status Code: $HTTP_CODE"
echo "Response:"
echo "$RESPONSE_BODY" | jq '.'
echo ""

if [ "$HTTP_CODE" = "404" ]; then
  echo "✅ Correctly returned 404 for invalid project ID"
else
  echo "❌ Expected 404, got $HTTP_CODE"
fi
echo ""

# Test 5: Update project settings and test again
echo "Test 4: Update project limits and test again"
echo "---------------------------------------------"

# Set strict limits for testing
UPDATE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "max_concurrent_workflows": 5,
      "max_planning_tasks": 2,
      "max_in_progress_tasks": 1
    }
  }')

echo "Updated project settings:"
echo "$UPDATE_RESPONSE" | jq '.data.settings'
echo ""

# Check can-advance again with new limits
CAN_ADVANCE_RESPONSE2=$(curl -s -X GET "${BASE_URL}/api/kanban/${PROJECT_ID}/can-advance" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Response with updated limits:"
echo "$CAN_ADVANCE_RESPONSE2" | jq '.'
echo ""

echo "======================================"
echo "All tests completed!"
echo "======================================"
