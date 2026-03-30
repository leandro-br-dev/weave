/**
 * Centralized Color Configuration
 *
 * This file serves as the single source of truth for all UI colors in the dashboard.
 * All components should import color constants from this file rather than hardcoding
 * color values directly in className strings.
 *
 * **Why use this?**
 * - Ensures consistency across all components
 * - Makes color updates easier (change in one place)
 * - Provides type safety with TypeScript
 * - Documents semantic meaning of colors
 * - Enables automated consistency checking
 *
 * **Usage:**
 * ```tsx
 * import { statusColors, buttonVariants } from '@/lib/colors'
 *
 * <span className={`${statusColors.success.bg} ${statusColors.success.text}`}>
 *   Success!
 * </span>
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Complete color scheme for a status state
 */
export interface StatusColorScheme {
  /** Background color class */
  bg: string
  /** Text color class */
  text: string
  /** Accent/border color class */
  border: string
  /** Solid color for indicators (dots, icons) */
  solid: string
  /** Human-readable label */
  label: string
}

/**
 * Complete color scheme for a button variant
 */
export interface ButtonColorScheme {
  /** Background color class */
  bg: string
  /** Text color class */
  text: string
  /** Border color class */
  border: string
  /** Hover background color class */
  hoverBg: string
  /** Hover text color class */
  hoverText?: string
}

/**
 * Color scheme for neutral/structural elements
 */
export interface NeutralColorScheme {
  /** Primary background color */
  primary: string
  /** Secondary background color */
  secondary: string
  /** Tertiary background color */
  tertiary: string
  /** Dark/inverted background */
  inverted: string
}

/**
 * Interactive state colors
 */
export interface InteractiveStateColors {
  /** Focus ring color */
  focusRing: string
  /** Focus ring alternative - for varied hierarchy */
  focusRingAlt?: string
  /** Hover background for subtle interactions */
  hoverBg: string
  /** Disabled state overlay */
  disabled: string
}

// ============================================================================
// STATUS COLORS
// ============================================================================

/**
 * Status badge and indicator colors
 *
 * Used for: Status badges, status indicators, workflow states, plan statuses
 *
 * **Standardization Note:**
 * - Uses 50-shade backgrounds for subtle appearance
 * - Uses 700-shade text for readability (WCAG AA compliant)
 * - Uses 500-shade for solid indicators
 *
 * **Status Meanings:**
 * - `pending`: Not yet started (yellow/gray - still deciding)
 * - `running`: Currently executing (blue - active)
 * - `success`: Completed successfully (green - positive)
 * - `failed`: Completed with errors (red - negative)
 * - `timeout`: Took too long (amber - warning)
 * - `approved`: Explicitly approved (green - positive)
 * - `denied`: Explicitly denied (red - negative)
 */
export const statusColors: Record<string, StatusColorScheme> = {
  /** Waiting to start - uses yellow to indicate "not yet decided" */
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    solid: 'bg-yellow-500',
    label: 'Pending',
  },

  /** Currently executing - uses blue to indicate active state */
  running: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    solid: 'bg-blue-500',
    label: 'Running',
  },

  /** Completed successfully - uses green to indicate positive outcome */
  success: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    solid: 'bg-green-500',
    label: 'Success',
  },

  /** Completed with errors - uses red to indicate negative outcome */
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    solid: 'bg-red-500',
    label: 'Failed',
  },

  /** Exceeded time limit - uses amber to indicate warning */
  timeout: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    solid: 'bg-amber-500',
    label: 'Timeout',
  },

  /** Explicitly approved - shares colors with success */
  approved: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    solid: 'bg-green-500',
    label: 'Approved',
  },

  /** Explicitly denied - shares colors with failed */
  denied: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    solid: 'bg-red-500',
    label: 'Denied',
  },

  /** Fallback for unknown statuses - uses gray to indicate neutral */
  unknown: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
    solid: 'bg-gray-400',
    label: 'Unknown',
  },
} as const

