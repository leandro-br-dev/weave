import { useState, useEffect, useRef } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router'
import { Bot, Send, Zap, Trash2, ChevronRight, RotateCcw, Edit2, FileText, Square, ArrowLeftRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button, EmptyState, ConfirmDialog, Select, Input, ProjectSelectDropdown, FileAttachmentInput
} from '@/components'
import type { FileAttachment } from '@/components'
import { useGetSessions, useGetSession, useCreateSession, useSendMessage, useDeleteSession, useDeleteMessage, useClearHistory, useUpdateSession, useMarkMessagesRead, useCancelSession, useSwitchSessionEnvironment } from '@/api/sessions'
import { useGetProjects } from '@/api/projects'
import { useGetWorkspaces } from '@/api/teams'
import { useCreatePlan } from '@/api/plans'
import { getApiUrl, getActiveToken } from '@/api/client'
import { useUploadFiles, getAttachmentUrl } from '@/api/uploads'
import { useNavigate } from 'react-router'
import { useChatLogStream } from '@/features/chat/hooks/useChatLogStream'
import { ThinkingBubble } from '@/features/chat/components/ThinkingBubble'

interface PlanData {
  name: string
  summary?: string
  tasks: Array<{
    name?: string
    prompt?: string
    cwd?: string
    workspace?: string
    depends_on?: string[]
  }>
}

function extractAllPlans(content: string): PlanData[] {
  const results: PlanData[] = []
  // Remove markdown code fences que possam envolver as tags <plan>
  const normalized = content.replace(/```[\s\S]*?```/g, (block) => {
    // Mantém o conteúdo interno mas remove os backticks
    return block.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  })
  // Usar split para encontrar todas as ocorrências
  const parts = normalized.split('<plan>')
  for (let i = 1; i < parts.length; i++) {
    const closing = parts[i].indexOf('</plan>')
    if (closing === -1) continue
    const raw = parts[i].substring(0, closing).trim()
    try {
      const parsed = JSON.parse(raw)
      // Ignora planos de exemplo/template (placeholder)
      if (parsed.name && parsed.name !== 'Descriptive plan name' && Array.isArray(parsed.tasks)) {
        results.push(parsed)
      }
    } catch {
      // JSON inválido, ignora
    }
  }
  return results
}

// Extrai planos de uma mensagem — verifica tanto <plan> no texto
// quanto structured_output.content no JSON
function extractPlansFromMessage(content: string): PlanData[] {
  // Tenta texto bruto com <plan> tags
  const fromText = extractAllPlans(content)
  if (fromText.length > 0) return fromText

  // Tenta JSON com structured_output
  try {
    const parsed = JSON.parse(content)
    if (
      parsed.structured_output?.type === 'plan' &&
      parsed.structured_output?.content &&
      typeof parsed.structured_output.content === 'object' &&
      parsed.structured_output.content.name &&
      Array.isArray(parsed.structured_output.content.tasks)
    ) {
      return [parsed.structured_output.content]
    }
  } catch {
    // não é JSON, ignora
  }

  return []
}

