import type { InterviewFormat } from './IJobInterface'

export type RescheduleEntry = {
  id: number
  student_available_date_time: string
  new_appointment_date_time: string
  reschedule_reason: string
  created_at: string
}

export type InterviewScheduleRecord = {
  id: number
  /** Which application this appointment is for. Null on rows created before
   *  interviews were tied to an application. */
  application_id: number | null
  student_id: number
  student_name: string
  employer_id: number
  company_name: string
  interview_format: InterviewFormat
  appointment_date: string
  appointment_time: string
  location: string
  preparation_details: string
  status: string
  result: string
  created_at: string
  reschedules?: RescheduleEntry[]
}

export type CreateInterviewRequest = {
  application_id: number
  interview_format: InterviewFormat
  appointment_date: string
  appointment_time: string
  location?: string
  preparation_details?: string
}

/** Editing only changes the appointment details — which application it belongs
 *  to is fixed when it is created. */
export type UpdateInterviewRequest = Omit<CreateInterviewRequest, 'application_id'>

export type RequestRescheduleRequest = {
  reason: string
  student_available_date_time?: string
  new_appointment_date_time?: string
}

export type InterviewResultRequest = {
  result: 'passed' | 'failed'
  comment?: string
}

export type AgreementStatus = 'pending' | 'accepted' | 'rejected'

export type AgreementRecord = {
  id: number
  student_id: number
  student_name: string
  employer_id: number
  company_name: string
  start_date: string
  wage_rate: number
  duration_months: number
  working_hours: string
  leave_policy: string
  additional_terms: string
  status: AgreementStatus
  reject_reason: string
  created_at: string
}

export type CreateAgreementRequest = {
  student_id: number
  start_date: string
  wage_rate: number
  duration_months: number
  working_hours: string
  leave_policy?: string
  additional_terms?: string
}

export type RejectAgreementRequest = {
  reason: string
}
