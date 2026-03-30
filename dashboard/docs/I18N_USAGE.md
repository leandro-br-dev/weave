# i18n Integration Guide

## ✅ Integration Complete

The i18n (internationalization) system has been successfully integrated into the dashboard application.

### What Was Done

1. **Updated `/root/projects/weave/dashboard/src/lib/i18n.ts`**
   - Imported all translation files from `locales/en-US/` and `locales/pt-BR/`
   - Combined translations into a nested structure: `common` and `pages.*`
   - Configured i18next with language detection and fallback support

2. **Updated `/root/projects/weave/dashboard/src/main.tsx`**
   - Added i18n import: `import './lib/i18n'`
   - i18n is initialized before the app renders
   - Properly integrated with existing React Query and Router providers

3. **Created Example Component**
   - `/root/projects/weave/dashboard/src/components/I18nExample.tsx`
   - Demonstrates common i18n usage patterns

### Provider Stack Order

```
StrictMode
└── QueryClientProvider (React Query)
    └── ToastProvider
        └── ThemeProvider
            └── RouterProvider (React Router)
```

The i18n instance is imported at the module level, so it's initialized before any providers are used.

## How to Use i18n in Your Components

### Basic Usage

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('common.nav.dashboard')}</h1>
      <button>{t('common.buttons.save')}</button>
    </div>
  );
}
```

### Accessing Page-Specific Translations

```tsx
// Workflows page translations
const t('pages.workflows.title')
const t('pages.workflows.list.title')
const t('pages.workflows.create.title')

// Projects page translations
const t('pages.projects.title')
const t('pages.projects.create.form.name')
```

### Using Interpolation

```tsx
// Translation: "Success: {{name}}"
const message = t('common.status.success', { name: 'Project Created' });
// Result: "Success: Project Created"

// Translation: "Deleted {{count}} items"
const message = t('common.status.deleted', { count: 5 });
// Result: "Deleted 5 items"
```

### Changing Language Programmatically

```tsx
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div>
      <button onClick={() => changeLanguage('en-US')}>English</button>
      <button onClick={() => changeLanguage('pt-BR')}>Português</button>
    </div>
  );
}
```

### Getting Current Language

```tsx
const { i18n } = useTranslation();

const currentLanguage = i18n.language; // 'en-US' or 'pt-BR'
const isInitialized = i18n.isInitialized; // true/false
```

## Translation Structure

### Common Translations
- `common.nav.*` - Navigation items
- `common.buttons.*` - Button labels
- `common.status.*` - Status messages
- `common.actions.*` - Action labels
- `common.languageSwitcher.*` - Language switcher

### Page-Specific Translations
- `pages.workflows.*` - Workflow management
- `pages.projects.*` - Project management
- `pages.agents.*` - AI agent configuration
- `pages.settings.*` - Application settings
- `pages.chat.*` - Chat interface
- `pages.approvals.*` - Approval workflows
- `pages.marketplace.*` - Marketplace items
- `pages.kanban.*` - Kanban boards

## Language Detection

The i18n system detects language in this order (highest to lowest priority):

1. **localStorage** - Key: `i18nextLng`
2. **HTML tag** - `<html lang="en-US">`
3. **Navigator** - Browser language settings

The detected language is cached in localStorage for persistence.

## Supported Languages

- **en-US** (English - United States) - Default
- **pt-BR** (Portuguese - Brazil)

## Testing i18n

### Development Server

```bash
cd /root/projects/weave/dashboard
npm run dev
```

The application will start on `http://localhost:5173` (or next available port).

### Build Test

```bash
npm run build
```

✅ Build completed successfully - No TypeScript errors found.

### Example Component

View the example component at:
```
/root/projects/weave/dashboard/src/components/I18nExample.tsx
```

This demonstrates:
- Language switching
- Translation access
- Interpolation
- Current language info

## Next Steps

