import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// Assumes it's nested under ProtectedRoute (token/isLoading already handled).
export function RoleRoute({ allow }: Readonly<{ allow: string[] }>) {
  const { user } = useAuth()

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/profile" replace />
  }

  return <Outlet />
}
