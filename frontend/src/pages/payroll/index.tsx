import { useMemo, useState } from 'react'
import {
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
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'

const colors = { navy: '#012150', border: '#DDE1E6', ok: '#217829' }
const currency = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 })

type PayrollStatus = 'pending' | 'confirmed'

type Payslip = {
  id: number
  month: string
  hours: number
  rate: number
  status: PayrollStatus
}

const INITIAL_PAYSLIPS: Payslip[] = [
  { id: 1, month: 'กรกฎาคม 2569', hours: 15.5, rate: 50, status: 'pending' },
  { id: 2, month: 'มิถุนายน 2569', hours: 30, rate: 50, status: 'confirmed' },
  { id: 3, month: 'พฤษภาคม 2569', hours: 28, rate: 50, status: 'pending' },
]

type TimeReviewStatus = 'approved' | 'reviewing'
type ShiftPaymentStatus = 'awaiting' | 'pending_confirm' | 'confirmed'

type TimeEntry = {
  id: number
  date: string
  checkIn: string
  checkOut: string
  hours: number
  rate: number
  timeStatus: TimeReviewStatus
  paymentStatus: ShiftPaymentStatus
  editRequest?: { checkIn: string; checkOut: string; reason: string }
}

const INITIAL_RECORDS: TimeEntry[] = [
  { id: 1, date: '22 ก.ค. 2569', checkIn: '12:30', checkOut: '18:00', hours: 5.5, rate: 40, timeStatus: 'approved', paymentStatus: 'pending_confirm' },
  { id: 2, date: '21 ก.ค. 2569', checkIn: '12:30', checkOut: '18:00', hours: 5.5, rate: 40, timeStatus: 'reviewing', paymentStatus: 'awaiting' },
  { id: 3, date: '20 ก.ค. 2569', checkIn: '09:00', checkOut: '12:00', hours: 3, rate: 50, timeStatus: 'approved', paymentStatus: 'pending_confirm' },
  { id: 4, date: '19 ก.ค. 2569', checkIn: '13:00', checkOut: '17:30', hours: 4.5, rate: 40, timeStatus: 'approved', paymentStatus: 'confirmed' },
  { id: 5, date: '18 ก.ค. 2569', checkIn: '12:30', checkOut: '18:00', hours: 5.5, rate: 40, timeStatus: 'approved', paymentStatus: 'pending_confirm' },
]

const studentTimeStatusChip: Record<TimeReviewStatus, { label: string; color: string; bg: string }> = {
  approved: { label: 'อนุมัติแล้ว', color: '#217829', bg: '#EAF7EA' },
  reviewing: { label: 'รอตรวจสอบ', color: '#B5850C', bg: '#FFF0DD' },
}

const shiftPaymentStatusChip: Record<ShiftPaymentStatus, { label: string; color: string; bg: string; border?: string }> = {
  awaiting: { label: 'รอจ่าย', color: '#012150', bg: '#fff', border: '#DDE1E6' },
  pending_confirm: { label: 'รอยืนยัน', color: '#5A4FCF', bg: '#EDEBFB' },
  confirmed: { label: 'รับเงินแล้ว', color: '#217829', bg: '#EAF7EA' },
}

