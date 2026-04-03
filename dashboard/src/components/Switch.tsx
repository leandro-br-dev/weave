import {
  bgColors,
  darkModeBgColors,
  interactiveStates,
  withDarkMode,
} from '@/lib/colors'

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, disabled = false, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-2
        ${checked
          ? `${bgColors.inverted} ${darkModeBgColors.tertiary}`
          : `${withDarkMode('bg-gray-300', 'dark:bg-gray-700')}`
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full ${withDarkMode('bg-white', 'dark:bg-white')}
          transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}
