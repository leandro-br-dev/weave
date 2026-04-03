import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2, Bot, AlertTriangle } from 'lucide-react';
import type { ApiError } from '@/api/client';

export default function SetupPage() {
  const { t } = useTranslation();
  const { setup } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!password) {
      errors.password = t('auth.setup.validation.passwordRequired');
    } else if (password.length < 6) {
      errors.password = t('auth.setup.validation.passwordMinLength', { min: 6 });
    }

    if (!confirmPassword) {
      errors.confirmPassword = t('auth.setup.validation.confirmPasswordRequired');
    } else if (password !== confirmPassword) {
      errors.confirmPassword = t('auth.setup.validation.passwordsDoNotMatch');
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsLoading(true);

    try {
      await setup(password, confirmPassword);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.message) {
        setError(apiErr.message);
      } else {
        setError(t('auth.setup.error.unknownError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* App Title / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-600 mb-4">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {t('common.app.title')}
          </h1>
        </div>

        {/* Setup Card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              {t('auth.setup.title')}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {t('auth.setup.description')}
            </p>
          </div>

          {/* Warning */}
          <div className="mb-6 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-400">
                  {t('auth.setup.warning.title')}
                </p>
                <p className="text-xs text-yellow-400/80 mt-0.5">
                  {t('auth.setup.warning.message')}
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password */}
            <div>
              <label htmlFor="setup-password" className="block text-sm font-medium text-gray-300 mb-1">
                {t('auth.setup.password')}
              </label>
              <div className="relative">
                <input
                  id="setup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) {
                      setValidationErrors((prev) => {
                        const { password: _, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  placeholder={t('auth.setup.passwordPlaceholder')}
                  required
                  autoFocus
                  autoComplete="new-password"
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${
                    validationErrors.password ? 'border-red-500' : 'border-gray-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="setup-confirm-password" className="block text-sm font-medium text-gray-300 mb-1">
                {t('auth.setup.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="setup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (validationErrors.confirmPassword) {
                      setValidationErrors((prev) => {
                        const { confirmPassword: _, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  placeholder={t('auth.setup.confirmPasswordPlaceholder')}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${
                    validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-600'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('auth.setup.creating')}
                </>
              ) : (
                t('auth.setup.createButton')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
