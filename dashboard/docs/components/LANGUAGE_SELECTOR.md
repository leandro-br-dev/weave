# LanguageSelector Component

A component that allows users to switch between application languages with a clean, accessible UI.

## Features

- ✅ **Two Layout Options**: Vertical (default) or horizontal button layout
- ✅ **Automatic Persistence**: Language preference is automatically saved to localStorage via i18next
- ✅ **Visual Feedback**: Clear indication of selected language with checkmark (vertical) or active styling (horizontal)
- ✅ **Accessibility**: Proper ARIA labels and roles for screen readers
- ✅ **Native Language Names**: Displays languages in their native names with flags
- ✅ **Responsive Design**: Works well in different container sizes
- ✅ **Real-time Updates**: Automatically updates when language changes

## Installation

The component is already set up with i18next. Make sure you have:

1. i18next configured in your application (see `/src/lib/i18n.ts`)
2. Translation files in `/src/locales/` directory
3. I18nextProvider wrapping your app

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `''` | Additional CSS classes to apply to the container |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | Layout direction for the language buttons |

## Usage

### Basic Usage (Vertical Layout)

```tsx
import { LanguageSelector } from '@/components/LanguageSelector';

export function SettingsPage() {
  return (
    <div>
      <h2>Language Settings</h2>
      <LanguageSelector />
    </div>
  );
}
```

### Horizontal Layout (for Navigation Bars)

```tsx
import { LanguageSelector } from '@/components/LanguageSelector';

export function Navbar() {
  return (
    <nav className="flex items-center justify-between">
      <Logo />
      <LanguageSelector layout="horizontal" />
    </nav>
  );
}
```

### With Custom Styling

```tsx
<LanguageSelector className="max-w-xs mx-auto" />
```

### In a Settings Card

```tsx
<div className="bg-white rounded-lg border p-6">
  <h3 className="text-lg font-semibold mb-4">Language & Region</h3>
  <LanguageSelector />
</div>
```

## Supported Languages

Currently supported languages:

- 🇺🇸 **English (US)** - `en-US`
- 🇧🇷 **Português (Brasil)** - `pt-BR`

### Adding New Languages

To add a new language:

1. **Create translation files** in `/src/locales/`:
   ```
   /src/locales/
     ├── es-ES/
     │   ├── common.json
     │   ├── workflows.json
     │   └── ...
   ```

2. **Update i18n config** (`/src/lib/i18n.ts`):
   ```typescript
   import esESCommon from '../locales/es-ES/common.json';
   // ... import other files

   const esES = {
     common: esESCommon,
     // ... other namespaces
   };

   i18n.init({
     supportedLngs: ['en-US', 'pt-BR', 'es-ES'],
     resources: {
       'en-US': { translation: enUS },
       'pt-BR': { translation: ptBR },
       'es-ES': { translation: esES },
     },
   });
   ```

3. **Update LanguageSelector component** (`/src/components/LanguageSelector.tsx`):
   ```typescript
   const languageOptions: LanguageOption[] = [
     // ... existing languages
     {
       code: 'es-ES',
       nativeName: 'Español',
       localName: 'Spanish',
       flag: '🇪🇸',
     },
   ];
   ```

## How It Works

### State Management

The component uses i18next's built-in language detection and persistence:

1. **Initial Load**: i18next reads from `localStorage` key `i18nextLng`
2. **Language Change**: When user clicks a button, `i18n.changeLanguage()` is called
3. **Persistence**: i18next automatically saves the new language to `localStorage`
4. **React Updates**: Component listens to `languageChanged` event and re-renders

### Accessibility Features

- **Role**: `role="group"` on container, `aria-label` for context
- **Button States**: `aria-pressed` indicates active language
- **Screen Reader Support**: Flag emojis have `aria-label`, buttons have descriptive labels
- **Keyboard Navigation**: Full keyboard support with visible focus rings

### Styling

The component uses Tailwind CSS with classes matching your existing design system:

- **Active State**: `bg-gray-900 text-white border-gray-900`
- **Inactive State**: `bg-white text-gray-700 border-gray-300 hover:bg-gray-50`
- **Focus State**: `focus:ring-2 focus:ring-gray-900 focus:ring-offset-1`
- **Transitions**: `transition-all duration-150`

## Integration with Existing Components

### With ThemeSelector

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <div>
    <h3 className="text-sm font-medium mb-3">Theme</h3>
    <ThemeSelector layout="horizontal" />
  </div>
  <div>
    <h3 className="text-sm font-medium mb-3">Language</h3>
    <LanguageSelector layout="horizontal" />
  </div>
</div>
```

### In User Settings Page

```tsx
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeSelector } from '@/components/ThemeSelector';
import { useTranslation } from 'react-i18next';

export function UserSettings() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{t('pages.settings.title')}</h1>

      <section className="space-y-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t('pages.settings.appearance')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('pages.settings.theme')}
              </label>
              <ThemeSelector />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('pages.settings.language')}
              </label>
              <LanguageSelector />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

## Testing

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSelector } from './LanguageSelector';
import { i18n } from '@/lib/i18n';

describe('LanguageSelector', () => {
  beforeEach(() => {
    i18n.changeLanguage('en-US');
  });

  it('renders all language options', () => {
    render(<LanguageSelector />);
    expect(screen.getByLabelText(/Switch to English/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Switch to Portuguese/)).toBeInTheDocument();
  });

  it('highlights the current language', () => {
    render(<LanguageSelector />);
    const englishButton = screen.getByLabelText(/Switch to English/);
    expect(englishButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('changes language when clicking a button', () => {
    render(<LanguageSelector />);
    const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);

    fireEvent.click(portugueseButton);

    expect(i18n.language).toBe('pt-BR');
  });

  it('persists language choice to localStorage', () => {
    render(<LanguageSelector />);
    const portugueseButton = screen.getByLabelText(/Switch to Portuguese/);

    fireEvent.click(portugueseButton);

    expect(localStorage.getItem('i18nextLng')).toBe('pt-BR');
  });
});
```

## Examples

See `/src/components/LanguageSelector.example.tsx` for more usage examples.

## Troubleshooting

### Language not persisting

Make sure i18next's `LanguageDetector` is configured with localStorage caching:
```typescript
detection: {
  order: ['localStorage', 'htmlTag', 'navigator'],
  lookupLocalStorage: 'i18nextLng',
  caches: ['localStorage'],
}
```

### Component not re-rendering

The component uses `useEffect` to listen to i18next's `languageChanged` event. If it's not updating, check:
1. i18n instance is properly initialized
2. Component is wrapped with I18nextProvider
3. No other components are calling `i18n.changeLanguage()` in a loop

### Styling issues

The component uses Tailwind CSS classes. Make sure:
1. Tailwind is properly configured
2. The `@/components` path alias is configured in your tsconfig.json
3. No global CSS is overriding the component styles

## License

MIT
