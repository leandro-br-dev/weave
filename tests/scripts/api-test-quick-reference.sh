#!/bin/bash
# API Status Filter Testing - Quick Reference
# Generated: 2026-03-26

# Configuration
API_URL="http://localhost:3000"
TOKEN="d3aae3dd9c768db8c72553073b44561f22e39bb893b4928e"

echo "=================================="
echo "API Status Filter Testing"
echo "=================================="
echo

# Test 1: Running plans
echo "1. Testing status=running"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans?status=running" | jq '{count: (.data | length), error: .error}'
echo

# Test 2: Pending plans
echo "2. Testing status=pending"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans?status=pending" | jq '{count: (.data | length), error: .error}'
echo

# Test 3: Success plans
echo "3. Testing status=success"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans?status=success" | jq '{count: (.data | length), error: .error}'
echo

# Test 4: Failed plans
echo "4. Testing status=failed"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans?status=failed" | jq '{count: (.data | length), error: .error}'
echo

# Test 5: All plans (no filter)
echo "5. Testing no filter (all plans)"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans" | jq '{count: (.data | length), error: .error}'
echo

# Test 6: Invalid status
echo "6. Testing invalid status"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans?status=invalid_status" | jq '{count: (.data | length), error: .error}'
echo

# Test 7: Response structure validation
echo "7. Validating response structure"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/plans?status=running" | jq '{
  has_data: (.data != null),
  has_error: (.error != null),
  data_type: (.data | type),
  error_type: (.error | type),
  is_not_none: true
}'
echo

echo "=================================="
echo "✅ All tests completed!"
echo "=================================="
