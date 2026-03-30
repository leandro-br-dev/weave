import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'

export type EnvironmentVariable = {
  id: string
  key: string
  value: string
  description: string
  category: string
  is_secret: boolean
  created_at: string
  updated_at: string
}

export type EnvironmentVariableInput = {
  key: string
  value: string
  description?: string
  category?: string
  is_secret?: boolean
}

export type EnvironmentVariablesDefaults = {
  flat: Record<string, string>
  categorized: Record<string, Record<string, { value: string; description: string }>>
  keys: string[]
}

export function useGetEnvironmentVariables() {
  return useQuery<EnvironmentVariable[]>({
    queryKey: ['environment-variables'],
    queryFn: async () => {
      return await apiFetch<EnvironmentVariable[]>('/api/environment-variables')
    },
  })
}

export function useGetEnvironmentVariableCategories() {
  return useQuery<string[]>({
    queryKey: ['environment-variables', 'categories'],
    queryFn: async () => {
      return await apiFetch<string[]>('/api/environment-variables/categories')
    },
  })
}

export function useGetEnvironmentVariable(id: string) {
  return useQuery<EnvironmentVariable>({
    queryKey: ['environment-variables', id],
    queryFn: async () => {
      return await apiFetch<EnvironmentVariable>(`/api/environment-variables/${id}`)
    },
    enabled: !!id,
  })
}

export function useGetEnvironmentVariablesByCategory(category: string) {
  return useQuery<EnvironmentVariable[]>({
    queryKey: ['environment-variables', 'category', category],
    queryFn: async () => {
      return await apiFetch<EnvironmentVariable[]>(`/api/environment-variables/by-category/${category}`)
    },
    enabled: !!category,
  })
}

export function useGetEnvironmentVariablesDefaults() {
  return useQuery<EnvironmentVariablesDefaults>({
    queryKey: ['environment-variables', 'defaults'],
    queryFn: async () => {
      return await apiFetch<EnvironmentVariablesDefaults>('/api/environment-variables/defaults')
    },
  })
}

export function useCreateEnvironmentVariable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EnvironmentVariableInput) =>
      apiFetch<{ data: EnvironmentVariable; error: string | null }>('/api/environment-variables', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environment-variables'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'categories'] })
    },
  })
}

export function useUpdateEnvironmentVariable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EnvironmentVariableInput }) =>
      apiFetch<{ data: EnvironmentVariable; error: string | null }>(`/api/environment-variables/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['environment-variables'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', variables.id] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'category'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'defaults'] })
    },
  })
}

export function useDeleteEnvironmentVariable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ data: { id: string }; error: string | null }>(`/api/environment-variables/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environment-variables'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'categories'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'defaults'] })
    },
  })
}

export function useBatchCreateEnvironmentVariables() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (variables: EnvironmentVariableInput[]) =>
      apiFetch<{ data: any[]; error: string | null }>('/api/environment-variables/batch', {
        method: 'POST',
        body: JSON.stringify({ variables }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environment-variables'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'categories'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'defaults'] })
    },
  })
}

export function useInitializeEnvironmentVariableDefaults() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: any; error: string | null }>('/api/environment-variables/initialize-defaults', {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environment-variables'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'categories'] })
      qc.invalidateQueries({ queryKey: ['environment-variables', 'defaults'] })
    },
  })
}
