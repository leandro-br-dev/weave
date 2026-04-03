import { useEffect, useCallback } from 'react'
import { X, Download } from 'lucide-react'
import { textColors } from '@/lib/colors'

export interface ImageLightboxProps {
  /** URL of the image to display */
  src: string
  /** Original file name (used for download) */
  fileName: string
  /** Close callback */
  onClose: () => void
}

export function ImageLightbox({ src, fileName, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = fileName
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        <span className="text-sm text-white/80 truncate max-w-[60vw]">{fileName}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${textColors.inverted}/90 hover:bg-white/10 transition-colors`}
            title="Download"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            onClick={onClose}
            className={`inline-flex items-center justify-center p-1.5 rounded-md ${textColors.inverted}/90 hover:bg-white/10 transition-colors`}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center p-4">
        <img
          src={src}
          alt={fileName}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom bar — scroll zoom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-t from-black/50 to-transparent">
        <span className="text-xs text-white/50">ESC to close</span>
      </div>
    </div>
  )
}
