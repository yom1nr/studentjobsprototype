import type { StudentProfile, UpsertStudentProfileRequest } from '../../interface/IStudentInterface'
import { ApiError, apiFetch, getApiBaseUrl } from './index'

export type ExtractedSchedule = {
  class_slots: { day: string; start_time: string; end_time: string }[]
  free_slots: { day: string; start_time: string; end_time: string }[]
  summary: string
}

// Optional AI convenience: upload a class-schedule image, get a free-time
// summary to drop into available_time. 503 => AI not configured (enter manually).
export async function extractScheduleFromImage(token: string, file: File): Promise<ExtractedSchedule> {
  const form = new FormData()
  form.append('schedule_image', file)
  const res = await fetch(`${getApiBaseUrl()}/api/v1/student/schedule/extract`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  let json: { success?: boolean; data?: ExtractedSchedule; error?: { message: string } } | undefined
  try {
    json = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok || !json?.success || !json.data) {
    throw new ApiError(json?.error?.message ?? `สแกนไม่สำเร็จ (${res.status})`, res.status)
  }
  return json.data
}

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
