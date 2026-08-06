import { Box, CircularProgress } from '@mui/material'

export function Loader() {
  return (
    <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  )
}
