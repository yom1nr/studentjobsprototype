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
