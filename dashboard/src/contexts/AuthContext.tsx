import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  getAuthStatus,
  login as apiLogin,
  setup as apiSetup,
  changePassword as apiChangePassword,
  resetPassword as apiResetPassword,
  type AuthStatusResponse,
} from '@/api/auth';
import { setDynamicToken } from '@/api/client';

export interface AuthUser {
  userId: string;
  username: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  hasUsers: boolean;
  isLocalhost: boolean;
  canResetPassword: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
  setup: (password: string, confirmPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  resetPassword: (newPassword: string, confirmPassword: string) => Promise<void>;
}

const TOKEN_STORAGE_KEY = 'auth_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasUsers, setHasUsers] = useState(true);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const initializing = useRef(false);

  // Restore token from localStorage on mount and validate it
  const checkAuthStatus = useCallback(async () => {
    if (initializing.current) return;
    initializing.current = true;

    try {
      // Restore the token from localStorage into memory BEFORE checking auth,
      // so the API call includes the Authorization header.
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        setDynamicToken(storedToken);
      }

      const status: AuthStatusResponse = await getAuthStatus();
      setHasUsers(status.hasUsers);
      setIsLocalhost(status.isLocalhost);
      setCanResetPassword(status.canResetPassword);

      if (status.authenticated && status.user) {
        setUser(status.user);
      } else {
        // Token invalid or missing — clear everything
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setDynamicToken(null);
        setUser(null);
      }
    } catch {
      // If the status endpoint itself fails, keep existing token
      // (server might be restarting — don't logout unnecessarily)
    } finally {
      setIsLoading(false);
      initializing.current = false;
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Listen for 401 responses from other tabs / fetch calls and auto-logout.
  // We intercept by patching fetch globally.
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function patchedFetch(input, init) {
      const response = await originalFetch.call(this, input, init);

      if (response.status === 401) {
        // Check if the request was to our API
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('/api/') && !url.includes('/api/auth/login') && !url.includes('/api/auth/status')) {
          // Dispatch a custom event so this tab (and others) can react
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Listen for the custom unauthorized event
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setDynamicToken(null);
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (password: string) => {
    const response = await apiLogin(password);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    setDynamicToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setDynamicToken(null);
    setUser(null);
  }, []);

  const setup = useCallback(async (password: string, confirmPassword: string) => {
    const response = await apiSetup(password, confirmPassword);
    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    setDynamicToken(response.token);
    setUser(response.user);
    setHasUsers(true);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string, confirmPassword: string) => {
      await apiChangePassword(currentPassword, newPassword, confirmPassword);
    },
    []
  );

  const resetPassword = useCallback(async (newPassword: string, confirmPassword: string) => {
    await apiResetPassword(newPassword, confirmPassword);
  }, []);

  const value: AuthContextType = {
    isAuthenticated: user !== null,
    user,
    hasUsers,
    isLocalhost,
    canResetPassword,
    isLoading,
    login,
    logout,
    setup,
    changePassword,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
