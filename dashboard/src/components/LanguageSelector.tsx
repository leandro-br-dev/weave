import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import {
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeInteractiveStates,
  withDarkMode,
  darkModeDropdownColors,
} from '@/lib/colors';

type Layout = 'horizontal' | 'vertical' | 'sidebar';

interface LanguageSelectorProps {
  className?: string;
  layout?: Layout;
}

interface LanguageOption {
  code: string;
  nativeName: string;
  localName: string;
  flag: string;
}

const languageOptions: LanguageOption[] = [
  {
    code: 'en-US',
    nativeName: 'English',
    localName: 'English',
    flag: '🇺🇸',
  },
  {
    code: 'pt-BR',
    nativeName: 'Português',
    localName: 'Portuguese',
    flag: '🇧🇷',
  },
];

export function LanguageSelector({ className = '', layout = 'vertical' }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    // Update state when language changes externally
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // Language is automatically persisted to localStorage by i18next's LanguageDetector
  };

  // Sidebar layout: single button with dropdown
  if (layout === 'sidebar') {
    return (
      <SidebarLanguageSelector
        currentLanguage={currentLanguage}
        changeLanguage={changeLanguage}
        className={className}
      />
    );
  }

  const isHorizontal = layout === 'horizontal';
  const baseContainerClass = isHorizontal
    ? 'flex items-center gap-2'
    : 'flex flex-col gap-2';

  const baseButtonClass = `
    flex items-center gap-2 px-3 py-2 rounded-md border transition-all duration-150
    focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-1
  `;

  const activeButtonClass = `
    ${bgColors.inverted} ${textColors.inverted} ${borderColors.transparent}
    ${darkModeBgColors.tertiary} ${darkModeTextColors.primary} ${darkModeBorderColors.thick}
  `;

  const inactiveButtonClass = `
    ${bgColors.secondary} ${textColors.secondary} ${borderColors.thick}
    ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)}
  `;

  const horizontalButtonClass = isHorizontal ? 'flex-col gap-1 px-2.5 py-2' : '';
  const horizontalTextClass = isHorizontal ? 'text-[10px]' : 'text-sm';

  return (
    <div className={`${baseContainerClass} ${className}`} role="group" aria-label="Language selector">
      {languageOptions.map((option) => {
        const isActive = currentLanguage === option.code;

        return (
          <button
            key={option.code}
            onClick={() => changeLanguage(option.code)}
            title={`${option.localName} (${option.nativeName})`}
            className={`
              ${baseButtonClass}
              ${horizontalButtonClass}
              ${isActive ? activeButtonClass : inactiveButtonClass}
              ${!isHorizontal ? 'w-full justify-between' : 'justify-center'}
            `}
            aria-pressed={isActive}
            aria-label={`Switch to ${option.localName}`}
          >
            <div className={`flex items-center gap-2 ${isHorizontal ? 'flex-col' : ''}`}>
              <span className="text-lg" role="img" aria-label={option.localName}>
                {option.flag}
              </span>
              {!isHorizontal && (
                <div className="flex flex-col items-start flex-1">
                  <span className="text-sm font-medium">{option.nativeName}</span>
                  <span className={`text-xs opacity-70`}>{option.localName}</span>
                </div>
              )}
              {isHorizontal && (
                <span className={`font-medium ${horizontalTextClass}`}>
                  {option.code.split('-')[1]}
                </span>
              )}
            </div>
            {isActive && !isHorizontal && (
              <Check className="h-4 w-4 ml-2 flex-shrink-0" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function SidebarLanguageSelector({
  currentLanguage,
  changeLanguage,
  className,
}: {
  currentLanguage: string;
  changeLanguage: (lng: string) => void;
  className: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentOption = languageOptions.find(o => o.code === currentLanguage) || languageOptions[0];

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
      {/* Selected language button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${withDarkMode('hover:text-white', 'hover:text-white')} ${withDarkMode(interactiveStates.hoverBg, 'hover:bg-gray-800')} transition-colors`}
      >
        <div className={`w-8 h-8 rounded-lg ${withDarkMode('bg-gray-700', darkModeBgColors.tertiary)} flex items-center justify-center flex-shrink-0`}>
          <span className="text-base">{currentOption.flag}</span>
        </div>
        <span className="text-sm font-medium truncate flex-1 text-left">
          {currentOption.nativeName}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute bottom-full left-0 right-0 mb-1 ${withDarkMode('bg-gray-800', darkModeBgColors.secondary)} rounded-lg border ${withDarkMode('border-gray-700', darkModeDropdownColors.border)} py-1 shadow-lg z-50`}>
          {languageOptions.map((option) => {
            const isActive = currentLanguage === option.code;
            return (
              <button
                key={option.code}
                onClick={() => {
                  changeLanguage(option.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${
                  isActive
                    ? `${withDarkMode('text-white', darkModeTextColors.primary)} ${withDarkMode('bg-gray-700', darkModeBgColors.tertiary)}`
                    : `${withDarkMode('text-gray-300', darkModeTextColors.secondary)} ${withDarkMode('hover:text-white', 'hover:text-white')} ${withDarkMode('hover:bg-gray-700', darkModeDropdownColors.itemHover)}`
                }`}
              >
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">{option.flag}</span>
                </div>
                <span className="text-sm flex-1 text-left">{option.nativeName}</span>
                {isActive && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
