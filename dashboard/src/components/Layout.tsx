import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { Settings, Users, Workflow, AlertCircle, FolderOpen, Zap, MessageSquare, LayoutGrid, Package, X, Menu, LogOut, UserCircle, ChevronRight, Palette, Globe, Sun, Moon, Monitor, Check, MessageCircleQuestion, Plus, MessageCircle, Search } from 'lucide-react'
import { useGetPendingApprovals } from '@/api/approvals'
import { useGetPendingUserInputs } from '@/api/user_inputs'
import { useGetSessions, useGetUnreadCount } from '@/api/sessions'
import { useGetWorkspaces } from '@/api/teams'
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
  const navigate = useNavigate()
  const { data: pendingApprovals = [] } = useGetPendingApprovals()
  const { data: pendingUserInputs = [] } = useGetPendingUserInputs()
  const { data: unreadData } = useGetUnreadCount()
  const { data: sessions = [] } = useGetSessions()
  const { data: workspaces = [] } = useGetWorkspaces()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showQuickAction, setShowQuickAction] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileChatPanel, setMobileChatPanel] = useState(false)
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

  const handleMobileNavClick = (href: string) => {
    navigate(href)
    setMobileMenuOpen(false)
  }

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

      {/* Sidebar - Mobile only: compact icon-only rail (w-16) */}
      <aside className={`
        fixed inset-y-0 left-0 z-40
        w-16 text-white
        flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:hidden
        ${withDarkMode(sidebarColors.bg, darkModeSidebarColors.bg)}
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-center py-4 flex-shrink-0">
          <img src={weaveLogo} alt="Weave" className="h-8 w-8" />
        </div>

        {/* Navigation items — icon only */}
        <nav className="flex-1 flex flex-col items-center gap-1 mt-2 overflow-y-auto hide-scrollbar">
          {/* Quick Action */}
          <MobileRailButton
            icon={<Zap size={20} fill="currentColor" />}
            isActive={false}
            isQuickAction
            onClick={() => { setShowQuickAction(true); setMobileMenuOpen(false) }}
          />
          <MobileRailButton
            icon={<Workflow size={20} />}
            label={t('common.navigation.workflows')}
            isActive={location.pathname === '/' || location.pathname === '/workflows'}
            onClick={() => handleMobileNavClick('/workflows')}
          />
          <MobileRailButton
            icon={<FolderOpen size={20} />}
            label={t('common.navigation.projects')}
            isActive={location.pathname === '/projects'}
            onClick={() => handleMobileNavClick('/projects')}
          />
          <MobileRailButton
            icon={<LayoutGrid size={20} />}
            label={t('common.navigation.kanban')}
            isActive={location.pathname === '/kanban'}
            onClick={() => handleMobileNavClick('/kanban')}
          />
          <MobileRailButton
            icon={<Users size={20} />}
            label={t('common.navigation.agents')}
            isActive={location.pathname === '/agents'}
            onClick={() => handleMobileNavClick('/agents')}
          />
          <MobileRailButton
            icon={<MessageSquare size={20} />}
            label={t('common.navigation.chat')}
            isActive={location.pathname.startsWith('/chat') || mobileChatPanel}
            onClick={() => setMobileChatPanel(!mobileChatPanel)}
            badge={(unreadData?.count ?? 0) > 0 ? unreadData?.count : undefined}
          />
          <MobileRailButton
            icon={<AlertCircle size={20} />}
            label={t('common.navigation.approvals')}
            isActive={location.pathname === '/approvals'}
            onClick={() => handleMobileNavClick('/approvals')}
            badge={pendingApprovals.length > 0 ? pendingApprovals.length : undefined}
          />
          <MobileRailButton
            icon={<MessageCircleQuestion size={20} />}
            label={t('common.navigation.userInputs')}
            isActive={location.pathname === '/user-inputs'}
            onClick={() => handleMobileNavClick('/user-inputs')}
            badge={pendingUserInputs.length > 0 ? pendingUserInputs.length : undefined}
          />
          <MobileRailButton
            icon={<Package size={20} />}
            label={t('common.navigation.marketplace')}
            isActive={location.pathname === '/marketplace'}
            onClick={() => handleMobileNavClick('/marketplace')}
          />
        </nav>

        {/* Bottom: User avatar button */}
        <div className={`border-t ${withDarkMode(sidebarColors.divider, darkModeSidebarColors.divider)} p-2 flex-shrink-0`} ref={userMenuRef}>
          <div className="relative">
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen)
                setThemeMenuOpen(false)
                setLanguageMenuOpen(false)
              }}
              className={`w-12 h-12 mx-auto rounded-lg flex items-center justify-center transition-colors cursor-pointer ${withDarkMode(sidebarColors.text, darkModeSidebarColors.text)} hover:text-white ${withDarkMode(sidebarColors.hoverItem, darkModeSidebarColors.hoverItem)}`}
              aria-label={user?.username || 'User'}
            >
              <div className={`w-8 h-8 rounded-full ${withDarkMode(accentColors.solid, accentColors.solid)} flex items-center justify-center`}>
                <span className="text-xs font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-full mb-2 ml-2 bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-50 min-w-[180px]">
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
      </aside>

      {/* Mobile Chat Panel — slide-out from rail */}
      {mobileChatPanel && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setMobileChatPanel(false)}
          />
          <div className={`
            lg:hidden fixed top-0 bottom-0 z-50
            w-72
            ${withDarkMode(sidebarColors.bg, darkModeSidebarColors.bg)}
            shadow-2xl flex-col animate-slide-in
          `}
          style={{ left: '4rem' }}
          >
            <MobileChatPanel
              sessions={sessions}
              workspaces={workspaces}
              onSelectSession={(id) => { setMobileChatPanel(false); setMobileMenuOpen(false); navigate(`/chat/${id}`) }}
              onClose={() => setMobileChatPanel(false)}
              onNewChat={() => {
                setMobileChatPanel(false)
                setMobileMenuOpen(false)
                navigate('/chat?new=true')
              }}
              onAllConversations={() => { setMobileChatPanel(false); setMobileMenuOpen(false); navigate('/chat') }}
              t={t}
            />
          </div>
        </>
      )}

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

function MobileRailButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
  isQuickAction,
}: {
  icon: React.ReactNode
  label?: string
  isActive?: boolean
  onClick: () => void
  badge?: number
  isQuickAction?: boolean
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`
          w-12 h-12 mx-auto rounded-lg flex items-center justify-center
          transition-colors cursor-pointer flex-shrink-0
          ${isQuickAction
            ? `bg-gradient-to-b ${withDarkMode(accentColors.gradientFrom, darkModeAccentColors.gradientFrom)} ${withDarkMode(accentColors.gradientTo, darkModeAccentColors.gradientTo)} text-white hover:from-amber-600 hover:to-orange-700 shadow-md`
            : isActive
              ? `${withDarkMode(sidebarColors.activeItem ?? 'bg-gray-800 text-white', darkModeSidebarColors.activeItem ?? 'dark:bg-gray-800 dark:text-white')}`
              : `${withDarkMode(sidebarColors.text ?? 'text-gray-300', darkModeSidebarColors.text ?? 'dark:text-gray-300')} ${withDarkMode(sidebarColors.hoverItem ?? 'hover:bg-gray-800', darkModeSidebarColors.hoverItem ?? 'dark:hover:bg-gray-800')} hover:text-white`
          }
        `}
        aria-label={label}
      >
        <span className="relative flex items-center justify-center">
          {icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
      </button>

      {/* Tooltip — shows label on long press / hover */}
      {label && (
        <div
          className="
            pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2
            bg-gray-900 dark:bg-gray-700
            text-white
            text-xs rounded-md px-2 py-1 whitespace-nowrap shadow-lg
            opacity-0 group-hover:opacity-100 transition-opacity z-50
          "
        >
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
        </div>
      )}
    </div>
  )
}

function MobileChatPanel({
  sessions,
  workspaces: _workspaces,
  onSelectSession,
  onClose,
  onNewChat,
  onAllConversations,
  t,
}: {
  sessions: any[]
  workspaces: any[]
  onSelectSession: (id: string) => void
  onClose: () => void
  onNewChat: () => void
  onAllConversations: () => void
  t: (key: string, opts?: any) => string
}) {
  const recentSessions = sessions.slice(0, 10)

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-orange-400" />
          <h2 className="text-sm font-semibold text-white">{t('common.navigation.chat')}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* New Chat button */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <button
          onClick={onNewChat}
          className="
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            text-xs font-medium transition-colors cursor-pointer
            bg-gradient-to-b from-amber-500 to-orange-600 text-white
            hover:from-amber-600 hover:to-orange-700
            shadow-md
          "
        >
          <Plus size={14} />
          {t('pages.chat.newChat')}
        </button>
      </div>

      {/* Recent conversations list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
          {t('pages.chat.panel.recentConversations')}
        </p>
        {recentSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <MessageCircle size={32} strokeWidth={1} />
            <p className="text-xs mt-2">{t('pages.chat.noConversations')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentSessions.map((session: any) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {session.source_type === 'workflow' && (
                      <span title={t('pages.chat.fromWorkflow')}>
                        <Zap className="h-3 w-3 text-purple-400 flex-shrink-0" />
                      </span>
                    )}
                    <p className="text-xs text-gray-200 truncate">
                      {session.name || `Session ${session.id.slice(0, 8)}`}
                    </p>
                    {session.status === 'running' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500">
                    {session.updated_at ? formatTime(session.updated_at) : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* All Conversations button */}
      {sessions.length > 10 && (
        <div className="px-4 py-3 border-t border-gray-800 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onAllConversations}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 hover:text-orange-400 bg-gray-800 dark:bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            <Search size={14} />
            {t('pages.chat.panel.allConversations')}
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  )
}
