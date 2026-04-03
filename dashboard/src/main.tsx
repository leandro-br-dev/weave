import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/contexts/ToastContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { router as routeConfig } from './router'
import './index.css'

// Initialize i18n
import './lib/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([
  {
    element: (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <ThemeProvider>
              <AuthProvider>
                <Outlet />
              </AuthProvider>
            </ThemeProvider>
          </ToastProvider>
        </QueryClientProvider>
      </StrictMode>
    ),
    children: routeConfig,
  },
])

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
)
