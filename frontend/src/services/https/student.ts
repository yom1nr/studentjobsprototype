import type { ExtractScheduleResponse, StudentProfile, UpsertStudentProfileRequest } from '../../interface/IStudentInterface'
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

export function extractScheduleFromImage(token: string, file: File): Promise<ExtractScheduleResponse> {
  const formData = new FormData()
  formData.append('schedule_image', file)

  return apiFetch<ExtractScheduleResponse>('/api/v1/student/schedule/extract', {
    method: 'POST',
    token,
    body: formData,
  })
}

