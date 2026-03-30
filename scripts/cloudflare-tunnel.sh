#!/bin/bash
# Cloudflare Tunnel Setup Script for weave
# Usage: bash scripts/cloudflare-tunnel.sh

set -e

GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' RED='\033[0;31m' NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${NC}"; }
info() { echo -e "${CYAN}  → $*${NC}"; }
err()  { echo -e "${RED}  ✗ $*${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ''
echo '████████████████████████████████████████'
echo '  Cloudflare Tunnel Setup'
echo '████████████████████████████████████████'
echo ''

# ─── Install cloudflared if missing ──────────────────────────────
if ! command -v cloudflared >/dev/null 2>&1; then
  info 'cloudflared not found. Installing...'
  curl -fsSL --output /tmp/cloudflared.deb \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i /tmp/cloudflared.deb
  rm /tmp/cloudflared.deb
  ok 'cloudflared installed'
else
  ok "cloudflared found: $(cloudflared --version 2>&1 | head -1)"
fi

echo ''
info 'Configuration Setup'
echo '─────────────────────────────────────────'

read -rp "Enter your Cloudflare domain: " CLOUDFLARE_DOMAIN
[ -z "$CLOUDFLARE_DOMAIN" ] && err 'Domain is required.' && exit 1

read -rp "Enter subdomain for this instance [weave]: " CLOUDFLARE_SUBDOMAIN
CLOUDFLARE_SUBDOMAIN="${CLOUDFLARE_SUBDOMAIN:-weave}"

FULL_DOMAIN="${CLOUDFLARE_SUBDOMAIN}.${CLOUDFLARE_DOMAIN}"
ok "Your instance will be accessible at: https://${FULL_DOMAIN}"

echo ''
info 'Cloudflare Authentication'
echo '─────────────────────────────────────────'

# ─── Check existing auth ─────────────────────────────────────────
if [ -f "$HOME/.cloudflared/cert.pem" ]; then
  ok 'Certificate found — already authenticated.'
  AUTH_METHOD="cert"
else
  echo ''
  echo '  Choose authentication method:'
  echo '    1) Browser login (requires browser access)'
  echo '    2) API Token (headless — creates tunnel via Cloudflare API)'
  echo ''
  read -rp "  Select method [1]: " AUTH_METHOD_INPUT
  AUTH_METHOD_INPUT="${AUTH_METHOD_INPUT:-1}"

  if [ "$AUTH_METHOD_INPUT" = "2" ]; then
    AUTH_METHOD="token"
    echo ''
    info 'API Token Authentication'
    echo '─────────────────────────────────────────'
    echo '  Create a token at: https://dash.cloudflare.com/profile/api-tokens'
    echo '  Required permissions:'
    echo '    • Account → Cloudflare Tunnel → Edit'
    echo '    • Zone → DNS → Edit'
    echo ''
    read -rp "  Enter your Cloudflare API Token: " CF_API_TOKEN
    [ -z "$CF_API_TOKEN" ] && err 'API Token is required.' && exit 1

    echo ''
    echo '  Where to find your Account ID:'
    echo '    1. Go to https://dash.cloudflare.com'
    echo '    2. Click on your domain (e.g. charhub.app)'
    echo '    3. Scroll down the RIGHT sidebar on the Overview page'
    echo '    4. Copy the "Account ID" value (32-character hex string)'
    echo ''
    read -rp "  Enter your Cloudflare Account ID: " CF_ACCOUNT_ID
    [ -z "$CF_ACCOUNT_ID" ] && err 'Account ID is required.' && exit 1

    # Validate token
    info 'Validating API token...'
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/user/tokens/verify")
    if [ "$HTTP_STATUS" != "200" ]; then
      err "Token validation failed (HTTP $HTTP_STATUS). Check your token and try again."
      exit 1
    fi
    ok 'API token is valid.'

    # Save for reuse
    mkdir -p "$HOME/.cloudflared"
    cat > "$HOME/.cloudflared/.env" << EOF
CF_API_TOKEN=$CF_API_TOKEN
CF_ACCOUNT_ID=$CF_ACCOUNT_ID
EOF
    chmod 600 "$HOME/.cloudflared/.env"

  else
    AUTH_METHOD="browser"
    info 'A browser window will open for authentication.'
    info 'If the browser does not open, copy the URL shown and open it manually.'
    echo ''
    read -rp "  Press Enter to continue..."
    cloudflared tunnel login
    ok 'Authenticated via browser.'
    AUTH_METHOD="cert"
  fi
fi

# ─── Load saved token if available ───────────────────────────────
if [ -f "$HOME/.cloudflared/.env" ] && [ -z "$CF_API_TOKEN" ]; then
  source "$HOME/.cloudflared/.env"
fi

echo ''
info 'Creating Tunnel'
echo '─────────────────────────────────────────'

TUNNEL_NAME="${CLOUDFLARE_SUBDOMAIN}-tunnel"
TUNNEL_ID=""
TUNNEL_TOKEN=""

if [ "$AUTH_METHOD" = "token" ]; then
  # ── Create tunnel via REST API ──────────────────────────────────
  # cloudflared CLI requires cert.pem for 'tunnel create'.
  # For headless token auth, use the Cloudflare API directly instead.
  info "Creating tunnel '${TUNNEL_NAME}' via Cloudflare API..."

  CREATE_RESPONSE=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"name\":\"${TUNNEL_NAME}\",\"tunnel_secret\":\"$(openssl rand -base64 32)\"}")

  SUCCESS=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success','false'))" 2>/dev/null || echo 'false')

  if [ "$SUCCESS" != "True" ] && [ "$SUCCESS" != "true" ]; then
    err 'Failed to create tunnel via API.'
    echo "  Response: $CREATE_RESPONSE"
    exit 1
  fi

  TUNNEL_ID=$(echo "$CREATE_RESPONSE" | python3 -c \
    "import sys,json; print(json.load(sys.stdin)['result']['id'])" 2>/dev/null || echo '')
  ok "Tunnel created: ${TUNNEL_ID}"

  # ── Get tunnel token ────────────────────────────────────────────
  info 'Fetching tunnel token...'
  TOKEN_RESPONSE=$(curl -s \
    "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/token" \
    -H "Authorization: Bearer $CF_API_TOKEN")

  TUNNEL_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c \
    "import sys,json; print(json.load(sys.stdin)['result'])" 2>/dev/null || echo '')

  if [ -z "$TUNNEL_TOKEN" ]; then
    err 'Failed to get tunnel token.'
    echo "  Response: $TOKEN_RESPONSE"
    exit 1
  fi
  ok 'Tunnel token obtained.'

  # ── Create DNS records via API ──────────────────────────────────
  info 'Looking up Zone ID...'
  ZONE_RESPONSE=$(curl -s \
    "https://api.cloudflare.com/client/v4/zones?name=${CLOUDFLARE_DOMAIN}" \
    -H "Authorization: Bearer $CF_API_TOKEN")

  ZONE_ID=$(echo "$ZONE_RESPONSE" | python3 -c \
    "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null || echo '')

  if [ -n "$ZONE_ID" ]; then
    ok "Zone ID: ${ZONE_ID}"

    # Create or update CNAME for the tunnel hostname
    CNAME_CONTENT="${TUNNEL_ID}.cfargotunnel.com"

    # Check if record already exists
    EXISTING_RESP=$(curl -s \
      "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME&name=${CLOUDFLARE_SUBDOMAIN}.${CLOUDFLARE_DOMAIN}" \
      -H "Authorization: Bearer $CF_API_TOKEN")
    EXISTING_ID=$(echo "$EXISTING_RESP" | python3 -c \
      "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null || echo '')

    if [ -n "$EXISTING_ID" ]; then
      # Update existing record
      DNS_RESP=$(curl -s -X PUT \
        "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${EXISTING_ID}" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
          \"type\": \"CNAME\",
          \"name\": \"${CLOUDFLARE_SUBDOMAIN}\",
          \"content\": \"${CNAME_CONTENT}\",
          \"proxied\": true
        }")
      DNS_OK=$(echo "$DNS_RESP" | python3 -c \
        "import sys,json; print(json.load(sys.stdin).get('success','false'))" 2>/dev/null || echo 'false')
      if [ "$DNS_OK" = "True" ] || [ "$DNS_OK" = "true" ]; then
        ok "DNS record updated: ${CLOUDFLARE_SUBDOMAIN}.${CLOUDFLARE_DOMAIN} → ${CNAME_CONTENT}"
      else
        warn "Failed to update DNS record."
        echo "  Response: $DNS_RESP"
      fi
    else
      # Create new record
      DNS_RESP=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
          \"type\": \"CNAME\",
          \"name\": \"${CLOUDFLARE_SUBDOMAIN}\",
          \"content\": \"${CNAME_CONTENT}\",
          \"proxied\": true
        }")
      DNS_OK=$(echo "$DNS_RESP" | python3 -c \
        "import sys,json; print(json.load(sys.stdin).get('success','false'))" 2>/dev/null || echo 'false')
      if [ "$DNS_OK" = "True" ] || [ "$DNS_OK" = "true" ]; then
        ok "DNS record created: ${CLOUDFLARE_SUBDOMAIN}.${CLOUDFLARE_DOMAIN} → ${CNAME_CONTENT}"
      else
        warn "Failed to create DNS record."
        echo "  Response: $DNS_RESP"
      fi
    fi
  else
    warn "Could not find zone for '${CLOUDFLARE_DOMAIN}'. Add DNS records manually:"
    warn "  CNAME ${CLOUDFLARE_SUBDOMAIN} → ${TUNNEL_ID}.cfargotunnel.com (proxied)"
  fi

else
  # ── Certificate-based auth ──────────────────────────────────────
  info "Creating tunnel '${TUNNEL_NAME}' via cloudflared CLI..."
  TUNNEL_OUTPUT=$(cloudflared tunnel create "${TUNNEL_NAME}" 2>&1)
  TUNNEL_ID=$(echo "$TUNNEL_OUTPUT" | grep -oP 'Created tunnel \K[a-f0-9-]+' || echo '')

  if [ -z "$TUNNEL_ID" ]; then
    err 'Failed to create tunnel.'
    echo "$TUNNEL_OUTPUT"
    exit 1
  fi
  ok "Tunnel created: ${TUNNEL_ID}"

  # Get token
  TUNNEL_TOKEN=$(cloudflared tunnel token "${TUNNEL_NAME}" 2>&1)

  # Create DNS route — single hostname with path-based routing
  if cloudflared tunnel route dns "${TUNNEL_NAME}" "${FULL_DOMAIN}" 2>&1; then
    ok "DNS routed: ${FULL_DOMAIN}"
  else
    warn "Could not auto-route DNS. Add manually:"
    warn "  CNAME ${CLOUDFLARE_SUBDOMAIN} → ${TUNNEL_ID}.cfargotunnel.com (proxied)"
  fi
fi

# ─── Write tunnel config ─────────────────────────────────────────
echo ''
info 'Writing tunnel configuration...'

mkdir -p "$HOME/.cloudflared"
CONFIG_FILE="$HOME/.cloudflared/config-${CLOUDFLARE_SUBDOMAIN}.yml"

cat > "$CONFIG_FILE" << EOF
# Cloudflare Tunnel — ${FULL_DOMAIN}
# Generated by weave cloudflare-tunnel.sh
#
# Path-based routing on a single hostname:
#   /api/* → API (port resolved dynamically by start.sh)
#   /*     → Dashboard
# start.sh rewrites this config at runtime with the actual ports.

tunnel: ${TUNNEL_ID}

ingress:
  - hostname: ${FULL_DOMAIN}
    path: /api/.*
    service: http://localhost:3000
  - hostname: ${FULL_DOMAIN}
    service: http://localhost:5173
  - service: http_status:404
EOF

ok "Config: ${CONFIG_FILE}"

# ─── Update .env ─────────────────────────────────────────────────
ENV_FILE="$ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  sed -i '/^CLOUDFLARE_/d' "$ENV_FILE" 2>/dev/null || true
fi

cat >> "$ENV_FILE" << EOF

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}
CLOUDFLARE_TUNNEL_ID=${TUNNEL_ID}
CLOUDFLARE_FULL_DOMAIN=${FULL_DOMAIN}
CLOUDFLARE_CONFIG_FILE=${CONFIG_FILE}
EOF

