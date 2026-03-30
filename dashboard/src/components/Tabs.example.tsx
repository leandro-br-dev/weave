import { Tabs } from './Tabs'
import { Home, Settings, User, FileText } from 'lucide-react'

/**
 * Example usage of the Tabs component
 *
 * Basic usage:
 * ```tsx
 * import { Tabs } from '@/components/Tabs'
 *
 * const tabs = [
 *   {
 *     id: 'overview',
 *     label: 'Overview',
 *     content: <div>Overview content</div>
 *   },
 *   {
 *     id: 'settings',
 *     label: 'Settings',
 *     content: <div>Settings content</div>
 *   }
 * ]
 *
 * <Tabs tabs={tabs} />
 * ```
 *
 * With icons:
 * ```tsx
 * const tabs = [
 *   {
 *     id: 'home',
 *     label: 'Home',
 *     icon: <Home className="w-4 h-4" />,
 *     content: <div>Home content</div>
 *   },
 *   {
 *     id: 'settings',
 *     label: 'Settings',
 *     icon: <Settings className="w-4 h-4" />,
 *     content: <div>Settings content</div>
 *   }
 * ]
 *
 * <Tabs tabs={tabs} />
 * ```
 *
 * With default tab:
 * ```tsx
 * <Tabs tabs={tabs} defaultTab="settings" />
 * ```
 */

export function TabsExample() {
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <Home className="w-4 h-4" />,
      content: (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Overview</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This is the overview tab content. You can put any React components here.
          </p>
        </div>
      ),
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <FileText className="w-4 h-4" />,
      content: (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Documents</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This is the documents tab content with icon.
          </p>
        </div>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-4 h-4" />,
      content: (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Profile</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This is the profile tab content.
          </p>
        </div>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      content: (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Settings</h3>
          <p className="text-gray-600 dark:text-gray-400">
            This is the settings tab content. Try using arrow keys to navigate!
          </p>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Tabs tabs={tabs} defaultTab="overview" />
    </div>
  )
}
