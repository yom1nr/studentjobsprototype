import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'
import { ErrorAlert } from '../../components/ErrorAlert'
import { ApiError } from '../../services/https'
import { listMyTimeRecords, createEditRequest } from '../../services/https/time-records'
import { approvePayroll, confirmPayrollReceipt, createPayroll, getMonthlyPayrollSummary, listMyPayrolls } from '../../services/https/payrolls'
import { listMyAgreements } from '../../services/https/agreements'
import type { TimeRecordEntry } from '../../interface/ITimeTrackingInterface'
import type { PayrollRecord, PayrollSummary } from '../../interface/IPayrollInterface'
import type { AgreementRecord } from '../../interface/IInterviewInterface'

const colors = { navy: '#012150', border: '#DDE1E6', ok: '#217829' }
const currency = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 })

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : fallback
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

const payrollStatusChip: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'รอจ่าย', color: '#012150', bg: '#F0F0F0' },
  paid_unconfirmed: { label: 'โอนแล้ว รอยืนยัน', color: '#5A4FCF', bg: '#EDEBFB' },
  confirmed: { label: 'รับเงินแล้ว', color: '#217829', bg: '#EAF7EA' },
}

function payrollStatusKey(p: PayrollRecord): keyof typeof payrollStatusChip {
  if (p.payment_status === 'paid' && p.is_student_confirmed) return 'confirmed'
  if (p.payment_status === 'paid') return 'paid_unconfirmed'
  return 'pending'
}

