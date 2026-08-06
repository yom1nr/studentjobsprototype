import type { Application, CreateApplicationRequest, ReviewApplicationRequest } from '../../interface/IJobInterface'
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
