export type StudentProfile = {
  id: number
  user_id: number
  first_name: string
  last_name: string
  date_of_birth?: string
  address: string
  university: string
  faculty: string
  major: string
  years: string
  skill: string
  schedule: string
  transcript: string
  resume: string
  created_at: string
  updated_at: string
}

export type UpsertStudentProfileRequest = {
  first_name: string
  last_name: string
  date_of_birth?: string
  address?: string
  university?: string
  faculty?: string
  major?: string
  years?: string
  skill?: string
  profile_picture?: string
  schedule?: string
  transcript?: string
  resume?: string
}
