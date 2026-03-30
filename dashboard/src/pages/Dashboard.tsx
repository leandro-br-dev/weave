import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('pages.dashboard.title')}</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-400">{t('pages.dashboard.welcome')}</p>
    </div>
  );
}
