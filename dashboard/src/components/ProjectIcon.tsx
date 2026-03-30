import { FolderOpen } from 'lucide-react'
import { getProjectColor } from '@/api/kanban'

interface ProjectIconProps {
  project: {
    id: string
    color?: string
  }
  size?: number
  className?: string
}

/**
 * ProjectIcon component that displays a colored folder icon for a project.
 *
 * Color fallback behavior:
 * 1. If project.color is defined (stored in database), use that color
 * 2. If project.color is undefined, generate a deterministic color from project.id using getProjectColor()
 *
 * This ensures all projects have a consistent color even if the user hasn't explicitly set one.
 * The getProjectColor() function hashes the project ID and maps it to one of 12 predefined colors,
 * so the same project ID will always get the same color.
 */
export function ProjectIcon({ project, size = 16, className = '' }: ProjectIconProps) {
  // Use stored color if available, otherwise generate deterministic color from project ID
  const color = project.color || getProjectColor(project.id)

  return (
    <FolderOpen
      size={size}
      className={className}
      style={{ color }}
      aria-hidden="true"
    />
  )
}
