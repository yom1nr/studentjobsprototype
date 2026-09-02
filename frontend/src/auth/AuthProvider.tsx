import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthResponse, LoginRequest, RegisterRequest } from '../interface/IAuthInterface'
import type { UpdateProfileRequest, User } from '../interface/IUserInterface'
import * as authApi from '../services/https/auth'
import * as usersApi from '../services/https/users'
import { AuthContext, type AuthContextValue } from './AuthContext'

const TOKEN_STORAGE_KEY = 'auth_token'

function applyAuthResponse(res: AuthResponse): { token: string; user: User } {
  return { token: res.token, user: res.user }
}



export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!token) return
    const profile = await authApi.getProfile(token)
    setUser(profile)
  }, [token])

  const login = useCallback(async (payload: LoginRequest, remember?: boolean) => {
    const res = await authApi.login(payload)
    const next = applyAuthResponse(res)
    if (remember) {
      localStorage.setItem(TOKEN_STORAGE_KEY, next.token)
    } else {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, next.token)
    }
    setToken(next.token)
    setUser(next.user)
  }, [])

  const register = useCallback(async (payload: RegisterRequest) => {
    const res = await authApi.register(payload)
    const next = applyAuthResponse(res)
    localStorage.setItem(TOKEN_STORAGE_KEY, next.token)
    setToken(next.token)
    setUser(next.user)
    return next.token
  }, [])

  const updateProfile = useCallback(
    async (payload: UpdateProfileRequest) => {
      if (!token) return
      const updated = await usersApi.updateProfile(token, payload)
      setUser(updated)
    },
    [token],
  )

  const deleteAccount = useCallback(async () => {
    if (!token) return
    await usersApi.deleteAccount(token)
    logout()
  }, [token, logout])

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!token) {
        if (!cancelled) setIsLoading(false)
        return
      }

      try {
        const profile = await authApi.getProfile(token)
        if (!cancelled) setUser(profile)
      } catch {
        if (!cancelled) logout()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [token, logout])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isLoading,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
      deleteAccount,
    }),
    [token, user, isLoading, login, register, logout, refreshProfile, updateProfile, deleteAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
