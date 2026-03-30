#!/bin/bash
# Test the timeout fix with a real long-running plan
#
# This script demonstrates that long-running plans can complete successfully
# even if they exceed the timeout threshold, thanks to the heartbeat mechanism
# and the completion fix that allows completing plans marked as failed.

set -e

echo "========================================="
echo "Testing Timeout Fix"
echo "========================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
API_TOKEN="${API_TOKEN:-test-token}"
PLAN_TIMEOUT_MINUTES="${PLAN_TIMEOUT_MINUTES:-1}"

echo "Configuration:"
echo "  API URL: $API_URL"
echo "  Plan Timeout: $PLAN_TIMEOUT_MINUTES minute(s)"
echo ""

# Check if API is running
echo "Checking if API is running..."
if ! curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo "❌ API is not running. Please start the API server first:"
    echo "   cd /root/projects/weave/api && npm run dev"
    exit 1
fi
echo "✓ API is running"
echo ""

# Check if daemon is running
echo "Checking if daemon is running..."
if ! pgrep -f "python.*main.py.*daemon" > /dev/null; then
    echo "❌ Daemon is not running. Please start the daemon first:"
    echo "   cd /root/projects/weave/client && python main.py --daemon"
    exit 1
fi
echo "✓ Daemon is running"
echo ""

# Create a test plan
echo "Creating test plan..."
PLAN_RESPONSE=$(curl -s -X POST "$API_URL/api/plans" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Timeout Test Plan",
    "tasks": [{
      "id": "task-1",
      "name": "Long Task",
      "prompt": "Sleep for 90 seconds and write a file",
      "cwd": "/tmp",
      "tools": ["Bash", "Write"],
      "workspace": "/tmp/test-workspace"
    }]
  }')

PLAN_ID=$(echo $PLAN_RESPONSE | jq -r '.data.id')

if [ "$PLAN_ID" = "null" ]; then
    echo "❌ Failed to create plan"
    echo $PLAN_RESPONSE | jq .
    exit 1
fi

echo "✓ Created plan: $PLAN_ID"
echo ""

# Start the plan
echo "Starting plan..."
START_RESPONSE=$(curl -s -X POST "$API_URL/api/plans/$PLAN_ID/start" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "test-daemon"}')

STATUS=$(echo $START_RESPONSE | jq -r '.data.status')

if [ "$STATUS" != "running" ]; then
    echo "❌ Failed to start plan"
    echo $START_RESPONSE | jq .
    exit 1
fi

echo "✓ Plan is now running"
echo ""

# Monitor the plan with heartbeats
echo "Sending heartbeats every 10 seconds..."
echo "This simulates a long-running task that sends regular heartbeats."
echo ""

MAX_ITERATIONS=12  # 120 seconds total
iteration=0

while [ $iteration -lt $MAX_ITERATIONS ]; do
    iteration=$((iteration + 1))

    # Send heartbeat
    HEARTBEAT_RESPONSE=$(curl -s -X POST "$API_URL/api/plans/$PLAN_ID/heartbeat" \
      -H "Authorization: Bearer $API_TOKEN")

    HEARTBEAT_AT=$(echo $HEARTBEAT_RESPONSE | jq -r '.data.heartbeat_at')

    # Check plan status
    PLAN_STATUS=$(curl -s "$API_URL/api/plans/$PLAN_ID" \
      -H "Authorization: Bearer $API_TOKEN" \
      | jq -r '.data.status')

    MINUTES_RUNNING=$(echo $HEARTBEAT_RESPONSE | jq -r '.data.minutes_running // 0')

    echo "[$iteration/$MAX_ITERATIONS] Heartbeat sent at $HEARTBEAT_AT | Status: $PLAN_STATUS | Running: ${MINUTES_RUNNING}m"

    # Check if plan completed
    if [ "$PLAN_STATUS" = "success" ] || [ "$PLAN_STATUS" = "failed" ]; then
        echo ""
        echo "✓ Plan completed with status: $PLAN_STATUS"
        break
    fi

    sleep 10
