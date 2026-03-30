# Dark Mode System

Reference documentation for implementing and maintaining dark mode across the dashboard.

---

## 1. Overview

The dashboard uses Tailwind CSS `dark:` variant classes for theming, controlled by a `ThemeContext` that supports three modes: **light**, **dark**, and **system** (follows OS preference via `prefers-color-scheme`).

### How it works

1. `ThemeContext` reads the user's preference from `localStorage`, defaulting to `'system'`.
2. On mount, it resolves the effective theme and applies a `dark` class to the document root.
3. A `MediaQueryList` listener on `(prefers-color-scheme: dark)` detects OS changes in real time and updates the DOM immediately.
4. Components use Tailwind's `dark:` prefix — no conditional JavaScript logic or ternaries needed.

### Key rules

- **Always pair light and dark classes** on every element that needs them (e.g., `bg-white dark:bg-gray-950`).
- **Never use `dark:bg-white`** except for intentionally inverted elements (like primary buttons).
- **Prefer semantic imports** from `@/lib/colors` over hardcoded class strings.
- All color combinations meet **WCAG AA** contrast standards.

---

## 2. Color System

All dark mode colors are exported from `src/lib/colors.ts`.

### The `darkModeColors` export

```typescript
import { darkModeColors } from '@/lib/colors'

darkModeColors.status      // Status badge colors (pending, running, success, failed, timeout, …)
darkModeColors.buttons     // Button variant colors (primary, secondary, danger, ghost)
darkModeColors.metrics     // Metric/stat colors (default, green, red, amber)
darkModeColors.error       // Error state colors
darkModeColors.success     // Success state colors
darkModeColors.warning     // Warning state colors
darkModeColors.info        // Info state colors
darkModeColors.bg          // Background hierarchy
darkModeColors.text        // Text hierarchy
darkModeColors.border      // Border hierarchy
darkModeColors.interactive // Hover, disabled, focus ring states
```

Individual sub-exports are also available:

```typescript
import {
  darkModeBgColors,       // primary, secondary, tertiary, inverted
  darkModeTextColors,      // primary, secondary, tertiary, muted, veryMuted, inverted
  darkModeBorderColors,    // default, thick, subtle, strong
  darkModeStatusColors,
  darkModeButtonVariants,
  darkModeMetricColors,
  darkModeErrorColors,
  darkModeSuccessColors,
  darkModeWarningColors,
  darkModeInfoColors,
} from '@/lib/colors'
```

A helper function `withDarkMode(lightClass, darkClass)` combines both into a single string.

### Color Philosophy

#### Background hierarchy (dark → light elevation)

| Level | Tailwind class | Usage |
|-------|---------------|-------|
| Primary | `dark:bg-gray-950` | Main content area (darkest) |
| Secondary | `dark:bg-gray-900` | Cards, panels |
| Tertiary | `dark:bg-gray-800` | Nested sections, hover states |
| Inverted | `dark:bg-gray-700` | Light sections in dark mode |

#### Text hierarchy (bright → muted)

| Level | Tailwind class | Usage |
|-------|---------------|-------|
| Primary | `dark:text-gray-100` | Headings, important content |
| Secondary | `dark:text-gray-300` | Body text, descriptions |
| Tertiary | `dark:text-gray-400` | Supporting text, metadata |
| Muted | `dark:text-gray-500` | Captions, placeholders |
| Very muted | `dark:text-gray-600` | Timestamps, subtle labels |

#### Border hierarchy (dark → light weight)

| Level | Tailwind class | Usage |
|-------|---------------|-------|
| Default | `dark:border-gray-800` | Cards, inputs |
| Thick | `dark:border-gray-700` | Emphasis borders |
| Strong | `dark:border-gray-600` | Section dividers |
| Subtle | `dark:border-gray-800/50` | Very faint separators |

#### Status and semantic colors

| Status/Semantic | Light BG | Dark BG | Light text | Dark text |
|----------------|----------|---------|------------|-----------|
| pending | `bg-yellow-50` | `dark:bg-gray-900` | `text-yellow-700` | `dark:text-yellow-300` |
| running | `bg-blue-50` | `dark:bg-blue-950` | `text-blue-700` | `dark:text-blue-300` |
| success | `bg-green-50` | `dark:bg-green-950` | `text-green-700` | `dark:text-green-300` |
| failed | `bg-red-50` | `dark:bg-red-950` | `text-red-700` | `dark:text-red-300` |
| timeout | `bg-amber-50` | `dark:bg-amber-950` | `text-amber-700` | `dark:text-amber-300` |
| error | `bg-red-50` | `dark:bg-red-950` | `text-red-600` | `dark:text-red-400` |
| warning | `bg-amber-50` | `dark:bg-amber-950` | `text-amber-600` | `dark:text-amber-400` |
| info | `bg-blue-50` | `dark:bg-blue-950` | `text-blue-600` | `dark:text-blue-400` |

