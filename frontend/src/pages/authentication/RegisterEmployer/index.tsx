import { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../services/https'
import { ErrorAlert } from '../../../components/ErrorAlert'
import { useAuth } from '../../../auth/useAuth'
import { upsertMyEmployerProfile } from '../../../services/https/employer'
import { UploadCard } from '../../../components/UploadCard'

const colors = { navy: '#000349', bg: '#DAEAF7' }

const BUSINESS_TYPES = ['ร้านอาหาร', 'คาเฟ่', 'ค้าปลีก', 'บริการ', 'อื่น ๆ']

type FormState = {
  userName: string
  email: string
  password: string
  confirmPassword: string
  companyName: string
  businessType: string
  taxId: string
  website: string
  address: string
  contactFirstName: string
  contactLastName: string
  phone: string
  contactEmail: string
  position: string
  lineId: string
  companyRegis: string
  logo: string
  cardId: string
  profilePicture: string
}

const INITIAL: FormState = {
  userName: '',
  email: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  businessType: '',
  taxId: '',
  website: '',
  address: '',
  contactFirstName: '',
  contactLastName: '',
  phone: '',
  contactEmail: '',
  position: '',
  lineId: '',
  companyRegis: '',
  logo: '',
  cardId: '',
  profilePicture: '',
}

const PAGE_SUBTITLE: Record<number, string> = {
  1: 'กรุณากรอกข้อมูลให้ครบถ้วน',
  2: 'กรุณากรอกข้อมูลให้ครบถ้วน',
  3: 'กรุณากรอกอัปโหลดเอกสารยืนยันตัวตนของบริษัท',
  4: 'ตรวจสอบข้อมูลให้ถูกต้องก่อนส่งคำขอ',
}



function ReviewRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography sx={{ fontSize: 14, color: '#697077' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, color: colors.navy, fontWeight: 600, textAlign: 'right' }}>{value || '-'}</Typography>
    </Box>
  )
}

