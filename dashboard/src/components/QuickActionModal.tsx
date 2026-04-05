import { useState, useEffect, useRef } from 'react'
import { X, Zap, ChevronRight, Paperclip } from 'lucide-react'
import { Button, Select } from '@/components'
import { FileAttachmentInput, type FileAttachment } from '@/components/FileAttachmentInput'
import { useCreateQuickAction } from '@/api/quickActions'
import { useGetProjects } from '@/api/projects'
import { useGetWorkspaces, useGetTeamEnvironments } from '@/api/teams'
import { useGetPlan } from '@/api/plans'
import { getApiUrl, getActiveToken } from '@/api/client'
import { useUploadFiles, getAttachmentUrl } from '@/api/uploads'
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

interface QuickActionModalProps {
  onClose: () => void
}

export function QuickActionModal({ onClose }: QuickActionModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'form' | 'running' | 'result'>('form')
  const [projectId, setProjectId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ level: string; message: string; time: string }>>([])
  const [structuredOutput, setStructuredOutput] = useState<any>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const createAction = useCreateQuickAction()
  const uploadFiles = useUploadFiles()
  const { data: projects = [] } = useGetProjects()
  const { data: allWorkspaces = [] } = useGetWorkspaces(projectId ? { project_id: projectId } : undefined)
  const selectedProject = projects.find(p => p.id === projectId)
  const environments = selectedProject?.environments ?? []
  const { data: teamEnvironments = [] } = useGetTeamEnvironments(teamId)

  // When workspace changes, auto-select the first linked environment (if any)
  const handleWorkspaceChange = (wsId: string) => {
    setTeamId(wsId)
    setEnvironmentId('')
  }

  // Auto-select the team's first linked environment when it becomes available
  useEffect(() => {
    if (teamId && teamEnvironments.length > 0 && !environmentId) {
      // Try to match with project environments
      const match = teamEnvironments.find(te =>
        environments.some(e => e.id === te.id)
      )
      if (match) {
        setEnvironmentId(match.id)
      }
    }
  }, [teamId, teamEnvironments, environmentId, environments])

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
    if (!message.trim() || !teamId) return

    let attachmentIds: string[] = []

    // Upload attachments if any
    if (attachments.length > 0) {
      const pendingFiles = attachments
        .filter(a => a.status === 'pending')
        .map(a => a.file)

      if (pendingFiles.length > 0) {
        setAttachments(prev =>
          prev.map(a =>
            a.status === 'pending' ? { ...a, status: 'uploading' as const } : a
          )
        )
        try {
          const uploaded = await uploadFiles.mutateAsync(pendingFiles)
          attachmentIds = uploaded.map(u => u.id)
          setAttachments(prev =>
            prev.map(a => {
              if (a.status !== 'uploading') return a
              const match = uploaded.find(u => u.file_name === a.file.name)
              return match
                ? { ...a, status: 'uploaded' as const, serverData: match }
                : a
            })
          )
        } catch {
          setAttachments(prev =>
            prev.map(a =>
              a.status === 'uploading' ? { ...a, status: 'error' as const } : a
            )
          )
          return
        }
      }

      // Collect IDs from already-uploaded attachments too
      const alreadyUploaded = attachments
        .filter(a => a.status === 'uploaded' && a.serverData)
        .map(a => a.serverData!.id)
      attachmentIds = [...alreadyUploaded, ...attachmentIds]
    }

    const result = await createAction.mutateAsync({
      message: message.trim(),
      team_id: teamId,
      environment_id: environmentId || undefined,
      project_id: projectId || undefined,
      attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
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
      <div className={`absolute inset-0 ${withDarkMode(modalColors.overlay, darkModeModalColors.overlay)}`} onClick={step === 'form' ? onClose : undefined} />
      <div className={`relative ${withDarkMode(modalColors.panel, darkModeModalColors.panel)} rounded-lg border ${withDarkMode(modalColors.border, darkModeModalColors.border)} w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}>
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`} />
            <span className={`text-sm font-semibold ${withDarkMode(modalColors.header, darkModeModalColors.header)}`}>{t('components.quickAction.title')}</span>
            {step === 'running' && (
              <span className={`text-xs ${withDarkMode(infoColors.bg, darkModeInfoColors.bg)} ${withDarkMode(infoColors.text, darkModeInfoColors.text)} px-2 py-0.5 rounded-full animate-pulse`}>{t('components.quickAction.running')}</span>
            )}
            {step === 'result' && structuredOutput && (
              <span className={`text-xs ${withDarkMode(successColors.bg, darkModeSuccessColors.bg)} ${withDarkMode(successColors.text, darkModeSuccessColors.text)} px-2 py-0.5 rounded-full`}>{t('components.quickAction.outputReady')}</span>
            )}
          </div>
          <button onClick={onClose} className={`${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${withDarkMode('hover:text-gray-600', 'dark:hover:text-gray-300')}`}>
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
                onChange={e => { setProjectId(e.target.value); setTeamId(''); setEnvironmentId('') }}
              >
                <option value="">{t('components.quickAction.allProjects')}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>

              {/* Agent */}
              <Select
                label={t('components.quickAction.agentRequired')}
                value={teamId}
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

              {/* Message */}
              <div className="space-y-1">
                <label className={`block text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>{t('components.quickAction.requestRequired')}</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('components.quickAction.defaultPlaceholder')}
                  className={`w-full border ${withDarkMode(borderColors.thick, darkModeBorderColors.thick)} rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${withDarkMode(interactiveStates.focusRing, darkModeInteractiveStates.focusRing)}`}
                  rows={4}
                />
              </div>

              {/* File Attachments */}
              <FileAttachmentInput
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                maxFiles={5}
                maxSize={10 * 1024 * 1024}
              />
            </>
          )}

          {(step === 'running' || step === 'result') && (
            <div className="space-y-3">
              {/* Attachments indicator */}
              {attachments.length > 0 && (
                <div className={`flex items-center gap-2 text-xs ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)}`}>
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>
                    {t('components.quickAction.attachmentsIncluded', { count: attachments.length })}
                  </span>
                  {/* Show small image previews for image attachments */}
                  <div className="flex gap-1.5 ml-1">
                    {attachments
                      .filter(a => a.preview)
                      .slice(0, 4)
                      .map(a => (
                        <img
                          key={a.id}
                          src={a.serverData ? getAttachmentUrl(a.serverData.id) : a.preview!}
                          alt={a.file.name}
                          className={`h-6 w-6 rounded object-cover border ${withDarkMode(borderColors.default, darkModeBorderColors.default)}`}
                        />
                      ))}
                    {attachments.filter(a => a.preview).length > 4 && (
                      <span className={`text-[10px] ${withDarkMode(textColors.muted, darkModeTextColors.muted)} self-center`}>
                        +{attachments.filter(a => a.preview).length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Live logs */}
              <div className={`${withDarkMode(bgColors.inverted, darkModeBgColors.inverted)} rounded-lg p-4 font-mono text-xs text-gray-300 max-h-72 overflow-y-auto`}>
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
                <div className={`rounded-lg border ${withDarkMode(successColors.border, darkModeSuccessColors.border)} ${withDarkMode(successColors.bg, darkModeSuccessColors.bg)} p-4`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-sm font-semibold ${withDarkMode(successColors.textAlt, darkModeSuccessColors.textAlt)} capitalize`}>
                        {t('components.quickAction.typeReady', { type: structuredOutput.type })}
                      </p>
                      {structuredOutput.type === 'plan' && (
                        <p className={`text-xs ${withDarkMode(successColors.text, darkModeSuccessColors.text)} mt-1`}>
                          {t('components.quickAction.planInfo', {
                            count: structuredOutput.content?.tasks?.length ?? 0,
                            name: structuredOutput.content?.name ?? ''
                          })}
                        </p>
                      )}
                      {structuredOutput.type === 'review' && (
                        <p className={`text-xs ${withDarkMode(successColors.text, darkModeSuccessColors.text)} mt-1`}>
                          {t('components.quickAction.reviewInfo', {
                            status: structuredOutput.content?.status,
                            issues: structuredOutput.content?.issues?.length ?? 0
                          })}
                        </p>
                      )}
                      {structuredOutput.content?.summary && (
                        <p className={`text-xs ${withDarkMode(successColors.textAlt, darkModeSuccessColors.textAlt)} mt-2 italic`}>
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
                <div className={`rounded-lg border ${withDarkMode(errorColors.border, darkModeErrorColors.border)} ${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} p-3`}>
                  <p className={`text-xs ${withDarkMode(errorColors.textAlt, darkModeErrorColors.textAlt)}`}>{t('components.quickAction.actionFailed')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-4 border-t ${withDarkMode(borderColors.default, darkModeBorderColors.default)} flex justify-end gap-2`}>
          <Button variant="secondary" size="sm" onClick={onClose}>{t('components.quickAction.close')}</Button>
          {step === 'form' && (
            <Button
              variant="primary" size="sm"
              onClick={handleSubmit}
              disabled={!message.trim() || !teamId || uploadFiles.isPending}
              loading={createAction.isPending || uploadFiles.isPending}
            >
              <Zap className="h-3.5 w-3.5" /> {t('components.quickAction.run')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