#### Button variants

| Variant | Light BG | Dark BG | Light text | Dark text |
|---------|----------|---------|------------|-----------|
| primary | `bg-gray-900` | `dark:bg-white` | `text-white` | `dark:text-gray-900` |
| secondary | `bg-white` | `dark:bg-gray-800` | `text-gray-700` | `dark:text-gray-200` |
| danger | `bg-white` | `dark:bg-gray-800` | `text-red-600` | `dark:text-red-400` |
| ghost | `bg-transparent` | `dark:bg-transparent` | `text-gray-500` | `dark:text-gray-400` |

### Usage patterns

```tsx
// Option 1: Semantic import (recommended)
import { bgColors, darkModeBgColors } from '@/lib/colors'
<div className={`${bgColors.primary} ${darkModeBgColors.primary}`}>

// Option 2: Helper function
import { withDarkMode, bgColors, darkModeBgColors } from '@/lib/colors'
<div className={withDarkMode(bgColors.primary, darkModeBgColors.primary)}>

// Option 3: Direct class strings (for simple cases)
<div className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
```

### Gray scale inversion rules

```
Backgrounds:  white <-> gray-950,  gray-50 <-> gray-900,  gray-100 <-> gray-800,  gray-200 <-> gray-700
Text:         gray-900 <-> gray-100,  gray-700 <-> gray-300,  gray-600 <-> gray-400,  gray-500 stays the same
Borders:      gray-200 <-> gray-800,  gray-300 <-> gray-700,  gray-400 <-> gray-600
Status BGs:   -50 -> -950  (or gray-900 for pending)
Status text:  -700 -> -300
Color family borders: -200 -> -900
```

### Type exports

```typescript
export type StatusKey = keyof typeof statusColors
export type ButtonVariant = keyof typeof buttonVariants
export type MetricColor = keyof typeof metricColors
export type DarkModeColorKey = keyof typeof darkModeColors
```

---

## 3. Component Patterns

### Standard pattern

Every component follows this consistent set of mappings:

| Property | Light mode | Dark mode |
|----------|-----------|-----------|
| Background | `bg-white` | `dark:bg-gray-900` |
| Heading text | `text-gray-900` | `dark:text-gray-100` |
| Body text | `text-gray-700` | `dark:text-gray-300` |
| Muted text | `text-gray-500` | `dark:text-gray-400` |
| Borders | `border-gray-200` | `dark:border-gray-700` |
| Subtle borders | `border-gray-200` | `dark:border-gray-800` |
| Hover | `hover:bg-gray-50` | `dark:hover:bg-gray-800` |
| Strong hover | `hover:bg-gray-100` | `dark:hover:bg-gray-700` |
| Disabled BG | — | `dark:disabled:bg-gray-900` |

### Components updated with dark mode support

**Core UI components** (`src/components/`):

| Component | Key dark mode changes |
|-----------|----------------------|
| **Card** | `dark:bg-gray-900`, `dark:text-gray-100`, `dark:border-gray-700` |
| **Button** | secondary/danger use `dark:bg-gray-900`, hover uses `dark:hover:bg-gray-800` |
| **Input** | `dark:bg-gray-800`, `dark:text-gray-100`, `dark:disabled:bg-gray-900` |
| **Select** | Same pattern as Input |
| **MetricCard** | `dark:bg-gray-900`, status colors use -400 dark variants (green, red, amber) |
| **ThemeSelector** | Active: `dark:bg-gray-700`; inactive: `dark:bg-gray-900`, `dark:hover:bg-gray-800` |
| **Switch** | `dark:bg-gray-700` (both states), `dark:focus:ring-offset-gray-900` |
| **Tabs** | `dark:border-gray-800`, active: `dark:text-white`, inactive: `dark:text-gray-400` |
| **Pagination** | Container `dark:border-gray-800`, active page `dark:bg-gray-700` |

**Layout** (`src/components/Layout.tsx`):

