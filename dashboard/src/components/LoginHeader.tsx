import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { Theme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  withDarkMode,
  bgColors,
  textColors,
  borderColors,
  darkModeBgColors,
  darkModeTextColors,
  darkModeBorderColors,
  accentColors,
  darkModeAccentColors,
} from '@/lib/colors';

// ── Theme Dropdown ──────────────────────────────────────────────────────────

interface ThemeOption {
  value: Theme;
  label: string;
  icon: typeof Sun;
}

function getThemeOptions(t: (key: string) => string): ThemeOption[] {
  return [
    { value: 'light', label: t('common.common.themeLight'), icon: Sun },
    { value: 'dark', label: t('common.common.themeDark'), icon: Moon },
    { value: 'system', label: t('common.common.themeSystem'), icon: Monitor },
  ];
}

function ThemeDropdown() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const themeOptions = getThemeOptions(t);
  const currentOption = themeOptions.find(o => o.value === theme) || themeOptions[0];
  const CurrentIcon = currentOption.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${withDarkMode(
          `${textColors.secondary} hover:text-gray-900 hover:bg-gray-200`,
          `${darkModeTextColors.muted} hover:text-white hover:bg-gray-700`
        )}`}
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="font-medium">{currentOption.label}</span>
        {theme === 'system' && (
          <span className={`text-[7px] font-bold ${accentColors.bg} text-white rounded-full w-3 h-3 flex items-center justify-center`}>
            {resolvedTheme === 'dark' ? 'D' : 'L'}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`absolute right-0 top-full mt-1 ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} rounded-lg border ${withDarkMode(`${borderColors.default} shadow-lg`, `${darkModeBorderColors.default} shadow-lg`)} py-1 z-50 min-w-[140px]`}>
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
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? `${withDarkMode(`${accentColors.text} ${accentColors.bgSubtle}`, `${darkModeAccentColors.textOnDark} bg-gray-700`)}`
                    : `${withDarkMode(`${textColors.secondary} hover:bg-gray-100`, `${darkModeTextColors.muted} hover:bg-gray-700`)}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{option.label}</span>
                {isActive && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Language Dropdown ───────────────────────────────────────────────────────

interface LanguageOption {
  code: string;
  nativeName: string;
  flag: string;
}

const languageOptions: LanguageOption[] = [
  { code: 'en-US', nativeName: 'English', flag: '🇺🇸' },
  { code: 'pt-BR', nativeName: 'Português', flag: '🇧🇷' },
];

function LanguageDropdown() {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLanguageChange = (lng: string) => setCurrentLanguage(lng);
    i18n.on('languageChanged', handleLanguageChange);
    return () => { i18n.off('languageChanged', handleLanguageChange); };
  }, [i18n]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const currentOption = languageOptions.find(o => o.code === currentLanguage) || languageOptions[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${withDarkMode(
          `${textColors.secondary} hover:text-gray-900 hover:bg-gray-200`,
          `${darkModeTextColors.muted} hover:text-white hover:bg-gray-700`
        )}`}
      >
        <span className="text-base">{currentOption.flag}</span>
        <span className="font-medium">{currentOption.nativeName}</span>
      </button>

      {isOpen && (
        <div className={`absolute right-0 top-full mt-1 ${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} rounded-lg border ${withDarkMode(`${borderColors.default} shadow-lg`, `${darkModeBorderColors.default} shadow-lg`)} py-1 z-50 min-w-[140px]`}>
          {languageOptions.map((option) => {
            const isActive = currentLanguage === option.code;
            return (
              <button
                key={option.code}
                onClick={() => {
                  i18n.changeLanguage(option.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? `${withDarkMode(`${accentColors.text} ${accentColors.bgSubtle}`, `${darkModeAccentColors.textOnDark} bg-gray-700`)}`
                    : `${withDarkMode(`${textColors.secondary} hover:bg-gray-100`, `${darkModeTextColors.muted} hover:bg-gray-700`)}`
                }`}
              >
                <span className="text-base">{option.flag}</span>
                <span>{option.nativeName}</span>
                {isActive && <Check className="w-3.5 h-3.5 ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LoginHeader ─────────────────────────────────────────────────────────────

export function LoginHeader() {
  return (
    <header className={`fixed top-0 left-0 right-0 z-40 flex items-center justify-end px-6 py-3 ${withDarkMode(
      `${bgColors.tertiary} border-b ${borderColors.default}`,
      `${darkModeBgColors.primary} border-b ${darkModeBorderColors.default}`
    )}`}>
      <div className="flex items-center gap-2">
        <LanguageDropdown />
        <ThemeDropdown />
      </div>
    </header>
  );
}
