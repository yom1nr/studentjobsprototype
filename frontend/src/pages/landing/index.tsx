import { useState } from 'react'
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined'
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined'
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined'
import type { SvgIconComponent } from '@mui/icons-material'
import { usePageTitle } from '../../components/usePageTitle'
import studentLogo from '../../assets/student-logo.svg'

const colors = {
  navy: '#000349',
  navyDeep: '#000226',
  accent: '#0090FF',
  text: '#000349',
  subtext: '#697077',
  border: '#E8E8E8',
  logoAccent: '#045BE4',
  logoText: '#324054',
}

const STATS: { icon: SvgIconComponent; value: string; label: string }[] = [
  { icon: PeopleAltOutlinedIcon, value: '1,200+', label: 'นักศึกษาลงทะเบียน' },
  { icon: ApartmentOutlinedIcon, value: '300+', label: 'สถานประกอบการพันธมิตร' },
  { icon: WorkOutlineOutlinedIcon, value: '500+', label: 'ตำแหน่งงานที่เปิดรับ' },
  { icon: StarOutlineOutlinedIcon, value: '4.8/5', label: 'คะแนนความพึงพอใจ' },
]

const FEATURES: { icon: SvgIconComponent; title: string; description: string }[] = [
  { icon: TravelExploreOutlinedIcon, title: 'ค้นหางานง่าย รวดเร็ว', description: 'ค้นหาและกรองงานพาร์ทไทม์ใกล้มหาวิทยาลัยได้ตามตำแหน่ง ประเภทงาน และอัตราค่าจ้างที่ต้องการ' },
  { icon: VerifiedUserOutlinedIcon, title: 'ปลอดภัย มีมหาวิทยาลัยดูแล', description: 'ทุกสถานประกอบการผ่านการตรวจสอบและอนุมัติจากเจ้าหน้าที่มหาวิทยาลัยก่อนเปิดรับสมัครงาน' },
  { icon: EventAvailableOutlinedIcon, title: 'นัดสัมภาษณ์และเซ็นสัญญาออนไลน์', description: 'จัดตารางสัมภาษณ์ ติดตามผล และยืนยันข้อตกลงการจ้างงานได้ในระบบเดียว ไม่ต้องเดินเอกสาร' },
  { icon: AccessTimeOutlinedIcon, title: 'บันทึกเวลาทำงานแบบเรียลไทม์', description: 'เช็คอิน-เช็คเอาต์ผ่านระบบ พร้อมยื่นคำร้องแก้ไขเวลาได้ทันทีหากมีข้อผิดพลาด' },
  { icon: PaymentsOutlinedIcon, title: 'คำนวณและจ่ายค่าตอบแทนตรงเวลา', description: 'ระบบคำนวณค่าตอบแทนอัตโนมัติจากชั่วโมงทำงานจริง พร้อมสลีปเงินเดือนตรวจสอบย้อนหลังได้' },
  { icon: SupportAgentOutlinedIcon, title: 'แจ้งปัญหาและติดตามได้ตลอด', description: 'ยื่นเรื่องร้องเรียนหรือแจ้งปัญหาได้ตรงจากระบบ พร้อมติดตามสถานะการดำเนินการทุกขั้นตอน' },
]

const STEPS: { title: string; description: string }[] = [
  { title: 'สมัครสมาชิกและยืนยันตัวตน', description: 'ลงทะเบียนด้วยข้อมูลนักศึกษาหรือสถานประกอบการ รอการตรวจสอบจากมหาวิทยาลัย' },
  { title: 'ค้นหาและสมัครงานที่ใช่', description: 'เลือกงานที่ตรงกับความสนใจและเวลาว่าง แล้วยื่นใบสมัครได้ทันที' },
  { title: 'สัมภาษณ์และเซ็นสัญญา', description: 'นัดหมายสัมภาษณ์ ติดตามผล และยืนยันข้อตกลงการจ้างงานผ่านระบบ' },
  { title: 'ทำงานและรับค่าตอบแทน', description: 'บันทึกเวลาทำงาน ตรวจสอบสลีปเงินเดือน และรับค่าตอบแทนตรงเวลาทุกรอบ' },
]

const NAV_LINKS = [
  { href: '#features', label: 'ฟีเจอร์' },
  { href: '#how-it-works', label: 'วิธีใช้งาน' },
  { href: '#stats', label: 'สถิติ' },
]

