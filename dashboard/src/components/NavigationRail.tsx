import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Settings, Users, Workflow, AlertCircle, FolderOpen, Zap, MessageSquare,
  LayoutGrid, Package, LogOut, UserCircle, Sun, Moon, Monitor, Check,
  ChevronRight, X, MessageCircle, FolderGit2, Globe, Search,
  Bot, ShieldCheck, Store, ChevronLeft, Palette, Plus, MessageCircleQuestion
} from 'lucide-react'
import { useGetPendingApprovals } from '@/api/approvals'
import { useGetPendingUserInputs } from '@/api/user_inputs'
import { useGetProjects } from '@/api/projects'
import { useGetSessions, useGetUnreadCount } from '@/api/sessions'
import { useGetWorkspaces } from '@/api/teams'
import { useGetPlans } from '@/api/plans'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import weaveLogo from '@/assets/weave-logo.svg'
import {
  sidebarColors,
  darkModeSidebarColors,
  accentColors,
  darkModeAccentColors,
  withDarkMode,
} from '@/lib/colors'
import { useAutoPosition } from '@/lib/useAutoPosition'

type PanelType = 'chat' | 'approvals' | 'workflows' | 'projects' | 'kanban' | 'agents' | 'marketplace' | null

interface NavigationRailProps {
  onQuickAction: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

export default function NavigationRail({ onQuickAction, onCollapsedChange }: NavigationRailProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: pendingApprovals = [] } = useGetPendingApprovals()
  const { data: pendingUserInputs = [] } = useGetPendingUserInputs()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const themeTriggerRef = useRef<HTMLButtonElement>(null)
  const languageTriggerRef = useRef<HTMLButtonElement>(null)
  const themeDropdownRef = useRef<HTMLDivElement>(null)
  const languageDropdownRef = useRef<HTMLDivElement>(null)

  // Auto-positioning for sub-menus (picks best side based on available viewport space)
  const themeAutoPos = useAutoPosition(themeTriggerRef, {
    isOpen: themeMenuOpen,
    preferHorizontal: 'right',
    preferVertical: 'top',
  })
  const languageAutoPos = useAutoPosition(languageTriggerRef, {
    isOpen: languageMenuOpen,
    preferHorizontal: 'right',
    preferVertical: 'top',
  })

  // Fetch data for panels
  const { data: projects = [] } = useGetProjects()
  const { data: sessions = [] } = useGetSessions()
  const { data: unreadData } = useGetUnreadCount()
  const { data: workspaces = [] } = useGetWorkspaces()
  const { data: plans = [] } = useGetPlans()

