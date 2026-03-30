# Cloudflare Tunnel Setup Guide

Comprehensive guide for configuring Cloudflare Tunnel to expose your weave instance to the internet using your own domain.

## What is Cloudflare Tunnel?

Cloudflare Tunnel (formerly Argo Tunnel) creates a secure, outbound-only connection between your server and Cloudflare's network:

- **No port forwarding** required on your router
- **No public IP** needed
- **Automatic SSL/TLS** encryption
- **DDoS protection** included
- **Access from anywhere** with your custom domain

## Prerequisites

1. **Cloudflare Account** with your domain configured
2. **Domain Access**: Your domain must be using Cloudflare nameservers
3. **Basic Linux knowledge** for running setup scripts

## Automated Setup (Recommended)

### 1. Run the configuration script

```bash
cd /root/projects/weave
bash scripts/cloudflare-tunnel.sh
```

The script will:
- Install cloudflared (if needed)
- Authenticate with your Cloudflare account (opens browser)
- Create a tunnel in your Cloudflare account
- Configure DNS records automatically
- Update your `.env` file with all required configuration
- Generate tunnel token for secure connection

### 2. Confirm configuration

During setup, you'll be prompted for:

- **Domain**: Your domain (e.g., `your-domain.com`)
- **Subdomain**: Defaults to `weave` (or choose another)

```
Enter your Cloudflare domain: your-domain.com
Enter subdomain for this instance [weave]: [Press Enter]
```

### 3. Start weave

```bash
bash start.sh
```

## Ready!

Your weave will be accessible at:
- **Dashboard**: https://weave.your-domain.com
- **API**: https://api-weave.your-domain.com

## Manual Setup

If you prefer manual configuration, follow these steps:

### 1. Install cloudflared

**Linux (Debian/Ubuntu):**
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

**macOS:**
```bash
brew install cloudflared
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will open your browser. Login to Cloudflare and select your domain.

### 3. Create a Tunnel

```bash
cloudflared tunnel create weave
```

Copy the tunnel UUID from the output.

### 4. Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /home/your-user/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  # Dashboard
  - hostname: weave.your-domain.com
    service: http://localhost:5173
  # API
  - hostname: api-weave.your-domain.com
    service: http://localhost:3000
  # Catch-all
  - service: http_status:404
```

### 5. Route DNS

```bash
cloudflared tunnel route dns weave weave.your-domain.com
cloudflared tunnel route dns weave api-weave.your-domain.com
```

### 6. Generate Tunnel Token

```bash
cloudflared tunnel token weave
```

### 7. Update .env File

Add to your `/root/projects/weave/.env`:

```env
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_SUBDOMAIN=weave
CLOUDFLARE_TUNNEL_DOMAIN=your-domain.com
CLOUDFLARE_ACCOUNT_TAG=your-account-tag
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
CLOUDFLARE_TUNNEL_ID=your-tunnel-uuid
CLOUDFLARE_FULL_DOMAIN=weave.your-domain.com
```

## Managing the Tunnel

### Temporarily disable
```bash
# Edit .env
nano .env
# Change: CLOUDFLARE_TUNNEL_ENABLED=false
bash start.sh
```

### Check tunnel status
```bash
cloudflared tunnel info weave
```

### View tunnel logs
```bash
tail -f /tmp/cloudflared.log
```

### Delete the tunnel
```bash
cloudflared tunnel delete weave
```

## Security Considerations

1. **Keep your tunnel token secret** - It provides access to your Cloudflare account
2. **Use strong authentication** - Change the default WEAVE_TOKEN
3. **Enable Cloudflare Access** (optional) - Add additional authentication layer
4. **Monitor logs** - Check for suspicious activity in Cloudflare dashboard
5. **Rotate tokens periodically** - Use Cloudflare Access for additional auth

## Advanced Configuration

### Custom Domain Path

```yaml
ingress:
  - hostname: your-domain.com
    service: http://localhost:5173
    path: /weave/*
  - service: http_status:404
```

### Multiple Instances

1. Create separate tunnels for each
2. Use different subdomains (e.g., `weave-1`, `weave-2`)
3. Configure different ports in `.env` for each instance

### Access Policies

Add Cloudflare Zero Trust access policies:

1. Go to Cloudflare Zero Trust dashboard
2. Navigate to Access → Applications
3. Add your tunnel hostname
4. Configure authentication (e.g., email, Google, OTP)

## See Also

- **[Architecture](ARCHITECTURE.md)** - System architecture, data flow, security model
- **[Troubleshooting](TROUBLESHOOTING.md)** - CORS issues, common errors, debugging
- **[Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)**
