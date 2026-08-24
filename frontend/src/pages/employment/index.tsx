import { useState } from 'react'
import { Box, Button, Chip, Dialog, IconButton, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'

const colors = { navy: '#012150', border: '#DDE1E6' }

type Status = 'pending' | 'accepted' | 'rejected'

const offer = {
  code: 'AG-2569-021',
  position: 'Barista พาร์ทไทม์ — ร้าน Café Doi',
  startDate: '1 ส.ค. 2569',
  duration: '4 เดือน (ถึง 30 พ.ย. 2569)',
  wageRate: '60 บาท / ชั่วโมง',
  workingHours: 'ไม่เกิน 20 ชม./สัปดาห์',
  leavePolicy: 'แจ้งล่วงหน้าอย่างน้อย 3 วัน ยกเว้นกรณีฉุกเฉิน',
  additionalTerms: 'แต่งกายสุภาพตามระเบียบร้าน รักษาความลับของกิจการ',
}

function StudentEmploymentView() {
  usePageTitle('ข้อตกลงการจ้างงาน')
  const navigate = useNavigate()

  const [status, setStatus] = useState<Status>('pending')
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [acceptedDialog, setAcceptedDialog] = useState(false)
  const [rejectedDialog, setRejectedDialog] = useState(false)

  const statusChip = {
    pending: { label: 'รอการตอบรับ', color: '#B5850C', bg: '#FFF0DD' },
    accepted: { label: 'มีผลบังคับ', color: '#217829', bg: '#EAF7EA' },
    rejected: { label: 'ปฏิเสธแล้ว', color: '#DA1E28', bg: '#FDEAEA' },
  }[status]

  function accept() {
    setStatus('accepted')
    setAcceptedDialog(true)
  }

  function confirmReject() {
    setStatus('rejected')
    setRejecting(false)
    setRejectedDialog(true)
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>
        รายละเอียดข้อตกลงการจ้างงาน
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>
        อ่านและตรวจทานรายละเอียดให้ครบก่อนตอบรับ — เมื่อตอบรับ ข้อตกลงจะมีผลบังคับและถูกจัดเก็บเป็นหลักฐาน
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Chip label={statusChip.label} size="small" sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 600 }} />
            <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>ข้อตกลงเลขที่ {offer.code}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy, mb: 2 }}>{offer.position}</Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderTop: `1px solid ${colors.border}`, pt: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>วันเริ่มงาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.startDate}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ระยะเวลา</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.duration}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>อัตราค่าตอบแทน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.wageRate}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ชั่วโมงการทำงาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.workingHours}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>เงื่อนไขการลางาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.leavePolicy}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ข้อกำหนดอื่น ๆ</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{offer.additionalTerms}</Typography>
            </Box>
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mt: 3, mb: 1 }}>
            มีข้อสงสัย / ขอปรับแก้ประเด็นใด แจ้งผู้ประกอบการ
          </Typography>
          <TextField
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="พิมพ์คำถามหรือประเด็นที่ต้องการให้ชี้แจงก่อนตัดสินใจ..."
            fullWidth
            multiline
            minRows={3}
            disabled={status !== 'pending'}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>การตัดสินใจ</Typography>

            <Box sx={{ display: 'flex', gap: 1, bgcolor: '#FFF0DD', borderRadius: 2, p: 1.5, mb: 2 }}>
              <LockOutlinedIcon fontSize="small" sx={{ color: '#B5850C' }} />
              <Typography sx={{ fontSize: 12, color: '#8A6A1B' }}>ระบบจะให้ยืนยันตัวตนอีกครั้งก่อนบันทึกผลเพื่อความปลอดภัย</Typography>
            </Box>

            {status === 'pending' && !rejecting && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={accept}
                  startIcon={<CheckCircleOutlineIcon />}
                  sx={{ borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
                >
                  ตอบรับข้อตกลง
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setRejecting(true)}
                  sx={{ borderRadius: '40px', textTransform: 'none', color: '#DA1E28', borderColor: '#DA1E28' }}
                >
                  ปฏิเสธ (ต้องระบุเหตุผล)
                </Button>
              </Box>
            )}

            {status === 'pending' && rejecting && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <TextField
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="ระบุเหตุผลที่ปฏิเสธข้อตกลง"
                  multiline
                  minRows={3}
                  fullWidth
                  size="small"
                />
                <Button onClick={() => setRejecting(false)} sx={{ textTransform: 'none', color: colors.navy }}>ยกเลิก</Button>
                <Button
                  variant="contained"
                  disabled={rejectReason.trim().length === 0}
                  onClick={confirmReject}
                  sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
                >
                  ยืนยันการปฏิเสธ
                </Button>
              </Box>
            )}

            {status !== 'pending' && (
              <Typography sx={{ fontSize: 13, color: '#697077' }}>
                คุณได้{status === 'accepted' ? 'ตอบรับ' : 'ปฏิเสธ'}ข้อตกลงนี้แล้ว
              </Typography>
            )}
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1 }}>เมื่อตอบรับ</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.2, fontSize: 13, color: '#333' }}>
              <li>สถานะเปลี่ยนเป็น "มีผลบังคับ"</li>
              <li>จัดเก็บเป็นหลักฐานอ้างอิง</li>
              <li>แจ้งทุกฝ่ายให้รับทราบตรงกัน</li>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Accept confirmation */}
      <Dialog open={acceptedDialog} onClose={() => setAcceptedDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 96, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 26, color: colors.navy, mt: 2 }}>ยืนยันการจ้างงาน</Typography>
          <Typography sx={{ fontSize: 14, color: '#697077', mt: 1.5 }}>
            ขอขอบคุณที่เลือกทำงานกับเราขอบคุณครับ/ค่ะ
            <br />
            สามารถติดตามเวลางานได้ที่เวลาทำงาน
            <br />
            <br />
            หากสงสัยหรือมีคำถามสามารถแจ้งได้ที่แจ้งปัญหา / ร้องเรียน
            <br />
            ขอขอบคุณเป็นอย่างสูง
          </Typography>
        </Box>
      </Dialog>

      {/* Reject confirmation */}
      <Dialog open={rejectedDialog} onClose={() => setRejectedDialog(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 64 }}>😢</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 26, color: colors.navy, mt: 1 }}>ขอขอบคุณครับ/ค่ะ</Typography>
          <Button
            startIcon={<HomeOutlinedIcon />}
            onClick={() => navigate('/profile')}
            sx={{ mt: 2, borderRadius: '40px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy, px: 2.5 }}
          >
            คุณได้ปฏิเสธงานนี้ กรุณากลับหน้าหลัก
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}

// ─────────────────────────── Employer side ───────────────────────────
// UI-only (local mock state, no service-layer calls) per B6733827's scope —
// matches B6733827/U6 ทำการสร้างข้อตกลงการจ้างงาน(25).png,
// ส่งข้อตกลงการจ้างงานไปยังนักศึกษา(26).png, and
// U8ประวัติย้อนหลังเอกสารทั้งหมด(32).png. No U7 ("รายละเอียด/ตอบรับ-ปฏิเสธ")
// mockup exists in the design source — that tab is a best-effort build.

type AgreementTab = 'create' | 'status' | 'history'
type AgreementStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

const historyRows = [
  { code: 'AG-2569-021', item: 'ข้อตกลงจ้างงาน • Barista', party: 'นายกฤษฎา ใจดี', date: '1 ส.ค. 69', status: 'มีผลบังคับ', color: '#217829', bg: '#EAF7EA' },
  { code: 'IV-2569-014', item: 'นัดสัมภาษณ์ • Barista', party: 'นายกฤษฎา ใจดี', date: '24 ก.ค. 69', status: 'สัมภาษณ์แล้ว', color: '#0090FF', bg: '#EFF6FF' },
  { code: 'AG-2569-008', item: 'ข้อตกลงจ้างงาน • ผู้ช่วยสอน', party: 'น.ส.วิภา ตั้งใจ', date: '2 มิ.ย. 69', status: 'สิ้นสุดสัญญา', color: '#697077', bg: '#F0F0F0' },
  { code: 'IV-2569-003', item: 'นัดสัมภาษณ์ • ผู้ช่วยสอน', party: 'น.ส.วิภา ตั้งใจ', date: '20 พ.ค. 69', status: 'ยกเลิกนัด', color: '#B5850C', bg: '#FFF0DD' },
]

function EmployerEmploymentView() {
  usePageTitle('ระบบตกลงการจ้างงาน')

  const [tab, setTab] = useState<AgreementTab>('create')
  const [status, setStatus] = useState<AgreementStatus>('draft')
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)

  const [startDate, setStartDate] = useState('2569-08-01')
  const [duration, setDuration] = useState('4 เดือน (ถึง 30 พ.ย. 2569)')
  const [wageRate, setWageRate] = useState('60 บาท / ชั่วโมง')
  const [workingHours, setWorkingHours] = useState('ไม่เกิน 20 ชม./สัปดาห์')
  const [leavePolicy, setLeavePolicy] = useState('แจ้งล่วงหน้าอย่างน้อย 3 วัน ยกเว้นกรณีฉุกเฉิน')
  const [additionalTerms, setAdditionalTerms] = useState('')

  function send() {
    setStatus('sent')
    setSendConfirmOpen(true)
  }

  const statusChip = {
    draft: { label: 'ยังไม่ส่ง', color: '#697077', bg: '#F0F0F0' },
    sent: { label: 'รอนักศึกษาตอบรับ', color: '#B5850C', bg: '#FFF0DD' },
    accepted: { label: 'มีผลบังคับ', color: '#217829', bg: '#EAF7EA' },
    rejected: { label: 'ถูกปฏิเสธ', color: '#DA1E28', bg: '#FDEAEA' },
  }[status]

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>ระบบตกลงการจ้างงาน</Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 2.5 }}>จัดทำข้อตกลงการจ้างงานแก่นักศึกษาที่ได้รับผล &quot;ผ่านการสัมภาษณ์&quot; กรอกเงื่อนไขให้ครบทุกหัวข้อ</Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        <Button onClick={() => setTab('create')} sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'create' ? colors.navy : '#F0F0F0', color: tab === 'create' ? '#fff' : colors.navy }}>สร้างข้อตกลงการจ้างงาน</Button>
        <Button onClick={() => setTab('status')} sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'status' ? colors.navy : '#F0F0F0', color: tab === 'status' ? '#fff' : colors.navy }}>รายละเอียด / ตอบรับ-ปฏิเสธ</Button>
        <Button onClick={() => setTab('history')} sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'history' ? colors.navy : '#F0F0F0', color: tab === 'history' ? '#fff' : colors.navy }}>ประวัติย้อนหลัง</Button>
      </Box>

      {tab === 'create' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>เงื่อนไขการจ้างงาน</Typography>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>เลือกนักศึกษา</Typography>
            <TextField value="นายกฤษฎา ใจดี — Barista พาร์กไทม์" fullWidth disabled sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="วันที่เริ่มงาน" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="ระยะเวลาการทำงาน" value={duration} onChange={(e) => setDuration(e.target.value)} fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="อัตราค่าตอบแทน" value={wageRate} onChange={(e) => setWageRate(e.target.value)} fullWidth />
              <TextField label="ชั่วโมงการทำงาน" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} fullWidth />
            </Box>
            <TextField label="เงื่อนไขการลางาน" value={leavePolicy} onChange={(e) => setLeavePolicy(e.target.value)} fullWidth sx={{ mb: 2 }} />
            <TextField
              label="ข้อกำหนดอื่น ๆ"
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              placeholder="เช่น การแต่งกาย ระเบียบร้าน การรักษาความลับ บทลงโทษเมื่อผิดเงื่อนไข"
              fullWidth
              multiline
              minRows={3}
            />
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>ตัวอย่างข้อตกลง</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>เลขที่</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>AG-2569-021</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>สถานะ</Typography>
              <Chip label={statusChip.label} size="small" sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 600 }} />
            </Box>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>คู่สัญญา</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>ร้าน Café Doi ⇄ นายกฤษฎา ใจดี</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>เริ่มงาน-สิ้นสุด</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>{startDate.split('-').reverse().join('/')} — {duration}</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>ค่าตอบแทน</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 2 }}>{wageRate}</Typography>
            <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 12, borderRadius: 2, p: 1.5, mb: 2 }}>
              ระบบจะตรวจสอบความครบถ้วนของทุกหัวข้อก่อนบันทึกสถานะ &quot;รอนักศึกษาตอบรับ&quot;
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2.5 }}>บันทึกร่าง</Button>
              <Button fullWidth variant="contained" onClick={send} sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}>ยืนยันสร้างและส่งให้นักศึกษา</Button>
            </Box>
          </Box>
        </Box>
      )}

      {tab === 'status' && (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, maxWidth: 600 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>AG-2569-021</Typography>
              <Typography sx={{ fontSize: 13, color: '#697077' }}>นายกฤษฎา ใจดี — Barista พาร์กไทม์</Typography>
            </Box>
            <Chip label={statusChip.label} size="small" sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 600 }} />
          </Box>
          {status === 'draft' && <Typography sx={{ fontSize: 13, color: '#697077' }}>ยังไม่ได้ส่งข้อตกลงนี้ให้นักศึกษา ไปที่แท็บ &quot;สร้างข้อตกลงการจ้างงาน&quot; เพื่อส่ง</Typography>}
          {status === 'sent' && <Typography sx={{ fontSize: 13, color: '#697077' }}>ส่งให้นักศึกษาแล้ว กำลังรอนักศึกษาตอบรับหรือปฏิเสธ ระบบจะแจ้งเตือนทันทีที่มีการตอบกลับ</Typography>}
          {status === 'accepted' && <Typography sx={{ fontSize: 13, color: colors.navy }}>นักศึกษาตอบรับข้อตกลงแล้ว — มีผลบังคับตั้งแต่ {startDate.split('-').reverse().join('/')}</Typography>}
          {status === 'rejected' && <Typography sx={{ fontSize: 13, color: '#DA1E28' }}>นักศึกษาปฏิเสธข้อตกลงนี้</Typography>}
        </Box>
      )}

      {tab === 'history' && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <TextField
              placeholder="ค้นหาตำแหน่งงาน เลขที่ข้อตกลง หรือ คู่สัญญา..."
              size="small"
              sx={{ width: 340, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
              slotProps={{ input: { startAdornment: <Box sx={{ display: 'flex', mr: 0.5 }}><SearchOutlinedIcon fontSize="small" /></Box> } }}
            />
            <Chip label="🔒 ตรวจสอบสิทธิ์แล้ว • คู่สัญญา" size="small" sx={{ bgcolor: '#EAF7EA', color: '#217829', fontWeight: 600 }} />
          </Box>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.6fr 1fr 1.2fr 0.6fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
              {['เลขที่', 'รายการ', 'คู่สัญญา', 'วันที่', 'สถานะ', 'หลักฐาน'].map((h) => (
                <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
              ))}
            </Box>
            {historyRows.map((r, index) => (
              <Box key={r.code} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.6fr 1fr 1.2fr 0.6fr', alignItems: 'center', px: 2.5, py: 1.5, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{r.code}</Typography>
                <Typography sx={{ fontSize: 13 }}>{r.item}</Typography>
                <Typography sx={{ fontSize: 13 }}>{r.party}</Typography>
                <Typography sx={{ fontSize: 13 }}>{r.date}</Typography>
                <Chip label={r.status} size="small" sx={{ bgcolor: r.bg, color: r.color, fontWeight: 600, justifySelf: 'start' }} />
                <IconButton size="small" sx={{ bgcolor: '#F0F0F0' }}><DownloadOutlinedIcon fontSize="small" /></IconButton>
              </Box>
            ))}
          </Box>
          <Button startIcon={<DownloadOutlinedIcon />} sx={{ mt: 2, borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2.5, '&:hover': { bgcolor: '#000226' } }}>ดาวน์โหลดทั้งหมด (PDF)</Button>
        </Box>
      )}

      <Dialog open={sendConfirmOpen} onClose={() => setSendConfirmOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
          <IconButton size="small" onClick={() => setSendConfirmOpen(false)} sx={{ position: 'absolute', top: 12, right: 12 }}><CloseOutlinedIcon fontSize="small" /></IconButton>
          <MailOutlineIcon sx={{ fontSize: 96, color: '#EA4335' }} />
          <Typography sx={{ fontSize: 14, color: '#333', mt: 2 }}>
            ยืนยันการส่งได้ทำการแจ้งเตือนไปที่
            <br />
            <Box component="span" sx={{ color: colors.navy, fontWeight: 600 }}>job-student@gmail.com</Box>
            <br />
            เรียบร้อยแล้วและทำการอัพเดตผลไปยังฝั่งนักศึกษาเรียบร้อย
          </Typography>
          <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mt: 2.5 }}>
            * กรุณารอการยืนยันผลการตอบรับจากนักศึกษาด้วยครับ ที่การแจ้งเตือน ทั้งสองฝ่ายต้องตอบรับกันและกัน
          </Box>
          <Button onClick={() => { setSendConfirmOpen(false); setTab('status') }} sx={{ mt: 2.5, textTransform: 'none', color: colors.navy }}>← ผู้สมัครคนถัดไป</Button>
        </Box>
      </Dialog>
    </Box>
  )
}

export default function EmploymentPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerEmploymentView /> : <StudentEmploymentView />
}
