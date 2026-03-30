// Determina a URL da API automaticamente baseada no ambiente
// Esta função é executada em RUNTIME, não no build, para funcionar com Cloudflare Tunnel
function getApiBaseUrl(): string {
  // Função auxiliar para logging (persiste em produção via localStorage)
  const logDetection = (step: string, url: string) => {
    if (typeof window !== 'undefined') {
      // Salva no localStorage para debug em produção
      try {
        const logs = JSON.parse(localStorage.getItem('api-url-detection') || '[]');
        logs.push({ timestamp: new Date().toISOString(), step, url });
        // Mantém apenas as últimas 10 entradas
        if (logs.length > 10) logs.shift();
        localStorage.setItem('api-url-detection', JSON.stringify(logs));
      } catch (e) {
        // Ignora erros de localStorage
      }
    }
  };

  // Se VITE_API_URL está definido, usa ela (para desenvolvimento local explícito)
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL;
    logDetection('VITE_API_URL', url);
    return url;
  }

  // Se VITE_API_BASE_URL está definido (compatibilidade com .env.example antigo)
  if (import.meta.env.VITE_API_BASE_URL) {
    const url = import.meta.env.VITE_API_BASE_URL;
    logDetection('VITE_API_BASE_URL', url);
    return url;
  }

  // Detecta automaticamente a URL da API baseada na origem atual em RUNTIME
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;

    // PRIORIDADE 1: Se estiver em localhost ou 127.0.0.1, usa API local
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      const url = new URL(origin);
      const dashboardPort = parseInt(url.port);

      // Se acessando dashboard na porta 5173 ou 5273 (dev), API está na porta 3000 ou 3100
      let apiUrl: string;
      if (dashboardPort === 5173) {
        apiUrl = 'http://localhost:3000';
      } else if (dashboardPort === 5273) {
        apiUrl = 'http://localhost:3100';
      } else {
        // Se não conseguiu inferir pela porta, usa porta 3000 como fallback
        apiUrl = 'http://localhost:3000';
      }
      logDetection('LOCALHOST_DETECTED', apiUrl);
      return apiUrl;
    }

    // PRIORIDADE 2: Se estiver acessando via domínio público (não localhost)
    // Usa a MESMA origem (o cloudflare tunnel roteia /api/ para o backend)
    // Isso permite que qualquer domínio funcione (weave.charhub.app, outro-dominio.com, etc)
    logDetection('PUBLIC_DOMAIN', origin);
    return origin;
  }

  // Fallback para desenvolvimento local
  const fallbackUrl = 'http://localhost:3000';
  logDetection('FALLBACK', fallbackUrl);
  return fallbackUrl;
}

// Getter que executa getApiBaseUrl() em tempo de execução, não no build
export const API_BASE_URL = new Proxy({} as Record<string, any>, {
  get: (_target, prop) => {
    if (prop === 'toString' || prop === 'valueOf') {
      return () => getApiBaseUrl();
    }
    return getApiBaseUrl();
  }
}) as unknown as string;

// Função auxiliar para obter a URL em runtime quando necessário
export const getApiUrl = (): string => getApiBaseUrl();

export const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

// In-memory dynamic token, managed by AuthContext
let dynamicToken: string | null = null;

/**
 * Set the dynamic auth token (JWT). Used by AuthContext after login.
 * Falls back to the static API_TOKEN env var when no dynamic token is set.
 */
export function setDynamicToken(token: string | null): void {
  dynamicToken = token;
}

/** Get the current active token (dynamic JWT takes priority over env var) */
export function getActiveToken(): string {
  return dynamicToken || API_TOKEN;
}

export interface ApiError {
  message: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string | (() => string);

  constructor(baseUrl: string | (() => string)) {
    this.baseUrl = baseUrl;
  }

  private getBaseUrl(): string {
    return typeof this.baseUrl === 'function' ? this.baseUrl() : this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const token = getActiveToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw {
          message: errorData.error || errorData.message || 'An error occurred',
          status: response.status,
        } as ApiError;
      }

      const json = await response.json();
      return json.data;
    } catch (error) {
      if ((error as ApiError).status) {
        throw error;
      }
      throw {
        message: (error as Error).message || 'Network error occurred',
      } as ApiError;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(getApiUrl);

// Convenience function for use with React Query
export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${endpoint}`;
  const token = getActiveToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw {
      message: errorData.error || errorData.message || 'An error occurred',
      status: response.status,
    } as ApiError;
  }

  const json = await response.json();
  return json.data;
}
