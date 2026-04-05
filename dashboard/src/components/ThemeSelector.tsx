import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  darkModeDropdownColors,
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeInteractiveStates,
  withDarkMode,
} from '@/lib/colors';

type Layout = 'horizontal' | 'vertical' | 'compact' | 'sidebar';

interface ThemeSelectorProps {
  className?: string;
  layout?: Layout;
}

interface ThemeOption {
  value: Theme;
  label: string;
  icon: typeof Sun;
  description: string;
}

function getThemeOptions(t: (key: string) => string): ThemeOption[] {
  return [
    {
      value: 'light',
      label: t('common.common.themeLight'),
      icon: Sun,
      description: t('common.common.themeLightDescription')
    },
    {
      value: 'dark',
      label: t('common.common.themeDark'),
      icon: Moon,
      description: t('common.common.themeDarkDescription')
    },
    {
      value: 'system',
      label: t('common.common.themeSystem'),
      icon: Monitor,
      description: t('common.common.themeSystemDescription')
    }
  ];
}

export function ThemeSelector({ className = '', layout = 'vertical' }: ThemeSelectorProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();

  const isHorizontal = layout === 'horizontal';
  const isCompact = layout === 'compact' || layout === 'sidebar';

  // Sidebar layout: single button with dropdown
  if (isCompact) {
    return <SidebarThemeSelector theme={theme} resolvedTheme={resolvedTheme} setTheme={setTheme} className={className} t={t} />;
  }

  // Horizontal / vertical layouts: keep original behavior showing all options
  return <AllOptionsSelector theme={theme} resolvedTheme={resolvedTheme} setTheme={setTheme} isHorizontal={isHorizontal} className={className} t={t} />;
}

function SidebarThemeSelector({
  theme,
  resolvedTheme,
  setTheme,
  className,
  t
}: {
  theme: Theme;
  resolvedTheme: string;
  setTheme: (theme: Theme) => void;
  className: string;
  t: (key: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeOptions = getThemeOptions(t);
  const currentOption = themeOptions.find(o => o.value === theme) || themeOptions[0];
  const CurrentIcon = currentOption.icon;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* Selected theme button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${withDarkMode('hover:text-white', 'hover:text-white')} ${withDarkMode(interactiveStates.hoverBg, 'hover:bg-gray-800')} transition-colors`}
      >
        <div className={`w-8 h-8 rounded-lg ${withDarkMode('bg-gray-700', darkModeBgColors.tertiary)} flex items-center justify-center flex-shrink-0 relative`}>
          <CurrentIcon className="h-4 w-4" />
          {theme === 'system' && (
            <span className="absolute -top-1 -right-1 text-[7px] font-bold bg-orange-600 text-white rounded-full w-3 h-3 flex items-center justify-center">
              {resolvedTheme === 'dark' ? 'D' : 'L'}
            </span>
          )}
        </div>
        <span className="text-sm font-medium truncate flex-1 text-left">
          {currentOption.label}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute bottom-full left-0 right-0 mb-1 ${withDarkMode('bg-gray-800', darkModeBgColors.secondary)} rounded-lg border ${withDarkMode('border-gray-700', darkModeDropdownColors.border)} py-1 shadow-lg z-50`}>
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setTheme(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${
                  isActive
                    ? `${withDarkMode('text-white', darkModeTextColors.primary)} ${withDarkMode('bg-gray-700', darkModeBgColors.tertiary)}`
                    : `${withDarkMode('text-gray-300', darkModeTextColors.secondary)} ${withDarkMode('hover:text-white', 'hover:text-white')} ${withDarkMode('hover:bg-gray-700', darkModeDropdownColors.itemHover)}`
                }`}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 relative">
                  <Icon className="h-3.5 w-3.5" />
                  {option.value === 'system' && theme === 'system' && (
                    <span className="absolute -top-1 -right-1 text-[6px] font-bold bg-orange-600 text-white rounded-full w-2.5 h-2.5 flex items-center justify-center">
                      {resolvedTheme === 'dark' ? 'D' : 'L'}
                    </span>
                  )}
                </div>
                <span className="text-sm flex-1 text-left">{option.label}</span>
                {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AllOptionsSelector({
  theme,
  resolvedTheme,
  setTheme,
  isHorizontal,
  className,
  t
}: {
  theme: Theme;
  resolvedTheme: string;
  setTheme: (theme: Theme) => void;
  isHorizontal: boolean;
  className: string;
  t: (key: string) => string;
}) {
  const themeOptions = getThemeOptions(t);
  const baseContainerClass = isHorizontal
    ? 'flex items-center gap-2'
    : 'flex flex-col gap-2';

  const baseButtonClass = `
    flex items-center gap-2 rounded-md border transition-all duration-150
    focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-1
  `;

  const activeButtonClass = `
    ${bgColors.inverted} ${darkModeBgColors.tertiary} ${textColors.inverted}
    ${withDarkMode(borderColors.transparent, darkModeBorderColors.thick)}
  `;

  const inactiveButtonClass = `
    ${bgColors.secondary} ${darkModeBgColors.secondary} ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}
    ${withDarkMode(borderColors.default, darkModeBorderColors.default)}
    ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)}
  `;

  const horizontalButtonClass = isHorizontal ? 'flex-col gap-1 px-2.5 py-2' : 'px-3 py-2';
  const horizontalTextClass = isHorizontal ? 'text-[10px]' : 'text-sm';

  return (
    <div className={`${baseContainerClass} ${className}`}>
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            title={option.description}
            className={`
              ${baseButtonClass}
              ${horizontalButtonClass}
              ${isActive ? activeButtonClass : inactiveButtonClass}
              ${isHorizontal ? 'justify-center' : 'w-full justify-between'}
            `}
            aria-pressed={isActive}
          >
            <div className={`flex items-center gap-2 ${isHorizontal ? 'flex-col' : ''}`}>
              <div className="relative">
                <Icon className="h-4 w-4" />
                {option.value === 'system' && theme === 'system' && (
                  <span className={`absolute -top-1 -right-1 text-[8px] font-bold ${withDarkMode('bg-orange-600', 'dark:bg-orange-500')} ${textColors.inverted} rounded px-1 py-0.5 min-w-[32px] text-center`}>
                    {resolvedTheme === 'dark' ? t('common.common.themeDark') : t('common.common.themeLight')}
                  </span>
                )}
              </div>
              {isHorizontal && (
                <span className={`font-medium ${horizontalTextClass}`}>{option.label}</span>
              )}
            </div>
            {!isHorizontal && (
              <div className="flex flex-col items-start flex-1">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs opacity-70">{option.description}</span>
              </div>
            )}
            {!isHorizontal && isActive && (
              <Check className="h-4 w-4 ml-2 flex-shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