// ============================================================================
// BUTTON COLORS
// ============================================================================

/**
 * Button variant color schemes
 *
 * Used for: Button component, action buttons, form submissions
 *
 * **Variant Meanings:**
 * - `primary`: Main action, draws attention (dark gray/black)
 * - `secondary`: Alternative action, less prominent (white with border)
 * - `danger`: Destructive action, requires caution (red accents)
 * - `ghost`: Minimal action, no background (transparent)
 */
export const buttonVariants: Record<string, ButtonColorScheme> = {
  /** Main call-to-action button - dark gray for strong visual weight */
  primary: {
    bg: 'bg-gray-900',
    text: 'text-white',
    border: 'border-transparent',
    hoverBg: 'hover:bg-gray-800',
  },

  /** Secondary action button - white with border for visual hierarchy */
  secondary: {
    bg: 'bg-white',
    text: 'text-gray-700',
    border: 'border-gray-300',
    hoverBg: 'hover:bg-gray-50',
  },

  /** Destructive action button - red accents to indicate danger */
  danger: {
    bg: 'bg-white',
    text: 'text-red-600',
    border: 'border-red-300',
    hoverBg: 'hover:bg-red-50',
  },

  /** Minimal action button - no background, subtle hover */
  ghost: {
    bg: 'bg-transparent',
    text: 'text-gray-500',
    border: 'border-transparent',
    hoverBg: 'hover:bg-gray-100',
    hoverText: 'hover:text-gray-700',
  },
} as const

// ============================================================================
// METRIC/STAT COLORS
// ============================================================================

/**
 * Metric card and statistic colors
 *
 * Used for: MetricCard component, dashboard statistics, KPIs
 *
 * **Color Meanings:**
 * - `default`: Neutral metric (no trend)
 * -green`: Positive trend/upward movement
 * - `red`: Negative trend/downward movement
 * - `amber`: Warning/caution
 */
export const metricColors: Record<string, { text: string }> = {
  /** Neutral metric - no special meaning */
  default: {
    text: 'text-gray-900',
  },

  /** Positive metric - indicates growth, improvement, or good performance */
  green: {
    text: 'text-green-600',
  },

  /** Negative metric - indicates decline, issues, or poor performance */
  red: {
    text: 'text-red-600',
  },

  /** Warning metric - indicates caution or needs attention */
  amber: {
    text: 'text-amber-600',
  },
} as const

// ============================================================================
// SEMANTIC STATE COLORS
// ============================================================================

/**
 * Error state colors
 *
 * Used for: Error messages, validation errors, failure states
 */
export const errorColors = {
  /** Error text - prominent and readable */
  text: 'text-red-600',
  /** Error text alternative - slightly darker */
  textAlt: 'text-red-700',
  /** Subtle error background */
  bg: 'bg-red-50',
  /** Error border */
  border: 'border-red-300',
  /** Error border - stronger version */
  borderStrong: 'border-red-500',
} as const

/**
 * Success state colors
 *
 * Used for: Success messages, completion states, confirmations
 */
export const successColors = {
  /** Success text - prominent and readable */
  text: 'text-green-600',
  /** Success text alternative - slightly darker */
  textAlt: 'text-green-700',
  /** Subtle success background */
  bg: 'bg-green-50',
  /** Success border */
  border: 'border-green-200',
} as const

/**
 * Warning state colors
 *
 * Used for: Warning messages, caution states, alerts
 *
 * **Note:** Uses amber instead of yellow for better accessibility
 */
export const warningColors = {
  /** Warning text - prominent and readable */
  text: 'text-amber-600',
  /** Warning text alternative - slightly darker */
  textAlt: 'text-amber-700',
  /** Subtle warning background */
  bg: 'bg-amber-50',
  /** Warning border */
  border: 'border-amber-200',
} as const

