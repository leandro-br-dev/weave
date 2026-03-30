#!/bin/bash

# Interactive Settings Page Testing Script
# This script helps test the refactored Settings page with tabs

echo "========================================="
echo "Settings Page - Interactive Test Script"
echo "========================================="
echo ""

# Check if dev server is running
if ! curl -s http://localhost:5174/ > /dev/null; then
    echo "❌ Dev server is not running on http://localhost:5174/"
    echo "Please start it with: cd dashboard && npm run dev"
    exit 1
fi

echo "✅ Dev server is running on http://localhost:5174/"
echo ""

# Test 1: Check if the page loads
echo "📋 Test 1: Checking if Settings page loads..."
if curl -s http://localhost:5174/ | grep -q "dashboard"; then
    echo "✅ Dashboard page loads successfully"
else
    echo "❌ Dashboard page failed to load"
    exit 1
fi
echo ""

# Test 2: Check TypeScript compilation
echo "📋 Test 2: Checking TypeScript compilation..."
cd /root/projects/weave/dashboard
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful (no errors)"
else
    echo "❌ TypeScript compilation failed"
    npx tsc --noEmit
    exit 1
fi
echo ""

# Test 3: Check for SettingsPage component
echo "📋 Test 3: Verifying SettingsPage component..."
if [ -f "src/pages/SettingsPage.tsx" ]; then
    if grep -q "Tabs" src/pages/SettingsPage.tsx; then
        echo "✅ SettingsPage uses Tabs component"
    else
        echo "❌ SettingsPage does not use Tabs component"
        exit 1
    fi

    # Check for all three tabs
    if grep -q "id: 'general'" src/pages/SettingsPage.tsx && \
       grep -q "id: 'connections'" src/pages/SettingsPage.tsx && \
       grep -q "id: 'system'" src/pages/SettingsPage.tsx; then
        echo "✅ All three tabs configured (general, connections, system)"
    else
        echo "❌ Not all tabs are configured"
        exit 1
    fi

    # Check for modular sections
    if grep -q "LanguageSection" src/pages/SettingsPage.tsx && \
       grep -q "ApiConnectionSection" src/pages/SettingsPage.tsx && \
       grep -q "DaemonSection" src/pages/SettingsPage.tsx; then
        echo "✅ Modular sections extracted correctly"
    else
        echo "❌ Not all sections are modular"
        exit 1
    fi
else
    echo "❌ SettingsPage.tsx not found"
    exit 1
fi
echo ""

# Test 4: Check Tabs component
echo "📋 Test 4: Verifying Tabs component..."
if [ -f "src/components/Tabs.tsx" ]; then
    if grep -q "role=\"tablist\"" src/components/Tabs.tsx && \
       grep -q "role=\"tab\"" src/components/Tabs.tsx && \
       grep -q "role=\"tabpanel\"" src/components/Tabs.tsx; then
        echo "✅ Tabs component has proper ARIA attributes"
    else
        echo "❌ Tabs component missing ARIA attributes"
        exit 1
    fi

    if grep -q "ArrowLeft" src/components/Tabs.tsx && \
       grep -q "ArrowRight" src/components/Tabs.tsx && \
       grep -q "Home" src/components/Tabs.tsx && \
       grep -q "End" src/components/Tabs.tsx; then
        echo "✅ Tabs component supports keyboard navigation"
    else
        echo "❌ Tabs component missing keyboard navigation"
        exit 1
    fi
else
    echo "❌ Tabs.tsx component not found"
    exit 1
fi
echo ""

# Test 5: Check translations
echo "📋 Test 5: Verifying translations..."
if [ -f "src/locales/en-US/settings.json" ] && \
   [ -f "src/locales/pt-BR/settings.json" ]; then

    if grep -q '"tabs"' src/locales/en-US/settings.json && \
       grep -q '"general"' src/locales/en-US/settings.json && \
       grep -q '"connections"' src/locales/en-US/settings.json && \
       grep -q '"system"' src/locales/en-US/settings.json; then
        echo "✅ English translations configured for tabs"
    else
        echo "❌ English translations missing for tabs"
        exit 1
    fi

    if grep -q '"tabs"' src/locales/pt-BR/settings.json && \
       grep -q '"general"' src/locales/pt-BR/settings.json && \
       grep -q '"connections"' src/locales/pt-BR/settings.json && \
       grep -q '"system"' src/locales/pt-BR/settings.json; then
        echo "✅ Portuguese translations configured for tabs"
    else
        echo "❌ Portuguese translations missing for tabs"
        exit 1
    fi
else
    echo "❌ Translation files not found"
    exit 1
fi
echo ""

# Test 6: Check production build
echo "📋 Test 6: Testing production build..."
if npm run build > /tmp/build.log 2>&1; then
    echo "✅ Production build successful"
    BUILD_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
    echo "   Build size: $BUILD_SIZE"
else
    echo "❌ Production build failed"
    tail -20 /tmp/build.log
    exit 1
fi
echo ""

# Summary
echo "========================================="
echo "✅ ALL AUTOMATED TESTS PASSED!"
echo "========================================="
echo ""
echo "📊 Summary:"
echo "  ✅ Dev server running"
echo "  ✅ TypeScript compilation successful"
echo "  ✅ SettingsPage refactored with tabs"
echo "  ✅ Tabs component with ARIA attributes"
echo "  ✅ Keyboard navigation supported"
echo "  ✅ Translations configured (en-US, pt-BR)"
echo "  ✅ Production build successful"
echo ""
echo "🌐 Access the Settings page at:"
echo "   http://localhost:5174/settings"
echo ""
echo "📝 Manual Testing Checklist:"
echo "   1. Navigate to Settings page"
echo "   2. Click each tab (General, Connections, System)"
echo "   3. Verify content displays correctly"
echo "   4. Test keyboard navigation (Arrow keys, Home, End)"
echo "   5. Test language switching (en-US ↔ pt-BR)"
echo "   6. Test theme switching (Light/Dark/System)"
echo "   7. Test forms in each tab:"
echo "      - General: Language, Appearance"
echo "      - Connections: API status, Cloudflare, Environment Variables"
echo "      - System: Daemon start/stop, Client status"
echo "   8. Check browser console for errors"
echo "   9. Test responsive design (resize browser)"
echo ""
echo "📚 Full test report: /root/projects/weave/SETTINGS_TEST_REPORT.md"
echo ""
