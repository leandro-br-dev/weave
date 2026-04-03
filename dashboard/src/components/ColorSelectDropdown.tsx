import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { COLOR_HEX_MAP, COLOR_NAMES, DEFAULT_COLORS } from './ColorPicker'
import {
  dropdownColors,
  darkModeDropdownColors,
  bgColors,
  darkModeBgColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeInteractiveStates,
  withDarkMode,
} from '@/lib/colors'

interface ColorSelectDropdownProps {
  value: string
  onChange: (hexColor: string) => void
  className?: string
}

/**
 * ColorSelectDropdown - A compact color picker that shows only the selected
 * color circle, and opens a dropdown with color icon + name when clicked.
 *
 * Features:
 * - Shows only a small color circle when a color is already selected
 * - Dropdown shows each color with its icon and human-readable name
 * - Visual checkmark for the currently selected color
 * - Keyboard navigation support (Radix UI)
 * - StopPropagation built-in to prevent parent click handlers
 */
export function ColorSelectDropdown({
  value,
  onChange,
  className = '',
}: ColorSelectDropdownProps) {
  const colorName = COLOR_NAMES[value] || 'Custom'

  return (
    <div className={`relative inline-flex ${className}`}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className={`
              inline-flex items-center gap-1.5 px-1.5 py-1 rounded-md
              ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)}
              transition-colors cursor-pointer
              focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-1
            `}
            title={colorName}
            aria-label={`Color: ${colorName}`}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: value || '#9ca3af' }}
            />
            <ChevronDown size={12} className={textColors.muted} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={`
              z-50 min-w-[160px] ${withDarkMode(dropdownColors.bg, darkModeDropdownColors.bg)} rounded-lg
              shadow-lg border ${withDarkMode(dropdownColors.border, darkModeDropdownColors.border)}
              p-1 overflow-hidden
            `}
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Label className={`px-2 py-1.5 text-xs font-medium ${withDarkMode(textColors.tertiary, darkModeTextColors.muted)}`}>
              Project Color
            </DropdownMenu.Label>
            <DropdownMenu.Separator className={`h-px ${withDarkMode(dropdownColors.divider, darkModeDropdownColors.divider)} my-1`} />

            {DEFAULT_COLORS.map((tailwindClasses) => {
              const hexColor = COLOR_HEX_MAP[tailwindClasses]
              const name = COLOR_NAMES[hexColor]
              const isSelected = value === hexColor

              return (
                <DropdownMenu.Item
                  key={hexColor}
                  onSelect={(e: { preventDefault: () => void }) => {
                    e.preventDefault()
                    onChange(hexColor)
                  }}
                  className={`
                    relative flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-md
                    cursor-pointer select-none outline-none transition-colors
                    ${isSelected
                      ? withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)
                      : withDarkMode('hover:bg-gray-50', darkModeDropdownColors.itemHover)
                    }
                  `}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: hexColor }}
                  />
                  <span className={`text-sm ${isSelected
                    ? `font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`
                    : withDarkMode(textColors.secondary, darkModeTextColors.secondary)
                  }`}>
                    {name}
                  </span>
                  {isSelected && (
                    <Check size={14} className={`ml-auto ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`} />
                  )}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
