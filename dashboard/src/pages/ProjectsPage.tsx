import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useGetProjects, useCreateProject, useDeleteProject, useUpdateProject, useCreateEnvironment, useUpdateEnvironment, useDeleteEnvironment, useUnlinkAgent, useGenerateContext, type Environment } from '@/api/projects'
import { useGetWorkspaces } from '@/api/teams'
import { FolderOpen, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Settings, FolderTree } from 'lucide-react'
import { PageHeader, Button, Card, Input, Select, ConfirmDialog, EmptyState, ColorPicker, ColorSelectDropdown, ProjectIcon, ContextModal, DefaultAgentsModal } from '@/components'
import {
  bgColors, darkModeBgColors,
  textColors, darkModeTextColors,
  borderColors, darkModeBorderColors,
  accentColors, darkModeAccentColors,
  interactiveStates, darkModeInteractiveStates,
  errorColors, darkModeErrorColors,
  successColors, darkModeSuccessColors,
  warningColors, darkModeWarningColors,
  infoColors, darkModeInfoColors,
  withDarkMode,
} from '@/lib/colors'

export default function ProjectsPage() {
  const { t } = useTranslation()
  const { data: projects, isLoading, error } = useGetProjects()
  const { data: allWorkspaces } = useGetWorkspaces()
  const createProjectMutation = useCreateProject()
  const deleteProjectMutation = useDeleteProject()
  const updateProjectMutation = useUpdateProject()
  const createEnvironmentMutation = useCreateEnvironment()
  const updateEnvironmentMutation = useUpdateEnvironment()
  const deleteEnvironmentMutation = useDeleteEnvironment()
  const unlinkAgentMutation = useUnlinkAgent()
  const generateContextMutation = useGenerateContext()

  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6')
  const [newProjectGitUrl, setNewProjectGitUrl] = useState('')
  const [newProjectCreateDefaultEnvs, setNewProjectCreateDefaultEnvs] = useState(false)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState<Set<string>>(new Set())
  const [showEnvForm, setShowEnvForm] = useState<Set<string>>(new Set())
  const [editingEnv, setEditingEnv] = useState<{ projectId: string; envId: string } | null>(null)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deleteEnvConfirm, setDeleteEnvConfirm] = useState<{ projectId: string; envId: string; envName: string } | null>(null)

  // Context modal state
  const [contextModal, setContextModal] = useState<{
    isOpen: boolean
    projectId: string
    projectName: string
    envId: string
    envName: string
    context: any
    error: string | null
  }>({
    isOpen: false,
    projectId: '',
    projectName: '',
    envId: '',
    envName: '',
    context: null,
    error: null,
  })

  // Default agents modal state
  const [defaultAgentsModal, setDefaultAgentsModal] = useState<{
    isOpen: boolean
    projectId: string
    projectName: string
    environmentId: string
    environmentName: string
  }>({
    isOpen: false,
    projectId: '',
    projectName: '',
    environmentId: '',
    environmentName: '',
  })

  // New environment form state
  const [newEnvData, setNewEnvData] = useState<Partial<Environment>>({
    name: '',
    type: 'local-wsl',
    project_path: '',
  })

  // Edit environment form state
  const [editEnvData, setEditEnvData] = useState<Partial<Environment>>({})

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <div className="animate-pulse">
          <div className={`h-8 ${withDarkMode('bg-gray-200', 'dark:bg-gray-700')} rounded w-1/4 mb-4`}></div>
          <div className={`h-4 ${withDarkMode('bg-gray-200', 'dark:bg-gray-700')} rounded w-full mb-2`}></div>
          <div className={`h-4 ${withDarkMode('bg-gray-200', 'dark:bg-gray-700')} rounded w-3/4`}></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-6">
        <Card className={`${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} ${withDarkMode(errorColors.border, darkModeErrorColors.border)}`}>
          <p className={`${withDarkMode(errorColors.textAlt, darkModeErrorColors.textAlt)}`}>Error loading projects: {(error as Error).message}</p>
        </Card>
      </div>
    )
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    try {
      await createProjectMutation.mutateAsync({
        name: newProjectName,
        description: newProjectDescription || undefined,
        color: newProjectColor,
        git_url: newProjectGitUrl.trim() || undefined,
        create_default_envs: newProjectCreateDefaultEnvs ? true : undefined,
      })
      setNewProjectName('')
      setNewProjectDescription('')
      setNewProjectColor('#3b82f6')
      setNewProjectGitUrl('')
      setNewProjectCreateDefaultEnvs(false)
      setShowNewProjectForm(false)
    } catch (error) {
      alert(`Failed to create project: ${(error as Error).message}`)
    }
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    setDeleteProjectConfirm({ id: projectId, name: projectName })
  }

  const confirmDeleteProject = async () => {
    if (!deleteProjectConfirm) return

    try {
      await deleteProjectMutation.mutateAsync(deleteProjectConfirm.id)
      setDeleteProjectConfirm(null)
    } catch (error) {
      alert(`Failed to delete project: ${(error as Error).message}`)
    }
  }

  const handleCreateEnvironment = async (projectId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!newEnvData.name?.trim() || !newEnvData.project_path?.trim()) {
      return
    }

    try {
      const result = await createEnvironmentMutation.mutateAsync({
        projectId,
        data: newEnvData,
      })
      const envName = newEnvData.name!
      const projectName = projects?.find(p => p.id === projectId)?.name || ''

      setNewEnvData({
        name: '',
        type: 'local-wsl',
        project_path: '',
      })
      setShowEnvForm(prev => {
        const next = new Set(prev)
        next.delete(projectId)
        return next
      })

      // Show default agents modal after environment creation
      if (result?.id) {
        setDefaultAgentsModal({
          isOpen: true,
          projectId,
          projectName,
          environmentId: result.id,
          environmentName: envName,
        })
      }
    } catch (error) {
      alert(`Failed to create environment: ${(error as Error).message}`)
    }
  }

  const handleUpdateEnvironment = async (projectId: string, envId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!editEnvData.name?.trim()) {
      return
    }

    try {
      await updateEnvironmentMutation.mutateAsync({
        projectId,
        envId,
        data: editEnvData,
      })
      setEditingEnv(null)
      setEditEnvData({})
    } catch (error) {
      alert(`Failed to update environment: ${(error as Error).message}`)
    }
  }

  const handleDeleteEnvironment = async (projectId: string, envId: string, envName: string) => {
    setDeleteEnvConfirm({ projectId, envId, envName })
  }

  const confirmDeleteEnvironment = async () => {
    if (!deleteEnvConfirm) return

    try {
      await deleteEnvironmentMutation.mutateAsync({ projectId: deleteEnvConfirm.projectId, envId: deleteEnvConfirm.envId })
      setDeleteEnvConfirm(null)
    } catch (error) {
      alert(`Failed to delete environment: ${(error as Error).message}`)
    }
  }

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const getEnvironmentBadgeColor = (type: string) => {
    switch (type) {
      case 'local-wsl':
        return `${withDarkMode(successColors.bg, darkModeSuccessColors.bg)} ${withDarkMode('text-green-800', 'dark:text-green-300')}`
      case 'local-windows':
        return `${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} ${withDarkMode('text-blue-800', 'dark:text-blue-300')}`
      case 'ssh':
        return `${withDarkMode(warningColors.bg, darkModeWarningColors.bg)} ${withDarkMode('text-yellow-800', 'dark:text-yellow-300')}`
      default:
        return `${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`
    }
  }

  const startEditingEnv = (projectId: string, env: Environment) => {
    setEditingEnv({ projectId, envId: env.id })
    setEditEnvData({ ...env })
  }

  const handleUnlinkAgent = async (projectId: string, workspacePath: string) => {
    try {
      await unlinkAgentMutation.mutateAsync({
        projectId,
        workspace_path: workspacePath
      })
    } catch (error) {
      alert(`Failed to unlink agent: ${(error as Error).message}`)
    }
  }

  const handleGenerateContext = async (projectId: string, projectName: string, envId: string, envName: string) => {
    setContextModal({
      isOpen: true,
      projectId,
      projectName,
      envId,
      envName,
      context: null,
      error: null,
    })

    try {
      const result = await generateContextMutation.mutateAsync({ projectId, envId })
      setContextModal(prev => ({
        ...prev,
        context: result,
        error: null,
      }))
    } catch (error) {
      setContextModal(prev => ({
        ...prev,
        error: (error as Error).message,
        context: null,
      }))
    }
  }

  const handleCloseContextModal = () => {
    setContextModal({
      isOpen: false,
      projectId: '',
      projectName: '',
      envId: '',
      envName: '',
      context: null,
      error: null,
    })
  }

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.projects.title')}
        description={t('pages.projects.description')}
        actions={
          <Button variant="primary" onClick={() => setShowNewProjectForm(!showNewProjectForm)} className="text-xs sm:text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">{t('pages.projects.header.newProject')}</span><span className="sm:hidden">{t('pages.projects.header.new')}</span>
          </Button>
        }
      />

      {/* New Project Form */}
      {showNewProjectForm && (
        <Card className="mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-semibold mb-4">{t('pages.projects.form.createTitle')}</h2>
          <form onSubmit={handleCreateProject}>
            <div className="space-y-4">
              <Input
                label={t('pages.projects.form.projectName')}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('pages.projects.form.projectNamePlaceholder')}
                required
              />
              <div>
                <label className={`block text-sm font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mb-1`}>{t('pages.projects.form.description')}</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className={`w-full px-3 py-2 border ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} rounded-lg focus:ring-2 ${interactiveStates.focusRing} focus:border-transparent`}
                  rows={3}
                  placeholder="Brief description of the project..."
                />
              </div>
              <ColorPicker
                label={t('pages.projects.form.projectColor')}
                value={newProjectColor}
                onChange={setNewProjectColor}
                hint={t('pages.projects.form.projectColorHint')}
                compact
              />
              <Input
                label={t('pages.projects.form.gitUrl')}
                value={newProjectGitUrl}
                onChange={(e) => setNewProjectGitUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git"
                hint="Optional: Link to your git repository"
              />
              <div className="flex items-center justify-between">
                <div>
                  <label className={`block text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                    {t('pages.projects.form.createDefaultEnvs')}
                  </label>
                  <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                    {t('pages.projects.form.createDefaultEnvsDesc')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!newProjectGitUrl.trim()}
                  onClick={() => setNewProjectCreateDefaultEnvs(!newProjectCreateDefaultEnvs)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    newProjectCreateDefaultEnvs
                      ? withDarkMode(bgColors.inverted, 'dark:bg-orange-600')
                      : withDarkMode('bg-gray-200', 'dark:bg-gray-700')
                  } ${!newProjectGitUrl.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    newProjectCreateDefaultEnvs ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" variant="primary" disabled={createProjectMutation.isPending} loading={createProjectMutation.isPending} className="w-full sm:w-auto">
                  {createProjectMutation.isPending ? t('pages.projects.form.creating') : t('pages.projects.form.createProject')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowNewProjectForm(false)
                    setNewProjectName('')
                    setNewProjectDescription('')
                    setNewProjectColor('#3b82f6')
                    setNewProjectGitUrl('')
                    setNewProjectCreateDefaultEnvs(false)
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        {projects && projects.length > 0 ? (
          projects.map((project) => {
            // Filter agents for this project
            const projectAgents = allWorkspaces?.filter(ws => ws.project_id === project.id) || []

            return (
              <div key={project.id} className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg shadow-sm overflow-hidden`}>
              {/* Project Header */}
              <div
                className={`p-3 sm:p-4 cursor-pointer ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} transition-colors`}
                onClick={() => toggleProjectExpanded(project.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left side: Project icon, name and description */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <ProjectIcon project={project} size={20} className="flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-base sm:text-lg font-semibold ${withDarkMode(textColors.primary, darkModeTextColors.primary)} truncate`}>{project.name}</h3>
                      {project.description && (
                        <p className={`text-xs sm:text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} mt-0.5 line-clamp-2`}>{project.description}</p>
                      )}
                      {project.git_url && (
                        <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} mt-0.5 flex items-center gap-1 truncate`}>
                          <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                          <code className="truncate">{project.git_url}</code>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right side: Settings */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <ColorSelectDropdown
                      value={project.color || '#3b82f6'}
                      onChange={(color) => updateProjectMutation.mutate({
                        id: project.id,
                        color,
                      })}
                    />
                    <span className={`text-xs sm:text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                      {project.environments.length} env{project.environments.length !== 1 ? 's' : ''}
                    </span>
                    {expandedProjects.has(project.id) ? (
                      <ChevronUp size={18} className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} />
                    ) : (
                      <ChevronDown size={18} className={withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project.id, project.name)
                      }}
                      className={`p-1.5 sm:p-2 ${withDarkMode(errorColors.text, darkModeErrorColors.text)} ${withDarkMode('hover:bg-red-50', 'dark:hover:bg-red-950')} rounded-lg transition-colors`}
                      title="Delete project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Environments and Agents */}
              {expandedProjects.has(project.id) && (
                <div className={`border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode(bgColors.primary, darkModeBgColors.primary)} p-3 sm:p-4`}>
                  {/* Environments Section */}
                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={`text-sm font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('pages.projects.environments.title')}</h4>
                      <button
                        onClick={() => {
                          setShowEnvForm(prev => new Set(prev).add(project.id))
                          setNewEnvData({
                            name: '',
                            type: 'local-wsl',
                            project_path: '',
                          })
                        }}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm ${withDarkMode(accentColors.solid, 'dark:bg-orange-600')} text-white rounded-lg ${withDarkMode(accentColors.hoverBg, darkModeAccentColors.hoverBg)} transition-colors`}
                      >
                        <Plus size={14} />
                        <span className="hidden sm:inline">{t('pages.projects.environments.add')}</span>
                        <span className="sm:hidden">Add</span>
                      </button>
                    </div>

                  {/* New Environment Form */}
                  {showEnvForm.has(project.id) && (
                    <Card className="mb-4">
                      <h5 className="text-sm font-semibold mb-3">Create New Environment</h5>
                      <form onSubmit={(e) => handleCreateEnvironment(project.id, e)}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <Input
                            label="Name"
                            value={newEnvData.name || ''}
                            onChange={(e) => setNewEnvData({ ...newEnvData, name: e.target.value })}
                            placeholder="e.g., Development"
                            required
                          />
                          <Select
                            label="Type"
                            value={newEnvData.type || 'local-wsl'}
                            onChange={(e) => setNewEnvData({ ...newEnvData, type: e.target.value as Environment['type'] })}
                          >
                            <option value="local-wsl">Local WSL</option>
                            <option value="local-windows">Local Windows</option>
                            <option value="ssh">SSH</option>
                          </Select>
                          <Input
                            label="Project Path"
                            value={newEnvData.project_path || ''}
                            onChange={(e) => setNewEnvData({ ...newEnvData, project_path: e.target.value })}
                            placeholder="/root/projects/my-project"
                            hint="Where your project files are located"
                            className="sm:col-span-2"
                            required
                          />
                          {newEnvData.type === 'ssh' && (
                            <>
                              <Input
                                label="SSH Host"
                                value={newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config).host || '' : ''}
                                onChange={(e) => {
                                  const current = newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config) : {}
                                  setNewEnvData({
                                    ...newEnvData,
                                    ssh_config: JSON.stringify({ ...current, host: e.target.value })
                                  })
                                }}
                                placeholder="server.example.com"
                              />
                              <Input
                                label="SSH User"
                                value={newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config).user || '' : ''}
                                onChange={(e) => {
                                  const current = newEnvData.ssh_config ? JSON.parse(newEnvData.ssh_config) : {}
                                  setNewEnvData({
                                    ...newEnvData,
                                    ssh_config: JSON.stringify({ ...current, user: e.target.value })
                                  })
                                }}
                                placeholder="ubuntu"
                              />
                            </>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button type="submit" variant="primary" size="sm" disabled={createEnvironmentMutation.isPending} loading={createEnvironmentMutation.isPending}>
                            {createEnvironmentMutation.isPending ? 'Creating...' : 'Create'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setShowEnvForm(prev => {
                                const next = new Set(prev)
                                next.delete(project.id)
                                return next
                              })
                              setNewEnvData({
                                name: '',
                                type: 'local-wsl',
                                project_path: '',
                              })
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Card>
                  )}

                  {/* Environments List */}
                  {project.environments.length === 0 ? (
                    <p className={`text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} italic`}>{t('pages.projects.environments.empty')}</p>
                  ) : (
                    <div className="space-y-3">
                      {project.environments.map((env) => (
                        <div key={env.id} className={`${withDarkMode(bgColors.secondary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} rounded-lg p-3`}>
                          {editingEnv?.projectId === project.id && editingEnv?.envId === env.id ? (
                            // Edit Form
                            <form onSubmit={(e) => handleUpdateEnvironment(project.id, env.id, e)}>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <Input
                                  label="Name"
                                  value={editEnvData.name || ''}
                                  onChange={(e) => setEditEnvData({ ...editEnvData, name: e.target.value })}
                                  required
                                />
                                <Select
                                  label="Type"
                                  value={editEnvData.type || 'local-wsl'}
                                  onChange={(e) => setEditEnvData({ ...editEnvData, type: e.target.value as Environment['type'] })}
                                >
                                  <option value="local-wsl">Local WSL</option>
                                  <option value="local-windows">Local Windows</option>
                                  <option value="ssh">SSH</option>
                                </Select>
                                <Input
                                  label="Project Path"
                                  value={editEnvData.project_path || ''}
                                  onChange={(e) => setEditEnvData({ ...editEnvData, project_path: e.target.value })}
                                  placeholder="/root/projects/my-project"
                                  hint="Where your project files are located"
                                  required
                                />
                              </div>
                              <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} mt-2`}>
                                Agent team is auto-generated and cannot be edited
                              </p>
                              <div className="flex gap-2">
                                <Button type="submit" variant="primary" size="sm" disabled={updateEnvironmentMutation.isPending} loading={updateEnvironmentMutation.isPending}>
                                  {updateEnvironmentMutation.isPending ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setEditingEnv(null)
                                    setEditEnvData({})
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          ) : (
                            // Display Mode
                            <>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className={`font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>{env.name}</h5>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getEnvironmentBadgeColor(env.type)}`}>
                                      {env.type}
                                    </span>
                                  </div>
                                  <div className={`space-y-1 text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                                    <div>
                                      <span className="font-medium">Project path:</span> <code className={`${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} px-1.5 py-0.5 rounded text-xs`}>{env.project_path}</code>
                                    </div>
                                    {env.agent_workspace && (
                                    <details className="mt-2">
                                      <summary className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)} cursor-pointer ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}>Agent team path</summary>
                                      <code className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} block mt-1 break-all`}>{env.agent_workspace}</code>
                                    </details>
                                    )}
                                    {env.type === 'ssh' && env.ssh_config && (
                                      <div>
                                        <span className="font-medium">SSH:</span> <code className={`${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)} px-1.5 py-0.5 rounded text-xs`}>
                                          {(() => {
                                            const config = JSON.parse(env.ssh_config)
                                            return `${config.user}@${config.host}`
                                          })()}
                                        </code>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleGenerateContext(project.id, project.name, env.id, env.name)}
                                    title="Generate context"
                                  >
                                    <FolderTree size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => startEditingEnv(project.id, env)} title="Edit environment">
                                    <Edit2 size={14} />
                                  </Button>
                                  <Button variant="danger" size="sm" onClick={() => handleDeleteEnvironment(project.id, env.id, env.name)} title="Delete environment">
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>

                  {/* Agents Section */}
                  <div className="mt-4">
                    <h4 className={`text-xs font-semibold ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} uppercase tracking-wide mb-2`}>{t('pages.projects.agents.title')}</h4>
                    {projectAgents.length === 0 ? (
                      <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                        {t('pages.projects.agents.empty')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {projectAgents.map(agent => (
                          <div key={agent.id || agent.path}
                            className={`flex items-center justify-between px-3 py-2 ${withDarkMode(bgColors.primary, darkModeBgColors.tertiary)} rounded border ${withDarkMode(borderColors.subtle, darkModeBorderColors.thick)}`}>
                            <div>
                              <span className={`text-xs font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>{agent.name}</span>
                              {agent.role && (
                                <span className={`ml-2 text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>{agent.role}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Link
                                to="/agents"
                                className={`text-xs ${withDarkMode(accentColors.text, darkModeAccentColors.text)} hover:underline`}
                              >
                                {t('pages.projects.agents.view')} →
                              </Link>
                              <button
                                onClick={() => handleUnlinkAgent(project.id, agent.path)}
                                className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-red-500', 'dark:hover:text-red-400')}`}
                                title="Unlink agent"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pipeline Settings Section */}
                  <div className={`border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} mt-4 pt-4`}>
                    <button
                      onClick={() => {
                        setShowSettings(prev => {
                          const next = new Set(prev)
                          if (next.has(project.id)) {
                            next.delete(project.id)
                          } else {
                            next.add(project.id)
                          }
                          return next
                        })
                      }}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h4 className={`text-xs font-semibold ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} uppercase tracking-wide`}>{t('pages.projects.pipelineSettings.title')}</h4>
                      <Settings size={14} className={withDarkMode(textColors.muted, darkModeTextColors.muted)} />
                    </button>

                    {showSettings.has(project.id) && (
                      <div className="mt-3 space-y-4">
                        {/* Auto-approve toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('pages.projects.pipelineSettings.autoApprove')}</p>
                            <p className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.veryMuted)}`}>{t('pages.projects.pipelineSettings.autoApproveDesc')}</p>
                          </div>
                          <button
                            onClick={() => updateProjectMutation.mutate({
                              id: project.id,
                              settings: {
                                ...project.settings,
                                auto_approve_workflows: !project.settings?.auto_approve_workflows
                              }
                            })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              project.settings?.auto_approve_workflows ? withDarkMode(bgColors.inverted, 'dark:bg-orange-600') : withDarkMode('bg-gray-200', 'dark:bg-gray-700')
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              project.settings?.auto_approve_workflows ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            )
          })
        ) : (
          <EmptyState
            icon={<FolderOpen size={48} className={withDarkMode(textColors.muted, darkModeTextColors.muted)} />}
            title={t('pages.projects.empty.title')}
            description={t('pages.projects.empty.description')}
            action={
              <Button variant="primary" onClick={() => setShowNewProjectForm(true)}>
                <Plus size={18} /> {t('pages.projects.empty.createProject')}
              </Button>
            }
          />
        )}
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deleteProjectConfirm !== null}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteProjectConfirm?.name}"? This will also delete all its environments.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDeleteProject}
        onCancel={() => setDeleteProjectConfirm(null)}
        loading={deleteProjectMutation.isPending}
      />

      <ConfirmDialog
        open={deleteEnvConfirm !== null}
        title="Delete Environment"
        description={`Are you sure you want to delete environment "${deleteEnvConfirm?.envName}"?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDeleteEnvironment}
        onCancel={() => setDeleteEnvConfirm(null)}
        loading={deleteEnvironmentMutation.isPending}
      />

      {/* Context Modal */}
      <ContextModal
        isOpen={contextModal.isOpen}
        onClose={handleCloseContextModal}
        context={contextModal.context}
        isLoading={generateContextMutation.isPending}
        error={contextModal.error}
        environmentName={contextModal.envName}
        projectName={contextModal.projectName}
      />

      {/* Default Agents Modal */}
      <DefaultAgentsModal
        isOpen={defaultAgentsModal.isOpen}
        onClose={() => setDefaultAgentsModal(prev => ({ ...prev, isOpen: false }))}
        projectId={defaultAgentsModal.projectId}
        environmentId={defaultAgentsModal.environmentId}
        projectName={defaultAgentsModal.projectName}
        environmentName={defaultAgentsModal.environmentName}
      />
    </div>
  )
}
