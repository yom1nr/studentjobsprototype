import { useEffect, useState } from 'react'
import { Box, Button, Chip, Dialog, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import RoomOutlinedIcon from '@mui/icons-material/RoomOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'

const colors = {
  title: '#012150',
  body: '#000000',
  navy: '#000349',
  cardBorder: '#DDE1E6',
  ok: '#217829',
}

// Suranaree University of Technology, reference point for the on-site radius check.
const WORKPLACE = { lat: 14.8756, lng: 102.0246, name: 'มหาวิทยาลัยเทคโนโลยีสุรนารี' }
const RADIUS_METERS = 50

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function formatThaiDate(date: Date) {
  return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Simulated GPS fix: jitters around the workplace so the demo never depends on the
// tester's real device location (or a browser location-permission prompt) to be clickable.
function simulateNearbyPosition(center: { lat: number; lng: number }, maxMeters: number) {
  const angle = Math.random() * 2 * Math.PI
  const dist = Math.random() * maxMeters
  const dLat = (dist * Math.cos(angle)) / 111_320
  const dLng = (dist * Math.sin(angle)) / (111_320 * Math.cos((center.lat * Math.PI) / 180))
  return { lat: center.lat + dLat, lng: center.lng + dLng, accuracy: 8 + Math.random() * 8 }
}

function StudentTimeTrackingView() {
  usePageTitle('บันทึกเวลาเข้า-ออกงาน เพื่อคำนวณรายได้โดยอัตโนมัติ')
  const navigate = useNavigate()

  const [now, setNow] = useState(new Date())
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const acquire = setTimeout(() => setPosition(simulateNearbyPosition(WORKPLACE, 20)), 900)
    const drift = setInterval(() => setPosition(simulateNearbyPosition(WORKPLACE, 20)), 6000)
    return () => {
      clearTimeout(acquire)
      clearInterval(drift)
    }
  }, [])

  const distance = position ? haversineMeters(position, WORKPLACE) : null
  const withinRadius = distance !== null && distance <= RADIUS_METERS

  const timeParts = now.toLocaleTimeString('en-GB', { hour12: false }).split(':')
  const clockColor = checkedIn ? colors.ok : colors.navy
  const mapLat = position?.lat ?? WORKPLACE.lat
  const mapLng = position?.lng ?? WORKPLACE.lng

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 4 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: { xs: 28, md: 36 }, color: colors.title, lineHeight: 1.1 }}>
              บันทึกเวลาทำงาน
            </Typography>
            <Button
              size="small"
              startIcon={<ReportProblemOutlinedIcon fontSize="small" />}
              onClick={() => navigate('/complaints')}
              sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: '#EFF6FF', color: colors.navy, px: 2 }}
            >
              แจ้งปัญหา / ร้องเรียน
            </Button>
          </Box>
          <Typography sx={{ fontSize: 14, color: colors.body, mt: 1 }}>
            บันทึกเวลาเข้า-ออกงาน พร้อมระบุพิกัด GPS เพื่อความแม่นยำ
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<HistoryOutlinedIcon />}
          onClick={() => navigate('/payroll')}
          sx={{
            borderRadius: '40px',
            textTransform: 'none',
            color: colors.navy,
            borderColor: colors.navy,
            px: 2,
            py: 1.2,
          }}
        >
          ประวัติการลงเวลา
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Clock / check-in card */}
        <Box
          sx={{
            bgcolor: '#FFFFFF',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 3,
            p: { xs: 3, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: 18, color: colors.body }}>{formatThaiDate(now)}</Typography>

          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: { xs: 56, md: 88 }, color: clockColor, lineHeight: 1.1 }}>
            {timeParts[0]}:{timeParts[1]}
            <Box component="span" sx={{ fontSize: { xs: 26, md: 40 }, fontWeight: 400, color: '#52545C' }}>
              :{timeParts[2]}
            </Box>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RoomOutlinedIcon sx={{ color: colors.ok }} fontSize="small" />
            <Typography sx={{ fontWeight: 600, fontSize: 16, color: colors.ok }}>{WORKPLACE.name}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleOutlineIcon fontSize="small" sx={{ color: withinRadius ? colors.ok : '#9AA0A6' }} />
            <Typography sx={{ fontSize: 12, color: '#353537' }}>
              {distance === null
                ? 'กำลังตรวจสอบตำแหน่ง...'
                : withinRadius
                  ? `อยู่ในรัศมีสถานที่ทำงาน (${RADIUS_METERS} เมตร)`
                  : `อยู่นอกรัศมีสถานที่ทำงาน (ห่าง ${Math.round(distance)} เมตร)`}
            </Typography>
          </Box>

          {checkedIn ? (
            <Box sx={{ width: '100%', mt: 1 }}>
              <Button
                variant="contained"
                startIcon={<LoginOutlinedIcon />}
                onClick={() => setCheckedIn(false)}
                sx={{ borderRadius: '14px', textTransform: 'none', fontWeight: 500, px: 3, py: 1.5, bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
              >
                บันทึกเวลาออกงาน (Check-out)
              </Button>
              <Typography sx={{ fontSize: 12, color: '#697077', mt: 1 }}>เช็คอินเรียบร้อยแล้ว</Typography>
            </Box>
          ) : (
            <Button
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              disabled={!withinRadius}
              onClick={() => setCheckedIn(true)}
              sx={{ mt: 1, borderRadius: '14px', textTransform: 'none', fontWeight: 500, px: 3, py: 1.5, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              บันทึกเวลาเข้างาน (Check-in)
            </Button>
          )}
        </Box>

        {/* Map / GPS status card */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box
            sx={{
              position: 'relative',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 3,
              minHeight: 320,
              overflow: 'hidden',
            }}
          >
            <Box
              component="iframe"
              title="แผนที่ตำแหน่งปัจจุบัน"
              src={`https://maps.google.com/maps?q=${mapLat},${mapLng}&z=16&output=embed`}
              sx={{ width: '100%', height: '100%', minHeight: 320, border: 0, display: 'block' }}
              loading="lazy"
            />

            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: '#FFFFFF',
                borderRadius: '40px',
                boxShadow: '0px 4px 25px 0px rgba(0,0,0,0.25)',
                px: 2,
                py: 1,
              }}
            >
              <Typography sx={{ fontSize: 14, color: '#1A1A1A' }}>
                {position ? `${mapLat.toFixed(4)}° N, ${mapLng.toFixed(4)}° E` : 'กำลังค้นหาพิกัด GPS...'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 500, fontSize: 16, color: colors.body }}>สถานะสัญญาณ GPS</Typography>
            <Typography sx={{ fontSize: 15, color: '#52565F', mb: 1 }}>
              อัปเดตล่าสุด: {position ? now.toLocaleTimeString('th-TH') : 'เมื่อกี้'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colors.ok }} />
              <Typography sx={{ fontWeight: 500, fontSize: 20, color: colors.ok }}>
                {position ? `ใช้งานได้ · แม่นยำ ±${Math.round(position.accuracy)} ม.` : 'กำลังเชื่อมต่อ...'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ─── Employer: time-edit request approval ──────────────────────────────────

type TimeEditStatus = 'pending' | 'approved' | 'rejected'

type TimeEditRequestMock = {
  id: number
  studentName: string
  requestDate: string
  oldTime: string
  newTime: string
  reason: string
  submittedAt: string
  status: TimeEditStatus
}

const INITIAL_TIME_EDIT_REQUESTS: TimeEditRequestMock[] = [
  {
    id: 1,
    studentName: 'นายอ้วน อาชัน',
    requestDate: '15 ก.ค. 2569',
    oldTime: '10:00 - 12:30 น.',
    newTime: '09:30 - 13:00 น.',
    reason: 'ลืมเช็คอิน เนื่องจากระบบขึ้น Error ตอนเข้า ขอแนบ Screenshot ประกอบ',
    submittedAt: '22 ก.ค. 2569, 14:23 น.',
    status: 'pending',
  },
  {
    id: 2,
    studentName: 'นายอ้วน ชิโป้',
    requestDate: '16 ก.ค. 2569',
    oldTime: '13:00 - 17:00 น.',
    newTime: '13:00 - 18:00 น.',
    reason: 'ทำงานล่วงเวลาแต่ลืมกดออกงาน กะกลับดึกกว่าปกติ',
    submittedAt: '22 ก.ค. 2569, 15:10 น.',
    status: 'pending',
  },
  {
    id: 3,
    studentName: 'นายฟิล์ม จั๋ง',
    requestDate: '10 ก.ค. 2569',
    oldTime: '09:00 - 17:00 น.',
    newTime: '09:00 - 18:00 น.',
    reason: 'เวลาออกงานผิดพลาด โปรดตรวจสอบบันทึกกล้องวงจรปิด',
    submittedAt: '18 ก.ค. 2569, 09:05 น.',
    status: 'approved',
  },
]

const timeEditStatusChip: Record<TimeEditStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'รอพิจารณา', color: '#B5850C', bg: '#FFF6E0' },
  approved: { label: 'อนุมัติแล้ว', color: '#217829', bg: '#EAF7EA' },
  rejected: { label: 'ไม่อนุมัติ', color: '#DA1E28', bg: '#FDEAEA' },
}