export default function ChatPage() {
  const { t } = useTranslation()
  const { id: urlSessionId } = useParams<{ id: string }>()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [input, setInput] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<PlanData | null>(null)
  const [pendingPlans, setPendingPlans] = useState<PlanData[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [showRename, setShowRename] = useState<string | null>(null)
  const [showSwitchEnv, setShowSwitchEnv] = useState(false)
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Use session ID from URL params when available
  const activeSessionId = urlSessionId || selectedId

  // Open NewChatModal when navigated with ?new=true (e.g. from sidebar)
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowNew(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: sessions = [] } = useGetSessions()
  const { data: session } = useGetSession(activeSessionId ?? '')
  const sendMessage = useSendMessage(activeSessionId ?? '')
  const deleteSession = useDeleteSession()
  const uploadFiles = useUploadFiles()
  const deleteMessage = useDeleteMessage()
  const clearHistory = useClearHistory()
  const markRead = useMarkMessagesRead()
  const cancelSession = useCancelSession()
  const switchEnvironment = useSwitchSessionEnvironment()

  // Data for environment/team switching
  const { data: projects = [] } = useGetProjects()
  const { data: allWorkspaces = [] } = useGetWorkspaces()

  // Track how long the session has been running (for UI display)
  const runningStartTime = useRef<number | null>(null)

  // Mark messages as read when user opens a chat session
  useEffect(() => {
    if (activeSessionId) {
      markRead.mutate()
    }
  }, [activeSessionId])

  // Auto-open session when navigated from PlanDetail (workflow-to-chat conversion)
  useEffect(() => {
    const openSessionId = (location.state as any)?.openSessionId
    if (openSessionId && !activeSessionId) {
      setSelectedId(openSessionId)
      // Clear the state to prevent re-triggering on subsequent navigations
      window.history.replaceState({}, '')
    }
  }, [location.state, activeSessionId])

  // SSE for real-time updates
  useEffect(() => {
    if (!activeSessionId) return
    const evtSource = new EventSource(
      `${getApiUrl()}/api/sessions/${activeSessionId}/stream?token=${getActiveToken()}`
    )
    evtSource.onmessage = () => {} // refresh is handled by polling for now
    return () => evtSource.close()
  }, [activeSessionId])

  // Auto-scroll (deferred — depends on chatLogs declared below)
  // See auto-scroll effect after useChatLogStream hook

  // Detect <plan> tags in assistant messages
  useEffect(() => {
    if (!session?.messages) return
    const lastAssistant = [...session.messages]
      .reverse()
      .find((m: any) => m.role === 'assistant')
    if (!lastAssistant) return
    const plans = extractPlansFromMessage(lastAssistant.content)
    if (plans.length > 0 && !pendingPlan) {
      setPendingPlan(plans[plans.length - 1]) // default: último
      setPendingPlans(plans) // todos
    }
  }, [session?.messages, pendingPlan])

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !activeSessionId || session?.status === 'running') return
    const text = input.trim()
    setInput('')
    setPendingPlan(null)

    // Upload attachments first
    let attachmentIds: string[] = []
    if (attachments.length > 0) {
      const filesToUpload = attachments.map((a) => a.file)
      try {
        const uploaded = await uploadFiles.mutateAsync(filesToUpload)
        attachmentIds = uploaded.map((u) => u.id)
      } catch {
        // Upload failed — still send the text message without attachments
      }
    }

    setAttachments([])
    clearLogs()
    await sendMessage.mutateAsync({ content: text, attachment_ids: attachmentIds })
  }

  const isRunning = session?.status === 'running'
  const isSending = sendMessage.isPending || uploadFiles.isPending

  // Real-time chat log stream for thinking bubble
  const { logs: chatLogs, streamStatus: logStreamStatus, hasLogs, clearLogs } = useChatLogStream(activeSessionId ?? '', isRunning)

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [session?.messages?.length, chatLogs.length])

  // Track when a session started running
  useEffect(() => {
    if (isRunning && !runningStartTime.current) {
      runningStartTime.current = Date.now()
    } else if (!isRunning) {
      runningStartTime.current = null
    }
  }, [isRunning])

  const handleCancel = () => {
    if (activeSessionId) {
      cancelSession.mutate(activeSessionId)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat area */}
      {!activeSessionId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Bot className="h-10 w-10 sm:h-12 sm:w-12" />}
            title={t('pages.chat.selectConversation')}
            description={t('pages.chat.selectConversationDesc')}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{session?.name}</span>
              <button
                onClick={() => setShowRename(activeSessionId)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                title={t('pages.chat.renameConversation')}
              >
                <Edit2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </button>
              {isRunning && (
                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 sm:px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">{t('pages.chat.thinking')}</span>
              )}
              {isRunning && (
                <button
                  onClick={handleCancel}
                  className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 transition-colors"
                  title={t('pages.chat.cancelSession')}
                >
                  <Square className="h-3 w-3" />
                  {t('pages.chat.cancel')}
                </button>
              )}
              {session?.source_type === 'workflow' && (
                <span className="text-xs bg-purple-50 text-purple-600 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:inline-flex items-center gap-1">
                  <Zap className="h-3 w-3" /> {t('pages.chat.fromWorkflow')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {!isRunning && (
                <button
                  onClick={() => setShowSwitchEnv(true)}
                  className="text-gray-400 hover:text-blue-500 hidden sm:block"
                  title={t('pages.chat.switchEnvironmentTitle')}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
              <button
                onClick={() => setConfirmClear(true)}
                className="text-gray-400 hover:text-amber-500"
                title={t('pages.chat.clearHistoryTitle')}
              >
                <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={() => setDeleteConfirm(activeSessionId)}
                className="text-gray-400 hover:text-red-500"
                title={t('pages.chat.deleteConversation')}
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 bg-white dark:bg-gray-800">
            {(session?.messages ?? []).map((msg: any, msgIndex: number) => {
              let displayContent = msg.content
              try {
                const parsed = JSON.parse(msg.content)
                displayContent = parsed.text ?? msg.content
              } catch {}

              // Check if this is the last user message without a response
              const messages = session?.messages ?? []
              const isLastUserMsg = (
                msg.role === 'user' &&
                messages[messages.length - 1]?.id === msg.id
              )
              const hasResponse = messages.some(
                (m: any, i: number) => i > msgIndex && m.role === 'assistant'
              )
              const isPending = isLastUserMsg && !hasResponse && session?.status === 'running'

              return (
                <div key={msg.id}>
                  <div
                    className={`flex group ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Delete button - visible on hover */}
                    <button
                      onClick={() => deleteMessage.mutate({ sessionId: activeSessionId!, messageId: msg.id })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity self-center mx-2 text-gray-300 hover:text-red-400"
                      title={t('pages.chat.deleteMessage')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className={`max-w-[80%] ${
                      msg.role === 'user'
                        ? 'bg-gray-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5'
                        : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-sm px-4 py-2.5'
                    }`}>
                      {/* Attachment thumbnails for user messages */}
                      {msg.role === 'user' && msg.attachment_data?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachment_data.map((att: any) => {
                            const isImage = att.file_type?.startsWith('image/')
                            if (isImage) {
                              return (
                                <a
                                  key={att.id}
                                  href={getAttachmentUrl(att.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block rounded-md overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors"
                                >
                                  <img
                                    src={getAttachmentUrl(att.id)}
                                    alt={att.file_name}
                                    className="h-20 w-20 object-cover"
                                  />
                                </a>
                              )
                            }
                            return (
                              <a
                                key={att.id}
                                href={getAttachmentUrl(att.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-500 transition-colors text-xs text-gray-300 hover:text-white"
                              >
                                {att.file_type === 'application/pdf' ? (
                                  <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />
                                ) : (
                                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                )}
                                <span className="max-w-[120px] truncate">{att.file_name}</span>
                              </a>
                            )
                          })}
                        </div>
                      )}

                      <p className={`text-sm whitespace-pre-wrap ${
                        msg.role === 'user' ? 'text-white' : 'text-gray-700 dark:text-gray-200'
                      }`}>
                        {displayContent}
                      </p>

                      {/* Pending indicator */}
                      {isPending && (
                        <p className="text-xs mt-1 text-blue-300 animate-pulse">⏳ {t('pages.chat.waitingForResponse')}</p>
                      )}

                      {/* Plan card - shown when message contains a <plan> block */}
                      {msg.role === 'assistant' && (() => {
                        const plans = extractPlansFromMessage(msg.content)
                        if (plans.length === 0) return null
                        const lastPlan = plans[plans.length - 1]
                        return (
                          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs font-semibold text-green-800 mb-1">
                              {t('pages.chat.planGenerated', { count: plans.length })}
                            </p>
                            <p className="text-xs text-green-700 mb-2">
                              {lastPlan.name} • {lastPlan.tasks?.length ?? 0} {t('pages.chat.tasks')}
                            </p>
                            <button
                              onClick={() => {
                                setPendingPlan(lastPlan)
                                setPendingPlans(plans)
                                setShowPlanModal(true)
                              }}
                              className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors"
                            >
                              {t('pages.chat.reviewCreateWorkflow')}
                            </button>
                          </div>
                        )
                      })()}

                      <p className="text-xs mt-1 opacity-50">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {/* Thinking bubble: shown after the last user message (while running or with logs) */}
                  {isLastUserMsg && (isRunning || hasLogs) && (
                    <ThinkingBubble
                      logs={chatLogs}
                      streamStatus={logStreamStatus}
                      isRunning={isRunning}
                    />
                  )}
                </div>
              )
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
            {pendingPlan && (
              <div className="mb-3 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-green-800">{t('pages.chat.planReady', { name: pendingPlan.name })}</p>
                  <p className="text-xs text-green-600">{pendingPlan.tasks?.length} {t('pages.chat.tasks')}</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowPlanModal(true)}>
                  <Zap className="h-3.5 w-3.5" /> {t('pages.chat.createWorkflow')}
                </Button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <FileAttachmentInput
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                compact
              />
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={isRunning ? t('pages.chat.agentThinking') : t('pages.chat.typeMessage')}
                disabled={isRunning}
                rows={2}
                className="flex-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500"
              />
              <Button
                variant="primary"
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || isRunning}
                loading={isSending}
              >
                <Send className="h-4 w-4" />
              </Button>
              {isRunning && (
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  className="text-red-600 hover:bg-red-50 border-red-200 dark:border-red-800"
                  title={t('pages.chat.cancelSession')}
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNew && (
        <NewChatModal
          onClose={() => setShowNew(false)}
          onCreate={id => { setShowNew(false); navigate(`/chat/${id}`) }}
        />
      )}

      {/* Plan creation from chat */}
      {showPlanModal && pendingPlan && (
        <PlanCreateModal
          prefillData={pendingPlan}
          allPlans={pendingPlans}
          onSelectPlan={(p) => setPendingPlan(p)}
          onClose={() => { setShowPlanModal(false); setPendingPlan(null); setPendingPlans([]) }}
        />
      )}

      {/* Rename chat modal */}
      {showRename && (
        <RenameChatModal
          sessionId={showRename}
          currentName={sessions.find((s: any) => s.id === showRename)?.name || ''}
          onClose={() => setShowRename(null)}
        />
      )}

      {/* Switch environment/team modal */}
      {showSwitchEnv && activeSessionId && (
        <SwitchEnvironmentModal
          sessionId={activeSessionId}
          currentWorkspacePath={session?.workspace_path || ''}
          currentEnvironmentId={session?.environment_id || null}
          projectId={session?.project_id || ''}
          projects={projects}
          allWorkspaces={allWorkspaces}
          onClose={() => setShowSwitchEnv(false)}
          onSwitched={() => setShowSwitchEnv(false)}
          switchMutation={switchEnvironment}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title={t('pages.chat.deleteConversationTitle')}
        description={t('pages.chat.deleteConversationDesc')}
        confirmLabel={t('pages.chat.delete')}
        onConfirm={() => {
          if (deleteConfirm) {
            deleteSession.mutate(deleteConfirm)
            if (activeSessionId === deleteConfirm) setSelectedId(null)
          }
          setDeleteConfirm(null)
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title={t('pages.chat.clearHistoryTitle')}
        description={t('pages.chat.clearHistoryDesc')}
        confirmLabel={t('pages.chat.clearHistory')}
        variant="danger"
        onConfirm={() => {
          clearHistory.mutate(activeSessionId!)
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
        loading={clearHistory.isPending}
      />
    </div>
  )
}

function NewChatModal({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const { t } = useTranslation()
  const [projectId, setProjectId] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [environmentId, setEnvironmentId] = useState('')
  const [sessionName] = useState('')

  const { data: projects = [] } = useGetProjects()
  const { data: allWorkspaces = [] } = useGetWorkspaces()

  // Filter teams by selected project
  const filteredWorkspaces = projectId
    ? allWorkspaces.filter(ws => ws.project_id === projectId)
    : allWorkspaces

  const selectedProject = projects.find(p => p.id === projectId)
  const environments = selectedProject?.environments ?? []
  const selectedWs = allWorkspaces.find(ws => ws.id === workspaceId)
  const createSession = useCreateSession()

  const handleCreate = async () => {
    if (!selectedWs) return
    const result = await createSession.mutateAsync({
      name: sessionName || t('pages.chat.chatWithName', { name: selectedWs.name }),
      project_id: projectId || undefined,
      workspace_path: selectedWs.path,
      environment_id: environmentId || undefined,
    })
    onCreate((result as any).id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('pages.chat.newChatSession')}</h3>

        <ProjectSelectDropdown
          label={t('pages.chat.project')}
          value={projectId}
          onChange={(value) => {
            const newProjectId = value
            setProjectId(newProjectId)
            // Clear workspace selection if the selected team doesn't belong to the new project
            if (workspaceId && selectedWs) {
              const ws = allWorkspaces.find(w => w.id === workspaceId)
              if (ws && ws.project_id !== newProjectId) {
                setWorkspaceId('')
              }
            }
          }}
          projects={projects}
          placeholder={t('pages.chat.selectProject')}
        />

        <Select label={t('pages.chat.agent')} value={workspaceId} onChange={e => {
          const newWorkspaceId = e.target.value
          setWorkspaceId(newWorkspaceId)
          // Auto-select the linked environment when a team with linked env is picked
          const ws = allWorkspaces.find(w => w.id === newWorkspaceId)
          if (ws?.environment_id) {
            setEnvironmentId(ws.environment_id)
          }
        }} required>
          <option value="" disabled>{t('pages.chat.selectAgent')}</option>
          {filteredWorkspaces.length === 0 && projectId ? (
            <option value="" disabled>{t('pages.chat.noAgentsForProject')}</option>
          ) : (
            filteredWorkspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)
          )}
        </Select>

        {environments.length > 0 && (
          <Select label={t('pages.chat.environment')} value={environmentId} onChange={e => setEnvironmentId(e.target.value)}>
            <option value="">{t('pages.chat.noSpecificEnvironment')}</option>
            {environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('pages.chat.cancel')}</Button>
          <Button
            variant="primary" size="sm"
            onClick={handleCreate}
            disabled={!workspaceId}
            loading={createSession.isPending}
          >
            {t('pages.chat.startChat')}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SwitchEnvironmentModalProps {
  sessionId: string
  currentWorkspacePath: string
  currentEnvironmentId: string | null
  projectId: string
  projects: any[]
  allWorkspaces: any[]
  onClose: () => void
  onSwitched: () => void
  switchMutation: any
}

function SwitchEnvironmentModal({
  sessionId,
  currentWorkspacePath,
  currentEnvironmentId,
  projectId,
  projects,
  allWorkspaces,
  onClose,
  onSwitched,
  switchMutation,
}: SwitchEnvironmentModalProps) {
  const { t } = useTranslation()

  // Find current workspace from path
  const currentWs = allWorkspaces.find(ws => ws.path === currentWorkspacePath)

  // Resolve the workspace's project if not directly available
  const sessionProjectId = projectId || currentWs?.project_id || ''
  const sessionProject = projects.find(p => p.id === sessionProjectId)
  const environments = sessionProject?.environments ?? []

  // Filter workspaces by session's project
  const filteredWorkspaces = sessionProjectId
    ? allWorkspaces.filter(ws => ws.project_id === sessionProjectId)
    : allWorkspaces

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('pages.chat.switchEnvironment')}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('pages.chat.switchEnvironmentDesc')}</p>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.chat.currentTeam')}</label>
          <div className="text-xs text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 rounded px-3 py-2">
            {currentWs?.name || currentWorkspacePath}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pages.chat.currentEnvironment')}</label>
          <div className="text-xs text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 rounded px-3 py-2">
            {currentEnvironmentId
              ? (environments.find((e: any) => e.id === currentEnvironmentId)?.name || currentEnvironmentId)
              : t('pages.chat.noSpecificEnvironment')}
          </div>
        </div>

        <Select
          label={t('pages.chat.newTeam')}
          value={currentWorkspacePath}
          onChange={async (e) => {
            const newWs = allWorkspaces.find(ws => ws.id === e.target.value)
            if (!newWs || newWs.path === currentWorkspacePath) return
            const newEnvId = newWs.environment_id || null
            await switchMutation.mutateAsync({
              id: sessionId,
              workspace_path: newWs.path,
              environment_id: newEnvId,
            })
            onSwitched()
          }}
        >
          {filteredWorkspaces.map(ws => (
            <option key={ws.id} value={ws.path} disabled={ws.path === currentWorkspacePath}>
              {ws.name}
            </option>
          ))}
        </Select>

        {environments.length > 0 && (
          <Select
            label={t('pages.chat.newEnvironment')}
            value={currentEnvironmentId || ''}
            onChange={async (e) => {
              const newVal = e.target.value || null
              if (newVal === currentEnvironmentId) return
              await switchMutation.mutateAsync({
                id: sessionId,
                environment_id: newVal,
              })
              onSwitched()
            }}
          >
            <option value="">{t('pages.chat.noSpecificEnvironment')}</option>
            {environments.map((env: any) => (
              <option key={env.id} value={env.id} disabled={env.id === currentEnvironmentId}>
                {env.name}
              </option>
            ))}
          </Select>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={switchMutation.isPending}>
            {t('pages.chat.close')}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface PlanCreateModalProps {
  onClose: () => void
  prefillData: PlanData
  allPlans: PlanData[]
  onSelectPlan: (plan: PlanData) => void
}

function PlanCreateModal({ onClose, prefillData, allPlans, onSelectPlan }: PlanCreateModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const createPlan = useCreatePlan()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreateFromPlan = async () => {
    console.log('[PlanModal] prefillData completo:', JSON.stringify(prefillData, null, 2))
    setCreating(true)
    setCreateError(null)
    try {
      // Usa a mesma estrutura do import JSON — o plano já tem name + tasks
      const created = await createPlan.mutateAsync({
        name: prefillData.name,
        tasks: prefillData.tasks.map(t => ({
          name: t.name || 'Untitled Task',
          prompt: t.prompt || '',
          cwd: t.cwd || '',
          workspace: t.workspace || '',
          env_context: undefined,
        })),
      })
      onClose()
      navigate(`/plans/${created.id}`)
    } catch (err) {
      console.error('Failed to create plan:', err)
      setCreateError(t('pages.chat.createWorkflowError'))
    } finally {
      setCreating(false)
    }
  }

  // Helper to truncate prompt text
  const truncatePrompt = (prompt: string, maxLength: number = 200) => {
    if (!prompt) return ''
    return prompt.length > maxLength ? prompt.slice(0, maxLength) + '...' : prompt
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-3xl w-full mx-4 space-y-4 max-h-[85vh] overflow-y-auto">
        {allPlans.length > 1 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">{t('pages.chat.plansFound', { count: allPlans.length })}</span>
            <div className="flex gap-1 flex-wrap">
              {allPlans.map((p, i) => (
                <button
                  key={i}
                  onClick={() => onSelectPlan(p)}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    p.name === prefillData.name
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {p.name?.slice(0, 30) || t('pages.chat.planNumber', { number: i + 1 })}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{prefillData?.name || t('pages.chat.untitledPlan')}</h3>
            {prefillData?.summary && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{prefillData.summary}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{prefillData?.tasks?.length || 0} {t('pages.chat.tasks')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {prefillData?.tasks?.map((task: any, idx: number) => (
            <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{task.name || t('pages.chat.taskNumber', { number: idx + 1 })}</h4>
                    {task.cwd && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className="font-mono">{typeof task.cwd === 'string' ? task.cwd : JSON.stringify(task.cwd)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">
                    {truncatePrompt(task.prompt)}
                  </p>
                  {task.depends_on && task.depends_on.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="text-xs text-gray-500">
                        {t('pages.chat.dependsOn')}: <span className="font-medium">{task.depends_on.join(', ')}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('pages.chat.discard')}
          </Button>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="primary" size="sm"
              onClick={handleCreateFromPlan}
              disabled={creating}
              className="gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" /> {creating ? t('pages.chat.creating') : t('pages.chat.createWorkflow')}
            </Button>
            {createError && (
              <p className="text-xs text-red-600">{createError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RenameChatModal({ sessionId, currentName, onClose }: { sessionId: string; currentName: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(currentName)
  const updateSession = useUpdateSession()

  const handleRename = async () => {
    if (!name.trim()) return
    await updateSession.mutate({ id: sessionId, name: name.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full mx-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('pages.chat.renameConversation')}</h3>

        <Input
          label={t('pages.chat.conversationName')}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('pages.chat.enterConversationName')}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleRename()
            }
          }}
          autoFocus
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('pages.chat.cancel')}</Button>
          <Button
            variant="primary" size="sm"
            onClick={handleRename}
            disabled={!name.trim()}
            loading={updateSession.isPending}
          >
            {t('pages.chat.rename')}
          </Button>
        </div>
      </div>
    </div>
  )
}