/**
 * Info state colors
 *
 * Used for: Informational messages, tips, neutral notifications
 */
export const infoColors = {
  /** Info text - blue indicates information */
  text: 'text-blue-600',
  /** Info text alternative - slightly darker */
  textAlt: 'text-blue-700',
  /** Subtle info background */
  bg: 'bg-blue-50',
  /** Info border */
  border: 'border-blue-200',
} as const

// ============================================================================
// NEUTRAL/STRUCTURAL COLORS
// ============================================================================

/**
 * Background colors for structural elements
 *
 * Used for: Layout backgrounds, card backgrounds, section backgrounds
 */
export const bgColors: NeutralColorScheme = {
  /** Primary background - main content area */
  primary: 'bg-white',
  /** Secondary background - cards, panels */
  secondary: 'bg-gray-50',
  /** Tertiary background - nested sections, dividers */
  tertiary: 'bg-gray-100',
  /** Dark/inverted background - dark mode sections, code blocks */
  inverted: 'bg-gray-900',
} as const

/**
 * Text colors for content hierarchy
 *
 * Used for: Headings, body text, captions, labels
 */
export const textColors = {
  /** Primary text - headings, important content */
  primary: 'text-gray-900',
  /** Secondary text - body content, descriptions */
  secondary: 'text-gray-700',
  /** Tertiary text - supporting text, metadata */
  tertiary: 'text-gray-600',
  /** Muted text - captions, placeholders, disabled */
  muted: 'text-gray-500',
  /** Very muted text - timestamps, subtle labels */
  veryMuted: 'text-gray-400',
  /** Inverted text - on dark backgrounds */
  inverted: 'text-white',
} as const

/**
 * Border colors for structural elements
 *
 * Used for: Card borders, input borders, section dividers
 */
export const borderColors = {
  /** Default border - cards, inputs */
  default: 'border-gray-200',
  /** Thick border - emphasis borders */
  thick: 'border-gray-300',
  /** Subtle border - fine dividers */
  subtle: 'border-gray-100',
  /** Strong border - emphasis, sections */
  strong: 'border-gray-500',
  /** Transparent border - spacing, layout */
  transparent: 'border-transparent',
} as const

// ============================================================================
// INTERACTIVE STATE COLORS
// ============================================================================

/**
 * Interactive state colors
 *
 * Used for: Hover states, focus states, disabled states
 */
export const interactiveStates: InteractiveStateColors = {
  /** Focus ring color - keyboard navigation, focused inputs */
  focusRing: 'ring-indigo-500',
  /** Focus ring alternative - for varied hierarchy */
  focusRingAlt: 'ring-blue-500',
  /** Hover background - subtle interaction feedback */
  hoverBg: 'hover:bg-gray-50',
  /** Disabled state - reduced opacity */
  disabled: 'disabled:opacity-50',
} as const

// ============================================================================
// UTILITY COLOR PALETTES
// ============================================================================

/**
 * Complete color palette for reference
 *
 * These are organized by color family for easy reference when designing new components.
 * Try to use the semantic color groups above first, and only use these when needed.
 */
