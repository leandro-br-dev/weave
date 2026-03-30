import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';

type Layout = 'horizontal' | 'vertical';

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

  const isHorizontal = layout === 'horizontal';
  const baseContainerClass = isHorizontal
    ? 'flex items-center gap-2'
    : 'flex flex-col gap-2';

  const baseButtonClass = `
    flex items-center gap-2 px-3 py-2 rounded-md border transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
  `;

  const activeButtonClass = `
    bg-gray-900 text-white border-gray-900
  `;

  const inactiveButtonClass = `
    bg-white text-gray-700 border-gray-300 hover:bg-gray-50
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
                  <span className="text-xs opacity-70">{option.localName}</span>
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
