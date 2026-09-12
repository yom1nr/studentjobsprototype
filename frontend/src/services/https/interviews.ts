import type {
  CreateInterviewRequest,
  InterviewResultRequest,
  InterviewScheduleRecord,
  OfferRescheduleSlotsRequest,
  RequestRescheduleRequest,
  RescheduleEntry,
  SelectRescheduleSlotRequest,
  UpdateInterviewRequest,
} from '../../interface/IInterviewInterface'
import { apiFetch } from './index'

// ═══ [B6733827] ชั้นเรียก API ของระบบนัดหมายสัมภาษณ์ — 1 ฟังก์ชัน = 1 endpoint ═══════════
//   listMyInterviews          GET  /interviews                                 U8
//   createInterview           POST /employer/interviews                        U1
//   updateInterview           PUT  /employer/interviews/:id                    U1
//   requestReschedule         POST /student/interviews/:id/reschedule          U3 (นศ. เสนอ 1 เวลา)
//   offerRescheduleSlots      POST /employer/interviews/:id/reschedule-offer   U3 (ผู้ประกอบการเสนอ ≤5)
//   listReschedules           GET  /interviews/:id/reschedules                 U3/U8
//   approveReschedule/reject  POST /employer/reschedules/:id/approve|reject    U3
//   selectRescheduleSlot      POST /student/reschedules/:id/select             U3
//   sendInterviewResult       POST /employer/interviews/:id/result             U5
//   confirmInterviewAttendance POST /student/interviews/:id/confirm            U2
//   listAllInterviews         GET  /admin/interviews                           U8 (University Staff)
// apiFetch แนบ Authorization: Bearer <token> และแปลง error เป็น ApiError ให้หน้าจอแสดง
// ═════════════════════════════════════════════════════════════════════════════════════
export function listMyInterviews(token: string): Promise<InterviewScheduleRecord[]> {
  return apiFetch<InterviewScheduleRecord[]>('/api/v1/interviews', { token })
}

export function createInterview(token: string, payload: CreateInterviewRequest): Promise<InterviewScheduleRecord> {
  return apiFetch<InterviewScheduleRecord>('/api/v1/employer/interviews', { method: 'POST', token, body: payload })
}

export function updateInterview(token: string, id: number, payload: UpdateInterviewRequest): Promise<InterviewScheduleRecord> {
  return apiFetch<InterviewScheduleRecord>(`/api/v1/employer/interviews/${id}`, { method: 'PUT', token, body: payload })
}

/** Student asking to move an interview to a single time. */
export function requestReschedule(token: string, id: number, payload: RequestRescheduleRequest): Promise<RescheduleEntry> {
  return apiFetch<RescheduleEntry>(`/api/v1/student/interviews/${id}/reschedule`, { method: 'POST', token, body: payload })
}

/** Employer offering the student several times to choose from. */
export function offerRescheduleSlots(token: string, id: number, payload: OfferRescheduleSlotsRequest): Promise<RescheduleEntry> {
  return apiFetch<RescheduleEntry>(`/api/v1/employer/interviews/${id}/reschedule-offer`, { method: 'POST', token, body: payload })
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

/** [U8 · University Staff] Every interview in the system — admin read-only history. */
export function listAllInterviews(token: string): Promise<InterviewScheduleRecord[]> {
  return apiFetch<InterviewScheduleRecord[]>('/api/v1/admin/interviews', { token })
}
