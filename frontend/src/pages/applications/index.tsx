import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { listEmployerApplications, listMyApplications, reviewApplication } from '../../services/https/applications'
import type { Application } from '../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

const statusMap: Record<Application['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'รอพิจารณา', color: '#B5850C', bg: '#FFF6E0' },
  accepted: { label: 'ผ่านการพิจารณา', color: '#217829', bg: '#EAF7EA' },
  rejected: { label: 'ไม่ผ่านการพิจารณา', color: '#DA1E28', bg: '#FDEAEA' },
}

function applicationCode(id: number): string {
  return `APP-${String(id).padStart(4, '0')}`
}

function StudentApplicationsView() {
  usePageTitle('ใบสมัครงาน')
  const { token } = useAuth()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listMyApplications(token!)
        if (!cancelled) setApplications(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดใบสมัครงานไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const filtered = applications.filter(
    (a) => a.position.toLowerCase().includes(search.toLowerCase()) || a.company_name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 3 }}>
        ใบสมัครงานที่ยื่นไปแล้ว
      </Typography>

      <TextField
        placeholder="ค้นหาตำแหน่งงาน หรือ บริษัท.."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
      />

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 130px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['ตำแหน่งงาน', 'บริษัท', 'วันที่สมัคร', 'สถานะ'].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filtered.map((app, index) => {
            const status = statusMap[app.status]
            return (
              <Box
                key={app.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 130px 130px',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.75,
                  borderTop: index > 0 ? `1px solid ${colors.border}` : 'none',
                }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{app.position}</Typography>
                <Typography sx={{ fontSize: 13, color: '#52545C' }}>{app.company_name}</Typography>
                <Typography sx={{ fontSize: 13, color: '#697077' }}>{new Date(app.apply_date).toLocaleDateString('th-TH')}</Typography>
                <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, width: 'fit-content' }} />
              </Box>
            )
          })}
          {filtered.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบใบสมัครที่ค้นหา</Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

type EmployerView = 'list' | 'detail' | 'checklist'

function EmployerApplicationsView() {
  usePageTitle('ผู้สมัครงาน')
  const { token } = useAuth()

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [search, setSearch] = useState('')

  const [view, setView] = useState<EmployerView>('list')
  const [selected, setSelected] = useState<Application | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionComment, setCorrectionComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listEmployerApplications(token!)
        if (!cancelled) setApplications(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดใบสมัครงานไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, reloadToken])

  const filtered = applications.filter(
    (a) => a.student_name.toLowerCase().includes(search.toLowerCase()) || a.position.toLowerCase().includes(search.toLowerCase()),
  )

  function openDetail(app: Application) {
    setSelected(app)
    setActionError(null)
    setView('detail')
  }

  async function submitCorrectionRequest() {
    if (!token || !selected) return
    if (correctionComment.trim().length === 0) {
      setActionError('กรุณาระบุสิ่งที่ต้องการให้แก้ไข')
      return
    }
    setSubmitting(true)
    setActionError(null)
    try {
      await reviewApplication(token, selected.id, { result_status: 'correction_requested', comment: correctionComment.trim() })
      setCorrectionOpen(false)
      setCorrectionComment('')
      setView('list')
      setSelected(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmSave() {
    if (!token || !selected) return
    setSubmitting(true)
    setActionError(null)
    try {
      await reviewApplication(token, selected.id, { result_status: 'accepted' })
      setSuccessOpen(true)
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  function closeSuccess() {
    setSuccessOpen(false)
    setView('list')
    setSelected(null)
    setReloadToken((t) => t + 1)
  }

  if (view === 'detail' && selected) {
    const canReview = selected.status === 'pending'
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => { setView('list'); setSelected(null) }} sx={{ textTransform: 'none', color: '#045BE4', px: 0, mb: 1 }}>
          กลับ
        </Button>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 3 }}>
          ตรวจสอบข้อมูลผู้สมัคร
        </Typography>

        <ErrorAlert message={actionError} />

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, mb: 3 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 220 }}>
            <Box sx={{ width: 96, height: 96, borderRadius: '50%', bgcolor: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
              <PersonOutlineOutlinedIcon sx={{ fontSize: 48, color: '#9AA0A6' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, textAlign: 'center' }}>{selected.student_name || 'ไม่ระบุชื่อ'}</Typography>
            <Typography sx={{ fontSize: 13, color: '#697077' }}>นักศึกษา</Typography>
          </Box>

          <Box sx={{ flex: 1, border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <InfoRow label="ตำแหน่งที่สมัคร" value={selected.position} />
            <InfoRow label="วันที่สมัคร" value={new Date(selected.apply_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <InfoRow label="เบอร์โทรศัพท์" value={selected.student_phone || 'ไม่ระบุ'} />
            <InfoRow label="อีเมล" value={selected.student_email} />
            {selected.remarks && <InfoRow label="หมายเหตุจากผู้สมัคร" value={selected.remarks} />}
          </Box>
        </Box>

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 1.5 }}>เอกสารแนบ</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#9AA0A6' }}>
            <InsertDriveFileOutlinedIcon sx={{ color: '#C4C4C4' }} />
            <Typography sx={{ fontSize: 13 }}>ยังไม่มีระบบแนบเอกสารประกอบการสมัคร</Typography>
          </Box>
        </Box>

        {canReview ? (
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button
              onClick={() => setCorrectionOpen(true)}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 3, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
            >
              แจ้งให้แก้ไข
            </Button>
            <Button
              variant="contained"
              onClick={() => setView('checklist')}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 3, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
            >
              บันทึกข้อมูล
            </Button>
          </Box>
        ) : (
          <Chip label={statusMap[selected.status].label} sx={{ bgcolor: statusMap[selected.status].bg, color: statusMap[selected.status].color, fontWeight: 600 }} />
        )}

        <Dialog open={correctionOpen} onClose={() => setCorrectionOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>แจ้งให้แก้ไขข้อมูล</Typography>
              <IconButton size="small" onClick={() => setCorrectionOpen(false)}><CloseOutlinedIcon /></IconButton>
            </Box>
            <TextField
              label="สิ่งที่ต้องการให้แก้ไข"
              value={correctionComment}
              onChange={(e) => setCorrectionComment(e.target.value)}
              placeholder="ระบุรายละเอียดที่ต้องการให้ผู้สมัครแก้ไข"
              fullWidth
              multiline
              minRows={3}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              disabled={submitting}
              onClick={() => void submitCorrectionRequest()}
              sx={{ height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              ส่งคำขอ
            </Button>
          </Box>
        </Dialog>
      </Box>
    )
  }

  if (view === 'checklist' && selected) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 3 }}>
          ตรวจสอบข้อมูล
        </Typography>

        <ErrorAlert message={actionError} />

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {['ข้อมูลส่วนตัว', 'ข้อมูลติดต่อ', 'เอกสารแนบ'].map((label) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CheckCircleIcon sx={{ color: '#2E7D32' }} />
                <Typography sx={{ fontSize: 15, color: colors.navy }}>{label}</Typography>
              </Box>
              <Typography sx={{ fontSize: 14, color: '#697077' }}>ครบถ้วน</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ bgcolor: '#EAF7EA', border: '1px solid #C7E8C9', borderRadius: 3, p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <CheckCircleIcon sx={{ color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, color: '#217829' }}>ข้อมูลครบถ้วน พร้อมบันทึก</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            onClick={() => setView('detail')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
          >
            แก้ไขข้อมูล
          </Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={() => void confirmSave()}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
          >
            {submitting ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
          </Button>
        </Box>

        <Dialog open={successOpen} onClose={closeSuccess} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <DescriptionOutlinedIcon sx={{ fontSize: 72, color: colors.navy }} />
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mt: 2 }}>ส่งให้เจ้าหน้าที่ตรวจสอบเรียบร้อย</Typography>
            <Typography sx={{ fontSize: 14, color: '#697077', mt: 0.5, mb: 3 }}>กำลังรอเจ้าหน้าที่ตรวจสอบข้อมูล</Typography>
            <Button
              onClick={closeSuccess}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 4, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
            >
              ปิด
            </Button>
          </Box>
        </Dialog>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 3 }}>
        ใบสมัครงานที่ได้รับ
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="ค้นหานักศึกษา หรือ ตำแหน่ง.."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
        />
        <Button
          variant="outlined"
          startIcon={<TuneOutlinedIcon />}
          sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, borderColor: '#C4C4C4', px: 3, flexShrink: 0 }}
        >
          ตัวกรอง
        </Button>
      </Box>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 130px 140px 60px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['รหัสใบสมัคร', 'นักศึกษา', 'ตำแหน่งงาน', 'วันที่สมัคร', 'สถานะ', ''].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filtered.map((app, index) => {
            const status = statusMap[app.status]
            return (
              <Box
                key={app.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 1fr 130px 140px 60px',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.75,
                  borderTop: index > 0 ? `1px solid ${colors.border}` : 'none',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{applicationCode(app.id)}</Typography>
                <Typography sx={{ fontSize: 14, color: colors.navy }}>{app.student_name || 'ไม่ระบุชื่อ'}</Typography>
                <Typography sx={{ fontSize: 14, color: '#52545C' }}>{app.position}</Typography>
                <Typography sx={{ fontSize: 13, color: '#697077' }}>{new Date(app.apply_date).toLocaleDateString('th-TH')}</Typography>
                <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, width: 'fit-content' }} />
                <IconButton size="small" onClick={() => openDetail(app)} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
                  <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                </IconButton>
              </Box>
            )
          })}
          {filtered.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ยังไม่มีใบสมัครงาน</Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ fontSize: 14, color: '#697077' }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy, textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}

export default function ApplicationsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerApplicationsView /> : <StudentApplicationsView />
}
