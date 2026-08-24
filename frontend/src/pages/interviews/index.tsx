import { useState } from 'react'
import { Box, Button, Chip, Dialog, IconButton, InputAdornment, TextField, Typography } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'

const colors = { navy: '#012150', border: '#DDE1E6', ok: '#217829' }

type Stage = 'awaiting_confirmation' | 'confirmed' | 'passed' | 'failed'
type View = 'list' | 'appointment' | 'result'

const interview = {
  code: 'IV-2569-014',
  position: 'Barista พาร์ทไทม์',
  company: 'ร้าน Café Doi',
  date: 'วันพฤหัสบดีที่ 24 ก.ค. 2569',
  time: '13:30 - 14:00 น.',
  format: 'สัมภาษณ์ ณ สถานที่',
  interviewer: 'คุณสมชาย (ผู้จัดการร้าน)',
  location: 'ร้าน Café Doi ชั้น 2 เลขที่ 99 ถ.มหาวิทยาลัย ต.สุรนารี อ.เมือง จ.นครราชสีมา',
  contactPhone: '044-000-000',
  preparation: ['บัตรประจำตัวนักศึกษา และบัตรประชาชน', 'สำเนาการลงเรียนภาคการศึกษาปัจจุบัน', 'มาถึงก่อนเวลานัด 10 นาที ที่จุดนัดพบ'],
}

function StepCard({
  step,
  title,
  subtitle,
  statusLabel,
  statusColor,
  statusBg,
  locked,
  actionColor,
  onAction,
}: Readonly<{
  step: number
  title: string
  subtitle: string
  statusLabel: string
  statusColor: string
  statusBg: string
  locked: boolean
  actionColor: string
  onAction: () => void
}>) {
  return (
    <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, opacity: locked ? 0.6 : 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: locked ? '#E0E0E0' : colors.navy,
              color: locked ? '#9AA0A6' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            {step}
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{title}</Typography>
            <Typography sx={{ fontSize: 13, color: '#9AA0A6' }}>{subtitle}</Typography>
          </Box>
        </Box>
        <Chip label={statusLabel} size="small" sx={{ bgcolor: statusBg, color: statusColor, fontWeight: 600 }} />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 2, p: 1.5 }}>
        <Typography sx={{ fontSize: 14, color: locked ? '#9AA0A6' : colors.navy }}>
          {locked ? subtitle : `${interview.position} — ${interview.company}`}
        </Typography>
        <Button
          disabled={locked}
          onClick={onAction}
          endIcon={<ArrowForwardIcon fontSize="small" />}
          size="small"
          sx={{ bgcolor: locked ? '#E0E0E0' : actionColor, color: locked ? '#9AA0A6' : '#fff', borderRadius: '20px', textTransform: 'none', px: 2 }}
        >
          รายละเอียด
        </Button>
      </Box>
    </Box>
  )
}

