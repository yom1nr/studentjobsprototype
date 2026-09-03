import type { InterviewFormat } from './IJobInterface'

export type RescheduleEntry = {
  id: number
  /** Who asked. 'student' proposes one time for the employer to approve;
   *  'employer' offers several times for the student to choose from. */
  requested_by: 'student' | 'employer'
  status: 'pending' | 'accepted' | 'rejected'
  /** The single time a student asked to move to. Empty on employer requests. */
  student_available_date_time: string
  /** RFC3339 times the employer offered. Empty on student requests. */
  proposed_slots: string[]
  /** The time both sides ended up with, once the request was settled. */
  new_appointment_date_time: string
  reschedule_reason: string
  responded_at: string
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
  /** '' until the employer announces the outcome, then 'passed' | 'failed'. */
  result: string
  /** The employer's note sent along with the result. */
  result_comment: string
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
  /** Student flow: the one time being asked for. */
  student_available_date_time?: string
  /** Employer flow: the times offered for the student to pick from. */
  proposed_slots?: string[]
  new_appointment_date_time?: string
}

export type SelectRescheduleSlotRequest = {
  selected_date_time: string
}

export type InterviewResultRequest = {
  result: 'passed' | 'failed'
  comment?: string
}

export type AgreementStatus = 'pending' | 'accepted' | 'rejected'

export type AgreementRecord = {
  id: number
  /** The interview this contract came out of — null on records created before
   *  agreements were tied to an interview. */
  interview_schedule_id: number | null
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
  /** Which passed interview to hire from; the student and position follow. */
  interview_id: number
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
