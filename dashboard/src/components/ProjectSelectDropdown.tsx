import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { ProjectIcon } from './ProjectIcon'

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
        <label className="block text-xs font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          id={id}
          className={`
            inline-flex items-center justify-between w-full min-w-[200px]
            border border-gray-300 rounded-md px-3 py-2 text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            hover:bg-gray-50 transition-colors cursor-pointer
            ${error ? 'border-red-400' : ''}
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
              <span className="text-gray-500">{placeholder}</span>
            )}
          </Select.Value>
          <Select.Icon className="ml-2">
            <ChevronDown size={16} className="text-gray-500" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={`
              overflow-hidden bg-white rounded-md shadow-lg border border-gray-200
              z-50 max-h-60 overflow-y-auto
            `}
            position="popper"
            sideOffset={5}
          >
            <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-50 hover:bg-gray-100 cursor-pointer">
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
                      data-[highlighted]:bg-gray-100
                      data-[highlighted]:outline-none
                      data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
                      data-[state=checked]:bg-gray-50
                      transition-colors
                    `}
                  >
                    <Select.ItemText>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                          <span className="text-white text-xs">∞</span>
                        </div>
                        <span>{allOptionLabel}</span>
                      </div>
                    </Select.ItemText>
                    <Select.ItemIndicator className="absolute right-2">
                      <Check size={16} className="text-gray-900" />
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
                      data-[highlighted]:bg-gray-100
                      data-[highlighted]:outline-none
                      data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
                      data-[state=checked]:bg-gray-50
                      transition-colors
                    `}
                  >
                    <Select.ItemText>
                      <div className="flex items-center gap-2">
                        <ProjectIcon project={project} size={16} />
                        <div className="flex flex-col">
                          <span className="font-medium">{project.name}</span>
                          {project.description && (
                            <span className="text-xs text-gray-500">{project.description}</span>
                          )}
                        </div>
                      </div>
                    </Select.ItemText>
                    <Select.ItemIndicator className="absolute right-2">
                      <Check size={16} className="text-gray-900" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            </Select.Viewport>

            <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-gray-50 hover:bg-gray-100 cursor-pointer">
              <ChevronDown size={16} />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