function StudentPayrollView() {
  usePageTitle('ประวัติการลงเวลา')
  const navigate = useNavigate()

  const [tab, setTab] = useState<'history' | 'payslips'>('payslips')
  const [search, setSearch] = useState('')
  const [payslips, setPayslips] = useState(INITIAL_PAYSLIPS)
  const [records, setRecords] = useState(INITIAL_RECORDS)
  const [selected, setSelected] = useState<Payslip | null>(null)
  const [confirmingShift, setConfirmingShift] = useState<TimeEntry | null>(null)
  const [editRequest, setEditRequest] = useState<TimeEntry | null>(null)
  const [newCheckIn, setNewCheckIn] = useState('')
  const [newCheckOut, setNewCheckOut] = useState('')
  const [reason, setReason] = useState('')

  const totalHours = useMemo(() => records.reduce((s, r) => s + r.hours, 0), [records])
  const netPay = useMemo(() => records.reduce((s, r) => s + r.hours * r.rate, 0), [records])
  const pendingCount = records.filter((r) => r.paymentStatus === 'pending_confirm').length

  function confirmReceipt(id: number) {
    setPayslips((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'confirmed' } : p)))
    setSelected(null)
  }

  function confirmShiftReceipt(id: number) {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, paymentStatus: 'confirmed' } : r)))
    setConfirmingShift(null)
  }

  function openEditRequest(entry: TimeEntry) {
    setEditRequest(entry)
    setReason('')
    setNewCheckIn(entry.checkIn)
    setNewCheckOut(entry.checkOut)
  }

  function submitEditRequest() {
    if (!editRequest) return
    setRecords((prev) =>
      prev.map((r) => (r.id === editRequest.id ? { ...r, editRequest: { checkIn: newCheckIn, checkOut: newCheckOut, reason } } : r)),
    )
    setEditRequest(null)
    setReason('')
  }

  const filteredPayslips = payslips.filter((p) => p.month.includes(search))
  const filteredRecords = records.filter((r) => r.date.includes(search))

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <IconButton onClick={() => navigate('/time-tracking')} sx={{ bgcolor: '#EFF6FF', color: colors.navy, borderRadius: 2, mb: 1.5 }}>
        <UndoOutlinedIcon />
      </IconButton>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 3 }}>
        ประวัติและการเงิน
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: colors.navy, color: '#fff', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, opacity: 0.8 }}>ชั่วโมงรวม (เดือนนี้)</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700 }}>{totalHours} ชม.</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: '#EFF6FF', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: '#0F62FE' }}>รายได้สุทธิ (เดือนนี้)</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#0F62FE' }}>฿{currency.format(netPay)}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: '#F0F0F0', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>รอยืนยันรับเงิน</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: colors.navy }}>{pendingCount} รายการ</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1, bgcolor: '#F0F0F0', borderRadius: '20px', p: 0.5 }}>
          <Button
            onClick={() => setTab('history')}
            sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'history' ? '#fff' : 'transparent', color: colors.navy, boxShadow: tab === 'history' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}
          >
            ประวัติการลงเวลา
          </Button>
          <Button
            onClick={() => setTab('payslips')}
            sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === 'payslips' ? '#fff' : 'transparent', color: colors.navy, boxShadow: tab === 'payslips' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}
          >
            สลีปเงินเดือน
          </Button>
        </Box>
        <TextField
          placeholder="Search"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
        />
      </Box>

      {tab === 'payslips' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredPayslips.map((p) => (
            <Box key={p.id} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{p.month}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: p.status === 'confirmed' ? '#217829' : '#B5850C' }}>
                  ฿{currency.format(p.hours * p.rate)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 0.5 }}>
                <Typography sx={{ fontSize: 13, color: '#697077' }}>{p.hours.toFixed(2)} ชั่วโมง x {p.rate.toFixed(2)} บาท</Typography>
                <Chip
                  label={p.status === 'confirmed' ? 'รับเงินแล้ว' : 'รอยืนยัน'}
                  size="small"
                  sx={{ bgcolor: p.status === 'confirmed' ? '#EAF7EA' : '#FFF0DD', color: p.status === 'confirmed' ? '#217829' : '#B5850C', fontWeight: 600 }}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button startIcon={<DownloadOutlinedIcon />} sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, border: `1px solid ${colors.border}` }}>
                  ดาวน์โหลดสลีป (PDF)
                </Button>
                {p.status === 'pending' && (
                  <Button
                    startIcon={<ReceiptLongOutlinedIcon />}
                    onClick={() => setSelected(p)}
                    variant="contained"
                    sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
                  >
                    ยืนยันการรับเงิน
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          {filteredPayslips.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อมูล</Typography>}
        </Box>
      )}

      {tab === 'history' && (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 0.9fr 0.6fr 0.9fr 1fr 1.9fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['วันที่', 'เวลาเข้างาน', 'เวลาออกงาน', 'ชั่วโมง', 'สถานะเวลา', 'สถานะเงิน', 'จัดการ'].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filteredRecords.map((r, index) => (
            <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: '0.9fr 0.9fr 0.9fr 0.6fr 0.9fr 1fr 1.9fr', alignItems: 'center', px: 2.5, py: 1.75, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
              <Typography sx={{ fontSize: 14 }}>{r.date}</Typography>
              <Typography sx={{ fontSize: 14 }}>{r.checkIn} น.</Typography>
              <Typography sx={{ fontSize: 14 }}>{r.checkOut} น.</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.hours.toFixed(2)} ชม.</Typography>
              <Chip
                size="small"
                label={studentTimeStatusChip[r.timeStatus].label}
                sx={{ bgcolor: studentTimeStatusChip[r.timeStatus].bg, color: studentTimeStatusChip[r.timeStatus].color, fontWeight: 600, width: 'fit-content' }}
              />
              <Chip
                size="small"
                label={shiftPaymentStatusChip[r.paymentStatus].label}
                sx={{
                  bgcolor: shiftPaymentStatusChip[r.paymentStatus].bg,
                  color: shiftPaymentStatusChip[r.paymentStatus].color,
                  border: shiftPaymentStatusChip[r.paymentStatus].border ? `1px solid ${shiftPaymentStatusChip[r.paymentStatus].border}` : 'none',
                  fontWeight: 600,
                  width: 'fit-content',
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {r.paymentStatus !== 'confirmed' && (
                  r.editRequest ? (
                    <Chip
                      size="small"
                      label={`รอการอนุมัติ (${r.editRequest.checkIn}-${r.editRequest.checkOut})`}
                      sx={{ bgcolor: '#FFF0DD', color: '#B5850C', fontWeight: 600, width: 'fit-content' }}
                    />
                  ) : (
                    <Button
                      size="small"
                      startIcon={<EditOutlinedIcon fontSize="small" />}
                      onClick={() => openEditRequest(r)}
                      sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, border: `1px solid ${colors.border}`, width: 'fit-content' }}
                    >
                      แก้ไขเวลา
                    </Button>
                  )
                )}
                {r.paymentStatus === 'pending_confirm' && (
                  <Button
                    size="small"
                    startIcon={<CheckOutlinedIcon fontSize="small" />}
                    onClick={() => setConfirmingShift(r)}
                    variant="contained"
                    sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#217829', width: 'fit-content', '&:hover': { bgcolor: '#1B5F21' } }}
                  >
                    ยืนยันรับเงิน
                  </Button>
                )}
                {r.paymentStatus === 'confirmed' && (
                  <Button
                    size="small"
                    startIcon={<DownloadOutlinedIcon fontSize="small" />}
                    sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, border: `1px solid ${colors.border}`, width: 'fit-content' }}
                  >
                    สลีป
                  </Button>
                )}
              </Box>
            </Box>
          ))}
          {filteredRecords.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อมูล</Typography>}
        </Box>
      )}

      {/* Payslip breakdown / confirm receipt */}
      <Dialog open={selected !== null} onClose={() => setSelected(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {selected && (
          <Box sx={{ p: 3.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ReceiptLongOutlinedIcon sx={{ color: colors.navy }} />
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>สลีปค่าตอบแทน</Typography>
            </Box>

            <Box sx={{ bgcolor: '#F7F9FC', borderRadius: 2, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Row label="เดือนที่ทำงาน" value={selected.month} />
              <Row label="ชั่วโมงรวม" value={`${selected.hours.toFixed(2)} ชั่วโมง`} />
              <Row label="ค่าจ้างต่อชั่วโมง" value={`${selected.rate.toFixed(2)} ฿`} />
              <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 1, mt: 0.5 }}>
                <Row label="ยอดรวม" value={`${currency.format(selected.hours * selected.rate)} ฿`} bold />
              </Box>
            </Box>

            <Typography sx={{ fontSize: 13, color: '#697077', textAlign: 'center', mt: 2.5, mb: 1.5 }}>
              กดยืนยันเพื่อรับทราบว่าได้รับเงินครบถ้วนแล้ว
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setSelected(null)} fullWidth sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy }}>
                ยังไม่ยืนยัน
              </Button>
              <Button
                onClick={() => confirmReceipt(selected.id)}
                fullWidth
                variant="contained"
                startIcon={<CheckOutlinedIcon />}
                sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
              >
                ยืนยันการรับเงิน
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Confirm-receipt (per-shift, from history tab) */}
      <Dialog open={confirmingShift !== null} onClose={() => setConfirmingShift(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {confirmingShift && (
          <Box sx={{ p: 3.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ReceiptLongOutlinedIcon sx={{ color: colors.navy }} />
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>สลีปค่าตอบแทน</Typography>
            </Box>

            <Box sx={{ bgcolor: '#F7F9FC', borderRadius: 2, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Row label="วันที่ทำงาน" value={confirmingShift.date} />
              <Row label="เวลาทำงาน" value={`${confirmingShift.checkIn} – ${confirmingShift.checkOut} น.`} />
              <Row label="ชั่วโมงรวม" value={`${confirmingShift.hours.toFixed(2)} ชั่วโมง`} />
              <Row label="ค่าจ้างต่อชั่วโมง" value={`${confirmingShift.rate.toFixed(2)} ฿`} />
              <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 1, mt: 0.5 }}>
                <Row label="ยอดรวม" value={`${currency.format(confirmingShift.hours * confirmingShift.rate)} ฿`} bold />
              </Box>
            </Box>

            <Typography sx={{ fontSize: 13, color: '#697077', textAlign: 'center', mt: 2.5, mb: 1.5 }}>
              กดยืนยันเพื่อรับทราบว่าได้รับเงินครบถ้วนแล้ว
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setConfirmingShift(null)} fullWidth sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy }}>
                ยังไม่ยืนยัน
              </Button>
              <Button
                onClick={() => confirmShiftReceipt(confirmingShift.id)}
                fullWidth
                variant="contained"
                startIcon={<CheckOutlinedIcon />}
                sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
              >
                ยืนยันการรับเงิน
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Time-edit request */}
      <Dialog open={editRequest !== null} onClose={() => setEditRequest(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {editRequest && (
          <Box sx={{ p: 3.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy, mb: 2 }}>ยื่นคำร้องขอแก้ไขเวลาทำงาน</Typography>

            <Box sx={{ bgcolor: '#EFF6FF', borderRadius: 2, px: 2, py: 1.5, mb: 2.5 }}>
              <Typography sx={{ fontSize: 13, color: colors.navy }}>
                วันที่: <b>{editRequest.date}</b> · เวลาเดิม: <b>{editRequest.checkIn} – {editRequest.checkOut} น.</b>
              </Typography>
            </Box>

            <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.navy, mb: 1.5 }}>ระบุเวลาที่ถูกต้อง</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
              <TextField
                label="เวลาเข้างานที่ถูกต้อง"
                type="time"
                value={newCheckIn}
                onChange={(e) => setNewCheckIn(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="เวลาออกงานที่ถูกต้อง"
                type="time"
                value={newCheckOut}
                onChange={(e) => setNewCheckOut(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <TextField
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เหตุผลการขอแก้ไข"
              fullWidth
              multiline
              minRows={3}
              sx={{ mb: 2.5 }}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', bgcolor: '#FFF3E0', border: '1px solid #FFDFA6', borderRadius: 2, p: 1.5, mb: 2.5 }}>
              <WarningAmberOutlinedIcon sx={{ color: '#B5850C', fontSize: 18, mt: 0.15 }} />
              <Typography sx={{ fontSize: 12, color: '#8A5A00' }}>
                คำร้องจะถูกส่งให้ผู้ประกอบการพิจารณาอนุมัติ และจะถูกบันทึกในประวัติการทำงาน
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                fullWidth
                variant="contained"
                disabled={reason.trim().length === 0}
                onClick={submitEditRequest}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
              >
                ส่งคำร้อง
              </Button>
              <Button
                fullWidth
                onClick={() => setEditRequest(null)}
                sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy }}
              >
                ยกเลิก
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  )
}

function Row({ label, value, bold }: Readonly<{ label: string; value: string; bold?: boolean }>) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography sx={{ fontSize: bold ? 15 : 13, color: bold ? '#000' : '#697077', fontWeight: bold ? 700 : 400 }}>{label}</Typography>
      <Typography sx={{ fontSize: bold ? 17 : 13, color: '#000', fontWeight: bold ? 700 : 600 }}>{value}</Typography>
    </Box>
  )
}

// ─── Employer: compensation management ─────────────────────────────────────

type PaymentRowStatus = 'awaiting' | 'transferred_pending_confirm' | 'confirmed'

type CompensationRow = {
  id: number
  name: string
  hours: number
  rate: number
  timeStatus: TimeReviewStatus
  paymentStatus: PaymentRowStatus
}

const INITIAL_COMPENSATION_ROWS: CompensationRow[] = [
  { id: 1, name: 'บพรัตน์ เชิดชม', hours: 30, rate: 50, timeStatus: 'approved', paymentStatus: 'awaiting' },
  { id: 2, name: 'อ้วน อาชัน', hours: 45, rate: 50, timeStatus: 'approved', paymentStatus: 'transferred_pending_confirm' },
  { id: 3, name: 'อ้วน ชิโป้', hours: 20, rate: 60, timeStatus: 'reviewing', paymentStatus: 'awaiting' },
  { id: 4, name: 'ฟิล์ม จั๋ง', hours: 38, rate: 50, timeStatus: 'approved', paymentStatus: 'confirmed' },
]

const timeStatusChip: Record<TimeReviewStatus, { label: string; color: string; bg: string }> = {
  approved: { label: 'อนุมัติแล้ว', color: '#217829', bg: '#EAF7EA' },
  reviewing: { label: 'รอตรวจสอบ', color: '#B5850C', bg: '#FFF0DD' },
}

const paymentStatusChip: Record<PaymentRowStatus, { label: string; color: string; bg: string }> = {
  awaiting: { label: 'รอจ่าย', color: colors.navy, bg: '#F0F0F0' },
  transferred_pending_confirm: { label: 'โอนแล้ว รอยืนยัน', color: '#0F62FE', bg: '#EFF6FF' },
  confirmed: { label: 'ยืนยันแล้ว', color: '#217829', bg: '#EAF7EA' },
}

type PayPeriodReport = {
  id: number
  label: string
  headcount: number
  totalHours: number
  totalAmount: number
  paidAmount: number
  pendingAmount: number
}

const PAY_PERIOD_REPORTS: PayPeriodReport[] = [
  { id: 1, label: 'รอบ: 1 - 15 ก.ค. 2569', headcount: 4, totalHours: 133, totalAmount: 6650, paidAmount: 1200, pendingAmount: 5450 },
  { id: 2, label: 'รอบ: 16 - 30 มิ.ย. 2569', headcount: 3, totalHours: 98, totalAmount: 4900, paidAmount: 4900, pendingAmount: 0 },
]

type PaymentLogEntry = {
  id: number
  studentName: string
  date: string
  method: string
  ref: string
  amount: number
}

const PAYMENT_LOG: PaymentLogEntry[] = [
  { id: 1, studentName: 'นายอ้วน อาชัน', date: '20 ก.ค. 2569', method: 'โอนเงิน', ref: 'TXN-20240720-002', amount: 2250 },
  { id: 2, studentName: 'นายอ้วน ชิโป้', date: '20 ก.ค. 2569', method: 'โอนเงิน', ref: 'TXN-20240720-003', amount: 1900 },
]

function EmployerPayrollView() {
  usePageTitle('จัดการค่าตอบแทน')
  const navigate = useNavigate()

  const [rows, setRows] = useState<CompensationRow[]>(INITIAL_COMPENSATION_ROWS)
  const [tab, setTab] = useState<'calculate' | 'report' | 'log'>('calculate')
  const [search, setSearch] = useState('')
  const [approving, setApproving] = useState<CompensationRow | null>(null)
  const [note, setNote] = useState('')

  const totalPending = rows
    .filter((r) => r.paymentStatus === 'awaiting' && r.timeStatus === 'approved')
    .reduce((sum, r) => sum + r.hours * r.rate, 0)
  const totalPaidThisMonth = rows
    .filter((r) => r.paymentStatus !== 'awaiting')
    .reduce((sum, r) => sum + r.hours * r.rate, 0)

  const filteredRows = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))

  function confirmApprovePayment() {
    if (!approving) return
    setRows((prev) => prev.map((r) => (r.id === approving.id ? { ...r, paymentStatus: 'transferred_pending_confirm' } : r)))
    setApproving(null)
    setNote('')
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <IconButton onClick={() => navigate('/profile')} sx={{ bgcolor: '#EFF6FF', color: colors.navy, borderRadius: 2, mb: 1.5 }}>
        <UndoOutlinedIcon />
      </IconButton>

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 3 }}>
        จัดการค่าตอบแทน
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: colors.navy, color: '#fff', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, opacity: 0.8 }}>รอจ่ายเงิน</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700 }}>฿{currency.format(totalPending)}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: '#EFF6FF', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: '#0F62FE' }}>จ่ายแล้วเดือนนี้</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#0F62FE' }}>฿{currency.format(totalPaidThisMonth)}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: '#F0F0F0', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>พนักงานทั้งหมด</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: colors.navy }}>{rows.length} คน</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {([
            ['calculate', 'คำนวณค่าตอบแทน'],
            ['report', 'รายงานสรุป'],
            ['log', 'บันทึกการจ่ายเงิน'],
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              onClick={() => setTab(key)}
              sx={{ borderRadius: '20px', textTransform: 'none', px: 2.5, bgcolor: tab === key ? colors.navy : '#F0F0F0', color: tab === key ? '#fff' : colors.navy }}
            >
              {label}
            </Button>
          ))}
        </Box>
        <TextField
          placeholder="Search"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
        />
      </Box>

      {tab === 'calculate' && (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1fr 1.3fr 1fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['ชื่อ-นามสกุล', 'ชั่วโมง', 'อัตรา', 'ยอดรวม', 'สถานะเวลา', 'สถานะเงิน', 'จัดการ'].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filteredRows.map((r, index) => {
            const canApprove = r.timeStatus === 'approved' && r.paymentStatus === 'awaiting'
            return (
              <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1fr 1.3fr 1fr', alignItems: 'center', px: 2.5, py: 1.75, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: colors.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {r.name.charAt(0)}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{r.name}</Typography>
                </Box>
                <Typography sx={{ fontSize: 14 }}>{r.hours.toFixed(2)}</Typography>
                <Typography sx={{ fontSize: 14 }}>{r.rate} บ./ชม.</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>฿{currency.format(r.hours * r.rate)}</Typography>
                <Chip size="small" label={timeStatusChip[r.timeStatus].label} sx={{ bgcolor: timeStatusChip[r.timeStatus].bg, color: timeStatusChip[r.timeStatus].color, fontWeight: 600, width: 'fit-content' }} />
                <Chip size="small" label={paymentStatusChip[r.paymentStatus].label} sx={{ bgcolor: paymentStatusChip[r.paymentStatus].bg, color: paymentStatusChip[r.paymentStatus].color, fontWeight: 600, width: 'fit-content' }} />
                {r.paymentStatus === 'awaiting' ? (
                  <Button
                    size="small"
                    disabled={!canApprove}
                    onClick={() => { setApproving(r); setNote('') }}
                    sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', width: 'fit-content', '&:hover': { bgcolor: '#000226' }, '&.Mui-disabled': { bgcolor: '#E0E0E0', color: '#9AA0A6' } }}
                  >
                    อนุมัติจ่าย
                  </Button>
                ) : (
                  <Typography sx={{ fontSize: 13, color: '#9AA0A6' }}>โอนแล้ว</Typography>
                )}
              </Box>
            )
          })}
          {filteredRows.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อมูล</Typography>}
        </Box>
      )}

      {tab === 'report' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {PAY_PERIOD_REPORTS.map((p) => (
            <Box key={p.id} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{p.label}</Typography>
                <Button startIcon={<FileDownloadOutlinedIcon />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2, '&:hover': { bgcolor: '#000226' } }}>
                  Export Excel
                </Button>
              </Box>
              <Typography sx={{ fontSize: 13, color: '#0F62FE', mb: 2 }}>{p.headcount} คน · {p.totalHours} ชั่วโมงรวม</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ bgcolor: '#EFF6FF', borderRadius: 2, px: 2, py: 1 }}>
                  <Typography sx={{ fontSize: 12, color: '#0F62FE' }}>ยอดรวมทั้งหมด</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>฿{currency.format(p.totalAmount)}</Typography>
                </Box>
                <Box sx={{ bgcolor: '#EAF7EA', borderRadius: 2, px: 2, py: 1 }}>
                  <Typography sx={{ fontSize: 12, color: '#217829' }}>จ่ายแล้ว</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#217829' }}>฿{currency.format(p.paidAmount)}</Typography>
                </Box>
                {p.pendingAmount > 0 && (
                  <Box sx={{ bgcolor: '#FFF0DD', borderRadius: 2, px: 2, py: 1 }}>
                    <Typography sx={{ fontSize: 12, color: '#B5850C' }}>รอจ่าย</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#B5850C' }}>฿{currency.format(p.pendingAmount)}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {tab === 'log' && (
        <Box>
          <Typography sx={{ fontSize: 13, color: '#697077', mb: 2 }}>
            รายการที่บันทึกการโอนเงินเรียบร้อยแล้วและนักศึกษายืนยันรับเงินแล้ว
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {PAYMENT_LOG.map((entry) => (
              <Box key={entry.id} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, color: colors.navy }}>{entry.studentName}</Typography>
                  <Typography sx={{ fontSize: 13, color: '#697077' }}>{entry.date} · {entry.method} · Ref: {entry.ref}</Typography>
                  <Button startIcon={<DownloadOutlinedIcon />} size="small" sx={{ mt: 1, borderRadius: '20px', textTransform: 'none', color: colors.navy, border: `1px solid ${colors.border}` }}>
                    ดาวน์โหลดการโอนสลิป (PDF)
                  </Button>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#217829' }}>฿{currency.format(entry.amount)}</Typography>
                  <Chip label="ยืนยันแล้ว" size="small" sx={{ bgcolor: '#EAF7EA', color: '#217829', fontWeight: 600, mt: 0.5 }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Approve payment confirm dialog */}
      <Dialog open={approving !== null} onClose={() => setApproving(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {approving && (
          <Box sx={{ p: 3.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy, mb: 2 }}>ยืนยันการอนุมัติจ่ายค่าตอบแทน</Typography>

            <Box sx={{ bgcolor: '#F7F9FC', borderRadius: 2, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              <Typography sx={{ fontSize: 13, color: '#697077' }}>ชื่อนักศึกษา</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 1 }}>{approving.name}</Typography>
              <Row label="ชั่วโมงงาน" value={`${approving.hours.toFixed(2)} ชั่วโมง`} />
              <Row label="อัตรา" value={`${approving.rate.toFixed(2)} บาท/ชม.`} />
              <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 1, mt: 0.5 }}>
                <Row label="ยอดจ่าย" value={`฿${currency.format(approving.hours * approving.rate)}`} bold />
              </Box>
            </Box>

            <TextField
              placeholder="หมายเหตุ"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              sx={{ mb: 2.5 }}
            />

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setApproving(null)} fullWidth sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy }}>
                ยกเลิก
              </Button>
              <Button
                onClick={confirmApprovePayment}
                fullWidth
                variant="contained"
                sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.ok, '&:hover': { bgcolor: '#1B5F21' } }}
              >
                ยืนยันการโอนเงิน
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  )
}

export default function PayrollPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerPayrollView /> : <StudentPayrollView />
}
