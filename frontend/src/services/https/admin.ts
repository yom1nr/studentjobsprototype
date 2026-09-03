import type {
  AdminAuditLogEntry,
  AdminUpdateEmployerRequest,
  AdminUpdateStudentRequest,
  AuditLogQuery,
  EmployerApproval,
  EmployerApprovalStatus,
  EmployerDirectoryEntry,
  RejectEmployerRequest,
  StudentDirectoryEntry,
} from '../../interface/IAdminInterface'
import { apiFetch } from './index'

export function listEmployerApprovals(token: string, status: EmployerApprovalStatus = 'pending'): Promise<EmployerApproval[]> {
  return apiFetch<EmployerApproval[]>(`/api/v1/admin/employers?status=${status}`, { token })
}

export function getEmployerApprovalDetail(token: string, employerId: number): Promise<EmployerApproval> {
  return apiFetch<EmployerApproval>(`/api/v1/admin/employers/${employerId}`, { token })
}

export function approveEmployer(token: string, employerId: number): Promise<{ employer_id: number; status: string; reviewed_at: string }> {
  return apiFetch(`/api/v1/admin/employers/${employerId}/approve`, { method: 'POST', token })
}

export function rejectEmployer(
  token: string,
  employerId: number,
  payload: RejectEmployerRequest,
): Promise<{ employer_id: number; status: string; reviewed_at: string }> {
  return apiFetch(`/api/v1/admin/employers/${employerId}/reject`, { method: 'POST', token, body: payload })
}

export function requestEmployerDocuments(
  token: string,
  employerId: number,
  note?: string,
): Promise<{ employer_id: number; status: string; reviewed_at: string }> {
  return apiFetch(`/api/v1/admin/employers/${employerId}/request-document`, {
    method: 'POST',
    token,
    body: note ? { note } : undefined,
  })
}

export function listAllEmployers(token: string): Promise<EmployerDirectoryEntry[]> {
  return apiFetch<EmployerDirectoryEntry[]>('/api/v1/admin/employer-directory', { token })
}

export function updateEmployerDirectory(
  token: string,
  employerId: number,
  payload: AdminUpdateEmployerRequest,
): Promise<EmployerDirectoryEntry> {
  return apiFetch(`/api/v1/admin/employer-directory/${employerId}`, { method: 'PUT', token, body: payload })
}

export function listAllStudents(token: string): Promise<StudentDirectoryEntry[]> {
  return apiFetch<StudentDirectoryEntry[]>('/api/v1/admin/student-directory', { token })
}

export function updateStudentDirectory(
  token: string,
  studentId: number,
  payload: AdminUpdateStudentRequest,
): Promise<StudentDirectoryEntry> {
  return apiFetch(`/api/v1/admin/student-directory/${studentId}`, { method: 'PUT', token, body: payload })
}

export function listAuditLogs(token: string, query: AuditLogQuery = {}): Promise<AdminAuditLogEntry[]> {
  const params = new URLSearchParams()
  if (query.target_type) params.set('target_type', query.target_type)
  if (query.target_id != null) params.set('target_id', String(query.target_id))
  if (query.limit != null) params.set('limit', String(query.limit))
  if (query.offset != null) params.set('offset', String(query.offset))
  const qs = params.toString()
  return apiFetch<AdminAuditLogEntry[]>(`/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`, { token })
}
