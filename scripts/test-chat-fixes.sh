#!/bin/bash
set -e

echo "=== Testing Chat Fixes ==="
echo ""

# Ensure we're in the right directory
cd /root/projects/weave

# 1. Start the daemon
echo ""
echo "1. Starting daemon..."
cd client
source venv/bin/activate
export WEAVE_URL=http://localhost:3000
export WEAVE_TOKEN=dev-token-change-in-production
export AGENT_CLIENT_PATH=/root/projects/weave/projects

# Kill any existing daemon
pkill -9 -f 'python main.py --daemon' 2>/dev/null || true
sleep 1

# Start daemon in background with log capture
# Use PYTHONUNBUFFERED=1 to ensure logs are written immediately
# Use AGENT_DEBUG=1 to enable detailed debug logging
PYTHONUNBUFFERED=1 AGENT_DEBUG=1 python main.py --daemon > /tmp/daemon-test-full.log 2>&1 &
DAEMON_PID=$!
echo "   Daemon PID: $DAEMON_PID"

# Give it time to start
sleep 5

# Check if daemon is still running
if ps -p $DAEMON_PID > /dev/null; then
  echo "   ✓ Daemon is running"
else
  echo "   ✗ Daemon failed to start"
  echo "   === Log output ==="
  cat /tmp/daemon-test-full.log
  deactivate
  exit 1
fi

# 3. Create a test session
echo ""
echo "3. Creating test session..."
SESSION_RESPONSE=$(curl -s -X POST \
  -H 'Authorization: Bearer dev-token-change-in-production' \
  -H 'Content-Type: application/json' \
  -d '{"name":"chat-fix-test","workspace_path":"/root/projects/weave/projects/weave/agents/planner"}' \
  http://localhost:3000/api/sessions)

SESSION_ID=$(echo "$SESSION_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   Session ID: $SESSION_ID"

# 4. Send a message
echo ""
echo "4. Sending test message..."
curl -s -X POST \
  -H 'Authorization: Bearer dev-token-change-in-production' \
  -H 'Content-Type: application/json' \
  -d '{"content":"say hello"}' \
  http://localhost:3000/api/sessions/$SESSION_ID/message > /dev/null
echo "   Message sent"

# 5. Wait for response
echo ""
echo "5. Waiting for response (20s)..."
for i in {1..20}; do
  sleep 1
  STATUS=$(curl -s -H 'Authorization: Bearer dev-token-change-in-production' \
    http://localhost:3000/api/sessions/$SESSION_ID | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
  echo -n "."
  if [ "$STATUS" = "idle" ]; then
    echo ""
    break
  fi
done

# 6. Check results
echo ""
echo "6. Checking results..."
RESPONSE=$(curl -s -H 'Authorization: Bearer dev-token-change-in-production' \
  http://localhost:3000/api/sessions/$SESSION_ID)

echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)['data']
print(f'Status: {data[\"status\"]}')
print(f'SDK Session ID: {data.get(\"sdk_session_id\", \"none\")}')
messages = data.get('messages', [])
print(f'Messages: {len(messages)}')
for m in messages:
    role = m['role']
    content = m.get('content', '')
    if len(content) > 150:
        content = content[:150] + '...'
    print(f'  [{role}]: {content}')
"

# 7. Check daemon logs
echo ""
echo "7. Daemon log output:"
if [ -f /tmp/daemon-test-full.log ]; then
  cat /tmp/daemon-test-full.log
else
  echo "   No log file found"
fi
echo ""
echo "   Checking process output:"
ps aux | grep 'python main.py --daemon' | grep -v grep || echo "   Daemon not running"

# Cleanup
echo ""
echo "8. Cleanup..."
kill $DAEMON_PID 2>/dev/null || true
deactivate
echo "   Done"

echo ""
echo "=== Test Complete ==="
