import { useState, type SyntheticEvent } from 'react'
import { Box, Button, Link, TextField, Typography } from '@mui/material'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined'
import { InputAdornment } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { AuthLayout } from '../../../components/AuthLayout'

const colors = { navy: '#000349' }

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    // No backend endpoint for password reset yet — UI-only confirmation.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2 }}>
          <CheckCircleOutlineOutlined sx={{ fontSize: 64, color: '#217829' }} />
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: colors.navy }}>
            ส่งลิงก์เรียบร้อยแล้ว
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#697077' }}>
            กรุณาตรวจสอบอีเมล {email} เพื่อดำเนินการรีเซ็ตรหัสผ่าน
          </Typography>
          <Link component={RouterLink} to="/login" underline="hover" sx={{ mt: 1, fontWeight: 600, color: '#045BE4' }}>
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </Box>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 3 }}>
        ลืมรหัสผ่าน
      </Typography>

      <Typography sx={{ fontSize: 14, color: '#52545C', mb: 3 }}>
        กรอกอีเมลที่คุณใช้สมัครสมาชิก
        <br />
        เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมลของคุณ
      </Typography>

      <Box component="form" onSubmit={onSubmit} noValidate>
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: colors.navy, mb: 0.75 }}>อีเมล</Typography>
        <TextField
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={email.trim().length === 0}
          sx={{
            mt: 3,
            height: 50,
            borderRadius: '40px',
            textTransform: 'none',
            fontSize: 16,
            fontWeight: 600,
            bgcolor: colors.navy,
            '&:hover': { bgcolor: '#000226' },
          }}
        >
          ส่งลิงค์รีเซ็ตรหัสผ่าน
        </Button>

        <Typography sx={{ textAlign: 'center', mt: 3 }}>
          <Link component={RouterLink} to="/login" underline="hover" sx={{ fontSize: 14, color: colors.navy }}>
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </Typography>
      </Box>
    </AuthLayout>
  )
}
