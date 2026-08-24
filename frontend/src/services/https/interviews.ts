import type {
  CreateInterviewRequest,
  InterviewResultRequest,
  InterviewScheduleRecord,
  RequestRescheduleRequest,
  RescheduleEntry,
  UpdateInterviewRequest,
} from '../../interface/IInterviewInterface'
import { apiFetch } from './index'

export function listMyInterviews(token: string): Promise<InterviewScheduleRecord[]> {
  return apiFetch<InterviewScheduleRecord[]>('/api/v1/interviews', { token })
}

export function createInterview(token: string, payload: CreateInterviewRequest): Promise<InterviewScheduleRecord> {
  return apiFetch<InterviewScheduleRecord>('/api/v1/employer/interviews', { method: 'POST', token, body: payload })
}

export function updateInterview(token: string, id: number, payload: UpdateInterviewRequest): Promise<InterviewScheduleRecord> {
  return apiFetch<InterviewScheduleRecord>(`/api/v1/employer/interviews/${id}`, { method: 'PUT', token, body: payload })
}

export function requestReschedule(token: string, id: number, payload: RequestRescheduleRequest): Promise<{ created: boolean }> {
  return apiFetch<{ created: boolean }>(`/api/v1/interviews/${id}/reschedule`, { method: 'POST', token, body: payload })
}

export function listReschedules(token: string, id: number): Promise<RescheduleEntry[]> {
  return apiFetch<RescheduleEntry[]>(`/api/v1/interviews/${id}/reschedules`, { token })
}

export function sendInterviewResult(token: string, id: number, payload: InterviewResultRequest): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>(`/api/v1/employer/interviews/${id}/result`, { method: 'POST', token, body: payload })
}

export function confirmInterviewAttendance(token: string, id: number): Promise<{ confirmed: boolean }> {
  return apiFetch<{ confirmed: boolean }>(`/api/v1/student/interviews/${id}/confirm`, { method: 'POST', token })
}
