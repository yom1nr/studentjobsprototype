import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../auth/useAuth'

export function PublicOnlyRoute() {
  const { token, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (token) {
    return <Navigate to="/profile" replace />
  }

  return <Outlet />
}
