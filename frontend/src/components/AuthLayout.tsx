import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import studentLogo from '../assets/student-logo.png'

const colors = { bg: '#DAEAF7', navy: '#000349' }

export function AuthLayout({ children, cardMaxWidth = 480 }: Readonly<{ children: ReactNode; cardMaxWidth?: number }>) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        bgcolor: colors.bg,
      }}
    >
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <Box component="img" src={studentLogo} alt="" sx={{ width: 220, height: 'auto' }} />
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>
          STUDENT <Box component="span" sx={{ color: '#045BE4' }}>JOBS</Box>
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 3, md: 6 } }}>
        <Box
          sx={{
            bgcolor: '#FFFFFF',
            borderRadius: 4,
            p: { xs: 4, md: 6 },
            width: '100%',
            maxWidth: cardMaxWidth,
            boxShadow: '0px 8px 40px rgba(0,3,73,0.08)',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
