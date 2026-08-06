import type { UpdateProfileRequest, User } from '../../interface/IUserInterface'
import { apiFetch } from './index'

export function getAllUsers(token: string): Promise<User[]> {
  return apiFetch<User[]>('/api/v1/users', { token })
}

export function getUserById(token: string, id: number): Promise<User> {
  return apiFetch<User>(`/api/v1/users/${id}`, { token })
}

export function updateProfile(token: string, payload: UpdateProfileRequest): Promise<User> {
  return apiFetch<User>('/api/v1/users/profile', {
    method: 'PUT',
    token,
    body: payload,
  })
}

export function deleteAccount(token: string): Promise<void> {
  return apiFetch<void>('/api/v1/users/profile', {
    method: 'DELETE',
    token,
  })
}
