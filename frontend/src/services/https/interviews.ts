import type {
  CreateInterviewRequest,
  InterviewResultRequest,
  InterviewScheduleRecord,
  RequestRescheduleRequest,
  RescheduleEntry,
  SelectRescheduleSlotRequest,
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

/** Employer accepts the time the student asked to move to. */
export function approveReschedule(token: string, rescheduleId: number): Promise<RescheduleEntry> {
  return apiFetch<RescheduleEntry>(`/api/v1/employer/reschedules/${rescheduleId}/approve`, { method: 'POST', token })
}

/** Employer declines it; the original appointment stands. */
export function rejectReschedule(token: string, rescheduleId: number, reason?: string): Promise<RescheduleEntry> {
  return apiFetch<RescheduleEntry>(`/api/v1/employer/reschedules/${rescheduleId}/reject`, { method: 'POST', token, body: { reason: reason ?? '' } })
}

/** Student picks one of the times the employer offered. */
export function selectRescheduleSlot(token: string, rescheduleId: number, payload: SelectRescheduleSlotRequest): Promise<RescheduleEntry> {
  return apiFetch<RescheduleEntry>(`/api/v1/student/reschedules/${rescheduleId}/select`, { method: 'POST', token, body: payload })
}

export function sendInterviewResult(token: string, id: number, payload: InterviewResultRequest): Promise<{ sent: boolean }> {
  return apiFetch<{ sent: boolean }>(`/api/v1/employer/interviews/${id}/result`, { method: 'POST', token, body: payload })
}

export function confirmInterviewAttendance(token: string, id: number): Promise<{ confirmed: boolean }> {
  return apiFetch<{ confirmed: boolean }>(`/api/v1/student/interviews/${id}/confirm`, { method: 'POST', token })
}
