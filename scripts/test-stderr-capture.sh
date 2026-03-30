#!/bin/bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "=== Testing stderr capture in chat_runner.py ==="
echo ""

# Activate venv
cd client
source venv/bin/activate

# Reset any stuck sessions
echo "→ Resetting stuck sessions..."
python3 << 'EOF'
import sqlite3
conn = sqlite3.connect('/root/projects/weave/api/data/database.db')
n = conn.execute("UPDATE chat_sessions SET status='idle', sdk_session_id=NULL WHERE status='running'").rowcount
conn.commit()
print(f'  Reset {n} sessions')
conn.close()
EOF

echo ""
echo "→ Starting daemon for 30 seconds..."
export WEAVE_URL=http://localhost:3000
export WEAVE_TOKEN=dev-token-change-in-production
export AGENT_CLIENT_PATH=/root/projects/weave/projects

# Start daemon in background
timeout 30 python main.py --daemon 2>&1 &
DAEMON_PID=$!

# Wait for daemon to start
sleep 5

echo ""
echo "→ Creating test session..."
RESPONSE=$(curl -s -X POST \
  -H 'Authorization: Bearer dev-token-change-in-production' \
  -H 'Content-Type: application/json' \
  -d '{"name":"stderr-test","workspace_path":"/root/projects/weave/projects/weave/agents/planner"}' \
  http://localhost:3000/api/sessions)

echo "$RESPONSE" | python3 -m json.tool || echo "$RESPONSE"

# Get session ID
SESSION_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
  echo "ERROR: Failed to create session"
  kill $DAEMON_PID 2>/dev/null
  deactivate
  exit 1
fi

echo ""
echo "→ Session created: $SESSION_ID"
echo "→ Sending test message..."
curl -s -X POST \
  -H 'Authorization: Bearer dev-token-change-in-production' \
  -H 'Content-Type: application/json' \
  -d '{"content":"say hello"}' \
  http://localhost:3000/api/sessions/$SESSION_ID/message

echo ""
echo "→ Waiting for response (20 seconds)..."
sleep 20

echo ""
echo "→ Checking session status..."
curl -s -H 'Authorization: Bearer dev-token-change-in-production' \
  http://localhost:3000/api/sessions/$SESSION_ID | python3 << 'EOF'
import sys, json
data = json.load(sys.stdin)['data']
print(f"Status: {data['status']}")
print(f"Messages: {len(data.get('messages', []))}")
for m in data.get('messages', [])[-3:]:
    role = m.get('role', 'unknown')
    content = m.get('content', '')[:200]
    print(f"\n  [{role}]:")
    print(f"    {content}")
EOF

# Cleanup
echo ""
echo "→ Stopping daemon..."
kill $DAEMON_PID 2>/dev/null || true

deactivate

echo ""
echo "=== Test complete ==="
