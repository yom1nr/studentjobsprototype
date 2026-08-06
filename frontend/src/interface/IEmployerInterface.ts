export type EmployerProfile = {
  id: number
  user_id: number
  first_name: string
  last_name: string
  position: string
  line_id: string
  company_name: string
  business_type: string
  tax_id: string
  link: string
  company_address: string
  approve_status: string
  created_at: string
  updated_at: string
}

export type UpsertEmployerProfileRequest = {
  first_name: string
  last_name: string
  position?: string
  line_id?: string
  company_name: string
  business_type?: string
  tax_id: string
  link?: string
  company_address?: string
}