export default function LandingPage() {
  usePageTitle('Student Jobs')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState('')

  function goToJobs() {
    navigate('/jobs', query.trim() ? { state: { query } } : undefined)
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FFFFFF' }}>
      {/* Nav */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, md: 5 },
          py: 2,
          borderBottom: `1px solid ${colors.border}`,
          bgcolor: '#FFFFFF',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
          <Box component="img" src={studentLogo} alt="Student Jobs" sx={{ width: 40, height: 38, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.2, color: colors.logoText }}>
            STUDENT <Box component="span" sx={{ color: colors.logoAccent }}>JOBS</Box>
          </Typography>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 4 }}>
          {NAV_LINKS.map((link) => (
            <Box
              key={link.href}
              component="a"
              href={link.href}
              sx={{ color: colors.text, textDecoration: 'none', fontSize: 14, fontWeight: 500, '&:hover': { color: colors.accent } }}
            >
              {link.label}
            </Box>
          ))}
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
            sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: colors.navy, px: 3, '&:hover': { bgcolor: colors.navyDeep } }}
          >
            สมัครสมาชิก
          </Button>
        </Box>
      </Box>

      {/* Hero */}
      <Box sx={{ bgcolor: colors.navy, px: { xs: 3, md: 8 }, pt: { xs: 6, md: 9 }, pb: { xs: 12, md: 16 }, textAlign: 'center' }}>
        <Typography
          sx={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: { xs: 32, md: 48 },
            color: '#FFFFFF',
            lineHeight: 1.25,
            maxWidth: 760,
            mx: 'auto',
          }}
        >
          แพลตฟอร์มพาร์ทไทม์สำหรับ
          <br />
          <Box component="span" sx={{ color: colors.accent }}>นักศึกษา</Box> โดยเฉพาะ
        </Typography>

        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, mt: 3, maxWidth: 640, mx: 'auto', lineHeight: 1.8 }}>
          เชื่อมโยงนักศึกษาที่ต้องการหารายได้พิเศษ กับสถานประกอบการในพื้นที่ และใกล้เคียง สะดวก ปลอดภัย
          และมีมหาวิทยาลัยเป็นสื่อกลางดูแล
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={() => navigate('/jobs')}
            sx={{ bgcolor: colors.accent, borderRadius: '40px', textTransform: 'none', px: 3.5, py: 1.3, fontWeight: 600, '&:hover': { bgcolor: '#0070D6' } }}
          >
            เริ่มต้นหางานเลย
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/register/employer')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3.5, py: 1.3, fontWeight: 600, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
          >
            สำหรับผู้ประกอบการ
          </Button>
        </Box>

        <Box
          sx={{
            position: 'relative',
            maxWidth: 940,
            mx: 'auto',
            mt: { xs: 5, md: 7 },
            bgcolor: '#FFFFFF',
            borderRadius: '20px',
            boxShadow: '0px 12px 40px rgba(0,3,73,0.25)',
            p: 1.5,
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <TextField
            placeholder="ค้นหาตำแหน่งงาน..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            size="small"
            sx={{ flex: 2, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField
            placeholder="สถานที่ (เช่น ประตู 1, ประตู 2)"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            fullWidth
            size="small"
            sx={{ flex: 1, minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><PlaceOutlinedIcon fontSize="small" /></InputAdornment> } }}
          />
          <Button
            variant="contained"
            onClick={goToJobs}
            sx={{ borderRadius: '14px', textTransform: 'none', bgcolor: colors.navy, px: 3.5, flexShrink: 0, '&:hover': { bgcolor: colors.navyDeep } }}
          >
            ค้นหางาน
          </Button>
        </Box>
      </Box>

      {/* Stats strip */}
      <Box id="stats" sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: { xs: 3, md: 4 },
            textAlign: 'center',
          }}
        >
          {STATS.map((stat) => (
            <Box key={stat.label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: '#EAF2FF',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <stat.icon sx={{ color: colors.accent, fontSize: 28 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 24, color: colors.navy }}>{stat.value}</Typography>
              <Typography sx={{ fontSize: 13, color: colors.subtext }}>{stat.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Features */}
      <Box id="features" sx={{ bgcolor: '#F7F9FC', py: { xs: 6, md: 9 } }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: { xs: 26, md: 32 }, color: colors.navy, textAlign: 'center', mb: 1 }}>
            ฟีเจอร์เด่นของเรา
          </Typography>
          <Typography sx={{ fontSize: 14, color: colors.subtext, textAlign: 'center', mb: 5, maxWidth: 560, mx: 'auto' }}>
            ครบทุกขั้นตอนของการหางานพาร์ทไทม์ ตั้งแต่ค้นหางานจนถึงรับค่าตอบแทน ในระบบเดียว
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            {FEATURES.map((feature) => (
              <Box
                key={feature.title}
                sx={{
                  bgcolor: '#FFFFFF',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 3,
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: '#EAF2FF', display: 'grid', placeItems: 'center' }}>
                  <feature.icon sx={{ color: colors.accent, fontSize: 24 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{feature.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: colors.subtext, lineHeight: 1.7 }}>{feature.description}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* How it works */}
      <Box id="how-it-works" sx={{ py: { xs: 6, md: 9 } }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: { xs: 26, md: 32 }, color: colors.navy, textAlign: 'center', mb: 1 }}>
            วิธีใช้งาน
          </Typography>
          <Typography sx={{ fontSize: 14, color: colors.subtext, textAlign: 'center', mb: 5, maxWidth: 560, mx: 'auto' }}>
            เริ่มต้นหารายได้พิเศษได้ง่าย ๆ ใน 4 ขั้นตอน
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3 }}>
            {STEPS.map((step, index) => (
              <Box key={step.title} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: colors.navy,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 16,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>{step.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: colors.subtext, lineHeight: 1.7 }}>{step.description}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* CTA banner */}
      <Box sx={{ bgcolor: colors.navy, py: { xs: 6, md: 8 }, textAlign: 'center', px: 2 }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: { xs: 22, md: 28 }, color: '#fff', mb: 1.5 }}>
          พร้อมเริ่มต้นหางานพาร์ทไทม์แล้วหรือยัง?
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, mb: 3 }}>
          สมัครสมาชิกฟรีวันนี้ แล้วเริ่มค้นหางานที่ใช่สำหรับคุณ
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/register')}
          sx={{ bgcolor: colors.accent, borderRadius: '40px', textTransform: 'none', px: 4, py: 1.3, fontWeight: 600, '&:hover': { bgcolor: '#0070D6' } }}
        >
          สมัครสมาชิกฟรี
        </Button>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: '#F7F9FC', borderTop: `1px solid ${colors.border}`, pt: 6, pb: 4 }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '1.4fr 1fr 1fr' }, gap: 4, mb: 4 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box component="img" src={studentLogo} alt="Student Jobs" sx={{ width: 36, height: 34 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: colors.logoText }}>
                  STUDENT <Box component="span" sx={{ color: colors.logoAccent }}>JOBS</Box>
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 13, color: colors.subtext, maxWidth: 320, lineHeight: 1.8 }}>
                แพลตฟอร์มหางานพาร์ทไทม์สำหรับนักศึกษาโดยเฉพาะ เชื่อมโยงนักศึกษาและสถานประกอบการ
                ผ่านการดูแลของมหาวิทยาลัย
              </Typography>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1.5 }}>ลิงก์ด่วน</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box component={RouterLink} to="/jobs" sx={{ fontSize: 13, color: colors.subtext, textDecoration: 'none', '&:hover': { color: colors.accent } }}>ค้นหางาน</Box>
                <Box component={RouterLink} to="/login" sx={{ fontSize: 13, color: colors.subtext, textDecoration: 'none', '&:hover': { color: colors.accent } }}>เข้าสู่ระบบ</Box>
                <Box component={RouterLink} to="/register/student" sx={{ fontSize: 13, color: colors.subtext, textDecoration: 'none', '&:hover': { color: colors.accent } }}>สมัครสมาชิกนักศึกษา</Box>
              </Box>
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1.5 }}>สำหรับผู้ประกอบการ</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box component={RouterLink} to="/register/employer" sx={{ fontSize: 13, color: colors.subtext, textDecoration: 'none', '&:hover': { color: colors.accent } }}>สมัครเป็นผู้ประกอบการ</Box>
                <Box component={RouterLink} to="/login" sx={{ fontSize: 13, color: colors.subtext, textDecoration: 'none', '&:hover': { color: colors.accent } }}>เข้าสู่ระบบผู้ประกอบการ</Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12.5, color: colors.subtext }}>© 2026 Student Jobs. สงวนลิขสิทธิ์ทุกประการ</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
