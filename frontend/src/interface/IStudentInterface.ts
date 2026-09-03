export type StudentProfile = {
  id: number
  user_id: number
  first_name: string
  last_name: string
  date_of_birth: string // YYYY-MM-DD, '' when unset
  age: number // derived from date_of_birth
  gender: string
  phone: string
  address: string
  university: string
  faculty: string
  major: string
  years: string
  skill: string
  available_time: string
  avatar: string
  created_at: string
  updated_at: string
}

export type UpsertStudentProfileRequest = {
  first_name: string
  last_name: string
  date_of_birth?: string
  gender?: string
  phone?: string
  address?: string
  university?: string
  faculty?: string
  major?: string
  years?: string
  skill?: string
  available_time?: string
  avatar?: string
}
