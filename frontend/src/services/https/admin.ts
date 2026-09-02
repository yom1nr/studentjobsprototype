import type { EmployerApproval, EmployerApprovalStatus, RejectEmployerRequest } from '../../interface/IAdminInterface'
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

export function requestDocuments(token: string, employerId: number): Promise<{ employer_id: number; status: string; reviewed_at: string }> {
  return apiFetch(`/api/v1/admin/employers/${employerId}/request-document`, { method: 'POST', token })
}
