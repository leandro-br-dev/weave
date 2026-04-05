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

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const MIN_PASSWORD_LENGTH = 6;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.userManagement.resetPassword.validation.passwordMinLength', { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.userManagement.resetPassword.validation.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(newPassword, confirmPassword);
      setIsSuccess(true);
    } catch {
      setError(t('auth.userManagement.resetPassword.error.failed'));
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

          {/* Reset Password Card */}
          <div className={`rounded-xl border p-8 ${withDarkMode(`${bgColors.secondary} ${borderColors.default}`, `${darkModeBgColors.secondary} ${darkModeBorderColors.default}`)}`}>
            <div className="text-center mb-6">
              <h2 className={`text-xl font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                {t('auth.userManagement.resetPassword.title')}
              </h2>
              <p className={`text-sm mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.muted)}`}>
                {t('auth.userManagement.resetPassword.description')}
              </p>
            </div>

            {/* Success Display */}
            {isSuccess ? (
              <div className="text-center space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded-lg text-sm text-green-600 dark:text-green-300">
                  {t('auth.userManagement.resetPassword.success')}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className={`text-sm font-medium ${withDarkMode(accentColors.text, darkModeAccentColors.textOnDark)} hover:text-orange-700 transition-colors`}
                >
                  {t('auth.common.goToLogin')} →
                </button>
              </div>
            ) : (
              <>
                {/* Error Display */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label htmlFor="newPassword" className={`block text-sm font-medium mb-1 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                      {t('auth.userManagement.resetPassword.newPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t('auth.userManagement.resetPassword.newPasswordPlaceholder')}
                        required
                        autoFocus
                        autoComplete="new-password"
                        disabled={isLoading}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${withDarkMode(`bg-gray-50 ${borderColors.thick} text-gray-900 placeholder-gray-400`, `bg-gray-700 ${darkModeBorderColors.thick} text-white placeholder-gray-400`)}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${withDarkMode('text-gray-400 hover:text-gray-600', 'text-gray-400 hover:text-gray-300')}`}
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-1 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                      {t('auth.userManagement.resetPassword.confirmPassword')}
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('auth.userManagement.resetPassword.confirmPasswordPlaceholder')}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${withDarkMode(`bg-gray-50 ${borderColors.thick} text-gray-900 placeholder-gray-400`, `bg-gray-700 ${darkModeBorderColors.thick} text-white placeholder-gray-400`)}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${withDarkMode('text-gray-400 hover:text-gray-600', 'text-gray-400 hover:text-gray-300')}`}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || !newPassword || !confirmPassword}
                    className={`w-full py-2.5 px-4 ${accentColors.bg} ${accentColors.hoverBg} disabled:bg-orange-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('auth.userManagement.resetPassword.submitting')}
                      </>
                    ) : (
                      t('auth.userManagement.resetPassword.submitButton')
                    )}
                  </button>
                </form>

                {/* Back to Login */}
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className={`text-sm transition-colors ${withDarkMode('text-gray-500 hover:text-gray-700', 'text-gray-400 hover:text-gray-300')}`}
                  >
                    {t('common.buttons.back')} — {t('auth.common.goToLogin')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
