import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { ProjectIcon } from './ProjectIcon'
import {
  dropdownColors,
  darkModeDropdownColors,
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeInteractiveStates,
  errorColors,
  darkModeErrorColors,
  withDarkMode,
} from '@/lib/colors'

interface Project {
  id: string
  name: string
  color?: string
  description?: string | null
}

interface ProjectSelectDropdownProps {
  value: string
  onChange: (value: string) => void
  projects: Project[]
  label?: string
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  required?: boolean
  error?: string
  showAllOption?: boolean
  allOptionLabel?: string
}

/**
 * ProjectSelectDropdown - A rich dropdown component for selecting projects
 *
 * Features:
 * - Shows project icon with color in the dropdown options
 * - Displays project name and optional description
 * - Visual indication of selected project
 * - Keyboard navigation support
 * - Accessible (built on Radix UI primitives)
 * - Optional "All Projects" option for filtering
 *
 * @example
 * ```tsx
 * <ProjectSelectDropdown
 *   value={selectedProjectId}
 *   onChange={setSelectedProjectId}
 *   projects={projects}
 *   label="Select Project"
 *   placeholder="Choose a project..."
 *   showAllOption
 * />
 * ```
 */
export function ProjectSelectDropdown({
  value,
  onChange,
  projects,
  label,
  placeholder = 'Select a project...',
  className = '',
  id,
  disabled = false,
  required = false,
  error,
  showAllOption = false,
  allOptionLabel = 'All Projects'
}: ProjectSelectDropdownProps) {
  const selectedProject = projects.find(p => p.id === value)

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
          {label}
          {required && <span className={`ml-1 ${withDarkMode(errorColors.text, darkModeErrorColors.text)}`}>*</span>}
        </label>
      )}

      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          id={id}
          className={`
            inline-flex items-center justify-between w-full min-w-[200px]
            border ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} rounded-md px-3 py-2 text-sm
            ${withDarkMode(bgColors.secondary, darkModeBgColors.tertiary)}
            ${withDarkMode(textColors.primary, darkModeTextColors.primary)}
            focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent
            ${withDarkMode('disabled:bg-gray-50', 'dark:disabled:bg-gray-900')} ${withDarkMode('disabled:text-gray-400', 'dark:disabled:text-gray-500')}
            disabled:cursor-not-allowed
            ${withDarkMode('hover:bg-gray-50', darkModeInteractiveStates.hoverBg)}
            transition-colors cursor-pointer
            ${error ? `${errorColors.borderStrong} ${darkModeErrorColors.border}` : ''}
          `}
          aria-invalid={!!error}
        >
          <Select.Value placeholder={placeholder}>
            {selectedProject ? (
              <div className="flex items-center gap-2">
                <ProjectIcon project={selectedProject} size={16} />
                <span className="font-medium">{selectedProject.name}</span>
              </div>
            ) : (
              <span className={textColors.muted}>{placeholder}</span>
            )}
          </Select.Value>
          <Select.Icon className="ml-2">
            <ChevronDown size={16} className={textColors.tertiary} />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={`
              overflow-hidden ${withDarkMode(dropdownColors.bg, darkModeDropdownColors.bg)} rounded-md shadow-lg
              border ${withDarkMode(dropdownColors.border, darkModeDropdownColors.border)}
              z-50 max-h-60 overflow-y-auto
            `}
            position="popper"
            sideOffset={5}
          >
            <Select.ScrollUpButton className={`flex items-center justify-center h-6 ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} ${withDarkMode('hover:bg-gray-100', darkModeInteractiveStates.hoverBg)} cursor-pointer`}>
              <ChevronUp size={16} />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-1">
              <Select.Group>
                {showAllOption && (
                  <Select.Item
                    value="all"
                    className={`
                      relative flex items-center gap-2 px-3 py-2 text-sm rounded-md
                      cursor-pointer select-none
                      ${withDarkMode(dropdownColors.itemHover, darkModeDropdownColors.itemHover)}
                      data-[highlighted]:outline-none
                      data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
                      ${withDarkMode('data-[state=checked]:bg-gray-50', 'data-[state=checked]:bg-gray-800')}
                      transition-colors
                    `}
                  >
                    <Select.ItemText>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs">∞</span>
                        </div>
                        <span className={dropdownColors.itemText}>{allOptionLabel}</span>
                      </div>
                    </Select.ItemText>
                    <Select.ItemIndicator className="absolute right-2">
                      <Check size={16} className={textColors.primary} />
                    </Select.ItemIndicator>
                  </Select.Item>
                )}

                {projects.map((project) => (
                  <Select.Item
                    key={project.id}
                    value={project.id}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 text-sm rounded-md
                      cursor-pointer select-none
                      ${withDarkMode(dropdownColors.itemHover, darkModeDropdownColors.itemHover)}
                      data-[highlighted]:outline-none
                      data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
                      ${withDarkMode('data-[state=checked]:bg-gray-50', 'data-[state=checked]:bg-gray-800')}
                      transition-colors
                    `}
                  >
                    <Select.ItemText>
                      <div className="flex items-center gap-2">
                        <ProjectIcon project={project} size={16} />
                        <div className="flex flex-col">
                          <span className={`font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>{project.name}</span>
                          {project.description && (
                            <span className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>{project.description}</span>
                          )}
                        </div>
                      </div>
                    </Select.ItemText>
                    <Select.ItemIndicator className="absolute right-2">
                      <Check size={16} className={withDarkMode(textColors.primary, darkModeTextColors.primary)} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            </Select.Viewport>

            <Select.ScrollDownButton className={`flex items-center justify-center h-6 ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} ${withDarkMode('hover:bg-gray-100', darkModeInteractiveStates.hoverBg)} cursor-pointer`}>
              <ChevronDown size={16} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {error && (
        <p className={`text-xs ${withDarkMode(errorColors.text, darkModeErrorColors.text)}`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
