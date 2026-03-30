#!/bin/bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ''
echo '██████████████████████████████████████'
echo '  weave'
echo '██████████████████████████████████████'
echo ''

# ─── Load .env ───────────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  export $(grep -v '^#' "$ROOT/.env" | xargs)
fi

# ─── Environment mode (prod / dev) ───────────────────────────────
# Set APP_ENV=dev in your .env to run as development instance
# Production uses default ports; dev adds +100 offset to avoid conflicts
APP_ENV="${APP_ENV:-prod}"

if [ "$APP_ENV" = "dev" ]; then
  DEFAULT_API_PORT=3100
  DEFAULT_DASHBOARD_PORT=5273
  echo "  ⚙ Running in DEV mode (ports offset by +100)"
else
  DEFAULT_API_PORT=3000
  DEFAULT_DASHBOARD_PORT=5173
fi

# ─── Set data directory (per-user, per-env) ─────────────────────
if [ "$APP_ENV" = "dev" ]; then
  DATA_DIR="$HOME/.local/share/weave-dev"
else
  DATA_DIR="$HOME/.local/share/weave"
fi
export DATA_DIR

AGENTS_BASE_PATH="$DATA_DIR/projects"
export AGENTS_BASE_PATH
mkdir -p "$AGENTS_BASE_PATH"
mkdir -p "$DATA_DIR/logs"
echo "  → Data directory:   $DATA_DIR"
echo "  → Agent workspaces: $AGENTS_BASE_PATH"
echo ""

