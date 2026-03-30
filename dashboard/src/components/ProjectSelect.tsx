import { Select } from './Select'

interface Project {
  id: string
  name: string
  color?: string
}

interface ProjectSelectProps {
  value: string
  onChange: (value: string) => void
  projects: Project[]
  label?: string
  className?: string
  id?: string
  disabled?: boolean
  required?: boolean
}

export function ProjectSelect({
  value,
  onChange,
  projects,
  label,
  className = '',
  id,
  disabled = false,
  required = false
}: ProjectSelectProps) {
  return (
    <Select
      id={id}
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={disabled}
      required={required}
    >
      <option value="">All Projects</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </Select>
  )
}