- Converted from ternary theme checks (`theme === 'dark' ? '...' : '...'`) to Tailwind `dark:` classes.
- Main content: `bg-gray-50 dark:bg-gray-900`
- Sidebar: `bg-gray-900 dark:bg-gray-950`
- Active nav item: `dark:bg-gray-900 dark:border-gray-100`
- Inactive nav item: `dark:text-gray-200 dark:hover:bg-gray-900`
- Mobile menu button: `bg-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700`
- `useTheme()` hook was removed from the `NavItem` subcomponent (no longer needed).

---

## 4. Theme System

### Architecture

- **Context file**: `src/contexts/ThemeContext.tsx`
- **Selector component**: `src/components/ThemeSelector.tsx`

### ThemeContext (`ThemeProvider`)

Provides `theme`, `setTheme`, and `resolvedTheme` via React context.

- `theme`: the user's chosen preference (`'light'` | `'dark'` | `'system'`), persisted to `localStorage`.
- `resolvedTheme`: the effective theme after resolving `'system'` against `prefers-color-scheme`.
- `setTheme`: updates preference, persists it, and re-applies classes to the DOM.

#### System theme detection

On mount, `resolveTheme('system')` calls `window.matchMedia('(prefers-color-scheme: dark)')` to determine the initial effective theme. A `MediaQueryList` listener (`addEventListener('change', ...)`) updates `resolvedTheme` immediately whenever the OS preference changes. Only the modern `addEventListener` API is used (no `addListener`/`removeListener` fallbacks).

#### Initial state

```typescript
const [theme, setThemeState] = useState<Theme>(() => getStorageTheme() ?? 'system')
```

This ensures the resolved theme is calculated correctly on first render, even when `localStorage` has no stored preference.

### ThemeSelector

Provides visual feedback for the current system resolution:

- When **system** mode is selected, a badge appears showing "D" (compact/sidebar) or "Dark" (horizontal/vertical) to indicate what the system preference currently resolves to.
- The badge updates immediately when the OS theme changes.

### Event listener flow

```
User selects 'system'
  → useEffect registers MediaQueryList listener for (prefers-color-scheme: dark)
    → OS theme changes
      → handleChange fires
        → resolvedTheme state updates
        → applyTheme() sets/removes 'dark' class on <html>
          → DOM updates, ThemeSelector re-renders with new badge
```

---

## 5. Quick Reference

### Most common class pairs

| Light mode class | Dark mode class | Usage |
|-----------------|----------------|-------|
| `bg-white` | `dark:bg-gray-950` | Main content background |
| `bg-gray-50` | `dark:bg-gray-900` | Cards, panels |
| `bg-gray-100` | `dark:bg-gray-800` | Nested sections |
| `text-gray-900` | `dark:text-gray-100` | Headings |
| `text-gray-700` | `dark:text-gray-300` | Body text |
| `text-gray-600` | `dark:text-gray-400` | Descriptions |
| `text-gray-500` | `dark:text-gray-500` | Muted (no change) |
| `border-gray-200` | `dark:border-gray-800` | Default borders |
| `border-gray-300` | `dark:border-gray-700` | Thick borders |
| `hover:bg-gray-50` | `dark:hover:bg-gray-800` | Subtle hover |
| `hover:bg-gray-100` | `dark:hover:bg-gray-700` | Strong hover |

### Status color rule of thumb

- Background: `bg-{color}-50` → `dark:bg-{color}-950` (or `dark:bg-gray-900` for pending)
- Text: `text-{color}-700` → `dark:text-{color}-300`
- Solid indicators (500-series): no dark variant needed

### Checklist for adding dark mode to a new component

- [ ] Backgrounds — add `dark:bg-gray-950/900/800` as appropriate
- [ ] Text — add `dark:text-gray-100/300/400` as appropriate
- [ ] Borders — add `dark:border-gray-800/700` as appropriate
- [ ] Hover states — add `dark:hover:bg-gray-800/700`
- [ ] Status badges — use `darkModeStatusColors` from `@/lib/colors`
- [ ] Buttons — use `darkModeButtonVariants` from `@/lib/colors`
- [ ] Disabled states — add `dark:disabled:bg-gray-900`
- [ ] Test in both light and dark mode

### Related source files

- `src/lib/colors.ts` — All color definitions and dark mode exports
- `src/contexts/ThemeContext.tsx` — Theme provider and system detection logic
- `src/components/ThemeSelector.tsx` — Theme picker UI with system-resolution badge
- `src/components/Layout.tsx` — Sidebar, nav items, and main content area
