/**
 * LanguageSelector Demo Component
 *
 * This is a demo page to showcase the LanguageSelector component in different contexts.
 * You can import this into your App.tsx or any test page to see the component in action.
 */

import { LanguageSelector } from './LanguageSelector';
import { Card } from './Card';
import { useTranslation } from 'react-i18next';

export function LanguageSelectorDemo() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('common.languageSwitcher.title', 'Language Selector Demo')}
          </h1>
          <p className="text-gray-600">
            Interactive demo of the LanguageSelector component
          </p>
        </div>

        {/* Example 1: Vertical Layout (Default) */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Vertical Layout (Default)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Best for settings pages and forms where vertical space is available.
          </p>
          <div className="max-w-xs">
            <LanguageSelector />
          </div>
        </Card>

        {/* Example 2: Horizontal Layout */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Horizontal Layout</h2>
          <p className="text-sm text-gray-600 mb-4">
            Perfect for navigation bars and toolbars where horizontal space is available.
          </p>
          <LanguageSelector layout="horizontal" />
        </Card>

        {/* Example 3: In a Settings Panel */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Settings Panel Example</h2>
          <p className="text-sm text-gray-600 mb-4">
            As it would appear in a user settings page.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Language
              </label>
              <LanguageSelector className="max-w-xs" />
              <p className="mt-2 text-xs text-gray-500">
                Your language preference will be saved automatically.
              </p>
            </div>
          </div>
        </Card>

        {/* Example 4: Compact Horizontal */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Compact Navigation Bar</h2>
          <p className="text-sm text-gray-600 mb-4">
            Minimal horizontal version for tight spaces.
          </p>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <span className="text-sm font-medium">Language:</span>
            <LanguageSelector layout="horizontal" className="gap-1" />
          </div>
        </Card>

        {/* Example 5: With Additional Controls */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Alongside Other Controls</h2>
          <p className="text-sm text-gray-600 mb-4">
            Language selector working with other settings.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <LanguageSelector layout="horizontal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notifications
              </label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option>Enabled</option>
                <option>Disabled</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">How to Test</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Click any language button to switch languages</li>
            <li>Refresh the page - your preference is saved!</li>
            <li>Check that the active language is highlighted</li>
            <li>Verify the flag and language names display correctly</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