  // Close panel on outside click
  useEffect(() => {
    if (!activePanel) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
          setActivePanel(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activePanel])

  // Close user menu on outside click (also ignore clicks inside theme/language portals)
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const insideUserMenu = userMenuRef.current?.contains(target)
      const insideThemeDropdown = themeDropdownRef.current?.contains(target)
      const insideLanguageDropdown = languageDropdownRef.current?.contains(target)
      if (!insideUserMenu && !insideThemeDropdown && !insideLanguageDropdown) {
        setUserMenuOpen(false)
        setThemeMenuOpen(false)
        setLanguageMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Close theme menu on outside click (includes portal dropdown)
  useEffect(() => {
    if (!themeMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const insideTrigger = themeMenuRef.current?.contains(target)
      const insideDropdown = themeDropdownRef.current?.contains(target)
      if (!insideTrigger && !insideDropdown) {
        setThemeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [themeMenuOpen])

  // Close language menu on outside click (includes portal dropdown)
  useEffect(() => {
    if (!languageMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const insideTrigger = languageMenuRef.current?.contains(target)
      const insideDropdown = languageDropdownRef.current?.contains(target)
      if (!insideTrigger && !insideDropdown) {
        setLanguageMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [languageMenuOpen])

  // Close menus on route change
  useEffect(() => {
    setActivePanel(null)
    setUserMenuOpen(false)
    setThemeMenuOpen(false)
    setLanguageMenuOpen(false)
  }, [location.pathname])

  // Notify layout of collapsed state changes
  useEffect(() => {
    onCollapsedChange?.(collapsed)
  }, [collapsed, onCollapsedChange])

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: t('common.common.themeLight') },
    { value: 'dark' as const, icon: Moon, label: t('common.common.themeDark') },
    { value: 'system' as const, icon: Monitor, label: t('common.common.themeSystem') },
  ]

  const languageOptions = [
    { code: 'en-US', flag: '🇺🇸', nativeName: 'English', localName: 'English' },
    { code: 'pt-BR', flag: '🇧🇷', nativeName: 'Português', localName: 'Portuguese' },
  ]

  const pendingBadge = pendingApprovals.length > 0 ? pendingApprovals.length : undefined

  const handleNavClick = useCallback((href: string) => {
    navigate(href)
  }, [navigate])

  const handleInfoClick = useCallback((panel: PanelType) => {
    if (activePanel === panel) {
      setActivePanel(null)
    } else {
      setActivePanel(panel)
    }
  }, [activePanel])

  return (
    <>
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          hidden lg:flex flex-col
          fixed inset-y-0 left-0 z-40
          text-white
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-64'}
          overflow-hidden
          ${withDarkMode(sidebarColors.bg, darkModeSidebarColors.bg)}
        `}
      >
        {/* Logo / Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} py-4 flex-shrink-0`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-3 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer ${collapsed ? 'p-2' : 'px-3 py-2 flex-1'}`}
            aria-label={collapsed ? t('common.app.title') : 'Collapse menu'}
          >
            <img src={weaveLogo} alt="Weave" className="h-8 w-8 flex-shrink-0" />
            {!collapsed && (
              <h1 className="text-lg font-bold truncate">{t('common.app.title')}</h1>
            )}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 flex flex-col gap-1 mt-2 overflow-y-auto overflow-x-hidden hide-scrollbar">
          {/* Quick Action */}
          <SidebarButton
            label={t('common.navigation.quickAction')}
            onClick={() => { setActivePanel(null); onQuickAction() }}
            isQuickAction
            collapsed={collapsed}
          />

          <SidebarButton
            icon={<Workflow size={20} />}
            label={t('common.navigation.workflows')}
            isActive={location.pathname === '/' || location.pathname === '/workflows'}
            onClick={() => handleNavClick('/workflows')}
            onInfoClick={() => handleInfoClick('workflows')}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<FolderOpen size={20} />}
            label={t('common.navigation.projects')}
            isActive={location.pathname === '/projects'}
            onClick={() => handleNavClick('/projects')}
            onInfoClick={() => handleInfoClick('projects')}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<LayoutGrid size={20} />}
            label={t('common.navigation.kanban')}
            isActive={location.pathname === '/kanban'}
            onClick={() => handleNavClick('/kanban')}
            onInfoClick={() => handleInfoClick('kanban')}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<Users size={20} />}
            label={t('common.navigation.agents')}
            isActive={location.pathname === '/agents'}
            onClick={() => handleNavClick('/agents')}
            onInfoClick={() => handleInfoClick('agents')}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<MessageSquare size={20} />}
            label={t('common.navigation.chat')}
            isActive={location.pathname.startsWith('/chat') || activePanel === 'chat'}
            onClick={() => handleInfoClick('chat')}
            collapsed={collapsed}
            badge={(unreadData?.count ?? 0) > 0 ? unreadData?.count : undefined}
          />
          <SidebarButton
            icon={<AlertCircle size={20} />}
            label={t('common.navigation.approvals')}
            isActive={location.pathname === '/approvals'}
            onClick={() => handleNavClick('/approvals')}
            onInfoClick={() => handleInfoClick('approvals')}
            badge={pendingBadge}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<MessageCircleQuestion size={20} />}
            label={t('common.navigation.userInputs')}
            isActive={location.pathname === '/user-inputs'}
            onClick={() => handleNavClick('/user-inputs')}
            badge={pendingUserInputs.length > 0 ? pendingUserInputs.length : undefined}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<Package size={20} />}
            label={t('common.navigation.marketplace')}
            isActive={location.pathname === '/marketplace'}
            onClick={() => handleNavClick('/marketplace')}
            onInfoClick={() => handleInfoClick('marketplace')}
            collapsed={collapsed}
          />
        </nav>

        {/* Bottom section: User menu (theme, language, settings) */}
        <div className={`border-t ${withDarkMode(sidebarColors.divider, darkModeSidebarColors.divider)} px-2 pb-3 pt-2 flex-shrink-0`}>
          <div className="relative" ref={userMenuRef}>
            <SidebarButton
              label={user?.username || 'User'}
              onClick={() => {
                setUserMenuOpen(!userMenuOpen)
                setThemeMenuOpen(false)
                setLanguageMenuOpen(false)
                setActivePanel(null)
              }}
              avatar
              initial={user?.username?.charAt(0).toUpperCase() || 'U'}
              collapsed={collapsed}
            />

            {userMenuOpen && (
              <div className={`absolute ${collapsed ? 'bottom-full left-full mb-2 ml-0' : 'bottom-full left-0 right-0 mb-1'} bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-50 min-w-[180px]`}>
                {/* Theme sub-menu */}
                <div className="relative" ref={themeMenuRef}>
                  <button
                    ref={themeTriggerRef}
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
                </div>

                {/* Language sub-menu */}
                <div className="relative" ref={languageMenuRef}>
                  <button
                    ref={languageTriggerRef}
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
                </div>

                {/* Divider */}
                <div className="border-t border-gray-700 dark:border-gray-800 my-1" />

                {/* Settings link */}
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  <Settings size={16} />
                  <span>{t('common.common.settings')}</span>
                </Link>

                {/* User management link */}
                <Link
                  to="/users"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  <UserCircle size={16} />
                  <span>{t('auth.userManagement.title')}</span>
                </Link>

                {/* Divider */}
                <div className="border-t border-gray-700 dark:border-gray-800 my-1" />

                {/* Logout */}
                <button
                  onClick={() => { setUserMenuOpen(false); logout() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-red-400 hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut size={16} />
                  <span>{t('auth.userManagement.logout.button')}</span>
                </button>
              </div>
            )}

            {/* Theme dropdown — rendered via portal OUTSIDE the userMenuOpen conditional
                so that clicking an option doesn't unmount the portal before onClick fires */}
            {themeMenuOpen && createPortal(
              <div
                ref={themeDropdownRef}
                className="bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-[60] min-w-[140px]"
                style={themeAutoPos.getFixedPositionStyles()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation()
                      setTheme(opt.value)
                      setThemeMenuOpen(false)
                      setUserMenuOpen(false)
                    }}
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
              </div>,
              document.body
            )}

            {/* Language dropdown — rendered via portal OUTSIDE the userMenuOpen conditional */}
            {languageMenuOpen && createPortal(
              <div
                ref={languageDropdownRef}
                className="bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-[60] min-w-[160px]"
                style={languageAutoPos.getFixedPositionStyles()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {languageOptions.map((opt) => (
                  <button
                    key={opt.code}
                    onClick={(e) => {
                      e.stopPropagation()
                      i18n.changeLanguage(opt.code)
                      setLanguageMenuOpen(false)
                      setUserMenuOpen(false)
                    }}
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
              </div>,
              document.body
            )}
          </div>
        </div>

        {/* Collapse toggle at very bottom */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center justify-center p-2 border-t ${withDarkMode(sidebarColors.divider, darkModeSidebarColors.divider)} ${withDarkMode(sidebarColors.text, darkModeSidebarColors.text)} hover:text-white hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer flex-shrink-0`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      {/* ─── Info Panel Overlay (slides out from right edge of sidebar) ─── */}
      {activePanel && (
        <div
          ref={panelRef}
          className={`
            hidden lg:flex
            fixed top-0 bottom-0 z-30
            w-72
            ${withDarkMode(sidebarColors.bg, darkModeSidebarColors.bg)}
            border-r border-gray-800 dark:border-gray-700
            shadow-2xl
            flex-col
            animate-slide-in
          `}
          style={{ left: collapsed ? '4rem' : '16rem' }}
        >
          {activePanel === 'workflows' && (
            <WorkflowsPanel
              plans={plans}
              onNavigate={() => { setActivePanel(null); navigate('/workflows') }}
              onSelectPlan={(id) => { setActivePanel(null); navigate(`/plans/${id}`) }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'projects' && (
            <ProjectsPanel
              projects={projects}
              onNavigate={() => { setActivePanel(null); navigate('/projects') }}
              onSelectProject={(id) => { setActivePanel(null); navigate(`/projects?project=${id}`) }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'kanban' && (
            <KanbanPanel
              projects={projects}
              onNavigate={() => { setActivePanel(null); navigate('/kanban') }}
              onSelectProject={(id) => { setActivePanel(null); navigate(`/kanban?project=${id}`) }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'agents' && (
            <AgentsPanel
              workspaces={workspaces}
              onNavigate={() => { setActivePanel(null); navigate('/agents') }}
              onSelectWorkspace={(id) => { setActivePanel(null); navigate(`/agents?workspace=${id}`) }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'chat' && (
            <ChatPanel
              sessions={sessions}
              onSelectSession={(id) => { setActivePanel(null); navigate(`/chat/${id}`) }}
              onClose={() => setActivePanel(null)}
              t={t}
            />
          )}
          {activePanel === 'approvals' && (
            <ApprovalsPanel
              pendingCount={pendingApprovals.length}
              onNavigate={() => { setActivePanel(null); navigate('/approvals') }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'marketplace' && (
            <MarketplacePanel
              onNavigate={() => { setActivePanel(null); navigate('/marketplace') }}
              onClose={() => setActivePanel(null)}
            />
          )}
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */

function SidebarButton({
  icon,
  label,
  isActive,
  onClick,
  onInfoClick,
  badge,
  avatar,
  initial,
  isQuickAction,
  collapsed,
}: {
  icon?: React.ReactNode
  label: string
  isActive?: boolean
  onClick: () => void
  onInfoClick?: () => void
  badge?: number
  avatar?: boolean
  initial?: string
  isQuickAction?: boolean
  collapsed: boolean
}) {
  return (
    <div className="group relative flex items-stretch">
      {/* Main clickable area */}
      <button
        onClick={() => {
          onClick()
        }}
        className={`
          flex items-center gap-3
          ${collapsed ? 'justify-center w-12 h-12 mx-auto rounded-lg' : 'flex-1 px-4 py-2.5 rounded-lg'}
          transition-colors cursor-pointer flex-shrink-0
          ${isQuickAction
            ? `bg-gradient-to-b ${withDarkMode(accentColors.gradientFrom, darkModeAccentColors.gradientFrom)} ${withDarkMode(accentColors.gradientTo, darkModeAccentColors.gradientTo)} text-white hover:from-amber-600 hover:to-orange-700 shadow-md`
            : isActive
              ? `${withDarkMode(sidebarColors.activeItem ?? 'bg-gray-800 text-white', darkModeSidebarColors.activeItem ?? 'dark:bg-gray-800 dark:text-white')} border-l-2 ${withDarkMode('border-orange-500', 'dark:border-orange-500')}`
              : `${withDarkMode(sidebarColors.text ?? 'text-gray-300', darkModeSidebarColors.text ?? 'dark:text-gray-300')} ${withDarkMode(sidebarColors.hoverItem ?? 'hover:bg-gray-800', darkModeSidebarColors.hoverItem ?? 'dark:hover:bg-gray-800')} hover:text-white`
          }
        `}
      >
        <span className="relative flex items-center justify-center flex-shrink-0">
          {isQuickAction && <Zap size={20} fill="currentColor" />}
          {avatar && (
            <div className={`w-7 h-7 rounded-full ${withDarkMode(accentColors.solid, accentColors.solid)} flex items-center justify-center`}>
              <span className="text-xs font-bold text-white">{initial}</span>
            </div>
          )}
          {!isQuickAction && !avatar && icon}
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>

        {!collapsed && (
          <span className="text-sm font-medium truncate whitespace-nowrap">{label}</span>
        )}
      </button>

      {/* Info button (visible only when expanded and not quick action/avatar) */}
      {!collapsed && onInfoClick && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onInfoClick()
          }}
          className="flex items-center justify-center w-8 flex-shrink-0 text-gray-500 hover:text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer rounded-r-lg"
          aria-label={`Info for ${label}`}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div
          className={`
            pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2
            bg-gray-900 dark:bg-gray-700
            text-white
            text-xs rounded-md px-2 py-1 whitespace-nowrap shadow-lg
            opacity-0 group-hover:opacity-100 transition-opacity z-50
          `}
        >
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANEL HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

function PanelHeader({
  icon,
  title,
  onClose,
}: {
  icon: React.ReactNode
  title: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function PanelFooter({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mt-auto px-4 py-3 border-t border-gray-800 dark:border-gray-700 flex-shrink-0">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 hover:text-orange-400 bg-gray-800 dark:bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
      >
        {label}
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORKFLOWS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function WorkflowsPanel({
  plans,
  onNavigate,
  onSelectPlan,
  onClose,
}: {
  plans: any[]
  onNavigate: () => void
  onSelectPlan: (id: string) => void
  onClose: () => void
}) {
  const recentPlans = plans.slice(0, 8)
  const statusColor: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-400/10',
    running: 'text-blue-400 bg-blue-400/10',
    success: 'text-green-400 bg-green-400/10',
    failed: 'text-red-400 bg-red-400/10',
    error: 'text-red-400 bg-red-400/10',
    awaiting_approval: 'text-orange-400 bg-orange-400/10',
  }

  return (
    <>
      <PanelHeader
        icon={<Workflow size={18} className="text-orange-400" />}
        title="Workflows"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Recent Plans</p>
        {recentPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Workflow size={32} strokeWidth={1} />
            <p className="text-xs mt-2">No workflows yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => onSelectPlan(plan.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">{plan.name || plan.id}</p>
                </div>
                {plan.status && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[plan.status] || 'text-gray-400 bg-gray-400/10'}`}>
                    {plan.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelFooter label="View all workflows" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECTS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function ProjectsPanel({
  projects,
  onNavigate,
  onSelectProject,
  onClose,
}: {
  projects: any[]
  onNavigate: () => void
  onSelectProject: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <PanelHeader
        icon={<FolderOpen size={18} className="text-orange-400" />}
        title="Projects"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Your Projects</p>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <FolderGit2 size={32} strokeWidth={1} />
            <p className="text-xs mt-2">No projects yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {projects.slice(0, 10).map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => onSelectProject(project.id)}
              >
                {project.color && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">{project.name}</p>
                  {project.description && (
                    <p className="text-[10px] text-gray-500 truncate">{project.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelFooter label="View all projects" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   KANBAN PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function KanbanPanel({
  projects,
  onNavigate,
  onSelectProject,
  onClose,
}: {
  projects: any[]
  onNavigate: () => void
  onSelectProject: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <PanelHeader
        icon={<LayoutGrid size={18} className="text-orange-400" />}
        title="Kanban Board"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Boards by Project</p>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <LayoutGrid size={32} strokeWidth={1} />
            <p className="text-xs mt-2">Create a project to see boards</p>
          </div>
        ) : (
          <div className="space-y-1">
            {projects.slice(0, 10).map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => onSelectProject(project.id)}
              >
                {project.color && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">{project.name}</p>
                </div>
                <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelFooter label="Open Kanban" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENTS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function AgentsPanel({
  workspaces,
  onNavigate,
  onSelectWorkspace,
  onClose,
}: {
  workspaces: any[]
  onNavigate: () => void
  onSelectWorkspace: (id: string) => void
  onClose: () => void
}) {
  const roleLabel: Record<string, string> = {
    planner: 'Planner',
    coder: 'Coder',
    reviewer: 'Reviewer',
    tester: 'Tester',
    debugger: 'Debugger',
    devops: 'DevOps',
    generic: 'Agent',
  }

  return (
    <>
      <PanelHeader
        icon={<Users size={18} className="text-orange-400" />}
        title="Teams"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Your Teams</p>
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Bot size={32} strokeWidth={1} />
            <p className="text-xs mt-2">No teams configured</p>
          </div>
        ) : (
          <div className="space-y-1">
            {workspaces.slice(0, 10).map((ws) => (
              <div
                key={ws.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => onSelectWorkspace(ws.id)}
              >
                <Bot size={14} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">{ws.name}</p>
                  {ws.role && (
                    <p className="text-[10px] text-gray-500">{roleLabel[ws.role] || ws.role}</p>
                  )}
                </div>
                <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelFooter label="View all teams" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatPanel({
  sessions,
  onSelectSession,
  onClose,
  t,
}: {
  sessions: any[]
  onSelectSession: (id: string) => void
  onClose: () => void
  t: (key: string, opts?: any) => string
}) {
  const navigate = useNavigate()
  const [showAllConversations, setShowAllConversations] = useState(false)

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

  const handleNewChat = () => {
    onClose()
    navigate('/chat?new=true')
  }

  const recentSessions = sessions.slice(0, 10)

  return (
    <>
      <PanelHeader
        icon={<MessageSquare size={18} className="text-orange-400" />}
        title={t('common.navigation.chat')}
        onClose={onClose}
      />

      {/* New Chat button - highlighted */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            text-xs font-medium transition-colors cursor-pointer
            bg-gradient-to-b from-amber-500 to-orange-600 text-white
            hover:from-amber-600 hover:to-orange-700
            shadow-md
          `}
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

      {/* All Conversations button - bottom */}
      {sessions.length > 10 && (
        <div className="px-4 py-3 border-t border-gray-800 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={() => setShowAllConversations(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 hover:text-orange-400 bg-gray-800 dark:bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          >
            <Search size={14} />
            {t('pages.chat.panel.allConversations')}
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* All Conversations Modal */}
      {showAllConversations && (
        <AllConversationsModal
          sessions={sessions}
          onSelectSession={(id) => {
            onSelectSession(id)
            setShowAllConversations(false)
          }}
          onClose={() => setShowAllConversations(false)}
          t={t}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALL CONVERSATIONS MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

function AllConversationsModal({
  sessions,
  onSelectSession,
  onClose,
  t,
}: {
  sessions: any[]
  onSelectSession: (id: string) => void
  onClose: () => void
  t: (key: string, opts?: any) => string
}) {
  const [search, setSearch] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = search.trim()
    ? sessions.filter((s: any) =>
        (s.name || '').toLowerCase().includes(search.toLowerCase())
      )
    : sessions

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <div className="relative bg-gray-900 dark:bg-gray-800 rounded-lg border border-gray-700 dark:border-gray-600 w-full max-w-lg mx-4 flex flex-col max-h-[70vh] shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 dark:border-gray-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-orange-400" />
                <h2 className="text-sm font-semibold text-white">
                  {t('pages.chat.panel.allConversations')}
                </h2>
                <span className="text-xs text-gray-500">({sessions.length})</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search bar */}
            <div className="px-4 py-3 border-b border-gray-800 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('pages.chat.searchPlaceholder')}
                  autoFocus
                  className="w-full bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-600 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div ref={listRef} className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <MessageCircle size={32} strokeWidth={1} />
                  <p className="text-xs mt-2">
                    {search.trim() ? t('pages.chat.panel.noResults') : t('pages.chat.noConversations')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800 dark:divide-gray-700">
                  {filtered.map((session: any) => (
                    <button
                      key={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className="w-full text-left flex items-start gap-2 px-4 py-3 hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {session.source_type === 'workflow' && (
                            <span title={t('pages.chat.fromWorkflow')}>
                              <Zap className="h-3 w-3 text-purple-400 flex-shrink-0" />
                            </span>
                          )}
                          <p className="text-sm text-gray-200 truncate">
                            {session.name || `Session ${session.id.slice(0, 8)}`}
                          </p>
                          {session.status === 'running' && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-gray-500">
                            {new Date(session.updated_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          {session.workspace_path && (
                            <p className="text-[10px] text-gray-600 truncate">
                              · {session.workspace_path.split('/').pop()}
                            </p>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-600 flex-shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPROVALS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function ApprovalsPanel({
  pendingCount,
  onNavigate,
  onClose,
}: {
  pendingCount: number
  onNavigate: () => void
  onClose: () => void
}) {
  return (
    <>
      <PanelHeader
        icon={<AlertCircle size={18} className="text-orange-400" />}
        title="Approvals"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {pendingCount > 0 ? (
          <div className="flex flex-col items-center py-8">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-3">
              <ShieldCheck size={24} className="text-orange-400" />
            </div>
            <p className="text-sm font-medium text-white mb-1">{pendingCount} Pending</p>
            <p className="text-xs text-gray-400 text-center">
              You have {pendingCount} item{pendingCount > 1 ? 's' : ''} awaiting your approval
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <ShieldCheck size={32} strokeWidth={1} />
            <p className="text-xs mt-2">All caught up!</p>
            <p className="text-[10px] mt-1">No pending approvals</p>
          </div>
        )}
      </div>
      <PanelFooter label="View approvals" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MARKETPLACE PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function MarketplacePanel({
  onNavigate,
  onClose,
}: {
  onNavigate: () => void
  onClose: () => void
}) {
  return (
    <>
      <PanelHeader
        icon={<Package size={18} className="text-orange-400" />}
        title="Marketplace"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <Store size={32} strokeWidth={1} />
          <p className="text-xs mt-2">Browse skills &amp; models</p>
          <p className="text-[10px] mt-1 text-center">
            Extend your teams with pre-built skills and model configurations from the marketplace
          </p>
        </div>
      </div>
      <PanelFooter label="Open Marketplace" onClick={onNavigate} />
    </>
  )
}
