import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { X, PenLine, Sparkles, Loader2, CheckCircle } from 'lucide-react'
import { Button, ProjectSelectDropdown, Select } from '@/components'
import { useGetProjects } from '@/api/projects'
import { useGetTeams } from '@/api/teams'
import { useAIGenerateWorkflow, useCreatePlan } from '@/api/plans'
import { getApiUrl, getActiveToken } from '@/api/client'
import { useTranslation } from 'react-i18next'
import {
  modalColors,
  darkModeModalColors,
  bgColors,
  darkModeBgColors,
  borderColors,
  darkModeBorderColors,
  textColors,
  darkModeTextColors,
  interactiveStates,
  darkModeInteractiveStates,
  successColors,
  darkModeSuccessColors,
  errorColors,
  darkModeErrorColors,
  infoColors,
  darkModeInfoColors,
  withDarkMode,
} from '@/lib/colors'

interface NewWorkflowModalProps {
  onClose: () => void
}

type ModalStep = 'choose' | 'manual' | 'ai-form' | 'ai-running' | 'ai-result'

export function NewWorkflowModal({ onClose }: NewWorkflowModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<ModalStep>('choose')

  // AI form state
  const [projectId, setProjectId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [description, setDescription] = useState('')
  const [planId, setPlanId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ level: string; message: string; time: string }>>([])
  const [generatedPlanData, setGeneratedPlanData] = useState<any>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const aiGenerate = useAIGenerateWorkflow()
  const createPlan = useCreatePlan()
  const { data: projects = [] } = useGetProjects()
  const { data: teams = [] } = useGetTeams(projectId ? { project_id: projectId } : undefined)
  const selectedProject = projects.find(p => p.id === projectId)
  const environments = selectedProject?.environments ?? []

  // SSE for live logs
  useEffect(() => {
    if (!planId || step !== 'ai-running') return

    const evtSource = new EventSource(
      `${getApiUrl()}/api/plans/${planId}/logs/stream?token=${getActiveToken()}`
    )
    evtSource.onmessage = (e) => {
      try {
        const log = JSON.parse(e.data)
        setLogs(prev => [...prev, { ...log, time: new Date().toLocaleTimeString() }])
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } catch {}
    }
    evtSource.onerror = () => evtSource.close()
    return () => evtSource.close()
  }, [planId, step])

  // Poll for plan completion
  useEffect(() => {
    if (!planId || step !== 'ai-running') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/plans/${planId}`, {
          headers: { 'Authorization': `Bearer ${getActiveToken()}` }
        })
        const json = await res.json()
        const plan = json.data

        if (plan?.status === 'success') {
          clearInterval(interval)
          // Read the generated plan from workflow files
          try {
            const filesRes = await fetch(`${getApiUrl()}/api/plans/${planId}/workflow-files`, {
              headers: { 'Authorization': `Bearer ${getActiveToken()}` }
            })
            const filesJson = await filesRes.json()
            const planJson = filesJson.data?.plan_json
            if (planJson && planJson.tasks && planJson.tasks.length > 0) {
              setGeneratedPlanData(planJson)
              setStep('ai-result')
            } else {
              // No plan.json generated, fall back to showing the planning plan
              navigate(`/plans/${planId}`)
              onClose()
            }
          } catch {
            // Failed to read workflow files, fall back
            navigate(`/plans/${planId}`)
            onClose()
          }
        } else if (plan?.status === 'failed') {
          clearInterval(interval)
          navigate(`/plans/${planId}`)
          onClose()
        }
      } catch {}
    }, 3000)

    return () => clearInterval(interval)
  }, [planId, step, navigate, onClose])

  const handleManualCreate = () => {
    navigate('/plans/new')
    onClose()
  }

  const handleAISubmit = async () => {
    if (!description.trim() || !projectId || !teamId) return

    try {
      const result = await aiGenerate.mutateAsync({
        description: description.trim(),
        project_id: projectId,
        team_id: teamId,
        environment_id: environmentId || undefined,
      })
      setPlanId(result.id)
      setStep('ai-running')
    } catch (err) {
      console.error('AI generation failed:', err)
    }
  }

  const handleCreateFromGenerated = async () => {
    if (!generatedPlanData || !projectId) return

    try {
      setCreateError(null)
      const result = await createPlan.mutateAsync({
        name: generatedPlanData.name || description.slice(0, 80),
        tasks: generatedPlanData.tasks,
        project_id: projectId,
      })
      navigate(`/plans/${result.id}`)
      onClose()
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create workflow')
    }
  }

  const handleProjectChange = (value: string) => {
    setProjectId(value)
    setTeamId('')
    setEnvironmentId('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)}`} onClick={step === 'choose' || step === 'ai-form' ? onClose : undefined} />
      <div className={`relative ${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg border ${withDarkMode(modalColors.border, darkModeModalColors.border)} w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-2">
            {step === 'ai-running' ? (
              <Loader2 className={`h-4 w-4 animate-spin ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
            ) : step === 'ai-result' ? (
              <CheckCircle className={`h-4 w-4 ${withDarkMode('text-green-600', 'dark:text-green-400')}`} />
            ) : (
              <Sparkles className={`h-4 w-4 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
            )}
            <span className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>
              {step === 'choose'
                ? t('components.newWorkflow.title')
                : step === 'ai-running'
                  ? t('components.newWorkflow.generating')
                  : step === 'ai-result'
                    ? t('components.newWorkflow.generatedTitle')
                    : t('components.newWorkflow.aiTitle')}
            </span>
            {step === 'ai-running' && (
              <span className={`text-xs ${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} ${withDarkMode(infoColors.text, darkModeInfoColors.text)} px-2 py-0.5 rounded-full animate-pulse`}>
                {t('components.newWorkflow.generating')}
              </span>
            )}
            {step === 'ai-result' && (
              <span className={`text-xs ${withDarkMode(successColors.bg, darkModeSuccessColors.bg)} ${withDarkMode(successColors.text, darkModeSuccessColors.text)} px-2 py-0.5 rounded-full`}>
                {t('components.newWorkflow.ready')}
              </span>
            )}
          </div>
          <button onClick={onClose} className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Step 1: Choose creation mode */}
          {step === 'choose' && (
            <div className="space-y-3">
              <p className={`text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                {t('components.newWorkflow.chooseDescription')}
              </p>

              {/* Manual option */}
              <button
                onClick={handleManualCreate}
                className={`w-full text-left p-4 rounded-lg border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} transition-colors group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${withDarkMode(bgColors.tertiary, darkModeBgColors.tertiary)}`}>
                    <PenLine className={`h-5 w-5 ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                      {t('components.newWorkflow.manualTitle')}
                    </p>
                    <p className={`text-xs mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                      {t('components.newWorkflow.manualDescription')}
                    </p>
                  </div>
                </div>
              </button>

              {/* AI option */}
              <button
                onClick={() => setStep('ai-form')}
                className={`w-full text-left p-4 rounded-lg border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} ${withDarkMode(interactiveStates.hoverBg, darkModeInteractiveStates.hoverBg)} transition-colors group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${withDarkMode('bg-orange-50', 'dark:bg-orange-900/20')}`}>
                    <Sparkles className={`h-5 w-5 ${withDarkMode('text-orange-600', 'dark:text-orange-400')}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                      {t('components.newWorkflow.aiTitle')}
                    </p>
                    <p className={`text-xs mt-1 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                      {t('components.newWorkflow.aiDescription')}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: AI form */}
          {step === 'ai-form' && (
            <>
              {/* Project */}
              <ProjectSelectDropdown
                label={t('components.newWorkflow.project')}
                value={projectId}
                onChange={handleProjectChange}
                projects={projects}
                placeholder={t('components.newWorkflow.selectProject')}
                required
              />

              {/* Team */}
              <Select
                label={t('components.newWorkflow.team')}
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                required
                disabled={!projectId}
              >
                <option value="" disabled>{t('components.newWorkflow.selectTeam')}</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.role})
                  </option>
                ))}
              </Select>
              {projectId && teams.length === 0 && (
                <p className={`text-xs ${withDarkMode('text-amber-600', 'dark:text-amber-400')}`}>
                  {t('components.newWorkflow.noTeams')}
                </p>
              )}

              {/* Environment */}
              {environments.length > 0 && (
                <Select
                  label={t('components.newWorkflow.environment')}
                  value={environmentId}
                  onChange={e => setEnvironmentId(e.target.value)}
                >
                  <option value="">{t('components.newWorkflow.noEnvironment')}</option>
                  {environments.map((env: any) => (
                    <option key={env.id} value={env.id}>
                      {env.name} ({env.type})
                    </option>
                  ))}
                </Select>
              )}

              {/* Description */}
              <div className="space-y-1">
                <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                  {t('components.newWorkflow.description')} *
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('components.newWorkflow.descriptionPlaceholder')}
                  className={`w-full border ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${withDarkMode(interactiveStates.focusRing, darkModeInteractiveStates.focusRing)}`}
                  rows={6}
                />
              </div>
            </>
          )}

          {/* Step 3: Running */}
          {step === 'ai-running' && (
            <div className="space-y-3">
              {/* Description reminder */}
              <div className={`rounded-lg border ${withDarkMode(infoColors.border, darkModeInfoColors.border)} ${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} p-3`}>
                <p className={`text-xs ${withDarkMode(infoColors.text, darkModeInfoColors.text)} mb-1 font-medium`}>
                  {t('components.newWorkflow.requestLabel')}
                </p>
                <p className={`text-xs ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                  {description.slice(0, 200)}{description.length > 200 ? '...' : ''}
                </p>
              </div>

              {/* Live logs */}
              <div className={`${withDarkMode(bgColors.inverted, darkModeBgColors.inverted)} rounded-lg p-4 font-mono text-xs text-gray-300 max-h-72 overflow-y-auto`}>
                {logs.length === 0 && (
                  <span className="text-gray-500">{t('components.newWorkflow.waitingForOutput')}</span>
                )}
                {logs.map((log, i) => (
                  <div key={i} className={`mb-0.5 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-amber-400' :
                    log.level === 'success' ? 'text-green-400' : 'text-gray-300'
                  }`}>
                    <span className="text-gray-600">{log.time} </span>
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Step 4: Result - show generated tasks and allow creation */}
          {step === 'ai-result' && generatedPlanData && (
            <div className="space-y-4">
              <div className={`rounded-lg border ${withDarkMode(successColors.border, darkModeSuccessColors.border)} ${withDarkMode(successColors.bg, darkModeSuccessColors.bg)} p-4`}>
                <p className={`text-sm font-semibold ${withDarkMode(successColors.textAlt, darkModeSuccessColors.textAlt)}`}>
                  {t('components.newWorkflow.planReadyInfo', {
                    count: generatedPlanData.tasks?.length ?? 0,
                    name: generatedPlanData.name ?? ''
                  })}
                </p>
              </div>

              {/* Task preview */}
              {generatedPlanData.tasks?.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
                    {t('components.newWorkflow.tasksPreview')}
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {generatedPlanData.tasks.map((task: any, idx: number) => (
                      <div
                        key={task.id || idx}
                        className={`rounded-md border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} p-3`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-mono ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                            #{idx + 1}
                          </span>
                          <span className={`text-sm font-medium ${withDarkMode(textColors.primary, darkModeTextColors.primary)}`}>
                            {task.name}
                          </span>
                          {task.depends_on?.length > 0 && (
                            <span className={`text-xs ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                              ({t('components.newWorkflow.dependsOn', { count: task.depends_on.length })})
                            </span>
                          )}
                        </div>
                        {task.prompt && (
                          <p className={`text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} line-clamp-2`}>
                            {task.prompt.slice(0, 150)}{task.prompt.length > 150 ? '...' : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {createError && (
                <div className={`rounded-lg border ${withDarkMode(errorColors.border, darkModeErrorColors.border)} ${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} p-3`}>
                  <p className={`text-xs ${withDarkMode(errorColors.textAlt, darkModeErrorColors.textAlt)}`}>{createError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} flex justify-between gap-2`}>
          <div>
            {(step === 'ai-form') && (
              <Button variant="secondary" size="sm" onClick={() => setStep('choose')}>
                {t('components.newWorkflow.back')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('components.newWorkflow.close')}
            </Button>
            {step === 'ai-form' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAISubmit}
                disabled={!description.trim() || !projectId || !teamId || aiGenerate.isPending}
                loading={aiGenerate.isPending}
              >
                <Sparkles className="h-3.5 w-3.5" /> {t('components.newWorkflow.generate')}
              </Button>
            )}
            {step === 'ai-result' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateFromGenerated}
                disabled={createPlan.isPending}
                loading={createPlan.isPending}
              >
                {t('components.newWorkflow.createWorkflow')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
