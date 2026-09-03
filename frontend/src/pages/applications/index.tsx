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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError, getApiBaseUrl } from '../../services/https'
import { UploadCard } from '../../components/UploadCard'
import { deleteApplication, listEmployerApplications, listMyApplications, reviewApplication, updateMyApplication } from '../../services/https/applications'
import type { Application, ApplicationAuditEntry, ApplicationDocument } from '../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

const statusMap: Record<Application['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'รอพิจารณา', color: '#B5850C', bg: '#FFF6E0' },
  correction_requested: { label: 'ต้องแก้ไข', color: '#C2410C', bg: '#FFEDD5' },
  accepted: { label: 'ผ่านการพิจารณา', color: '#217829', bg: '#EAF7EA' },
  rejected: { label: 'ไม่ผ่านการพิจารณา', color: '#DA1E28', bg: '#FDEAEA' },
}

const AUDIT_LABEL: Record<ApplicationAuditEntry['result_status'], string> = {
  correction_requested: 'ผู้ประกอบการขอให้แก้ไข',
  resubmitted: 'นักศึกษาส่งข้อมูลเพิ่มเติม',
  accepted: 'ผู้ประกอบการตอบรับ',
  rejected: 'ผู้ประกอบการไม่รับ',
  passed: 'เจ้าหน้าที่อนุมัติ',
  failed: 'เจ้าหน้าที่ไม่อนุมัติ',
}

