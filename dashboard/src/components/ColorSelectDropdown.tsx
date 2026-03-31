import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { COLOR_HEX_MAP, COLOR_NAMES, DEFAULT_COLORS } from './ColorPicker'

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
            className="
              inline-flex items-center gap-1.5 px-1.5 py-1 rounded-md
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
            "
            title={colorName}
            aria-label={`Color: ${colorName}`}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: value || '#9ca3af' }}
            />
            <ChevronDown size={12} className="text-gray-400" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="
              z-50 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg
              shadow-lg border border-gray-200 dark:border-gray-700
              p-1 overflow-hidden
            "
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              Project Color
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

            {DEFAULT_COLORS.map((tailwindClasses) => {
              const hexColor = COLOR_HEX_MAP[tailwindClasses]
              const name = COLOR_NAMES[hexColor]
              const isSelected = value === hexColor

              return (
                <DropdownMenu.Item
                  key={hexColor}
                  onSelect={(e) => {
                    e.preventDefault()
                    onChange(hexColor)
                  }}
                  className={`
                    relative flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-md
                    cursor-pointer select-none outline-none transition-colors
                    ${isSelected
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }
                  `}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: hexColor }}
                  />
                  <span className={`text-sm ${isSelected ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {name}
                  </span>
                  {isSelected && (
                    <Check size={14} className="ml-auto text-gray-900 dark:text-white" />
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
