import { Box, Button, IconButton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined'
import { useNavigate } from 'react-router-dom'

const colors = { navy: '#000349', bg: '#DAEAF7' }

function RoleCard({
  icon,
  title,
  description,
  onClick,
}: Readonly<{ icon: React.ReactNode; title: string; description: string; onClick: () => void }>) {
  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        borderRadius: 4,
        p: 4,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        boxShadow: '0px 8px 40px rgba(0,3,73,0.06)',
      }}
    >
      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: 3,
          bgcolor: colors.navy,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          mb: 3,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy, mb: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>{description}</Typography>
      <Button
        onClick={onClick}
        variant="contained"
        fullWidth
        sx={{
          height: 48,
          borderRadius: '40px',
          textTransform: 'none',
          fontWeight: 600,
          bgcolor: colors.navy,
          '&:hover': { bgcolor: '#000226' },
        }}
      >
        สมัครสมาชิก
      </Button>
    </Box>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, p: { xs: 3, md: 6 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton onClick={() => navigate('/login')} sx={{ bgcolor: colors.navy, color: '#fff', '&:hover': { bgcolor: '#000226' } }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>
          สำหรับผู้ใช้งานใหม่
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 15, color: '#52545C', ml: { md: 7 }, mb: 5 }}>เลือกประเภทบัญชีเพื่อเริ่มต้นใช้งาน</Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, maxWidth: 900, mx: 'auto' }}>
        <RoleCard
          icon={<PersonOutlineOutlinedIcon sx={{ fontSize: 44 }} />}
          title="สมัครสมาชิกสำหรับนักศึกษา"
          description="ค้นหางานพาร์ทไทม์ที่เหมาะกับตารางเรียน สร้างโปรไฟล์ และสมัครงานได้เลย"
          onClick={() => navigate('/register/student')}
        />
        <RoleCard
          icon={<HomeWorkOutlinedIcon sx={{ fontSize: 44 }} />}
          title="สมัครสมาชิกสำหรับผู้ประกอบการ"
          description="ประกาศรับสมัครนักศึกษาพาร์ทไทม์ จัดการตำแหน่งงานและผู้สมัคร"
          onClick={() => navigate('/register/employer')}
        />
      </Box>
    </Box>
  )
}
