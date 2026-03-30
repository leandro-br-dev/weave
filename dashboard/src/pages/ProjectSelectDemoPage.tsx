import { useState } from 'react'
import { ProjectSelectDropdown } from '@/components/ProjectSelectDropdown'
import { useTranslation } from 'react-i18next'

// Mock data for demonstration
const demoProjects = [
  {
    id: '1',
    name: 'CharHub',
    color: '#3b82f6',
    description: 'Character management platform'
  },
  {
    id: '2',
    name: 'E-commerce Dashboard',
    color: '#10b981',
    description: 'Sales and analytics dashboard'
  },
  {
    id: '3',
    name: 'Mobile App API',
    color: '#f59e0b',
    description: 'Backend services for mobile'
  },
  {
    id: '4',
    name: 'Marketing Site',
    color: '#ef4444',
    description: 'Company website and landing pages'
  },
  {
    id: '5',
    name: 'Internal Tools',
    color: '#8b5cf6'
  }
]

export default function ProjectSelectDemoPage() {
  const { t } = useTranslation()
  const [selectedProject, setSelectedProject] = useState('')
  const [filterProject, setFilterProject] = useState('')

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('projectSelectDemo.title')}
        </h1>
        <p className="text-gray-600">
          {t('projectSelectDemo.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Usage Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectSelectDemo.basicUsage.title')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('projectSelectDemo.basicUsage.description')}
          </p>
          <ProjectSelectDropdown
            value={selectedProject}
            onChange={setSelectedProject}
            projects={demoProjects}
            label={t('projectSelectDemo.basicUsage.label')}
            placeholder={t('projectSelectDemo.basicUsage.placeholder')}
          />
          {selectedProject && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm font-medium text-gray-700">
                {t('projectSelectDemo.selected')}: {demoProjects.find(p => p.id === selectedProject)?.name}
              </p>
            </div>
          )}
        </div>

        {/* Filter Mode Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectSelectDemo.filterMode.title')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('projectSelectDemo.filterMode.description')}
          </p>
          <ProjectSelectDropdown
            value={filterProject}
            onChange={setFilterProject}
            projects={demoProjects}
            label={t('projectSelectDemo.filterMode.label')}
            placeholder={t('projectSelectDemo.filterMode.placeholder')}
            showAllOption
            allOptionLabel={t('projectSelectDemo.filterMode.allOptionLabel')}
          />
          {filterProject && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm font-medium text-gray-700">
                {t('projectSelectDemo.filteringBy')}: {demoProjects.find(p => p.id === filterProject)?.name || t('projectSelectDemo.filterMode.allOptionLabel')}
              </p>
            </div>
          )}
        </div>

        {/* Required Field Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectSelectDemo.requiredField.title')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('projectSelectDemo.requiredField.description')}
          </p>
          <ProjectSelectDropdown
            value=""
            onChange={() => {}}
            projects={demoProjects}
            label={t('projectSelectDemo.requiredField.label')}
            placeholder={t('projectSelectDemo.requiredField.placeholder')}
            required
          />
        </div>

        {/* Error State Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectSelectDemo.errorState.title')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('projectSelectDemo.errorState.description')}
          </p>
          <ProjectSelectDropdown
            value=""
            onChange={() => {}}
            projects={demoProjects}
            label={t('projectSelectDemo.errorState.label')}
            placeholder={t('projectSelectDemo.errorState.placeholder')}
            error={t('projectSelectDemo.errorState.errorMessage')}
            required
          />
        </div>

        {/* Disabled State Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectSelectDemo.disabledState.title')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            {t('projectSelectDemo.disabledState.description')}
          </p>
          <ProjectSelectDropdown
            value="1"
            onChange={() => {}}
            projects={demoProjects}
            label={t('projectSelectDemo.disabledState.label')}
            disabled
          />
        </div>

        {/* Features Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projectSelectDemo.features.title')}</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.icon')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.description')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.checkmark')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.keyboard')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.accessible')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.allOption')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.validation')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{t('projectSelectDemo.features.states')}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Usage Example */}
      <div className="mt-8 bg-gray-900 rounded-lg p-6 overflow-x-auto">
        <h3 className="text-lg font-semibold text-white mb-4">{t('projectSelectDemo.usageExample.title')}</h3>
        <pre className="text-sm text-gray-300">
{`import { useState } from 'react'
import { ProjectSelectDropdown } from '@/components'

export function MyComponent() {
  const [selectedProject, setSelectedProject] = useState('')

  return (
    <ProjectSelectDropdown
      value={selectedProject}
      onChange={setSelectedProject}
      projects={projects}
      label="Select Project"
      placeholder="Choose a project..."
      showAllOption  // Optional: adds "All Projects" option
      required       // Optional: shows required indicator
    />
  )
}`}
        </pre>
      </div>
    </div>
  )
}
