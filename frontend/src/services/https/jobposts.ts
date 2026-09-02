import type { Jobpost, UpsertJobpostRequest } from '../../interface/IJobInterface'
import { apiFetch } from './index'

export function listOpenJobposts(token?: string | null): Promise<Jobpost[]> {
  return apiFetch<Jobpost[]>('/api/v1/jobposts', { token })
}

export function getJobpostDetail(token: string | null | undefined, id: number): Promise<Jobpost> {
  return apiFetch<Jobpost>(`/api/v1/jobposts/${id}`, { token })
}

export function listMyJobposts(token: string): Promise<Jobpost[]> {
  return apiFetch<Jobpost[]>('/api/v1/employer/jobposts', { token })
}

export function createJobpost(token: string, payload: UpsertJobpostRequest): Promise<Jobpost> {
  return apiFetch<Jobpost>('/api/v1/employer/jobposts', { method: 'POST', token, body: payload })
}

export function updateJobpost(token: string, id: number, payload: UpsertJobpostRequest): Promise<Jobpost> {
  return apiFetch<Jobpost>(`/api/v1/employer/jobposts/${id}`, { method: 'PUT', token, body: payload })
}

export function closeJobpost(token: string, id: number): Promise<Jobpost> {
  return apiFetch<Jobpost>(`/api/v1/employer/jobposts/${id}/close`, { method: 'POST', token })
}

export function deleteJobpost(token: string, id: number): Promise<void> {
  return apiFetch<void>(`/api/v1/employer/jobposts/${id}`, { method: 'DELETE', token })
}
