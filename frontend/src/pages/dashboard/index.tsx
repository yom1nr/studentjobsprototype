import { useState } from 'react'
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'

const colors = { navy: '#000349', accent: '#3D8BFF' }

export default function DashboardPage() {
  usePageTitle('หน้าหลัก')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function goToJobs() {
    navigate('/jobs', query.trim() ? { state: { query } } : undefined)
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 6 }}>
      <Box
        sx={{
          position: 'relative',
          bgcolor: colors.navy,
          borderRadius: 4,
          px: { xs: 3, md: 8 },
          pt: { xs: 6, md: 8 },
          pb: { xs: 10, md: 12 },
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 28, md: 44 },
            color: '#FFFFFF',
            lineHeight: 1.25,
          }}
        >
          แพลตฟอร์มพาร์ทไทม์สำหรับ
          <br />
          <Box component="span" sx={{ color: colors.accent }}>นักศึกษา</Box>โดยเฉพาะ
        </Typography>

        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, mt: 3, maxWidth: 640, mx: 'auto' }}>
          เชื่อมโยงนักศึกษาที่ต้องการหารายได้พิเศษ กับสถานประกอบการในพื้นที่ และใกล้เคียง
          สะดวก ปลอดภัย และมีมหาวิทยาลัยเป็นสื่อกลางในการดูแล
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            onClick={() => navigate('/jobs')}
            sx={{ bgcolor: colors.accent, borderRadius: '40px', textTransform: 'none', px: 3.5, py: 1.3, fontWeight: 600, '&:hover': { bgcolor: '#2A78E8' } }}
          >
            เริ่มต้นหางานเลย
          </Button>
          <Button
            variant="outlined"
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3.5, py: 1.3, fontWeight: 600, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
          >
            สำหรับผู้ประกอบการ
          </Button>
        </Box>

        <Box
          sx={{
            position: 'absolute',
            left: { xs: 16, md: 48 },
            right: { xs: 16, md: 48 },
            bottom: -32,
            bgcolor: '#FFFFFF',
            borderRadius: '20px',
            boxShadow: '0px 12px 40px rgba(0,3,73,0.18)',
            p: 1.5,
            display: 'flex',
            gap: 1.5,
          }}
        >
          <TextField
            placeholder="ค้นหาชื่องาน, บริษัท, ประเภทงาน"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> } }}
          />
          <Button
            startIcon={<TuneOutlinedIcon />}
            sx={{ borderRadius: '14px', textTransform: 'none', color: colors.navy, bgcolor: '#F0F0F0', px: 2.5, flexShrink: 0, '&:hover': { bgcolor: '#E4E4E4' } }}
          >
            ตัวกรอง
          </Button>
          <Button
            variant="contained"
            onClick={goToJobs}
            sx={{ borderRadius: '14px', textTransform: 'none', bgcolor: colors.accent, px: 3.5, flexShrink: 0, '&:hover': { bgcolor: '#2A78E8' } }}
          >
            ค้นหา
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
