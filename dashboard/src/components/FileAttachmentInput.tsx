import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Paperclip,
  ImageIcon,
  FileText,
  FileCode,
  File,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import {
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
  withDarkMode,
} from '@/lib/colors'

export interface FileAttachment {
  id: string
  file: File
  preview?: string
  status: 'pending' | 'uploading' | 'uploaded' | 'error'
  serverData?: {
    id: string
    file_name: string
    file_type: string
    file_size: number
    storage_path: string
  }
}

export interface FileAttachmentInputProps {
  attachments: FileAttachment[]
  onAttachmentsChange: (attachments: FileAttachment[]) => void
  maxFiles?: number
  maxSize?: number
  acceptedTypes?: string
  compact?: boolean
}

function generateId(): string {
  return crypto.randomUUID()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileCategory(file: File): 'image' | 'pdf' | 'text' | 'code' | 'other' {
  const type = file.type
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (
    type === 'text/plain' ||
    type === 'text/markdown' ||
    type === 'text/csv'
  ) return 'text'
  if (
    type === 'text/x-python' ||
    type === 'application/typescript' ||
    type === 'application/javascript' ||
    type === 'application/json' ||
    type === 'application/x-yaml' ||
    type === 'application/yaml' ||
    file.name.endsWith('.py') ||
    file.name.endsWith('.ts') ||
    file.name.endsWith('.tsx') ||
    file.name.endsWith('.js') ||
    file.name.endsWith('.jsx') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.yaml') ||
    file.name.endsWith('.yml')
  ) return 'code'
  return 'other'
}

function FileIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case 'image':
      return <ImageIcon className={className ?? 'h-4 w-4'} />
    case 'pdf':
      return <FileText className={className ?? 'h-4 w-4'} />
    case 'text':
      return <FileText className={className ?? 'h-4 w-4'} />
    case 'code':
      return <FileCode className={className ?? 'h-4 w-4'} />
    default:
      return <File className={className ?? 'h-4 w-4'} />
  }
}

export function FileAttachmentInput({
  attachments,
  onAttachmentsChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024,
  acceptedTypes = 'image/*,.pdf,.txt,.md,.json,.py,.ts,.js,.tsx,.jsx,.yaml,.yml,.csv',
  compact = false,
}: FileAttachmentInputProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const newAttachments: FileAttachment[] = []

      for (const file of fileArray) {
        if (attachments.length + newAttachments.length >= maxFiles) break

        // Validate type
        const acceptedPatterns = acceptedTypes.split(',').map((s) => s.trim())
        const isAccepted = acceptedPatterns.some((pattern) => {
          if (pattern.startsWith('*')) {
            return file.type.startsWith(pattern.replace('*', ''))
          }
          if (pattern.endsWith('/*')) {
            return file.type.startsWith(pattern.slice(0, -1))
          }
          if (pattern.startsWith('.')) {
            return file.name.toLowerCase().endsWith(pattern.toLowerCase())
          }
          return file.type === pattern
        })
        if (!isAccepted) continue

        // Validate size
        if (file.size > maxSize) continue

        const category = getFileCategory(file)
        const attachment: FileAttachment = {
          id: generateId(),
          file,
          preview: category === 'image' ? URL.createObjectURL(file) : undefined,
          status: 'pending',
        }
        newAttachments.push(attachment)
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments])
      }
    },
    [attachments, acceptedTypes, maxFiles, maxSize, onAttachmentsChange]
  )

  const removeAttachment = useCallback(
    (id: string) => {
      const attachment = attachments.find((a) => a.id === id)
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview)
      }
      onAttachmentsChange(attachments.filter((a) => a.id !== id))
    },
    [attachments, onAttachmentsChange]
  )

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const maxFilesReached = attachments.length >= maxFiles

  // --- Compact mode ---
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={maxFilesReached}
          title={maxFilesReached ? t('components.fileAttachment.maxFilesReached') : t('components.fileAttachment.addFiles')}
          className={`relative inline-flex items-center justify-center p-1.5 rounded-md ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${interactiveStates.hoverBg} ${darkModeInteractiveStates.hoverBg} transition-colors ${interactiveStates.disabled}`}
        >
          <Paperclip className="h-4 w-4" />
          {attachments.length > 0 && (
            <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full ${withDarkMode(bgColors.inverted, bgColors.secondary)} ${withDarkMode(textColors.inverted, darkModeTextColors.inverted)} text-[10px] font-medium leading-none`}>
              {attachments.length}
            </span>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    )
  }

  // --- Full mode ---
  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-md border-2 border-dashed transition-colors
          ${isDragOver
            ? `${withDarkMode(borderColors.strong, darkModeBorderColors.thick)} ${withDarkMode(bgColors.primary, darkModeBgColors.tertiary)}`
            : `${withDarkMode(borderColors.thick, darkModeBorderColors.default)} ${withDarkMode('hover:border-gray-400', 'dark:hover:border-gray-500')}`
          }
          ${maxFilesReached ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <button
          type="button"
          onClick={handleClick}
          className={`flex items-center gap-2 w-full px-3 py-2 text-sm ${withDarkMode(textColors.tertiary, darkModeTextColors.tertiary)} ${withDarkMode('hover:text-gray-700', 'dark:hover:text-gray-200')} transition-colors`}
        >
          <Paperclip className="h-4 w-4" />
          <span>{t('components.fileAttachment.addFiles')}</span>
        </button>

        {isDragOver && (
          <div className={`absolute inset-0 flex items-center justify-center ${withDarkMode('bg-gray-50/80', 'dark:bg-gray-800/80')} rounded-md`}>
            <span className={`text-sm ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)}`}>
              {t('components.fileAttachment.dragDrop')}
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => {
            const category = getFileCategory(attachment.file)

            return (
              <div
                key={attachment.id}
                className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-md ${withDarkMode(bgColors.primary, darkModeBgColors.secondary)} border ${withDarkMode(borderColors.default, darkModeBorderColors.default)} text-sm max-w-[200px]`}
              >
                {/* Preview or icon */}
                {attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="h-8 w-8 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`flex-shrink-0 ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                    <FileIcon category={category} className="h-5 w-5" />
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${withDarkMode(textColors.secondary, darkModeTextColors.secondary)} truncate`}>
                    {attachment.file.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`}>
                      {formatFileSize(attachment.file.size)}
                    </span>
                    {attachment.status === 'uploading' && (
                      <Loader2 className={`h-3 w-3 animate-spin ${withDarkMode(textColors.muted, darkModeTextColors.muted)}`} />
                    )}
                    {attachment.status === 'uploaded' && (
                      <span className={`text-[10px] ${successColors.text} ${darkModeSuccessColors.text}`}>
                        {t('components.fileAttachment.uploading').replace('...', '')}
                      </span>
                    )}
                    {attachment.status === 'error' && (
                      <AlertCircle className={`h-3 w-3 ${errorColors.text} ${darkModeErrorColors.text}`} />
                    )}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAttachment(attachment.id)
                  }}
                  title={t('components.fileAttachment.remove')}
                  className={`flex-shrink-0 p-0.5 rounded ${withDarkMode(textColors.muted, darkModeTextColors.muted)} ${errorColors.text} ${darkModeErrorColors.text} ${withDarkMode(errorColors.bg, darkModeErrorColors.bg)} transition-colors opacity-0 group-hover:opacity-100`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