// ─── Student side ───────────────────────────────────────────────────────────
// Wired to the real backend (B6729875): time-record history from
// GET /student/time-records, payslips from GET /payrolls (period-level, per
// EmploymentAgreement) — there's no persisted per-shift payment status in the
// diagram, so unlike the earlier mock, per-shift "confirm receipt" isn't
// offered; receipt confirmation happens at the payroll-cycle level.
function StudentPayrollView() {
  usePageTitle('ประวัติการลงเวลา')
  const navigate = useNavigate()
  const { token } = useAuth()

  const [tab, setTab] = useState<'history' | 'payslips'>('payslips')
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState<TimeRecordEntry[]>([])
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PayrollRecord | null>(null)
  const [editRequest, setEditRequest] = useState<TimeRecordEntry | null>(null)
  const [newCheckIn, setNewCheckIn] = useState('')
  const [newCheckOut, setNewCheckOut] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function doLoad() {
      setLoading(true)
      try {
        const [rec, pay] = await Promise.all([listMyTimeRecords(token!), listMyPayrolls(token!)])
        if (cancelled) return
        setRecords(rec)
        setPayrolls(pay)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void doLoad()
    return () => { cancelled = true }
  }, [token])

  const totalHours = records.reduce((s, r) => s + r.hours, 0)
  const netPay = payrolls.reduce((s, p) => s + p.net_pay_amount, 0)
  const pendingCount = payrolls.filter((p) => p.payment_status === 'paid' && !p.is_student_confirmed).length

  async function confirmReceipt(id: number) {
    if (!token) return
    setSubmitting(true)
    try {
      const updated = await confirmPayrollReceipt(token, id)
      setPayrolls((prev) => prev.map((p) => (p.id === id ? updated : p)))
      setSelected(null)
    } catch (err) {
      setError(apiErrorMessage(err, 'ยืนยันการรับเงินไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  function openEditRequest(entry: TimeRecordEntry) {
    setEditRequest(entry)
    setReason('')
    setNewCheckIn(entry.check_in_time.slice(0, 16))
    setNewCheckOut(entry.check_out_time ? entry.check_out_time.slice(0, 16) : '')
  }

  async function submitEditRequest() {
    if (!token || !editRequest) return
    setSubmitting(true)
    try {
      const updated = await createEditRequest(token, editRequest.id, {
        new_check_in_time: new Date(newCheckIn).toISOString(),
        new_check_out_time: newCheckOut ? new Date(newCheckOut).toISOString() : '',
        reason,
      })
      setRecords((prev) => prev.map((r) => (r.id === editRequest.id ? { ...r, edit_request: updated } : r)))
      setEditRequest(null)
      setReason('')
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งคำร้องขอแก้ไขไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  const filteredPayrolls = payrolls.filter((p) => formatDate(p.cycle_start_date).includes(search) || search === '')
  const filteredRecords = records.filter((r) => formatDate(r.check_in_time).includes(search) || search === '')

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ErrorAlert message={error} />
      <IconButton onClick={() => navigate('/time-tracking')} sx={{ bgcolor: '#EFF6FF', color: colors.navy, borderRadius: 2, mb: 1.5 }}>
        <UndoOutlinedIcon />
      </IconButton>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 3 }}>
        ประวัติและการเงิน
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: colors.navy, color: '#fff', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, opacity: 0.8 }}>ชั่วโมงรวม</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700 }}>{totalHours.toFixed(2)} ชม.</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: '#EFF6FF', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: '#0F62FE' }}>รายได้สุทธิรวม</Typography>
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

      {loading && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>กำลังโหลด...</Typography>}

      {!loading && tab === 'payslips' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredPayrolls.map((p) => {
            const key = payrollStatusKey(p)
            const chip = payrollStatusChip[key]
            return (
              <Box key={p.id} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{formatDate(p.cycle_start_date)} - {formatDate(p.cycle_end_date)}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: key === 'confirmed' ? '#217829' : '#B5850C' }}>
                    ฿{currency.format(p.net_pay_amount)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 0.5 }}>
                  <Typography sx={{ fontSize: 13, color: '#697077' }}>{p.total_hours.toFixed(2)} ชั่วโมง x {p.wage_rate.toFixed(2)} บาท • {p.company_name}</Typography>
                  <Chip label={chip.label} size="small" sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600 }} />
                </Box>
                {key === 'paid_unconfirmed' && (
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      startIcon={<ReceiptLongOutlinedIcon />}
                      onClick={() => setSelected(p)}
                      variant="contained"
                      sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
                    >
                      ยืนยันการรับเงิน
                    </Button>
                  </Box>
                )}
              </Box>
            )
          })}
          {filteredPayrolls.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อมูล</Typography>}
        </Box>
      )}

      {!loading && tab === 'history' && (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.7fr 1.6fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['วันที่', 'เวลาเข้างาน', 'เวลาออกงาน', 'ชั่วโมง', 'จัดการ'].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {filteredRecords.map((r, index) => (
            <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.7fr 1.6fr', alignItems: 'center', px: 2.5, py: 1.75, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
              <Typography sx={{ fontSize: 14 }}>{formatDate(r.check_in_time)}</Typography>
              <Typography sx={{ fontSize: 14 }}>{formatTime(r.check_in_time)} น.</Typography>
              <Typography sx={{ fontSize: 14 }}>{r.check_out_time ? `${formatTime(r.check_out_time)} น.` : '-'}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.hours.toFixed(2)} ชม.</Typography>
              <Box>
                {r.edit_request ? (
                  <Chip
                    size="small"
                    label={
                      r.edit_request.request_status === 'pending'
                        ? 'รอการอนุมัติ'
                        : r.edit_request.request_status === 'approved'
                          ? 'แก้ไขแล้ว'
                          : 'ถูกปฏิเสธ'
                    }
                    sx={{ bgcolor: '#FFF0DD', color: '#B5850C', fontWeight: 600, width: 'fit-content' }}
                  />
                ) : r.check_out_time ? (
                  <Button
                    size="small"
                    startIcon={<EditOutlinedIcon fontSize="small" />}
                    onClick={() => openEditRequest(r)}
                    sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, border: `1px solid ${colors.border}`, width: 'fit-content' }}
                  >
                    แก้ไขเวลา
                  </Button>
                ) : (
                  <Typography sx={{ fontSize: 13, color: '#9AA0A6' }}>ยังไม่เช็คเอาท์</Typography>
                )}
              </Box>
            </Box>
          ))}
          {filteredRecords.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่พบข้อมูล</Typography>}
        </Box>
      )}

      {/* Confirm receipt */}
      <Dialog open={selected !== null} onClose={() => setSelected(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {selected && (
          <Box sx={{ p: 3.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ReceiptLongOutlinedIcon sx={{ color: colors.navy }} />
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>สลีปค่าตอบแทน</Typography>
            </Box>

            <Box sx={{ bgcolor: '#F7F9FC', borderRadius: 2, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Row label="รอบ" value={`${formatDate(selected.cycle_start_date)} - ${formatDate(selected.cycle_end_date)}`} />
              <Row label="ชั่วโมงรวม" value={`${selected.total_hours.toFixed(2)} ชั่วโมง`} />
              <Row label="ค่าจ้างต่อชั่วโมง" value={`${selected.wage_rate.toFixed(2)} ฿`} />
              <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 1, mt: 0.5 }}>
                <Row label="ยอดรวม" value={`${currency.format(selected.net_pay_amount)} ฿`} bold />
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
                onClick={() => void confirmReceipt(selected.id)}
                fullWidth
                variant="contained"
                disabled={submitting}
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
                วันที่: <b>{formatDate(editRequest.check_in_time)}</b> · เวลาเดิม: <b>{formatTime(editRequest.check_in_time)} - {formatTime(editRequest.check_out_time)} น.</b>
              </Typography>
            </Box>

            <Typography sx={{ fontSize: 13, fontWeight: 700, color: colors.navy, mb: 1.5 }}>ระบุเวลาที่ถูกต้อง</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2.5 }}>
              <TextField
                label="เวลาเข้างานที่ถูกต้อง"
                type="datetime-local"
                value={newCheckIn}
                onChange={(e) => setNewCheckIn(e.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="เวลาออกงานที่ถูกต้อง"
                type="datetime-local"
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
                disabled={reason.trim().length === 0 || !newCheckIn || submitting}
                onClick={() => void submitEditRequest()}
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
// Wired to the real backend: employer picks one of their accepted agreements +
// a date range and calculates a pay cycle from real completed time records
// (POST /employer/payrolls), then approves the transfer. "รายงานสรุป" and
// "บันทึกการจ่ายเงิน" are derived client-side from the real payroll list
// rather than separate mocked datasets.
function EmployerPayrollView() {
  usePageTitle('จัดการค่าตอบแทน')
  const navigate = useNavigate()
  const { token } = useAuth()

  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'calculate' | 'report' | 'log'>('calculate')
  const [search, setSearch] = useState('')
  const [approving, setApproving] = useState<PayrollRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [agreementId, setAgreementId] = useState<number | ''>('')
  const [cycleStart, setCycleStart] = useState('')
  const [cycleEnd, setCycleEnd] = useState('')

  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [summary, setSummary] = useState<PayrollSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function doLoad() {
      setLoading(true)
      try {
        const [agrs, pays] = await Promise.all([listMyAgreements(token!), listMyPayrolls(token!)])
        if (cancelled) return
        setAgreements(agrs.filter((a) => a.status === 'accepted'))
        setPayrolls(pays)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void doLoad()
    return () => { cancelled = true }
  }, [token])

  async function reload() {
    if (!token) return
    try {
      const pays = await listMyPayrolls(token)
      setPayrolls(pays)
    } catch (err) {
      setError(apiErrorMessage(err, 'โหลดข้อมูลไม่สำเร็จ'))
    }
  }

  useEffect(() => {
    if (!token || tab !== 'report') return
    let cancelled = false
    setSummaryLoading(true)
    getMonthlyPayrollSummary(token, reportMonth)
      .then((s) => { if (!cancelled) setSummary(s) })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, 'โหลดรายงานไม่สำเร็จ')) })
      .finally(() => { if (!cancelled) setSummaryLoading(false) })
    return () => { cancelled = true }
  }, [token, tab, reportMonth])

  const totalPending = payrolls.filter((p) => p.payment_status === 'pending').reduce((sum, p) => sum + p.net_pay_amount, 0)
  const totalPaid = payrolls.filter((p) => p.payment_status === 'paid').reduce((sum, p) => sum + p.net_pay_amount, 0)

  const filteredPayrolls = payrolls.filter((p) => p.student_name.toLowerCase().includes(search.toLowerCase()))
  const pendingPayrolls = filteredPayrolls.filter((p) => p.payment_status === 'pending')
  const paidPayrolls = filteredPayrolls.filter((p) => p.payment_status === 'paid')

  async function calculate() {
    if (!token || !agreementId || !cycleStart || !cycleEnd) return
    setSubmitting(true)
    try {
      await createPayroll(token, { employment_agreement_id: agreementId, cycle_start_date: cycleStart, cycle_end_date: cycleEnd })
      await reload()
      setAgreementId('')
      setCycleStart('')
      setCycleEnd('')
    } catch (err) {
      setError(apiErrorMessage(err, 'คำนวณค่าตอบแทนไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmApprovePayment() {
    if (!token || !approving) return
    setSubmitting(true)
    try {
      const updated = await approvePayroll(token, approving.id)
      setPayrolls((prev) => prev.map((p) => (p.id === approving.id ? updated : p)))
      setApproving(null)
    } catch (err) {
      setError(apiErrorMessage(err, 'อนุมัติจ่ายไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <ErrorAlert message={error} />
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
          <Typography sx={{ fontSize: 13, color: '#0F62FE' }}>จ่ายแล้วทั้งหมด</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#0F62FE' }}>฿{currency.format(totalPaid)}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 200, bgcolor: '#F0F0F0', borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: '#697077' }}>ลูกจ้างที่มีสัญญา</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 700, color: colors.navy }}>{agreements.length} คน</Typography>
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

      {loading && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>กำลังโหลด...</Typography>}

      {!loading && tab === 'calculate' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>คำนวณรอบจ่ายใหม่</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField select label="พนักงาน" value={agreementId} onChange={(e) => setAgreementId(Number(e.target.value))} sx={{ minWidth: 220 }}>
                {agreements.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.student_name}</MenuItem>
                ))}
              </TextField>
              <TextField label="เริ่มรอบ" type="date" value={cycleStart} onChange={(e) => setCycleStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="สิ้นสุดรอบ" type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <Button
                variant="contained"
                disabled={!agreementId || !cycleStart || !cycleEnd || submitting}
                onClick={() => void calculate()}
                sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
              >
                คำนวณ
              </Button>
            </Box>
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1.3fr 1fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
              {['ชื่อ-นามสกุล', 'ชั่วโมง', 'อัตรา', 'ยอดรวม', 'สถานะเงิน', 'จัดการ'].map((h) => (
                <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
              ))}
            </Box>
            {pendingPayrolls.map((r, index) => (
              <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1.3fr 1fr', alignItems: 'center', px: 2.5, py: 1.75, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: colors.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {r.student_name.charAt(0)}
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{r.student_name}</Typography>
                </Box>
                <Typography sx={{ fontSize: 14 }}>{r.total_hours.toFixed(2)}</Typography>
                <Typography sx={{ fontSize: 14 }}>{r.wage_rate.toFixed(2)} บ./ชม.</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>฿{currency.format(r.net_pay_amount)}</Typography>
                <Chip size="small" label={payrollStatusChip.pending.label} sx={{ bgcolor: payrollStatusChip.pending.bg, color: payrollStatusChip.pending.color, fontWeight: 600, width: 'fit-content' }} />
                <Button
                  size="small"
                  onClick={() => setApproving(r)}
                  sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', width: 'fit-content', '&:hover': { bgcolor: '#000226' } }}
                >
                  อนุมัติจ่าย
                </Button>
              </Box>
            ))}
            {pendingPayrolls.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่มีรายการรอจ่าย</Typography>}
          </Box>
        </Box>
      )}

      {!loading && tab === 'report' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>รายงานสรุปยอดจ่ายค่าจ้างประจำเดือน</Typography>
            <TextField
              type="month"
              size="small"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
            />
          </Box>

          {summaryLoading && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>กำลังโหลด...</Typography>}

          {!summaryLoading && summary && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {([
                  ['ยอดรวมทั้งเดือน', `฿${currency.format(summary.total_amount)}`, colors.navy, '#F7F9FC'],
                  ['จ่ายแล้ว', `฿${currency.format(summary.paid_amount)}`, '#217829', '#EAF7EA'],
                  ['รอจ่าย', `฿${currency.format(summary.pending_amount)}`, '#B5850C', '#FFF0DD'],
                  ['รอบจ่าย / ยืนยันรับแล้ว', `${summary.total_cycles} / ${summary.confirmed_count}`, '#0F62FE', '#EFF6FF'],
                ] as const).map(([label, value, color, bg]) => (
                  <Box key={label} sx={{ flex: 1, minWidth: 180, bgcolor: bg, borderRadius: 3, p: 2.5 }}>
                    <Typography sx={{ fontSize: 13, color }}>{label}</Typography>
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: 13, color: '#697077' }}>รวม {summary.total_hours.toFixed(2)} ชั่วโมงทำงานในเดือนนี้</Typography>

              <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.8fr 1fr 1fr 1fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
                  {['ชื่อ-นามสกุล', 'รอบ', 'ชั่วโมง', 'ยอดรวม', 'จ่ายแล้ว', 'รอจ่าย'].map((h) => (
                    <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
                  ))}
                </Box>
                {summary.by_student
                  .filter((row) => row.student_name.toLowerCase().includes(search.toLowerCase()))
                  .map((row, index) => (
                    <Box key={row.student_id} sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.8fr 1fr 1fr 1fr', alignItems: 'center', px: 2.5, py: 1.75, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: colors.navy }}>{row.student_name || `#${row.student_id}`}</Typography>
                      <Typography sx={{ fontSize: 14 }}>{row.cycles}</Typography>
                      <Typography sx={{ fontSize: 14 }}>{row.total_hours.toFixed(2)}</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>฿{currency.format(row.total_amount)}</Typography>
                      <Typography sx={{ fontSize: 14, color: '#217829' }}>฿{currency.format(row.paid_amount)}</Typography>
                      <Typography sx={{ fontSize: 14, color: '#B5850C' }}>฿{currency.format(row.pending_amount)}</Typography>
                    </Box>
                  ))}
                {summary.by_student.length === 0 && (
                  <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่มีรอบจ่ายในเดือนนี้</Typography>
                )}
              </Box>
            </>
          )}
        </Box>
      )}

      {!loading && tab === 'log' && (
        <Box>
          <Typography sx={{ fontSize: 13, color: '#697077', mb: 2 }}>
            รายการที่บันทึกการโอนเงินเรียบร้อยแล้ว
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {paidPayrolls.map((p) => (
              <Box key={p.id} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 17, color: colors.navy }}>{p.student_name}</Typography>
                  <Typography sx={{ fontSize: 13, color: '#697077' }}>{p.transfer_date_time ? new Date(p.transfer_date_time).toLocaleString('th-TH') : '-'} · โอนเงิน</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 20, color: '#217829' }}>฿{currency.format(p.net_pay_amount)}</Typography>
                  <Chip label={p.is_student_confirmed ? 'ยืนยันแล้ว' : 'รอนักศึกษายืนยัน'} size="small" sx={{ bgcolor: p.is_student_confirmed ? '#EAF7EA' : '#FFF0DD', color: p.is_student_confirmed ? '#217829' : '#B5850C', fontWeight: 600, mt: 0.5 }} />
                </Box>
              </Box>
            ))}
            {paidPayrolls.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ยังไม่มีการจ่ายเงิน</Typography>}
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
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 1 }}>{approving.student_name}</Typography>
              <Row label="ชั่วโมงงาน" value={`${approving.total_hours.toFixed(2)} ชั่วโมง`} />
              <Row label="อัตรา" value={`${approving.wage_rate.toFixed(2)} บาท/ชม.`} />
              <Box sx={{ borderTop: `1px solid ${colors.border}`, pt: 1, mt: 0.5 }}>
                <Row label="ยอดจ่าย" value={`฿${currency.format(approving.net_pay_amount)}`} bold />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setApproving(null)} fullWidth sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy }}>
                ยกเลิก
              </Button>
              <Button
                onClick={() => void confirmApprovePayment()}
                fullWidth
                variant="contained"
                disabled={submitting}
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
