#!/bin/bash
################################################################################
# Script: check-root-md.sh
# Purpose: Verify that no .md files exist in the project root (except README.md)
# Usage: ./scripts/check-root-md.sh
# Exit codes: 0 = success (no violations), 1 = violations found
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Counter for violations
VIOLATION_COUNT=0

echo -e "${BLUE}🔍 Checking for .md files in project root...${NC}"
echo ""

# Find all .md files in root (excluding README.md)
ROOT_MD_FILES=$(find "$PROJECT_ROOT" -maxdepth 1 -name '*.md' -type f ! -name 'README.md' 2>/dev/null || true)

# Check if any violations were found
if [ ! -z "$ROOT_MD_FILES" ]; then
    echo -e "${RED}❌ ERRO: Arquivos .md encontrados na raiz (exceto README.md):${NC}"
    echo ""

    # Count and list violations
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
            filename=$(basename "$file")
            echo -e "${RED}  $VIOLATION_COUNT. $filename${NC}"

            # Get file size for context
            filesize=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
            echo -e "     Localização: $file"
            echo -e "     Tamanho: $filesize bytes"
            echo ""
        fi
    done <<< "$ROOT_MD_FILES"

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}📋 Ação necessária:${NC}"
    echo "   Por favor, mova esses arquivos para /docs/ ou subdiretórios apropriados."
    echo ""
    echo -e "${BLUE}📚 Diretrizes de documentação:${NC}"
    echo "   Veja /docs/DOCUMENTATION_GUIDELINES.md para orientação completa."
    echo ""
    echo -e "${BLUE}📁 Estrutura recomendada:${NC}"
    echo "   /docs/testing/       → Test reports, test plans"
    echo "   /docs/implementation/ → Implementation details"
    echo "   /docs/architecture/   → Architecture docs"
    echo "   /docs/features/       → Feature specifications"
    echo "   /docs/references/     → Reference guides"
    echo "   /docs/analysis/       → Technical analysis"
    echo "   /docs/changelog/      → Change logs"
    echo "   /docs/archives/       → Deprecated docs"
    echo ""
    echo -e "${YELLOW}💡 Comando rápido para mover arquivos:${NC}"
    echo "   mv <arquivo.md> docs/<subdiretório>/"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    exit 1
else
    echo -e "${GREEN}✅ Nenhum arquivo .md indevido na raiz do projeto.${NC}"
    echo -e "${GREEN}   Apenas README.md é permitido na raiz.${NC}"
    echo ""
    exit 0
fi
