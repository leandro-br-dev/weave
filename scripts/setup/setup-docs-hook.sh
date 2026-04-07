#!/bin/bash
################################################################################
# Script: setup-docs-hook.sh
# Purpose: Install and configure husky pre-commit hook for documentation checks
# Usage: ./scripts/setup-docs-hook.sh
################################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up documentation pre-commit hook...${NC}"
echo ""

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Check if husky is installed
if ! npm list husky &>/dev/null; then
    echo -e "${YELLOW}📦 Installing husky...${NC}"
    npm install --save-dev husky
    echo ""
fi

# Initialize husky if not already initialized
if [ ! -d .husky ]; then
    echo -e "${YELLOW}🔨 Initializing husky...${NC}"
    npx husky install
    echo ""
fi

# Create pre-commit hook
echo -e "${YELLOW}📝 Creating pre-commit hook...${NC}"
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running documentation checks..."
npm run check:docs
EOF

# Make the hook executable
chmod +x .husky/pre-commit

echo ""
echo -e "${GREEN}✅ Pre-commit hook configured successfully!${NC}"
echo ""
echo -e "${BLUE}📋 What happens now:${NC}"
echo "   - Every commit will trigger: npm run check:docs"
echo "   - The script will check for .md files in root (except README.md)"
echo "   - If violations are found, the commit will be blocked"
echo ""
echo -e "${BLUE}🧪 To test the hook:${NC}"
echo "   1. Create a test .md file in root: touch TEST.md"
echo "   2. Try to commit: git add . && git commit -m 'test'"
echo "   3. The commit should be blocked"
echo "   4. Remove the file: rm TEST.md"
echo "   5. Try again - commit should succeed"
echo ""
echo -e "${BLUE}📚 More information:${NC}"
echo "   - Documentation guidelines: /docs/DOCUMENTATION_GUIDELINES.md"
echo "   - Check script: /scripts/check-root-md.sh"
echo ""
