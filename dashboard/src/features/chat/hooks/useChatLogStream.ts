import { useEffect, useRef, useState, useCallback } from 'react'
import { getApiUrl, getActiveToken } from '@/api/client'

export type ChatLogLine = {
  id: number
  session_id: string
  level: string
  message: string
  created_at: string
}

type StreamStatus = 'connecting' | 'streaming' | 'done' | 'error'

export function useChatLogStream(sessionId: string, enabled: boolean) {
  const [logs, setLogs] = useState<ChatLogLine[]>([])
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting')
  const [hasLogs, setHasLogs] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  // Clear logs when session changes
  useEffect(() => {
    setLogs([])
    setStreamStatus('connecting')
    setHasLogs(false)
  }, [sessionId])

  useEffect(() => {
    if (!enabled || !sessionId) {
      setStreamStatus('connecting')
      return
    }

    const url = `${getApiUrl()}/api/sessions/${sessionId}/logs/stream?token=${getActiveToken()}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setStreamStatus('streaming')

    es.onmessage = (event) => {
      try {
        const log: ChatLogLine = JSON.parse(event.data)
        setLogs(prev => {
          // Dedup by id
          if (prev.some(l => l.id === log.id)) return prev
          return [...prev, log]
        })
        setHasLogs(true)
      } catch {
        // ignore parse errors
      }
    }

    es.addEventListener('done', () => {
      setStreamStatus('done')
      es.close()
    })

    es.addEventListener('error', () => {
      setStreamStatus('error')
      es.close()
    })

    return () => {
      es.close()
      esRef.current = null
    }
  }, [sessionId, enabled])

  // Reset logs when session stops running and no longer enabled
  const clearLogs = useCallback(() => {
    setLogs([])
    setHasLogs(false)
    setStreamStatus('connecting')
  }, [])

  return { logs, streamStatus, hasLogs, clearLogs }
}
