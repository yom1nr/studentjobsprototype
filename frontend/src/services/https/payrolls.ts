import type { CreatePayrollRequest, PayrollRecord, PayrollSummary } from '../../interface/IPayrollInterface'
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

// Employer's monthly pay-disbursement report (FR8 / U6). month is "YYYY-MM";
// omit it to get the current month.
export function getMonthlyPayrollSummary(token: string, month?: string): Promise<PayrollSummary> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiFetch<PayrollSummary>(`/api/v1/employer/payrolls/summary${qs}`, { token })
}
