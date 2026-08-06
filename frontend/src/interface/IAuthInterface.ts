import type { User } from './IUserInterface'

export type AuthResponse = {
  token: string
  user: User
}

export type RegisterRequest = {
  user_name: string
  email: string
  password: string
  phone?: string
  gender?: string
  role?: string
}

export type LoginRequest = {
  email: string
  password: string
}
