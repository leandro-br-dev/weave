# Guia de Troubleshooting - CORS e Cloudflare Tunnel

## Problemas Comuns e Soluções

### Erro: "CORS: origin not allowed"

**Sintoma**:
```
Access to fetch at 'http://localhost:3000/api/...' from origin 'https://seu-dominio.com'
has been blocked by CORS policy
```

**Solução**:
1. Adicione sua origem à variável `ALLOWED_ORIGINS` em `api/.env`:
   ```env
   ALLOWED_ORIGINS=https://seu-dominio.com,http://localhost:5173
   ```
2. Reinicie a API:
   ```bash
   pkill -f "tsx.*api/src/index.ts"
   cd /root/projects/weave/api && npm run dev
   ```

### Erro: "fetch failed" ou "Network error"

**Sintoma**: O frontend não consegue conectar à API

**Causas possíveis**:

1. **API não está rodando**
   ```bash
   # Verifique se a API está rodando
   curl http://localhost:3000/api/health
   ```

2. **URL da API incorreta**
   - Abra o DevTools do navegador (F12)
   - Vá para a aba Console
   - Verifique qual URL está sendo usada nas requisições
   - Se estiver usando `localhost:3100`, mas acessando via domínio público, a detecção automática falhou

3. **Cloudflare Tunnel não está rodando**
   ```bash
   # Verifique se o cloudflared está rodando
   ps aux | grep cloudflared
   ```

### Frontend continua usando localhost:3100

**Sintoma**: Mesmo acessando via domínio público, as requisições vão para localhost

**Solução**:

1. Verifique se `dashboard/.env` ainda tem `VITE_API_URL` hardcoded:
   ```bash
   cat dashboard/.env | grep VITE_API_URL
   ```

2. Se houver uma URL definida, comente-a ou remova-a:
   ```env
   # VITE_API_URL=http://localhost:3000  # Comente esta linha
   ```

3. Limpe o cache do navegador e recarregue a página (Ctrl+Shift+R)

### API não carrega variáveis de ambiente

**Sintoma**: `ALLOWED_ORIGINS` não está funcionando

**Verificações**:

1. Verifique se o dotenv está instalado:
   ```bash
   cd api && npm list dotenv
   ```

2. Se não estiver instalado:
   ```bash
   cd api && npm install dotenv
   ```

3. Verifique se `api/src/index.ts` importa o dotenv:
   ```typescript
   import 'dotenv/config'  // Deve estar na primeira linha
   ```

### Testes de CORS falhando

**Execute o script de testes**:
```bash
bash /root/projects/weave/test-cors.sh
```

**Resultados esperados**:
- Teste 1 (health): ✅ 200 OK
- Teste 2 (localhost): ✅ 204 No Content
- Teste 3 (domínio público): ✅ 204 No Content
- Teste 4 (não autorizado): ❌ 500 Internal Server Error (comportamento correto)

### Cloudflare Tunnel não funciona

**Sintoma**: Não é possível acessar via domínio público

**Verificações**:

1. Verifique se o tunnel está rodando:
   ```bash
   ps aux | grep cloudflared
   ```

2. Verifique o status do tunnel:
   ```bash
   cloudflared tunnel info <tunnel-id>
   ```

3. Veja os logs do cloudflared:
   ```bash
   tail -f /tmp/weave-cloudflare.log
   ```

4. Reinicie o tunnel se necessário:
   ```bash
   pkill cloudflared
   # Use start.sh para reiniciar tudo
   ```

## Comandos Úteis

### Verificar portas em uso
```bash
lsof -i :3000  # API
lsof -i :5173  # Dashboard
```

### Matar processos específicos
```bash
# Matar API
pkill -f "tsx.*api/src/index.ts"

# Matar Dashboard
pkill -f "vite.*--port"

# Matar Cloudflare Tunnel
pkill cloudflared
```

### Reiniciar serviços
```bash
# Reiniciar API
cd /root/projects/weave/api && npm run dev > /tmp/api.log 2>&1 &

# Reiniciar Dashboard
cd /root/projects/weave/dashboard && npm run dev > /tmp/dashboard.log 2>&1 &
```

### Verificar logs
```bash
# Logs da API
tail -f /tmp/api.log

# Logs do Dashboard
tail -f /tmp/dashboard.log

# Logs do Cloudflare Tunnel
tail -f /tmp/weave-cloudflare.log
```

### Testar endpoints manualmente
```bash
# Health check
curl http://localhost:3000/api/health

# Testar com token
curl -H "Authorization: Bearer <seu-token>" \
     http://localhost:3000/api/projects

# Testar CORS OPTIONS
curl -X OPTIONS \
     -H "Origin: https://weave.charhub.app" \
     -H "Access-Control-Request-Method: GET" \
     http://localhost:3000/api/plans/metrics
```

## Configuração de Novos Ambientes

### Produção com novo domínio

1. **Configure o Cloudflare Tunnel**:
   ```bash
   bash scripts/cloudflare-tunnel.sh
   ```

2. **Atualize `api/.env`**:
   ```env
   ALLOWED_ORIGINS=https://novo-dominio.com,https://api-novo-dominio.com
   ```

3. **Reinicie a API**:
   ```bash
   pkill -f "tsx.*api/src/index.ts"
   cd /root/projects/weave/api && npm run dev
   ```

4. **Atualize `dashboard/.env`** (se necessário para desenvolvimento):
   ```env
   # Deixe vazio para detecção automática
   # VITE_API_URL=
   ```

5. **Teste**:
   ```bash
   bash /root/projects/weave/test-cors.sh
   ```

## Checklist de Diagnóstico

