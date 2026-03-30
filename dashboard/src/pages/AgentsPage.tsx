import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useGetWorkspaces, useGetWorkspace, useCreateWorkspace, useDeleteWorkspace, useSaveClaudeMd, useSaveSettings, useGetSkill, useInstallSkill, useDeleteSkill, useGetAgent, useSaveAgent, useDeleteAgent, useRenameAgent, useGetWorkspaceEnvironments, useLinkEnvironment, useUnlinkEnvironment, useGetAgentTemplates, useGetNativeSkills, useInstallNativeSkill, useImportCustomSkill, useUpdateWorkspaceRole, useUpdateWorkspaceProject, useGetAgentModels, useUpdateWorkspaceModel, useImproveClaudeMd, useImprovementStatus, useGetNativeAgents, useInstallNativeAgent, type Workspace, type WorkspaceRole, type AgentModel } from '../api/workspaces'
import { useGetProjects, useGetAllEnvironments, useGenerateAgent } from '../api/projects'
import { useGetEnvironmentVariablesDefaults } from '../api/environmentVariables'
import { useState, useRef, useMemo, useEffect } from 'react'
import { Trash2, Plus, FileText, Settings as SettingsIcon, Code, Users, Edit3, Pencil, Link2, X, Upload, Wand2, Loader2 } from 'lucide-react'
import { PageHeader, Button, Card, Input, Select, ConfirmDialog, EmptyState, ClaudeMdImprovementModal, EnvironmentVariablesForm, ProjectIcon, ProjectSelectDropdown, type EnvironmentVariableValue } from '@/components'
import { cn } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { useTranslation } from 'react-i18next'

const ROLE_COLORS: Record<WorkspaceRole, { bg: string; text: string; border: string; label: string }> = {
  planner: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Planner' },
  coder: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Coder' },
  reviewer: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Reviewer' },
  tester: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Tester' },
  debugger: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Debugger' },
  devops: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', label: 'DevOps' },
  generic: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Generic' },
}

const ROLE_DEFAULT_MODEL: Record<string, string> = {
  planner:  'claude-opus-4-6',
  reviewer: 'claude-sonnet-4-6',
  coder:    'claude-sonnet-4-6',
  tester:   'claude-sonnet-4-6',
  debugger: 'claude-sonnet-4-6',
  devops:   'claude-sonnet-4-6',
  generic:  'default',
}

const ROLE_HINTS: Record<string, string> = {
  planner:  'Will use the agent-creator skill to analyze the project and plan work',
  coder:    'Implements features, fixes bugs, writes code following project conventions',
  reviewer: 'Reviews code quality, tests, and adherence to project standards',
  tester:   'Writes and executes test suites using the project test framework',
  debugger: 'Diagnoses and fixes errors, analyzes logs and stack traces',
  devops:   'Manages CI/CD, deployment scripts, and infrastructure',
  generic:  'General purpose agent with full project context',
}

export default function AgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const workspaceId = searchParams.get('workspace')

  if (workspaceId) {
    return <WorkspaceDetail workspaceId={workspaceId} onClose={() => setSearchParams({})} />
  }

  return <WorkspaceList onSelectWorkspace={(id) => setSearchParams({ workspace: id })} />
}

