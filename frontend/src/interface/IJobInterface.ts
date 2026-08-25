export type JobStatus = 'open' | 'closed' | 'draft'

export type Jobpost = {
  id: number
  employer_id: number
  company_name: string
  position: string
  job_type: string
  job_description: string
  date_start: string | null
  wage: number
  period: string
  location: string
  welfare: string
  property: string
  quantity: number
  status: JobStatus
  created_at: string
}

export type UpsertJobpostRequest = {
  position: string
  job_type?: string
  job_description?: string
  date_start?: string
  wage: number
  period?: string
  location?: string
  welfare?: string
  property?: string
  quantity?: number
}

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected'

export type Application = {
  id: number
  jobpost_id: number
  position: string
  company_name: string
  student_id: number
  student_name: string
  student_university: string
  student_phone: string
  student_email: string
  remarks: string
  status: ApplicationStatus
  apply_date: string
}

export type CreateApplicationRequest = {
  jobpost_id: number
  remarks?: string
}

// "correction_requested" only ever appears as a review action/audit entry — it
// leaves Application.status ("pending"/"accepted"/"rejected") unchanged.
export type ApplicationReviewResult = 'accepted' | 'rejected' | 'correction_requested'

export type ReviewApplicationRequest = {
  result_status: ApplicationReviewResult
  comment?: string
}

// The university admin's own final pass/fail check, layered on top of an
// employer's accept/reject (Application.status) — a separate audit trail.
export type AdminApplicationReviewStatus = 'awaiting' | 'passed' | 'failed'

export type AdminApplication = {
  id: number
  jobpost_id: number
  position: string
  company_name: string
  student_id: number
  student_name: string
  student_university: string
  status: ApplicationStatus
  review_status: AdminApplicationReviewStatus
  comment: string
  checked_at: string
}

export type VerifyApplicationRequest = {
  result_status: 'passed' | 'failed'
  comment?: string
}

export type InterviewFormat = 'online' | 'onsite'
export type InterviewResult = 'awaiting' | 'passed' | 'failed'

export type InterviewSchedule = {
  id: number
  company_name: string
  position: string
  interview_format: InterviewFormat
  appointment_date: string
  appointment_time: string
  location: string
  preparation_details: string
  result: InterviewResult
}

export type EmploymentAgreementStatus = 'awaiting_response' | 'accepted' | 'rejected'

export type EmploymentAgreement = {
  id: number
  company_name: string
  position: string
  start_date: string
  wage_rate: number
  duration_months: number
  working_hours: string
  leave_policy: string
  status: EmploymentAgreementStatus
}

export type PaymentStatus = 'pending' | 'paid' | 'cancelled'

export type Payroll = {
  id: number
  company_name: string
  cycle_start_date: string
  cycle_end_date: string
  total_hours: number
  net_pay_amount: number
  payment_status: PaymentStatus
}
