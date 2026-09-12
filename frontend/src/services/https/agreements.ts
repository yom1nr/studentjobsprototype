import type {
  AgreementRecord,
  CreateAgreementRequest,
  RejectAgreementRequest,
} from '../../interface/IInterviewInterface'
import { apiFetch } from './index'

// ═══ [B6733827] ชั้นเรียก API ของระบบตกลงการจ้างงาน ══════════════════════════════════
//   listMyAgreements   GET    /agreements                        U8  (ทั้ง 2 role)
//   createAgreement    POST   /employer/agreements               U6
//   acceptAgreement    POST   /student/agreements/:id/accept     U7
//   rejectAgreement    POST   /student/agreements/:id/reject     U7  (body: { reason })
//   deleteAgreement    DELETE /employer/agreements/:id           soft delete → void
//   listAllAgreements  GET    /admin/agreements                  U8 (University Staff อ่านทั้งระบบ)
// ═════════════════════════════════════════════════════════════════════════════════════
export function listMyAgreements(token: string): Promise<AgreementRecord[]> {
  return apiFetch<AgreementRecord[]>('/api/v1/agreements', { token })
}

export function createAgreement(token: string, payload: CreateAgreementRequest): Promise<AgreementRecord> {
  return apiFetch<AgreementRecord>('/api/v1/employer/agreements', { method: 'POST', token, body: payload })
}

export function acceptAgreement(token: string, id: number): Promise<AgreementRecord> {
  return apiFetch<AgreementRecord>(`/api/v1/student/agreements/${id}/accept`, { method: 'POST', token })
}

export function rejectAgreement(token: string, id: number, payload: RejectAgreementRequest): Promise<AgreementRecord> {
  return apiFetch<AgreementRecord>(`/api/v1/student/agreements/${id}/reject`, { method: 'POST', token, body: payload })
}

/** Remove a declined offer from the employer's records. Only rejected ones. */
export function deleteAgreement(token: string, id: number): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/api/v1/employer/agreements/${id}`, { method: 'DELETE', token })
}

/** [U8 · University Staff] Every agreement in the system — admin read-only history. */
export function listAllAgreements(token: string): Promise<AgreementRecord[]> {
  return apiFetch<AgreementRecord[]>('/api/v1/admin/agreements', { token })
}
