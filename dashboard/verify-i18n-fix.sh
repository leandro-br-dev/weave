#!/bin/bash

echo "=== i18n Configuration Verification ==="
echo ""
echo "Checking i18n.ts configuration..."
echo ""

# Check if 'pt' is in supportedLngs
if grep -q "supportedLngs: \['en-US', 'pt-BR', 'pt'\]" /root/projects/weave/dashboard/src/lib/i18n.ts; then
    echo "✓ 'pt' added to supportedLngs"
else
    echo "✗ 'pt' NOT found in supportedLngs"
fi

# Check if nonExplicitSupportedLngs is enabled
if grep -q "nonExplicitSupportedLngs: true," /root/projects/weave/dashboard/src/lib/i18n.ts; then
    echo "✓ nonExplicitSupportedLngs enabled"
else
    echo "✗ nonExplicitSupportedLngs NOT enabled"
fi

echo ""
echo "Dev server status:"
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "✓ Dev server running on port 5173"
else
    echo "✗ Dev server NOT running"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "To test manually:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Open browser console (F12)"
echo "3. Switch to Portuguese using the language selector"
echo "4. Verify no error message appears"
