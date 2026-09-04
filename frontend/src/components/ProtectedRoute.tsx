import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../auth/useAuth'

export function ProtectedRoute() {
  const { token, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!token) {
    // Landing page, not /login: it is the entry point for logged-out visitors
    // and the natural place to end up after logging out. Making this the single
    // redirect target means the logout handler doesn't have to race it.
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
