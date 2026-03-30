#!/bin/bash
# Test script to verify CORS configuration

echo "=== Testing CORS Configuration ==="
echo ""

# Test 1: Health check (should work without CORS)
echo "1. Testing health endpoint..."
curl -s http://localhost:3000/api/health | jq '.'
echo ""

# Test 2: OPTIONS request from localhost:5173 (should be allowed)
echo "2. Testing OPTIONS preflight from localhost:5173..."
curl -s -X OPTIONS http://localhost:3000/api/plans/metrics \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v 2>&1 | grep -E "(Access-Control|< HTTP)"
echo ""

# Test 3: OPTIONS request from Cloudflare Tunnel domain (should be allowed)
echo "3. Testing OPTIONS preflight from https://weave.charhub.app..."
curl -s -X OPTIONS http://localhost:3000/api/plans/metrics \
  -H "Origin: https://weave.charhub.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v 2>&1 | grep -E "(Access-Control|< HTTP)"
echo ""

# Test 4: OPTIONS request from unauthorized domain (should be blocked)
echo "4. Testing OPTIONS preflight from unauthorized domain..."
curl -s -X OPTIONS http://localhost:3000/api/plans/metrics \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v 2>&1 | grep -E "(Access-Control|< HTTP)"
echo ""

echo "=== CORS Test Complete ==="