export const colorPalette = {
  /** Gray scale - neutral elements */
  gray: {
    50: 'bg-gray-50 text-gray-50',
    100: 'bg-gray-100 text-gray-100',
    200: 'bg-gray-200 text-gray-200',
    300: 'bg-gray-300 text-gray-300',
    400: 'bg-gray-400 text-gray-400',
    500: 'bg-gray-500 text-gray-500',
    600: 'bg-gray-600 text-gray-600',
    700: 'bg-gray-700 text-gray-700',
    800: 'bg-gray-800 text-gray-800',
    900: 'bg-gray-900 text-gray-900',
  },

  /** Blue scale - info, links, active states */
  blue: {
    50: 'bg-blue-50 text-blue-50',
    100: 'bg-blue-100 text-blue-100',
    200: 'bg-blue-200 text-blue-200',
    300: 'bg-blue-300 text-blue-300',
    400: 'bg-blue-400 text-blue-400',
    500: 'bg-blue-500 text-blue-500',
    600: 'bg-blue-600 text-blue-600',
    700: 'bg-blue-700 text-blue-700',
    800: 'bg-blue-800 text-blue-800',
  },

  /** Green scale - success, positive states */
  green: {
    50: 'bg-green-50 text-green-50',
    100: 'bg-green-100 text-green-100',
    200: 'bg-green-200 text-green-200',
    300: 'bg-green-300 text-green-300',
    400: 'bg-green-400 text-green-400',
    500: 'bg-green-500 text-green-500',
    600: 'bg-green-600 text-green-600',
    700: 'bg-green-700 text-green-700',
    800: 'bg-green-800 text-green-800',
  },

  /** Red scale - errors, negative states */
  red: {
    50: 'bg-red-50 text-red-50',
    100: 'bg-red-100 text-red-100',
    200: 'bg-red-200 text-red-200',
    300: 'bg-red-300 text-red-300',
    400: 'bg-red-400 text-red-400',
    500: 'bg-red-500 text-red-500',
    600: 'bg-red-600 text-red-600',
    700: 'bg-red-700 text-red-700',
    800: 'bg-red-800 text-red-800',
  },

  /** Amber scale - warnings, cautions (preferred over yellow) */
  amber: {
    50: 'bg-amber-50 text-amber-50',
    100: 'bg-amber-100 text-amber-100',
    200: 'bg-amber-200 text-amber-200',
    300: 'bg-amber-300 text-amber-300',
    400: 'bg-amber-400 text-amber-400',
    500: 'bg-amber-500 text-amber-500',
    600: 'bg-amber-600 text-amber-600',
    700: 'bg-amber-700 text-amber-700',
    800: 'bg-amber-800 text-amber-800',
  },

  /** Yellow scale - alternative warnings (use amber when possible) */
  yellow: {
    50: 'bg-yellow-50 text-yellow-50',
    100: 'bg-yellow-100 text-yellow-100',
    200: 'bg-yellow-200 text-yellow-200',
    300: 'bg-yellow-300 text-yellow-300',
    400: 'bg-yellow-400 text-yellow-400',
    500: 'bg-yellow-500 text-yellow-500',
    600: 'bg-yellow-600 text-yellow-600',
    700: 'bg-yellow-700 text-yellow-700',
    800: 'bg-yellow-800 text-yellow-800',
  },
} as const

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Union type of all available status keys
 */
export type StatusKey = keyof typeof statusColors

/**
 * Union type of all available button variant keys
 */
export type ButtonVariant = keyof typeof buttonVariants

/**
 * Union type of all available metric color keys
 */
export type MetricColor = keyof typeof metricColors

// ============================================================================
// DARK MODE COLORS
// ============================================================================

/**
 * Dark mode color scheme for status badges and indicators
 *
 * **Design Principles:**
 * - Uses darker gray backgrounds (950-900-800) to create depth
 * - Uses lighter, muted text colors for proper contrast against dark backgrounds
 * - Maintains the same solid colors for indicators (no change needed)
 * - Avoids white backgrounds entirely
 *
 * **Contrast Strategy:**
 * - Backgrounds: gray-950 (darkest) → gray-900 → gray-800 (lightest)
 * - Text: gray-100 (brightest) → gray-200 → gray-300 → gray-400 (dimmest)
 * - Borders: gray-800 → gray-700 → gray-600
 */
