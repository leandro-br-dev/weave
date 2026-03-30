export interface EnvironmentVariable {
  id: string
  key: string
  value: string
  description: string
  category: 'general' | 'anthropic' | 'openai' | 'custom' | 'database' | 'api' | 'other'
  is_secret: boolean
  created_at: string
  updated_at: string
}

export interface CreateEnvironmentVariableDTO {
  key: string
  value: string
  description?: string
  category?: EnvironmentVariable['category']
  is_secret?: boolean
}

export interface UpdateEnvironmentVariableDTO {
  key?: string
  value?: string
  description?: string
  category?: EnvironmentVariable['category']
  is_secret?: boolean
}

export interface EnvironmentVariableResponse {
  id: string
  key: string
  value: string
  description: string
  category: string
  is_secret: boolean
  created_at: string
  updated_at: string
}