1. **Add the Language Switcher to Your Layout**
   - Import `I18nExample` or create your own language switcher
   - Place it in a visible location (header, sidebar, etc.)

2. **Replace Hardcoded Strings**
   - Find hardcoded text in your components
   - Add translations to the appropriate JSON file
   - Replace with `t('key.path')`

3. **Add Missing Translations**
   - Check for missing translations in the console
   - Add them to both `en-US` and `pt-BR` files

## LanguageSelector Component

### Import

```tsx
import { LanguageSelector } from '@/components/LanguageSelector';
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `''` | Additional CSS classes |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | Button layout direction |

### Usage Examples

```tsx
// Vertical (default)
<LanguageSelector />

// Horizontal
<LanguageSelector layout="horizontal" />

// With custom styling
<LanguageSelector className="max-w-xs" />
```

### Common Patterns

**Settings page:**
```tsx
<div className="space-y-4">
  <label className="block text-sm font-medium mb-2">Language</label>
  <LanguageSelector />
</div>
```

**Navigation bar:**
```tsx
<nav className="flex items-center justify-between">
  <Logo />
  <LanguageSelector layout="horizontal" />
</nav>
```

**Alongside ThemeSelector:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>
    <label className="block text-sm font-medium mb-2">Theme</label>
    <ThemeSelector layout="horizontal" />
  </div>
  <div>
    <label className="block text-sm font-medium mb-2">Language</label>
    <LanguageSelector layout="horizontal" />
  </div>
</div>
```

### How It Works

1. User clicks a language button
2. Component calls `i18n.changeLanguage(lng)`
3. i18next updates the language and saves to localStorage
4. Component listens to `languageChanged` event
5. UI updates to reflect the new active language

### Accessibility

- `role="group"` on the container
- `aria-label` on buttons
- `aria-pressed` for active state
- Full keyboard navigation support

## Troubleshooting

### Translations Not Showing

1. Check browser console for errors
2. Verify the translation key exists in the JSON files
3. Ensure the correct namespace is being used (default: `translation`)

### Language Not Persisting

1. Check localStorage for `i18nextLng` key
2. Verify language detection is working
3. Check browser settings

### TypeScript Errors

1. Ensure translation keys match the JSON structure
2. Use string literals for translation keys
3. Check for typos in key paths

### "rejecting language code not found in supportedLngs: pt"

The browser may send generic `pt` instead of `pt-BR`. This was resolved by:

1. Adding `'pt'` to `supportedLngs` in `src/lib/i18n.ts`:
   ```typescript
   supportedLngs: ['en-US', 'pt-BR', 'pt'],
   ```
2. Enabling `nonExplicitSupportedLngs: true` so i18next maps `pt` → `pt-BR` automatically.

### Missing translation keys in console

If `debug: true` is set (enabled in development via `import.meta.env.DEV`), missing keys produce warnings. Common causes:

- **Wrong namespace prefix:** e.g., `t('agents.title')` instead of `t('pages.agents.title')`
- **Self-wrapped JSON nesting:** some JSON files contain an extra namespace layer (e.g., `pages.workflows` inside `workflows.json`)
- **Missing translation file:** feature components like `CreatePlanForm` and `PlanDetail` use keys with no corresponding JSON file

For a full inventory of ~285 known missing keys and recommended fixes, see [`docs/i18n-fix-report.md`](./i18n-fix-report.md).

## Files Modified

- ✅ `/root/projects/weave/dashboard/src/lib/i18n.ts` - Updated to load translation files
- ✅ `/root/projects/weave/dashboard/src/main.tsx` - Added i18n import

## Files Created

- ✅ `/root/projects/weave/dashboard/src/components/I18nExample.tsx` - Example component

## Translation Files Location

- English: `/root/projects/weave/dashboard/src/locales/en-US/`
- Portuguese: `/root/projects/weave/dashboard/src/locales/pt-BR/`
- Metadata: `/root/projects/weave/dashboard/src/locales/languages.json`
