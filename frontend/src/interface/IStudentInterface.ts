export type StudentProfile = {
  id: number
  user_id: number
  first_name: string
  last_name: string
  address: string
  university: string
  faculty: string
  major: string
  years: string
  skill: string
  created_at: string
  updated_at: string
}

export type UpsertStudentProfileRequest = {
  first_name: string
  last_name: string
  address?: string
  university?: string
  faculty?: string
  major?: string
  years?: string
  skill?: string
}
