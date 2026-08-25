import type { CreatePayrollRequest, PayrollRecord } from '../../interface/IPayrollInterface'
import { apiFetch } from './index'

export function listMyPayrolls(token: string): Promise<PayrollRecord[]> {
  return apiFetch<PayrollRecord[]>('/api/v1/payrolls', { token })
}

export function createPayroll(token: string, payload: CreatePayrollRequest): Promise<PayrollRecord> {
  return apiFetch<PayrollRecord>('/api/v1/employer/payrolls', { method: 'POST', token, body: payload })
}

export function approvePayroll(token: string, id: number): Promise<PayrollRecord> {
  return apiFetch<PayrollRecord>(`/api/v1/employer/payrolls/${id}/approve`, { method: 'POST', token })
}

export function confirmPayrollReceipt(token: string, id: number): Promise<PayrollRecord> {
  return apiFetch<PayrollRecord>(`/api/v1/student/payrolls/${id}/confirm`, { method: 'POST', token })
}
