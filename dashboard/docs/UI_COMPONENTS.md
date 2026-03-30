# UI Components & Styling Guide

**Last Updated:** 2026-03-16
**Version:** 1.0.0

---

## Table of Contents

1. [Component Library](#component-library)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing & Layout](#spacing--layout)
5. [Component Patterns](#component-patterns)
6. [Accessibility](#accessibility)
7. [Responsive Design](#responsive-design)

---

## Component Library

### Core Components

The dashboard provides a comprehensive set of reusable components located in `src/components/`.

#### Button

A flexible button component with multiple variants.

**Props:**
- `variant`: `'primary' | 'secondary' | 'danger' | 'ghost'`
- `size`: `'sm' | 'md' | 'lg'`
- `disabled`: `boolean`
- `loading`: `boolean`
- `onClick`: `() => void`
- `children`: `ReactNode`

**Usage:**
```tsx
import { Button } from '@/components'

<Button variant="primary" onClick={handleClick}>
  Save Changes
</Button>

<Button variant="danger" disabled={isDeleting}>
  Delete
</Button>
```

**Variants:**
- **Primary**: Main call-to-action buttons (dark gray background)
- **Secondary**: Secondary actions (white background with border)
- **Danger**: Destructive actions (red accents)
- **Ghost**: Minimal actions (transparent with hover)

#### Input

Text input field with validation support.

**Props:**
- `label`: `string`
- `value`: `string`
- `onChange`: `(value: string) => void`
- `error`: `string`
- `placeholder`: `string`
- `disabled`: `boolean`
- `type`: `'text' | 'password' | 'email' | 'number'`

**Usage:**
```tsx
import { Input } from '@/components'

<Input
  label="Agent Name"
  value={name}
  onChange={setName}
  error={errors.name}
  placeholder="Enter agent name"
/>
```

#### Select

Dropdown select component using Radix UI.

**Props:**
- `label`: `string`
- `value`: `string`
- `onChange`: `(value: string) => void`
- `options`: `{ label: string; value: string }[]`
- `placeholder`: `string`
- `disabled`: `boolean`

**Usage:**
```tsx
import { Select } from '@/components'

<Select
  label="Status"
  value={status}
  onChange={setStatus}
  options={[
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' }
  ]}
/>
```

#### Switch

Toggle switch component for binary choices.

**Props:**
- `checked`: `boolean`
- `onCheckedChange`: `(checked: boolean) => void`
- `disabled`: `boolean`

**Usage:**
```tsx
import { Switch } from '@/components'

<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
  disabled={isLoading}
/>
```

#### StatusBadge

Badge component for displaying status information.

**Props:**
- `status`: `'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'approved' | 'denied' | 'unknown'`
- `size`: `'sm' | 'md' | 'lg'`
- `showLabel`: `boolean`

**Usage:**
```tsx
import { StatusBadge } from '@/components'

<StatusBadge status="running" />
<StatusBadge status="success" size="lg" />
```

#### MetricCard

Card component for displaying KPIs and metrics.

**Props:**
- `title`: `string`
- `value`: `string | number`
- `change`: `number`
- `unit`: `string`
- `color`: `'default' | 'green' | 'red' | 'amber'`

**Usage:**
```tsx
import { MetricCard } from '@/components'

<MetricCard
  title="Active Agents"
  value={42}
  change={12}
  unit="agents"
  color="green"
/>
```

#### Card

Container component for grouping content.

**Props:**
- `title`: `string`
- `actions`: `ReactNode`
- `children`: `ReactNode`
- `className`: `string`

**Usage:**
```tsx
import { Card } from '@/components'

<Card title="Agent Settings" actions={<Button>Save</Button>}>
  <p>Card content goes here</p>
</Card>
```

#### Pagination

Pagination component for lists.

**Props:**
- `page`: `number`
- `totalPages`: `number`
- `onPageChange`: `(page: number) => void`

**Usage:**
```tsx
import { Pagination } from '@/components'

<Pagination
  page={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
/>
```

#### Toast

Toast notification component.

**Usage:**
```tsx
import { toast } from '@/components/Toast'

// Success toast
toast.success('Agent created successfully')

// Error toast
toast.error('Failed to create agent')

// Info toast
toast.info('Processing your request')
```

#### ConfirmDialog

Modal dialog for confirming actions.

**Props:**
- `isOpen`: `boolean`
- `title`: `string`
- `message`: `string`
- `onConfirm`: `() => void`
- `onCancel`: `() => void`
- `confirmLabel`: `string`
- `cancelLabel`: `string`
- `variant`: `'danger' | 'default'`

**Usage:**
```tsx
import { ConfirmDialog } from '@/components'

<ConfirmDialog
  isOpen={showDeleteDialog}
  title="Delete Agent"
  message="Are you sure you want to delete this agent? This action cannot be undone."
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteDialog(false)}
  confirmLabel="Delete"
  variant="danger"
/>
```

#### EmptyState

Component for displaying empty states.

**Props:**
- `title`: `string`
- `description`: `string`
- `icon`: `ReactNode`
- `action`: `ReactNode`

**Usage:**
```tsx
import { EmptyState } from '@/components'

<EmptyState
  title="No agents found"
  description="Get started by creating your first agent"
  icon={<Bot className="h-12 w-12" />}
  action={<Button>Create Agent</Button>}
/>
```

#### PageHeader

Standard page header component.

**Props:**
- `title`: `string`
- `subtitle`: `string`
- `actions`: `ReactNode`
- `breadcrumbs`: `Breadcrumb[]`

**Usage:**
```tsx
import { PageHeader } from '@/components'

<PageHeader
  title="Agents"
  subtitle="Manage your AI agents"
  actions={<Button>Create Agent</Button>}
/>
```

#### Layout

Main application layout component.

**Features:**
- Responsive sidebar navigation
- Header with user menu
- Main content area
- Mobile menu toggle

---

## Color System

### Overview

The dashboard uses a centralized color configuration system to ensure consistency across all components. All colors are defined in `src/lib/colors.ts` and exported as typed constants.

**Key Benefits:**
- ✅ Single source of truth for all colors
- ✅ Type-safe color definitions
- ✅ 100% test coverage
- ✅ Consistent styling across components
- ✅ Easy to maintain and update

### Color Groups

The color system is organized into **12 semantic groups**:

#### 1. Status Colors (`statusColors`)

Used for status badges, workflow states, and agent states.

| Status | Background | Text | Border | Solid | Label |
|--------|------------|------|--------|-------|-------|
| `pending` | `bg-yellow-50` | `text-yellow-700` | `border-yellow-200` | `bg-yellow-500` | Pending |
| `running` | `bg-blue-50` | `text-blue-700` | `border-blue-200` | `bg-blue-500` | Running |
| `success` | `bg-green-50` | `text-green-700` | `border-green-200` | `bg-green-500` | Success |
| `failed` | `bg-red-50` | `text-red-700` | `border-red-200` | `bg-red-500` | Failed |
| `timeout` | `bg-amber-50` | `text-amber-700` | `border-amber-200` | `bg-amber-500` | Timeout |
| `approved` | `bg-green-50` | `text-green-700` | `border-green-200` | `bg-green-500` | Approved |
| `denied` | `bg-red-50` | `text-red-700` | `border-red-200` | `bg-red-500` | Denied |
| `unknown` | `bg-gray-100` | `text-gray-600` | `border-gray-200` | `bg-gray-400` | Unknown |

**Design Principles:**
- Uses 50-shade backgrounds for subtle appearance
- Uses 700-shade text for WCAG AA compliance
- Uses 500-shade for solid indicators
- Related statuses share color families (success/approved, failed/denied)

**Usage:**
```typescript
import { statusColors } from '@/lib/colors'

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || statusColors.unknown

  return (
    <span className={`${colors.bg} ${colors.text} ${colors.border} border`}>
      {colors.label}
    </span>
  )
}
```

#### 2. Button Variants (`buttonVariants`)

Used for button component and action buttons.

| Variant | Background | Text | Border | Hover |
|---------|------------|------|--------|-------|
| `primary` | `bg-gray-900` | `text-white` | `border-transparent` | `hover:bg-gray-800` |
| `secondary` | `bg-white` | `text-gray-700` | `border-gray-300` | `hover:bg-gray-50` |
| `danger` | `bg-white` | `text-red-600` | `border-red-300` | `hover:bg-red-50` |
| `ghost` | `bg-transparent` | `text-gray-500` | `border-transparent` | `hover:bg-gray-100` |

**Usage:**
```typescript
import { buttonVariants } from '@/lib/colors'

function MyButton({ variant = 'primary' }: Props) {
  const colors = buttonVariants[variant]

  return (
    <button className={`${colors.bg} ${colors.text} ${colors.border} border ${colors.hoverBg}`}>
      {children}
    </button>
  )
}
```

#### 3. Metric Colors (`metricColors`)

Used for MetricCard component and dashboard statistics.

| Metric | Text Color |
|--------|------------|
| `default` | `text-gray-900` |
| `green` | `text-green-600` |
| `red` | `text-red-600` |
| `amber` | `text-amber-600` |

**Usage:**
```typescript
import { metricColors } from '@/lib/colors'

function MetricCard({ color = 'default' }: Props) {
  const textColor = metricColors[color]

  return <span className={textColor}>{value}</span>
}
```

#### 4. Semantic State Colors

##### Error Colors (`errorColors`)
```typescript
{
  text: 'text-red-600',        // Prominent error text
  textAlt: 'text-red-700',     // Alternative error text
  bg: 'bg-red-50',             // Subtle error background
  border: 'border-red-300',    // Error border
  borderStrong: 'border-red-500' // Strong error border
}
```

##### Success Colors (`successColors`)
```typescript
{
  text: 'text-green-600',      // Prominent success text
  textAlt: 'text-green-700',   // Alternative success text
  bg: 'bg-green-50',           // Subtle success background
  border: 'border-green-200'   // Success border
}
```

##### Warning Colors (`warningColors`)
```typescript
{
  text: 'text-amber-600',      // Prominent warning text
  textAlt: 'text-amber-700',   // Alternative warning text
  bg: 'bg-amber-50',           // Subtle warning background
  border: 'border-amber-200'   // Warning border
}
```

##### Info Colors (`infoColors`)
```typescript
{
  text: 'text-blue-600',       // Prominent info text
  textAlt: 'text-blue-700',    // Alternative info text
  bg: 'bg-blue-50',            // Subtle info background
  border: 'border-blue-200'    // Info border
}
```

**Design Principles:**
- All semantic colors use 600-shade for primary text
- All semantic colors use 700-shade for alternative text
- All semantic colors use 50-shade for backgrounds
- Borders use 200 or 300 shades for appropriate emphasis

**Usage:**
```typescript
import { errorColors, successColors } from '@/lib/colors'

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className={`${errorColors.bg} ${errorColors.border} border p-4 rounded`}>
      <p className={errorColors.text}>{message}</p>
    </div>
  )
}
```

#### 5. Neutral/Structural Colors

##### Background Colors (`bgColors`)
```typescript
{
  primary: 'bg-white',      // Main content area
  secondary: 'bg-gray-50',  // Cards, panels
  tertiary: 'bg-gray-100',  // Nested sections, dividers
  inverted: 'bg-gray-900'   // Dark mode sections, code blocks
}
```

##### Text Colors (`textColors`)
```typescript
{
  primary: 'text-gray-900',    // Headings, important content
  secondary: 'text-gray-700',  // Body content, descriptions
  tertiary: 'text-gray-600',   // Supporting text, metadata
  muted: 'text-gray-500',      // Captions, placeholders
  veryMuted: 'text-gray-400',  // Timestamps, subtle labels
  inverted: 'text-white'       // On dark backgrounds
}
```

##### Border Colors (`borderColors`)
```typescript
{
  default: 'border-gray-200',    // Cards, inputs
  thick: 'border-gray-300',      // Emphasis borders
  subtle: 'border-gray-100',     // Fine dividers
  strong: 'border-gray-500',     // Strong emphasis
  transparent: 'border-transparent' // Spacing, layout
}
```

#### 6. Interactive States (`interactiveStates`)

```typescript
{
  focusRing: 'ring-indigo-500',      // Primary focus ring
  focusRingAlt: 'ring-blue-500',     // Alternative focus ring
  hoverBg: 'hover:bg-gray-50',       // Subtle hover background
  disabled: 'disabled:opacity-50'    // Disabled state
}
```

#### 7. Color Palette (`colorPalette`)

Complete shade reference for 6 color families:

- **Gray**: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900
- **Blue**: 50, 100, 200, 300, 400, 500, 600, 700, 800
- **Green**: 50, 100, 200, 300, 400, 500, 600, 700, 800
- **Red**: 50, 100, 200, 300, 400, 500, 600, 700, 800
- **Amber**: 50, 100, 200, 300, 400, 500, 600, 700, 800
- **Yellow**: 50, 100, 200, 300, 400, 500, 600, 700, 800

### Color Consistency Rules

The color system enforces **8 consistency rules**:

1. ✅ **Status colors** follow bg-50, text-700, border-200, solid-500 pattern
2. ✅ **Button variants** have all required states (bg, text, border, hover)
3. ✅ **Semantic colors** use consistent shades (text-600, bg-50)
4. ✅ **Related statuses** share color families (success/approved, failed/denied)
5. ✅ **No duplicate** color definitions across semantic meanings
6. ✅ **Color palette** has complete shade ranges
7. ✅ **Neutral colors** maintain hierarchical structure
8. ✅ **Interactive states** use proper pseudo-classes

### Developer Guidelines

#### ✅ DO:
- **Always** import color constants from `@/lib/colors`
- **Use** semantic color groups that match your use case
- **Check** existing color groups before adding new ones
- **Run tests** after modifying colors to ensure consistency
- **Document** new color constants with clear comments

#### ❌ DON'T:
- **Never** hardcode color values in components (e.g., `bg-red-500`)
- **Don't** use custom hex colors in CSS files
- **Avoid** creating duplicate color definitions
- **Don't** skip running tests when modifying colors
- **Don't** use colors that don't follow the established patterns

### When to Add New Colors

Add new colors to `colors.ts` when:

1. **New Semantic State**: A new UI state needs consistent coloring (e.g., `archived`, `draft`)
2. **New Component Type**: A new component category needs specific colors (e.g., `cardColors`)
3. **Missing Shade**: A specific shade isn't available in the palette

**Process:**
1. Add the color constant to the appropriate group
2. Add corresponding tests in `colors.test.ts`
3. Run tests to verify consistency
4. Update this documentation

### Running Color Tests

```bash
# Run all color tests
cd /root/projects/weave/dashboard
npm test -- colors.test.ts

# Run with coverage
npm test -- colors.test.ts --coverage

# Run in watch mode
npm test -- colors.test.ts --watch
```

**Test Results:**
- ✅ All Tests Passing: 22/22 (100%)
- ✅ Code Coverage: 100% (statements, branches, functions, lines)
- ✅ Execution Time: < 20ms

---

## Typography

### Font Families

The dashboard uses system fonts for optimal performance:

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
  sans-serif;
```

### Font Sizes

Tailwind's default scale is used:

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Captions, labels |
| `text-sm` | 14px | Secondary text, metadata |
| `text-base` | 16px | Body text, default |
| `text-lg` | 18px | Large body text |
| `text-xl` | 20px | Subheadings |
| `text-2xl` | 24px | Section headings |
| `text-3xl` | 30px | Page headings |
| `text-4xl` | 36px | Large headings |

### Font Weights

| Class | Weight | Usage |
|-------|--------|-------|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Emphasized text |
| `font-semibold` | 600 | Headings |
| `font-bold` | 700 | Strong emphasis |

### Text Utilities

- `truncate`: Truncate overflowing text with ellipsis
- `text-ellipsis`: Ellipsis for overflow
- `whitespace-nowrap`: Prevent text wrapping
- `break-words`: Break long words
- `line-clamp-{n}`: Limit to n lines

---

## Spacing & Layout

### Spacing Scale

Tailwind's default spacing scale is used:

| Class | Size | Usage |
|-------|------|-------|
| `p-0` | 0px | No padding |
| `p-1` | 4px | Tight spacing |
| `p-2` | 8px | Compact spacing |
| `p-3` | 12px | Default spacing |
| `p-4` | 16px | Comfortable spacing |
| `p-5` | 20px | Large spacing |
| `p-6` | 24px | Extra large spacing |
| `p-8` | 32px | Section spacing |

### Layout Utilities

#### Flexbox

```tsx
<div className="flex items-center justify-between gap-4">
  <div>Left content</div>
  <div>Right content</div>
</div>
```

**Common patterns:**
- `flex`: Display as flex container
- `items-center`: Vertically center items
- `items-start`: Align items to top
- `justify-between`: Space items apart
- `justify-center`: Center items horizontally
- `gap-4`: Add gap between items

#### Grid

```tsx
<div className="grid grid-cols-3 gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

**Common patterns:**
- `grid`: Display as grid container
- `grid-cols-{n}`: Number of columns
- `gap-4`: Gap between items
- `col-span-{n}`: Column span

#### Container

```tsx
<div className="container mx-auto px-4">
  Content
</div>
```

### Responsive Breakpoints

Tailwind's default breakpoints:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Small devices |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktops |
| `xl` | 1280px | Large desktops |
| `2xl` | 1536px | Extra large screens |

**Responsive utilities:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  Responsive grid
</div>
```

---

## Component Patterns

### Container Pattern

Wrap content in consistent container:

```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {children}
</div>
```

### Card Pattern

Standard card layout:

```tsx
<div className="bg-white border border-gray-200 rounded-lg p-6">
  <h3 className="text-lg font-semibold mb-4">{title}</h3>
  {children}
</div>
```

### Loading Pattern

Consistent loading states:

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
  </div>
) : (
  <Content />
)}
```

### Error Pattern

Consistent error display:

```tsx
{error && (
  <div className={`${errorColors.bg} ${errorColors.border} border p-4 rounded-lg`}>
    <p className={errorColors.text}>{error}</p>
  </div>
)}
```

### Empty State Pattern

Consistent empty states:

```tsx
{items.length === 0 && (
  <EmptyState
    title="No items found"
    description="Get started by creating your first item"
    icon={<Icon className="h-12 w-12" />}
  />
)}
```

---

## Accessibility

### ARIA Attributes

Components include proper ARIA attributes:

```tsx
<button
  aria-label="Close dialog"
  aria-pressed={pressed}
  aria-disabled={disabled}
>
  Close
</button>
```

### Keyboard Navigation

All interactive elements are keyboard accessible:

- Tab: Navigate between focusable elements
- Enter/Space: Activate buttons and links
- Escape: Close modals and dropdowns
- Arrow keys: Navigate lists and menus

### Focus Indicators

Visible focus rings for keyboard navigation:

```tsx
<button className="focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
  Focusable button
</button>
```

### Screen Reader Support

Semantic HTML and ARIA labels:

```tsx
<nav aria-label="Main navigation">
  <ul aria-label="Menu items">
    <li><a href="/agents" aria-current="page">Agents</a></li>
  </ul>
</nav>
```

### Color Contrast

All color combinations meet WCAG AA standards:
- Normal text: ≥ 4.5:1 contrast ratio
- Large text: ≥ 3:1 contrast ratio
- UI components: ≥ 3:1 contrast ratio

---

## Responsive Design

### Mobile-First Approach

Styles are written mobile-first, with responsive modifiers:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  Responsive grid
</div>
```

### Breakpoint Usage

**Mobile (default):**
- Single column layouts
- Stacked navigation
- Full-width inputs
- Touch-optimized spacing

**Tablet (md):**
- Two column layouts
- Horizontal navigation
- Balanced spacing

**Desktop (lg+):**
- Multi-column layouts
- Side-by-side panels
- Maximum width containers

### Touch Targets

All interactive elements meet minimum touch target size (44×44px):

```tsx
<button className="min-h-[44px] min-w-[44px]">
  Touch-friendly button
</button>
```

---

## Best Practices

### Component Design

1. **Keep components focused**: Single responsibility
2. **Use composition**: Build complex UIs from simple components
3. **Props down, events up**: Unidirectional data flow
4. **Type safety**: Use TypeScript for all props
5. **Documentation**: Add JSDoc for complex components

### Performance

1. **Memoization**: Use `React.memo` for expensive components
2. **Code splitting**: Lazy load routes and heavy components
3. **Image optimization**: Use appropriate image formats
4. **Bundle size**: Monitor and optimize dependencies

### Maintainability

1. **Consistent naming**: Follow naming conventions
2. **File organization**: Logical folder structure
3. **Code comments**: Document complex logic
4. **Testing**: Write tests for all components

---

**Last Updated:** 2026-03-16
**Maintained By:** Development Team
