#!/bin/bash

echo "=== Testing Environment Variables Integration ==="
echo ""

# Test 1: Check if API endpoint is accessible
echo "1. Testing API endpoint: GET /api/environment-variables"
curl -s http://localhost:3000/api/environment-variables | jq '.'
echo ""

# Test 2: Initialize default environment variables
echo "2. Initializing default environment variables"
curl -s -X POST http://localhost:3000/api/environment-variables/initialize-defaults | jq '.'
echo ""

# Test 3: Get environment variables defaults
echo "3. Getting environment variables defaults"
curl -s http://localhost:3000/api/environment-variables/defaults | jq '.'
echo ""

# Test 4: Create a new environment variable
echo "4. Creating a new environment variable"
curl -s -X POST http://localhost:3000/api/environment-variables \
  -H "Content-Type: application/json" \
  -d '{
    "key": "TEST_VAR",
    "value": "test_value",
    "description": "Test variable",
    "category": "test",
    "is_secret": false
  }' | jq '.'
echo ""

# Test 5: Get all environment variables
echo "5. Getting all environment variables"
curl -s http://localhost:3000/api/environment-variables | jq '.data[] | {key, value, category}'
echo ""

# Test 6: Update an environment variable
echo "6. Updating TEST_VAR variable"
VAR_ID=$(curl -s http://localhost:3000/api/environment-variables | jq -r '.data[] | select(.key=="TEST_VAR") | .id')
curl -s -X PUT "http://localhost:3000/api/environment-variables/$VAR_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "TEST_VAR",
    "value": "updated_test_value",
    "description": "Updated test variable",
    "category": "test",
    "is_secret": false
  }' | jq '.'
echo ""

# Test 7: Test secret variable
echo "7. Creating a secret variable"
curl -s -X POST http://localhost:3000/api/environment-variables \
  -H "Content-Type: application/json" \
  -d '{
    "key": "SECRET_VAR",
    "value": "my_secret_value",
    "description": "Secret variable for testing",
    "category": "test",
    "is_secret": true
  }' | jq '.'
echo ""

# Test 8: Clean up test variables
echo "8. Cleaning up test variables"
TEST_VAR_ID=$(curl -s http://localhost:3000/api/environment-variables | jq -r '.data[] | select(.key=="TEST_VAR") | .id')
SECRET_VAR_ID=$(curl -s http://localhost:3000/api/environment-variables | jq -r '.data[] | select(.key=="SECRET_VAR") | .id')

if [ -n "$TEST_VAR_ID" ]; then
  curl -s -X DELETE "http://localhost:3000/api/environment-variables/$TEST_VAR_ID" | jq '.'
fi

if [ -n "$SECRET_VAR_ID" ]; then
  curl -s -X DELETE "http://localhost:3000/api/environment-variables/$SECRET_VAR_ID" | jq '.'
fi
echo ""

echo "=== Environment Variables Integration Test Complete ==="
