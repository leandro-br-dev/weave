import { apiFetch } from './client';

export interface AuthStatusResponse {
  authenticated: boolean;
  currentUser: { userId: string; username: string } | null;
  user: { userId: string; username: string } | null;
  hasUsers: boolean;
  isLocalhost: boolean;
  canResetPassword: boolean;
}

export interface LoginResponse {
  token: string;
  user: { userId: string; username: string };
}

export interface SetupResponse {
  token: string;
  user: { userId: string; username: string };
}

export interface ChangePasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return apiFetch<AuthStatusResponse>('/api/auth/status');
}

export async function login(password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function setup(password: string, confirmPassword: string): Promise<SetupResponse> {
  return apiFetch<SetupResponse>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ password, confirmPassword }),
  });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ChangePasswordResponse> {
  return apiFetch<ChangePasswordResponse>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
}

export async function resetPassword(newPassword: string, confirmPassword: string): Promise<ResetPasswordResponse> {
  return apiFetch<ResetPasswordResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword, confirmPassword }),
  });
}

export async function getCurrentUser(): Promise<{ userId: string; username: string }> {
  return apiFetch<{ userId: string; username: string }>('/api/auth/me');
}
