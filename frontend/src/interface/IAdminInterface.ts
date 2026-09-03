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

export type EmployerDirectoryEntry = {
  employer_id: number
  user_id: number
  email: string
  phone: string
  gender: string
  first_name: string
  last_name: string
  position: string
  line_id: string
  company_name: string
  business_type: string
  tax_id: string
  link: string
  company_address: string
}

export type AdminUpdateEmployerRequest = Partial<{
  first_name: string
  last_name: string
  email: string
  phone: string
  gender: string
  position: string
  line_id: string
  company_name: string
  business_type: string
  tax_id: string
  link: string
  company_address: string
}>

export type StudentDirectoryEntry = {
  student_id: number
  user_id: number
  email: string
  phone: string
  gender: string
  first_name: string
  last_name: string
  date_of_birth: string
  address: string
  university: string
  faculty: string
  major: string
  years: string
  skill: string
}

export type AdminUpdateStudentRequest = Partial<{
  first_name: string
  last_name: string
  email: string
  phone: string
  gender: string
  date_of_birth: string
  address: string
  university: string
  faculty: string
  major: string
  years: string
  skill: string
}>

export type AuditChange = { from: string; to: string }

export type AdminAuditLogEntry = {
  id: number
  admin_id: number | null
  admin_email: string
  action: string
  target_type: string
  target_id: number
  target_label: string
  /** JSON string: { "<field>": { "from": "...", "to": "..." } } — may be "" */
  changes: string
  created_at: string
}

export type AuditLogQuery = Partial<{
  target_type: string
  target_id: number
  limit: number
  offset: number
}>
