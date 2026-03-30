#!/bin/bash

API_URL="http://localhost:3000"
TOKEN="1d10162d2e6fc4f0207eeb72d674881f76aea61d947ccc51"

echo "=== Testing Generate Context API ==="
echo ""

# 1. List all projects
echo "1. Listing all projects..."
curl -s -X GET "$API_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | {id, name}'
echo ""

# 2. Get first project ID
PROJECT_ID=$(curl -s -X GET "$API_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq -r '.data[0].id')

echo "Using project ID: $PROJECT_ID"
echo ""

# 3. List environments for this project
echo "2. Listing environments for project..."
curl -s -X GET "$API_URL/api/projects/$PROJECT_ID/environments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.data[] | {id, name, project_path, git_repository}'
echo ""

# 4. Get first environment ID
ENV_ID=$(curl -s -X GET "$API_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq -r '.data[0].environments[0].id')

echo "Using environment ID: $ENV_ID"
echo ""

# 5. Test generate-context endpoint
echo "3. Testing generate-context endpoint..."
curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/environments/$ENV_ID/generate-context" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "=== Test Complete ==="
