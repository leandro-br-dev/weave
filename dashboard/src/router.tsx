import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import { PlanDetailPage } from './pages/PlanDetailPage'
import { CreatePlanPage } from './pages/CreatePlanPage'
import WorkflowsPage from './pages/WorkflowsPage'
import AgentsPage from './pages/AgentsPage'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'
import ApprovalsPage from './pages/ApprovalsPage'
import UserInputsPage from './pages/UserInputsPage'
import UsersPage from './pages/UsersPage'
import ChatPage from './pages/ChatPage'
import KanbanPage from './pages/KanbanPage'
import MarketplacePage from './pages/MarketplacePage'

function ProtectedRoute() {
  const { isLoading, isAuthenticated, hasUsers } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (!hasUsers) {
      return <Navigate to="/setup" replace />
    }
    return <Navigate to="/login" replace />
  }

  return <Layout />
}

function PublicRoute() {
  const { isLoading, isAuthenticated, hasUsers } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  // If no users exist, /login should redirect to /setup
  if (!hasUsers && window.location.pathname === '/login') {
    return <Navigate to='/setup' replace />
  }

  // If users already exist, /setup should redirect to /login
  if (hasUsers && window.location.pathname === '/setup') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export const router = [
  {
    element: <PublicRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/setup',
        element: <SetupPage />,
      },
      {
        path: '/reset-password',
        element: <ResetPasswordPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <WorkflowsPage />,
      },
      {
        path: 'workflows',
        element: <WorkflowsPage />,
      },
      {
        path: 'plans/:id',
        element: <PlanDetailPage />,
      },
      {
        path: 'plans/new',
        element: <CreatePlanPage />,
      },
      {
        path: 'agents',
        element: <AgentsPage />,
      },
      {
        path: 'marketplace',
        element: <MarketplacePage />,
      },
      {
        path: 'chat',
        element: <ChatPage />,
      },
      {
        path: 'chat/:id',
        element: <ChatPage />,
      },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'kanban',
        element: <KanbanPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'approvals',
        element: <ApprovalsPage />,
      },
      {
        path: 'user-inputs',
        element: <UserInputsPage />,
      },
      {
        path: 'users',
        element: <UsersPage />,
      },
    ],
  },
]
