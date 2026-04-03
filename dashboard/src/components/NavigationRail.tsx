import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Settings, Users, Workflow, AlertCircle, FolderOpen, Zap, MessageSquare,
  LayoutGrid, Package, LogOut, UserCircle, Sun, Moon, Monitor, Check,
  ChevronRight, Clock, X, MessageCircle, FolderGit2,
  Bot, ShieldCheck, Store, ChevronLeft
} from 'lucide-react'
import { useGetPendingApprovals } from '@/api/approvals'
import { useGetProjects } from '@/api/projects'
import { useGetSessions } from '@/api/sessions'
import { useGetWorkspaces } from '@/api/workspaces'
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

type PanelType = 'chat' | 'approvals' | 'workflows' | 'projects' | 'kanban' | 'agents' | 'marketplace' | 'settings' | null

interface NavigationRailProps {
  onQuickAction: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

export default function NavigationRail({ onQuickAction, onCollapsedChange }: NavigationRailProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: pendingApprovals = [] } = useGetPendingApprovals()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelType>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Fetch data for panels
  const { data: projects = [] } = useGetProjects()
  const { data: sessions = [] } = useGetSessions()
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

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Close theme menu on outside click
  useEffect(() => {
    if (!themeMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [themeMenuOpen])

  // Close menus on route change
  useEffect(() => {
    setActivePanel(null)
    setUserMenuOpen(false)
    setThemeMenuOpen(false)
  }, [location.pathname])

  // Notify layout of collapsed state changes
  useEffect(() => {
    onCollapsedChange?.(collapsed)
  }, [collapsed, onCollapsedChange])

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
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
            isActive={location.pathname === '/chat'}
            onClick={() => handleNavClick('/chat')}
            onInfoClick={() => handleInfoClick('chat')}
            badge={sessions.length > 0 ? sessions.length : undefined}
            collapsed={collapsed}
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
            icon={<Package size={20} />}
            label={t('common.navigation.marketplace')}
            isActive={location.pathname === '/marketplace'}
            onClick={() => handleNavClick('/marketplace')}
            onInfoClick={() => handleInfoClick('marketplace')}
            collapsed={collapsed}
          />
          <SidebarButton
            icon={<Settings size={20} />}
            label={t('common.navigation.settings')}
            isActive={location.pathname === '/settings'}
            onClick={() => handleNavClick('/settings')}
            onInfoClick={() => handleInfoClick('settings')}
            collapsed={collapsed}
          />
        </nav>

        {/* Bottom section: Theme + User menu */}
        <div className={`border-t ${withDarkMode(sidebarColors.divider, darkModeSidebarColors.divider)} px-2 pb-3 pt-2 space-y-1 flex-shrink-0`}>
          {/* Theme Selector */}
          <div className="relative" ref={themeMenuRef}>
            <SidebarButton
              label="Theme"
              onClick={() => { setThemeMenuOpen(!themeMenuOpen); setActivePanel(null) }}
              icon={theme === 'dark' ? <Moon size={20} /> : theme === 'light' ? <Sun size={20} /> : <Monitor size={20} />}
              collapsed={collapsed}
            />

            {themeMenuOpen && (
              <div className={`absolute ${collapsed ? 'bottom-full left-full mb-2 ml-0' : 'bottom-full left-0 right-0 mb-1'} bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-50 min-w-[140px]`}>
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

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <SidebarButton
              label={user?.username || 'User'}
              onClick={() => { setUserMenuOpen(!userMenuOpen); setActivePanel(null) }}
              avatar
              initial={user?.username?.charAt(0).toUpperCase() || 'U'}
              collapsed={collapsed}
            />

            {userMenuOpen && (
              <div className={`absolute ${collapsed ? 'bottom-full left-full mb-2 ml-0' : 'bottom-full left-0 right-0 mb-1'} bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-50 min-w-[160px]`}>
                <Link
                  to="/users"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  <UserCircle size={16} />
                  <span>{t('auth.userManagement.title')}</span>
                </Link>
                <button
                  onClick={() => { setUserMenuOpen(false); logout() }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-red-400 hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
                >
                  <LogOut size={16} />
                  <span>{t('auth.userManagement.logout.button')}</span>
                </button>
              </div>
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
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'projects' && (
            <ProjectsPanel
              projects={projects}
              onNavigate={() => { setActivePanel(null); navigate('/projects') }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'kanban' && (
            <KanbanPanel
              projects={projects}
              onNavigate={() => { setActivePanel(null); navigate('/kanban') }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'agents' && (
            <AgentsPanel
              workspaces={workspaces}
              onNavigate={() => { setActivePanel(null); navigate('/agents') }}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === 'chat' && (
            <ChatPanel
              sessions={sessions}
              onNavigate={() => { setActivePanel(null); navigate('/chat') }}
              onSelectSession={(id) => { setActivePanel(null); navigate(`/chat/${id}`) }}
              onClose={() => setActivePanel(null)}
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
          {activePanel === 'settings' && (
            <SettingsPanel
              onNavigate={() => { setActivePanel(null); navigate('/settings') }}
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
  onClose,
}: {
  plans: any[]
  onNavigate: () => void
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
                onClick={onNavigate}
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
  onClose,
}: {
  projects: any[]
  onNavigate: () => void
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
                onClick={onNavigate}
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
  onClose,
}: {
  projects: any[]
  onNavigate: () => void
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
                onClick={onNavigate}
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
  onClose,
}: {
  workspaces: any[]
  onNavigate: () => void
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
        title="Agents"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Your Agents</p>
        {workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Bot size={32} strokeWidth={1} />
            <p className="text-xs mt-2">No agents configured</p>
          </div>
        ) : (
          <div className="space-y-1">
            {workspaces.slice(0, 10).map((ws) => (
              <div
                key={ws.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={onNavigate}
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
      <PanelFooter label="View all agents" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function ChatPanel({
  sessions,
  onNavigate,
  onSelectSession,
  onClose,
}: {
  sessions: any[]
  onNavigate: () => void
  onSelectSession: (id: string) => void
  onClose: () => void
}) {
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
      <PanelHeader
        icon={<MessageSquare size={18} className="text-orange-400" />}
        title="Chat"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Recent Conversations</p>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <MessageCircle size={32} strokeWidth={1} />
            <p className="text-xs mt-2">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.slice(0, 10).map((session: any) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <Clock size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-200 truncate">
                    {session.name || `Session ${session.id.slice(0, 8)}`}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {session.created_at ? formatTime(session.created_at) : ''}
                    {session.workspace_path && (
                      <span className="ml-1 truncate">· {session.workspace_path.split('/').pop()}</span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <PanelFooter label="Open Chat" onClick={onNavigate} />
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
            Extend your agents with pre-built skills and model configurations from the marketplace
          </p>
        </div>
      </div>
      <PanelFooter label="Open Marketplace" onClick={onNavigate} />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SETTINGS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

function SettingsPanel({
  onNavigate,
  onClose,
}: {
  onNavigate: () => void
  onClose: () => void
}) {
  return (
    <>
      <PanelHeader
        icon={<Settings size={18} className="text-orange-400" />}
        title="Settings"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <Settings size={32} strokeWidth={1} />
          <p className="text-xs mt-2">Configuration</p>
          <p className="text-[10px] mt-1 text-center">
            Manage your account, environment variables, and application preferences
          </p>
        </div>
      </div>
      <PanelFooter label="Open Settings" onClick={onNavigate} />
    </>
  )
}
