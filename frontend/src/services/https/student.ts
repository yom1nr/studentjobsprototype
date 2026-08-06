import type { StudentProfile, UpsertStudentProfileRequest } from '../../interface/IStudentInterface'
import { apiFetch } from './index'

export function getMyStudentProfile(token: string): Promise<StudentProfile> {
  return apiFetch<StudentProfile>('/api/v1/student/profile', { token })
}

export function upsertMyStudentProfile(token: string, payload: UpsertStudentProfileRequest): Promise<StudentProfile> {
  return apiFetch<StudentProfile>('/api/v1/student/profile', {
    method: 'PUT',
    token,
    body: payload,
  })
}
