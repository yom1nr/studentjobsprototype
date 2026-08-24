import type { Complaint } from '../../interface/IComplaintInterface'
import { apiFetch } from './index'

export type CreateComplaintRequest = {
  title: string
  description: string
  reference_type?: string
}

export type AddComplaintAttachmentRequest = {
  file_name: string
  file_type?: string
  file_size?: number
}

export type AddComplaintHistoryRequest = {
  status: Complaint['status']
  note?: string
}

export function createComplaint(token: string, payload: CreateComplaintRequest): Promise<Complaint> {
  return apiFetch<Complaint>('/api/v1/complaints', { method: 'POST', token, body: payload })
}

export function listMyComplaints(token: string): Promise<Complaint[]> {
  return apiFetch<Complaint[]>('/api/v1/complaints', { token })
}

export function getComplaintDetail(token: string, id: number): Promise<Complaint> {
  return apiFetch<Complaint>(`/api/v1/complaints/${id}`, { token })
}

export function addComplaintAttachment(token: string, id: number, payload: AddComplaintAttachmentRequest): Promise<Complaint> {
  return apiFetch<Complaint>(`/api/v1/complaints/${id}/attachments`, { method: 'POST', token, body: payload })
}

export function listAllComplaints(token: string): Promise<Complaint[]> {
  return apiFetch<Complaint[]>('/api/v1/admin/complaints', { token })
}

export function addComplaintHistory(token: string, id: number, payload: AddComplaintHistoryRequest): Promise<Complaint> {
  return apiFetch<Complaint>(`/api/v1/admin/complaints/${id}/history`, { method: 'POST', token, body: payload })
}