function StudentInterviewsView() {
  usePageTitle('ประกาศกำหนดการสัมภาษณ์ / ผลการสัมภาษณ์')

  const [stage, setStage] = useState<Stage>('awaiting_confirmation')
  const [view, setView] = useState<View>('list')

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleRequested, setRescheduleRequested] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')

  function submitReschedule() {
    setRescheduleRequested(true)
    setRescheduleOpen(false)
  }

  if (view === 'appointment') {
    return (
      <Box sx={{ maxWidth: 950, mx: 'auto' }}>
        <Button onClick={() => setView('list')} sx={{ textTransform: 'none', color: colors.navy, mb: 1, px: 0 }}>
          ← กลับ
        </Button>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>รายละเอียดนัดสัมภาษณ์</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>ตรวจสอบรายละเอียดนัดหมาย และยืนยันการเข้ารับสัมภาษณ์</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Chip label="รอการยืนยัน" size="small" sx={{ bgcolor: '#FFF0DD', color: '#B5850C', fontWeight: 600 }} />
              <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>นัดหมายเลขที่ {interview.code}</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>{interview.position}</Typography>
            <Typography sx={{ fontSize: 14, color: '#697077', mb: 2 }}>{interview.company}</Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderTop: `1px solid ${colors.border}`, pt: 2, mb: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EventOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>วันที่</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.date}</Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>เวลา</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.time}</Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PlaceOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>รูปแบบ</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.format}</Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonOutlineOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>ผู้สัมภาษณ์</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.interviewer}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <BusinessOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
              <Typography sx={{ fontSize: 12, color: '#697077' }}>สถานที่</Typography>
            </Box>
            <Typography sx={{ fontSize: 14, mb: 2 }}>{interview.location}</Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>สิ่งที่ต้องเตรียม</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.2, fontSize: 13, color: '#333' }}>
              {interview.preparation.map((p) => <li key={p}>{p}</li>)}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 1.5 }}>สถานที่นัดหมาย</Typography>
              <Box sx={{ borderRadius: 2, overflow: 'hidden', height: 140 }}>
                <Box
                  component="iframe"
                  title="แผนที่สถานที่นัดหมาย"
                  src="https://maps.google.com/maps?q=14.8756,102.0246&z=16&output=embed"
                  sx={{ width: '100%', height: '100%', border: 0 }}
                  loading="lazy"
                />
              </Box>
              <Typography sx={{ fontSize: 13, color: '#697077', mt: 1 }}>{interview.company} ชั้น 2 อาคารกิจกรรมนักศึกษา</Typography>
            </Box>

            <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 1 }}>ติดต่อผู้ประกอบการ</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.interviewer}</Typography>
              <Typography sx={{ fontSize: 13, color: '#697077' }}>โทร {interview.contactPhone}</Typography>
            </Box>

            {rescheduleRequested ? (
              <Chip
                label="ส่งคำขอเลื่อนนัดแล้ว รอผู้ประกอบการตอบรับ"
                sx={{ bgcolor: '#FFF0DD', color: '#B5850C', fontWeight: 600, height: 'auto', py: 1 }}
              />
            ) : (
              <Button
                variant="outlined"
                onClick={() => setRescheduleOpen(true)}
                sx={{ borderRadius: '40px', textTransform: 'none', color: colors.navy, borderColor: colors.border }}
              >
                ขอเลื่อน / เปลี่ยนนัด
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => { setStage('confirmed'); setView('list') }}
              sx={{ borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
            >
              ยืนยันเข้ารับสัมภาษณ์
            </Button>
          </Box>
        </Box>

        <Dialog open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
          <Box sx={{ p: 3.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>ขอเลื่อน / เปลี่ยนนัดสัมภาษณ์</Typography>
              <IconButton size="small" onClick={() => setRescheduleOpen(false)}><CloseOutlinedIcon /></IconButton>
            </Box>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 2 }}>
              นัดหมายเดิม: {interview.date} เวลา {interview.time}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="วันที่สะดวก"
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="เวลาที่สะดวก"
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <TextField
              label="เหตุผล"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="ระบุเหตุผลที่ขอเลื่อนนัด"
              fullWidth
              multiline
              minRows={3}
              sx={{ mb: 3 }}
            />
            <Button
              fullWidth
              variant="contained"
              disabled={!rescheduleDate || !rescheduleTime || rescheduleReason.trim().length === 0}
              onClick={submitReschedule}
              sx={{ height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              ส่งคำขอเลื่อนนัด
            </Button>
          </Box>
        </Dialog>
      </Box>
    )
  }

  if (view === 'result') {
    const passed = stage === 'passed'
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', textAlign: 'center', py: 6 }}>
        {passed ? (
          <CheckCircleOutlineIcon sx={{ fontSize: 120, color: colors.ok }} />
        ) : (
          <CancelOutlinedIcon sx={{ fontSize: 120, color: '#DA1E28' }} />
        )}
        <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy, mt: 2 }}>
          {passed ? 'ยินดีด้วย คุณผ่านการสัมภาษณ์' : 'ขอบคุณที่เข้าร่วมสัมภาษณ์'}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mt: 1 }}>
          ตำแหน่ง {interview.position}
          <br />
          {interview.company}
        </Typography>
        <Chip
          label={passed ? 'ผ่านการสัมภาษณ์' : 'ไม่ผ่านการสัมภาษณ์'}
          size="small"
          sx={{ mt: 2, bgcolor: passed ? '#EAF7EA' : '#FDEAEA', color: passed ? colors.ok : '#DA1E28', fontWeight: 600 }}
        />
        <Typography sx={{ fontSize: 14, color: '#697077', mt: 3 }}>
          {passed
            ? 'กรุณารอสัญญาข้อตกลงการจ้างงานครับ ขอบคุณครับ สามารถติดตามได้ที่เมนู "แจ้งผลการจ้างงาน"'
            : 'ขอบคุณสำหรับความสนใจ สามารถติดตามตำแหน่งงานอื่น ๆ ได้ที่เมนู "ค้นหางาน"'}
        </Typography>
        <Button onClick={() => setView('list')} sx={{ mt: 3, textTransform: 'none', color: colors.navy }}>← กลับ</Button>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 850, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <StepCard
        step={1}
        title="การนัดสัมภาษณ์"
        subtitle="กำหนดนัด ยืนยัน เลื่อน"
        statusLabel={stage === 'awaiting_confirmation' ? 'มีการนัดสัมภาษณ์' : 'สัมภาษณ์แล้ว'}
        statusColor={stage === 'awaiting_confirmation' ? '#B5850C' : '#697077'}
        statusBg={stage === 'awaiting_confirmation' ? '#FFF0DD' : '#F0F0F0'}
        locked={false}
        actionColor={colors.navy}
        onAction={() => setView('appointment')}
      />

      <StepCard
        step={2}
        title="ผลการสัมภาษณ์"
        subtitle="ผลการสัมภาษณ์"
        statusLabel={stage === 'confirmed' ? 'มีผลการสัมภาษณ์' : stage === 'awaiting_confirmation' ? 'ล็อกอยู่' : 'ดูผล'}
        statusColor={stage === 'confirmed' || stage === 'passed' || stage === 'failed' ? colors.ok : '#9AA0A6'}
        statusBg={stage === 'confirmed' || stage === 'passed' || stage === 'failed' ? '#EAF7EA' : '#F0F0F0'}
        locked={stage === 'awaiting_confirmation'}
        actionColor="#0090FF"
        onAction={() => { setStage('passed'); setView('result') }}
      />
    </Box>
  )
}

