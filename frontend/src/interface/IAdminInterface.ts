export type EmployerApproval = {
  employer_id: number
  user_id: number
  email: string
  first_name: string
  last_name: string
  company_name: string
  business_type: string
  tax_id: string
  company_address: string
  status: string
  date_of_sign_up: string
}

export type RejectEmployerRequest = {
  reason: string
}

export type EmployerApprovalStatus = 'pending' | 'approved' | 'rejected'
