export type PaymentStatus = 'pending' | 'paid' | 'cancelled'

export type PayrollRecord = {
  id: number
  employment_agreement_id: number
  student_id: number
  student_name: string
  employer_id: number
  company_name: string
  cycle_start_date: string
  cycle_end_date: string
  total_hours: number
  wage_rate: number
  net_pay_amount: number
  payment_status: PaymentStatus
  is_student_confirmed: boolean
  transfer_date_time: string
  created_at: string
}

export type CreatePayrollRequest = {
  employment_agreement_id: number
  cycle_start_date: string
  cycle_end_date: string
}

export type PayrollSummaryStudentRow = {
  student_id: number
  student_name: string
  cycles: number
  total_hours: number
  total_amount: number
  paid_amount: number
  pending_amount: number
}

export type PayrollSummary = {
  month: string // YYYY-MM
  total_cycles: number
  total_hours: number
  total_amount: number
  paid_amount: number
  pending_amount: number
  confirmed_count: number
  by_student: PayrollSummaryStudentRow[]
}
