import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { usePageTitle } from '../../../components/usePageTitle'
import { ErrorAlert } from '../../../components/ErrorAlert'
import { useAuth } from '../../../auth/useAuth'
import { ApiError } from '../../../services/https'
import { getAdminApplicationDetail, listAdminApplications, verifyApplication } from '../../../services/https/applications'
import type { AdminApplication, AdminApplicationReviewStatus } from '../../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

const statusMap: Record<AdminApplicationReviewStatus, { label: string; color: string; bg: string }> = {
  awaiting: { label: 'กำลังตรวจสอบ', color: '#B5850C', bg: '#FFF6E0' },
  passed: { label: 'ผ่านการคัดเลือก', color: '#217829', bg: '#EAF7EA' },
  failed: { label: 'ไม่ผ่านการคัดเลือก', color: '#DA1E28', bg: '#FDEAEA' },
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type View = 'list' | 'detail' | 'success'

export default function AdminApplicationVerificationPage() {
  usePageTitle('ตรวจสอบใบสมัคร')
  const { token } = useAuth()

  const [rows, setRows] = useState<AdminApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [lastResult, setLastResult] = useState<AdminApplication | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listAdminApplications(token!)
        if (!cancelled) setRows(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดข้อมูลไม่สำเร็จ')
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

  const filtered = rows.filter(
    (r) =>
      String(r.id).includes(search.toLowerCase()) ||
      r.student_name.toLowerCase().includes(search.toLowerCase()) ||
      r.position.toLowerCase().includes(search.toLowerCase()),
  )

  const selected = rows.find((r) => r.id === selectedId) ?? null

  async function openDetail(row: AdminApplication) {
    setSelectedId(row.id)
    setNote(row.comment)
    setActionError(null)
    setView('detail')
    if (!token) return
    try {
      const detail = await getAdminApplicationDetail(token, row.id)
      setRows((prev) => prev.map((r) => (r.id === detail.id ? detail : r)))
      setNote(detail.comment)
    } catch {
      // keep the row's already-loaded data if the refetch fails
    }
  }

  function backToList() {
    setView('list')
    setSelectedId(null)
    setNote('')
    setActionError(null)
  }

  async function submitResult(result: 'passed' | 'failed') {
    if (!token || !selected) return
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await verifyApplication(token, selected.id, { result_status: result, comment: note.trim() })
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setLastResult(updated)
      setView('success')
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'บันทึกผลไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (view === 'detail' && selected) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={backToList} sx={{ textTransform: 'none', color: '#045BE4', px: 0, mb: 1 }}>
          กลับ
        </Button>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 3 }}>
          ตรวจสอบใบสมัคร
        </Typography>

        <ErrorAlert message={actionError} />

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label="รหัสใบสมัคร" value={`APP-${String(selected.id).padStart(4, '0')}`} strong />
          <Row label="นักศึกษา" value={selected.student_name} />
          <Row label="ตำแหน่งงาน" value={`${selected.position} (${selected.company_name})`} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 14, color: '#697077' }}>สถานะ</Typography>
            <Chip label={statusMap[selected.review_status].label} size="small" sx={{ bgcolor: statusMap[selected.review_status].bg, color: statusMap[selected.review_status].color, fontWeight: 600 }} />
          </Box>
        </Box>

        <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 1 }}>หมายเหตุ</Typography>
        <TextField
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="บันทึกความคิดเห็น (ถ้ามี)"
          fullWidth
          multiline
          minRows={4}
          sx={{ mb: 3 }}
        />

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            disabled={submitting}
            onClick={() => void submitResult('failed')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, color: '#DA1E28', borderColor: '#DA1E28', '&:hover': { borderColor: '#B01319', bgcolor: '#FDEAEA' } }}
          >
            ไม่ผ่าน
          </Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={() => void submitResult('passed')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
          >
            ผ่าน
          </Button>
        </Box>
      </Box>
    )
  }

  if (view === 'success' && lastResult) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', textAlign: 'center', pt: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 96, color: '#2E7D32' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy, mt: 2, mb: 3 }}>บันทึกผลการตรวจสอบเรียบร้อย</Typography>

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 3, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label="รหัสใบสมัคร" value={`APP-${String(lastResult.id).padStart(4, '0')}`} strong />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 14, color: '#697077' }}>ผลการตรวจสอบ</Typography>
            <Chip label={statusMap[lastResult.review_status].label} size="small" sx={{ bgcolor: statusMap[lastResult.review_status].bg, color: statusMap[lastResult.review_status].color, fontWeight: 600 }} />
          </Box>
          <Row label="วันที่ตรวจสอบ" value={lastResult.checked_at ? formatDateTime(lastResult.checked_at) : '-'} />
        </Box>

        <Button
          onClick={backToList}
          sx={{ borderRadius: '40px', textTransform: 'none', px: 4, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
        >
          กลับหน้ารายการ
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 26, color: colors.navy, mb: 0.5 }}>ตรวจสอบใบสมัคร</Typography>
      <Typography sx={{ fontSize: 13, color: '#697077', mb: 3 }}>ตรวจสอบและยืนยันผลใบสมัครงานที่ผ่านการอนุมัติจากผู้ประกอบการแล้ว</Typography>

      <TextField
        placeholder="ค้นหารหัสใบสมัคร นักศึกษา หรือ ตำแหน่งงาน.."
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 150px 56px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['รหัสใบสมัคร', 'นักศึกษา', 'ตำแหน่งงาน', 'สถานะ', ''].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filtered.map((r, index) => (
            <Box
              key={r.id}
              onClick={() => void openDetail(r)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr 1fr 150px 56px',
                alignItems: 'center',
                px: 2.5,
                py: 1.75,
                borderTop: index > 0 ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#FAFBFC' },
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{`APP-${String(r.id).padStart(4, '0')}`}</Typography>
              <Typography sx={{ fontSize: 14, color: colors.navy }}>{r.student_name}</Typography>
              <Typography sx={{ fontSize: 14, color: '#52545C' }}>{r.position}</Typography>
              <Chip label={statusMap[r.review_status].label} size="small" sx={{ bgcolor: statusMap[r.review_status].bg, color: statusMap[r.review_status].color, fontWeight: 600, width: 'fit-content' }} />
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); void openDetail(r) }} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
                <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
              </IconButton>
            </Box>
          ))}
          {filtered.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบใบสมัครที่ค้นหา</Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

function Row({ label, value, strong }: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ fontSize: 14, color: '#697077' }}>{label}</Typography>
      <Typography sx={{ fontSize: strong ? 16 : 14, fontWeight: 600, color: colors.navy, textAlign: 'right' }}>{value}</Typography>
    </Box>
  )
}
