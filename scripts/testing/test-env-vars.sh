#!/bin/bash

# Test script for environment variables API

BASE_URL="http://localhost:3000"

echo "=== Testing Environment Variables API ==="
echo ""

# Test 1: Initialize default environment variables
echo "1. Initializing default environment variables..."
curl -X POST "$BASE_URL/api/environment-variables/initialize-defaults" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" | jq '.'
echo ""
echo ""

# Test 2: Get all environment variables
echo "2. Getting all environment variables..."
curl -X GET "$BASE_URL/api/environment-variables" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" | jq '.'
echo ""
echo ""

# Test 3: Get default environment variables
echo "3. Getting default environment variables..."
curl -X GET "$BASE_URL/api/environment-variables/defaults" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" | jq '.'
echo ""
echo ""

# Test 4: Get categories
echo "4. Getting categories..."
curl -X GET "$BASE_URL/api/environment-variables/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" | jq '.'
echo ""
echo ""

# Test 5: Get variables by category
echo "5. Getting variables by category 'anthropic'..."
curl -X GET "$BASE_URL/api/environment-variables/by-category/anthropic" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" | jq '.'
echo ""
echo ""

echo "=== Tests completed ==="