export const darkModeStatusColors: Record<string, StatusColorScheme> = {
  /** Waiting to start - dark yellow/gray theme */
  pending: {
    bg: 'dark:bg-gray-900',
    text: 'dark:text-yellow-300',
    border: 'dark:border-yellow-900/50',
    solid: 'bg-yellow-500',
    label: 'Pending',
  },

  /** Currently executing - dark blue theme */
  running: {
    bg: 'dark:bg-blue-950',
    text: 'dark:text-blue-300',
    border: 'dark:border-blue-900',
    solid: 'bg-blue-500',
    label: 'Running',
  },

  /** Completed successfully - dark green theme */
  success: {
    bg: 'dark:bg-green-950',
    text: 'dark:text-green-300',
    border: 'dark:border-green-900',
    solid: 'bg-green-500',
    label: 'Success',
  },

  /** Completed with errors - dark red theme */
  failed: {
    bg: 'dark:bg-red-950',
    text: 'dark:text-red-300',
    border: 'dark:border-red-900',
    solid: 'bg-red-500',
    label: 'Failed',
  },

  /** Exceeded time limit - dark amber theme */
  timeout: {
    bg: 'dark:bg-amber-950',
    text: 'dark:text-amber-300',
    border: 'dark:border-amber-900',
    solid: 'bg-amber-500',
    label: 'Timeout',
  },

  /** Explicitly approved - dark green theme (same as success) */
  approved: {
    bg: 'dark:bg-green-950',
    text: 'dark:text-green-300',
    border: 'dark:border-green-900',
    solid: 'bg-green-500',
    label: 'Approved',
  },

  /** Explicitly denied - dark red theme (same as failed) */
  denied: {
    bg: 'dark:bg-red-950',
    text: 'dark:text-red-300',
    border: 'dark:border-red-900',
    solid: 'bg-red-500',
    label: 'Denied',
  },

  /** Fallback for unknown statuses - dark gray theme */
  unknown: {
    bg: 'dark:bg-gray-800',
    text: 'dark:text-gray-300',
    border: 'dark:border-gray-700',
    solid: 'bg-gray-500',
    label: 'Unknown',
  },
} as const

/**
 * Dark mode button variant color schemes
 *
 * **Design Principles:**
 * - Primary buttons use white background (inverted from light mode)
 * - Secondary buttons use gray-800 with subtle borders
 * - Ghost buttons use transparent with light text
 * - Hover states provide clear feedback with darker backgrounds
 */
export const darkModeButtonVariants: Record<string, ButtonColorScheme> = {
  /** Main call-to-action - white background with dark text (inverted) */
  primary: {
    bg: 'dark:bg-white',
    text: 'dark:text-gray-900',
    border: 'dark:border-transparent',
    hoverBg: 'dark:hover:bg-gray-100',
  },

  /** Secondary action - gray-800 background with light text */
  secondary: {
    bg: 'dark:bg-gray-800',
    text: 'dark:text-gray-200',
    border: 'dark:border-gray-700',
    hoverBg: 'dark:hover:bg-gray-700',
  },

  /** Destructive action - dark red theme */
  danger: {
    bg: 'dark:bg-gray-800',
    text: 'dark:text-red-400',
    border: 'dark:border-red-900',
    hoverBg: 'dark:hover:bg-red-950',
  },

  /** Minimal action - transparent with light gray text */
  ghost: {
    bg: 'dark:bg-transparent',
    text: 'dark:text-gray-400',
    border: 'dark:border-transparent',
    hoverBg: 'dark:hover:bg-gray-800',
    hoverText: 'dark:hover:text-gray-200',
  },
} as const

/**
 * Dark mode metric and statistic colors
 *
 * **Design Principles:**
 * - Uses gray-100/200/300 for proper contrast against dark backgrounds
 * - Maintains the same color families (green/red/amber) but with lighter shades
 * - Default metric uses gray-100 for maximum readability
 */
export const darkModeMetricColors: Record<string, { text: string }> = {
  /** Neutral metric - bright gray for readability */
  default: {
    text: 'dark:text-gray-100',
  },

  /** Positive metric - lighter green for dark backgrounds */
  green: {
    text: 'dark:text-green-400',
  },

  /** Negative metric - lighter red for dark backgrounds */
  red: {
    text: 'dark:text-red-400',
  },

  /** Warning metric - lighter amber for dark backgrounds */
  amber: {
    text: 'dark:text-amber-400',
  },
} as const

