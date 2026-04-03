import { useMutation } from '@tanstack/react-query'
import { getApiUrl, getActiveToken, type ApiError } from './client'

export interface AttachmentResponse {
  id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
}

export function useUploadFiles() {
  return useMutation<
    AttachmentResponse[],
    ApiError,
    File[]
  >({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`${getApiUrl()}/api/uploads`, {
        method: 'POST',
        headers: {
          ...(getActiveToken() ? { Authorization: `Bearer ${getActiveToken()}` } : {}),
          // Do NOT set Content-Type — let the browser set multipart/form-data with boundary
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        throw {
          message: errorData.error || errorData.message || 'Upload failed',
          status: response.status,
        } as ApiError
      }

      const json = await response.json()
      return json.attachments as AttachmentResponse[]
    },
  })
}

export function getAttachmentUrl(attachmentId: string): string {
  const token = getActiveToken()
  const params = token ? `?token=${token}` : ''
  return `${getApiUrl()}/api/uploads/${attachmentId}${params}`
}
