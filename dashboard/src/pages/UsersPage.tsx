import { useState, type FormEvent } from 'react'
import { PageHeader, Card } from '@/components'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2, UserCircle, Shield, Save } from 'lucide-react'
import {
  textColors, darkModeTextColors, bgColors, darkModeBgColors,
  borderColors, darkModeBorderColors, accentColors,
  successColors, darkModeSuccessColors, errorColors, darkModeErrorColors,
  interactiveStates, withDarkMode
} from '@/lib/colors'

export default function UsersPage() {
  const { t } = useTranslation()
  const { user, changePassword } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const MIN_PASSWORD_LENGTH = 6

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.userManagement.changePassword.validation.passwordMinLength', { min: MIN_PASSWORD_LENGTH }))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.userManagement.changePassword.validation.passwordsDoNotMatch'))
      return
    }

    setIsLoading(true)

    try {
      await changePassword(currentPassword, newPassword, confirmPassword)
      setSuccess(true)
      resetForm()
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.message?.includes('incorrect') || err?.message?.includes('wrong')) {
        setError(t('auth.userManagement.changePassword.error.incorrectPassword'))
      } else {
        setError(t('auth.userManagement.changePassword.error.failed'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={withDarkMode(bgColors.primary, darkModeBgColors.primary)}>
      <div className="max-w-3xl mx-auto px-4 py-8 lg:px-8">
        <PageHeader title={t('auth.userManagement.title')} />

        {/* Current User Info Card */}
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full ${accentColors.solid} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-lg font-bold ${textColors.inverted}`}>
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                {t('auth.userManagement.currentUser')}
              </h3>
              <p className={`text-base font-medium ${withDarkMode('text-gray-800', 'dark:text-gray-200')} mt-0.5`}>
                {user?.username || 'User'}
              </p>
            </div>
            <div className="ml-auto">
              <UserCircle size={24} className={withDarkMode(textColors.muted, darkModeTextColors.muted)} />
            </div>
          </div>
        </Card>

        {/* Change Password Card */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} />
            <h3 className={`text-sm font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
              {t('auth.userManagement.changePassword.title')}
            </h3>
          </div>

          {/* Success Message */}
          {success && (
            <div className={`mb-4 p-3 ${successColors.bg} ${darkModeSuccessColors.bg} ${successColors.border} ${darkModeSuccessColors.border} rounded-lg text-sm ${successColors.text} ${darkModeSuccessColors.text}`}>
              {t('auth.userManagement.changePassword.success')}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`mb-4 p-3 ${errorColors.bg} ${darkModeErrorColors.bg} ${errorColors.border} ${darkModeErrorColors.border} rounded-lg text-sm ${errorColors.text} ${darkModeErrorColors.text}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
                {t('auth.userManagement.changePassword.currentPassword')}
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setError(null); setSuccess(false) }}
                  placeholder={t('auth.userManagement.changePassword.currentPasswordPlaceholder')}
                  required
                  autoFocus
                  autoComplete="current-password"
                  disabled={isLoading}
                  className={`w-full border ${borderColors.thick} ${darkModeBorderColors.thick} rounded-md px-3 py-2 text-sm ${bgColors.secondary} ${darkModeBgColors.secondary} ${textColors.primary} ${darkModeTextColors.primary} placeholder:${textColors.muted} dark:placeholder:${darkModeTextColors.muted} focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent disabled:${bgColors.primary} dark:disabled:${darkModeBgColors.primary} disabled:${textColors.muted} dark:disabled:${darkModeTextColors.muted} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${textColors.muted} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} transition-colors`}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
                {t('auth.userManagement.changePassword.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(null); setSuccess(false) }}
                  placeholder={t('auth.userManagement.changePassword.newPasswordPlaceholder')}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  className={`w-full border ${borderColors.thick} ${darkModeBorderColors.thick} rounded-md px-3 py-2 text-sm ${bgColors.secondary} ${darkModeBgColors.secondary} ${textColors.primary} ${darkModeTextColors.primary} placeholder:${textColors.muted} dark:placeholder:${darkModeTextColors.muted} focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent disabled:${bgColors.primary} dark:disabled:${darkModeBgColors.primary} disabled:${textColors.muted} dark:disabled:${darkModeTextColors.muted} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${textColors.muted} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} transition-colors`}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="confirmNewPassword" className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>
                {t('auth.userManagement.changePassword.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="confirmNewPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null); setSuccess(false) }}
                  placeholder={t('auth.userManagement.changePassword.confirmPasswordPlaceholder')}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  className={`w-full border ${borderColors.thick} ${darkModeBorderColors.thick} rounded-md px-3 py-2 text-sm ${bgColors.secondary} ${darkModeBgColors.secondary} ${textColors.primary} ${darkModeTextColors.primary} placeholder:${textColors.muted} dark:placeholder:${darkModeTextColors.muted} focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent disabled:${bgColors.primary} dark:disabled:${darkModeBgColors.primary} disabled:${textColors.muted} dark:disabled:${darkModeTextColors.muted} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${textColors.muted} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')} transition-colors`}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                className={`inline-flex items-center gap-2 px-4 py-2 ${accentColors.bg} ${accentColors.hoverBg} disabled:bg-orange-300 dark:disabled:bg-orange-800 disabled:cursor-not-allowed ${textColors.inverted} font-medium rounded-lg transition-colors text-sm`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('auth.userManagement.changePassword.submitting')}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('auth.userManagement.changePassword.submitButton')}
                  </>
                )}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
