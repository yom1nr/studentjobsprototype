import type {
  CheckInRequest,
  CreateTimeEditRequestPayload,
  RejectTimeEditRequestPayload,
  TimeEditRequestRecord,
  TimeRecordEntry,
} from '../../interface/ITimeTrackingInterface'
import { apiFetch } from './index'

export function checkIn(token: string, payload: CheckInRequest): Promise<TimeRecordEntry> {
  return apiFetch<TimeRecordEntry>('/api/v1/student/time-records/check-in', { method: 'POST', token, body: payload })
}

export function checkOut(token: string, id: number): Promise<TimeRecordEntry> {
  return apiFetch<TimeRecordEntry>(`/api/v1/student/time-records/${id}/check-out`, { method: 'POST', token, body: {} })
}

export function listMyTimeRecords(token: string): Promise<TimeRecordEntry[]> {
  return apiFetch<TimeRecordEntry[]>('/api/v1/student/time-records', { token })
}

export function listEmployerTimeRecords(token: string): Promise<TimeRecordEntry[]> {
  return apiFetch<TimeRecordEntry[]>('/api/v1/employer/time-records', { token })
}

export function createEditRequest(token: string, timeRecordId: number, payload: CreateTimeEditRequestPayload): Promise<TimeEditRequestRecord> {
  return apiFetch<TimeEditRequestRecord>(`/api/v1/student/time-records/${timeRecordId}/edit-request`, { method: 'POST', token, body: payload })
}

export function listEmployerEditRequests(token: string): Promise<TimeEditRequestRecord[]> {
  return apiFetch<TimeEditRequestRecord[]>('/api/v1/employer/time-edit-requests', { token })
}

export function approveEditRequest(token: string, id: number): Promise<TimeEditRequestRecord> {
  return apiFetch<TimeEditRequestRecord>(`/api/v1/employer/time-edit-requests/${id}/approve`, { method: 'POST', token })
}

export function rejectEditRequest(token: string, id: number, payload: RejectTimeEditRequestPayload): Promise<TimeEditRequestRecord> {
  return apiFetch<TimeEditRequestRecord>(`/api/v1/employer/time-edit-requests/${id}/reject`, { method: 'POST', token, body: payload })
}
