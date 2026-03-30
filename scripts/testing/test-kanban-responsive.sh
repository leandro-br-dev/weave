#!/bin/bash

# Kanban Layout Responsive Test Script
# This script tests the responsive behavior of the Kanban board

echo "🧪 Kanban Board Layout Responsive Test"
echo "========================================"
echo ""

# Test 1: Verify the dev server is running
echo "📡 Test 1: Checking dev server status..."
if curl -s http://localhost:5174/ > /dev/null; then
    echo "✅ Dev server is running on http://localhost:5174/"
else
    echo "❌ Dev server is not accessible"
    exit 1
fi

echo ""

# Test 2: Check for the new responsive grid classes
echo "📱 Test 2: Verifying responsive grid classes in source..."
if grep -q "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5" /root/projects/weave/dashboard/src/pages/KanbanPage.tsx; then
    echo "✅ Responsive grid classes found"
    echo "   - Mobile (1 column): grid-cols-1"
    echo "   - Small (2 columns): sm:grid-cols-2"
    echo "   - Medium (3 columns): md:grid-cols-3"
    echo "   - Large (4 columns): lg:grid-cols-4"
    echo "   - XLarge (5 columns): xl:grid-cols-5"
    echo "   - 2XLarge (5 columns): 2xl:grid-cols-5"
else
    echo "❌ Responsive grid classes not found"
    exit 1
fi

echo ""

# Test 3: Verify container width change
echo "📏 Test 3: Verifying container width change..."
if grep -q "className=\"w-full mx-auto py-8 px-6\"" /root/projects/weave/dashboard/src/pages/KanbanPage.tsx; then
    echo "✅ Container width constraint removed (w-full instead of max-w-7xl)"
else
    echo "❌ Container width change not found"
    exit 1
fi

echo ""

# Test 4: Verify horizontal scroll support
echo "↔️  Test 4: Verifying horizontal scroll support..."
if grep -q "overflow-x-auto" /root/projects/weave/dashboard/src/pages/KanbanPage.tsx; then
    echo "✅ Horizontal scroll enabled (overflow-x-auto)"
else
    echo "❌ Horizontal scroll not found"
    exit 1
fi

echo ""

# Test 5: Verify no TypeScript errors
echo "🔍 Test 5: Checking for TypeScript errors..."
cd /root/projects/weave/dashboard
if npm run build > /dev/null 2>&1; then
    echo "✅ No TypeScript errors - build successful"
else
    echo "❌ TypeScript errors found"
    exit 1
fi

echo ""
echo "========================================"
echo "🎉 All tests passed!"
echo ""
echo "Summary of changes:"
echo "  • Full-width container (no max-width constraint)"
echo "  • Progressive responsive grid (1→2→3→4→5 columns)"
echo "  • Horizontal scroll support when needed"
echo "  • Optimized padding (p-3 instead of p-4)"
echo ""
echo "Expected behavior:"
echo "  • Mobile (< 640px): 1 column with horizontal scroll"
echo "  • Small (640px - 768px): 2 columns with horizontal scroll"
echo "  • Medium (768px - 1024px): 3 columns with horizontal scroll"
echo "  • Large (1024px - 1280px): 4 columns with horizontal scroll"
echo "  • XLarge (1280px+): 5 columns (all visible, minimal scroll needed)"
echo ""
echo "🌐 Visit http://localhost:5174/ to see the changes in action!"
