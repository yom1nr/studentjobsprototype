import { useState, useRef, type SyntheticEvent } from 'react'
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
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../services/https'
import { ErrorAlert } from '../../../components/ErrorAlert'
import { useAuth } from '../../../auth/useAuth'
import { upsertMyStudentProfile } from '../../../services/https/student'
import { UploadCard } from '../../../components/UploadCard'

const colors = { navy: '#000349', bg: '#DAEAF7' }

type FormState = {
  studentId: string
  userName: string
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  gender: string
  dob: string
  address: string
  university: string
  faculty: string
  major: string
  year: string
  phone: string
  skills: string
  profilePicture: string
  schedule: string
  transcript: string
  resume: string
}

const INITIAL: FormState = {
  studentId: '',
  userName: '',
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
  gender: '',
  dob: '',
  address: '',
  university: '',
  faculty: '',
  major: '',
  year: '',
  phone: '',
  skills: '',
  profilePicture: '',
  schedule: '',
  transcript: '',
  resume: '',
}



export default function RegisterStudentPage() {
  const navigate = useNavigate()
  const { register, refreshProfile } = useAuth()
  const dobRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const maxDate = new Date().toISOString().split('T')[0]

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const step1Valid =
    form.studentId.trim().length > 0 &&
    form.userName.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    /[a-zA-Z]/.test(form.password) &&
    /[0-9]/.test(form.password) &&
    form.password === form.confirmPassword

  const step2Valid =
    form.firstName.trim().length > 0 && form.lastName.trim().length > 0 && form.gender !== ''

  async function onSubmit(e: SyntheticEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // register() returns the fresh token directly since reading it back from
      // useAuth() here would be stale until the next render.
      const token = await register({
        user_name: form.userName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        gender: form.gender || undefined,
        role: 'student',
      })
      // Skills/resume/schedule/grade uploads stay UI-only — no file storage backend
      // exists anywhere in this app yet — but the rest of the profile is now real.
      await upsertMyStudentProfile(token, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        date_of_birth: form.dob || undefined,
        address: form.address.trim() || undefined,
        university: form.university.trim() || undefined,
        faculty: form.faculty.trim() || undefined,
        major: form.major.trim() || undefined,
        years: form.year.trim() || undefined,
        skill: form.skills.trim() || undefined,
        profile_picture: form.profilePicture || undefined,
        schedule: form.schedule || undefined,
        transcript: form.transcript || undefined,
        resume: form.resume || undefined,
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
          onClick={() => (step === 1 ? navigate('/register') : setStep((s) => s - 1))}
          sx={{ bgcolor: colors.navy, color: '#fff', '&:hover': { bgcolor: '#000226' } }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>
          สมัครสมาชิกนักศึกษา
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 15, color: '#52545C', ml: { md: 7 }, mb: 4 }}>กรุณากรอกข้อมูลให้ครบถ้วน</Typography>

      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{ bgcolor: '#FFFFFF', borderRadius: 4, p: { xs: 3, md: 5 }, maxWidth: 900, mx: 'auto', boxShadow: '0px 8px 40px rgba(0,3,73,0.06)' }}
      >
        <ErrorAlert message={error} />

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
            }}
          >
            {step}
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>
            {step === 1 && 'ข้อมูลสำหรับการเข้าสู่ระบบ'}
            {step === 2 && 'ข้อมูลส่วนตัว'}
            {step === 3 && 'ข้อมูลเพิ่มเติม'}
          </Typography>
        </Box>

        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 480, mx: 'auto' }}>
            <TextField
              label="รหัสนักศึกษา"
              value={form.studentId}
              onChange={(e) => set('studentId', e.target.value)}
              placeholder="กรุณากรอกรหัสนักศึกษา"
              fullWidth
              required
              slotProps={{ input: { startAdornment: <PersonOutlineOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
            />
            <TextField
              label="ชื่อผู้ใช้"
              value={form.userName}
              onChange={(e) => set('userName', e.target.value)}
              placeholder="กรุณากรอกชื่อผู้ใช้"
              fullWidth
              required
              slotProps={{ input: { startAdornment: <EmailOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
            />
            <TextField
              label="อีเมล"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="กรุณากรอกอีเมล"
              fullWidth
              required
              slotProps={{ input: { startAdornment: <EmailOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
            />
            <TextField
              label="รหัสผ่าน"
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="กรุณากรอกรหัสผ่าน"
              helperText="อย่างน้อย 8 ตัวอักษร ประกอบด้วยอักษรและตัวเลข"
              fullWidth
              required
              slotProps={{ input: { startAdornment: <LockOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
            />
            <TextField
              label="ยืนยันรหัสผ่าน"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => set('confirmPassword', e.target.value)}
              placeholder="กรุณายืนยันรหัสผ่านอีกครั้ง"
              error={form.confirmPassword.length > 0 && form.confirmPassword !== form.password}
              helperText={form.confirmPassword.length > 0 && form.confirmPassword !== form.password ? 'รหัสผ่านไม่ตรงกัน' : ' '}
              fullWidth
              required
              slotProps={{ input: { startAdornment: <LockOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
            />
          </Box>
        )}

        {step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
              <TextField label="ชื่อ" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="ชื่อของคุณ" required fullWidth />
              <TextField label="นามสกุล" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="นามสกุลของคุณ" required fullWidth />
              <TextField select label="เพศ" value={form.gender} onChange={(e) => set('gender', e.target.value)} required fullWidth>
                <MenuItem value="male">ชาย</MenuItem>
                <MenuItem value="female">หญิง</MenuItem>
                <MenuItem value="other">อื่น ๆ</MenuItem>
              </TextField>
              <Box sx={{ position: 'relative', width: '100%' }} onClick={() => dobRef.current?.showPicker()}>
                <TextField 
                  label="อายุ" 
                  value={form.dob ? (() => {
                    const today = new Date()
                    const birthDate = new Date(form.dob)
                    let age = today.getFullYear() - birthDate.getFullYear()
                    const m = today.getMonth() - birthDate.getMonth()
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                      age--
                    }
                    return Math.max(0, age).toString()
                  })() : ''}
                  placeholder="เลือกวันเกิด"
                  fullWidth
                  slotProps={{
                    input: {
                      readOnly: true,
                      endAdornment: <CalendarMonthOutlinedIcon sx={{ color: colors.navy }} />,
                    }
                  }}
                />
                <input 
                  ref={dobRef}
                  type="date" 
                  value={form.dob}
                  max={maxDate}
                  onChange={(e) => set('dob', e.target.value)}
                  style={{ 
                    position: 'absolute', 
                    top: 0, left: 0, width: '100%', height: '100%', 
                    opacity: 0, cursor: 'pointer' 
                  }} 
                />
              </Box>
              <TextField
                label="ที่อยู่"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="กรอกที่อยู่"
                fullWidth
                slotProps={{ input: { startAdornment: <HomeOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1 }}>
              <TextField
                label="มหาวิทยาลัย"
                value={form.university}
                onChange={(e) => set('university', e.target.value)}
                placeholder="กรอกมหาวิทยาลัย"
                fullWidth
                slotProps={{ input: { startAdornment: <SchoolOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
              />
              <TextField
                label="คณะ"
                value={form.faculty}
                onChange={(e) => set('faculty', e.target.value)}
                placeholder="กรอกคณะ"
                fullWidth
                slotProps={{ input: { startAdornment: <SchoolOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
              />
              <TextField
                label="สาขาวิชา"
                value={form.major}
                onChange={(e) => set('major', e.target.value)}
                placeholder="กรอกสาขาวิชา"
                fullWidth
                slotProps={{ input: { startAdornment: <MenuBookOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
              />
              <TextField
                label="ชั้นปีที่ศึกษา"
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
                placeholder="ปี 2"
                fullWidth
                slotProps={{ input: { startAdornment: <CalendarMonthOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
              />
              <TextField
                label="เบอร์โทรศัพท์ติดต่อ"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="0xxxxxxxxx"
                fullWidth
                slotProps={{ input: { startAdornment: <PhoneOutlinedIcon sx={{ mr: 1, color: colors.navy }} fontSize="small" /> } }}
              />
            </Box>
          </Box>
        )}

        {step === 3 && (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.75 }}>ทักษะความสามารถ</Typography>
                <TextField
                  value={form.skills}
                  onChange={(e) => set('skills', e.target.value)}
                  placeholder="พิมพ์ทักษะความสามารถ"
                  multiline
                  minRows={6}
                  fullWidth
                  slotProps={{ input: { startAdornment: undefined } }}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <UploadCard label="รูปโปรไฟล์" camera value={form.profilePicture} onUpload={(url) => set('profilePicture', url)} />
                <UploadCard label="อัปโหลด ตารางเรียน" value={form.schedule} onUpload={(url) => set('schedule', url)} />
              </Box>
              <UploadCard label="อัปโหลด เรซูเม่" value={form.resume} onUpload={(url) => set('resume', url)} />
              <UploadCard label="อัปโหลด เกรด" value={form.transcript} onUpload={(url) => set('transcript', url)} />
            </Box>

            <FormControlLabel
              sx={{ mt: 3 }}
              control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
              label={
                <Typography sx={{ fontSize: 13, color: '#52545C' }}>
                  ฉันได้อ่านและยอมรับ <Box component="span" sx={{ color: '#045BE4', fontWeight: 600 }}>ข้อกำหนดการใช้งาน</Box> และ{' '}
                  <Box component="span" sx={{ color: '#045BE4', fontWeight: 600 }}>นโยบายความเป็นส่วนตัว</Box>
                </Typography>
              }
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: step === 1 ? 'flex-end' : 'space-between', mt: 4 }}>
          {step > 1 && (
            <Button
              onClick={() => setStep((s) => s - 1)}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 4, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
            >
              ย้อนกลับ
            </Button>
          )}

          {step < 3 && (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              variant="contained"
              sx={{ borderRadius: '40px', textTransform: 'none', px: 4, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              ถัดไป
            </Button>
          )}

          {step === 3 && (
            <Button
              type="submit"
              variant="contained"
              disabled={!agreed || submitting}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 4, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              {submitting ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}