function WorkspaceList({ onSelectWorkspace }: { onSelectWorkspace: (id: string) => void }) {
  const { t } = useTranslation()
  const { data: workspaces, isLoading, error } = useGetWorkspaces()
  const { data: projects } = useGetProjects()
  const { data: templates = [] } = useGetAgentTemplates()
  const { data: models = [] } = useGetAgentModels()
  const { data: envDefaults } = useGetEnvironmentVariablesDefaults()
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBaseUrl, setNewBaseUrl] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [templateId, setTemplateId] = useState('generic')
  const [newRole, setNewRole] = useState<WorkspaceRole>('generic')
  const [newModel, setNewModel] = useState('default')
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariableValue[]>([])
  const [showEnvVars, setShowEnvVars] = useState(false)
  const createWorkspace = useCreateWorkspace()

  // Generate agent modal state
  const navigate = useNavigate()
  const generateAgent = useGenerateAgent()
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentRole, setAgentRole] = useState('')
  const [agentDescription, setAgentDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // Filter state
  const [filterProjectId, setFilterProjectId] = useState('')

  // Filter workspaces based on selected project
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return []
    if (!filterProjectId) return workspaces
    return workspaces.filter((workspace: Workspace) => workspace.project_id === filterProjectId)
  }, [workspaces, filterProjectId])

  // Load environment variable defaults when form opens or env defaults change
  useEffect(() => {
    if (showNewForm && envDefaults?.flat) {
      // Set default base URL from environment variables if available
      if (!newBaseUrl) {
        const defaultBaseUrl = envDefaults.flat['ANTHROPIC_BASE_URL']
        if (defaultBaseUrl) {
          setNewBaseUrl(defaultBaseUrl)
        }
      }

      // Initialize environment variables with defaults if not already set
      if (environmentVariables.length === 0) {
        const defaultVars: EnvironmentVariableValue[] = Object.entries(envDefaults.flat).map(
          ([key, value]) => ({
            key,
            value,
            isDefault: true,
          })
        )
        setEnvironmentVariables(defaultVars)
      }
    }
  }, [showNewForm, envDefaults, newBaseUrl, environmentVariables.length])

  const handleRoleChange = (role: WorkspaceRole) => {
    setNewRole(role)
    setNewModel(ROLE_DEFAULT_MODEL[role] || 'default')
  }

  const canCreate = newName.trim().length > 0 && newProjectId.length > 0

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canCreate) return

    // Convert environment variables to record
    const envVarsRecord = environmentVariables.reduce((acc, envVar) => {
      if (envVar.key && envVar.value) {
        acc[envVar.key] = envVar.value
      }
      return acc
    }, {} as Record<string, string>)

    createWorkspace.mutate(
      {
        name: newName,
        anthropic_base_url: newBaseUrl || undefined,
        project_id: newProjectId,
        template_id: templateId,
        role: newRole,
        model: newModel,
        environment_variables: Object.keys(envVarsRecord).length > 0 ? envVarsRecord : undefined,
      },
      {
        onSuccess: () => {
          setNewName('')
          setNewBaseUrl('')
          setNewProjectId('')
          setTemplateId('generic')
          setNewRole('generic')
          setNewModel('default')
          setEnvironmentVariables([])
          setShowEnvVars(false)
          setShowNewForm(false)
        },
      }
    )
  }

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setGenerateError('')
      const result = await generateAgent.mutateAsync({
        projectId: selectedProjectId,
        name: agentName,
        role: agentRole,
        description: agentDescription,
      })
      const data = (result as any)?.data || result
      setShowGenerateModal(false)
      // Reset form
      setSelectedProjectId('')
      setAgentName('')
      setAgentRole('')
      setAgentDescription('')
      // Navega para o workflow gerado
      navigate(`/plans/${data.plan_id}`)
    } catch (err) {
      setGenerateError('Failed to start agent generation. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const slugify = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  }

  const getPathPreview = () => {
    if (!newProjectId || !newName) return null
    const proj = projects?.find(p => p.id === newProjectId)
    if (!proj) return null
    const projectSlug = slugify(proj.name)
    const agentSlug = slugify(newName)
    return `projects/${projectSlug}/agents/${agentSlug}/`
  }

  if (isLoading) return <div className="p-8">Loading...</div>
  if (error) return <div className="p-4 sm:p-8 text-red-600">Error loading agents</div>

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4 sm:px-6">
      <PageHeader
        title={t('pages.agents.title')}
        description={t('pages.agents.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowGenerateModal(true)} className="text-xs sm:text-sm">
              <Wand2 size={14} /> <span className="hidden sm:inline">{t('pages.agents.header.generateAgent')}</span><span className="sm:hidden">{t('pages.agents.header.generate')}</span>
            </Button>
            <Button variant="primary" onClick={() => setShowNewForm(!showNewForm)} className="text-xs sm:text-sm">
              <Plus size={14} /> <span className="hidden sm:inline">{t('pages.agents.header.newAgent')}</span><span className="sm:hidden">{t('pages.agents.header.new')}</span>
            </Button>
          </div>
        }
      />

      {projects && projects.length > 0 && (
        <div className="flex justify-end mb-4 sm:mb-6">
          <div style={{ width: 'fit-content' }}>
            <ProjectSelectDropdown
              label="Project"
              value={filterProjectId}
              onChange={(value) => setFilterProjectId(value)}
              projects={projects}
              showAllOption
              allOptionLabel={t('pages.agents.filters.allProjects')}
              placeholder={t('pages.agents.filters.allProjects')}
              className="w-40 sm:w-auto"
            />
          </div>
        </div>
      )}

      {showNewForm && (
        <Card className="mb-4 sm:mb-6">
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <ProjectSelectDropdown
                label="Project *"
                value={newProjectId}
                onChange={(value) => setNewProjectId(value)}
                projects={projects || []}
                required
                className="sm:col-span-1"
              />
              <div>
                <Input
                  label="Agent name *"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="frontend-dev"
                />
                {getPathPreview() && (
                  <p className="text-xs font-mono text-gray-400 mt-1 break-all">
                    {getPathPreview()}
                  </p>
                )}
              </div>
              <Select
                label="CLAUDE.md Template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="sm:col-span-2"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label} — {t.description}</option>
                ))}
              </Select>
              <Select
                label="Role"
                value={newRole}
                onChange={(e) => handleRoleChange(e.target.value as WorkspaceRole)}
                className="sm:col-span-2"
              >
                <option value="planner">Planner — analisa e gera planos de execução</option>
                <option value="coder">Coder — implementa código</option>
                <option value="reviewer">Reviewer — revisa e valida implementações</option>
                <option value="tester">Tester — escreve e executa testes</option>
                <option value="debugger">Debugger — diagnostica e corrige bugs</option>
                <option value="devops">DevOps — infra, deploy, CI/CD</option>
                <option value="generic">Generic — uso geral</option>
              </Select>
              <Select
                label="Model"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                className="sm:col-span-2"
              >
                {models.map((m: AgentModel) => (
                  <option key={m.id} value={m.id}>{m.label} — {m.description}</option>
                ))}
              </Select>
              {newModel === 'claude-opus-4-6' && (
                <div className="sm:col-span-2 rounded bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-xs text-amber-600 font-medium">
                    ⚡ Opus uses more tokens per request but provides superior reasoning
                  </p>
                </div>
              )}
              {newModel === 'claude-haiku-4-5-20251001' && (
                <div className="col-span-2 rounded bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="text-xs text-blue-600 font-medium">
                    ⚡ Haiku is fast but less capable for complex tasks
                  </p>
                </div>
              )}
              {templateId && templates.find(t => t.id === templateId) && (
                <div className="col-span-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <p className="text-xs text-gray-500 font-medium">
                    {templates.find(t => t.id === templateId)?.description}
                  </p>
                </div>
              )}

              {/* Environment Variables Section */}
              <div className="col-span-2">
                <button
                  type="button"
                  onClick={() => setShowEnvVars(!showEnvVars)}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-500 mb-2 flex items-center gap-2"
                >
                  <span>{showEnvVars ? '▼' : '▶'}</span>
                  Environment Variables ({environmentVariables.length})
                </button>

                {showEnvVars && (
                  <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <EnvironmentVariablesForm
                      values={environmentVariables}
                      onChange={setEnvironmentVariables}
                      title=""
                      description="These variables will be used as defaults for this agent. You can override them when needed."
                    />
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <Input
                  label="Anthropic Base URL"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="http://localhost:8083"
                />
                {envDefaults?.flat['ANTHROPIC_BASE_URL'] && newBaseUrl === envDefaults.flat['ANTHROPIC_BASE_URL'] && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <span className="font-medium">📋 Default from environment variables</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">Configure in Settings</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={!canCreate || createWorkspace.isPending}
              >
                {createWorkspace.isPending ? 'Creating...' : 'Create Agent'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowNewForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {filteredWorkspaces && (
        <p className="text-sm text-gray-600 mb-4">
          {filterProjectId
            ? t('pages.agents.showing.fromProject', { count: filteredWorkspaces.length, plural: filteredWorkspaces.length !== 1 ? 's' : '', project: projects?.find(p => p.id === filterProjectId)?.name || 'selected project' })
            : t('pages.agents.showing.fromAll', { count: filteredWorkspaces.length, plural: filteredWorkspaces.length !== 1 ? 's' : '' })
          }
        </p>
      )}

      {filteredWorkspaces && filteredWorkspaces.length > 0 ? (
        <div className="overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    {t('pages.agents.table.agentName')}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    {t('pages.agents.table.project')}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    {t('pages.agents.table.role')}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    {t('pages.agents.table.model')}
                  </th>
                  <th scope="col" className="relative px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                {filteredWorkspaces.map((ws: Workspace) => (
                  <WorkspaceTableRow
                    key={ws.id}
                    workspace={ws}
                    projects={projects || []}
                    onSelectWorkspace={() => onSelectWorkspace(ws.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No agents yet"
          description="Create your first agent workspace to get started"
        />
      )}

      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Generate Contextual Agent</h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project *
                </label>
                <ProjectSelectDropdown
                  value={selectedProjectId}
                  onChange={(value) => setSelectedProjectId(value)}
                  projects={projects || []}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pages.agents.form.title')} *
                </label>
                <Input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="frontend-specialist"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  A short, memorable identifier for the agent
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role *
                </label>
                <Select
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a role...</option>
                  <option value="planner">Planner — analyzes and plans work</option>
                  <option value="coder">Coder — implements features and fixes bugs</option>
                  <option value="reviewer">Reviewer — reviews code quality</option>
                  <option value="tester">Tester — writes and executes tests</option>
                  <option value="debugger">Debugger — diagnoses and fixes errors</option>
                  <option value="devops">DevOps — manages CI/CD and infrastructure</option>
                  <option value="generic">Generic — general purpose agent</option>
                </Select>
                {agentRole && ROLE_HINTS[agentRole] && (
                  <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                    {ROLE_HINTS[agentRole]}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('pages.agents.form.description')}
                </label>
                <textarea
                  value={agentDescription}
                  onChange={(e) => setAgentDescription(e.target.value)}
                  placeholder="What this agent specializes in and its main responsibilities..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {generateError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {generateError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={!selectedProjectId || !agentName || !agentRole || generating}
                  className="flex-1"
                >
                  {generating ? t('pages.agents.header.generating') : t('pages.agents.header.generateAgent')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={generating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function WorkspaceTableRow({
  workspace,
  projects,
  onSelectWorkspace,
}: {
  workspace: Workspace
  projects: any[]
  onSelectWorkspace: () => void
}) {
  const { t } = useTranslation()
  const updateWorkspaceRole = useUpdateWorkspaceRole()
  const updateWorkspaceProject = useUpdateWorkspaceProject()
  const updateWorkspaceModel = useUpdateWorkspaceModel()
  const { data: models = [] } = useGetAgentModels()
  const [isEditingRole, setIsEditingRole] = useState(false)
  const [role, setRole] = useState<WorkspaceRole>(workspace.role || 'generic')
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [selectedProject, setSelectedProject] = useState(workspace.project_id || '')

  // Find the correct project using workspace.project_id
  const agentProject = projects.find(p => p.id === workspace.project_id)

  const handleRoleUpdate = (newRole: WorkspaceRole) => {
    updateWorkspaceRole.mutate(
      { id: workspace.id, role: newRole },
      {
        onSuccess: () => {
          setRole(newRole)
          setIsEditingRole(false)
        },
      }
    )
  }

  const handleProjectUpdate = (newProjectId: string) => {
    updateWorkspaceProject.mutate(
      { id: workspace.id, project_id: newProjectId },
      {
        onSuccess: () => {
          setSelectedProject(newProjectId)
          setIsEditingProject(false)
        },
      }
    )
  }

  return (
    <>
      <tr className={cn('hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors')}>
        {/* Agent Name */}
        <td className="whitespace-nowrap px-3 py-4 text-sm">
          <button
            onClick={onSelectWorkspace}
            className="text-gray-900 dark:text-white font-medium hover:text-indigo-600 dark:hover:text-indigo-500 transition-colors"
          >
            {workspace.name}
          </button>
        </td>

        {/* Project */}
        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
          {isEditingProject ? (
            <Select
              value={selectedProject}
              onChange={(e) => handleProjectUpdate(e.target.value)}
              className="h-8 text-xs py-1"
            >
              <option value="">{t('pages.agents.table.noProject')}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          ) : (
            <div
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setIsEditingProject(true)}
            >
              {agentProject ? (
                <>
                  <ProjectIcon project={agentProject} size={16} />
                  <span>{agentProject.name}</span>
                </>
              ) : (
                <span className="text-gray-400">{t('pages.agents.table.noProject')}</span>
              )}
            </div>
          )}
        </td>

        {/* Role */}
        <td className="whitespace-nowrap px-3 py-4 text-sm">
          {isEditingRole ? (
            <Select
              value={role}
              onChange={(e) => handleRoleUpdate(e.target.value as WorkspaceRole)}
              className="h-8 text-xs py-1"
            >
              <option value="planner">Planner</option>
              <option value="coder">Coder</option>
              <option value="reviewer">Reviewer</option>
              <option value="tester">Tester</option>
              <option value="debugger">Debugger</option>
              <option value="devops">DevOps</option>
              <option value="generic">Generic</option>
            </Select>
          ) : (
            <span
              onClick={() => setIsEditingRole(true)}
              className={cn(
                'inline-flex items-center px-2 py-1 text-xs font-medium rounded border cursor-pointer hover:opacity-80 transition-opacity',
                ROLE_COLORS[role]?.bg,
                ROLE_COLORS[role]?.text,
                ROLE_COLORS[role]?.border
              )}
            >
              {ROLE_COLORS[role]?.label || 'Generic'}
            </span>
          )}
        </td>

        {/* Model */}
        <td className="whitespace-nowrap px-3 py-4 text-sm">
          <select
            value={workspace.model || 'default'}
            onChange={(e) => updateWorkspaceModel.mutate({ id: workspace.id, model: e.target.value })}
            className="text-sm border border-gray-200 rounded px-2 py-1 text-gray-700 bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900"
          >
            {models.map((m: AgentModel) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </td>

        {/* Actions */}
        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={onSelectWorkspace}
              size="sm"
              variant="secondary"
            >
              {t('pages.agents.table.view')}
            </Button>
          </div>
        </td>
      </tr>
    </>
  )
}

function WorkspaceDetail({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: workspace, isLoading, error } = useGetWorkspace(workspaceId)
  const [activeTab, setActiveTab] = useState<'claude' | 'settings' | 'skills' | 'agents' | 'environments'>('claude')
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const renameAgent = useRenameAgent()
  const deleteWorkspace = useDeleteWorkspace()

  // Update newName when workspace loads
  if (workspace && newName !== workspace.name) {
    setNewName(workspace.name)
  }

  const handleDelete = () => {
    setIsDeleting(true)
    deleteWorkspace.mutate(workspaceId, {
      onSuccess: () => {
        onClose()
      },
      onError: () => setIsDeleting(false)
    })
  }

  const handleRename = () => {
    if (newName && workspace && newName !== workspace.name) {
      renameAgent.mutate(
        { id: workspaceId, name: newName },
        {
          onSuccess: () => {
            setEditingName(false)
            // Redirect to new ID (the rename endpoint returns the new base64 ID)
            window.location.href = `/agents?workspace=${newName}`
          },
        }
      )
    } else {
      setEditingName(false)
    }
  }

  if (isLoading) return <div className="p-8">Loading agent...</div>
  if (error) return <div className="p-8 text-red-600">Error loading agent</div>
  if (!workspace) return null

  return (
    <>
    <div className="max-w-4xl mx-auto py-8 px-6">
      <button onClick={onClose} className="text-blue-600 hover:text-blue-800 text-sm mb-4">
        ← Back to Agents
      </button>
      <div className="flex justify-between items-start mb-6">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                pattern="[a-zA-Z0-9_-]+"
                placeholder="agent-name"
                className="w-64"
              />
              <Button
                onClick={handleRename}
                disabled={renameAgent.isPending || !newName || !/^[a-zA-Z0-9_-]+$/.test(newName)}
                size="sm"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingName(false)
                  setNewName(workspace?.name || '')
                }}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">{workspace.name}</h1>
              <Button
                variant="ghost"
                onClick={() => setEditingName(true)}
                title="Rename agent"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete agent"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-1">{workspace.path}</p>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <TabButton active={activeTab === 'claude'} onClick={() => setActiveTab('claude')}>
            <FileText size={18} />
            {t('pages.agents.tabs.claudeMd')}
          </TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            <SettingsIcon size={18} />
            {t('pages.agents.tabs.settings')}
          </TabButton>
          <TabButton active={activeTab === 'skills'} onClick={() => setActiveTab('skills')}>
            <Code size={18} />
            {t('pages.agents.tabs.skills')} ({workspace.skills.length})
          </TabButton>
          <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')}>
            <Users size={18} />
            {t('pages.agents.tabs.agents')} ({workspace.agents.length})
          </TabButton>
          <TabButton active={activeTab === 'environments'} onClick={() => setActiveTab('environments')}>
            <Link2 size={18} />
            {t('pages.agents.tabs.environments')}
          </TabButton>
        </nav>
      </div>

      {activeTab === 'claude' && <ClaudeMdTab workspaceId={workspaceId} content={workspace.claudeMd} />}
      {activeTab === 'settings' && <SettingsTab workspaceId={workspaceId} settings={workspace.settings} />}
      {activeTab === 'skills' && <SkillsTab workspaceId={workspaceId} skills={workspace.skills} />}
      {activeTab === 'agents' && <AgentsTab workspaceId={workspaceId} agents={workspace.agents} />}
      {activeTab === 'environments' && <EnvironmentsTab workspaceId={workspaceId} />}
    </div>

    <ConfirmDialog
      open={showDeleteConfirm}
      title="Delete Agent"
      description={`Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`}
      variant="danger"
      confirmLabel="Delete"
      onConfirm={handleDelete}
      onCancel={() => setShowDeleteConfirm(false)}
      loading={isDeleting}
    />
    </>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function ClaudeMdTab({ workspaceId, content }: { workspaceId: string; content: string | null }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(content || '')
  const [improvedContent, setImprovedContent] = useState('')
  const [showImprovementModal, setShowImprovementModal] = useState(false)
  const [improvementPlanId, setImprovementPlanId] = useState<string | null>(null)
  const [improvementError, setImprovementError] = useState<string | null>(null)
  const [showedStartToast, setShowedStartToast] = useState(false)

  // Ref to preserve planId for modal after cleanup
  const modalPlanIdRef = useRef<string | null>(null)
  // Ref to track if we've already shown the modal for the current improvement
  const hasShownModalForContentRef = useRef(false)

  const saveClaudeMd = useSaveClaudeMd(workspaceId)
  const improveClaudeMd = useImproveClaudeMd()
  const { showToast } = useToast()

  // LocalStorage key for persisting improvement plan ID
  const improvementStorageKey = `claude-md-improvement-${workspaceId}`

  // Load improvement plan ID from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(improvementStorageKey)
      if (stored) {
        const data = JSON.parse(stored)
        // Check if the stored improvement is recent (within 1 hour)
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        if (data.timestamp && data.timestamp > oneHourAgo && data.planId) {
          setImprovementPlanId(data.planId)
        } else {
          // Clear stale data
          localStorage.removeItem(improvementStorageKey)
        }
      }
    } catch (error) {
      console.error('Error loading improvement state from localStorage:', error)
    }
  }, [improvementStorageKey])

  // Save improvement plan ID to localStorage when it changes
  useEffect(() => {
    try {
      if (improvementPlanId) {
        localStorage.setItem(
          improvementStorageKey,
          JSON.stringify({
            planId: improvementPlanId,
            timestamp: Date.now(),
          })
        )
      } else {
        // Clear from localStorage when improvement completes or is discarded
        localStorage.removeItem(improvementStorageKey)
      }
    } catch (error) {
      console.error('Error saving improvement state to localStorage:', error)
    }
  }, [improvementPlanId, improvementStorageKey])

  // Use the new polling hook to track improvement status
  const { improvedContent: polledImprovedContent, isImproving, error: pollingError } = useImprovementStatus(
    improvementPlanId,
    improvementPlanId !== null
  )

  // Show toast when improvement starts
  useEffect(() => {
    if ((improveClaudeMd.isPending || isImproving) && !showedStartToast) {
      console.log(`[${new Date().toISOString()}] [ClaudeMdTab] 🎯 Showing improvement start toast`, {
        isMutationPending: improveClaudeMd.isPending,
        isPolling: isImproving,
        planId: improvementPlanId,
        workspaceId
      })
      showToast('info', 'AI Improvement Started', 'Your CLAUDE.md is being analyzed and improved...')
      setShowedStartToast(true)
    } else if (!improveClaudeMd.isPending && !isImproving) {
      setShowedStartToast(false)
    }
  }, [improveClaudeMd.isPending, isImproving, showedStartToast, showToast, improvementPlanId, workspaceId])

  // Handle successful improvement completion
  useEffect(() => {
    if (polledImprovedContent && !hasShownModalForContentRef.current) {
      console.log(`[${new Date().toISOString()}] [ClaudeMdTab] 🎉 Improvement completed! Modal opening`, {
        planId: improvementPlanId,
        contentLength: polledImprovedContent.length,
        currentModalState: showImprovementModal,
        workspaceId
      })

      // Preserve planId for modal before cleanup
      modalPlanIdRef.current = improvementPlanId

      // Mark that we've shown the modal for this content
      hasShownModalForContentRef.current = true

      // Set improved content - the useEffect in the modal will sync it
      setImprovedContent(polledImprovedContent)
      setShowImprovementModal(true)
      setImprovementPlanId(null) // Clear the plan ID after completion (this also clears localStorage)
      setImprovementError(null)
      setShowedStartToast(false)
      showToast('success', 'Improvement Complete!', 'Review the AI-suggested changes below.')
    }
  }, [polledImprovedContent, showToast, improvementPlanId, showImprovementModal, workspaceId])

  // Handle polling error (timeout or other errors)
  useEffect(() => {
    if (pollingError) {
      console.error(`[${new Date().toISOString()}] [ClaudeMdTab] ❌ Improvement polling error`, {
        planId: improvementPlanId,
        error: pollingError,
        workspaceId
      })
      setImprovementError(pollingError)
      // Don't clear planId on error - keep it so user can check the plan
      setShowedStartToast(false)

      // Show error with plan ID reference
      const planId = improvementPlanId
      const errorMessage = planId
        ? `${pollingError} Plan ID: ${planId.substring(0, 8)}... Check Plans page for details.`
        : pollingError
      showToast('error', 'Improvement Incomplete', errorMessage)
    }
  }, [pollingError, showToast, improvementPlanId, workspaceId])

  const handleImproveWithAI = async () => {
    console.log(`[${new Date().toISOString()}] [ClaudeMdTab] 🚀 Triggering AI improvement`, {
      workspaceId,
      currentContentLength: value.length,
      hasExistingPlanId: !!improvementPlanId
    })
    setImprovementError(null)
    // Reset the modal flag when starting a new improvement
    hasShownModalForContentRef.current = false
    try {
      const result = await improveClaudeMd.mutateAsync({
        workspaceId,
        currentContent: value,
      })

      console.log(`[${new Date().toISOString()}] [ClaudeMdTab] 📋 Improvement API response received`, {
        planId: result?.planId,
        taskId: result?.taskId,
        message: result?.message,
        workspaceId
      })

      if (result?.planId) {
        // Store the plan ID for polling instead of navigating
        console.log(`[${new Date().toISOString()}] [ClaudeMdTab] ✅ Plan ID stored, polling will start`, {
          planId: result.planId,
          workspaceId
        })
        setImprovementPlanId(result.planId)
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [ClaudeMdTab] ❌ Error improving CLAUDE.md`, {
        error: error instanceof Error ? error.message : String(error),
        workspaceId
      })
      setImprovementError('Failed to improve CLAUDE.md. Please try again.')
      setImprovementPlanId(null)
      // Clear localStorage on error
      try {
        localStorage.removeItem(improvementStorageKey)
      } catch (e) {
        console.error('Error clearing improvement state from localStorage:', e)
      }
    }
  }

  const handleApproveImprovement = (approvedContent: string) => {
    console.log(`[${new Date().toISOString()}] [ClaudeMdTab] ✅ User approved improvement`, {
      contentLength: approvedContent.length,
      workspaceId,
      willSaveToServer: true
    })
    setValue(approvedContent)
    setShowImprovementModal(false)
    saveClaudeMd.mutate(approvedContent)
    setImprovedContent('')
    modalPlanIdRef.current = null // Clear the preserved planId
    // Note: We DON'T reset hasShownModalForContentRef here because the modal is closing
    // and we want to prevent it from reopening for the same content
  }

  const handleDiscardImprovement = () => {
    console.log(`[${new Date().toISOString()}] [ClaudeMdTab] ❌ User discarded improvement`, {
      workspaceId,
      improvedContentLength: improvedContent.length
    })
    setShowImprovementModal(false)
    setImprovedContent('')
    modalPlanIdRef.current = null // Clear the preserved planId
    hasShownModalForContentRef.current = false // Reset the flag so we can show modal for future improvements
  }

  // Log modal state changes for debugging
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] [ClaudeMdTab] 🪟 Modal state changed`, {
      isOpen: showImprovementModal,
      hasImprovedContent: !!improvedContent,
      improvedContentLength: improvedContent.length,
      planId: improvementPlanId,
      isImproving,
      workspaceId
    })
  }, [showImprovementModal, improvedContent, improvementPlanId, isImproving, workspaceId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">CLAUDE.md Content</h3>
        <button
          onClick={handleImproveWithAI}
          disabled={improveClaudeMd.isPending || isImproving || !value.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-md disabled:hover:shadow-none"
        >
          {improveClaudeMd.isPending || isImproving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{t('pages.agents.claudeMd.improving')}</span>
            </>
          ) : (
            <>
              <Wand2 size={16} />
              <span>{t('pages.agents.claudeMd.improveWithAi')}</span>
            </>
          )}
        </button>
      </div>

      {/* Show error message if improvement fails */}
      {improvementError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{improvementError}</p>
        </div>
      )}

      {/* Show progress indicator while improving */}
      {(improveClaudeMd.isPending || isImproving) && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-200"></div>
              <div className="absolute top-0 left-0 animate-spin rounded-full h-6 w-6 border-3 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent"></div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-700">
                {improveClaudeMd.isPending ? 'Starting AI Improvement...' : 'AI is Analyzing & Improving Your CLAUDE.md...'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {improveClaudeMd.isPending ? 'Initializing workspace connection...' : 'This may take 30-60 seconds. Please wait.'}
              </p>
            </div>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full h-96 px-4 py-3 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="# CLAUDE.md content..."
      />

      <div className="flex gap-2">
        <button
          onClick={() => saveClaudeMd.mutate(value)}
          disabled={saveClaudeMd.isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saveClaudeMd.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <ClaudeMdImprovementModal
        isOpen={showImprovementModal}
        improvedContent={improvedContent}
        onApprove={handleApproveImprovement}
        onDiscard={handleDiscardImprovement}
        isLoading={saveClaudeMd.isPending}
      />
    </div>
  )
}

function SettingsTab({ workspaceId, settings }: { workspaceId: string; settings: any }) {
  const { t } = useTranslation()
  // env is an object like { KEY: 'value', KEY2: 'value2' }, convert to array of {key, value}
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(() =>
    Object.entries(settings?.env ?? {}).map(([key, value]) => ({ key, value: String(value) }))
  )
  const [permissions, setPermissions] = useState({
    allow: settings?.permissions?.allow || [],
    deny: settings?.permissions?.deny?.join('\n') || '',
  })
  const [additionalDirs, setAdditionalDirs] = useState<string[]>(
    settings?.permissions?.additionalDirectories || []
  )
  const saveSettings = useSaveSettings(workspaceId)

  const handleSave = () => {
    // Convert array of {key, value} back to object
    const envObject = Object.fromEntries(
      envVars.filter(e => e.key).map(e => [e.key, e.value])
    )
    const newSettings = {
      ...settings,
      env: envObject,
      permissions: {
        allow: permissions.allow,
        deny: permissions.deny.split('\n').filter(Boolean),
        additionalDirectories: additionalDirs,
      }
    }
    saveSettings.mutate(newSettings)
  }

  const permissionOptions = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Skill']

  return (
    <div className="space-y-6">
      {/* Env Vars */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('pages.agents.settingsTab.environmentVariables')}</h3>
        <div className="space-y-2">
          {envVars.map((env, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={env.key}
                onChange={(e) => {
                  const newVars = [...envVars]
                  newVars[i].key = e.target.value
                  setEnvVars(newVars)
                }}
                placeholder="KEY"
                className="flex-1"
              />
              <Input
                value={env.value}
                onChange={(e) => {
                  const newVars = [...envVars]
                  newVars[i].value = e.target.value
                  setEnvVars(newVars)
                }}
                placeholder="value"
                className="flex-1"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}>
            <Plus size={16} /> {t('pages.agents.settingsTab.addEnvVar')}
          </Button>
        </div>
      </Card>

      {/* Permissions */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('pages.agents.settingsTab.permissions')}</h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('pages.agents.settingsTab.allow')}</label>
          <div className="flex flex-wrap gap-2">
            {permissionOptions.map((perm) => (
              <label key={perm} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permissions.allow.includes(perm)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setPermissions({ ...permissions, allow: [...permissions.allow, perm] })
                    } else {
                      setPermissions({ ...permissions, allow: permissions.allow.filter((p: string) => p !== perm) })
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{perm}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('pages.agents.settingsTab.denyRules')}</label>
          <textarea
            value={permissions.deny}
            onChange={(e) => setPermissions({ ...permissions, deny: e.target.value })}
            className="w-full h-24 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={t('pages.agents.settingsTab.denyPlaceholder')}
          />
        </div>
      </Card>

      {/* Additional Directories */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('pages.agents.settingsTab.additionalDirectories')}</h3>
        <div className="space-y-2">
          {additionalDirs.map((dir, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={dir}
                onChange={(e) => {
                  const newDirs = [...additionalDirs]
                  newDirs[i] = e.target.value
                  setAdditionalDirs(newDirs)
                }}
                className="flex-1"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={() => setAdditionalDirs(additionalDirs.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setAdditionalDirs([...additionalDirs, ''])}>
            <Plus size={16} /> {t('pages.agents.settingsTab.addDirectory')}
          </Button>
        </div>
      </Card>

      <Button variant="primary" onClick={handleSave}>{t('pages.agents.settingsTab.saveSettings')}</Button>
    </div>
  )
}

function SkillsTab({ workspaceId, skills }: { workspaceId: string; skills: Array<{ name: string; hasSkillMd: boolean }> }) {
  const { t } = useTranslation()
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<string | null>(null)
  const [skillName, setSkillName] = useState('')
  const [skillContent, setSkillContent] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const importSkillRef = useRef<HTMLInputElement>(null)

  const installSkill = useInstallSkill(workspaceId)
  const deleteSkill = useDeleteSkill(workspaceId)
  const { data: skillData } = useGetSkill(workspaceId, editingSkill || '')
  const { data: nativeSkills = [] } = useGetNativeSkills()
  const installNativeSkill = useInstallNativeSkill()
  const importCustomSkill = useImportCustomSkill()

  const handleNewSkill = () => {
    setSkillName('')
    setSkillContent(`---
name: nova-skill
description: "Descreva quando usar esta skill"
---

# Nova Skill

## Quando usar

## Como usar
`)
    setShowNewForm(true)
  }

  const handleEdit = (skillName: string) => {
    setEditingSkill(skillName)
    setSkillName(skillName)
  }

  const handleSave = () => {
    installSkill.mutate(
      { name: skillName, content: skillContent },
      {
        onSuccess: () => {
          setShowNewForm(false)
          setEditingSkill(null)
          setSkillName('')
          setSkillContent('')
        },
      }
    )
  }

  const handleCancel = () => {
    setShowNewForm(false)
    setEditingSkill(null)
    setSkillName('')
    setSkillContent('')
  }

  const handleDelete = (skillName: string) => {
    setDeleteConfirm(skillName)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteSkill.mutate(deleteConfirm, {
        onSuccess: () => setDeleteConfirm(null)
      })
    }
  }

  const handleSkillFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const content = await file.text()
    // Nome da skill = nome do arquivo sem extensão
    const skillName = file.name.replace(/\.(md|txt|markdown)$/, '')

    await importCustomSkill.mutateAsync({
      workspaceId,
      skillName,
      content,
    })
    if (importSkillRef.current) {
      importSkillRef.current.value = ''
    }
  }

  // Update content when editing skill data loads
  if (editingSkill && skillData && skillContent === '') {
    setSkillContent(skillData.content)
  }

  const SKILL_TEMPLATE = `---
name: nova-skill
description: "Descreva quando usar esta skill"
---

# Nova Skill

## Quando usar

## Como usar
`

  // Get list of installed skill names
  const installedSkillNames = skills.map((s: any) => s.name)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">{t('pages.agents.skillsTab.title', { count: skills.length })}</h3>
        <div className="flex gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-gray-50">
            <Upload className="h-3.5 w-3.5" />
            {t('pages.agents.skillsTab.importMd')}
            <input
              ref={importSkillRef}
              type="file"
              accept=".md,.txt,.markdown"
              className="hidden"
              onChange={handleSkillFileImport}
            />
          </label>
          <Button variant="primary" onClick={handleNewSkill}>
            <Plus size={16} /> {t('pages.agents.skillsTab.newSkill')}
          </Button>
        </div>
      </div>

      {/* Native Skills Section */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('pages.agents.skillsTab.nativeSkills')}</h4>
        <div className="space-y-2">
          {nativeSkills.map(skill => {
            const isInstalled = installedSkillNames.includes(skill.id)
            return (
              <div key={skill.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">{skill.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{skill.description}</p>
                </div>
                {isInstalled ? (
                  <span className="text-xs text-green-600 font-medium">{t('pages.agents.skillsTab.installed')}</span>
                ) : (
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => installNativeSkill.mutate({ workspaceId, skillId: skill.id })}
                    disabled={installNativeSkill.isPending}
                  >
                    {installNativeSkill.isPending ? t('pages.agents.skillsTab.installing') : t('pages.agents.skillsTab.add')}
                  </Button>
                )}
              </div>
            )
          })}
          {nativeSkills.length === 0 && (
            <div className="text-sm text-gray-500 italic">{t('pages.agents.skillsTab.noNativeSkills')}</div>
          )}
        </div>
      </div>

      {/* Custom Skills Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('pages.agents.skillsTab.customSkills')}</h4>
        {(showNewForm || editingSkill) && (
          <Card>
            <div className="mb-3">
              <Input
                label="Name"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="my-skill"
                className="font-mono"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={skillContent}
                onChange={(e) => setSkillContent(e.target.value)}
                className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={SKILL_TEMPLATE}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={installSkill.isPending || !skillName || !skillContent}
                variant="primary"
              >
                {installSkill.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
            </div>
          </Card>
        )}

        <Card padding="none">
          <div className="divide-y divide-gray-200">
            {skills.map((skill) => (
              <div key={skill.name} className="p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Code size={18} className="text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{skill.name}</div>
                    {skill.hasSkillMd && (
                      <span className="text-xs text-green-600">✓ SKILL.md</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(skill.name)} title="Edit skill">
                    <Edit3 size={16} />
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(skill.name)} title="Delete skill">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
            {skills.length === 0 && (
              <EmptyState title={t('pages.agents.skillsTab.noCustomSkills')} />
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title={t('pages.agents.skillsTab.deleteTitle')}
        description={t('pages.agents.skillsTab.deleteConfirm', { name: deleteConfirm || '' })}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

function AgentsTab({ workspaceId, agents }: { workspaceId: string; agents: Array<{ name: string; file: string }> }) {
  const { t } = useTranslation()
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [agentName, setAgentName] = useState('')
  const [agentContent, setAgentContent] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const saveAgent = useSaveAgent(workspaceId)
  const deleteAgent = useDeleteAgent(workspaceId)
  const { data: agentData } = useGetAgent(workspaceId, editingAgent || '')
  const { data: nativeAgents = [] } = useGetNativeAgents()
  const installNativeAgent = useInstallNativeAgent()

  const installedAgentNames = agents.map((a: any) => a.name)

  const handleNewAgent = () => {
    setAgentName('')
    setAgentContent(`---
name: new-agent
description: "Descreva quando invocar este agente"
model: sonnet
tools: Read, Write, Edit, Bash, Glob
color: blue
---

# New Agent

Descreva a especialidade e comportamento deste agente.
`)
    setShowNewForm(true)
  }

  const handleEdit = (agentName: string) => {
    setEditingAgent(agentName)
    setAgentName(agentName)
  }

  const handleSave = () => {
    saveAgent.mutate(
      { name: agentName, content: agentContent },
      {
        onSuccess: () => {
          setShowNewForm(false)
          setEditingAgent(null)
          setAgentName('')
          setAgentContent('')
        },
      }
    )
  }

  const handleCancel = () => {
    setShowNewForm(false)
    setEditingAgent(null)
    setAgentName('')
    setAgentContent('')
  }

  const handleDelete = (agentName: string) => {
    setDeleteConfirm(agentName)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteAgent.mutate(deleteConfirm, {
        onSuccess: () => setDeleteConfirm(null)
      })
    }
  }

  // Update content when editing agent data loads
  if (editingAgent && agentData && agentContent === '') {
    setAgentContent(agentData.content)
  }

  const AGENT_TEMPLATE = `---
name: new-agent
description: "Descreva quando invocar este agente"
model: sonnet
tools: Read, Write, Edit, Bash, Glob
color: blue
---

# New Agent

Descreva a especialidade e comportamento deste agente.
`

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">{t('pages.agents.agentsTab.title', { count: agents.length })}</h3>
        <Button variant="primary" onClick={handleNewAgent}>
          <Plus size={16} /> {t('pages.agents.agentsTab.newAgent')}
        </Button>
      </div>

      {/* Native Agents Section */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('pages.agents.agentsTab.nativeAgents')}</h4>
        <div className="space-y-2">
          {nativeAgents.map(agent => {
            const isInstalled = installedAgentNames.includes(agent.name)
            return (
              <div key={agent.name} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-3">
                  {agent.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{agent.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Model: {agent.model} • Tools: {agent.tools}</p>
                  </div>
                </div>
                {isInstalled ? (
                  <span className="text-xs text-green-600 font-medium">{t('pages.agents.agentsTab.installed')}</span>
                ) : (
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => installNativeAgent.mutate({ workspaceId, agentName: agent.name })}
                    disabled={installNativeAgent.isPending}
                  >
                    {installNativeAgent.isPending ? t('pages.agents.agentsTab.installing') : t('pages.agents.agentsTab.add')}
                  </Button>
                )}
              </div>
            )
          })}
          {nativeAgents.length === 0 && (
            <div className="text-sm text-gray-500 italic">{t('pages.agents.agentsTab.noNativeAgents')}</div>
          )}
        </div>
      </div>

      {/* Custom Sub-Agents Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('pages.agents.agentsTab.customSubAgents')}</h4>
        {(showNewForm || editingAgent) && (
        <Card>
          <div className="mb-3">
            <Input
              label="Name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="my-agent"
              className="font-mono"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={agentContent}
              onChange={(e) => setAgentContent(e.target.value)}
              className="w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={AGENT_TEMPLATE}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saveAgent.isPending || !agentName || !agentContent}
              variant="primary"
            >
              {saveAgent.isPending ? t('pages.agents.agentsTab.saving') : t('pages.agents.agentsTab.save')}
            </Button>
            <Button variant="secondary" onClick={handleCancel}>{t('pages.agents.agentsTab.cancel')}</Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <div className="divide-y divide-gray-200">
          {agents.map((agent) => (
            <div key={agent.name} className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.file}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleEdit(agent.name)} title="Edit agent">
                  <Edit3 size={16} />
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(agent.name)} title="Delete agent">
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <EmptyState title={t('pages.agents.agentsTab.noSubAgents')} />
          )}
        </div>
      </Card>
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete Agent"
        description={`Are you sure you want to delete "${deleteConfirm}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}

function EnvironmentsTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation()
  const { data: linkedEnvs, isLoading } = useGetWorkspaceEnvironments(workspaceId)
  const { data: workspace } = useGetWorkspace(workspaceId)
  const { data: allEnvironments } = useGetAllEnvironments()
  const { data: projects } = useGetProjects()
  const [linkingEnv, setLinkingEnv] = useState(false)
  const [selectedEnvToLink, setSelectedEnvToLink] = useState('')

  const linkEnv = useLinkEnvironment()
  const unlinkEnv = useUnlinkEnvironment()

  // Identify the project of the agent
  const agentProjectId = workspace?.project_id ?? null

  // Filter environments by agent's project
  const availableEnvironments = useMemo(() => {
    if (!agentProjectId) {
      // Agent without project: show all environments with project indication
      return allEnvironments?.filter(
        env => !linkedEnvs?.some(linked => linked.id === env.id)
      ) || []
    }

    // Agent with project: show only environments from the same project
    const project = projects?.find(p => p.id === agentProjectId)
    const projectEnvs = project?.environments ?? []

    return projectEnvs
      .filter(env => !linkedEnvs?.some(linked => linked.id === env.id))
      .map(env => ({ ...env, project_name: project?.name ?? '' })) || []
  }, [agentProjectId, allEnvironments, linkedEnvs, projects])

  if (isLoading) return <div className="p-8">{t('pages.agents.environmentsTab.loading')}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{t('pages.agents.environmentsTab.linkedEnvironments')}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('pages.agents.environmentsTab.linkDescription')}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setLinkingEnv(true)}
          disabled={availableEnvironments.length === 0}
        >
          <Link2 size={16} /> {t('pages.agents.environmentsTab.linkEnvironment')}
        </Button>
      </div>

      {!linkedEnvs || linkedEnvs.length === 0 ? (
        <Card>
          <EmptyState
            title={t('pages.agents.environmentsTab.noEnvironmentsLinked')}
            description={t('pages.agents.environmentsTab.noEnvironmentsLinkedDesc')}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-gray-200">
            {linkedEnvs.map((env) => (
              <div key={env.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{env.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {env.type}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-gray-500">{env.project_path}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkEnv.mutate({ workspaceId, environment_id: env.id })}
                  title={t('pages.agents.environmentsTab.unlinkEnvironment')}
                  disabled={unlinkEnv.isPending}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {linkingEnv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setLinkingEnv(false)} />
          <div className="relative bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('pages.agents.environmentsTab.linkModalTitle')}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {agentProjectId
                ? t('pages.agents.environmentsTab.linkModalProjectDesc')
                : t('pages.agents.environmentsTab.linkModalAllDesc')}
            </p>

            {availableEnvironments.length === 0 ? (
              <div className="text-sm text-gray-500 mb-4">
                {agentProjectId
                  ? (
                    <>
                      {t('pages.agents.environmentsTab.noEnvironmentsForProject')}
                      <Link to="/projects" className="underline ml-1 text-blue-600 hover:text-blue-800">{t('pages.agents.environmentsTab.createInProjects')}</Link>
                    </>
                  )
                  : t('pages.agents.environmentsTab.noAvailableEnvironments')}
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {agentProjectId ? t('pages.agents.environmentsTab.environmentLabel') : t('pages.agents.environmentsTab.environmentAllLabel')}
                  </label>
                  <Select
                    value={selectedEnvToLink}
                    onChange={(e) => setSelectedEnvToLink(e.target.value)}
                  >
                    <option value="" disabled>{t('pages.agents.environmentsTab.selectEnvironment')}</option>
                    {availableEnvironments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {agentProjectId ? env.name : `${env.project_name} / ${env.name}`} - {env.type}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setLinkingEnv(false)
                      setSelectedEnvToLink('')
                    }}
                  >
                    {t('pages.agents.environmentsTab.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (selectedEnvToLink) {
                        linkEnv.mutate(
                          { workspaceId, environment_id: selectedEnvToLink },
                          {
                            onSuccess: () => {
                              setLinkingEnv(false)
                              setSelectedEnvToLink('')
                            }
                          }
                        )
                      }
                    }}
                    disabled={!selectedEnvToLink}
                    loading={linkEnv.isPending}
                  >
                    {t('pages.agents.environmentsTab.link')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
