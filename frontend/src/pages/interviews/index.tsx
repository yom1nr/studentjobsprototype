import { useState } from 'react'
import { Box, Button, Chip, Dialog, IconButton, TextField, Typography } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import { usePageTitle } from '../../components/usePageTitle'

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

export default function InterviewsPage() {
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
