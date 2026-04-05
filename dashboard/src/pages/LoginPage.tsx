import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, Bot } from 'lucide-react';
import { LoginHeader } from '@/components/LoginHeader';
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
import type { ApiError } from '@/api/client';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, hasUsers, canResetPassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(password);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401 || apiErr.status === 403) {
        setError(t('auth.login.error.invalidCredentials'));
      } else if (apiErr.message) {
        setError(apiErr.message);
      } else {
        setError(t('auth.login.error.unknownError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <LoginHeader />
      <div className={`min-h-screen flex items-center justify-center px-4 pt-16 ${withDarkMode(bgColors.tertiary, darkModeBgColors.primary)}`}>
        <div className="w-full max-w-md">
          {/* App Title / Logo */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${accentColors.bg} mb-4`}>
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h1 className={`text-2xl font-bold ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
              {t('common.app.title')}
            </h1>
          </div>

          {/* Login Card */}
          <div className={`rounded-xl border p-8 ${withDarkMode(`${bgColors.secondary} ${borderColors.default}`, `${darkModeBgColors.secondary} ${darkModeBorderColors.default}`)}`}>
            <div className="text-center mb-6">
              <h2 className={`text-xl font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                {t('auth.login.title')}
              </h2>
              <p className={`text-sm mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.muted)}`}>
                {t('auth.login.description')}
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Password */}
              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-1 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                  {t('auth.login.password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.login.passwordPlaceholder')}
                    required
                    autoFocus
                    autoComplete="current-password"
                    disabled={isLoading}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${withDarkMode(`bg-gray-50 ${borderColors.thick} text-gray-900 placeholder-gray-400`, `bg-gray-700 ${darkModeBorderColors.thick} text-white placeholder-gray-400`)}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${withDarkMode('text-gray-400 hover:text-gray-600', 'text-gray-400 hover:text-gray-300')}`}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !password}
                className={`w-full py-2.5 px-4 ${accentColors.bg} ${accentColors.hoverBg} disabled:bg-orange-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('auth.login.submitting')}
                  </>
                ) : (
                  t('auth.login.submitButton')
                )}
              </button>
            </form>

            {/* Reset Password link — only visible on localhost */}
            {canResetPassword && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/reset-password')}
                  className={`text-sm transition-colors ${withDarkMode('text-gray-500 hover:text-gray-700', 'text-gray-400 hover:text-gray-300')}`}
                >
                  {t('auth.login.resetPassword')}
                </button>
              </div>
            )}
          </div>

          {/* Setup Link — shown when no users exist yet */}
          {!hasUsers && (
            <div className="text-center mt-6">
              <p className={`text-sm mb-2 ${withDarkMode(textColors.tertiary, darkModeTextColors.muted)}`}>
                {t('auth.common.noUsersYet')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/setup')}
                className={`text-sm font-medium ${withDarkMode(accentColors.text, darkModeAccentColors.textOnDark)} hover:text-orange-700 transition-colors`}
              >
                {t('auth.common.goToSetup')} →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
