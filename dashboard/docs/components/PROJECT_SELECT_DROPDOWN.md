# ProjectSelectDropdown

A rich, accessible dropdown component for selecting projects with visual indicators (icons and colors).

## Features

- 🎨 **Visual Indicators**: Shows project icon with dynamic color
- 📝 **Rich Information**: Displays project name and optional description
- ✓ **Selection Feedback**: Visual checkmark for selected item
- ⌨️ **Keyboard Navigation**: Full keyboard support (Arrow keys, Enter, Escape)
- ♿ **Accessible**: Built on Radix UI primitives with proper ARIA attributes
- 🎯 **Filter Mode**: Optional "All Projects" option for filtering scenarios
- ✅ **Validation**: Built-in error and required states
- 🎭 **Hover & Focus**: Smooth transitions and focus states

## Installation

The component is already included in the project's components. Simply import it:

```tsx
import { ProjectSelectDropdown } from '@/components'
```

## Basic Usage

```tsx
import { useState } from 'react'
import { ProjectSelectDropdown } from '@/components'

function MyComponent() {
  const [selectedProject, setSelectedProject] = useState('')

  return (
    <ProjectSelectDropdown
      value={selectedProject}
      onChange={setSelectedProject}
      projects={projects}
      label="Select Project"
      placeholder="Choose a project..."
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | **Required** | The currently selected project ID |
| `onChange` | `(value: string) => void` | **Required** | Callback when selection changes |
| `projects` | `Project[]` | **Required** | Array of available projects |
| `label` | `string` | `undefined` | Label text displayed above the dropdown |
| `placeholder` | `string` | `"Select a project..."` | Placeholder text when nothing is selected |
| `className` | `string` | `""` | Additional CSS classes for wrapper |
| `id` | `string` | `undefined` | HTML ID for the trigger element |
| `disabled` | `boolean` | `false` | Disables the dropdown |
| `required` | `boolean` | `false` | Shows required indicator (*) |
| `error` | `string` | `undefined` | Error message to display |
| `showAllOption` | `boolean` | `false` | Adds "All Projects" option |
| `allOptionLabel` | `string` | `"All Projects"` | Label for the "all" option |

## Project Type

```tsx
interface Project {
  id: string          // Unique identifier
  name: string        // Project name
  color?: string      // Optional hex color (e.g., "#3b82f6")
  description?: string // Optional project description
}
```

## Examples

### Filter Mode (with "All Projects" option)

```tsx
<ProjectSelectDropdown
  value={filterProject}
  onChange={setFilterProject}
  projects={projects}
  label="Filter by Project"
  showAllOption
  allOptionLabel="All Projects"
/>
```

### Required Field with Validation

```tsx
<ProjectSelectDropdown
  value={selectedProject}
  onChange={setSelectedProject}
  projects={projects}
  label="Project"
  required
  error={hasError ? "This field is required" : undefined}
/>
```

### Disabled State

```tsx
<ProjectSelectDropdown
  value="project-1"
  onChange={() => {}}
  projects={projects}
  label="Project"
  disabled
/>
```

## Integration with Existing APIs

The component integrates seamlessly with the existing project API:

```tsx
import { useGetProjects } from '@/api/projects'
import { ProjectSelectDropdown } from '@/components'

function ProjectFilter() {
  const { data: projects = [] } = useGetProjects()
  const [selectedProject, setSelectedProject] = useState('')

  return (
    <ProjectSelectDropdown
      value={selectedProject}
      onChange={setSelectedProject}
      projects={projects}
      label="Select Project"
      showAllOption
    />
  )
}
```

## Styling

The component uses Tailwind CSS classes for styling. Key style elements:

- **Trigger**: Border, rounded corners, hover effect, focus ring
- **Dropdown**: Shadow, border, rounded corners, z-index overlay
- **Options**: Hover highlight, checked state background
- **Error State**: Red border, error message text
- **Disabled State**: Gray background, reduced opacity

## Accessibility

The component follows WCAG guidelines:

- ✅ Proper label association
- ✅ ARIA attributes (`aria-invalid`, `role="alert"`)
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ Screen reader friendly

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open dropdown / Select option |
| `Arrow Down` | Move to next option |
| `Arrow Up` | Move to previous option |
| `Escape` | Close dropdown |
| `Home` | Jump to first option |
| `End` | Jump to last option |

## Testing

The component includes comprehensive tests:

```bash
# Run tests
npm test ProjectSelectDropdown
```

Test coverage includes:
- Basic rendering
- User interactions
- Error states
- Disabled states
- Accessibility attributes
- Edge cases (empty arrays, missing props)

## Demo Page

A demo page is available at `/project-select-demo` showing all variants and use cases.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- `@radix-ui/react-select`: Dropdown primitives
- `lucide-react`: Icons (ChevronDown, ChevronUp, Check)
- `ProjectIcon`: Internal component for project icons

## Future Enhancements

Potential improvements for future versions:

- [ ] Multi-select support
- [ ] Search/filter within dropdown
- [ ] Project grouping
- [ ] Custom option rendering
- [ ] Virtual scrolling for large lists
- [ ] Animated transitions

## License

Internal component - part of the weave project.
