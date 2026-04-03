import { Check } from 'lucide-react'
import { useId } from 'react'
import {
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  accentColors,
  withDarkMode,
} from '@/lib/colors'

// Export the color palette so it can be reused
// These are the Tailwind class combinations for visual display
export const DEFAULT_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-lime-100 text-lime-700 border-lime-200',
] as const

// Mapping of Tailwind class combinations to hex color values
// This is what gets stored in the database and passed to consumers
export const COLOR_HEX_MAP: Record<string, string> = {
  'bg-blue-100 text-blue-700 border-blue-200': '#3b82f6',
  'bg-green-100 text-green-700 border-green-200': '#22c55e',
  'bg-purple-100 text-purple-700 border-purple-200': '#a855f7',
  'bg-pink-100 text-pink-700 border-pink-200': '#ec4899',
  'bg-indigo-100 text-indigo-700 border-indigo-200': '#6366f1',
  'bg-teal-100 text-teal-700 border-teal-200': '#14b8a6',
  'bg-orange-100 text-orange-700 border-orange-200': '#f97316',
  'bg-red-100 text-red-700 border-red-200': '#ef4444',
  'bg-cyan-100 text-cyan-700 border-cyan-200': '#06b6d4',
  'bg-emerald-100 text-emerald-700 border-emerald-200': '#10b981',
  'bg-amber-100 text-amber-700 border-amber-200': '#f59e0b',
  'bg-lime-100 text-lime-700 border-lime-200': '#84cc16',
}

// Color names for better UX in dropdown
export const COLOR_NAMES: Record<string, string> = {
  '#3b82f6': 'Blue',
  '#22c55e': 'Green',
  '#a855f7': 'Purple',
  '#ec4899': 'Pink',
  '#6366f1': 'Indigo',
  '#14b8a6': 'Teal',
  '#f97316': 'Orange',
  '#ef4444': 'Red',
  '#06b6d4': 'Cyan',
  '#10b981': 'Emerald',
  '#f59e0b': 'Amber',
  '#84cc16': 'Lime',
}

interface ColorPickerProps {
  // Hex color value (e.g., '#3b82f6')
  value?: string
  // Callback receives hex color value
  onChange: (hexColor: string) => void
  label?: string
  colors?: readonly string[]
  className?: string
  hint?: string
  // Use compact dropdown style instead of grid
  compact?: boolean
}

export function ColorPicker({
  value,
  onChange,
  label,
  colors = DEFAULT_COLORS,
  className = '',
  hint,
  compact = false,
}: ColorPickerProps) {
  const generatedId = useId()
  const gridId = `color-grid-${generatedId}`

  const handleKeyDown = (hexColor: string, index: number, e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        onChange(hexColor)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusNextColor(index)
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusPrevColor(index)
        break
      case 'Home':
        e.preventDefault()
        focusFirstColor()
        break
      case 'End':
        e.preventDefault()
        focusLastColor()
        break
    }
  }

  const focusNextColor = (currentIndex: number) => {
    const nextIndex = (currentIndex + 1) % colors.length
    const button = document.querySelector(
      `#${gridId}-button-${nextIndex}`
    ) as HTMLButtonElement
    button?.focus()
  }

  const focusPrevColor = (currentIndex: number) => {
    const prevIndex = (currentIndex - 1 + colors.length) % colors.length
    const button = document.querySelector(
      `#${gridId}-button-${prevIndex}`
    ) as HTMLButtonElement
    button?.focus()
  }

  const focusFirstColor = () => {
    const button = document.querySelector(
      `#${gridId}-button-0`
    ) as HTMLButtonElement
    button?.focus()
  }

  const focusLastColor = () => {
    const button = document.querySelector(
      `#${gridId}-button-${colors.length - 1}`
    ) as HTMLButtonElement
    button?.focus()
  }

  // Compact dropdown version
  if (compact) {
    return (
      <div className={`space-y-1 ${className}`}>
        {label && (
          <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`
              w-full pl-3 pr-10 py-2 text-sm rounded-lg border ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)}
              focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent
              appearance-none ${withDarkMode('bg-white', 'dark:bg-gray-800')} ${withDarkMode(textColors.primary, darkModeTextColors.primary)} cursor-pointer
              ${withDarkMode('hover:border-gray-400', 'dark:hover:border-gray-600')} transition-colors
            `}
          >
            <option value="" disabled>Select a color...</option>
            {colors.map((tailwindClasses) => {
              const hexColor = COLOR_HEX_MAP[tailwindClasses]
              const colorName = COLOR_NAMES[hexColor]
              return (
                <option key={hexColor} value={hexColor}>
                  {colorName}
                </option>
              )
            })}
          </select>
          {/* Color preview circle */}
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <div
              className="w-5 h-5 rounded-full border-2 border-white shadow-md"
              style={{
                backgroundColor: value || '#9ca3af'
              }}
              title={value || 'No color selected'}
            />
          </div>
          {/* Dropdown arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className={`w-4 h-4 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {hint && (
          <p className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>{hint}</p>
        )}
      </div>
    )
  }

  // Original grid version
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
          {label}
        </label>
      )}
      <div
        id={gridId}
        role="radiogroup"
        aria-label={label || 'Color selection'}
        className="grid grid-cols-6 gap-2"
      >
        {colors.map((tailwindClasses, index) => {
          const hexColor = COLOR_HEX_MAP[tailwindClasses]
          const isSelected = value === hexColor
          return (
            <button
              key={hexColor}
              id={`${gridId}-button-${index}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={`
                relative h-10 rounded-md border-2 transition-all
                hover:scale-105 focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-2
                ${tailwindClasses}
                ${isSelected ? `ring-2 ring-offset-2 ${accentColors.focusRing}` : 'opacity-70 hover:opacity-100'}
              `}
              onClick={() => onChange(hexColor)}
              onKeyDown={(e) => handleKeyDown(hexColor, index, e)}
              title={hexColor}
            >
              {isSelected && (
                <Check className="absolute inset-0 m-auto h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
