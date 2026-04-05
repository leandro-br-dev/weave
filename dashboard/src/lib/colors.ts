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

/**
 * Accent/brand color scheme for primary brand identity (orange)
 */
export interface AccentColorScheme {
  /** Primary accent background */
  bg: string
  /** Primary accent text */
  text: string
  /** Primary accent border */
  border: string
  /** Solid accent for indicators, dots, icons */
  solid: string
  /** Subtle accent background (lighter tint) */
  bgSubtle: string
  /** Accent text on dark backgrounds */
  textOnDark: string
  /** Accent border on dark backgrounds */
  borderOnDark: string
  /** Hover state for accent backgrounds */
  hoverBg: string
  /** Focus ring using accent color */
  focusRing: string
  /** Gradient start color */
  gradientFrom: string
  /** Gradient end color */
  gradientTo: string
}

/**
 * Color scheme for sidebar navigation panel
 */
export interface SidebarColorScheme {
  /** Sidebar background */
  bg: string
  /** Sidebar text color */
  text: string
  /** Active navigation item styles */
  activeItem: string
  /** Hover state for navigation items */
  hoverItem: string
  /** Divider line between sections */
  divider: string
}

/**
 * Color scheme for navigation rail (narrow w-16 vertical bar on desktop)
 */
export interface RailColorScheme {
  /** Rail background */
  bg: string
  /** Rail text color */
  text: string
  /** Active navigation item styles */
  activeItem: string
  /** Hover state for navigation items */
  hoverItem: string
  /** Divider line between sections */
  divider: string
  /** Tooltip background (shown to the right of icons) */
  tooltipBg: string
  /** Tooltip text color */
  tooltipText: string
}

/**
 * Color scheme for modal dialogs and overlays
 */
export interface ModalColorScheme {
  /** Overlay/backdrop behind the modal */
  overlay: string
  /** Modal panel background */
  panel: string
  /** Modal border */
  border: string
  /** Modal header text */
  header: string
}

/**
 * Color scheme for data tables
 */
export interface TableColorScheme {
  /** Table header background */
  headerBg: string
  /** Table header text */
  headerText: string
  /** Table row background */
  rowBg: string
  /** Alternating row background */
  rowAltBg: string
  /** Row hover state */
  rowHover: string
  /** Table border */
  border: string
}

/**
 * Color scheme for kanban board columns and cards
 */
export interface KanbanColorScheme {
  /** Kanban column background */
  columnBg: string
  /** Kanban card background */
  cardBg: string
  /** Kanban card border */
  cardBorder: string
  /** Kanban column header text */
  columnHeader: string
}

/**
 * Color scheme for chat message bubbles
 */
export interface ChatColorScheme {
  /** Own message bubble styles */
  ownBubble: string
  /** Other user message bubble styles */
  otherBubble: string
  /** Chat input background */
  inputBg: string
  /** Chat input border */
  inputBorder: string
}

/**
 * Color scheme for dropdown menus
 */
export interface DropdownColorScheme {
  /** Dropdown background */
  bg: string
  /** Dropdown border */
  border: string
  /** Dropdown item hover state */
  itemHover: string
  /** Dropdown item text */
  itemText: string
  /** Dropdown item checked/selected state (background + text) */
  itemChecked: string
  /** Dropdown divider */
  divider: string
}

/**
 * Color scheme for code blocks
 */
export interface CodeBlockColorScheme {
  /** Code block background */
  bg: string
  /** Code block text */
  text: string
}

// ============================================================================
// ACCENT / PRIMARY BRAND COLORS (ORANGE)
// ============================================================================

/**
 * Primary brand accent colors — orange theme
 *
 * Used for: Primary CTAs, focus rings, active states, brand highlights,
 * the Quick Action button, selected states, and any element that needs
 * to draw attention as a primary interactive element.
 *
 * **Color Family:** Amber-500 → Orange-500 → Orange-600
 * Matches the existing logo gradient (#f59e0b → #ea580c).
 *
 * **Design Principle:** Orange is reserved for interactive/active elements only.
 * It should NOT be used for decorative purposes or informational content.
 */
