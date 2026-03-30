import { useTranslation } from 'react-i18next';

/**
 * Example component demonstrating i18n usage
 *
 * This component shows how to:
 * - Import and use the useTranslation hook
 * - Access translations with nested keys
 * - Use interpolation for dynamic values
 * - Switch languages programmatically
 */
export function I18nExample() {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">
        {t('common.languageSwitcher.title')}
      </h2>

      <div className="space-y-4">
        {/* Language Switcher */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            {t('common.languageSwitcher.currentLanguage')}:
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => changeLanguage('en-US')}
              className={`px-4 py-2 rounded ${
                i18n.language === 'en-US'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              English (US)
            </button>
            <button
              onClick={() => changeLanguage('pt-BR')}
              className={`px-4 py-2 rounded ${
                i18n.language === 'pt-BR'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Português (BR)
            </button>
          </div>
        </div>

        {/* Sample Translations */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">
            {t('common.languageSwitcher.selectLanguage')}
          </h3>
          <ul className="space-y-2">
            <li>🏠 {t('common.nav.dashboard')}</li>
            <li>💾 {t('common.buttons.save')}</li>
            <li>✏️ {t('common.buttons.edit')}</li>
            <li>🗑️ {t('common.buttons.delete')}</li>
            <li>⚙️ {t('common.nav.settings')}</li>
          </ul>
        </div>

        {/* Interpolation Example */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">
            Interpolation Example:
          </h3>
          <p>
            {t('common.status.success', { name: 'i18n Integration' })}
          </p>
        </div>

        {/* Current Language Info */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-2">
            Current Language Info:
          </h3>
          <p>Language Code: <code>{i18n.language}</code></p>
          <p>Loaded Namespaces: <code>translation</code></p>
          <p>Is Initialized: <code>{i18n.isInitialized ? 'Yes ✅' : 'No ❌'}</code></p>
        </div>
      </div>
    </div>
  );
}