// ─────────────────────────── Employer side ───────────────────────────
// UI-only (local mock state, no service-layer calls) per B6733827's scope —
// matches design source B6733827/*ฝั่งผู้ประกอบการ*.png exactly (see
// t04_role_parity_audit memory). Backend models (InterviewSchedule,
// RescheduleInterview) already exist; no controller/route work was done here.

type ApplicantStage = 'new' | 'awaiting_confirm' | 'invited' | 'interviewed' | 'passed' | 'failed'

type EmployerApplicant = {
  id: number
  initial: string
  name: string
  position: string
  code: string
}

const employerApplicantStageChip: Record<ApplicantStage, { label: string; color: string; bg: string }> = {
  new: { label: 'สมัครใหม่', color: '#697077', bg: '#F0F0F0' },
  awaiting_confirm: { label: 'นัดแล้ว รอสัมภาษณ์', color: '#B5850C', bg: '#FFF0DD' },
  invited: { label: 'นัดสัมภาษณ์ใหม่', color: '#697077', bg: '#F0F0F0' },
  interviewed: { label: 'รอแจ้งผล', color: '#697077', bg: '#F0F0F0' },
  passed: { label: 'ตอบรับเข้าทำงาน', color: colors.ok, bg: '#EAF7EA' },
  failed: { label: 'ไม่ผ่านการสัมภาษณ์', color: '#DA1E28', bg: '#FDEAEA' },
}

const employerApplicants: EmployerApplicant[] = [
  { id: 1, initial: 'ก', name: 'นายกฤษฎา ใจดี', position: 'Barista พาร์กไทม์', code: 'B65xxxxx' },
  { id: 2, initial: 'ส', name: 'น.ส.สุดา รักเรียน', position: 'Barista พาร์กไทม์', code: 'B65yyyyy' },
  { id: 3, initial: 'ม', name: 'นายมานะ อดทน', position: 'ผู้ช่วยสอน', code: 'B65aaaaa' },
  { id: 4, initial: 'ธ', name: 'นายธนา มุ่งมั่น', position: 'Barista พาร์กไทม์', code: 'B65zzzzz' },
  { id: 5, initial: 'ว', name: 'น.ส.วิภา ตั้งใจ', position: 'ผู้ช่วยสอน', code: 'B64bbbbb' },
]

const initialApplicantStages: Record<number, ApplicantStage> = {
  1: 'new',
  2: 'awaiting_confirm',
  3: 'invited',
  4: 'interviewed',
  5: 'passed',
}

type EmployerSubview = 'picker' | 'hub' | 'schedule' | 'detail' | 'reschedule' | 'notifications' | 'results'

function GmailConfirmDialog({
  open,
  onClose,
  email,
  note,
  onBack,
}: Readonly<{ open: boolean; onClose: () => void; email: string; note: string; onBack: () => void }>) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <MailOutlineIcon sx={{ fontSize: 96, color: '#EA4335' }} />
        <Typography sx={{ fontSize: 14, color: '#333', mt: 2 }}>
          ยืนยันการส่งได้ทำการแจ้งเตือนไปที่
          <br />
          <Box component="span" sx={{ color: colors.navy, fontWeight: 600 }}>{email}</Box>
          <br />
          เรียบร้อยแล้วและทำการอัพเดตผลไปยังฝั่งนักศึกษาเรียบร้อย
        </Typography>
        <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mt: 2.5 }}>{note}</Box>
        <Button onClick={onBack} sx={{ mt: 2.5, textTransform: 'none', color: colors.navy }}>← ผู้สมัครคนถัดไป</Button>
      </Box>
    </Dialog>
  )
}