export const accentColors: AccentColorScheme = {
  /** Primary accent background — orange-600 for strong visual weight */
  bg: 'bg-orange-600',
  /** Primary accent text — for links or inline orange text */
  text: 'text-orange-600',
  /** Primary accent border */
  border: 'border-orange-500',
  /** Solid accent for dots, icons, small indicators */
  solid: 'bg-orange-500',
  /** Subtle accent background — orange-50 for selected/hover states */
  bgSubtle: 'bg-orange-50',
  /** Accent text intended for dark backgrounds (lighter shade) */
  textOnDark: 'text-orange-400',
  /** Accent border on dark backgrounds */
  borderOnDark: 'border-orange-500',
  /** Hover state for accent backgrounds */
  hoverBg: 'hover:bg-orange-700',
  /** Focus ring using accent orange */
  focusRing: 'ring-orange-500',
  /** Gradient start — matches logo amber gradient start */
  gradientFrom: 'from-amber-500',
  /** Gradient end — matches logo orange gradient end */
  gradientTo: 'to-orange-600',
} as const

/**
 * Complete color palette for reference
 *
 * These are organized by color family for easy reference when designing new components.
 * Try to use the semantic color groups above first, and only use these when needed.
 */
export const orangePalette = {
  /** Orange scale — primary brand color family */
  50: 'bg-orange-50',
  100: 'bg-orange-100',
  200: 'bg-orange-200',
  300: 'bg-orange-300',
  400: 'bg-orange-400',
  500: 'bg-orange-500',
  600: 'bg-orange-600',
  700: 'bg-orange-700',
  800: 'bg-orange-800',
  900: 'bg-orange-900',
  950: 'bg-orange-950',
} as const

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
  /** Main call-to-action button - orange brand color for strong visual identity */
  primary: {
    bg: 'bg-orange-600',
    text: 'text-white',
    border: 'border-transparent',
    hoverBg: 'hover:bg-orange-700',
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
 *
 * **Light Mode Hierarchy:**
 * - primary: Main content area (gray-50 - off-white)
 * - secondary: Cards, panels (white - pure white)
 * - tertiary: Nested sections, code blocks (gray-100 - subtle gray)
 * - inverted: Dark sections (gray-900 - near black)
 */
export const bgColors: NeutralColorScheme = {
  /** Primary background - main content area (off-white) */
  primary: 'bg-gray-50',
  /** Secondary background - cards, panels (pure white, elevated) */
  secondary: 'bg-white',
  /** Tertiary background - nested sections, code blocks */
  tertiary: 'bg-gray-100',
  /** Dark/inverted background - dark mode sections, code blocks */
  inverted: 'bg-gray-900',
} as const

/**
 * Text colors for content hierarchy
 *
 * Used for: Headings, body text, captions, labels
 *
 * **Light Mode Hierarchy:**
 * - primary: gray-900 (near-black, headings)
 * - secondary: gray-600 (body content, softer than before)
 * - tertiary: gray-500 (supporting text)
 * - muted: gray-400 (captions, placeholders)
 * - veryMuted: gray-400 (timestamps, subtle labels)
 */
export const textColors = {
  /** Primary text - headings, important content */
  primary: 'text-gray-900',
  /** Secondary text - body content, descriptions */
  secondary: 'text-gray-600',
  /** Tertiary text - supporting text, metadata */
  tertiary: 'text-gray-500',
  /** Muted text - captions, placeholders, disabled */
  muted: 'text-gray-400',
  /** Very muted text - timestamps, subtle labels */
  veryMuted: 'text-gray-400',
  /** Inverted text - on dark backgrounds */
  inverted: 'text-white',
} as const

/**
 * Border colors for structural elements
 *
 * Used for: Card borders, input borders, section dividers
 *
 * **Design Principle:** Keep borders subtle to avoid visual noise.
 * Use gray-200 as default (light) and gray-800 as default (dark).
 */
export const borderColors = {
  /** Default border - cards, inputs (subtle) */
  default: 'border-gray-200',
  /** Thick border - emphasis borders */
  thick: 'border-gray-300',
  /** Subtle border - fine dividers */
  subtle: 'border-gray-100',
  /** Strong border - emphasis, sections */
  strong: 'border-gray-400',
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
 *
 * **Design Principle:** All focus rings use orange brand accent for consistency.
 * Hover backgrounds should be subtle but noticeable.
 */
export const interactiveStates: InteractiveStateColors = {
  /** Focus ring color - orange brand accent for keyboard navigation, focused inputs */
  focusRing: 'ring-orange-500',
  /** Focus ring alternative - amber for varied hierarchy */
  focusRingAlt: 'ring-amber-400',
  /** Hover background - subtle interaction feedback */
  hoverBg: 'hover:bg-gray-100',
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
// SIDEBAR NAVIGATION COLORS
// ============================================================================

/**
 * Sidebar navigation panel colors
 *
 * Used for: Main navigation sidebar, slide-out panels, navigation menus
 *
 * **Design Principle:** Sidebar uses a dark background (gray-900) to create
 * visual separation from the main content area, even in light mode.
 * Active items are highlighted with orange brand accent border.
 */
export const sidebarColors: SidebarColorScheme = {
  /** Sidebar background - dark surface for visual separation */
  bg: 'bg-gray-900',
  /** Sidebar text - light gray for readability on dark bg */
  text: 'text-gray-300',
  /** Active navigation item - highlighted with orange border */
  activeItem: 'bg-gray-800 text-white border-orange-500',
  /** Hover state for navigation items */
  hoverItem: 'hover:bg-gray-800',
  /** Divider line between sidebar sections */
  divider: 'border-gray-800',
} as const

// ============================================================================
// NAVIGATION RAIL COLORS
// ============================================================================

/**
 * Navigation rail colors (light mode)
 *
 * Used for: Narrow w-16 vertical rail at the left edge on desktop.
 * Shares the same dark background as the sidebar for visual consistency.
 * Active items use a left border accent and subtle background highlight.
 * Tooltips appear to the right of icon-only items.
 */
export const railColors: RailColorScheme = {
  /** Rail background - same dark surface as sidebar */
  bg: 'bg-gray-900',
  /** Rail text - light gray for readability on dark bg */
  text: 'text-gray-300',
  /** Active item - left border accent with subtle background */
  activeItem: 'bg-gray-700 text-white border-l-2 border-orange-500',
  /** Hover state for navigation items */
  hoverItem: 'hover:bg-gray-800',
  /** Divider line between rail sections */
  divider: 'border-gray-800',
  /** Tooltip background - dark tooltip to the right of icons */
  tooltipBg: 'bg-gray-900',
  /** Tooltip text color - high contrast white */
  tooltipText: 'text-white',
} as const

// ============================================================================
// MODAL DIALOG COLORS
// ============================================================================

/**
 * Modal dialog and overlay colors
 *
 * Used for: Confirmation dialogs, form modals, overlay panels
 *
 * **Design Principle:** Modals use a semi-transparent black overlay to
 * dim the background, with a clean white panel for the modal content.
 */
export const modalColors: ModalColorScheme = {
  /** Overlay backdrop behind the modal */
  overlay: 'bg-black/50',
  /** Modal panel background - clean white */
  panel: 'bg-white',
  /** Modal border - subtle gray */
  border: 'border-gray-200',
  /** Modal header text - high contrast */
  header: 'text-gray-900',
} as const

// ============================================================================
// DATA TABLE COLORS
// ============================================================================

/**
 * Data table colors
 *
 * Used for: Data tables, list views, spreadsheet-like layouts
 *
 * **Design Principle:** Tables use subtle gray-50 for alternating rows
 * and headers, with clear borders for readability.
 */
export const tableColors: TableColorScheme = {
  /** Table header background - subtle gray */
  headerBg: 'bg-gray-50',
  /** Table header text - muted for hierarchy */
  headerText: 'text-gray-600',
  /** Table row background - white for contrast with page */
  rowBg: 'bg-white',
  /** Alternating row background - subtle differentiation */
  rowAltBg: 'bg-gray-50',
  /** Row hover state - subtle highlight */
  rowHover: 'hover:bg-gray-50',
  /** Table border - subtle gray */
  border: 'border-gray-200',
} as const

// ============================================================================
// KANBAN BOARD COLORS
// ============================================================================

/**
 * Kanban board column and card colors
 *
 * Used for: Kanban boards, task boards, column-based layouts
 *
 * **Design Principle:** Columns use gray-100 background to visually group
 * cards, while cards themselves are white with subtle borders.
 */
export const kanbanColors: KanbanColorScheme = {
  /** Kanban column background - light gray to group cards */
  columnBg: 'bg-gray-100',
  /** Kanban card background - white for elevation */
  cardBg: 'bg-white',
  /** Kanban card border - subtle gray */
  cardBorder: 'border-gray-200',
  /** Kanban column header text - medium weight */
  columnHeader: 'text-gray-700',
} as const

// ============================================================================
// CHAT MESSAGE COLORS
// ============================================================================

/**
 * Chat message bubble colors
 *
 * Used for: Chat interfaces, messaging components, comment threads
 *
 * **Design Principle:** Own messages use orange-600 for brand identity,
 * while other messages use a neutral gray. Input area uses white background.
 */
export const chatColors: ChatColorScheme = {
  /** Own message bubble - orange brand color for sender identity */
  ownBubble: 'bg-orange-600 text-white',
  /** Other user message bubble - neutral gray */
  otherBubble: 'bg-gray-100 text-gray-900',
  /** Chat input background - white */
  inputBg: 'bg-white',
  /** Chat input border - subtle gray */
  inputBorder: 'border-gray-200',
} as const

// ============================================================================
// DROPDOWN MENU COLORS
// ============================================================================

/**
 * Dropdown menu colors
 *
 * Used for: Dropdown menus, context menus, select menus, popover lists
 *
 * **Design Principle:** Dropdowns use white background with subtle borders.
 * Hover states use gray-100 for clear item selection feedback.
 */
export const dropdownColors: DropdownColorScheme = {
  /** Dropdown background - white */
  bg: 'bg-white',
  /** Dropdown border - subtle gray */
  border: 'border-gray-200',
  /** Dropdown item hover state - subtle highlight */
  itemHover: 'hover:bg-gray-100',
  /** Dropdown item text - medium weight gray */
  itemText: 'text-gray-700',
  /** Dropdown item checked/selected - subtle orange accent background with readable text */
  itemChecked: 'data-[state=checked]:bg-orange-50 data-[state=checked]:text-orange-700',
  /** Dropdown divider between sections */
  divider: 'border-gray-100',
} as const

// ============================================================================
// CODE BLOCK COLORS
// ============================================================================

/**
 * Code block colors
 *
 * Used for: Code snippets, code editors, terminal output, preformatted text
 *
 * **Design Principle:** Code blocks use a dark background (gray-900) to
 * visually distinguish code content from prose. Light text ensures readability.
 */
export const codeBlockColors: CodeBlockColorScheme = {
  /** Code block background - dark for visual distinction */
  bg: 'bg-gray-900',
  /** Code block text - light for readability on dark bg */
  text: 'text-gray-100',
} as const

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
 * - Primary buttons use orange-600 for strong brand identity
 * - Secondary buttons use gray-800 with subtle gray-700 borders
 * - Ghost buttons use transparent with light text
 * - Hover states provide clear feedback
 */
export const darkModeButtonVariants: Record<string, ButtonColorScheme> = {
  /** Main call-to-action - orange brand color maintains identity in dark mode */
  primary: {
    bg: 'dark:bg-orange-600',
    text: 'dark:text-white',
    border: 'dark:border-transparent',
    hoverBg: 'dark:hover:bg-orange-700',
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
 * **Hierarchy (deepest → lightest):**
 * - primary: Page background (gray-950 - near black)
 * - secondary: Cards, panels (gray-900 - elevated surface)
 * - tertiary: Nested sections, code blocks (gray-800)
 * - inverted: Light/accent sections in dark mode (gray-800/700)
 *
 * **Key Change:** page bg is gray-950, cards are gray-900 → clear separation
 */
export const darkModeBgColors: NeutralColorScheme = {
  /** Primary background - main content area (near black) */
  primary: 'dark:bg-gray-950',
  /** Secondary background - cards, panels (elevated) */
  secondary: 'dark:bg-gray-900',
  /** Tertiary background - nested sections, code blocks */
  tertiary: 'dark:bg-gray-800',
  /** Inverted background - light sections in dark mode */
  inverted: 'dark:bg-gray-800',
} as const

/**
 * Dark mode text colors for content hierarchy
 *
 * **Hierarchy:**
 * - Uses gray-100 through gray-400 for proper contrast
 * - Avoids pure `white` in favor of gray-100 (softer, less harsh)
 * - Inverted text uses dark gray for light elements
 *
 * **Key Change:** primary is gray-100 (soft white) instead of white
 */
export const darkModeTextColors = {
  /** Primary text - headings (soft white) */
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
 * **Design Principle:** Borders should be very subtle in dark mode.
 * Use gray-800 for default (blends with dark backgrounds) and
 * gray-700 only for emphasis.
 */
export const darkModeBorderColors = {
  /** Default border - cards, inputs (subtle) */
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
 * - Focus rings use orange brand accent for consistency
 * - Disabled state uses opacity-50 for better visibility
 */
export const darkModeInteractiveStates: InteractiveStateColors = {
  /** Focus ring color - orange brand accent works in both modes */
  focusRing: 'ring-orange-500',
  /** Focus ring alternative - amber for varied hierarchy */
  focusRingAlt: 'ring-amber-400',
  /** Hover background - subtle elevation in dark mode */
  hoverBg: 'dark:hover:bg-gray-800',
  /** Disabled state - slightly higher opacity for visibility */
  disabled: 'dark:disabled:opacity-50',
} as const

// ============================================================================
// DARK MODE ACCENT / BRAND COLORS (ORANGE)
// ============================================================================

/**
 * Dark mode primary brand accent colors — orange theme
 *
 * Uses orange-600 for backgrounds (strong brand presence) and orange-500
 * for text/borders (good contrast on dark backgrounds).
 * Maintains brand identity while ensuring readability.
 */
export const darkModeAccentColors: AccentColorScheme = {
  /** Primary accent background — orange-600 for strong brand presence */
  bg: 'dark:bg-orange-600',
  /** Primary accent text — orange-500 for readability on dark backgrounds */
  text: 'dark:text-orange-500',
  /** Primary accent border */
  border: 'dark:border-orange-600',
  /** Solid accent for dots, icons, small indicators */
  solid: 'bg-orange-500',
  /** Subtle accent background — orange-950 for selected/hover states */
  bgSubtle: 'dark:bg-orange-950',
  /** Accent text intended for dark backgrounds */
  textOnDark: 'dark:text-orange-500',
  /** Accent border on dark backgrounds */
  borderOnDark: 'dark:border-orange-500',
  /** Hover state for accent backgrounds */
  hoverBg: 'dark:hover:bg-orange-700',
  /** Focus ring using accent orange */
  focusRing: 'ring-orange-500',
  /** Gradient start — slightly brighter for dark mode */
  gradientFrom: 'dark:from-amber-500',
  /** Gradient end — matches dark accent bg */
  gradientTo: 'dark:to-orange-600',
} as const

// ============================================================================
// DARK MODE SIDEBAR COLORS
// ============================================================================

/**
 * Dark mode sidebar navigation panel colors
 *
 * Uses gray-950 for the sidebar background to create deeper visual separation
 * in dark mode. Active items maintain the orange brand accent border.
 */
export const darkModeSidebarColors: SidebarColorScheme = {
  /** Sidebar background - near black for maximum contrast */
  bg: 'dark:bg-gray-950',
  /** Sidebar text - slightly dimmer gray */
  text: 'dark:text-gray-400',
  /** Active navigation item - highlighted with orange border */
  activeItem: 'dark:bg-gray-800 dark:text-white dark:border-orange-500',
  /** Hover state for navigation items */
  hoverItem: 'dark:hover:bg-gray-800',
  /** Divider line between sidebar sections */
  divider: 'dark:border-gray-800',
} as const

// ============================================================================
// DARK MODE NAVIGATION RAIL COLORS
// ============================================================================

/**
 * Dark mode navigation rail colors
 *
 * Uses gray-950 for the rail background to match the dark mode sidebar,
 * creating deeper visual separation. Active items maintain the orange
 * brand accent with a left border. Tooltips use the same dark surface.
 */
export const darkModeRailColors: RailColorScheme = {
  /** Rail background - near black to match dark mode sidebar */
  bg: 'dark:bg-gray-800',
  /** Rail text - slightly dimmer gray */
  text: 'dark:text-gray-400',
  /** Active item - left border accent with subtle background */
  activeItem: 'dark:bg-gray-700 dark:text-white dark:border-l-2 dark:border-orange-500',
  /** Hover state for navigation items */
  hoverItem: 'dark:hover:bg-gray-800',
  /** Divider line between rail sections */
  divider: 'dark:border-gray-800',
  /** Tooltip background - dark tooltip surface */
  tooltipBg: 'dark:bg-gray-900',
  /** Tooltip text color - high contrast white */
  tooltipText: 'dark:text-white',
} as const

// ============================================================================
// DARK MODE MODAL COLORS
// ============================================================================

/**
 * Dark mode modal dialog and overlay colors
 *
 * Uses a darker overlay (black/70) and gray-900 panel for dark mode.
 */
export const darkModeModalColors: ModalColorScheme = {
  /** Overlay backdrop - darker for better dimming in dark mode */
  overlay: 'dark:bg-black/70',
  /** Modal panel background - dark surface */
  panel: 'dark:bg-gray-900',
  /** Modal border - subtle dark border */
  border: 'dark:border-gray-800',
  /** Modal header text - bright for readability */
  header: 'dark:text-gray-100',
} as const

// ============================================================================
// DARK MODE TABLE COLORS
// ============================================================================

/**
 * Dark mode data table colors
 *
 * Uses gray-950 for rows, gray-900 for headers and alternating rows.
 * Borders use gray-800 for subtle separation.
 */
export const darkModeTableColors: TableColorScheme = {
  /** Table header background - dark elevated surface */
  headerBg: 'dark:bg-gray-900',
  /** Table header text - muted for hierarchy */
  headerText: 'dark:text-gray-400',
  /** Table row background - deepest surface */
  rowBg: 'dark:bg-gray-950',
  /** Alternating row background - slightly elevated */
  rowAltBg: 'dark:bg-gray-900',
  /** Row hover state - subtle elevation */
  rowHover: 'dark:hover:bg-gray-900',
  /** Table border - subtle dark border */
  border: 'dark:border-gray-800',
} as const

// ============================================================================
// DARK MODE KANBAN COLORS
// ============================================================================

/**
 * Dark mode kanban board column and card colors
 *
 * Uses gray-900 for columns and gray-800 for cards to create depth.
 */
export const darkModeKanbanColors: KanbanColorScheme = {
  /** Kanban column background - dark surface */
  columnBg: 'dark:bg-gray-900',
  /** Kanban card background - slightly elevated */
  cardBg: 'dark:bg-gray-800',
  /** Kanban card border - subtle dark border */
  cardBorder: 'dark:border-gray-700',
  /** Kanban column header text - light gray */
  columnHeader: 'dark:text-gray-300',
} as const

// ============================================================================
// DARK MODE CHAT COLORS
// ============================================================================

/**
 * Dark mode chat message bubble colors
 *
 * Own messages still use orange-600 for brand consistency.
 * Other messages and input use gray-800 for dark surfaces.
 */
export const darkModeChatColors: ChatColorScheme = {
  /** Own message bubble - orange brand color maintained */
  ownBubble: 'dark:bg-orange-600 dark:text-white',
  /** Other user message bubble - dark surface */
  otherBubble: 'dark:bg-gray-800 dark:text-gray-100',
  /** Chat input background - dark surface */
  inputBg: 'dark:bg-gray-800',
  /** Chat input border - subtle dark border */
  inputBorder: 'dark:border-gray-700',
} as const

// ============================================================================
// DARK MODE DROPDOWN COLORS
// ============================================================================

/**
 * Dark mode dropdown menu colors
 *
 * Uses gray-800 for background and gray-700 for hover states.
 */
export const darkModeDropdownColors: DropdownColorScheme = {
  /** Dropdown background - dark surface */
  bg: 'dark:bg-gray-800',
  /** Dropdown border - subtle dark border */
  border: 'dark:border-gray-700',
  /** Dropdown item hover state - slightly lighter */
  itemHover: 'dark:hover:bg-gray-700',
  /** Dropdown item text - light gray */
  itemText: 'dark:text-gray-200',
  /** Dropdown item checked/selected - subtle orange accent background with readable text */
  itemChecked: 'dark:data-[state=checked]:bg-orange-950 dark:data-[state=checked]:text-orange-300',
  /** Dropdown divider between sections */
  divider: 'dark:border-gray-700',
} as const

// ============================================================================
// DARK MODE CODE BLOCK COLORS
// ============================================================================

/**
 * Dark mode code block colors
 *
 * Uses gray-950 for an even darker background that differentiates
 * code blocks from other dark surfaces in dark mode.
 */
export const darkModeCodeBlockColors: CodeBlockColorScheme = {
  /** Code block background - near black for maximum contrast */
  bg: 'dark:bg-gray-950',
  /** Code block text - light for readability */
  text: 'dark:text-gray-100',
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

  /** Accent/brand colors - primary orange identity */
  accent: darkModeAccentColors,

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

  /** Sidebar navigation panel */
  sidebar: darkModeSidebarColors,

  /** Modal dialogs and overlays */
  modal: darkModeModalColors,

  /** Data tables */
  table: darkModeTableColors,

  /** Kanban board columns and cards */
  kanban: darkModeKanbanColors,

  /** Chat message bubbles */
  chat: darkModeChatColors,

  /** Dropdown menus */
  dropdown: darkModeDropdownColors,

  /** Code blocks */
  codeBlock: darkModeCodeBlockColors,
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
  // Add Tailwind's dark: variant prefix to each utility class in darkClass.
  // Skips classes that already start with "dark:" (e.g. from darkModeColors constants).
  // Handles compound variants like "hover:bg-gray-700" → "dark:hover:bg-gray-700",
  // responsive prefixes like "md:bg-gray-700" → "dark:md:bg-gray-700",
  // and combinations like "focus:ring-2" → "dark:focus:ring-2".
  const darkPrefixed = darkClass
    .split(/\s+/)
    .filter(Boolean)
    .map((cls) => cls.startsWith('dark:') ? cls : `dark:${cls}`)
    .join(' ')
  return `${lightClass} ${darkPrefixed}`
}

/**
 * Type for dark mode color scheme keys
 */
export type DarkModeColorKey = keyof typeof darkModeColors
