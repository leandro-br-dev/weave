import { useEffect, useRef, useState } from 'react'
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
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!enabled || !sessionId) {
      setLogs([])
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

  // Clear logs when session changes
  useEffect(() => {
    setLogs([])
    setStreamStatus('connecting')
  }, [sessionId])

  return { logs, streamStatus }
}
