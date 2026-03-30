#!/bin/bash

echo "=== Native Agents Restructure Verification ==="
echo ""

echo "1. File Structure Verification:"
echo "   Checking if explorer.md exists..."
if [ -f "/root/projects/weave/native-agents/explorer.md" ]; then
    echo "   ✅ explorer.md exists"
else
    echo "   ❌ explorer.md does not exist"
    exit 1
fi

echo "   Checking if explorer/ directory was removed..."
if [ ! -d "/root/projects/weave/native-agents/explorer" ]; then
    echo "   ✅ explorer/ directory removed"
else
    echo "   ❌ explorer/ directory still exists"
    exit 1
fi

echo ""
echo "2. Content Verification:"
echo "   Checking YAML frontmatter..."
if grep -q "^---$" /root/projects/weave/native-agents/explorer.md; then
    echo "   ✅ YAML frontmatter present"
else
    echo "   ❌ YAML frontmatter missing"
    exit 1
fi

echo "   Checking required fields..."
if grep -q "^name: explorer" /root/projects/weave/native-agents/explorer.md; then
    echo "   ✅ name field present"
else
    echo "   ❌ name field missing"
    exit 1
fi

if grep -q "^description:" /root/projects/weave/native-agents/explorer.md; then
    echo "   ✅ description field present"
else
    echo "   ❌ description field missing"
    exit 1
fi

if grep -q "^model: haiku" /root/projects/weave/native-agents/explorer.md; then
    echo "   ✅ model field present"
else
    echo "   ❌ model field missing"
    exit 1
fi

if grep -q "^tools:" /root/projects/weave/native-agents/explorer.md; then
    echo "   ✅ tools field present"
else
    echo "   ❌ tools field missing"
    exit 1
fi

if grep -q "^color: blue" /root/projects/weave/native-agents/explorer.md; then
    echo "   ✅ color field present"
else
    echo "   ❌ color field missing"
    exit 1
fi

echo "   Checking content sections..."
required_sections=(
    "Your Purpose"
    "Your Process"
    "Key Principles"
    "When to Use This Agent"
    "Your Tools"
    "Output Format"
    "What NOT To Do"
)

for section in "${required_sections[@]}"; do
    if grep -q "## $section" /root/projects/weave/native-agents/explorer.md; then
        echo "   ✅ Section '$section' present"
    else
        echo "   ❌ Section '$section' missing"
        exit 1
    fi
done

echo ""
echo "3. Documentation Verification:"
echo "   Checking README.md references..."
if grep -q "explorer.md" /root/projects/weave/native-agents/README.md; then
    echo "   ✅ README.md references explorer.md"
else
    echo "   ❌ README.md does not reference explorer.md"
    exit 1
fi

if ! grep -q "explorer/" /root/projects/weave/native-agents/README.md; then
    echo "   ✅ README.md does not reference explorer/ directory"
else
    echo "   ❌ README.md still references explorer/ directory"
    exit 1
fi

echo "   Checking STRUCTURE.txt references..."
if grep -q "explorer.md" /root/projects/weave/native-agents/STRUCTURE.txt; then
    echo "   ✅ STRUCTURE.txt references explorer.md"
else
    echo "   ❌ STRUCTURE.txt does not reference explorer.md"
    exit 1
fi

echo ""
echo "4. API Implementation Verification:"
echo "   Checking GET endpoint..."
if grep -q "router.get('/native-agents'" /root/projects/weave/api/src/routes/workspaces.ts; then
    echo "   ✅ GET /api/workspaces/native-agents endpoint exists"
else
    echo "   ❌ GET endpoint missing"
    exit 1
fi

echo "   Checking POST endpoint..."
if grep -q "router.post('/:id/native-agents/:agentName'" /root/projects/weave/api/src/routes/workspaces.ts; then
    echo "   ✅ POST /api/workspaces/:id/native-agents/:agentName endpoint exists"
else
    echo "   ❌ POST endpoint missing"
    exit 1
fi

echo "   Checking YAML parser..."
if grep -q "function parseYamlFrontmatter" /root/projects/weave/api/src/routes/workspaces.ts; then
    echo "   ✅ YAML parser function exists"
else
    echo "   ❌ YAML parser missing"
    exit 1
fi

echo "   Checking file copying logic..."
if grep -q "fs.copyFileSync(agentSourceFile, agentDestFile)" /root/projects/weave/api/src/routes/workspaces.ts; then
    echo "   ✅ File copying logic implemented"
else
    echo "   ❌ File copying logic missing"
    exit 1
fi

echo "   Checking permission update logic..."
if grep -q "permissions.allow.push('Agent')" /root/projects/weave/api/src/routes/workspaces.ts; then
    echo "   ✅ Permission update logic implemented"
else
    echo "   ❌ Permission update logic missing"
    exit 1
fi

echo ""
echo "5. File Size Comparison:"
explorer_size=$(stat -f%z /root/projects/weave/native-agents/explorer.md 2>/dev/null || stat -c%s /root/projects/weave/native-agents/explorer.md)
echo "   explorer.md size: $explorer_size bytes"
if [ $explorer_size -gt 5000 ]; then
    echo "   ✅ File has substantial content"
else
    echo "   ❌ File seems too small"
    exit 1
fi

echo ""
echo "=== ✅ All Verifications Passed! ==="
echo ""
echo "Summary:"
echo "  - Single-file format: ✅"
echo "  - YAML frontmatter: ✅"
echo "  - Complete documentation: ✅"
echo "  - API endpoints: ✅"
echo "  - Documentation updates: ✅"
echo ""
echo "The native agents restructure is complete and correct!"