Quando enfrentar problemas, verifique nesta ordem:

- [ ] API está rodando? (`curl http://localhost:3000/api/health`)
- [ ] Dashboard está rodando? (`curl http://localhost:5173`)
- [ ] Cloudflare Tunnel está rodando? (`ps aux | grep cloudflared`)
- [ ] Variáveis de ambiente estão configuradas? (`cat api/.env | grep ALLOWED_ORIGINS`)
- [ ] Dotenv está instalado? (`cd api && npm list dotenv`)
- [ ] CORS está configurado corretamente? (`bash test-cors.sh`)
- [ ] Cache do navegador foi limpo?
- [ ] Console do navegador mostra erros?

## Contato e Suporte

Se após seguir estes passos o problema persistir:

1. Colete os logs relevantes
2. Execute o script de teste e salve a saída
3. Verifique o console do navegador (F12)
4. Documente os passos reproduzíveis

## Tunnel-Specific Troubleshooting

### Issue: Authentication Timeout (context deadline exceeded)

**Error:**
```
2026-03-23T22:05:45Z ERR Failed to write the certificate.
error="Get \"https://login.cloudflareaccess.org/...\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)"
```

**Causes:**
- Slow or unstable internet connection
- Firewall blocking the connection
- WSL/Docker environment without proper browser setup
- Cloudflare service temporarily unavailable

**Solutions:**

#### Solution 1: Use Token Authentication (Recommended for headless environments)

1. Run the script again and choose option 2 (Token authentication)
2. Get your API token from https://dash.cloudflare.com/profile/api-tokens
3. Create a token with the following permissions:
   - **Zone** → **Zone** → **Read**
   - **Zone** → **DNS** → **Edit**
4. Paste the token when prompted

#### Solution 2: Manually Download Certificate

1. Copy the URL shown in the error message (starts with `https://dash.cloudflare.com/argotunnel`)
2. Open it in a browser on your host machine (not inside WSL/container)
3. Login and authorize cloudflared
4. Download the certificate file that gets generated
5. Create the directory: `mkdir -p ~/.cloudflared`
6. Save the certificate as: `~/.cloudflared/cert.pem`
7. Run the script again

#### Solution 3: Check Network Connectivity

```bash
# Test connectivity to Cloudflare
curl -I https://login.cloudflareaccess.org

# Check if port 443 is open
telnet login.cloudflareaccess.org 443
```

### Issue: Tunnel Creation Failed

**Error:**
```
Failed to create tunnel. Please check the output above.
```

**Solutions:**

1. **Verify Authentication:**
   ```bash
   ls -la ~/.cloudflared/cert.pem
   ```

2. **Check Certificate Validity:**
   ```bash
   openssl x509 -in ~/.cloudflared/cert.pem -text -noout
   ```

3. **Re-authenticate:**
   ```bash
   rm ~/.cloudflared/cert.pem
   bash scripts/cloudflare-tunnel.sh
   ```

### Issue: DNS Routing Failed

**Error:**
```
Failed to route DNS for weave.charhub.app
```

**Solutions:**

1. **Add CNAME Record Manually:**

   Go to Cloudflare Dashboard → DNS → Records → Add Record:
   - **Type:** CNAME
   - **Name:** `weave` (or your chosen subdomain)
   - **Target:** `<TUNNEL_ID>.cfargotunnel.com`
   - **Proxy:** Proxied (orange cloud)

2. **Verify Domain is Active:**
   - Make sure your domain is added to Cloudflare
   - Nameservers should be pointing to Cloudflare

### Issue: WSL/Docker Specific Problems

**Symptoms:**
- Browser doesn't open automatically
- Certificate download doesn't work

**Solutions:**

1. **Use Token Authentication (Recommended):**
   - Choose option 2 when running the setup script
   - No browser required

2. **Manually Copy Certificate:**
   - Authenticate on your host machine
   - Copy certificate to WSL:
     ```bash
     # From Windows PowerShell
     cp \\wsl$\Ubuntu\root\.cloudflared\cert.pem C:\temp\cert.pem
     ```

3. **Set DISPLAY for WSL:**
   ```bash
   export DISPLAY=:0
   bash scripts/cloudflare-tunnel.sh
   ```

### Quick Verification Commands

```bash
# Check certificate
ls -la ~/.cloudflared/

# List tunnels
cloudflared tunnel list

# Test DNS resolution
dig weave.your-domain.com
nslookup api-weave.your-domain.com

# Check ports
netstat -tuln | grep -E ':(3000|5173)'
# or
ss -tuln | grep -E ':(3000|5173)'
```

## Firewall Configuration

If you're running a firewall, ensure these ports are allowed:

**Outbound:**
- TCP 443 (HTTPS) - for Cloudflare services
- TCP 80 (HTTP) - for some Cloudflare services

**Local Services:**
- TCP 3000 - API server
- TCP 5173 - Dashboard dev server

### UFW (Ubuntu)
```bash
sudo ufw allow out 443/tcp
sudo ufw allow out 80/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp
```

### iptables
```bash
sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT
```

## Cleanup and Reset

If you need to start fresh:

```bash
# Remove all Cloudflare credentials
rm -rf ~/.cloudflared/

# Re-run setup
bash scripts/cloudflare-tunnel.sh
```

To remove a tunnel:
```bash
# List tunnels first
cloudflared tunnel list

# Delete specific tunnel
cloudflared tunnel delete <TUNNEL_NAME> || cloudflared tunnel delete <TUNNEL_ID>
```

## Referências

- [Documentação do Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [MDN Web Docs - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://github.com/expressjs/cors)
- [Cloudflare Status](https://www.cloudflarestatus.com/)