ok '.env updated'

# ─── Add tunnel start to start.sh if not already there ───────────
if ! grep -q 'CLOUDFLARE_TUNNEL_ENABLED' "$ROOT/start.sh" 2>/dev/null; then
  info 'Adding tunnel start block to start.sh...'
  # Insert before the final "wait $DAEMON_PID" line
  TUNNEL_BLOCK='\n# ─── Start Cloudflare Tunnel ────────────────────────────────────\nif [ "${CLOUDFLARE_TUNNEL_ENABLED}" = "true" ] \&\& [ -n "${CLOUDFLARE_TUNNEL_TOKEN}" ]; then\n  echo '"'"'→ Starting Cloudflare Tunnel...'"'"'\n  cloudflared tunnel run --token "${CLOUDFLARE_TUNNEL_TOKEN}" \\\n    > /tmp/weave-cloudflare.log 2>\&1 \&\n  TUNNEL_PID=$!\n  echo "  ✓ Tunnel running → https://${CLOUDFLARE_FULL_DOMAIN}"\n  # Add to cleanup\n  trap '"'"'kill $API_PID $DASHBOARD_PID $DAEMON_PID $TUNNEL_PID 2>/dev/null; wait 2>/dev/null; echo Done.'"'"' EXIT INT TERM\nfi\n'
  sed -i "s|^wait \$DAEMON_PID|${TUNNEL_BLOCK}\nwait \$DAEMON_PID|" "$ROOT/start.sh" 2>/dev/null || \
    warn 'Could not auto-patch start.sh. Add tunnel start manually.'
fi

# ─── Done ────────────────────────────────────────────────────────
echo ''
echo '████████████████████████████████████████'
ok 'Cloudflare Tunnel setup complete!'
echo ''
echo "  Dashboard → https://${FULL_DOMAIN}"
echo "  API       → https://${FULL_DOMAIN}/api/"
echo ''
info 'The tunnel starts automatically with start.sh'
info "Config file: ${CONFIG_FILE}"
echo ''
warn 'To disable the tunnel, set CLOUDFLARE_TUNNEL_ENABLED=false in .env'
echo '████████████████████████████████████████'
echo ''