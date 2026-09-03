export type EmployerApproval = {
  employer_id: number
  user_id: number
  email: string
  phone: string
  first_name: string
  last_name: string
  position: string
  company_name: string
  business_type: string
  tax_id: string
  company_address: string
  /** Uploaded verification documents (URLs), '' when not attached. */
  company_regis: string
  logo: string
  card_id: string
  status: string // pending | request_document | approved | rejected
  date_of_sign_up: string
}

export type RejectEmployerRequest = {
  reason: string
}

export type EmployerApprovalStatus = 'pending' | 'approved' | 'rejected'