function EmployerTimeApprovalView() {
  usePageTitle('อนุมัติคำร้องแก้ไขเวลา')
  const navigate = useNavigate()

  const [requests, setRequests] = useState<TimeEditRequestMock[]>(INITIAL_TIME_EDIT_REQUESTS)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<TimeEditRequestMock | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const pendingList = requests.filter((r) => r.status === 'pending')
  const historyList = requests
    .filter((r) => r.status !== 'pending')
    .filter((r) => r.studentName.toLowerCase().includes(search.toLowerCase()))

  function approve(id: number) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)))
    setSelected(null)
  }

  function confirmReject() {
    if (!selected) return
    setRequests((prev) => prev.map((r) => (r.id === selected.id ? { ...r, status: 'rejected' } : r)))
    setRejecting(false)
    setRejectReason('')
    setSelected(null)
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <IconButton
        onClick={() => navigate('/profile')}
        sx={{ bgcolor: '#EFF6FF', color: colors.navy, borderRadius: 2, mb: 1.5 }}
      >
        <UndoOutlinedIcon />
      </IconButton>

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.title }}>
        อนุมัติคำร้องแก้ไขเวลา
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>
        ตรวจสอบและดำเนินการคำร้องที่นักศึกษายื่นขอแก้ไข
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 3, p: 2.5, minWidth: 160 }}>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>รอพิจารณา</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#B5850C' }}>{pendingCount}</Typography>
        </Box>
        <Box sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 3, p: 2.5, minWidth: 160 }}>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>อนุมัติแล้ว</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: colors.ok }}>{approvedCount}</Typography>
        </Box>
        <Box sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 3, p: 2.5, minWidth: 160 }}>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>ไม่อนุมัติ</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#DA1E28' }}>{rejectedCount}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            onClick={() => setTab('pending')}
            sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'pending' ? colors.navy : '#F0F0F0', color: tab === 'pending' ? '#fff' : colors.navy }}
          >
            รอพิจารณา
          </Button>
          <Button
            onClick={() => setTab('history')}
            sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'history' ? colors.navy : '#F0F0F0', color: tab === 'history' ? '#fff' : colors.navy }}
          >
            ประวัติการพิจารณา
          </Button>
        </Box>
        {tab === 'history' && (
          <TextField
            placeholder="Search"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
          />
        )}
      </Box>

      {tab === 'pending' && (
        <Box sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 3, overflow: 'hidden' }}>
          {pendingList.map((r, index) => (
            <Box
              key={r.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                px: 2.5,
                py: 2,
                borderTop: index > 0 ? `1px solid ${colors.cardBorder}` : 'none',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#F7FAFF' },
              }}
              onClick={() => setSelected(r)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: colors.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {r.studentName.replace('นาย', '').charAt(0)}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: 15, color: colors.title }}>{r.studentName}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>ขอแก้ไขวันที่ {r.requestDate}</Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                onClick={(e) => { e.stopPropagation(); approve(r.id) }}
                sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.ok, px: 2.5, '&:hover': { bgcolor: '#1B5F21' } }}
              >
                อนุมัติ
              </Button>
            </Box>
          ))}
          {pendingList.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่มีคำร้องรอพิจารณา</Typography>
          )}
        </Box>
      )}

      {tab === 'history' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {historyList.map((r) => {
            const status = timeEditStatusChip[r.status]
            return (
              <Box key={r.id} sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 3, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setSelected(r)}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, color: colors.title }}>{r.studentName}</Typography>
                  <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.25 }}>
                  {['วันที่ขอแก้', 'เวลาเดิม', 'เวลาใหม่ที่ขอ'].map((h) => (
                    <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
                  ))}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', px: 2.5, py: 1.5 }}>
                  <Typography sx={{ fontSize: 14 }}>{r.requestDate}</Typography>
                  <Typography sx={{ fontSize: 14 }}>{r.oldTime}</Typography>
                  <Typography sx={{ fontSize: 14 }}>{r.newTime}</Typography>
                </Box>
                <Box sx={{ px: 2.5, pb: 2 }}>
                  <Box sx={{ border: `1px solid ${colors.cardBorder}`, borderRadius: 2, p: 1.5 }}>
                    <Typography sx={{ fontSize: 13, color: '#52545C' }}>เหตุผล: {r.reason}</Typography>
                  </Box>
                </Box>
              </Box>
            )
          })}
          {historyList.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบประวัติการพิจารณา</Typography>
          )}
        </Box>
      )}

      {/* Detail modal */}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4 } } }}
      >
        {selected && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.title }}>รายละเอียดคำร้องขอแก้ไขเวลาทำงาน</Typography>
              <IconButton size="small" onClick={() => setSelected(null)}><CloseOutlinedIcon /></IconButton>
            </Box>

            <Box sx={{ bgcolor: '#EFF6FF', borderRadius: 2, px: 2, py: 1.5, mb: 2 }}>
              <Typography sx={{ fontWeight: 700, color: colors.navy }}>{selected.studentName}</Typography>
            </Box>

            <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.title, mb: 1 }}>เวลาเดิมในระบบ</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <Box sx={{ flex: 1, border: `1px solid ${colors.cardBorder}`, borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: '#9AA0A6' }}>เวลาเดิม</Typography>
                  <Typography sx={{ fontSize: 14 }}>{selected.oldTime}</Typography>
                </Box>
                <AccessTimeOutlinedIcon fontSize="small" sx={{ color: '#9AA0A6' }} />
              </Box>
              <Box sx={{ flex: 1, border: `1px solid ${colors.cardBorder}`, borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: '#9AA0A6' }}>เวลาใหม่ที่ขอ</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{selected.newTime}</Typography>
                </Box>
                <AccessTimeOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
              </Box>
            </Box>

            <Box sx={{ bgcolor: '#FCEFD9', borderRadius: 2, p: 2, mb: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#7A5B12', mb: 0.5 }}>เหตุผลที่นักศึกษาระบุ</Typography>
              <Typography sx={{ fontSize: 13, color: '#52422A' }}>{selected.reason}</Typography>
            </Box>

            <Typography sx={{ fontSize: 12, color: '#9AA0A6', mb: 2 }}>ยื่นคำร้องเมื่อ: {selected.submittedAt}</Typography>

            {selected.status === 'pending' ? (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setRejecting(true)}
                  sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
                >
                  ไม่อนุมัติ
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => approve(selected.id)}
                  sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.ok, '&:hover': { bgcolor: '#1B5F21' } }}
                >
                  อนุมัติ
                </Button>
              </Box>
            ) : (
              <Chip
                label={timeEditStatusChip[selected.status].label}
                sx={{ bgcolor: timeEditStatusChip[selected.status].bg, color: timeEditStatusChip[selected.status].color, fontWeight: 600, width: '100%', height: 40 }}
              />
            )}
          </Box>
        )}
      </Dialog>

      {/* Reject-with-reason confirm dialog */}
      <Dialog open={rejecting} onClose={() => setRejecting(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#DA1E28' }}>ยืนยันการไม่อนุมัติ</Typography>
            <IconButton size="small" onClick={() => setRejecting(false)}><CloseOutlinedIcon /></IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, bgcolor: '#FDEAEA', borderRadius: 2, p: 1.5, mb: 2 }}>
            <WarningAmberOutlinedIcon fontSize="small" sx={{ color: '#DA1E28', mt: 0.2 }} />
            <Typography sx={{ fontSize: 13, color: '#8A1418' }}>
              การไม่อนุมัติจะส่งการแจ้งเตือนให้นักศึกษาทราบและระบบจะคงเวลาเดิมไว้
            </Typography>
          </Box>

          <TextField
            label="เหตุผลการไม่อนุมัติ"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="ระบุเหตุผลเพื่อแจ้งให้นักศึกษาทราบ"
            fullWidth
            multiline
            minRows={3}
            sx={{ mb: 2 }}
          />

          <Button
            fullWidth
            variant="contained"
            disabled={rejectReason.trim().length === 0}
            onClick={confirmReject}
            sx={{ height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
          >
            ยืนยันการไม่อนุมัติ
          </Button>
          <Button fullWidth onClick={() => setRejecting(false)} sx={{ mt: 1, textTransform: 'none', color: '#697077' }}>
            ยกเลิก
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}

export default function TimeTrackingPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerTimeApprovalView /> : <StudentTimeTrackingView />
}
