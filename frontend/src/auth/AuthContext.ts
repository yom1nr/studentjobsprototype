import { createContext } from 'react'
import type { LoginRequest, RegisterRequest } from '../interface/IAuthInterface'
import type { UpdateProfileRequest, User } from '../interface/IUserInterface'

export type AuthState = {
  token: string | null
  user: User | null
  isLoading: boolean
}

export type AuthContextValue = AuthState & {
  login: (payload: LoginRequest, remember?: boolean) => Promise<void>
  // Returns the freshly-issued token so a caller can immediately make an
  // authenticated follow-up request (e.g. submitting an employer profile
  // right after registering) without waiting for a re-render to pick up
  // the updated context state.
  register: (payload: RegisterRequest) => Promise<string>
  logout: () => void
  refreshProfile: () => Promise<void>
  updateProfile: (payload: UpdateProfileRequest) => Promise<void>
  deleteAccount: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
