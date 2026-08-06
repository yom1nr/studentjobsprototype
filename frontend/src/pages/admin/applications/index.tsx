import { useState } from 'react'
import { Box, Button, Chip, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { usePageTitle } from '../../../components/usePageTitle'

const colors = { navy: '#012150', border: '#DDE1E6' }

// Admin's final pass/fail check, distinct from the employer's own
// accept/reject on Application.status — mirrors the ApplicationAudit class
// (ResultStatus/Comment/CheckedAt) from the B6716493 class diagram. UI +
// mock data only, per project scope — no backend controller for this yet.
type AdminReviewStatus = 'awaiting' | 'passed' | 'failed'

type AdminApplicationRow = {
  id: number
  code: string
  studentName: string
  position: string
  companyName: string
  status: AdminReviewStatus
  note: string
  checkedAt: string | null
}

const statusMap: Record<AdminReviewStatus, { label: string; color: string; bg: string }> = {
  awaiting: { label: 'กำลังตรวจสอบ', color: '#B5850C', bg: '#FFF6E0' },
  passed: { label: 'ผ่านการคัดเลือก', color: '#217829', bg: '#EAF7EA' },
  failed: { label: 'ไม่ผ่านการคัดเลือก', color: '#DA1E28', bg: '#FDEAEA' },
}

const INITIAL_ROWS: AdminApplicationRow[] = [
  { id: 1, code: 'APP-2401-001', studentName: 'นาย กฤษฎา ใจดี', position: 'พนักงานเสิร์ฟ', companyName: 'ร้านกาแฟดีใจ', status: 'passed', note: '', checkedAt: '2026-05-26T11:30:00' },
  { id: 2, code: 'APP-2401-007', studentName: 'นางสาว พิมพ์ชนก แสนดี', position: 'แคชเชียร์', companyName: 'ร้านสะดวกซื้อ 24 ชม.', status: 'awaiting', note: '', checkedAt: null },
  { id: 3, code: 'APP-2401-011', studentName: 'นาย กิตติพงษ์ ใจดี', position: 'พนักงานเสิร์ฟ', companyName: 'ร้านอาหารตามสั่ง', status: 'awaiting', note: '', checkedAt: null },
  { id: 4, code: 'APP-2401-014', studentName: 'นางสาว สุนิสา ทองมาก', position: 'พนักงานคลังสินค้า', companyName: 'บริษัท ABC จำกัด', status: 'failed', note: 'เอกสารแนบไม่ครบถ้วน', checkedAt: '2026-05-25T09:10:00' },
]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type View = 'list' | 'detail' | 'success'

export default function AdminApplicationVerificationPage() {
  usePageTitle('ตรวจสอบใบสมัคร')

  const [rows, setRows] = useState(INITIAL_ROWS)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('list')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [lastResult, setLastResult] = useState<AdminReviewStatus>('passed')

  const filtered = rows.filter(
    (r) => r.code.toLowerCase().includes(search.toLowerCase()) || r.studentName.toLowerCase().includes(search.toLowerCase()) || r.position.toLowerCase().includes(search.toLowerCase()),
  )

  const selected = rows.find((r) => r.id === selectedId) ?? null

  function openDetail(row: AdminApplicationRow) {
    setSelectedId(row.id)
    setNote(row.note)
    setView('detail')
  }

  function backToList() {
    setView('list')
    setSelectedId(null)
    setNote('')
  }

  function submitResult(result: 'passed' | 'failed') {
    if (!selected) return
    const now = new Date().toISOString()
    setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, status: result, note: note.trim(), checkedAt: now } : r)))
    setLastResult(result)
    setView('success')
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

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label="รหัสใบสมัคร" value={selected.code} strong />
          <Row label="นักศึกษา" value={selected.studentName} />
          <Row label="ตำแหน่งงาน" value={`${selected.position} (${selected.companyName})`} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 14, color: '#697077' }}>สถานะ</Typography>
            <Chip label={statusMap[selected.status].label} size="small" sx={{ bgcolor: statusMap[selected.status].bg, color: statusMap[selected.status].color, fontWeight: 600 }} />
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
            onClick={() => submitResult('failed')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, color: '#DA1E28', borderColor: '#DA1E28', '&:hover': { borderColor: '#B01319', bgcolor: '#FDEAEA' } }}
          >
            ไม่ผ่าน
          </Button>
          <Button
            variant="contained"
            onClick={() => submitResult('passed')}
            sx={{ borderRadius: '40px', textTransform: 'none', px: 3, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
          >
            ผ่าน
          </Button>
        </Box>
      </Box>
    )
  }

  if (view === 'success' && selected) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', textAlign: 'center', pt: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 96, color: '#2E7D32' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy, mt: 2, mb: 3 }}>บันทึกผลการตรวจสอบเรียบร้อย</Typography>

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, mb: 3, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row label="รหัสใบสมัคร" value={selected.code} strong />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 14, color: '#697077' }}>ผลการตรวจสอบ</Typography>
            <Chip label={statusMap[lastResult].label} size="small" sx={{ bgcolor: statusMap[lastResult].bg, color: statusMap[lastResult].color, fontWeight: 600 }} />
          </Box>
          <Row label="วันที่ตรวจสอบ" value={selected.checkedAt ? formatDateTime(selected.checkedAt) : '-'} />
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

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 150px 56px', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
          {['รหัสใบสมัคร', 'นักศึกษา', 'ตำแหน่งงาน', 'สถานะ', ''].map((h) => (
            <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
          ))}
        </Box>
        {filtered.map((r, index) => (
          <Box
            key={r.id}
            onClick={() => openDetail(r)}
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
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.navy }}>{r.code}</Typography>
            <Typography sx={{ fontSize: 14, color: colors.navy }}>{r.studentName}</Typography>
            <Typography sx={{ fontSize: 14, color: '#52545C' }}>{r.position}</Typography>
            <Chip label={statusMap[r.status].label} size="small" sx={{ bgcolor: statusMap[r.status].bg, color: statusMap[r.status].color, fontWeight: 600, width: 'fit-content' }} />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDetail(r) }} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
              <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
            </IconButton>
          </Box>
        ))}
        {filtered.length === 0 && (
          <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบใบสมัครที่ค้นหา</Typography>
        )}
      </Box>
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