/**
 * Dark mode error state colors
 *
 * Uses lighter red shades (300-400) for proper contrast against dark backgrounds
 */
export const darkModeErrorColors = {
  /** Error text - lighter shade for dark mode */
  text: 'dark:text-red-400',
  /** Error text alternative - slightly darker but still readable */
  textAlt: 'dark:text-red-300',
  /** Subtle error background - very dark red */
  bg: 'dark:bg-red-950',
  /** Error border - dark red */
  border: 'dark:border-red-900',
  /** Error border - stronger version */
  borderStrong: 'dark:border-red-700',
} as const

/**
 * Dark mode success state colors
 *
 * Uses lighter green shades (300-400) for proper contrast against dark backgrounds
 */
export const darkModeSuccessColors = {
  /** Success text - lighter shade for dark mode */
  text: 'dark:text-green-400',
  /** Success text alternative - slightly lighter */
  textAlt: 'dark:text-green-300',
  /** Subtle success background - very dark green */
  bg: 'dark:bg-green-950',
  /** Success border - dark green */
  border: 'dark:border-green-900',
} as const

/**
 * Dark mode warning state colors
 *
 * Uses lighter amber shades (300-400) for proper contrast against dark backgrounds
 */
export const darkModeWarningColors = {
  /** Warning text - lighter shade for dark mode */
  text: 'dark:text-amber-400',
  /** Warning text alternative - slightly lighter */
  textAlt: 'dark:text-amber-300',
  /** Subtle warning background - very dark amber */
  bg: 'dark:bg-amber-950',
  /** Warning border - dark amber */
  border: 'dark:border-amber-900',
} as const

/**
 * Dark mode info state colors
 *
 * Uses lighter blue shades (300-400) for proper contrast against dark backgrounds
 */
export const darkModeInfoColors = {
  /** Info text - lighter shade for dark mode */
  text: 'dark:text-blue-400',
  /** Info text alternative - slightly lighter */
  textAlt: 'dark:text-blue-300',
  /** Subtle info background - very dark blue */
  bg: 'dark:bg-blue-950',
  /** Info border - dark blue */
  border: 'dark:border-blue-900',
} as const

/**
 * Dark mode background colors for structural elements
 *
 * **Hierarchy:**
 * - primary: Main content (gray-950 - almost black)
 * - secondary: Cards, panels (gray-900)
 * - tertiary: Nested sections (gray-800)
 * - inverted: Light sections in dark mode (gray-700)
 */
export const darkModeBgColors: NeutralColorScheme = {
  /** Primary background - main content area (darkest) */
  primary: 'dark:bg-gray-950',
  /** Secondary background - cards, panels */
  secondary: 'dark:bg-gray-900',
  /** Tertiary background - nested sections, dividers */
  tertiary: 'dark:bg-gray-800',
  /** Inverted background - light sections in dark mode */
  inverted: 'dark:bg-gray-700',
} as const

/**
 * Dark mode text colors for content hierarchy
 *
 * **Hierarchy:**
 * - Uses gray-100 through gray-400 for proper contrast
 * - Avoids gray-500+ as it becomes hard to read on dark backgrounds
 * - Inverted text uses dark gray for light elements
 */
export const darkModeTextColors = {
  /** Primary text - headings (brightest) */
  primary: 'dark:text-gray-100',
  /** Secondary text - body content */
  secondary: 'dark:text-gray-300',
  /** Tertiary text - supporting text */
  tertiary: 'dark:text-gray-400',
  /** Muted text - captions, placeholders */
  muted: 'dark:text-gray-500',
  /** Very muted text - timestamps, subtle labels */
  veryMuted: 'dark:text-gray-600',
  /** Inverted text - on light backgrounds in dark mode */
  inverted: 'dark:text-gray-900',
} as const

