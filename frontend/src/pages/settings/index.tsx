import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Dialog, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import UploadOutlinedIcon from '@mui/icons-material/UploadOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PersonIcon from '@mui/icons-material/Person'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError, getApiBaseUrl } from '../../services/https'
import { uploadFile } from '../../services/https/upload'
import { getMyEmployerProfile, upsertMyEmployerProfile } from '../../services/https/employer'
import type { EmployerProfile as EmployerProfileApi } from '../../interface/IEmployerInterface'
import { extractScheduleFromImage, getMyStudentProfile, upsertMyStudentProfile } from '../../services/https/student'
import type { StudentProfile as StudentProfileApi } from '../../interface/IStudentInterface'

const colors = { navy: '#012150', border: '#D9D9D9', field: '#F0F0F0' }

// Extended student-profile fields (address, university, etc.) are mocked locally —
// the backend User model only exposes user_name/email/phone/gender today.
type Profile = {
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  age: string
  availableTime: string
  address: string
  university: string
  faculty: string
  major: string
  year: string
  phone: string
  skills: string
}

const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  age: '',
  availableTime: '',
  address: '',
  university: '',
  faculty: '',
  major: '',
  year: '',
  phone: '',
  skills: '',
}

const fieldRows: { key: keyof Profile; label: string }[] = [
  { key: 'firstName', label: 'ชื่อ' },
  { key: 'lastName', label: 'นามสกุล' },
  { key: 'gender', label: 'เพศ' },
  { key: 'dateOfBirth', label: 'วันเกิด' },
  { key: 'address', label: 'ที่อยู่' },
  { key: 'university', label: 'มหาวิทยาลัย' },
  { key: 'faculty', label: 'คณะ' },
  { key: 'major', label: 'สาขาวิชา' },
  { key: 'year', label: 'ชั้นปีที่ศึกษา' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
  { key: 'availableTime', label: 'เวลาว่าง (สำหรับค้นหางาน)' },
  { key: 'skills', label: 'ทักษะความสามารถ' },
]

type Document = { id: number; name: string; uploadedAt: string }

const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

const INITIAL_DOCUMENTS: Document[] = [
  { id: 1, name: 'Profile.jpg', uploadedAt: '20 พ.ค. 2569' },
  { id: 2, name: 'TimeTable.jpg', uploadedAt: '20 พ.ค. 2569' },
  { id: 3, name: 'Transcript.pdf', uploadedAt: '20 พ.ค. 2569' },
  { id: 4, name: 'Resume.pdf', uploadedAt: '20 พ.ค. 2569' },
]

// Employer profile fields — mocked locally, mirroring the backend Employer model
// (company_name/business_type/tax_id/link/company_address, first_name/last_name/position/line_id)
// which has no update/read API wired up yet.
type EmployerProfile = {
  companyName: string
  businessType: string
  taxId: string
  website: string
  companyAddress: string
  contactFirstName: string
  contactLastName: string
  contactEmail: string
  position: string
  phone: string
  lineId: string
}

const EMPTY_EMPLOYER_PROFILE: EmployerProfile = {
  companyName: '',
  businessType: '',
  taxId: '',
  website: '',
  companyAddress: '',
  contactFirstName: '',
  contactLastName: '',
  contactEmail: '',
  position: '',
  phone: '',
  lineId: '',
}

const companyFieldRows: { key: keyof EmployerProfile; label: string }[] = [
  { key: 'companyName', label: 'ชื่อบริษัท / ร้านค้า' },
  { key: 'businessType', label: 'ประเภทธุรกิจ' },
  { key: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี' },
  { key: 'website', label: 'เว็บไซต์ (ถ้ามี)' },
  { key: 'companyAddress', label: 'ที่อยู่สถานประกอบการ' },
]

// Order matches the design's row pairing under the 2-col auto-flow grid:
// (ชื่อผู้ติดต่อ, อีเมล) / (นามสกุล, ตำแหน่งงาน) / (เบอร์โทรศัพท์, Line ID)
const contactFieldRows: { key: keyof EmployerProfile; label: string }[] = [
  { key: 'contactFirstName', label: 'ชื่อผู้ติดต่อ' },
  { key: 'contactEmail', label: 'อีเมล' },
  { key: 'contactLastName', label: 'นามสกุล' },
  { key: 'position', label: 'ตำแหน่งงาน' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
  { key: 'lineId', label: 'Line ID (ถ้ามี)' },
]

const BUSINESS_TYPES = ['ร้านอาหาร', 'คาเฟ่', 'ค้าปลีก', 'บริการ', 'อื่น ๆ']

const EMPLOYER_TABS = [
  { key: 'company', label: 'ข้อมูลบริษัท' },
  { key: 'contact', label: 'ข้อมูลการติดต่อ' },
  { key: 'documents', label: 'เอกสารบริษัท' },
  { key: 'account', label: 'บัญชี' },
] as const

type EmployerTabKey = (typeof EMPLOYER_TABS)[number]['key']

type CompanyDocument = { key: 'registration' | 'signatoryId' | 'logo'; label: string; hint: string; url: string }

const INITIAL_COMPANY_DOCUMENTS: CompanyDocument[] = [
  { key: 'registration', label: 'หนังสือรับรองการจดทะเบียนบริษัท / ร้านค้า', hint: 'รองรับไฟล์ PDF, JPG, PNG (ขนาดไม่เกิน 5MB)', url: '' },
  { key: 'signatoryId', label: 'บัตรประชาชนของผู้มีอำนาจลงนาม', hint: 'รองรับไฟล์ PDF, JPG, PNG (ขนาดไม่เกิน 5MB)', url: '' },
  { key: 'logo', label: 'โลโก้บริษัท / ร้านค้า (ถ้ามี)', hint: 'รองรับไฟล์ PDF, JPG, PNG (ขนาดไม่เกิน 5MB)', url: '' },
]

function UploadRow({
  document,
  token,
  onUpload,
}: Readonly<{ document: CompanyDocument; token: string; onUpload: (key: CompanyDocument['key'], url: string) => void }>) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setErr(null)
    try {
      const url = await uploadFile(token, file)
      onUpload(document.key, url)
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : 'อัปโหลดล้มเหลว')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, border: `1.5px solid ${colors.border}`, borderRadius: 3, p: 2 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${colors.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <InsertDriveFileOutlinedIcon sx={{ color: colors.navy, fontSize: 20 }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>{document.label}</Typography>
        {err ? (
          <Typography sx={{ fontSize: 12, color: '#DA1E28' }}>{err}</Typography>
        ) : document.url ? (
          <Typography
            component="a"
            href={`${getApiBaseUrl()}${document.url}`}
            target="_blank"
            rel="noopener"
            sx={{ fontSize: 12, color: '#0088FF' }}
          >
            อัปโหลดแล้ว — เปิดดู
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{document.hint}</Typography>
        )}
      </Box>
      <IconButton component="label" disabled={busy} sx={{ color: colors.navy }}>
        <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => void pick(e)} />
        {busy ? <CircularProgress size={20} /> : <UploadOutlinedIcon />}
      </IconButton>
    </Box>
  )
}

const APPROVE_STATUS_LABEL: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'info' }> = {
  pending: { label: 'รอการอนุมัติ', color: 'warning' },
  request_document: { label: 'ขอเอกสารเพิ่มเติม', color: 'info' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  rejected: { label: 'ไม่อนุมัติ', color: 'error' },
}

function apiToLocalProfile(api: EmployerProfileApi | null, account: { email: string; phone: string }): EmployerProfile {
  return {
    companyName: api?.company_name ?? '',
    businessType: api?.business_type ?? '',
    taxId: api?.tax_id ?? '',
    website: api?.link ?? '',
    companyAddress: api?.company_address ?? '',
    contactFirstName: api?.first_name ?? '',
    contactLastName: api?.last_name ?? '',
    contactEmail: account.email,
    position: api?.position ?? '',
    phone: account.phone,
    lineId: api?.line_id ?? '',
  }
}

// Shared "change password" button + dialog — used by both the employer and the
// student settings views. Talks to PUT /users/profile via useAuth().updateProfile.
function ChangePasswordCard({ onChanged }: Readonly<{ onChanged?: () => void }>) {
  const { updateProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setError(null)
  }

  async function submit() {
    setError(null)
    if (currentPassword.length === 0) {
      setError('กรุณากรอกรหัสผ่านปัจจุบัน')
      return
    }
    if (newPassword.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }
    setSaving(true)
    try {
      await updateProfile({ current_password: currentPassword, password: newPassword })
      setOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onChanged?.()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('เปลี่ยนรหัสผ่านไม่สำเร็จ')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        endIcon={<ChevronRightIcon />}
        sx={{
          justifyContent: 'space-between',
          bgcolor: colors.field,
          color: colors.navy,
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 2,
          px: 2,
          py: 1.25,
          '&:hover': { bgcolor: '#E4E4E4' },
        }}
      >
        เปลี่ยนรหัสผ่าน
      </Button>

      <Dialog open={open} onClose={close} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>เปลี่ยนแปลงรหัสผ่านของคุณ</Typography>
              <Typography sx={{ fontSize: 13, color: '#697077', mt: 0.5 }}>
                รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยอักษรและตัวเลข
              </Typography>
            </Box>
            <IconButton size="small" onClick={close}>
              <CloseOutlinedIcon />
            </IconButton>
          </Box>

          <ErrorAlert message={error} />

          <TextField
            label="รหัสผ่านปัจจุบัน"
            placeholder="กรุณากรอกรหัสผ่านปัจจุบัน"
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowCurrent((v) => !v)} edge="end">
                    {showCurrent ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />
          <TextField
            label="รหัสผ่านใหม่"
            placeholder="กรุณากรอกรหัสผ่านใหม่"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowNew((v) => !v)} edge="end">
                    {showNew ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />
          <TextField
            label="ยืนยันรหัสผ่าน"
            placeholder="กรุณากรอกรหัสผ่าน"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            sx={{ mb: 1 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowConfirm((v) => !v)} edge="end">
                    {showConfirm ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />

          <Typography
            component={RouterLink}
            to="/forgot-password"
            sx={{ fontSize: 13, color: '#045BE4', fontWeight: 600, textDecoration: 'none', display: 'inline-block', mb: 3 }}
          >
            ลืมรหัสผ่าน?
          </Typography>

          <Button
            fullWidth
            variant="contained"
            onClick={() => void submit()}
            disabled={saving}
            sx={{ height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            {saving ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
          </Button>
        </Box>
      </Dialog>
    </>
  )
}

function EmployerSettingsView() {
  usePageTitle('ข้อมูลส่วนตัวผู้ประกอบการ')
  const { user, token, updateProfile } = useAuth()

  const [profile, setProfile] = useState<EmployerProfile>(() =>
    apiToLocalProfile(null, { email: user?.email ?? '', phone: user?.phone ?? '' }),
  )
  const [approveStatus, setApproveStatus] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(EMPTY_EMPLOYER_PROFILE)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  const [activeTab, setActiveTab] = useState<EmployerTabKey>('company')
  const [documents, setDocuments] = useState(INITIAL_COMPANY_DOCUMENTS)
  const [avatarName, setAvatarName] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function loadProfile() {
      setLoadingProfile(true)
      try {
        const api = await getMyEmployerProfile(token!)
        if (cancelled) return
        setProfile(apiToLocalProfile(api, { email: user?.email ?? '', phone: user?.phone ?? '' }))
        setApproveStatus(api.approve_status)
        setDocuments((docs) =>
          docs.map((d) =>
            d.key === 'registration'
              ? { ...d, url: api.company_regis ?? '' }
              : d.key === 'signatoryId'
                ? { ...d, url: api.card_id ?? '' }
                : { ...d, url: api.logo ?? '' },
          ),
        )
      } catch (err) {
        // 404 just means the employer hasn't submitted a company profile yet — keep the empty defaults.
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดข้อมูลไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }

    void loadProfile()
    return () => {
      cancelled = true
    }
  }, [token, user?.email, user?.phone])

  function startEdit() {
    setDraft(profile)
    setError(null)
    setEditing(true)
  }

  async function saveProfile() {
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      const api = await upsertMyEmployerProfile(token, {
        first_name: draft.contactFirstName.trim(),
        last_name: draft.contactLastName.trim(),
        position: draft.position.trim() || undefined,
        line_id: draft.lineId.trim() || undefined,
        company_name: draft.companyName.trim(),
        business_type: draft.businessType.trim() || undefined,
        tax_id: draft.taxId.trim(),
        link: draft.website.trim() || undefined,
        company_address: draft.companyAddress.trim() || undefined,
        company_regis: documents.find((d) => d.key === 'registration')?.url || undefined,
        card_id: documents.find((d) => d.key === 'signatoryId')?.url || undefined,
        logo: documents.find((d) => d.key === 'logo')?.url || undefined,
      })
      if (draft.phone.trim() !== (user?.phone ?? '')) {
        await updateProfile({ phone: draft.phone.trim() || undefined })
      }
      setProfile(apiToLocalProfile(api, { email: user?.email ?? '', phone: draft.phone.trim() }))
      setApproveStatus(api.approve_status)
      setEditing(false)
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('บันทึกไม่สำเร็จ')
      }
    } finally {
      setSaving(false)
    }
  }

  function uploadDocument(key: CompanyDocument['key'], url: string) {
    setDocuments((docs) => docs.map((d) => (d.key === key ? { ...d, url } : d)))
  }

  // Saves just the verification documents against the already-saved company
  // profile (no company-tab "edit" needed). Re-submits into the review queue if
  // the account was in "request_document".
  const [savingDocs, setSavingDocs] = useState(false)
  async function saveDocuments() {
    if (!token) return
    setError(null)
    setSavingDocs(true)
    try {
      const api = await upsertMyEmployerProfile(token, {
        first_name: profile.contactFirstName,
        last_name: profile.contactLastName,
        position: profile.position || undefined,
        line_id: profile.lineId || undefined,
        company_name: profile.companyName,
        business_type: profile.businessType || undefined,
        tax_id: profile.taxId,
        link: profile.website || undefined,
        company_address: profile.companyAddress || undefined,
        company_regis: documents.find((d) => d.key === 'registration')?.url || undefined,
        card_id: documents.find((d) => d.key === 'signatoryId')?.url || undefined,
        logo: documents.find((d) => d.key === 'logo')?.url || undefined,
      })
      setApproveStatus(api.approve_status)
      setSavedNotice(true)
    } catch (err) {
      setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'บันทึกเอกสารไม่สำเร็จ')
    } finally {
      setSavingDocs(false)
    }
  }

  if (!user || loadingProfile) {
    return <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
  }

  const rows = activeTab === 'company' ? companyFieldRows : activeTab === 'contact' ? contactFieldRows : []
  const statusInfo = approveStatus ? APPROVE_STATUS_LABEL[approveStatus] : undefined

  const approvalBanner: { severity: 'warning' | 'error' | 'info'; text: string } | null =
    approveStatus === 'approved' || approveStatus === ''
      ? null
      : approveStatus === 'rejected'
        ? { severity: 'error', text: 'บัญชีผู้ประกอบการของคุณไม่ได้รับการอนุมัติ จึงยังประกาศงาน สัมภาษณ์ หรือทำสัญญาจ้างไม่ได้ กรุณาติดต่อเจ้าหน้าที่' }
        : approveStatus === 'request_document'
          ? { severity: 'info', text: 'เจ้าหน้าที่ขอเอกสารเพิ่มเติม กรุณาแนบเอกสารในแท็บ "เอกสารบริษัท" แล้วบันทึก บัญชีจะกลับเข้าคิวตรวจสอบอีกครั้ง' }
          : { severity: 'warning', text: 'บัญชีอยู่ระหว่างรอเจ้าหน้าที่อนุมัติ ระหว่างนี้ยังประกาศงานหรือใช้งานส่วนอื่นไม่ได้ — แก้ไขข้อมูล/เอกสารได้ตามปกติ' }

  return (
    <Box sx={{ maxWidth: 950, mx: 'auto' }}>
      <ErrorAlert message={error} />

      {approvalBanner && (
        <Alert severity={approvalBanner.severity} sx={{ mb: 2, borderRadius: 2 }}>
          {approvalBanner.text}
        </Alert>
      )}

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: '20px', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy }}>จัดการบัญชี</Typography>
            {statusInfo && <Chip size="small" label={statusInfo.label} color={statusInfo.color} />}
          </Box>
          {(activeTab === 'company' || activeTab === 'contact') &&
            (editing ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  startIcon={<CheckOutlinedIcon />}
                  onClick={() => void saveProfile()}
                  disabled={saving}
                  sx={{ bgcolor: '#DFF3E1', color: '#217829', textTransform: 'none', borderRadius: '20px', px: 2 }}
                >
                  บันทึก
                </Button>
                <Button
                  startIcon={<CloseOutlinedIcon />}
                  onClick={() => setEditing(false)}
                  sx={{ bgcolor: '#FCE4E4', color: '#DA1E28', textTransform: 'none', borderRadius: '20px', px: 2 }}
                >
                  ยกเลิก
                </Button>
              </Box>
            ) : (
              <Button
                startIcon={<EditOutlinedIcon />}
                onClick={startEdit}
                sx={{ bgcolor: '#F0F0F0', color: '#000', textTransform: 'none', borderRadius: '20px', px: 2 }}
              >
                แก้ไขข้อมูล
              </Button>
            ))}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
          {EMPLOYER_TABS.map((tab) => (
            <Button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setEditing(false)
              }}
              variant={activeTab === tab.key ? 'contained' : 'outlined'}
              sx={{
                borderRadius: '20px',
                textTransform: 'none',
                px: 2.5,
                bgcolor: activeTab === tab.key ? colors.navy : 'transparent',
                borderColor: colors.border,
                color: activeTab === tab.key ? '#fff' : colors.navy,
                '&:hover': { bgcolor: activeTab === tab.key ? '#000226' : '#F7FAFF' },
              }}
            >
              {tab.label}
            </Button>
          ))}
        </Box>

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          {(activeTab === 'company' || activeTab === 'contact') &&
            (editing ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
                {rows.map((row) =>
                  activeTab === 'company' && row.key === 'businessType' ? (
                    <TextField
                      key={row.key}
                      select
                      label={row.label}
                      size="small"
                      value={draft.businessType}
                      onChange={(e) => setDraft({ ...draft, businessType: e.target.value })}
                      sx={{ bgcolor: colors.field, borderRadius: 1 }}
                    >
                      {BUSINESS_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      key={row.key}
                      label={row.label}
                      size="small"
                      value={draft[row.key]}
                      onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}
                      disabled={row.key === 'contactEmail'}
                      multiline={row.key === 'companyAddress'}
                      minRows={row.key === 'companyAddress' ? 2 : undefined}
                      fullWidth
                      sx={{ bgcolor: colors.field, borderRadius: 1, gridColumn: row.key === 'companyAddress' ? '1 / -1' : undefined }}
                    />
                  ),
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', rowGap: 1.5, columnGap: 3 }}>
                {rows.map((row) => (
                  <Box key={row.key} sx={{ display: 'contents' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                    <Typography sx={{ fontSize: 16, color: profile[row.key] ? '#000' : '#9AA0A6' }}>
                      {profile[row.key] || 'ยังไม่ระบุ'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))}

          {activeTab === 'documents' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {approveStatus === 'request_document' && (
                <Alert severity="info">
                  เจ้าหน้าที่ขอเอกสารยืนยันเพิ่มเติม กรุณาอัปโหลดเอกสารด้านล่างแล้วกด “บันทึก” เพื่อส่งกลับให้ตรวจสอบอีกครั้ง
                </Alert>
              )}
              {documents.map((doc) => (
                <UploadRow key={doc.key} document={doc} token={token ?? ''} onUpload={uploadDocument} />
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  variant="contained"
                  onClick={() => void saveDocuments()}
                  disabled={savingDocs}
                  sx={{ bgcolor: colors.navy, textTransform: 'none', borderRadius: '20px', px: 3, '&:hover': { bgcolor: '#000226' } }}
                >
                  {savingDocs ? 'กำลังบันทึก…' : 'บันทึกเอกสาร'}
                </Button>
              </Box>
            </Box>
          )}

          {activeTab === 'account' && (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    bgcolor: colors.field,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon sx={{ fontSize: 72, color: '#9AA0A6' }} />
                </Box>
                <Box
                  component="label"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    border: `1.5px solid ${colors.border}`,
                    borderRadius: 3,
                    p: 1.5,
                    cursor: 'pointer',
                    width: 260,
                  }}
                >
                  <input
                    type="file"
                    hidden
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => setAvatarName(e.target.files?.[0]?.name ?? null)}
                  />
                  <InsertDriveFileOutlinedIcon sx={{ color: colors.navy }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>รูปโปรไฟล์</Typography>
                    <Typography sx={{ fontSize: 11, color: '#9AA0A6' }} noWrap>
                      {avatarName ?? 'รองรับไฟล์ JPG, PNG (ขนาดไม่เกิน 5MB)'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, maxWidth: 380 }}>
                <TextField label="ชื่อผู้ใช้" size="small" value={user.user_name} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
                <TextField label="อีเมล" size="small" value={user.email} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
                <ChangePasswordCard onChanged={() => setSavedNotice(true)} />
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Save success dialog */}
      <Dialog open={savedNotice} onClose={() => setSavedNotice(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
          <IconButton onClick={() => setSavedNotice(false)} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}>
            <CloseOutlinedIcon />
          </IconButton>
          <CheckCircleOutlineIcon sx={{ fontSize: 88, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy, mt: 1 }}>บันทึกข้อมูลสำเร็จ</Typography>
        </Box>
      </Dialog>
    </Box>
  )
}

function apiToLocalStudentProfile(api: StudentProfileApi | null, account: { userName: string; phone: string; gender: string }): Profile {
  return {
    firstName: api?.first_name ?? account.userName,
    lastName: api?.last_name ?? '',
    gender: api?.gender || account.gender,
    dateOfBirth: api?.date_of_birth ?? '',
    age: api?.age ? String(api.age) : '',
    availableTime: api?.available_time ?? '',
    address: api?.address ?? '',
    university: api?.university ?? '',
    faculty: api?.faculty ?? '',
    major: api?.major ?? '',
    year: api?.years ?? '',
    phone: api?.phone || account.phone,
    skills: api?.skill ?? '',
  }
}

function StudentSettingsView() {
  usePageTitle('ข้อมูลส่วนตัวนักศึกษา')
  const { user, token, refreshProfile } = useAuth()

  const [profile, setProfile] = useState<Profile>(() =>
    apiToLocalStudentProfile(null, { userName: user?.user_name ?? '', phone: user?.phone ?? '', gender: user?.gender ?? '' }),
  )
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(EMPTY_PROFILE)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoadingProfile(true)
      try {
        const api = await getMyStudentProfile(token!)
        if (cancelled) return
        setProfile(apiToLocalStudentProfile(api, { userName: user?.user_name ?? '', phone: user?.phone ?? '', gender: user?.gender ?? '' }))
      } catch (err) {
        // 404 just means the student hasn't submitted a profile yet — keep the empty defaults.
        if (!cancelled && !(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดข้อมูลไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, user?.user_name, user?.phone, user?.gender])

  const [scanBusy, setScanBusy] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)

  function startEdit() {
    setDraft(profile)
    setError(null)
    setScanNote(null)
    setEditing(true)
  }

  async function handleScanSchedule(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !token) return
    setScanBusy(true)
    setScanNote(null)
    try {
      const result = await extractScheduleFromImage(token, file)
      if (result.summary) {
        setDraft((d) => ({ ...d, availableTime: result.summary }))
        setScanNote('กรอกเวลาว่างจากตารางเรียนให้แล้ว — ปรับแก้ได้ตามต้องการ')
      } else {
        setScanNote('อ่านตารางเรียนไม่ได้ กรุณากรอกเวลาว่างเอง')
      }
    } catch (err) {
      setScanNote(err instanceof ApiError ? err.message : 'สแกนไม่สำเร็จ กรุณากรอกเวลาว่างเอง')
    } finally {
      setScanBusy(false)
    }
  }

  async function saveProfile() {
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      const api = await upsertMyStudentProfile(token, {
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        date_of_birth: draft.dateOfBirth || undefined,
        gender: draft.gender.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        address: draft.address.trim() || undefined,
        university: draft.university.trim() || undefined,
        faculty: draft.faculty.trim() || undefined,
        major: draft.major.trim() || undefined,
        years: draft.year.trim() || undefined,
        skill: draft.skills.trim() || undefined,
        available_time: draft.availableTime.trim() || undefined,
      })
      // The upsert already mirrored phone/gender/avatar onto the User row; refresh
      // the auth context so other screens see the change.
      await refreshProfile()
      setProfile(apiToLocalStudentProfile(api, { userName: user?.user_name ?? '', phone: draft.phone.trim(), gender: draft.gender.trim() }))
      setEditing(false)
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('บันทึกไม่สำเร็จ')
      }
    } finally {
      setSaving(false)
    }
  }

  function removeDocument(id: number) {
    setDocuments((docs) => docs.filter((d) => d.id !== id))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
      setUploadError('ไฟล์ไม่รองรับ กรุณาเลือกไฟล์ PDF, Word, Excel, PowerPoint, Text, JPG, PNG, GIF หรือ WEBP')
      setSelectedFile(null)
      return
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadError('ขนาดไฟล์เกิน 10 MB กรุณาเลือกไฟล์ใหม่')
      setSelectedFile(null)
      return
    }

    setUploadError(null)
    setSelectedFile(file)
  }

  function closeUploadDialog() {
    setUploadOpen(false)
    setSelectedFile(null)
    setUploadError(null)
  }

  function confirmUpload() {
    if (!selectedFile) {
      setUploadError('กรุณาเลือกไฟล์ที่ต้องการอัปโหลด')
      return
    }
    setDocuments((docs) => [
      ...docs,
      { id: docs.length ? Math.max(...docs.map((d) => d.id)) + 1 : 1, name: selectedFile.name, uploadedAt: new Date().toLocaleDateString('th-TH') },
    ])
    closeUploadDialog()
  }

  if (!user || loadingProfile) {
    return <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
  }

  return (
    <Box sx={{ maxWidth: 950, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: '20px', p: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy }}>
            {editing ? 'แก้ไขข้อมูลส่วนตัว' : 'ข้อมูลส่วนตัว'}
          </Typography>
          {editing ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                startIcon={<CheckOutlinedIcon />}
                onClick={() => void saveProfile()}
                disabled={saving}
                sx={{ bgcolor: '#DFF3E1', color: '#217829', textTransform: 'none', borderRadius: '20px', px: 2 }}
              >
                บันทึก
              </Button>
              <Button
                startIcon={<CloseOutlinedIcon />}
                onClick={() => setEditing(false)}
                sx={{ bgcolor: '#FCE4E4', color: '#DA1E28', textTransform: 'none', borderRadius: '20px', px: 2 }}
              >
                ยกเลิก
              </Button>
            </Box>
          ) : (
            <Button
              startIcon={<EditOutlinedIcon />}
              onClick={startEdit}
              sx={{ bgcolor: '#F0F0F0', color: '#000', textTransform: 'none', borderRadius: '20px', px: 2 }}
            >
              แก้ไขข้อมูล
            </Button>
          )}
        </Box>

        {editing ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 1.5, columnGap: 3, alignItems: 'center' }}>
            {fieldRows.map((row) =>
              row.key === 'gender' ? (
                <Box key={row.key} sx={{ display: 'contents' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                  <TextField
                    select
                    size="small"
                    value={draft.gender}
                    onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                    sx={{ bgcolor: colors.field, borderRadius: 1, maxWidth: 320 }}
                  >
                    <MenuItem value="ชาย">ชาย</MenuItem>
                    <MenuItem value="หญิง">หญิง</MenuItem>
                    <MenuItem value="อื่น ๆ">อื่น ๆ</MenuItem>
                  </TextField>
                </Box>
              ) : row.key === 'dateOfBirth' ? (
                <Box key={row.key} sx={{ display: 'contents' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                  <TextField
                    size="small"
                    type="date"
                    value={draft.dateOfBirth}
                    onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
                    error={!!draft.dateOfBirth && draft.dateOfBirth > new Date().toISOString().slice(0, 10)}
                    helperText={
                      !!draft.dateOfBirth && draft.dateOfBirth > new Date().toISOString().slice(0, 10)
                        ? 'วันเกิดต้องไม่เกินวันนี้'
                        : undefined
                    }
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: new Date().toISOString().slice(0, 10) } }}
                    sx={{ bgcolor: colors.field, borderRadius: 1, maxWidth: 320 }}
                  />
                </Box>
              ) : (
                <Box key={row.key} sx={{ display: 'contents' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                  <TextField
                    size="small"
                    value={draft[row.key]}
                    onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}
                    multiline={row.key === 'skills' || row.key === 'availableTime'}
                    placeholder={row.key === 'availableTime' ? 'เช่น จ-ศ หลัง 16:00, ส-อา ทั้งวัน' : undefined}
                    sx={{ bgcolor: colors.field, borderRadius: 1, maxWidth: row.key === 'address' || row.key === 'skills' || row.key === 'availableTime' ? 480 : 320 }}
                  />
                </Box>
              ),
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 1.5, columnGap: 3 }}>
            {fieldRows.map((row) => (
              <Box key={row.key} sx={{ display: 'contents' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                <Typography sx={{ fontSize: 16, color: profile[row.key] ? '#000' : '#9AA0A6' }}>
                  {row.key === 'dateOfBirth' && profile.dateOfBirth
                    ? `${profile.dateOfBirth}${profile.age ? ` (อายุ ${profile.age} ปี)` : ''}`
                    : profile[row.key] || 'ยังไม่ระบุ'}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {editing && (
          <Box sx={{ mt: 2 }}>
            <Button
              component="label"
              size="small"
              disabled={scanBusy}
              startIcon={scanBusy ? <CircularProgress size={16} /> : <UploadOutlinedIcon />}
              sx={{ textTransform: 'none', color: '#0066CC' }}
            >
              {scanBusy ? 'กำลังสแกน…' : 'สแกนตารางเรียนเพื่อกรอกเวลาว่าง (AI)'}
              <input type="file" hidden accept=".jpg,.jpeg,.png,.webp" onChange={(e) => void handleScanSchedule(e)} />
            </Button>
            {scanNote && <Typography sx={{ fontSize: 12, color: '#697077', mt: 0.5 }}>{scanNote}</Typography>}
          </Box>
        )}
      </Box>

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: '20px', p: 4, mb: 4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy, mb: 2 }}>จัดการบัญชี</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 380 }}>
          <TextField label="ชื่อผู้ใช้" size="small" value={user.user_name} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
          <TextField label="อีเมล" size="small" value={user.email} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
          <ChangePasswordCard onChanged={() => setSavedNotice(true)} />
        </Box>
      </Box>

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: '20px', p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy }}>เอกสารที่อัปโหลด</Typography>
          <Button
            startIcon={<UploadOutlinedIcon />}
            onClick={() => setUploadOpen(true)}
            sx={{ bgcolor: '#F0F0F0', color: '#000', textTransform: 'none', borderRadius: '20px', px: 2 }}
          >
            อัปโหลด
          </Button>
        </Box>

        <Box>
          {documents.map((doc, index) => (
            <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, borderTop: index > 0 ? '1px solid #E8E8E8' : 'none' }}>
              <InsertDriveFileOutlinedIcon sx={{ color: colors.navy }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{doc.name}</Typography>
                <Typography sx={{ fontSize: 14, color: '#000' }}>อัปโหลดเมื่อ {doc.uploadedAt}</Typography>
              </Box>
              <Button
                onClick={() => removeDocument(doc.id)}
                sx={{ bgcolor: '#FF564A', color: '#fff', textTransform: 'none', borderRadius: '20px', minWidth: 60, px: 1.5, fontSize: 13 }}
              >
                ลบ
              </Button>
            </Box>
          ))}

          {documents.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 3 }}>ยังไม่มีเอกสารที่อัปโหลด</Typography>
          )}
        </Box>
      </Box>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onClose={closeUploadDialog} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>อัปโหลดเอกสาร</Typography>
            <IconButton size="small" onClick={closeUploadDialog}><CloseOutlinedIcon /></IconButton>
          </Box>

          <ErrorAlert message={uploadError} />

          <Box
            component="label"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#E8E8E8',
              borderRadius: 3,
              height: 180,
              cursor: 'pointer',
              mb: 2,
              p: 2,
              textAlign: 'center',
            }}
          >
            <input type="file" hidden onChange={handleFileSelect} accept={ALLOWED_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',')} />
            <Box sx={{ width: 56, height: 56, borderRadius: 2, border: `2px solid ${colors.navy}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AddIcon sx={{ color: colors.navy }} />
            </Box>
            {selectedFile && (
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy, mt: 1.5, wordBreak: 'break-all' }}>
                {selectedFile.name}
              </Typography>
            )}
          </Box>

          <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy, mb: 0.5 }}>รองรับไฟล์:</Typography>
          <Typography sx={{ fontSize: 12, color: '#333' }}>
            • เอกสาร: PDF (.pdf), Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), Text (.txt)
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#333', mb: 2 }}>
            • รูปภาพ: JPG (.jpg, .jpeg), PNG (.png), GIF (.gif), WEBP (.webp)
            <br />
            ขนาดไฟล์ไม่เกิน 10 MB
          </Typography>

          <Button
            fullWidth
            variant="contained"
            onClick={confirmUpload}
            disabled={!selectedFile}
            sx={{ height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            อัปโหลด
          </Button>
        </Box>
      </Dialog>

      {/* Save success dialog */}
      <Dialog open={savedNotice} onClose={() => setSavedNotice(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
          <IconButton onClick={() => setSavedNotice(false)} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}>
            <CloseOutlinedIcon />
          </IconButton>
          <CheckCircleOutlineIcon sx={{ fontSize: 88, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy, mt: 1 }}>บันทึกข้อมูลสำเร็จ</Typography>
        </Box>
      </Dialog>
    </Box>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerSettingsView /> : <StudentSettingsView />
}