function AuditHistory({ audits }: { audits: ApplicationAuditEntry[] }) {
  if (!audits || audits.length === 0) return null
  return (
    <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 3 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 1.5 }}>ประวัติการพิจารณา</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {audits.map((a, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#B9C6DC', mt: '7px', flex: 'none' }} />
            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>
                {AUDIT_LABEL[a.result_status] ?? a.result_status}
                <Typography component="span" sx={{ fontSize: 12, fontWeight: 400, color: '#9AA0A6', ml: 1 }}>
                  {a.checked_at ? new Date(a.checked_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                </Typography>
              </Typography>
              {a.comment && <Typography sx={{ fontSize: 13, color: '#52545C', whiteSpace: 'pre-wrap' }}>{a.comment}</Typography>}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function DocumentList({ documents }: { documents: ApplicationDocument[] }) {
  if (!documents || documents.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: '#9AA0A6' }}>
        <InsertDriveFileOutlinedIcon sx={{ color: '#C4C4C4' }} />
        <Typography sx={{ fontSize: 13 }}>ยังไม่มีเอกสารแนบ</Typography>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {documents.map((d, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InsertDriveFileOutlinedIcon sx={{ color: colors.navy }} />
          <Typography
            component="a"
            href={`${getApiBaseUrl()}${d.url}`}
            target="_blank"
            rel="noreferrer"
            sx={{ fontSize: 13, color: '#045BE4', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            {d.name}
          </Typography>
        </Box>
      ))}
    </Box>
  )
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
  const [reloadToken, setReloadToken] = useState(0)

  const [selected, setSelected] = useState<Application | null>(null)
  const [remarksDraft, setRemarksDraft] = useState('')
  const [docsDraft, setDocsDraft] = useState<ApplicationDocument[]>([])
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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
  }, [token, reloadToken])

  function openDetail(app: Application) {
    setSelected(app)
    setRemarksDraft(app.remarks ?? '')
    setDocsDraft(app.documents ?? [])
    setActionError(null)
  }

  async function handleResubmit() {
    if (!token || !selected) return
    setSaving(true)
    setActionError(null)
    try {
      await updateMyApplication(token, selected.id, { remarks: remarksDraft.trim(), documents: docsDraft })
      setSelected(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ส่งข้อมูลไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const filtered = applications.filter(
    (a) => a.position.toLowerCase().includes(search.toLowerCase()) || a.company_name.toLowerCase().includes(search.toLowerCase()),
  )

  const editable = selected != null && (selected.status === 'pending' || selected.status === 'correction_requested')

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
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 140px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['ตำแหน่งงาน', 'บริษัท', 'วันที่สมัคร', 'สถานะ'].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filtered.map((app, index) => {
            const status = statusMap[app.status]
            const needsAction = app.status === 'correction_requested'
            return (
              <Box
                key={app.id}
                onClick={() => openDetail(app)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 130px 140px',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.75,
                  cursor: 'pointer',
                  borderTop: index > 0 ? `1px solid ${colors.border}` : 'none',
                  '&:hover': { bgcolor: '#F7F9FC' },
                }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{app.position}</Typography>
                <Typography sx={{ fontSize: 13, color: '#52545C' }}>{app.company_name}</Typography>
                <Typography sx={{ fontSize: 13, color: '#697077' }}>{new Date(app.apply_date).toLocaleDateString('th-TH')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600, width: 'fit-content' }} />
                  {needsAction && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#F97316' }} />}
                </Box>
              </Box>
            )
          })}
          {filtered.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบใบสมัครที่ค้นหา</Typography>
          )}
        </Box>
      )}

      <Dialog open={selected != null} onClose={() => setSelected(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {selected && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{selected.position}</Typography>
                <Typography sx={{ fontSize: 13, color: '#697077' }}>{selected.company_name}</Typography>
              </Box>
              <IconButton size="small" onClick={() => setSelected(null)}><CloseOutlinedIcon /></IconButton>
            </Box>

            <Chip
              label={statusMap[selected.status].label}
              size="small"
              sx={{ bgcolor: statusMap[selected.status].bg, color: statusMap[selected.status].color, fontWeight: 600, mb: 2 }}
            />

            {selected.status === 'correction_requested' && (
              <Alert severity="warning" sx={{ mb: 2, fontSize: 13 }}>
                ผู้ประกอบการขอให้แก้ไข/ส่งข้อมูลเพิ่มเติม — ปรับหมายเหตุและแนบเอกสารด้านล่าง แล้วกด "ส่งข้อมูลเพิ่มเติม"
              </Alert>
            )}

            <AuditHistory audits={selected.audits} />

            <ErrorAlert message={actionError} />

            <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 0.75 }}>หมายเหตุ / ข้อมูลเพิ่มเติม</Typography>
            <TextField
              value={remarksDraft}
              onChange={(e) => setRemarksDraft(e.target.value)}
              placeholder="ระบุข้อมูลเพิ่มเติมถึงผู้ประกอบการ"
              fullWidth
              multiline
              minRows={3}
              disabled={!editable}
              sx={{ mb: 2 }}
            />

            <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 0.75 }}>เอกสารแนบ</Typography>
            {docsDraft.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: editable ? 1.5 : 0 }}>
                {docsDraft.map((d, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InsertDriveFileOutlinedIcon sx={{ color: colors.navy, fontSize: 20 }} />
                    <Typography
                      component="a"
                      href={`${getApiBaseUrl()}${d.url}`}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ flex: 1, fontSize: 13, color: '#045BE4', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {d.name}
                    </Typography>
                    {editable && (
                      <IconButton size="small" onClick={() => setDocsDraft((ds) => ds.filter((_, j) => j !== i))}>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: '#DA1E28' }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>
            )}
            {editable ? (
              <UploadCard
                label=""
                onUpload={(url, name) => setDocsDraft((ds) => [...ds, { url, name: name || url.split('/').pop() || 'เอกสาร' }])}
              />
            ) : (
              docsDraft.length === 0 && <Typography sx={{ fontSize: 13, color: '#9AA0A6' }}>ไม่มีเอกสารแนบ</Typography>
            )}

            {editable ? (
              <Button
                fullWidth
                variant="contained"
                disabled={saving}
                onClick={() => void handleResubmit()}
                sx={{ mt: 2.5, height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
              >
                {saving ? 'กำลังส่ง…' : 'ส่งข้อมูลเพิ่มเติม'}
              </Button>
            ) : (
              <Typography sx={{ mt: 2, fontSize: 12, color: '#9AA0A6', textAlign: 'center' }}>
                ใบสมัครนี้ดำเนินการแล้ว แก้ไขไม่ได้
              </Typography>
            )}
          </Box>
        )}
      </Dialog>
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
  // Which decision the success dialog should report — the review screen offers
  // both outcomes, so the confirmation has to match what was actually saved.
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  async function submitReview(resultStatus: 'accepted' | 'rejected', comment?: string) {
    if (!token || !selected) return
    setSubmitting(true)
    setActionError(null)
    try {
      await reviewApplication(token, selected.id, { result_status: resultStatus, comment })
      setDecision(resultStatus)
      setRejectOpen(false)
      setRejectReason('')
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

  async function handleDelete() {
    if (!token || !deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      await deleteApplication(token, deleteTarget.id)
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ลบใบสมัครไม่สำเร็จ')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
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
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 1.5 }}>เอกสารแนบจากผู้สมัคร</Typography>
          <DocumentList documents={selected.documents} />
        </Box>

        <AuditHistory audits={selected.audits} />

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
              พิจารณาใบสมัคร
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
          สรุปผลการพิจารณาใบสมัคร
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

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>ผลการพิจารณาใบสมัคร</Typography>
          <Typography sx={{ fontSize: 13, color: '#697077', mb: 2.5 }}>
            เลือกผลการพิจารณาของ {selected.student_name || 'ผู้สมัครรายนี้'} — ถ้าผ่าน รายชื่อจะไปอยู่ในกลุ่ม
            &quot;ยังไม่นัดสัมภาษณ์&quot; ที่เมนู &quot;จัดการนัดหมายสัมภาษณ์&quot; เพื่อนัดหมายต่อไป
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              disabled={submitting}
              onClick={() => void submitReview('accepted')}
              startIcon={<CheckCircleIcon />}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 3, fontWeight: 600, bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
            >
              {submitting ? 'กำลังบันทึก…' : 'ผ่านการพิจารณา'}
            </Button>
            <Button
              variant="outlined"
              disabled={submitting}
              onClick={() => { setRejectReason(''); setActionError(null); setRejectOpen(true) }}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 3, fontWeight: 600, color: '#DA1E28', borderColor: '#DA1E28' }}
            >
              ไม่ผ่านการพิจารณา
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            onClick={() => setView('detail')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
          >
            ย้อนกลับ
          </Button>
        </Box>

        <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>ไม่ผ่านการพิจารณา</Typography>
              <IconButton size="small" onClick={() => setRejectOpen(false)}><CloseOutlinedIcon /></IconButton>
            </Box>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 2 }}>
              ระบุเหตุผลเพื่อแจ้งให้ผู้สมัครทราบ — การบันทึกผลนี้ไม่สามารถย้อนกลับได้
            </Typography>
            <TextField
              label="เหตุผลที่ไม่ผ่านการพิจารณา"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="เช่น คุณสมบัติยังไม่ตรงกับตำแหน่งที่เปิดรับ"
              fullWidth
              multiline
              minRows={3}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              disabled={rejectReason.trim().length === 0 || submitting}
              onClick={() => void submitReview('rejected', rejectReason.trim())}
              sx={{ height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
            >
              {submitting ? 'กำลังบันทึก…' : 'ยืนยันผลไม่ผ่าน'}
            </Button>
          </Box>
        </Dialog>

        <Dialog open={successOpen} onClose={closeSuccess} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
          <Box sx={{ p: 4, textAlign: 'center' }}>
            {decision === 'accepted' ? (
              <CheckCircleIcon sx={{ fontSize: 72, color: '#2E7D32' }} />
            ) : (
              <DescriptionOutlinedIcon sx={{ fontSize: 72, color: '#9AA0A6' }} />
            )}
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mt: 2 }}>
              {decision === 'accepted' ? 'บันทึกผลผ่านการพิจารณาแล้ว' : 'บันทึกผลไม่ผ่านการพิจารณาแล้ว'}
            </Typography>
            <Typography sx={{ fontSize: 14, color: '#697077', mt: 0.5, mb: 3 }}>
              {decision === 'accepted'
                ? 'รายชื่อผู้สมัครไปอยู่ในกลุ่ม "ยังไม่นัดสัมภาษณ์" ที่เมนู "จัดการนัดหมายสัมภาษณ์" แล้ว'
                : 'ระบบแจ้งผลให้ผู้สมัครทราบเรียบร้อยแล้ว'}
            </Typography>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 130px 140px 110px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
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
                  gridTemplateColumns: '130px 1fr 1fr 130px 140px 110px',
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
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton size="small" title="ดูรายละเอียด" onClick={() => openDetail(app)} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
                    <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                  </IconButton>
                  <IconButton size="small" title="ลบใบสมัคร" onClick={() => setDeleteTarget(app)} sx={{ border: '1px solid #F3C2C4', borderRadius: 1.5 }}>
                    <DeleteOutlineIcon fontSize="small" sx={{ color: '#DA1E28' }} />
                  </IconButton>
                </Box>
              </Box>
            )
          })}
          {filtered.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ยังไม่มีใบสมัครงาน</Typography>
          )}
        </Box>
      )}

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mb: 1 }}>ลบใบสมัครนี้?</Typography>
          <Typography sx={{ fontSize: 14, color: '#52545C', mb: 1.5 }}>
            {deleteTarget ? `${applicationCode(deleteTarget.id)} — ${deleteTarget.student_name || 'ไม่ระบุชื่อ'} (${deleteTarget.position})` : ''}
          </Typography>
          <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mb: 2.5 }}>
            ประวัติการพิจารณา และนัดสัมภาษณ์ของใบสมัครนี้ จะถูกลบไปด้วย — ย้อนกลับไม่ได้
            <br />
            ถ้าแค่ไม่รับผู้สมัครคนนี้ ให้เลือก &quot;ไม่ผ่านการพิจารณา&quot; แทน เพื่อเก็บเป็นหลักฐาน
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', borderRadius: '40px', px: 3, color: colors.navy, bgcolor: '#F0F0F0' }}>
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              disabled={deleting}
              onClick={() => void handleDelete()}
              sx={{ textTransform: 'none', borderRadius: '40px', px: 3, bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
            >
              {deleting ? 'กำลังลบ…' : 'ลบใบสมัคร'}
            </Button>
          </Box>
        </Box>
      </Dialog>
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