/**
 * Dark mode border colors for structural elements
 *
 * Uses gray-800 through gray-600 for visible but not harsh borders on dark backgrounds
 */
export const darkModeBorderColors = {
  /** Default border - cards, inputs */
  default: 'dark:border-gray-800',
  /** Thick border - emphasis borders */
  thick: 'dark:border-gray-700',
  /** Subtle border - fine dividers */
  subtle: 'dark:border-gray-800/50',
  /** Strong border - emphasis, sections */
  strong: 'dark:border-gray-600',
  /** Transparent border - spacing, layout */
  transparent: 'dark:border-transparent',
} as const

/**
 * Dark mode interactive state colors
 *
 * **Key Changes:**
 * - Hover backgrounds use darker shades (gray-800/900)
 * - Focus rings maintain the same colors (they work in both modes)
 * - Disabled state uses opacity-50 instead of opacity-40 for better visibility
 */
export const darkModeInteractiveStates: InteractiveStateColors = {
  /** Focus ring color - same as light mode */
  focusRing: 'ring-indigo-500',
  /** Focus ring alternative - same as light mode */
  focusRingAlt: 'ring-blue-500',
  /** Hover background - darker than light mode */
  hoverBg: 'dark:hover:bg-gray-800',
  /** Disabled state - slightly higher opacity for visibility */
  disabled: 'dark:disabled:opacity-50',
} as const

/**
 * Complete dark mode color scheme export
 *
 * This export provides all dark mode color variants in a single object
 * for easy importing and consistent theming.
 *
 * **Usage:**
 * ```tsx
 * import { darkModeColors } from '@/lib/colors'
 *
 * <div className={`${darkModeColors.bg.primary} ${darkModeColors.text.primary}`}>
 *   Dark mode content
 * </div>
 * ```
 *
 * **Or use with Tailwind's dark modifier:**
 * ```tsx
 * import { bgColors, darkModeBgColors } from '@/lib/colors'
 *
 * <div className={`${bgColors.primary} ${darkModeBgColors.primary}`}>
 *   Content that works in both light and dark mode
 * </div>
 * ```
 */
export const darkModeColors = {
  /** Status colors - badges, indicators */
  status: darkModeStatusColors,

  /** Button variants - primary, secondary, danger, ghost */
  buttons: darkModeButtonVariants,

  /** Metric colors - statistics, KPIs */
  metrics: darkModeMetricColors,

  /** Error state colors */
  error: darkModeErrorColors,

  /** Success state colors */
  success: darkModeSuccessColors,

  /** Warning state colors */
  warning: darkModeWarningColors,

  /** Info state colors */
  info: darkModeInfoColors,

  /** Background colors - structural hierarchy */
  bg: darkModeBgColors,

  /** Text colors - content hierarchy */
  text: darkModeTextColors,

  /** Border colors - structural elements */
  border: darkModeBorderColors,

  /** Interactive states - hover, focus, disabled */
  interactive: darkModeInteractiveStates,
} as const

/**
 * Helper function to combine light and dark mode classes
 *
 * This function makes it easy to apply both light and dark mode variants
 * without manually concatenating class strings.
 *
 * **Usage:**
 * ```tsx
 * import { withDarkMode } from '@/lib/colors'
 *
 * <div className={withDarkMode('bg-white', 'dark:bg-gray-900')}>
 *   Content
 * </div>
 *
 * // Or with colors from the config:
 * <div className={withDarkMode(bgColors.primary, darkModeBgColors.primary)}>
 *   Content
 * </div>
 * ```
 */
export function withDarkMode(lightClass: string, darkClass: string): string {
  return `${lightClass} ${darkClass}`
}

/**
 * Type for dark mode color scheme keys
 */
export type DarkModeColorKey = keyof typeof darkModeColors
