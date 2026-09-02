export type User = {
  id: number
  user_name: string
  email: string
  phone: string
  gender: string
  role: string   // 'student' | 'employer' | 'admin'
  profile_picture: string
  created_at: string
  updated_at: string
}

export type UpdateProfileRequest = {
  user_name?: string
  email?: string
  current_password?: string
  password?: string
  phone?: string
  gender?: string
  role?: string
  profile_picture?: string
}
