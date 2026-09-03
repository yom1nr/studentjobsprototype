import type { EmployerProfile, UpsertEmployerProfileRequest } from '../../interface/IEmployerInterface'
import { apiFetch } from './index'

export function getMyEmployerProfile(token: string): Promise<EmployerProfile> {
  return apiFetch<EmployerProfile>('/api/v1/employer/profile', { token })
}

export function upsertMyEmployerProfile(token: string, payload: UpsertEmployerProfileRequest): Promise<EmployerProfile> {
  return apiFetch<EmployerProfile>('/api/v1/employer/profile', {
    method: 'PUT',
    token,
    body: payload,
  })
}

export function acknowledgeRequestNote(token: string): Promise<{ request_note_acknowledged: boolean }> {
  return apiFetch('/api/v1/employer/documents/acknowledge', { method: 'POST', token })
}