# ─── Run migration scripts ───────────────────────────────────────
if [ -d "$ROOT/scripts/migrations" ]; then
  echo '→ Running data migrations...'
  for script in "$ROOT/scripts/migrations"/*.sh; do
    [ -f "$script" ] && bash "$script" "$DATA_DIR" "$APP_ENV"
  done
fi

# ─── Check for updates ───────────────────────────────────────────
if command -v git >/dev/null 2>&1 && [ -d "$ROOT/.git" ]; then
  git -C "$ROOT" fetch origin --quiet 2>/dev/null || true
  BEHIND=$(git -C "$ROOT" rev-list HEAD..origin/main --count 2>/dev/null \
    || git -C "$ROOT" rev-list HEAD..origin/master --count 2>/dev/null \
    || echo '0')
  if [ "$BEHIND" -gt 0 ]; then
    echo "  ℹ Update available! ($BEHIND new commit(s) on remote)"
    printf '  Update now? [y/N] '
    read -r UPDATE_ANSWER < /dev/tty || read -r UPDATE_ANSWER
    if [ "${UPDATE_ANSWER,,}" = 'y' ]; then
      echo '  → Pulling updates...'
      git -C "$ROOT" pull --quiet && echo '  ✓ Updated! Restart to apply.' || echo '  ✗ Update failed'
    fi
  fi
fi

# ─── Check dependencies ──────────────────────────────────────────
command -v node >/dev/null || { echo 'ERROR: node not found'; exit 1; }
command -v python3 >/dev/null || { echo 'ERROR: python3 not found'; exit 1; }

# ─── Check Claude CLI ────────────────────────────────────────────
echo '→ Checking Claude CLI authentication...'
if command -v claude >/dev/null 2>&1; then
  CLAUDE_AUTH=$(claude --version 2>&1)
  if echo "$CLAUDE_AUTH" | grep -q 'oauth\|expired\|unauthorized' 2>/dev/null; then
    echo '  ⚠ Claude CLI may need re-authentication. Run: claude login'
  else
    echo "  ✓ Claude CLI found ($CLAUDE_AUTH)"
  fi
else
  echo '  ⚠ claude CLI not found in PATH'
fi

# ─── Create .env if missing ──────────────────────────────────────
if [ ! -f "$ROOT/.env" ]; then
  echo 'Creating .env with defaults...'
  cat > "$ROOT/.env" << 'EOF'
WEAVE_TOKEN=dev-token-change-in-production
APPROVAL_TIMEOUT_MINUTES=10
PORT=3000
DASHBOARD_PORT=5173
# APP_ENV=dev  ← uncomment to run as development instance on offset ports
EOF
fi

# ─── Port utilities ──────────────────────────────────────────────
# All debug output goes to stderr so $() captures only the port number

port_process() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$port" 2>/dev/null | head -1
  else
    ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1
  fi
}

port_process_name() {
  local port=$1
  local pid
  pid=$(port_process "$port")
  [ -z "$pid" ] && echo '' && return
  ps -p "$pid" -o comm= 2>/dev/null || echo "pid:$pid"
}

kill_our_process_on_port() {
  local port=$1
  local pid
  pid=$(port_process "$port")
  [ -z "$pid" ] && return 0
  local name
  name=$(ps -p "$pid" -o comm= 2>/dev/null || echo '')
  if echo "$name" | grep -qE '^(node|tsx|python3?|uvicorn)$'; then
    echo "  ↻ Killing stale $name (PID $pid) on port $port" >&2
    kill "$pid" 2>/dev/null
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
    return 0
  fi
  return 1
}

find_free_port() {
  local port=$1
  local max=$((port + 20))
  while [ $port -le $max ]; do
    local pid
    pid=$(port_process "$port")
    if [ -z "$pid" ]; then
      echo "$port"
      return
    fi
    port=$((port + 1))
  done
  echo ''
}

resolve_port() {
  local default_port=$1
  local service_name=$2

  local pid
  pid=$(port_process "$default_port")

  if [ -z "$pid" ]; then
    echo "$default_port"
    return
  fi

  if kill_our_process_on_port "$default_port"; then
    sleep 1
    pid=$(port_process "$default_port")
    if [ -z "$pid" ]; then
      echo "$default_port"
      return
    fi
  fi

  local proc_name
  proc_name=$(port_process_name "$default_port")
  echo "  ⚠ Port $default_port in use by '$proc_name' — finding free port..." >&2
  local free
  free=$(find_free_port $((default_port + 1)))
  if [ -z "$free" ]; then
    echo "  ✗ No free port found near $default_port" >&2
    echo "$default_port"
  else
    echo "  → $service_name will use port $free instead" >&2
    echo "$free"
  fi
}

# ─── Resolve ports ───────────────────────────────────────────────
# In dev mode, always use offset ports — ignore PORT/DASHBOARD_PORT from .env
# to prevent dev instance from killing the prod instance
echo '→ Checking ports...'

if [ "$APP_ENV" = "dev" ]; then
  API_PORT=$(resolve_port "$DEFAULT_API_PORT" 'API')
  DASHBOARD_PORT=$(resolve_port "$DEFAULT_DASHBOARD_PORT" 'Dashboard')
else
  API_PORT=$(resolve_port "${PORT:-$DEFAULT_API_PORT}" 'API')
  DASHBOARD_PORT=$(resolve_port "${DASHBOARD_PORT:-$DEFAULT_DASHBOARD_PORT}" 'Dashboard')
fi

API_PORT=$(echo "$API_PORT" | tr -d '[:space:]')
DASHBOARD_PORT=$(echo "$DASHBOARD_PORT" | tr -d '[:space:]')

export PORT=$API_PORT
export DASHBOARD_PORT=$DASHBOARD_PORT
# NÃO exporte VITE_API_BASE_URL - deixe o frontend detectar automaticamente
# baseado na origem de acesso (localhost ou domínio externo via tunnel)
export API_BEARER_TOKEN="${WEAVE_TOKEN:-dev-token-change-in-production}"
export WEAVE_TOKEN="${WEAVE_TOKEN:-dev-token-change-in-production}"

echo "  → API       → :$API_PORT"
echo "  → Dashboard → :$DASHBOARD_PORT"

# ─── Python venv ─────────────────────────────────────────────────
if [ ! -d "$ROOT/client/venv" ]; then
  echo 'Creating Python venv for client...'
  python3 -m venv "$ROOT/client/venv"
  "$ROOT/client/venv/bin/pip" install -r "$ROOT/client/requirements.txt" -q
fi

# ─── Cleanup ─────────────────────────────────────────────────────
cleanup() {
  echo ''
  echo 'Shutting down...'
  kill $API_PID $DASHBOARD_PID $DAEMON_PID 2>/dev/null
  [ -n "$CLOUDFLARE_PID" ] && kill "$CLOUDFLARE_PID" 2>/dev/null
  wait 2>/dev/null
  echo 'Done.'
}
trap cleanup EXIT INT TERM

# ─── Start API ───────────────────────────────────────────────────
# Force PORT and tokens via env — overrides anything in api/.env
echo "→ Starting API on port $API_PORT..."
cd "$ROOT/api" && PORT=$API_PORT \
  API_BEARER_TOKEN="$WEAVE_TOKEN" \
  WEAVE_TOKEN="$WEAVE_TOKEN" \
  npm run dev > "$DATA_DIR/logs/api.log" 2>&1 &
API_PID=$!

# Wait up to 30s for API to be ready
API_READY=false
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" \
      "http://localhost:$API_PORT/api/plans" \
      -H "Authorization: Bearer $WEAVE_TOKEN" 2>/dev/null | grep -qE '^(200|401|403)'; then
    API_READY=true
    break
  fi
  sleep 1
done

if [ "$API_READY" = true ]; then
  echo '  ✓ API running'
else
  echo "  ⚠ API did not respond after 30s — check $DATA_DIR/logs/api.log"
  tail -5 "$DATA_DIR/logs/api.log" | sed 's/^/    /'
  echo '    Continuing anyway...'
fi

# ─── Start Dashboard ─────────────────────────────────────────────
# Rewrite dashboard/.env with correct values for this environment
# When tunnel is enabled, DON'T set VITE_API_URL to allow dynamic detection
if [ "${CLOUDFLARE_TUNNEL_ENABLED:-false}" = "true" ]; then
  # Tunnel mode: let the frontend detect the API URL dynamically
  cat > "$ROOT/dashboard/.env" << ENVEOF
VITE_API_TOKEN=$WEAVE_TOKEN
ENVEOF
else
  # Local mode: use localhost explicitly
  cat > "$ROOT/dashboard/.env" << ENVEOF
VITE_API_URL=http://localhost:$API_PORT
VITE_API_BASE_URL=http://localhost:$API_PORT
VITE_API_TOKEN=$WEAVE_TOKEN
ENVEOF
fi

echo "→ Starting Dashboard on port $DASHBOARD_PORT..."

if [ "${CLOUDFLARE_TUNNEL_ENABLED:-false}" = "true" ]; then
  # Tunnel mode: build static files and serve them
  # Vite dev server does not work through a tunnel (serves raw .ts files)
  echo "  ℹ Tunnel enabled — building dashboard for static serving..."
  echo "  ℹ API URL will be detected dynamically based on access origin"
  cd "$ROOT/dashboard" && npm run build -- --mode production > "$DATA_DIR/logs/dashboard-build.log" 2>&1     && echo "  ✓ Dashboard built"     || { echo "  ✗ Build failed — check $DATA_DIR/logs/dashboard-build.log"; cat "$DATA_DIR/logs/dashboard-build.log" | tail -10 | sed 's/^/    /'; }

  # Serve the built dist/ directory
  cd "$ROOT/dashboard" && npx serve dist --listen "$DASHBOARD_PORT" --no-clipboard --single     > "$DATA_DIR/logs/dashboard.log" 2>&1 &
  DASHBOARD_PID=$!
else
  # Local mode: use Vite dev server (hot reload, faster)
  cd "$ROOT/dashboard" && npx vite --port "$DASHBOARD_PORT"     > "$DATA_DIR/logs/dashboard.log" 2>&1 &
  DASHBOARD_PID=$!
fi
sleep 2

# ─── Start Daemon ────────────────────────────────────────────────
echo '→ Starting Agent Daemon...'

# Each APP_ENV gets its own PID file — prevents dev from killing prod daemon
PID_FILE="$DATA_DIR/logs/daemon.pid"
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if ! kill -0 "$OLD_PID" 2>/dev/null; then
    echo '  ↻ Removing stale daemon PID file'
    rm -f "$PID_FILE"
  else
    echo "  ↻ Stopping existing ${APP_ENV} daemon (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null
    sleep 2
    rm -f "$PID_FILE"
  fi
fi

cd "$ROOT/client"
source venv/bin/activate
export WEAVE_URL="http://localhost:$API_PORT"
export WEAVE_DAEMON_PID_FILE="$PID_FILE"
python main.py --daemon &
DAEMON_PID=$!
deactivate

# ─── Start Cloudflare Tunnel (if enabled) ────────────────────────
CLOUDFLARE_PID=""
if [ "${CLOUDFLARE_TUNNEL_ENABLED:-false}" = "true" ]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo '  ⚠ cloudflared not found — run: bash scripts/cloudflare-tunnel.sh'
  elif [ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
    echo '  ⚠ CLOUDFLARE_TUNNEL_TOKEN not set — run: bash scripts/cloudflare-tunnel.sh'
  else
    echo '→ Starting Cloudflare Tunnel...'
    CF_FULL_DOMAIN="${CLOUDFLARE_FULL_DOMAIN:-weave.example.com}"
    TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-}"
    RUNTIME_CF_CONFIG="/tmp/cloudflared-runtime-${APP_ENV}.yml"
    # Path-based routing: /api/* → API port, everything else → Dashboard port
    # Both on the same hostname — no need for api-* subdomain
    cat > "$RUNTIME_CF_CONFIG" << CFEOF
tunnel: ${TUNNEL_ID}

ingress:
  - hostname: ${CF_FULL_DOMAIN}
    path: /api/.*
    service: http://localhost:${API_PORT}
  - hostname: ${CF_FULL_DOMAIN}
    service: http://localhost:${DASHBOARD_PORT}
  - service: http_status:404
CFEOF
    cloudflared --config "$RUNTIME_CF_CONFIG" \
      --no-autoupdate tunnel run \
      --token "$CLOUDFLARE_TUNNEL_TOKEN" \
      > "$DATA_DIR/logs/cloudflare.log" 2>&1 &
    CLOUDFLARE_PID=$!
    sleep 3
    if kill -0 "$CLOUDFLARE_PID" 2>/dev/null; then
      echo "  ✓ Tunnel running → https://${CF_FULL_DOMAIN}"
    else
      echo "  ⚠ Tunnel failed — check $DATA_DIR/logs/cloudflare.log"
      tail -3 "$DATA_DIR/logs/cloudflare.log" | sed 's/^/    /'
      CLOUDFLARE_PID=""
    fi
  fi
fi

echo ''
echo '✓ All services started:'
echo "  Dashboard → http://localhost:$DASHBOARD_PORT"
echo "  API       → http://localhost:$API_PORT"
echo "  Mode      → $APP_ENV"
echo '  Daemon    → polling for plans'
echo ''
echo 'Press Ctrl+C to stop all services'
echo ''

wait $DAEMON_PID