import { Box, Button, Container, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
        <Typography variant="h4">404</Typography>
        <Typography color="text.secondary">Page not found</Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Go home
        </Button>
      </Box>
    </Container>
  )
}
