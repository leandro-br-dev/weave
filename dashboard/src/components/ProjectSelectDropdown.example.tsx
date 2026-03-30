/**
 * Example usage of ProjectSelectDropdown component
 *
 * This file demonstrates how to use the ProjectSelectDropdown component
 * in various scenarios.
 */

import { useState } from 'react'
import { ProjectSelectDropdown } from './ProjectSelectDropdown'

// Mock project data
const mockProjects = [
  {
    id: '1',
    name: 'CharHub',
    color: '#3b82f6',
    description: 'Character management platform'
  },
  {
    id: '2',
    name: 'E-commerce Dashboard',
    color: '#10b981',
    description: 'Sales and analytics dashboard'
  },
  {
    id: '3',
    name: 'Mobile App API',
    color: '#f59e0b',
    description: 'Backend services for mobile'
  },
  {
    id: '4',
    name: 'Marketing Site',
    color: '#ef4444',
    description: 'Company website and landing pages'
  },
  {
    id: '5',
    name: 'Internal Tools',
    color: '#8b5cf6'
    // No description example
  }
]

export function ProjectSelectDropdownExample() {
  const [selectedProject, setSelectedProject] = useState('')

  return (
    <div className="max-w-md space-y-6 p-6">
      {/* Basic usage */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Basic Usage</h3>
        <ProjectSelectDropdown
          value={selectedProject}
          onChange={setSelectedProject}
          projects={mockProjects}
          label="Select Project"
          placeholder="Choose a project..."
        />
      </div>

      {/* With "All Projects" option */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Filter Mode (with All option)</h3>
        <ProjectSelectDropdown
          value={selectedProject}
          onChange={setSelectedProject}
          projects={mockProjects}
          label="Filter by Project"
          placeholder="All projects"
          showAllOption
          allOptionLabel="All Projects"
        />
      </div>

      {/* Required field */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Required Field</h3>
        <ProjectSelectDropdown
          value={selectedProject}
          onChange={setSelectedProject}
          projects={mockProjects}
          label="Project (Required)"
          placeholder="Select a project..."
          required
        />
      </div>

      {/* Disabled state */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Disabled State</h3>
        <ProjectSelectDropdown
          value="1"
          onChange={setSelectedProject}
          projects={mockProjects}
          label="Project (Disabled)"
          disabled
        />
      </div>

      {/* With error state */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Error State</h3>
        <ProjectSelectDropdown
          value={selectedProject}
          onChange={setSelectedProject}
          projects={mockProjects}
          label="Project"
          placeholder="Select a project..."
          error="This field is required"
        />
      </div>
    </div>
  )
}

/**
 * Usage in a real component:
 *
 * ```tsx
 * import { useState } from 'react'
 * import { useGetProjects } from '@/api/projects'
 * import { ProjectSelectDropdown } from '@/components'
 *
 * export function MyComponent() {
 *   const { data: projects } = useGetProjects()
 *   const [selectedProjectId, setSelectedProjectId] = useState('')
 *
 *   return (
 *     <div>
 *       <ProjectSelectDropdown
 *         value={selectedProjectId}
 *         onChange={setSelectedProjectId}
 *         projects={projects || []}
 *         label="Select Project"
 *         placeholder="Choose a project..."
 *         showAllOption
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
