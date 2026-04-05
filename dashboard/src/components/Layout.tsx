import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { Settings, Users, Workflow, AlertCircle, FolderOpen, Zap, MessageSquare, LayoutGrid, Package, X, Menu, LogOut, UserCircle, ChevronUp, Palette, Globe, Sun, Moon, Monitor, Check } from 'lucide-react'
import { useGetPendingApprovals } from '@/api/approvals'
import { QuickActionModal } from '@/components/QuickActionModal'
import NavigationRail from '@/components/NavigationRail'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import weaveLogo from '@/assets/weave-logo.svg'
import {
  sidebarColors,
  darkModeSidebarColors,
  bgColors,
  darkModeBgColors,
  accentColors,
  darkModeAccentColors,
  withDarkMode,
} from '@/lib/colors'

export default function Layout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { data: pendingApprovals = [] } = useGetPendingApprovals()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showQuickAction, setShowQuickAction] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const languageMenuRef = useRef<HTMLDivElement>(null)

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('common.common.themeLight') },
    { value: 'dark' as const, icon: Moon, label: t('common.common.themeDark') },
    { value: 'system' as const, icon: Monitor, label: t('common.common.themeSystem') },
  ]

  const languageOptions = [
    { code: 'en-US', flag: '🇺🇸', nativeName: 'English' },
    { code: 'pt-BR', flag: '🇧🇷', nativeName: 'Português' },
  ]

  // Expose close function globally for NavItem
  if (typeof window !== 'undefined') {
    (window as any).closeMobileMenu = () => setMobileMenuOpen(false)
  }

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
        setThemeMenuOpen(false)
        setLanguageMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Close menus on route change
  useEffect(() => {
    setUserMenuOpen(false)
    setThemeMenuOpen(false)
    setLanguageMenuOpen(false)
  }, [location.pathname])

  return (
    <div className={`flex h-screen ${withDarkMode(bgColors.primary, darkModeBgColors.primary)}`}>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className={`lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg transition-colors ${withDarkMode(sidebarColors.bg, 'dark:bg-gray-800')} text-white hover:bg-gray-700 dark:hover:bg-gray-700`}
        aria-label={t('common.app.toggleMenu')}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar / Navigation Rail - Desktop only */}
      <NavigationRail onQuickAction={() => setShowQuickAction(true)} onCollapsedChange={setSidebarCollapsed} />

      {/* Sidebar - Mobile only (hidden on desktop, rail replaces it) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40
        w-64 text-white
        transform transition-transform duration-300 ease-in-out
        lg:hidden
        ${withDarkMode(sidebarColors.bg, darkModeSidebarColors.bg)}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center gap-3">
          <img src={weaveLogo} alt="Weave" className="h-8 w-8" />
          <h1 className="text-xl font-bold">{t('common.app.title')}</h1>
        </div>
        <nav className="mt-6">
          {/* Quick Action - First item with special highlight */}
          <button
            onClick={() => setShowQuickAction(true)}
            className={`w-full flex items-center gap-3 px-6 py-3 text-white bg-gradient-to-r ${accentColors.gradientFrom} ${accentColors.gradientTo} ${darkModeAccentColors.gradientFrom} ${darkModeAccentColors.gradientTo} hover:from-amber-600 hover:to-orange-700 transition-all border-l-4 border-amber-300 shadow-md`}
          >
            <Zap className="h-5 w-5" fill="currentColor" />
            <span className="font-semibold">{t('common.navigation.quickAction')}</span>
          </button>

          <NavItem icon={<Workflow size={20} />} label={t('common.navigation.workflows')} href="/" isActive={location.pathname === '/' || location.pathname === '/workflows'} />
          <NavItem icon={<FolderOpen size={20} />} label={t('common.navigation.projects')} href="/projects" isActive={location.pathname === '/projects'} />
          <NavItem icon={<LayoutGrid size={20} />} label={t('common.navigation.kanban')} href="/kanban" isActive={location.pathname === '/kanban'} />
          <NavItem icon={<Users size={20} />} label={t('common.navigation.agents')} href="/agents" isActive={location.pathname === '/agents'} />
          <NavItem icon={<MessageSquare size={20} />} label={t('common.navigation.chat')} href="/chat" isActive={location.pathname === '/chat'} />
          <NavItem
            icon={<AlertCircle size={20} />}
            label={t('common.navigation.approvals')}
            href="/approvals"
            isActive={location.pathname === '/approvals'}
            badge={pendingApprovals.length > 0 ? pendingApprovals.length : undefined}
          />
          <NavItem icon={<Package size={20} />} label={t('common.navigation.marketplace')} href="/marketplace" isActive={location.pathname === '/marketplace'} />
        </nav>

        {/* Bottom section: User menu (theme, language, settings) */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3" ref={userMenuRef}>
          <div className="relative">
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen)
                setThemeMenuOpen(false)
                setLanguageMenuOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${withDarkMode(sidebarColors.text, darkModeSidebarColors.text)} hover:text-white ${withDarkMode(sidebarColors.hoverItem, darkModeSidebarColors.hoverItem)} transition-colors`}
            >
              <div className={`w-8 h-8 rounded-full ${withDarkMode(accentColors.solid, accentColors.solid)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-xs font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-sm font-medium truncate flex-1 text-left">
                {user?.username || 'User'}
              </span>
              <ChevronUp size={14} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className={`absolute bottom-full left-0 right-0 mb-1 bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-50`}>
                {/* Theme sub-menu */}
                <div className="relative" ref={themeMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setThemeMenuOpen(!themeMenuOpen)
                      setLanguageMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Palette size={16} />
                    <span className="flex-1 text-left">{t('common.common.theme')}</span>
                    <span className="text-xs text-gray-500">
                      {theme === 'light' ? t('common.common.themeLight') : theme === 'dark' ? t('common.common.themeDark') : t('common.common.themeSystem')}
                    </span>
                  </button>

                  {themeMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-[60]">
                      {themeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setTheme(opt.value); setThemeMenuOpen(false) }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                            theme === opt.value
                              ? 'text-orange-400 bg-gray-700'
                              : 'text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700'
                          } transition-colors`}
                        >
                          <opt.icon size={16} />
                          <span>{opt.label}</span>
                          {theme === opt.value && <Check size={14} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Language sub-menu */}
                <div className="relative" ref={languageMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLanguageMenuOpen(!languageMenuOpen)
                      setThemeMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Globe size={16} />
                    <span className="flex-1 text-left">{t('common.common.language')}</span>
                    <span className="text-xs text-gray-500">
                      {i18n.language === 'pt-BR' ? '🇧🇷' : '🇺🇸'}
                    </span>
                  </button>

                  {languageMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-[60]">
                      {languageOptions.map((opt) => (
                        <button
                          key={opt.code}
                          onClick={() => { i18n.changeLanguage(opt.code); setLanguageMenuOpen(false) }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                            i18n.language === opt.code
                              ? 'text-orange-400 bg-gray-700'
                              : 'text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700'
                          } transition-colors`}
                        >
                          <span>{opt.flag}</span>
                          <span>{opt.nativeName}</span>
                          {i18n.language === opt.code && <Check size={14} className="ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-700 dark:border-gray-800 my-1" />

                {/* Settings link */}
                <Link
                  to="/settings"
                  onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false) }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm ${sidebarColors.text} hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors`}
                >
                  <Settings size={16} />
                  <span>{t('common.common.settings')}</span>
                </Link>

                {/* User management link */}
                <Link
                  to="/users"
                  onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false) }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm ${sidebarColors.text} hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors`}
                >
                  <UserCircle size={16} />
                  <span>{t('auth.userManagement.title')}</span>
                </Link>

                {/* Divider */}
                <div className="border-t border-gray-700 dark:border-gray-800 my-1" />

                {/* Logout */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    setMobileMenuOpen(false)
                    logout()
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${sidebarColors.text} hover:text-red-400 hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors`}
                >
                  <LogOut size={16} />
                  <span>{t('auth.userManagement.logout.button')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className={`lg:hidden absolute bottom-4 right-4 p-2 ${withDarkMode(sidebarColors.text, darkModeSidebarColors.text)} hover:text-white transition-colors`}
          aria-label={t('common.app.closeMenu')}
        >
          <X size={20} />
        </button>
      </aside>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      {(() => {
        const isFullHeightPage = location.pathname === '/chat' || location.pathname === '/kanban' || location.pathname === '/marketplace'
        return (
          <main className={`flex-1 ${isFullHeightPage ? 'overflow-hidden' : 'overflow-auto'} font-sans relative transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} ${withDarkMode(bgColors.primary, darkModeBgColors.primary)}`}>
            <div className={`pt-16 lg:pt-0 ${isFullHeightPage ? 'h-full' : ''}`}>
              <Outlet />
            </div>
          </main>
        )
      })()}

      {/* Quick Action Modal */}
      {showQuickAction && <QuickActionModal onClose={() => setShowQuickAction(false)} />}
    </div>
  )
}

function NavItem({
  icon,
  label,
  href,
  isActive,
  badge
}: {
  icon: React.ReactNode
  label: string
  href: string
  isActive?: boolean
  badge?: number
}) {
  return (
    <Link
      to={href}
      onClick={() => {
        // Close mobile menu after navigation
        const sidebar = document.querySelector('aside')
        if (sidebar && window.innerWidth < 1024) {
          (window as any).closeMobileMenu?.()
        }
      }}
      className={`flex items-center justify-between gap-3 px-6 py-3 transition-colors ${
        isActive
          ? `${withDarkMode(sidebarColors.activeItem, darkModeSidebarColors.activeItem)} border-l-4 ${withDarkMode(accentColors.border, darkModeAccentColors.border)}`
          : `${withDarkMode(sidebarColors.text, darkModeSidebarColors.text)} border-l-4 border-transparent ${withDarkMode(sidebarColors.hoverItem, darkModeSidebarColors.hoverItem)} hover:text-white dark:hover:text-gray-200`
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm sm:text-base">{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[24px] text-center font-semibold">
          {badge}
        </span>
      )}
    </Link>
  )
}
