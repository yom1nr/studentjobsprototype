import { useMemo, useState, type SyntheticEvent } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from '@mui/material'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import GoogleIcon from '@mui/icons-material/Google'
import FacebookIcon from '@mui/icons-material/Facebook'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { ApiError } from '../../../services/https'
import { ErrorAlert } from '../../../components/ErrorAlert'
import { useAuth } from '../../../auth/useAuth'
import { AuthLayout } from '../../../components/AuthLayout'

const colors = { navy: '#000349' }

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('remembered_email') !== null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password])

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login({ email: email.trim(), password }, rememberMe)
      if (rememberMe) {
        localStorage.setItem('remembered_email', email.trim())
      } else {
        localStorage.removeItem('remembered_email')
      }
      navigate('/profile', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('Login failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 3 }}>
        เข้าสู่ระบบ
      </Typography>

      <ErrorAlert message={error} />

          <Box component="form" onSubmit={onSubmit} noValidate>
            <Typography sx={{ fontWeight: 600, fontSize: 15, color: colors.navy, mb: 0.75 }}>อีเมลหรือชื่อผู้ใช้</Typography>
            <TextField
              type="text"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              placeholder="กรุณากรอกอีเมลหรือชื่อผู้ใช้"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '40px' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon sx={{ color: colors.navy }} fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Typography sx={{ fontWeight: 600, fontSize: 15, color: colors.navy, mt: 2.5, mb: 0.75 }}>รหัสผ่าน</Typography>
            <TextField
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="กรุณากรอกรหัสผ่าน"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '40px' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon sx={{ color: colors.navy }} fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        edge="end"
                        onClick={() => setShowPassword((s) => !s)}
                      >
                        {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} size="small" />}
                label={<Typography sx={{ fontSize: 14, color: colors.navy }}>จดจำฉันไว้ในระบบ</Typography>}
              />
              <Link component={RouterLink} to="/forgot-password" underline="hover" sx={{ fontSize: 14, color: colors.navy, fontWeight: 500 }}>
                ลืมรหัสผ่าน?
              </Link>
            </Box>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!canSubmit || submitting}
              sx={{
                mt: 2.5,
                height: 50,
                borderRadius: '40px',
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 600,
                bgcolor: colors.navy,
                '&:hover': { bgcolor: '#000226' },
              }}
            >
              {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 3 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: '#E0E0E0' }} />
              <Typography sx={{ fontSize: 13, color: '#8A8A8A', whiteSpace: 'nowrap' }}>หรือเข้าสู่ระบบด้วย</Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: '#E0E0E0' }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<GoogleIcon sx={{ color: '#EA4335' }} />}
                sx={{ borderRadius: '40px', textTransform: 'none', color: colors.navy, borderColor: '#D9D9D9', height: 46 }}
              >
                Log in with Google
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<FacebookIcon sx={{ color: '#1877F2' }} />}
                sx={{ borderRadius: '40px', textTransform: 'none', color: colors.navy, borderColor: '#D9D9D9', height: 46 }}
              >
                Log in with Facebook
              </Button>
            </Box>
          </Box>

      <Typography sx={{ textAlign: 'center', mt: 3, fontSize: 14, color: colors.navy }}>
        ยังไม่มีบัญชี?{' '}
        <Link component={RouterLink} to="/register" underline="hover" sx={{ fontWeight: 600, color: '#045BE4' }}>
          สมัครสมาชิก
        </Link>
      </Typography>
    </AuthLayout>
  )
}
