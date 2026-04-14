import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Brain } from 'lucide-react'
import type { ChatLogLine } from '../hooks/useChatLogStream'

interface ThinkingBubbleProps {
  logs: ChatLogLine[]
  streamStatus: 'connecting' | 'streaming' | 'done' | 'error'
  isRunning: boolean
}

export function ThinkingBubble({ logs, streamStatus, isRunning }: ThinkingBubbleProps) {
  const [expanded, setExpanded] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive (only when expanded)
  useEffect(() => {
    if (expanded) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, expanded])

  // Collapse when session stops running and we have a done status
  useEffect(() => {
    if (!isRunning && streamStatus === 'done') {
      setExpanded(false)
    }
  }, [isRunning, streamStatus])

  // Get the latest non-tool log message for the preview
  const previewLogs = logs.filter(l => l.level === 'info')
  const latestPreview = previewLogs.length > 0 ? previewLogs[previewLogs.length - 1].message : ''

  // Truncate preview for display
  const truncatedPreview = latestPreview.length > 120
    ? latestPreview.substring(0, 120) + '...'
    : latestPreview

  // If no logs at all, show connecting dots
  if (logs.length === 0) {
    return (
      <div className="flex justify-start">
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse">
              Thinking...
            </span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className={`max-w-[80%] bg-white dark:bg-gray-700 border ${
        expanded
          ? 'border-blue-300 dark:border-blue-700 rounded-2xl rounded-bl-sm'
          : 'border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-sm'
      } overflow-hidden`}>
        {/* Thinking header - always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Brain className={`h-3.5 w-3.5 flex-shrink-0 ${
              isRunning ? 'text-blue-500 animate-pulse' : 'text-gray-400'
            }`} />
            <span className={`text-xs font-medium ${
              isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              {isRunning ? 'Thinking...' : 'Thought process'}
            </span>
            {!expanded && truncatedPreview && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-1">
                {truncatedPreview}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {logs.length}
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
        </button>

        {/* Expanded log content */}
        {expanded && (
          <div
            ref={containerRef}
            className="border-t border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 max-h-80 overflow-y-auto"
          >
            <div className="p-3 font-mono text-xs space-y-0.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`${
                    log.level === 'error'
                      ? 'text-red-500'
                      : log.level === 'tool'
                        ? 'text-purple-500'
                        : log.level === 'debug'
                          ? 'text-gray-400 dark:text-gray-500'
                          : log.level === 'warning'
                            ? 'text-amber-500'
                            : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {/* Tool use entries */}
                  {log.level === 'tool' && (
                    <span className="text-gray-300 dark:text-gray-600 mr-1">⚙</span>
                  )}
                  {/* Debug entries */}
                  {log.level === 'debug' && (
                    <span className="text-gray-300 dark:text-gray-600 mr-1">→</span>
                  )}
                  {/* Info entries (text blocks) */}
                  {log.level === 'info' && !log.message.startsWith('✔') && !log.message.startsWith('❌') && (
                    <span className="text-gray-300 dark:text-gray-600 mr-1">💬</span>
                  )}
                  {/* Error entries */}
                  {log.level === 'error' && (
                    <span className="mr-1">❌</span>
                  )}
                  {/* Format message based on content */}
                  {log.level === 'info' && !log.message.startsWith('✔') && !log.message.startsWith('❌') ? (
                    <span className="whitespace-pre-wrap">{log.message}</span>
                  ) : (
                    <span>{log.message}</span>
                  )}
                </div>
              ))}
              {isRunning && streamStatus === 'streaming' && (
                <div className="flex items-center gap-1 text-gray-400 mt-1">
                  <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" />
                  <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
