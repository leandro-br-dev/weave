import { useState, useEffect } from 'react'
import { X, Wand2, Check, Trash2, Edit3 } from 'lucide-react'
import { Button } from './Button'

interface ClaudeMdImprovementModalProps {
  isOpen: boolean
  improvedContent: string
  onApprove: (content: string) => void
  onDiscard: () => void
  isLoading?: boolean
}

export function ClaudeMdImprovementModal({
  isOpen,
  improvedContent,
  onApprove,
  onDiscard,
  isLoading = false,
}: ClaudeMdImprovementModalProps) {
  const [editedContent, setEditedContent] = useState(improvedContent)
  const [isEditing, setIsEditing] = useState(false)

  // Sync editedContent when improvedContent changes (can arrive after mount)
  useEffect(() => {
    if (improvedContent && improvedContent !== editedContent) {
      setEditedContent(improvedContent)
    }
  }, [improvedContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debug log to track when modal receives content
  console.log('[ClaudeMdImprovementModal] rendered with:', {
    isOpen,
    improvedContentLength: improvedContent?.length || 0,
    editedContentLength: editedContent?.length || 0
  })

  if (!isOpen) return null

  const handleApprove = () => {
    onApprove(editedContent)
  }

  const handleReset = () => {
    setEditedContent(improvedContent)
    setIsEditing(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Wand2 className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">AI-Improved CLAUDE.md</h2>
          </div>
          <button
            onClick={onDiscard}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Preview</h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <Edit3 size={14} />
                  Edit
                </button>
              )}
            </div>

            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              disabled={!isEditing || isLoading}
              className={`w-full h-96 px-4 py-3 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                isEditing
                  ? 'border-gray-300 bg-white'
                  : 'border-gray-200 bg-gray-50 text-gray-700'
              }`}
            />

            {isEditing && (
              <div className="flex gap-2">
                <Button
                  onClick={handleReset}
                  variant="secondary"
                  size="sm"
                  disabled={isLoading}
                >
                  Reset to AI Version
                </Button>
                <Button
                  onClick={() => setIsEditing(false)}
                  variant="secondary"
                  size="sm"
                  disabled={isLoading}
                >
                  Done Editing
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button
            onClick={onDiscard}
            variant="secondary"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Trash2 size={16} />
            Discard
          </Button>
          <Button
            onClick={handleApprove}
            variant="primary"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Check size={16} />
            Approve & Save
          </Button>
        </div>
      </div>
    </div>
  )
}
