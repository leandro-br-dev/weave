import type { ReactNode } from 'react'
import {
  buttonVariants,
  darkModeButtonVariants,
  interactiveStates,
} from '@/lib/colors'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps {
  children: ReactNode
  variant?: Variant
  size?: Size
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}

const sizes: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1',
  md: 'text-sm px-3 py-2 gap-1.5',
}

export function Button({
  children, variant = 'secondary', size = 'md',
  onClick, disabled, loading, type = 'button', className = '', title
}: ButtonProps) {
  const light = buttonVariants[variant]
  const dark = darkModeButtonVariants[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`
        inline-flex items-center justify-center border rounded-md font-medium
        transition-colors duration-150 focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${light.bg} ${dark.bg} ${light.text} ${dark.text} ${light.border} ${dark.border} ${light.hoverBg} ${dark.hoverBg}${light.hoverText ? ` ${light.hoverText}` : ''}${dark.hoverText ? ` ${dark.hoverText}` : ''}
        ${sizes[size]} ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