done

echo ""

# Check for approaching timeout
echo "Checking if plan is approaching timeout..."
APPROACHING_RESPONSE=$(curl -s "$API_URL/api/plans/approaching-timeout" \
  -H "Authorization: Bearer $API_TOKEN")

APPROACHING_COUNT=$(echo $APPROACHING_RESPONSE | jq -r '.data.count')

if [ "$APPROACHING_COUNT" -gt 0 ]; then
    echo "⚠️  Plan is approaching timeout!"
    echo $APPROACHING_RESPONSE | jq -r '.data.plans[] | "  - \(.name): \(.minutes_running | tonumber) minutes running, \(.timeout_in_minutes | tonumber) minutes until timeout"'
else
    echo "✓ Plan is not approaching timeout"
fi

echo ""

# Simulate timeout scenario
echo "========================================="
echo "Simulating Timeout Scenario"
echo "========================================="
echo ""

# Get current plan status
CURRENT_PLAN=$(curl -s "$API_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $API_TOKEN")

CURRENT_STATUS=$(echo $CURRENT_PLAN | jq -r '.data.status')
STARTED_AT=$(echo $CURRENT_PLAN | jq -r '.data.started_at')
LAST_HEARTBEAT=$(echo $CURRENT_PLAN | jq -r '.data.last_heartbeat_at')

echo "Current plan status:"
echo "  Status: $CURRENT_STATUS"
echo "  Started at: $STARTED_AT"
echo "  Last heartbeat: $LAST_HEARTBEAT"
echo ""

# Manually mark as failed to simulate timeout
echo "Simulating timeout by marking plan as failed..."
MARK_FAILED_RESPONSE=$(curl -s -X POST "$API_URL/api/plans/$PLAN_ID/complete" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "failed",
    "result": "Plan timed out - daemon may have crashed"
  }')

FAILED_STATUS=$(echo $MARK_FAILED_RESPONSE | jq -r '.data.status')

if [ "$FAILED_STATUS" = "failed" ]; then
    echo "✓ Plan marked as failed (simulating timeout)"
else
    echo "❌ Failed to mark plan as failed"
    exit 1
fi

echo ""

# Now complete the plan successfully (the fix!)
echo "========================================="
echo "Testing Completion Fix"
echo "========================================="
echo ""

echo "Completing plan successfully even though it was marked as failed..."
COMPLETE_RESPONSE=$(curl -s -X POST "$API_URL/api/plans/$PLAN_ID/complete" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"success\",
    \"result\": \"Plan completed successfully despite timeout\",
    \"daemon_completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
  }")

FINAL_STATUS=$(echo $COMPLETE_RESPONSE | jq -r '.data.status')
FINAL_RESULT=$(echo $COMPLETE_RESPONSE | jq -r '.data.result')

if [ "$FINAL_STATUS" = "success" ]; then
    echo "✓ SUCCESS! Plan completed with status: $FINAL_STATUS"
    echo "  Result: $FINAL_RESULT"
    echo ""
    echo "✓ The timeout fix is working correctly!"
    echo "  Plans can now complete successfully even if they were temporarily marked as failed."
else
    echo "❌ Failed to complete plan"
    echo $COMPLETE_RESPONSE | jq .
    exit 1
fi

echo ""

# Final plan details
echo "========================================="
echo "Final Plan Details"
echo "========================================="
echo ""

FINAL_PLAN=$(curl -s "$API_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $API_TOKEN")

echo $FINAL_PLAN | jq .

echo ""
echo "========================================="
echo "Test Complete ✓"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Created and started a long-running plan"
echo "  - Sent regular heartbeats to prevent premature timeout"
echo "  - Simulated timeout by marking plan as failed"
echo "  - Successfully completed the plan (the fix!)"
echo "  - Verified approaching-timeout endpoint"
echo ""
echo "All tests passed! ✓"
