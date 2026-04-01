import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { Settings, Users, Workflow, AlertCircle, FolderOpen, Zap, MessageSquare, LayoutGrid, Package, X, Menu, LogOut, UserCircle, ChevronUp } from 'lucide-react'
import { useGetPendingApprovals } from '@/api/approvals'
import { QuickActionModal } from '@/components/QuickActionModal'
import { ThemeSelector } from '@/components/ThemeSelector'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import weaveLogo from '@/assets/weave-logo.svg'

export default function Layout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { data: pendingApprovals = [] } = useGetPendingApprovals()
  const { user, logout } = useAuth()
  const [showQuickAction, setShowQuickAction] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

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
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Close user menu on route change
  useEffect(() => {
    setUserMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg transition-colors bg-gray-900 dark:bg-gray-800 text-white hover:bg-gray-800 dark:hover:bg-gray-700"
        aria-label={t('common.app.toggleMenu')}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar - Desktop always visible, Mobile with overlay */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 text-white
        transform transition-transform duration-300 ease-in-out
        bg-gray-900 dark:bg-gray-950
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex items-center gap-3">
          <img src={weaveLogo} alt="Weave" className="h-8 w-8" />
          <h1 className="text-xl font-bold">{t('common.app.title')}</h1>
        </div>
        <nav className="mt-6">
          {/* Quick Action - First item with special highlight */}
          <button
            onClick={() => setShowQuickAction(true)}
            className="w-full flex items-center gap-3 px-6 py-3 text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 transition-all border-l-4 border-amber-300 shadow-md"
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
          <NavItem icon={<Settings size={20} />} label={t('common.navigation.settings')} href="/settings" isActive={location.pathname === '/settings'} />
        </nav>

        {/* Bottom section: User + Theme + Mobile close */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 space-y-1" ref={userMenuRef}>
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
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
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 dark:bg-gray-900 rounded-lg border border-gray-700 dark:border-gray-800 py-1 shadow-lg z-50">
                <Link
                  to="/users"
                  onClick={() => { setUserMenuOpen(false); setMobileMenuOpen(false) }}
                  className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors"
                >
                  <UserCircle size={16} />
                  <span className="text-sm">{t('auth.userManagement.title')}</span>
                </Link>
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    setMobileMenuOpen(false)
                    logout()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-red-400 hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors"
                >
                  <LogOut size={16} />
                  <span className="text-sm">{t('auth.userManagement.logout.button')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Theme Selector */}
          <ThemeSelector layout="sidebar" />
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden absolute bottom-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
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
      <main className="flex-1 overflow-auto font-sans relative lg:ml-0 bg-gray-50 dark:bg-gray-900">
        <div className="pt-16 lg:pt-0">
          <Outlet />
        </div>
      </main>

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
          ? 'bg-gray-800 dark:bg-gray-900 text-white border-l-4 border-white dark:border-gray-100'
          : 'text-gray-300 dark:text-gray-200 border-l-4 border-transparent hover:bg-gray-800 dark:hover:bg-gray-900 hover:text-white'
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