function EmployerInterviewsView() {
  usePageTitle('จัดการนัดหมายสัมภาษณ์')

  const [stages, setStages] = useState(initialApplicantStages)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [subview, setSubview] = useState<EmployerSubview>('picker')

  const [scheduleDate, setScheduleDate] = useState('2569-07-24')
  const [scheduleTime, setScheduleTime] = useState('13:30')
  const [scheduleFormat, setScheduleFormat] = useState<'onsite' | 'online'>('onsite')
  const [scheduleLocation, setScheduleLocation] = useState('ร้าน Café Doi ชั้น 2')
  const [schedulePrep, setSchedulePrep] = useState('')

  const [rescheduleNote, setRescheduleNote] = useState('')
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false)

  const [resultsConfirmOpen, setResultsConfirmOpen] = useState(false)
  const [notifTab, setNotifTab] = useState<'all' | 'unread' | 'reschedule'>('all')

  const notScheduled = employerApplicants.filter((a) => stages[a.id] === 'new' || stages[a.id] === 'awaiting_confirm' || stages[a.id] === 'invited')
  const interviewed = employerApplicants.filter((a) => stages[a.id] === 'interviewed' || stages[a.id] === 'passed' || stages[a.id] === 'failed')

  const selected = employerApplicants.find((a) => a.id === selectedId) ?? null
  const selectedStage = selectedId ? stages[selectedId] : null

  function pick(id: number) {
    setSelectedId(id)
    setSubview('hub')
  }

  function submitSchedule() {
    if (selectedId) setStages((prev) => ({ ...prev, [selectedId]: 'awaiting_confirm' }))
    setSubview('hub')
  }

  function markInterviewed() {
    if (selectedId) setStages((prev) => ({ ...prev, [selectedId]: 'interviewed' }))
    setSubview('hub')
  }

  function setResult(id: number, stage: ApplicantStage) {
    setStages((prev) => ({ ...prev, [id]: stage }))
  }

  const HubHeader = selected && (
    <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
          {selected.initial}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{selected.name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#697077' }}>{selected.position} • รหัส {selected.code}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {selectedStage && (
          <Chip
            label={`ขั้นปัจจุบัน: ${employerApplicantStageChip[selectedStage].label}`}
            size="small"
            sx={{ bgcolor: employerApplicantStageChip[selectedStage].bg, color: employerApplicantStageChip[selectedStage].color, fontWeight: 600 }}
          />
        )}
        <Button onClick={() => setSubview('picker')} size="small" sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2 }}>
          ← เปลี่ยนผู้สมัคร
        </Button>
      </Box>
    </Box>
  )

  if (subview === 'picker') {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>เลือกผู้สมัคร</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 2 }}>
          เลือกผู้สมัคร 1 คนก่อน — ระบบนัดสัมภาษณ์ และระบบตกลงการจ้างงานจะเปิดใช้งานหลังเลือก
        </Typography>
        <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, mb: 3 }}>
          👋 ผู้ประกอบการเป็นผู้กดเลือกผู้สมัครเอง จากนั้นจึงเริ่มกระบวนการนัดสัมภาษณ์ / จ้างงาน
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>🟠 ยังไม่สัมภาษณ์ <Chip label={`${notScheduled.length} คน`} size="small" sx={{ ml: 0.5 }} /></Typography>
            <Typography sx={{ fontSize: 12, color: '#9AA0A6', mb: 1.5 }}>รวมผู้สมัครใหม่ และผู้ที่นัดแล้วแต่ยังไม่ได้สัมภาษณ์</Typography>
            {notScheduled.map((a) => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 3, p: 1.5, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{a.initial}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{a.position} • {a.code}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={employerApplicantStageChip[stages[a.id]].label} size="small" sx={{ bgcolor: employerApplicantStageChip[stages[a.id]].bg, color: employerApplicantStageChip[stages[a.id]].color, fontWeight: 600 }} />
                  <Button onClick={() => pick(a.id)} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2 }}>เลือก</Button>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>🔵 สัมภาษณ์แล้ว <Chip label={`${interviewed.length} คน`} size="small" sx={{ ml: 0.5 }} /></Typography>
            <Typography sx={{ fontSize: 12, color: '#9AA0A6', mb: 1.5 }}>ผ่านการสัมภาษณ์ — พร้อมแจ้งผลและจัดทำข้อตกลงการจ้างงาน</Typography>
            {interviewed.map((a) => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 3, p: 1.5, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{a.initial}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{a.position} • {a.code}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={employerApplicantStageChip[stages[a.id]].label} size="small" sx={{ bgcolor: employerApplicantStageChip[stages[a.id]].bg, color: employerApplicantStageChip[stages[a.id]].color, fontWeight: 600 }} />
                  <Button onClick={() => pick(a.id)} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2 }}>เลือก</Button>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    )
  }

  if (!selected || !selectedStage) {
    return null
  }

  if (subview === 'hub') {
    const unlocked = selectedStage === 'passed'
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>พื้นที่จัดการผู้สมัคร</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 2.5 }}>
          เลือกกระบวนการที่ต้องการดำเนินการ — ระบบจัดการนัดหมายสัมภาษณ์ และระบบตกลงการจ้างงาน
        </Typography>
        {HubHeader}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: colors.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>1</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>จัดการนัดหมายสัมภาษณ์</Typography>
                  <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>กำหนดนัด ยืนยัน เลื่อน และแจ้งผลการพิจารณา</Typography>
                </Box>
              </Box>
              <Chip label="พร้อมใช้งาน" size="small" sx={{ bgcolor: '#EAF7EA', color: colors.ok, fontWeight: 600 }} />
            </Box>
            {[
              { icon: <EventOutlinedIcon fontSize="small" />, label: 'กำหนดนัดหมายสัมภาษณ์', action: () => setSubview('schedule') },
              { icon: <VisibilityOutlinedIcon fontSize="small" />, label: 'รายละเอียด / ยืนยันนัด', action: () => setSubview('detail') },
              { icon: <AutorenewOutlinedIcon fontSize="small" />, label: 'ขอเปลี่ยน / เลื่อนกำหนดการ', action: () => setSubview('reschedule') },
              { icon: <NotificationsNoneOutlinedIcon fontSize="small" />, label: 'การแจ้งเตือน', action: () => setSubview('notifications') },
              { icon: <CampaignOutlinedIcon fontSize="small" />, label: 'แจ้งผลการพิจารณาการสัมภาษณ์', action: () => setSubview('results') },
            ].map((row) => (
              <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 2, p: 1.5, mb: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: colors.navy }}>
                  {row.icon}
                  <Typography sx={{ fontSize: 14 }}>{row.label}</Typography>
                </Box>
                <Button onClick={row.action} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2 }}>ทำรายการ</Button>
              </Box>
            ))}
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, opacity: unlocked ? 1 : 0.85 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: unlocked ? colors.navy : '#E0E0E0', color: unlocked ? '#fff' : '#9AA0A6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>2</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>ตกลงการจ้างงาน</Typography>
                  <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>จัดทำ ตอบรับ และตรวจสอบข้อตกลงย้อนหลัง</Typography>
                </Box>
              </Box>
              <Chip
                icon={unlocked ? undefined : <LockOutlinedIcon sx={{ fontSize: 14 }} />}
                label={unlocked ? 'พร้อมใช้งาน' : 'ล็อกอยู่'}
                size="small"
                sx={{ bgcolor: unlocked ? '#EAF7EA' : '#F0F0F0', color: unlocked ? colors.ok : '#9AA0A6', fontWeight: 600 }}
              />
            </Box>

            {!unlocked && (
              <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mb: 1.5 }}>
                * ต้องผ่านการสัมภาษณ์ และได้ผล &quot;ตอบรับเข้าทำงาน&quot; ก่อน จึงจะเปิดใช้งานได้
              </Box>
            )}
            {unlocked && (
              <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, mb: 1.5 }}>
                ปลดล็อกแล้วเพราะผู้สมัครผ่านการสัมภาษณ์แล้ว — ระบบพร้อมจัดทำข้อตกลงการจ้างงาน
              </Box>
            )}

            {[
              { icon: <DescriptionOutlinedIcon fontSize="small" />, label: 'สร้างข้อตกลงการจ้างงาน', tag: 'U6' },
              { icon: <DrawOutlinedIcon fontSize="small" />, label: 'รายละเอียด / ตอบรับ-ปฏิเสธ', tag: 'U7' },
              { icon: <FolderOutlinedIcon fontSize="small" />, label: 'ประวัติย้อนหลัง', tag: 'U8' },
            ].map((row) => (
              <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 2, p: 1.5, mb: 1.25, opacity: unlocked ? 1 : 0.6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: unlocked ? colors.navy : '#9AA0A6' }}>
                  {row.icon}
                  <Typography sx={{ fontSize: 14 }}>{row.label}</Typography>
                </Box>
                <Chip label={row.tag} size="small" sx={{ bgcolor: '#F0F0F0', color: '#9AA0A6' }} />
              </Box>
            ))}
            {unlocked && (
              <Button
                fullWidth
                variant="contained"
                onClick={() => window.location.assign('/employment')}
                sx={{ mt: 0.5, borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
              >
                ไปที่ระบบตกลงการจ้างงาน →
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    )
  }

  const BackToHub = (
    <Button onClick={() => setSubview('hub')} sx={{ textTransform: 'none', color: colors.navy, mb: 1.5, px: 0 }}>← กลับ</Button>
  )

  if (subview === 'schedule') {
    return (
      <Box sx={{ maxWidth: 950, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>กำหนดนัดหมายสัมภาษณ์</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>กำหนดวัน เวลา และสถานที่นัดสัมภาษณ์ให้ผู้สมัครที่ผ่านการคัดเลือกเบื้องต้น</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>ข้อมูลนัดสัมภาษณ์</Typography>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>ผู้สมัคร</Typography>
            <TextField value={`${selected.name} — ${selected.position}`} fullWidth disabled sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="วันที่นัด" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="เวลา" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 1 }}>รูปแบบการสัมภาษณ์</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button onClick={() => setScheduleFormat('onsite')} sx={{ borderRadius: '20px', textTransform: 'none', px: 2, bgcolor: scheduleFormat === 'onsite' ? colors.navy : '#F0F0F0', color: scheduleFormat === 'onsite' ? '#fff' : colors.navy }}>ณ สถานที่</Button>
              <Button onClick={() => setScheduleFormat('online')} sx={{ borderRadius: '20px', textTransform: 'none', px: 2, bgcolor: scheduleFormat === 'online' ? colors.navy : '#F0F0F0', color: scheduleFormat === 'online' ? '#fff' : colors.navy }}>สัมภาษณ์ออนไลน์</Button>
            </Box>
            <TextField label="สถานที่ / ลิงก์สัมภาษณ์" value={scheduleLocation} onChange={(e) => setScheduleLocation(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <TextField label="รายละเอียด / สิ่งที่ต้องเตรียม" value={schedulePrep} onChange={(e) => setSchedulePrep(e.target.value)} placeholder="เช่น เอกสารที่ต้องนำมา จุดนัดพบ การแต่งกาย" fullWidth multiline minRows={3} />
          </Box>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>สรุปนัดหมาย</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>วัน-เวลา</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>24 ก.ค. 2569 • {scheduleTime} น.</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>รูปแบบ</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>{scheduleFormat === 'onsite' ? 'สัมภาษณ์ ณ สถานที่' : 'สัมภาษณ์ออนไลน์'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>สถานที่</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 2 }}>{scheduleLocation || '-'}</Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setSubview('hub')} sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2.5 }}>ยกเลิก</Button>
              <Button fullWidth variant="contained" onClick={submitSchedule} sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}>บันทึกและส่งการแจ้งเตือน</Button>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  if (subview === 'detail') {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>รายละเอียด / ยืนยันนัด</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>ตรวจสอบรายละเอียดนัดหมายที่บันทึกไว้กับผู้สมัคร</Typography>
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>วันที่</Typography><Typography sx={{ fontWeight: 600 }}>24 ก.ค. 2569</Typography></Box>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>เวลา</Typography><Typography sx={{ fontWeight: 600 }}>{scheduleTime} น.</Typography></Box>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>รูปแบบ</Typography><Typography sx={{ fontWeight: 600 }}>{scheduleFormat === 'onsite' ? 'สัมภาษณ์ ณ สถานที่' : 'สัมภาษณ์ออนไลน์'}</Typography></Box>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>สถานที่</Typography><Typography sx={{ fontWeight: 600 }}>{scheduleLocation || '-'}</Typography></Box>
          </Box>
          <Button
            fullWidth
            variant="contained"
            disabled={selectedStage !== 'awaiting_confirm' && selectedStage !== 'invited'}
            onClick={markInterviewed}
            sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: colors.ok, '&:hover': { bgcolor: '#1B5F21' } }}
          >
            ทำเครื่องหมายว่าสัมภาษณ์เสร็จสิ้นแล้ว
          </Button>
        </Box>
      </Box>
    )
  }

  if (subview === 'reschedule') {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>ขอเปลี่ยน / เลื่อนกำหนดการ</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>เสนอกำหนดการสอบถามสำหรับนัดหมายที่ยืนยันแล้ว ระบบจะบันทึกประวัติทุกครั้ง</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>เสนอการขอเปลี่ยน / เลื่อนวันเวลา</Typography>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>เลือกนัดหมายที่ต้องการเปลี่ยน</Typography>
            <TextField value={`IV-2569-014 • ${selected.position} • 24 ก.ค. ${scheduleTime}`} fullWidth disabled sx={{ mb: 2 }} />
            <TextField
              label="ทำการสอบถามจากนักศึกษาวันที่ว่าง"
              value={rescheduleNote}
              onChange={(e) => setRescheduleNote(e.target.value)}
              placeholder="บอกรายละเอียดสอบถามนักศึกษาวันที่ว่างตามรายเอียดตามที่ต้องการจะรู้ ระบบจะส่งการตอบรับวันใหม่ของนักศึกษากลับมา"
              fullWidth
              multiline
              minRows={4}
              sx={{ mb: 2 }}
            />
            <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5 }}>
              เมื่อส่งคำขอ ระบบจะแจ้งอีกฝ่ายให้ตรวจสอบและยืนยันรับทราบกำหนดการใหม่
            </Box>
          </Box>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>ประวัติการเปลี่ยนแปลงการสัมภาษณ์</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ borderLeft: `2px solid ${colors.navy}`, pl: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>สร้างนัดหมาย</Typography>
                <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>โดยผู้ประกอบการ • 19 ก.ค. 11:20</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
              <Button onClick={() => setSubview('hub')} sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2.5 }}>ยกเลิก</Button>
              <Button
                fullWidth
                variant="contained"
                disabled={rescheduleNote.trim().length === 0}
                onClick={() => setRescheduleConfirmOpen(true)}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
              >
                ส่งคำขอเปลี่ยนกำหนดการ
              </Button>
            </Box>
          </Box>
        </Box>
        <GmailConfirmDialog
          open={rescheduleConfirmOpen}
          onClose={() => setRescheduleConfirmOpen(false)}
          email="job-student@gmail.com"
          note="กรุณารอการแจ้งเตือนวันนัดหมายใหม่จากนักศึกษาด้วยครับในการแจ้งเตือนนะครับ"
          onBack={() => { setRescheduleConfirmOpen(false); setSubview('hub') }}
        />
      </Box>
    )
  }

  if (subview === 'notifications') {
    const items = [
      { icon: <AutorenewOutlinedIcon fontSize="small" />, title: `ส่งคำขอเลื่อนนัดจากผู้ประกอบการ — ${selected.name}`, body: `นักศึกษาขอเลื่อนนัด IV-2569-014 (${selected.position}) และเสนอวันที่สะดวกมา 3 วัน ให้เลือกแล้ว`, time: '5 นาทีที่แล้ว', reschedule: true, unread: true },
      { icon: <AutorenewOutlinedIcon fontSize="small" />, title: 'คำขอเลื่อนนัดจากนักศึกษา — น.ส.สุดา รักเรียน', body: 'นักศึกษาขอเลื่อนนัด IV-2569-014 (Barista พาร์กไทม์) เสนอวันที่สะดวกมาแล้ว 1 วัน', time: '5 นาทีที่แล้ว', reschedule: true, unread: true },
      { icon: <PersonOutlineOutlinedIcon fontSize="small" />, title: 'มีผู้สมัครใหม่ — ตำแหน่ง Barista พาร์กไทม์', body: 'นายมานะ อดทน สมัครเข้ามาใหม่ รอการคัดกรอง', time: '1 ชม.ที่แล้ว', reschedule: false, unread: false },
      { icon: <CheckCircleOutlineIcon fontSize="small" />, title: 'นักศึกษายืนยันเข้ารับสัมภาษณ์', body: 'นายธนา มุ่งมั่น ยืนยันนัดสัมภาษณ์ IV-2569-011 แล้ว', time: 'เมื่อวาน', reschedule: false, unread: false },
      { icon: <DescriptionOutlinedIcon fontSize="small" />, title: 'นักศึกษาตอบรับข้อตกลงการจ้างงาน', body: 'ข้อตกลง AG-2569-021 เปลี่ยนสถานะเป็น "มีผลบังคับ"', time: '2 วันที่แล้ว', reschedule: false, unread: false },
    ]
    const visible = items.filter((it) => notifTab === 'all' || (notifTab === 'unread' && it.unread) || (notifTab === 'reschedule' && it.reschedule))
    return (
      <Box sx={{ maxWidth: 950, mx: 'auto' }}>
        {BackToHub}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>การแจ้งเตือน</Typography>
            <Typography sx={{ fontSize: 14, color: '#697077', mb: 2 }}>คำขอและอัปเดตจากนักศึกษา — กดเข้าไปดูรายละเอียดเพื่อดำเนินการ</Typography>
          </Box>
          <Button sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy }}>ทำเครื่องหมายว่าอ่านทั้งหมด</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          {(['all', 'unread', 'reschedule'] as const).map((t) => (
            <Button
              key={t}
              onClick={() => setNotifTab(t)}
              sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: notifTab === t ? colors.navy : '#F0F0F0', color: notifTab === t ? '#fff' : colors.navy }}
            >
              {t === 'all' ? 'ทั้งหมด' : t === 'unread' ? 'ยังไม่อ่าน' : 'คำขอเลื่อนนัด'}
            </Button>
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {visible.map((it) => (
            <Box key={it.title} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.icon}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy }}>{it.title}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#697077', mt: 0.25 }}>{it.body}</Typography>
                    {it.reschedule && (
                      <Button onClick={() => setSubview('reschedule')} sx={{ textTransform: 'none', px: 0, mt: 0.5, color: '#0090FF', fontWeight: 600 }}>ดูรายละเอียดและเลือกวัน →</Button>
                    )}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 12, color: '#9AA0A6', flexShrink: 0 }}>{it.time}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  // results
  const resultRows = employerApplicants.filter((a) => ['interviewed', 'passed', 'failed'].includes(stages[a.id]))
  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      {BackToHub}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 28, color: colors.navy }}>แจ้งผลการพิจารณาผ่านการสัมภาษณ์ผู้สมัคร</Typography>
          <Typography sx={{ fontSize: 14, color: '#697077' }}>บันทึกและแจ้งผลการพิจารณาแก่ผู้สมัครแต่ละคน ระบบจะส่งการแจ้งเตือนผลให้ผู้สมัครทันที</Typography>
        </Box>
        <Button variant="contained" onClick={() => setResultsConfirmOpen(true)} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}>ยืนยันแจ้งผลทั้งหมด</Button>
      </Box>
      <TextField
        placeholder="ค้นหาชื่อผู้สมัคร หรือ ตำแหน่งงาน..."
        size="small"
        fullWidth
        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
      />
      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 2.5fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
          {['ผู้สมัคร', 'ตำแหน่ง', 'สถานะ', 'ผลการพิจารณา'].map((h) => (
            <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
          ))}
        </Box>
        {resultRows.map((a, index) => {
          const stage = stages[a.id]
          const chip = employerApplicantStageChip[stage]
          return (
            <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 2.5fr', alignItems: 'center', px: 2.5, py: 1.75, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{a.initial}</Box>
                <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{a.name}</Typography>
              </Box>
              <Typography sx={{ fontSize: 13 }}>{a.position}</Typography>
              <Chip label={chip.label} size="small" sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, justifySelf: 'start' }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={() => setResult(a.id, 'invited')}
                  size="small"
                  sx={{ borderRadius: '20px', textTransform: 'none', px: 1.5, fontSize: 12, bgcolor: stage === 'invited' ? colors.navy : '#F0F0F0', color: stage === 'invited' ? '#fff' : colors.navy }}
                >
                  เชิญสัมภาษณ์
                </Button>
                <Button
                  onClick={() => setResult(a.id, 'passed')}
                  size="small"
                  sx={{ borderRadius: '20px', textTransform: 'none', px: 1.5, fontSize: 12, bgcolor: stage === 'passed' ? colors.ok : '#F0F0F0', color: stage === 'passed' ? '#fff' : colors.navy }}
                >
                  ผ่านการสัมภาษณ์
                </Button>
                <Button
                  onClick={() => setResult(a.id, 'failed')}
                  size="small"
                  sx={{ borderRadius: '20px', textTransform: 'none', px: 1.5, fontSize: 12, bgcolor: stage === 'failed' ? '#DA1E28' : '#F0F0F0', color: stage === 'failed' ? '#fff' : colors.navy }}
                >
                  ไม่ผ่านการสัมภาษณ์
                </Button>
              </Box>
            </Box>
          )
        })}
      </Box>
      <Typography sx={{ fontSize: 13, color: '#697077', mt: 1.5 }}>
        เลือกผลแล้ว {resultRows.filter((a) => stages[a.id] === 'passed' || stages[a.id] === 'failed').length} จาก {resultRows.length} รายการ • ผู้ที่ &quot;ผ่านการสัมภาษณ์&quot; จะถูกส่งต่อไปขั้นตอนสร้างข้อตกลงการจ้างงาน
      </Typography>
      <GmailConfirmDialog
        open={resultsConfirmOpen}
        onClose={() => setResultsConfirmOpen(false)}
        email="job-student@gmail.com"
        note="ทำการแจ้งผลการสัมภาษณ์ไปยังผู้สมัครเรียบร้อย สามารถทำข้อตกลงสัญญาจ้างงานได้ครับ"
        onBack={() => { setResultsConfirmOpen(false); setSubview('hub') }}
      />
    </Box>
  )
}

export default function InterviewsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerInterviewsView /> : <StudentInterviewsView />
}
