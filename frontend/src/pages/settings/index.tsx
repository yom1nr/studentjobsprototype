import { useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, Chip, Dialog, IconButton, MenuItem, TextField, Typography } from '@mui/material'
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
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { getMyEmployerProfile, upsertMyEmployerProfile } from '../../services/https/employer'
import type { EmployerProfile as EmployerProfileApi } from '../../interface/IEmployerInterface'
import { extractScheduleFromImage, getMyStudentProfile, upsertMyStudentProfile } from '../../services/https/student'
import type { StudentProfile as StudentProfileApi, TimeSlot } from '../../interface/IStudentInterface'

const colors = { navy: '#012150', border: '#D9D9D9', field: '#F0F0F0' }

// Extended student-profile fields (address, university, etc.) are mocked locally —
// the backend User model only exposes user_name/email/phone/gender today.
type Profile = {
  firstName: string
  lastName: string
  gender: string
  dateOfBirth: string
  age: string
  address: string
  university: string
  faculty: string
  major: string
  year: string
  phone: string
  skills: string
  availableTime: string
}

const EMPTY_PROFILE: Profile = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  age: '',
  address: '',
  university: '',
  faculty: '',
  major: '',
  year: '',
  phone: '',
  skills: '',
  availableTime: '',
}

const fieldRows: { key: keyof Profile; label: string }[] = [
  { key: 'firstName', label: 'ชื่อ' },
  { key: 'lastName', label: 'นามสกุล' },
  { key: 'gender', label: 'เพศ' },
  { key: 'dateOfBirth', label: 'วัน/เดือน/ปีเกิด' },
  { key: 'age', label: 'อายุ (คำนวณจากวันเกิด)' },
  { key: 'address', label: 'ที่อยู่' },
  { key: 'university', label: 'มหาวิทยาลัย' },
  { key: 'faculty', label: 'คณะ' },
  { key: 'major', label: 'สาขาวิชา' },
  { key: 'year', label: 'ชั้นปีที่ศึกษา' },
  { key: 'phone', label: 'เบอร์โทรศัพท์' },
  { key: 'skills', label: 'ทักษะความสามารถ' },
  { key: 'availableTime', label: 'เวลาว่างจากการเรียน' },
]

type Document = { id: number; name: string; uploadedAt: string; file?: File }

const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
  })
}

function createDummyTimetableFile(filename: string): File {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const byteCharacters = atob(pngBase64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'image/png' })
  return new File([blob], filename, { type: 'image/png' })
}

