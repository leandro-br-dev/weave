# Cloudflare Tunnel Architecture

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Network                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   DNS Layer                              │  │
│  │  weave.your-domain.com → Tunnel                │  │
│  │  api-weave.your-domain.com → Tunnel            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Cloudflare Tunnel (QUIC)                    │  │
│  │           Encrypted outbound connection                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ cloudflared (outbound only)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Your Server                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              cloudflared process                         │  │
│  │  - Listens on Cloudflare Tunnel                          │  │
│  │  - Forwards to localhost ports                           │  │
│  │  - No open ports required                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│          ┌───────────────────┴───────────────────┐             │
│          ▼                                       ▼             │
│  ┌──────────────────┐                  ┌──────────────────┐   │
│  │  Dashboard       │                  │  API Server      │   │
│  │  (Vite dev)      │                  │  (Express)       │   │
│  │  localhost:5173  │                  │  localhost:3000  │   │
│  └──────────────────┘                  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Request (HTTPS)

```
User Browser
    │
    │ GET https://weave.your-domain.com
    │
    ▼
Cloudflare DNS (resolves to Tunnel)
    │
    ▼
Cloudflare Edge (DDoS protection, SSL termination)
    │
    ▼
Cloudflare Tunnel (encrypted QUIC connection)
```

### 2. Tunnel Connection

```
cloudflared (on your server)
    │
    │ Establishes outbound connection to Cloudflare
    │ (no open ports required!)
    │
    ▼
Cloudflare Tunnel Service
    │
    │ Receives request from edge
    │
    ▼
Forwards to your local service
```

### 3. Local Processing

```
cloudflared
    │
    │ Forwards to localhost:5173 (or 3000 for API)
    │
    ▼
Dashboard / API
    │
    │ Processes request
    │
    ▼
Response back through tunnel
```

## Security Model

### Why It's Secure

1. **Outbound Only Connection**
   - Your server initiates connection to Cloudflare
   - No inbound ports need to be open
   - Impossible to directly attack your server from internet

2. **End-to-End Encryption**
   - Browser → Cloudflare: TLS 1.3
   - Cloudflare → Your Server: QUIC with TLS
   - No plaintext anywhere in the chain

3. **DDoS Protection**
   - Cloudflare absorbs attacks at edge
   - Only legitimate requests reach your server
   - Automatic rate limiting

4. **Authentication**
   - Tunnel token authenticates your server
   - Token can be rotated anytime
   - Compromised token = just revoke and regenerate

### Compared to Traditional Setup

**Traditional (Port Forwarding):**
```
Internet → Router (NAT) → Firewall → Your Server
                        ↑
                   Open ports (attack surface)
                   Public IP required
                   Direct exposure
```

**Cloudflare Tunnel:**
```
Internet → Cloudflare → Tunnel → Your Server
                        ↑
                   Outbound connection only
                   No public IP needed
                   Protected by Cloudflare
```

## Configuration Files

### ~/.cloudflared/config.yml

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: ~/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # Dashboard route
  - hostname: weave.your-domain.com
    service: http://localhost:5173
  # API route
  - hostname: api-weave.your-domain.com
    service: http://localhost:3000
  # Catch-all
  - service: http_status:404
```

### .env Configuration

```env
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_SUBDOMAIN=weave
CLOUDFLARE_TUNNEL_DOMAIN=your-domain.com
CLOUDFLARE_ACCOUNT_TAG=<account_tag>
CLOUDFLARE_TUNNEL_TOKEN=<tunnel_token>
CLOUDFLARE_TUNNEL_ID=<tunnel_uuid>
CLOUDFLARE_FULL_DOMAIN=weave.your-domain.com
```

## Startup Process

```
1. API Server (localhost:3000)
2. Dashboard (localhost:5173)
3. Daemon (background worker)
4. Cloudflare Tunnel (connects to Cloudflare)
```

## Performance Considerations

### Latency

- **Additional latency**: ~50-200ms (Cloudflare edge → your server)
- **Acceptable for**: Web applications, APIs, dashboards
- **Not ideal for**: Real-time gaming, ultra-low-latency apps

### Bandwidth

- **No limit**: Cloudflare doesn't limit tunnel bandwidth
- **Billing**: Based on Cloudflare plan (Free tier available)
- **Compression**: Automatic compression for text-based responses

### Scaling

- **Single tunnel**: Handles multiple concurrent connections
- **Multiple tunnels**: Create separate tunnels for different environments
- **Load balancing**: Use Cloudflare Load Balancer for multiple servers

## Advanced Features

### Access Policies (Cloudflare Zero Trust)

Add authentication layer before reaching your app:

```
User → Cloudflare Access → Login (Google/Email/OTP) → Tunnel → Your App
```

### Custom Domains

- Use any domain managed by Cloudflare
- Subdomain or path-based routing
- Wildcard certificates automatically

### Monitoring

- Cloudflare Analytics dashboard
- Request logs and metrics
- Error tracking and alerts

### Geographic Routing

- Route requests to nearest data center
- Anycast network for global performance
- Automatic failover

## Environment Variables Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `CLOUDFLARE_TUNNEL_ENABLED` | Enable/disable tunnel | `true` | Yes |
| `CLOUDFLARE_TUNNEL_SUBDOMAIN` | Subdomain for dashboard | `weave` | Yes |
| `CLOUDFLARE_TUNNEL_DOMAIN` | Your Cloudflare domain | `your-domain.com` | Yes |
| `CLOUDFLARE_ACCOUNT_TAG` | Cloudflare Account Tag | `abc123def456` | Yes |
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel authentication token | `eyJhbGci...` | Yes |
| `CLOUDFLARE_TUNNEL_ID` | Tunnel UUID | `123e4567-e89b...` | Yes |
| `CLOUDFLARE_FULL_DOMAIN` | Complete domain name | `weave.your-domain.com` | Yes |

## References

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
