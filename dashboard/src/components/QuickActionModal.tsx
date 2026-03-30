import { useState, useEffect, useRef } from 'react'
import { X, Zap, ChevronRight } from 'lucide-react'
import { Button, Select } from '@/components'
import { useCreateQuickAction } from '@/api/quickActions'
import { useGetProjects } from '@/api/projects'
import { useGetWorkspaces } from '@/api/workspaces'
import { useGetPlan } from '@/api/plans'
import { getApiUrl, getActiveToken } from '@/api/client'
import { useTranslation } from 'react-i18next'

interface QuickActionModalProps {
  onClose: () => void
}

export function QuickActionModal({ onClose }: QuickActionModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'form' | 'running' | 'result'>('form')
  const [projectId, setProjectId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [nativeSkill, setNativeSkill] = useState('planning')
  const [message, setMessage] = useState('')
  const [planId, setPlanId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ level: string; message: string; time: string }>>([])
  const [structuredOutput, setStructuredOutput] = useState<any>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const createAction = useCreateQuickAction()
  const { data: projects = [] } = useGetProjects()
  const { data: allWorkspaces = [] } = useGetWorkspaces(projectId ? { project_id: projectId } : undefined)
  const selectedProject = projects.find(p => p.id === projectId)
  const environments = selectedProject?.environments ?? []

  // When workspace changes, reset environment
  const handleWorkspaceChange = (wsId: string) => {
    setWorkspaceId(wsId)
    setEnvironmentId('')
  }

  // Poll for structured_output when running
  const { data: plan } = useGetPlan(planId ?? '')

  useEffect(() => {
    if (!plan) return
    if (plan.structured_output) {
      setStructuredOutput(plan.structured_output)
      setStep('result')
    } else if (plan.status === 'failed') {
      setStep('result')
    }
  }, [plan])

  // SSE for live logs
  useEffect(() => {
    if (!planId || step !== 'running') return

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

  const handleSubmit = async () => {
    if (!message.trim() || !workspaceId) return
    const result = await createAction.mutateAsync({
      message: message.trim(),
      workspace_id: workspaceId,
      environment_id: environmentId || undefined,
      project_id: projectId || undefined,
      native_skill: nativeSkill || undefined,
    })
    setPlanId(result.id)
    setStep('running')
  }

  const handleApprove = () => {
    // For now just show a success message
    // In the future, this could open the CreatePlanForm with prefillData
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={step === 'form' ? onClose : undefined} />
      <div className="relative bg-white rounded-lg border border-gray-200 w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">{t('components.quickAction.title')}</span>
            {step === 'running' && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full animate-pulse">{t('components.quickAction.running')}</span>
            )}
            {step === 'result' && structuredOutput && (
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{t('components.quickAction.outputReady')}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {step === 'form' && (
            <>
              {/* Project */}
              <Select
                label={t('components.quickAction.project')}
                value={projectId}
                onChange={e => { setProjectId(e.target.value); setWorkspaceId(''); setEnvironmentId('') }}
              >
                <option value="">{t('components.quickAction.allProjects')}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>

              {/* Agent */}
              <Select
                label={t('components.quickAction.agentRequired')}
                value={workspaceId}
                onChange={e => handleWorkspaceChange(e.target.value)}
                required
              >
                <option value="" disabled>{t('components.quickAction.selectAgent')}</option>
                {allWorkspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
              </Select>

              {/* Environment */}
              {environments.length > 0 && (
                <Select
                  label={t('components.quickAction.environment')}
                  value={environmentId}
                  onChange={e => setEnvironmentId(e.target.value)}
                >
                  <option value="">{t('components.quickAction.noSpecificEnvironment')}</option>
                  {environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              )}

              {/* Native Skill */}
              <Select
                label={t('components.quickAction.mode')}
                value={nativeSkill}
                onChange={e => setNativeSkill(e.target.value)}
              >
                <option value="">{t('components.quickAction.generalMode')}</option>
                <option value="planning">{t('components.quickAction.planningMode')}</option>
                <option value="reviewer">{t('components.quickAction.reviewMode')}</option>
                <option value="debugger">{t('components.quickAction.debugMode')}</option>
              </Select>

              {/* Message */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">{t('components.quickAction.requestRequired')}</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={nativeSkill === 'planning'
                    ? t('components.quickAction.planningPlaceholder')
                    : nativeSkill === 'reviewer'
                    ? t('components.quickAction.reviewPlaceholder')
                    : t('components.quickAction.debugPlaceholder')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                  rows={4}
                />
              </div>
            </>
          )}

          {(step === 'running' || step === 'result') && (
            <div className="space-y-3">
              {/* Live logs */}
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-gray-300 max-h-72 overflow-y-auto">
                {logs.length === 0 && (
                  <span className="text-gray-500">{t('components.quickAction.waitingForOutput')}</span>
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

              {/* Structured output result */}
              {step === 'result' && structuredOutput && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-800 capitalize">
                        {t('components.quickAction.typeReady', { type: structuredOutput.type })}
                      </p>
                      {structuredOutput.type === 'plan' && (
                        <p className="text-xs text-green-600 mt-1">
                          {t('components.quickAction.planInfo', {
                            count: structuredOutput.content?.tasks?.length ?? 0,
                            name: structuredOutput.content?.name ?? ''
                          })}
                        </p>
                      )}
                      {structuredOutput.type === 'review' && (
                        <p className="text-xs text-green-600 mt-1">
                          {t('components.quickAction.reviewInfo', {
                            status: structuredOutput.content?.status,
                            issues: structuredOutput.content?.issues?.length ?? 0
                          })}
                        </p>
                      )}
                      {structuredOutput.content?.summary && (
                        <p className="text-xs text-green-700 mt-2 italic">
                          {structuredOutput.content.summary.slice(0, 200)}
                        </p>
                      )}
                    </div>
                    {structuredOutput.type === 'plan' && (
                      <Button variant="primary" size="sm" onClick={handleApprove}>
                        {t('components.quickAction.reviewAndCreate')} <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 'result' && !structuredOutput && plan?.status === 'failed' && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs text-red-700">{t('components.quickAction.actionFailed')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('components.quickAction.close')}</Button>
          {step === 'form' && (
            <Button
              variant="primary" size="sm"
              onClick={handleSubmit}
              disabled={!message.trim() || !workspaceId}
              loading={createAction.isPending}
            >
              <Zap className="h-3.5 w-3.5" /> {t('components.quickAction.run')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
