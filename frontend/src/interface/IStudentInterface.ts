export type StudentProfile = {
  id: number
  user_id: number
  first_name: string
  last_name: string
  date_of_birth?: string
  age?: number
  address: string
  university: string
  faculty: string
  major: string
  years: string
  skill: string
  available_time?: string
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
  available_time?: string
}

export type TimeSlot = {
  day: string
  start_time: string
  end_time: string
}

export type ExtractScheduleResponse = {
  class_slots: TimeSlot[]
  free_slots?: TimeSlot[]
}