const INITIAL_DOCUMENTS: Document[] = [
  { id: 1, name: 'TimeTable.jpg (ตารางเรียนจากตอนสมัคร)', uploadedAt: 'ตอนสมัครสมาชิก' },
  { id: 2, name: 'Profile.jpg', uploadedAt: '20 พ.ค. 2569' },
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

type CompanyDocument = { key: string; label: string; hint: string; fileName: string | null }

const INITIAL_COMPANY_DOCUMENTS: CompanyDocument[] = [
  { key: 'registration', label: 'หนังสือรับรองการจดทะเบียนบริษัท / ร้านค้า', hint: 'รองรับไฟล์ PDF, JPG, PNG (ขนาดไม่เกิน 5MB)', fileName: null },
  { key: 'signatoryId', label: 'บัตรประชาชนของผู้มีอำนาจลงนาม', hint: 'รองรับไฟล์ PDF, JPG, PNG (ขนาดไม่เกิน 5MB)', fileName: null },
  { key: 'logo', label: 'โลโก้บริษัท / ร้านค้า (ถ้ามี)', hint: 'รองรับไฟล์ PDF, JPG, PNG (ขนาดไม่เกิน 5MB)', fileName: null },
]

function UploadRow({
  document,
  onUpload,
}: Readonly<{ document: CompanyDocument; onUpload: (key: string, fileName: string) => void }>) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: `1.5px solid ${colors.border}`,
        borderRadius: 3,
        p: 2,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: `1.5px solid ${colors.navy}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <InsertDriveFileOutlinedIcon sx={{ color: colors.navy, fontSize: 20 }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>{document.label}</Typography>
        <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{document.fileName ?? document.hint}</Typography>
      </Box>
      <IconButton component="label" sx={{ color: colors.navy }}>
        <input
          type="file"
          hidden
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(document.key, file.name)
          }}
        />
        <UploadOutlinedIcon />
      </IconButton>
    </Box>
  )
}

const APPROVE_STATUS_LABEL: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'รอการอนุมัติ', color: 'warning' },
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

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

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

  const [avatarUploading, setAvatarUploading] = useState(false)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('ขนาดไฟล์รูปภาพเกิน 5MB')
      return
    }
    setError(null)
    setAvatarUploading(true)
    try {
      const base64 = await fileToBase64(file)
      await updateProfile({ avatar: base64 })
      setAvatarName(file.name)
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('อัปโหลดรูปโปรไฟล์ไม่สำเร็จ')
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  function uploadDocument(key: string, fileName: string) {
    setDocuments((docs) => docs.map((d) => (d.key === key ? { ...d, fileName } : d)))
  }

  async function changePassword() {
    setPasswordError(null)
    if (currentPassword.length === 0) {
      setPasswordError('กรุณากรอกรหัสผ่านปัจจุบัน')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านไม่ตรงกัน')
      return
    }
    setPasswordSaving(true)
    try {
      await updateProfile({ current_password: currentPassword, password: newPassword })
      setPasswordOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setPasswordError('เปลี่ยนรหัสผ่านไม่สำเร็จ')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!user || loadingProfile) {
    return <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
  }

  const rows = activeTab === 'company' ? companyFieldRows : activeTab === 'contact' ? contactFieldRows : []
  const statusInfo = approveStatus ? APPROVE_STATUS_LABEL[approveStatus] : undefined

  return (
    <Box sx={{ maxWidth: 950, mx: 'auto' }}>
      <ErrorAlert message={error} />

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
              {documents.map((doc) => (
                <UploadRow key={doc.key} document={doc} onUpload={uploadDocument} />
              ))}
            </Box>
          )}

          {activeTab === 'account' && (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 4 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={user?.avatar}
                  sx={{
                    width: 140,
                    height: 140,
                    bgcolor: colors.field,
                    color: '#9AA0A6',
                    fontSize: 54,
                    fontWeight: 700,
                  }}
                >
                  {user?.user_name ? user.user_name.charAt(0).toUpperCase() : '?'}
                </Avatar>
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
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handleAvatarUpload(e)}
                    disabled={avatarUploading}
                  />
                  <InsertDriveFileOutlinedIcon sx={{ color: colors.navy }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>รูปโปรไฟล์</Typography>
                    <Typography sx={{ fontSize: 11, color: '#9AA0A6' }} noWrap>
                      {avatarUploading ? 'กำลังอัปโหลด...' : avatarName ?? 'รองรับไฟล์ JPG, PNG (ขนาดไม่เกิน 5MB)'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, maxWidth: 380 }}>
                <TextField label="ชื่อผู้ใช้" size="small" value={user?.user_name ?? ''} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
                <TextField label="อีเมล" size="small" value={user?.email ?? ''} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
                <Button
                  onClick={() => setPasswordOpen(true)}
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
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Change password dialog */}
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>เปลี่ยนแปลงรหัสผ่านของคุณ</Typography>
              <Typography sx={{ fontSize: 13, color: '#697077', mt: 0.5 }}>
                รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยอักษรและตัวเลข
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setPasswordOpen(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Box>

          <ErrorAlert message={passwordError} />

          <TextField
            label="รหัสผ่านปัจจุบัน"
            placeholder="กรุณากรอกรหัสผ่านปัจจุบัน"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowCurrentPassword((v) => !v)} edge="end">
                    {showCurrentPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />
          <TextField
            label="รหัสผ่านใหม่"
            placeholder="กรุณากรอกรหัสผ่านใหม่"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowNewPassword((v) => !v)} edge="end">
                    {showNewPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />
          <TextField
            label="ยืนยันรหัสผ่าน"
            placeholder="กรุณากรอกรหัสผ่าน"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            sx={{ mb: 1 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowConfirmPassword((v) => !v)} edge="end">
                    {showConfirmPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
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
            onClick={() => void changePassword()}
            disabled={passwordSaving}
            sx={{ height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            {passwordSaving ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
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

function calculateLocalAge(dobStr: string): number {
  if (!dobStr) return 0
  const dob = new Date(dobStr)
  if (isNaN(dob.getTime())) return 0
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age < 0 ? 0 : age
}

function apiToLocalStudentProfile(api: StudentProfileApi | null, account: { userName: string; phone: string; gender: string }): Profile {
  const rawDob = api?.date_of_birth ?? ''
  const dob = rawDob ? rawDob.slice(0, 10) : ''
  const calculatedAge = api?.age || (dob ? calculateLocalAge(dob) : 0)
  const ageVal = calculatedAge > 0 ? `${calculatedAge} ปี` : ''

  return {
    firstName: api?.first_name ?? account.userName,
    lastName: api?.last_name ?? '',
    gender: api?.gender || account.gender,
    dateOfBirth: dob,
    age: ageVal,
    address: api?.address ?? '',
    university: api?.university ?? '',
    faculty: api?.faculty ?? '',
    major: api?.major ?? '',
    year: api?.years ?? '',
    phone: api?.phone || account.phone,
    skills: api?.skill ?? '',
    availableTime: api?.available_time ?? '',
  }
}

const STUDENT_TABS = [
  { key: 'info', label: 'ข้อมูลส่วนตัว' },
  { key: 'documents', label: 'เอกสารของฉัน' },
  { key: 'account', label: 'การจัดการบัญชี' },
] as const

type StudentTabKey = (typeof STUDENT_TABS)[number]['key']

function StudentSettingsView() {
  usePageTitle('ข้อมูลส่วนตัวนักศึกษา')
  const { user, token, updateProfile } = useAuth()

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

  const [activeTab, setActiveTab] = useState<StudentTabKey>('info')
  const [avatarName, setAvatarName] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('ขนาดไฟล์รูปภาพเกิน 5MB')
      return
    }
    setError(null)
    setAvatarUploading(true)
    try {
      const base64 = await fileToBase64(file)
      await updateProfile({ avatar: base64 })
      setAvatarName(file.name)
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setError('อัปโหลดรูปโปรไฟล์ไม่สำเร็จ')
      }
    } finally {
      setAvatarUploading(false)
    }
  }

  const [selectedDocId, setSelectedDocId] = useState<string>('1')
  const [aiExtractOpen, setAiExtractOpen] = useState(false)
  const [aiExtractFile, setAiExtractFile] = useState<File | null>(() =>
    INITIAL_DOCUMENTS[0] ? createDummyTimetableFile(INITIAL_DOCUMENTS[0].name) : null,
  )
  const [aiExtractLoading, setAiExtractLoading] = useState(false)
  const [aiExtractError, setAiExtractError] = useState<string | null>(null)
  const [aiExtractedClassSlots, setAiExtractedClassSlots] = useState<TimeSlot[] | null>(null)
  const [aiExtractedFreeSlots, setAiExtractedFreeSlots] = useState<TimeSlot[] | null>(null)

  function openAiExtraction(docId?: string) {
    const targetId = docId || selectedDocId || (documents[0] ? String(documents[0].id) : 'upload_new')
    setSelectedDocId(targetId)
    if (targetId === 'upload_new') {
      setAiExtractFile(null)
    } else {
      const foundDoc = documents.find((d) => String(d.id) === targetId)
      if (foundDoc) {
        setAiExtractFile(foundDoc.file || createDummyTimetableFile(foundDoc.name))
      }
    }
    setAiExtractOpen(true)
  }

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function changePassword() {
    setPasswordError(null)
    if (currentPassword.length === 0) {
      setPasswordError('กรุณากรอกรหัสผ่านปัจจุบัน')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('รหัสผ่านไม่ตรงกัน')
      return
    }
    setPasswordSaving(true)
    try {
      await updateProfile({ current_password: currentPassword, password: newPassword })
      setPasswordOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setPasswordError('เปลี่ยนรหัสผ่านไม่สำเร็จ')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleRunAiExtraction() {
    if (!token || !aiExtractFile) return
    setAiExtractError(null)
    setAiExtractLoading(true)
    setAiExtractedClassSlots(null)
    setAiExtractedFreeSlots(null)

    try {
      const res = await extractScheduleFromImage(token, aiExtractFile)
      setAiExtractedClassSlots(res.class_slots || [])
      setAiExtractedFreeSlots(res.free_slots || [])
    } catch (err) {
      if (err instanceof ApiError) {
        setAiExtractError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setAiExtractError('ไม่สามารถวิเคราะห์รูปภาพได้ กรุณาตรวจสอบไฟล์รูปภาพตารางเรียนหรือการตั้งค่า GEMINI_API_KEY')
      }
    } finally {
      setAiExtractLoading(false)
    }
  }

  async function applyExtractedScheduleToAvailableTime() {
    if (!aiExtractedFreeSlots || !token) return
    const freeSummary =
      aiExtractedFreeSlots.length > 0
        ? aiExtractedFreeSlots.map((s) => `${s.day} ${s.start_time}-${s.end_time}`).join(', ')
        : 'ไม่มีเวลาว่าง'

    try {
      const updatedApi = await upsertMyStudentProfile(token, {
        first_name: profile.firstName.trim() || (user?.user_name ?? ''),
        last_name: profile.lastName.trim(),
        date_of_birth: profile.dateOfBirth.trim() || undefined,
        address: profile.address.trim() || undefined,
        university: profile.university.trim() || undefined,
        faculty: profile.faculty.trim() || undefined,
        major: profile.major.trim() || undefined,
        years: profile.year.trim() || undefined,
        skill: profile.skills.trim() || undefined,
        available_time: freeSummary,
      })

      const updatedLocal = apiToLocalStudentProfile(updatedApi, {
        userName: user?.user_name ?? '',
        phone: profile.phone,
        gender: profile.gender,
      })

      setProfile(updatedLocal)
      setDraft(updatedLocal)
      setAiExtractOpen(false)
      setSavedNotice(true)
    } catch (err) {
      if (err instanceof ApiError) {
        setAiExtractError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setAiExtractError('ไม่สามารถบันทึกเวลาว่างลงฐานข้อมูลได้')
      }
    }
  }

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

  function startEdit() {
    setDraft({
      ...profile,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
    })
    setError(null)
    setEditing(true)
  }

  async function saveProfile() {
    if (!token) return
    setError(null)
    setSaving(true)
    try {
      const api = await upsertMyStudentProfile(token, {
        first_name: draft.firstName.trim(),
        last_name: draft.lastName.trim(),
        date_of_birth: draft.dateOfBirth.trim() || undefined,
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
      if (draft.phone.trim() !== (user?.phone ?? '') || draft.gender.trim() !== (user?.gender ?? '')) {
        await updateProfile({ phone: draft.phone.trim() || undefined, gender: draft.gender.trim() || undefined })
      }
      setProfile(apiToLocalStudentProfile(api, { userName: user?.user_name ?? '', phone: api.phone || draft.phone.trim(), gender: api.gender || draft.gender.trim() }))
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
    const newDoc: Document = {
      id: documents.length ? Math.max(...documents.map((d) => d.id)) + 1 : 1,
      name: selectedFile.name,
      uploadedAt: new Date().toLocaleDateString('th-TH'),
      file: selectedFile,
    }
    setDocuments((docs) => [...docs, newDoc])
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
            {activeTab === 'info' ? (editing ? 'แก้ไขข้อมูลส่วนตัว' : 'ข้อมูลส่วนตัวนักศึกษา') : activeTab === 'documents' ? 'เอกสารของฉัน' : 'การจัดการบัญชีนักศึกษา'}
          </Typography>
          {activeTab === 'info' &&
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
          {STUDENT_TABS.map((tab) => (
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

        {activeTab === 'info' &&
          (editing ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 1.5, columnGap: 3, alignItems: 'center' }}>
              {fieldRows.map((row) => {
                if (row.key === 'gender') {
                  return (
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
                  )
                }
                if (row.key === 'dateOfBirth') {
                  return (
                    <Box key={row.key} sx={{ display: 'contents' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                      <TextField
                        type="date"
                        size="small"
                        value={draft.dateOfBirth}
                        onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
                        sx={{ bgcolor: colors.field, borderRadius: 1, maxWidth: 320 }}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Box>
                  )
                }
                if (row.key === 'age') {
                  return (
                    <Box key={row.key} sx={{ display: 'contents' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                      <Typography sx={{ fontSize: 15, color: '#555', fontStyle: 'italic' }}>
                        {draft.dateOfBirth
                          ? `${calculateLocalAge(draft.dateOfBirth)} ปี (คำนวณอัตโนมัติจากวันเกิด)`
                          : 'เลือกวัน/เดือน/ปีเกิดเพื่อคำนวณอายุ'}
                      </Typography>
                    </Box>
                  )
                }
                return (
                  <Box key={row.key} sx={{ display: 'contents' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{row.label}</Typography>
                    <TextField
                      size="small"
                      value={draft[row.key]}
                      onChange={(e) => setDraft({ ...draft, [row.key]: e.target.value })}
                      multiline={row.key === 'skills' || row.key === 'availableTime'}
                      sx={{ bgcolor: colors.field, borderRadius: 1, maxWidth: row.key === 'address' || row.key === 'skills' || row.key === 'availableTime' ? 480 : 320 }}
                    />
                  </Box>
                )
              })}
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 1.5, columnGap: 3 }}>
              {fieldRows.map((row) => (
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
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>รายการเอกสารในระบบ</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  onClick={() => openAiExtraction()}
                  sx={{ bgcolor: 'rgba(1, 33, 80, 0.08)', color: colors.navy, textTransform: 'none', borderRadius: '20px', px: 2, fontWeight: 600 }}
                >
                  วิเคราะห์ตารางเรียน (AI)
                </Button>
                <Button
                  startIcon={<UploadOutlinedIcon />}
                  onClick={() => setUploadOpen(true)}
                  sx={{ bgcolor: '#F0F0F0', color: '#000', textTransform: 'none', borderRadius: '20px', px: 2 }}
                >
                  อัปโหลด
                </Button>
              </Box>
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
        )}

        {activeTab === 'account' && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 4 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={user?.avatar}
                sx={{
                  width: 140,
                  height: 140,
                  bgcolor: colors.field,
                  color: '#9AA0A6',
                  fontSize: 54,
                  fontWeight: 700,
                }}
              >
                {user?.user_name ? user.user_name.charAt(0).toUpperCase() : '?'}
              </Avatar>
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
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleAvatarUpload(e)}
                  disabled={avatarUploading}
                />
                <InsertDriveFileOutlinedIcon sx={{ color: colors.navy }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>รูปโปรไฟล์</Typography>
                  <Typography sx={{ fontSize: 11, color: '#9AA0A6' }} noWrap>
                    {avatarUploading ? 'กำลังอัปโหลด...' : avatarName ?? 'รองรับไฟล์ JPG, PNG (ขนาดไม่เกิน 5MB)'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, maxWidth: 380 }}>
              <TextField label="ชื่อผู้ใช้" size="small" value={user?.user_name ?? ''} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
              <TextField label="อีเมล" size="small" value={user?.email ?? ''} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
              <TextField label="เบอร์โทรศัพท์" size="small" value={profile.phone || 'ยังไม่ระบุ'} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
              <TextField label="เพศ" size="small" value={profile.gender || 'ยังไม่ระบุ'} disabled fullWidth sx={{ bgcolor: colors.field, borderRadius: 1 }} />
              <Button
                onClick={() => setPasswordOpen(true)}
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
            </Box>
          </Box>
        )}
      </Box>


      {/* AI Schedule Extraction Dialog */}
      <Dialog open={aiExtractOpen} onClose={() => setAiExtractOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeOutlinedIcon sx={{ color: colors.navy }} />
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>วิเคราะห์ตารางเรียนด้วย AI</Typography>
            </Box>
            <IconButton size="small" onClick={() => setAiExtractOpen(false)}><CloseOutlinedIcon /></IconButton>
          </Box>

          <ErrorAlert message={aiExtractError} />

          <Typography sx={{ fontSize: 14, color: '#555', mb: 2 }}>
            เลือกระบุภาพตารางเรียนที่มีในระบบ (เช่น ตารางเรียนที่อัปโหลดตอนสมัครสมาชิก) หรือเลือกอัปโหลดไฟล์ภาพใหม่ เพื่อให้ AI สกัดช่วงเวลาที่มีเรียนและคำนวณเวลาว่างอัตโนมัติ
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.75 }}>
              เอกสารตารางเรียนที่ต้องการวิเคราะห์:
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={selectedDocId}
              onChange={(e) => {
                const val = e.target.value
                setSelectedDocId(val)
                if (val === 'upload_new') {
                  setAiExtractFile(null)
                } else {
                  const foundDoc = documents.find((d) => String(d.id) === val)
                  if (foundDoc) {
                    setAiExtractFile(foundDoc.file || createDummyTimetableFile(foundDoc.name))
                  }
                }
              }}
              sx={{ bgcolor: '#F9FAFB', borderRadius: 1 }}
            >
              {documents.map((doc) => (
                <MenuItem key={doc.id} value={String(doc.id)}>
                  📄 {doc.name} ({doc.uploadedAt})
                </MenuItem>
              ))}
              <MenuItem value="upload_new">➕ อัปโหลดภาพตารางเรียนใหม่...</MenuItem>
            </TextField>
          </Box>

          {selectedDocId === 'upload_new' && (
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#F5F7FA',
                border: `2px dashed ${colors.navy}`,
                borderRadius: 3,
                height: 120,
                cursor: 'pointer',
                mb: 2,
                p: 2,
                textAlign: 'center',
              }}
            >
              <input
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setAiExtractFile(file)
                }}
              />
              <AddIcon sx={{ color: colors.navy, fontSize: 32, mb: 1 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>
                {aiExtractFile ? aiExtractFile.name : 'คลิกเลือกภาพตารางเรียนใบใหม่'}
              </Typography>
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={() => void handleRunAiExtraction()}
            disabled={!aiExtractFile || aiExtractLoading}
            sx={{ height: 44, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, mb: 3 }}
          >
            {aiExtractLoading ? 'กำลังวิเคราะห์รูปภาพ…' : 'เริ่มสกัดตารางเรียนด้วย AI'}
          </Button>

          {(aiExtractedClassSlots || aiExtractedFreeSlots) && (
            <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2, bgcolor: '#FAFAFA' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 1 }}>
                1. เวลาเรียนที่สกัดได้จาก AI ({aiExtractedClassSlots?.length ?? 0} ช่วงเวลา):
              </Typography>
              {aiExtractedClassSlots && aiExtractedClassSlots.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {aiExtractedClassSlots.map((slot, i) => (
                    <Chip
                      key={`class-${slot.day}-${slot.start_time}-${i}`}
                      label={`${slot.day}: ${slot.start_time} - ${slot.end_time}`}
                      color="secondary"
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              ) : (
                <Typography sx={{ fontSize: 13, color: '#697077', mb: 2 }}>ไม่พบช่วงเวลาเรียนในภาพ</Typography>
              )}

              <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#2E7D32', mb: 1 }}>
                2. เวลาว่างจากการเรียนที่คำนวณได้ (08:00 - 20:00 น.):
              </Typography>
              {aiExtractedFreeSlots && aiExtractedFreeSlots.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
                  {aiExtractedFreeSlots.map((slot, i) => (
                    <Chip
                      key={`free-${slot.day}-${slot.start_time}-${i}`}
                      label={`${slot.day}: ${slot.start_time} - ${slot.end_time}`}
                      color="success"
                      size="small"
                    />
                  ))}
                </Box>
              ) : (
                <Typography sx={{ fontSize: 13, color: '#697077', mb: 2 }}>ไม่มีเวลาว่างจากการเรียน</Typography>
              )}

              <Button
                fullWidth
                variant="contained"
                color="success"
                onClick={() => void applyExtractedScheduleToAvailableTime()}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600 }}
              >
                นำช่วงเวลาว่างไปบันทึกในโปรไฟล์ (เวลาว่างจากการเรียน)
              </Button>
            </Box>
          )}
        </Box>
      </Dialog>

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

      {/* Change password dialog */}
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>เปลี่ยนแปลงรหัสผ่านของคุณ</Typography>
              <Typography sx={{ fontSize: 13, color: '#697077', mt: 0.5 }}>
                รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยอักษรและตัวเลข
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setPasswordOpen(false)}>
              <CloseOutlinedIcon />
            </IconButton>
          </Box>

          <ErrorAlert message={passwordError} />

          <TextField
            label="รหัสผ่านปัจจุบัน"
            placeholder="กรุณากรอกรหัสผ่านปัจจุบัน"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowCurrentPassword((v) => !v)} edge="end">
                    {showCurrentPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />
          <TextField
            label="รหัสผ่านใหม่"
            placeholder="กรุณากรอกรหัสผ่านใหม่"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowNewPassword((v) => !v)} edge="end">
                    {showNewPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                ),
              },
            }}
          />
          <TextField
            label="ยืนยันรหัสผ่าน"
            placeholder="กรุณากรอกรหัสผ่าน"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            sx={{ mb: 1 }}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowConfirmPassword((v) => !v)} edge="end">
                    {showConfirmPassword ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
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
            onClick={() => void changePassword()}
            disabled={passwordSaving}
            sx={{ height: 50, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            {passwordSaving ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
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
