import type { AuthResponse, LoginRequest, RegisterRequest } from '../../interface/IAuthInterface'
import type { User } from '../../interface/IUserInterface'
import { apiFetch } from './index'

export function register(payload: RegisterRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: payload,
  })
}

export function login(payload: LoginRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: payload,
  })
}

export function getProfile(token: string): Promise<User> {
  return apiFetch<User>('/api/v1/users/profile', { token })
}

// Revokes this specific token server-side so it stops working immediately
// instead of remaining valid until it naturally expires. Best-effort by
// design — callers should clear local session state regardless of whether
// this succeeds (see AuthProvider.logout).
export function logout(token: string): Promise<void> {
  return apiFetch<void>('/api/v1/auth/logout', { method: 'POST', token })
}
