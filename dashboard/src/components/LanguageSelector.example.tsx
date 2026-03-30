/**
 * LanguageSelector Component Examples
 *
 * This file demonstrates various ways to use the LanguageSelector component
 */

import { LanguageSelector } from './LanguageSelector';

export function LanguageSelectorExample() {
  return (
    <div className="p-8 space-y-8">
      {/* Vertical Layout (Default) */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Vertical Layout (Default)</h2>
        <LanguageSelector />
      </div>

      {/* Horizontal Layout */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Horizontal Layout</h2>
        <LanguageSelector layout="horizontal" />
      </div>

      {/* With Custom Styling */}
      <div>
        <h2 className="text-lg font-semibold mb-4">With Custom Styling</h2>
        <LanguageSelector className="max-w-xs" />
      </div>

      {/* In a Card/Panel */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h3 className="text-base font-medium mb-4">Application Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <LanguageSelector layout="horizontal" />
          </div>
        </div>
      </div>

      {/* Minimal Horizontal for Navigation */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
        <span className="text-sm font-medium">Select Language:</span>
        <LanguageSelector layout="horizontal" className="gap-1" />
      </div>
    </div>
  );
}

// Example usage in a settings page:
/*
import { LanguageSelector } from '@/components/LanguageSelector';

export function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">Language & Region</h2>
          <div className="bg-white rounded-lg border p-6">
            <LanguageSelector />
          </div>
        </div>
      </section>
    </div>
  );
}
*/

// Example usage in a navbar:
/*
import { LanguageSelector } from '@/components/LanguageSelector';

export function Navbar() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-4">
        <Logo />
        <NavigationLinks />
      </div>

      <div className="flex items-center gap-4">
        <LanguageSelector layout="horizontal" />
        <UserMenu />
      </div>
    </nav>
  );
}
*/
