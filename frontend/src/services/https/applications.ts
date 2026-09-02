import type { AdminApplication, Application, CreateApplicationRequest, ReviewApplicationRequest, VerifyApplicationRequest } from '../../interface/IJobInterface'
import { apiFetch } from './index'

export function createApplication(token: string, payload: CreateApplicationRequest): Promise<Application> {
  return apiFetch<Application>('/api/v1/student/applications', { method: 'POST', token, body: payload })
}

export function listMyApplications(token: string): Promise<Application[]> {
  return apiFetch<Application[]>('/api/v1/student/applications', { token })
}

export function listEmployerApplications(token: string): Promise<Application[]> {
  return apiFetch<Application[]>('/api/v1/employer/applications', { token })
}

export function getEmployerApplicationDetail(token: string, id: number): Promise<Application> {
  return apiFetch<Application>(`/api/v1/employer/applications/${id}`, { token })
}

export function reviewApplication(token: string, id: number, payload: ReviewApplicationRequest): Promise<Application> {
  return apiFetch<Application>(`/api/v1/employer/applications/${id}/review`, { method: 'POST', token, body: payload })
}

export function deleteApplication(token: string, id: number): Promise<{ deleted: boolean; interviews_removed: number }> {
  return apiFetch<{ deleted: boolean; interviews_removed: number }>(`/api/v1/employer/applications/${id}`, { method: 'DELETE', token })
}

export function listAdminApplications(token: string): Promise<AdminApplication[]> {
  return apiFetch<AdminApplication[]>('/api/v1/admin/applications', { token })
}

export function getAdminApplicationDetail(token: string, id: number): Promise<AdminApplication> {
  return apiFetch<AdminApplication>(`/api/v1/admin/applications/${id}`, { token })
}

export function verifyApplication(token: string, id: number, payload: VerifyApplicationRequest): Promise<AdminApplication> {
  return apiFetch<AdminApplication>(`/api/v1/admin/applications/${id}/verify`, { method: 'POST', token, body: payload })
}
