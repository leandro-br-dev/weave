import React, { useState } from 'react'
import type { ReactNode } from 'react'
import {
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  withDarkMode,
} from '@/lib/colors'

export interface Tab {
  id: string
  label: string
  icon?: ReactNode
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

export function Tabs({ tabs, defaultTab, className = '' }: TabsProps) {
  // Initialize with defaultTab or first tab
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
  }

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        setActiveTab(tabs[prevIndex].id)
        break
      case 'ArrowRight':
        e.preventDefault()
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        setActiveTab(tabs[nextIndex].id)
        break
      case 'Home':
        e.preventDefault()
        setActiveTab(tabs[0].id)
        break
      case 'End':
        e.preventDefault()
        setActiveTab(tabs[tabs.length - 1].id)
        break
    }
  }

  const activeTabData = tabs.find(tab => tab.id === activeTab)

  if (!tabs.length) {
    return null
  }

  return (
    <div className={className}>
      {/* Tab List */}
      <div
        className={`border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}
        role="tablist"
        aria-label="Tabs"
      >
        <div className="flex overflow-x-auto scrollbar-hide -mb-px">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                id={`tab-${tab.id}`}
                onClick={() => handleTabClick(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`
                  inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                  transition-all duration-150 ease-in-out
                  border-b-2 focus:outline-none focus:ring-2 ${interactiveStates.focusRing} focus:ring-offset-2
                  ${isActive
                    ? `${withDarkMode('border-gray-900', 'dark:border-gray-100')} ${withDarkMode(textColors.primary, 'dark:text-white')}`
                    : `border-transparent ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-300')} ${withDarkMode('hover:border-gray-300', 'dark:hover:border-gray-600')}`
                  }
                `}
              >
                {tab.icon && (
                  <span className="flex-shrink-0 w-4 h-4">
                    {tab.icon}
                  </span>
                )}
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="mt-4"
      >
        {activeTabData?.content}
      </div>
    </div>
  )
}
