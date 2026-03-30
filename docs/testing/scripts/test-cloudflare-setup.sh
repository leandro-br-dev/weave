#!/bin/bash
# Teste da configuração do Cloudflare Tunnel e CORS

echo "═══════════════════════════════════════════════════════════════"
echo "  Teste de Configuração - Cloudflare Tunnel & CORS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurações
DASHBOARD_DOMAIN="${CLOUDFLARE_FULL_DOMAIN:-weave.charhub.app}"
API_DOMAIN="api-${DASHBOARD_DOMAIN}"
API_PORT="${PORT:-3100}"
LOCAL_API_URL="http://localhost:${API_PORT}"
PUBLIC_API_URL="https://${API_DOMAIN}"

echo "📋 Configuração:"
echo "   Dashboard: https://${DASHBOARD_DOMAIN}"
echo "   API Local: ${LOCAL_API_URL}"
echo "   API Pública: ${PUBLIC_API_URL}"
echo ""

# Teste 1: API respondendo localmente
echo -n "1. Testando API local (${LOCAL_API_URL})... "
if curl -s "${LOCAL_API_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FALHOU${NC}"
    echo "   A API não está respondendo em ${LOCAL_API_URL}"
fi

# Teste 2: Dashboard respondendo
echo -n "2. Testando Dashboard (https://${DASHBOARD_DOMAIN})... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DASHBOARD_DOMAIN}" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FALHOU (HTTP ${HTTP_CODE})${NC}"
fi

# Teste 3: API respondendo via Cloudflare Tunnel
echo -n "3. Testando API pública (${PUBLIC_API_URL})... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${PUBLIC_API_URL}/api/health" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FALHOU (HTTP ${HTTP_CODE})${NC}"
fi

# Teste 4: CORS - Verificar se o domínio do dashboard é permitido
echo -n "4. Testando CORS (Origin: https://${DASHBOARD_DOMAIN})... "
CORS_RESULT=$(curl -s -I -H "Origin: https://${DASHBOARD_DOMAIN}" \
    -H "Access-Control-Request-Method: GET" \
    -X OPTIONS \
    "${LOCAL_API_URL}/api/health" 2>&1 | grep -i "access-control-allow-origin" || echo "")

if echo "$CORS_RESULT" | grep -q "https://${DASHBOARD_DOMAIN}"; then
    echo -e "${GREEN}✓ OK${NC}"
    echo "   $CORS_RESULT"
else
    echo -e "${YELLOW}⚠ NÃO VERIFICADO${NC}"
    echo "   Não foi possível confirmar se o CORS está configurado corretamente"
fi

# Teste 5: Verificar configuração do frontend
echo ""
echo "5. Verificando configuração do frontend..."
ENV_FILE="/root/projects/weave/dashboard/.env"
if [ -f "$ENV_FILE" ]; then
    if grep -q "^VITE_API_URL=" "$ENV_FILE"; then
        VITE_API_URL=$(grep "^VITE_API_URL=" "$ENV_FILE" | cut -d'=' -f2)
        if [ -n "$VITE_API_URL" ]; then
            echo -e "   ${YELLOW}⚠ VITE_API_URL está definido: ${VITE_API_URL}${NC}"
            echo "   Isso pode impedir a detecção automática do domínio público!"
            echo "   O cliente do navegador tentará acessar ${VITE_API_URL}"
        fi
    else
        echo -e "   ${GREEN}✓ VITE_API_URL não está definido${NC}"
        echo "   O frontend usará detecção automática: ${PUBLIC_API_URL}"
    fi
else
    echo -e "   ${YELLOW}⚠ Arquivo .env não encontrado${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Resumo"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Se todos os testes passarem, acesse:"
echo "  • Dashboard: https://${DASHBOARD_DOMAIN}"
echo "  • API: ${PUBLIC_API_URL}"
echo ""
echo "No navegador, verifique se o frontend está fazendo requisições"
echo "para ${PUBLIC_API_URL} e não para localhost."
echo ""
