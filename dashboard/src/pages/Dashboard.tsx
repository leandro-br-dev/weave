import { useTranslation } from 'react-i18next';
import { textColors, darkModeTextColors, withDarkMode } from '@/lib/colors';

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="p-8">
      <h1 className={`text-3xl font-bold ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>{t('pages.dashboard.title')}</h1>
      <p className={`mt-4 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('pages.dashboard.welcome')}</p>
    </div>
  );
}