export default function RegisterEmployerPage() {
  const navigate = useNavigate()
  const { register, refreshProfile } = useAuth()

  const [page, setPage] = useState(1)
  const [form, setForm] = useState(INITIAL)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const page1Valid =
    form.userName.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    /[a-zA-Z]/.test(form.password) &&
    /[0-9]/.test(form.password) &&
    form.password === form.confirmPassword &&
    form.companyName.trim().length > 0 &&
    form.taxId.trim().length > 0 &&
    form.address.trim().length > 0

  const page2Valid =
    form.contactFirstName.trim().length > 0 &&
    form.contactLastName.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.contactEmail.trim().length > 0

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      // Registration creates the base account; company/contact fields go to the
      // employer-profile endpoint right after, using the token register() just
      // issued (reading it from context here would be stale until the next render).
      const token = await register({
        user_name: form.userName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: 'employer',
      })
      await upsertMyEmployerProfile(token, {
        first_name: form.contactFirstName.trim(),
        last_name: form.contactLastName.trim(),
        position: form.position.trim() || undefined,
        line_id: form.lineId.trim() || undefined,
        company_name: form.companyName.trim(),
        business_type: form.businessType || undefined,
        tax_id: form.taxId.trim(),
        link: form.website.trim() || undefined,
        company_address: form.address.trim() || undefined,
        company_regis: form.companyRegis || undefined,
        logo: form.logo || undefined,
        card_id: form.cardId || undefined,
        profile_picture: form.profilePicture || undefined,
      })
      await refreshProfile()
      navigate('/profile', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('สมัครสมาชิกไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: colors.bg, p: { xs: 3, md: 6 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton
          onClick={() => (page === 1 ? navigate('/register') : setPage((p) => p - 1))}
          sx={{ bgcolor: colors.navy, color: '#fff', '&:hover': { bgcolor: '#000226' } }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>
          สมัครสมาชิกผู้ประกอบการ
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 15, color: '#52545C', ml: { md: 7 }, mb: 4 }}>{PAGE_SUBTITLE[page]}</Typography>

      <ErrorAlert message={error} />

      {page === 1 && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, maxWidth: 1000, mx: 'auto' }}>
          <Box sx={{ bgcolor: '#FFFFFF', borderRadius: 4, p: 4, flex: 1, boxShadow: '0px 8px 40px rgba(0,3,73,0.06)' }}>
            <StepHeading step={1} title="ข้อมูลสำหรับการเข้าสู่ระบบ" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField label="ชื่อผู้ใช้" placeholder="กรุณากรอกชื่อผู้ใช้" value={form.userName} onChange={(e) => set('userName', e.target.value)} required fullWidth />
              <TextField label="อีเมล" type="email" placeholder="กรุณากรอกอีเมล" value={form.email} onChange={(e) => set('email', e.target.value)} required fullWidth />
              <TextField
                label="รหัสผ่าน"
                type="password"
                placeholder="กรุณากรอกรหัสผ่าน"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                helperText="อย่างน้อย 8 ตัวอักษร ประกอบด้วยอักษรและตัวเลข"
                required
                fullWidth
              />
              <TextField
                label="ยืนยันรหัสผ่าน"
                type="password"
                placeholder="กรุณากรอกรหัสผ่าน"
                value={form.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
                error={form.confirmPassword.length > 0 && form.confirmPassword !== form.password}
                helperText={form.confirmPassword.length > 0 && form.confirmPassword !== form.password ? 'รหัสผ่านไม่ตรงกัน' : 'กรุณายืนยันรหัสผ่านอีกครั้ง'}
                required
                fullWidth
              />
            </Box>
          </Box>

          <Box sx={{ bgcolor: '#FFFFFF', borderRadius: 4, p: 4, flex: 1, boxShadow: '0px 8px 40px rgba(0,3,73,0.06)' }}>
            <StepHeading step={2} title="ข้อมูลบริษัท" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField label="ชื่อบริษัท / ร้านค้า" placeholder="กรอกชื่อบริษัท / ร้านค้า" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} required fullWidth />
              <TextField select label="ประเภทธุรกิจ" value={form.businessType} onChange={(e) => set('businessType', e.target.value)} fullWidth>
                {BUSINESS_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
              <TextField label="เลขประจำตัวผู้เสียภาษี" placeholder="กรอกเลขประจำตัวผู้เสียภาษี" value={form.taxId} onChange={(e) => set('taxId', e.target.value)} required fullWidth />
              <TextField label="เว็บไซต์ (ถ้ามี)" placeholder="กรอกเว็บไซต์" value={form.website} onChange={(e) => set('website', e.target.value)} fullWidth />
              <TextField label="ที่อยู่สถานประกอบการ" placeholder="กรอกที่อยู่" value={form.address} onChange={(e) => set('address', e.target.value)} required fullWidth multiline minRows={2} />
            </Box>
          </Box>
        </Box>
      )}

      {page === 2 && (
        <Box sx={{ bgcolor: '#FFFFFF', borderRadius: 4, p: { xs: 3, md: 5 }, maxWidth: 500, mx: 'auto', boxShadow: '0px 8px 40px rgba(0,3,73,0.06)' }}>
          <StepHeading step={3} title="ข้อมูลการติดต่อ" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField label="ชื่อผู้ติดต่อ" placeholder="กรอกชื่อผู้ติดต่อ" value={form.contactFirstName} onChange={(e) => set('contactFirstName', e.target.value)} required fullWidth />
            <TextField label="นามสกุล" placeholder="กรอกนามสกุล" value={form.contactLastName} onChange={(e) => set('contactLastName', e.target.value)} required fullWidth />
            <TextField label="เบอร์โทรศัพท์" placeholder="xxxxxxxxxx" value={form.phone} onChange={(e) => set('phone', e.target.value)} required fullWidth />
            <TextField label="อีเมล" type="email" placeholder="กรอกอีเมล" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} required fullWidth />
            <TextField label="ตำแหน่งงาน" placeholder="เช่น เจ้าของกิจการ, HR, ผู้จัดการ" value={form.position} onChange={(e) => set('position', e.target.value)} fullWidth />
            <TextField label="Line ID (ถ้ามี)" placeholder="@lineid" value={form.lineId} onChange={(e) => set('lineId', e.target.value)} fullWidth />
          </Box>
        </Box>
      )}

      {page === 3 && (
        <Box sx={{ bgcolor: '#FFFFFF', borderRadius: 4, p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto', boxShadow: '0px 8px 40px rgba(0,3,73,0.06)' }}>
          <StepHeading step={4} title="เอกสารยืนยันและข้อมูลเพิ่มเติม" />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            <UploadCard label="หนังสือรับรองการจดทะเบียนบริษัท / ร้านค้า" value={form.companyRegis} onUpload={(url) => set('companyRegis', url)} />
            <UploadCard label="โลโก้บริษัท / ร้านค้า (ถ้ามี)" value={form.logo} onUpload={(url) => set('logo', url)} />
            <UploadCard label="บัตรประชาชนของผู้มีอำนาจลงนาม" value={form.cardId} onUpload={(url) => set('cardId', url)} />
            <UploadCard label="รูปโปรไฟล์" camera value={form.profilePicture} onUpload={(url) => set('profilePicture', url)} />
          </Box>
        </Box>
      )}

      {page === 4 && (
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          <Box sx={{ bgcolor: '#FFFFFF', borderRadius: 4, p: { xs: 3, md: 5 }, boxShadow: '0px 8px 40px rgba(0,3,73,0.06)' }}>
            <StepHeading step={5} title="สรุปข้อมูลของคุณ" />

            <Box sx={{ border: '1px solid #E8E8E8', borderRadius: 3, p: 2.5, mb: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>ข้อมูลบริษัท</Typography>
                <Typography onClick={() => setPage(1)} sx={{ fontSize: 13, color: '#045BE4', fontWeight: 600, cursor: 'pointer' }}>แก้ไข</Typography>
              </Box>
              <ReviewRow label="ชื่อบริษัท / ร้านค้า" value={form.companyName} />
              <ReviewRow label="ประเภทธุรกิจ" value={form.businessType} />
              <ReviewRow label="เลขประจำตัวผู้เสียภาษี" value={form.taxId} />
              <ReviewRow label="ที่อยู่" value={form.address} />
            </Box>

            <Box sx={{ border: '1px solid #E8E8E8', borderRadius: 3, p: 2.5, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>ข้อมูลการติดต่อ</Typography>
                <Typography onClick={() => setPage(2)} sx={{ fontSize: 13, color: '#045BE4', fontWeight: 600, cursor: 'pointer' }}>แก้ไข</Typography>
              </Box>
              <ReviewRow label="ชื่อผู้ติดต่อ" value={`${form.contactFirstName} ${form.contactLastName}`.trim()} />
              <ReviewRow label="เบอร์โทรศัพท์" value={form.phone} />
              <ReviewRow label="อีเมล" value={form.contactEmail} />
              <ReviewRow label="ตำแหน่งงาน" value={form.position} />
            </Box>

            <FormControlLabel
              control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
              label={
                <Typography sx={{ fontSize: 13, color: '#52545C' }}>
                  ฉันได้อ่านและยอมรับ <Box component="span" sx={{ color: '#045BE4', fontWeight: 600 }}>ข้อกำหนดการใช้งาน</Box> และ{' '}
                  <Box component="span" sx={{ color: '#045BE4', fontWeight: 600 }}>นโยบายความเป็นส่วนตัว</Box>
                </Typography>
              }
            />

            <Button
              fullWidth
              variant="contained"
              disabled={!agreed || submitting}
              onClick={() => void handleSubmit()}
              sx={{ mt: 2, height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              {submitting ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
            </Button>
          </Box>
        </Box>
      )}

      {page !== 4 && (
        <Box sx={{ display: 'flex', justifyContent: page === 1 ? 'flex-end' : 'space-between', maxWidth: page === 1 ? 1000 : page === 2 ? 500 : 900, mx: 'auto', mt: 3 }}>
          {page > 1 && (
            <Button
              onClick={() => setPage((p) => p - 1)}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 4, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
            >
              ย้อนกลับ
            </Button>
          )}
          <Button
            onClick={() => setPage((p) => p + 1)}
            disabled={(page === 1 && !page1Valid) || (page === 2 && !page2Valid)}
            variant="contained"
            sx={{ borderRadius: '40px', textTransform: 'none', px: 4, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            ถัดไป
          </Button>
        </Box>
      )}

      {page === 4 && (
        <Box sx={{ maxWidth: 700, mx: 'auto', mt: 2 }}>
          <Button
            onClick={() => setPage((p) => p - 1)}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 4, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
          >
            ย้อนกลับ
          </Button>
        </Box>
      )}
    </Box>
  )
}

function StepHeading({ step, title }: Readonly<{ step: number; title: string }>) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: colors.navy,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {step}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{title}</Typography>
    </Box>
  )
}
