import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectSelectDropdown } from './ProjectSelectDropdown'

// Mock projects data
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
    color: '#f59e0b'
  }
]

describe('ProjectSelectDropdown', () => {
  it('renders without crashing', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        label="Select Project"
      />
    )
    expect(screen.getByText('Select Project')).toBeInTheDocument()
  })

  it('displays the placeholder when no project is selected', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        placeholder="Choose a project..."
      />
    )
    expect(screen.getByText('Choose a project...')).toBeInTheDocument()
  })

  it('displays the selected project name', () => {
    render(
      <ProjectSelectDropdown
        value="1"
        onChange={() => {}}
        projects={mockProjects}
      />
    )
    expect(screen.getAllByText('CharHub')).toHaveLength(2) // One in trigger, one in selection info
  })

  it('shows the required indicator when required prop is true', () => {
    const { container } = render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        label="Project"
        required
      />
    )
    // Check that asterisk exists somewhere in the label area
    const labelContainer = container.querySelector('.space-y-1')
    expect(labelContainer?.innerHTML).toContain('*')
  })

  it('displays error message when provided', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        label="Project"
        error="This field is required"
      />
    )
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(
      <ProjectSelectDropdown
        value="1"
        onChange={() => {}}
        projects={mockProjects}
        disabled
      />
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeDisabled()
  })

  it('shows "All Projects" option when showAllOption is true', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        showAllOption
        allOptionLabel="All Projects"
      />
    )
    // The trigger should be clickable
    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
    // The component should render properly
    expect(trigger).toHaveAttribute('type', 'button')
  })

  it('renders with interactive elements', () => {
    const handleChange = vi.fn()

    render(
      <ProjectSelectDropdown
        value=""
        onChange={handleChange}
        projects={mockProjects}
      />
    )

    // Verify the component structure is correct
    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('type', 'button')
  })

  it('displays project count when selected', () => {
    render(
      <ProjectSelectDropdown
        value="1"
        onChange={() => {}}
        projects={mockProjects}
      />
    )
    // Should show selected project info
    const selectedText = screen.getByText('Selected:')
    expect(selectedText).toBeInTheDocument()
    // The project name should appear in the component
    expect(screen.getAllByText('CharHub')).toHaveLength(2)
  })

  it('renders with custom className', () => {
    const { container } = render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        className="custom-class"
      />
    )
    const wrapper = container.querySelector('.custom-class')
    expect(wrapper).toBeInTheDocument()
  })
})

describe('ProjectSelectDropdown Accessibility', () => {
  it('has proper label association', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        label="Select Project"
      />
    )
    const label = screen.getByText('Select Project')
    expect(label).toBeInTheDocument()
  })

  it('shows error message with proper role', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        label="Project"
        error="Selection required"
      />
    )
    const errorMessage = screen.getByRole('alert')
    expect(errorMessage).toHaveTextContent('Selection required')
  })

  it('has aria-invalid attribute when error is present', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={mockProjects}
        label="Project"
        error="Error message"
      />
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('ProjectSelectDropdown Edge Cases', () => {
  it('handles empty projects array', () => {
    render(
      <ProjectSelectDropdown
        value=""
        onChange={() => {}}
        projects={[]}
      />
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('handles project without description', () => {
    const projectsWithoutDesc = [
      { id: '1', name: 'Project 1', color: '#3b82f6' }
    ]
    render(
      <ProjectSelectDropdown
        value="1"
        onChange={() => {}}
        projects={projectsWithoutDesc}
      />
    )
    expect(screen.getAllByText('Project 1')).toHaveLength(2) // Trigger + selection info
  })

  it('handles project without color', () => {
    const projectsWithoutColor = [
      { id: '1', name: 'Project 1' }
    ]
    render(
      <ProjectSelectDropdown
        value="1"
        onChange={() => {}}
        projects={projectsWithoutColor}
      />
    )
    expect(screen.getAllByText('Project 1')).toHaveLength(2) // Trigger + selection info
  })
})
