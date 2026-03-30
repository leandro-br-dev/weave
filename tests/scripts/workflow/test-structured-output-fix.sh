#!/bin/bash

###############################################################################
# Workflow Test: Structured Output Format Fix
# Description: Verifies the correction of structured_output format.
#              Simulates what the daemon sends and checks if the format
#              is normalized correctly.
#
# Location: tests/scripts/workflow/
# Category: Automated Workflow Test
#
# Prerequisites:
#   - API server running on http://localhost:3000
#   - Valid test token configured
#
# Usage:
#   ./tests/scripts/workflow/test-structured-output-fix.sh
#
# Tests:
#   1. Create test plan
#   2. Submit structured output in daemon format
#   3. Verify format normalization
###############################################################################

set -e

API_URL="http://localhost:3000"
TOKEN="test-token"

echo "🧪 Testando correção de structured_output para improvement workflow"
echo ""

# 1. Criar um plano de teste
echo "1. Criando plano de teste..."
PLAN_RESPONSE=$(curl -s -X POST "$API_URL/api/plans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Structured Output Fix",
    "tasks": [{
      "id": "test-1",
      "name": "Test task"
    }]
  }')

PLAN_ID=$(echo "$PLAN_RESPONSE" | jq -r '.data.id')
echo "   ✓ Plano criado: $PLAN_ID"

# 2. Simular o que o daemon envia (formato antigo)
echo ""
echo "2. Enviando structured_output no formato que o daemon envia..."
STRUCTURED_RESPONSE=$(curl -s -X POST "$API_URL/api/plans/$PLAN_ID/structured-output" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "output": {
      "type": "improvement",
      "content": {
        "improvedContent": "Este é o conteúdo melhorado do CLAUDE.md",
        "explanation": "Explicação das melhorias"
      }
    }
  }')

echo "   ✓ Resposta: $STRUCTURED_RESPONSE"

# 3. Verificar se o formato foi normalizado corretamente
echo ""
echo "3. Verificando se o formato foi normalizado..."
PLAN_DATA=$(curl -s "$API_URL/api/plans/$PLAN_ID" \
  -H "Authorization: Bearer $TOKEN")

HAS_IMPROVED_CONTENT=$(echo "$PLAN_DATA" | jq -r '.data.structured_output.improvedContent // "MISSING"')

if [ "$HAS_IMPROVED_CONTENT" != "MISSING" ]; then
  echo "   ✓ Campo improvedContent encontrado: $HAS_IMPROVED_CONTENT"
  echo ""
  echo "✅ SUCESSO: O formato foi normalizado corretamente!"
  echo ""
  echo "Estrutura completa do structured_output:"
  echo "$PLAN_DATA" | jq '.data.structured_output'
  exit 0
else
  echo "   ✗ ERRO: Campo improvedContent não encontrado"
  echo ""
  echo "Estrutura do structured_output:"
  echo "$PLAN_DATA" | jq '.data.structured_output'
  exit 1
fi
