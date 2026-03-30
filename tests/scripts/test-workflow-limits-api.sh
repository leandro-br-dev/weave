#!/bin/bash
# Test script for workflow limit settings validation in API routes

BASE_URL="http://localhost:8080/api"
TOKEN="test-token" # Replace with valid token

echo "Testing Workflow Limits Validation in API Routes"
echo "==============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Create project with valid workflow limits
echo "Test 1: Create project with valid workflow limits"
echo "------------------------------------------------"
response=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - Valid Limits",
    "description": "Testing valid workflow limits",
    "color": "#00FF00",
    "settings": {
      "max_concurrent_workflows": 5,
      "max_planning_tasks": 2,
      "max_in_progress_tasks": 3
    }
  }')

if echo "$response" | grep -q '"error":null'; then
  echo -e "${GREEN}✓ PASS${NC}: Created project with valid workflow limits"
else
  echo -e "${RED}✗ FAIL${NC}: Failed to create project with valid limits"
  echo "Response: $response"
fi
echo ""

# Test 2: Create project with max_concurrent_workflows = 0 (unlimited)
echo "Test 2: Create project with max_concurrent_workflows = 0 (unlimited)"
echo "--------------------------------------------------------------------"
response=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - Unlimited Workflows",
    "description": "Testing unlimited workflows (0)",
    "color": "#0000FF",
    "settings": {
      "max_concurrent_workflows": 0,
      "max_planning_tasks": 1,
      "max_in_progress_tasks": 1
    }
  }')

if echo "$response" | grep -q '"error":null'; then
  echo -e "${GREEN}✓ PASS${NC}: Created project with unlimited workflows (0)"
else
  echo -e "${RED}✗ FAIL${NC}: Failed to create project with unlimited workflows"
  echo "Response: $response"
fi
echo ""

# Test 3: Reject negative max_concurrent_workflows
echo "Test 3: Reject negative max_concurrent_workflows"
echo "-------------------------------------------------"
response=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - Negative Value",
    "description": "Should fail with negative value",
    "settings": {
      "max_concurrent_workflows": -1
    }
  }')

if echo "$response" | grep -q "must be a non-negative integer"; then
  echo -e "${GREEN}✓ PASS${NC}: Correctly rejected negative value"
else
  echo -e "${RED}✗ FAIL${NC}: Should have rejected negative value"
  echo "Response: $response"
fi
echo ""

# Test 4: Reject non-integer max_planning_tasks
echo "Test 4: Reject non-integer max_planning_tasks"
echo "----------------------------------------------"
response=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - Float Value",
    "description": "Should fail with float value",
    "settings": {
      "max_planning_tasks": 2.5
    }
  }')

if echo "$response" | grep -q "must be a non-negative integer"; then
  echo -e "${GREEN}✓ PASS${NC}: Correctly rejected float value"
else
  echo -e "${RED}✗ FAIL${NC}: Should have rejected float value"
  echo "Response: $response"
fi
echo ""

# Test 5: Reject string value for max_in_progress_tasks
echo "Test 5: Reject string value for max_in_progress_tasks"
echo "------------------------------------------------------"
response=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - String Value",
    "description": "Should fail with string value",
    "settings": {
      "max_in_progress_tasks": "3"
    }
  }')

if echo "$response" | grep -q "must be a non-negative integer"; then
  echo -e "${GREEN}✓ PASS${NC}: Correctly rejected string value"
else
  echo -e "${RED}✗ FAIL${NC}: Should have rejected string value"
  echo "Response: $response"
fi
echo ""

# Test 6: Update project with valid workflow limits
echo "Test 6: Update project with valid workflow limits"
echo "-------------------------------------------------"
# First create a project
create_response=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project - Update Test",
    "description": "Testing update validation"
  }')

project_id=$(echo "$create_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$project_id" ]; then
  # Now update with workflow limits
  update_response=$(curl -s -X PUT "${BASE_URL}/projects/${project_id}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "settings": {
        "max_concurrent_workflows": 10,
        "max_planning_tasks": 5,
        "max_in_progress_tasks": 5
      }
    }')

  if echo "$update_response" | grep -q '"error":null'; then
    echo -e "${GREEN}✓ PASS${NC}: Updated project with valid workflow limits"
  else
    echo -e "${RED}✗ FAIL${NC}: Failed to update project with valid limits"
    echo "Response: $update_response"
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC}: Could not create project for update test"
fi
echo ""

# Test 7: Reject update with invalid workflow limits
echo "Test 7: Reject update with invalid workflow limits"
echo "--------------------------------------------------"
if [ -n "$project_id" ]; then
  update_response=$(curl -s -X PUT "${BASE_URL}/projects/${project_id}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "settings": {
        "max_concurrent_workflows": -5
      }
    }')

  if echo "$update_response" | grep -q "must be a non-negative integer"; then
    echo -e "${GREEN}✓ PASS${NC}: Correctly rejected update with negative value"
  else
    echo -e "${RED}✗ FAIL${NC}: Should have rejected update with negative value"
    echo "Response: $update_response"
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC}: No project available for update validation test"
fi
echo ""

echo "==============================================="
echo "Workflow Limits Validation Tests Complete"
