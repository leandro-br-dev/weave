/**
 * ThemeSelector Component Examples
 *
 * This file demonstrates how to use the ThemeSelector component in different contexts.
 */

import { ThemeSelector } from '@/components/ThemeSelector';
import { Card } from '@/components/Card';

// Example 1: Sidebar Usage (Horizontal Layout)
// Compact layout with icons and small labels, suitable for narrow spaces
export function SidebarThemeExample() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">Theme:</span>
      <ThemeSelector layout="horizontal" className="flex-row" />
    </div>
  );
}

// Example 2: Settings Page Usage (Vertical Layout)
// Full-featured layout with descriptions and checkmarks
export function SettingsThemeExample() {
  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Appearance</h3>
          <p className="text-sm text-gray-500 mt-1">
            Customize how the application looks on your device
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Theme Preference
          </label>
          <ThemeSelector layout="vertical" />
        </div>
      </div>
    </Card>
  );
}

// Example 3: With Custom className
// You can add custom styling for specific use cases
export function CustomStyledExample() {
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <ThemeSelector
        layout="horizontal"
        className="bg-white p-2 rounded-lg shadow-sm"
      />
    </div>
  );
}

// Example 4: Minimal Inline Usage
// For quick theme switching in headers or toolbars
export function InlineThemeExample() {
  return (
    <div className="flex items-center justify-between">
      <span>Appearance</span>
      <ThemeSelector layout="horizontal" />
    </div>
  );
}
