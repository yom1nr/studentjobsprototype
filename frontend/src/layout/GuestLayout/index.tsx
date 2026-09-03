import { Box, Button, Typography } from '@mui/material'
import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom'
import studentLogo from '../../assets/student-logo.svg'

const colors = { text: '#000349', border: '#E8E8E8', accent: '#0090FF', logoAccent: '#045BE4', logoText: '#324054' }

// Shell for pages anonymous visitors can reach (currently just job browsing) —
// same top-bar idea as AppShell's header, but no sidebar and no auth-only
// state (notifications, profile, logout). "เข้าสู่ระบบ/สมัครสมาชิก" replace
// the logout button so guests have an obvious way in when they want to apply.
export default function GuestLayout() {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, md: 5 },
          py: 2,
          borderBottom: `1px solid ${colors.border}`,
          bgcolor: '#FFFFFF',
        }}
      >
        <Box component={RouterLink} to="/jobs" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
          <Box component="img" src={studentLogo} alt="Student Jobs" sx={{ width: 40, height: 38, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.2, color: colors.logoText }}>
            STUDENT <Box component="span" sx={{ color: colors.logoAccent }}>JOBS</Box>
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            onClick={() => navigate('/login')}
            sx={{ borderRadius: '40px', textTransform: 'none', color: colors.text, border: `1px solid ${colors.border}`, px: 3 }}
          >
            เข้าสู่ระบบ
          </Button>
          <Button
            onClick={() => navigate('/register')}
            variant="contained"
            sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: colors.accent, px: 3, '&:hover': { bgcolor: '#0070D6' } }}
          >
            สมัครสมาชิก
          </Button>
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
