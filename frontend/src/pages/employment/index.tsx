import { useEffect, useState } from 'react'
import { Box, Button, Chip, Dialog, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutlineOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'
import { ErrorAlert } from '../../components/ErrorAlert'
import { ApiError } from '../../services/https'
import { listEmployerApplications } from '../../services/https/applications'
import { acceptAgreement, createAgreement, listMyAgreements, rejectAgreement } from '../../services/https/agreements'
import { listMyInterviews } from '../../services/https/interviews'
import type { Application } from '../../interface/IJobInterface'
import type { AgreementRecord } from '../../interface/IInterviewInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : fallback
}

function agreementCode(id: number): string {
  return `AG-${String(id).padStart(4, '0')}`
}

const statusChipMap: Record<AgreementRecord['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'รอการตอบรับ', color: '#B5850C', bg: '#FFF0DD' },
  accepted: { label: 'มีผลบังคับ', color: '#217829', bg: '#EAF7EA' },
  rejected: { label: 'ปฏิเสธแล้ว', color: '#DA1E28', bg: '#FDEAEA' },
}

// ─────────────────────────── Student side ───────────────────────────
function StudentEmploymentView() {
  usePageTitle('ข้อตกลงการจ้างงาน')
  const navigate = useNavigate()
  const { token } = useAuth()

  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [acceptedDialog, setAcceptedDialog] = useState(false)
  const [rejectedDialog, setRejectedDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listMyAgreements(token!)
        if (!cancelled) setAgreements(data)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อตกลงการจ้างงานไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  const agreement = agreements[0] ?? null

  async function accept() {
    if (!token || !agreement) return
    setSubmitting(true)
    try {
      const updated = await acceptAgreement(token, agreement.id)
      setAgreements((prev) => [updated, ...prev.slice(1)])
      setAcceptedDialog(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'ตอบรับข้อตกลงไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmReject() {
    if (!token || !agreement) return
    setSubmitting(true)
    try {
      const updated = await rejectAgreement(token, agreement.id, { reason: rejectReason })
      setAgreements((prev) => [updated, ...prev.slice(1)])
      setRejecting(false)
      setRejectedDialog(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'ปฏิเสธข้อตกลงไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Box sx={{ maxWidth: 1000, mx: 'auto' }}><ErrorAlert message={error} /><Typography sx={{ color: '#697077' }}>กำลังโหลด...</Typography></Box>
  }

  if (!agreement) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', textAlign: 'center', py: 8 }}>
        <ErrorAlert message={error} />
        <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>ยังไม่มีข้อตกลงการจ้างงาน</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mt: 1 }}>เมื่อผู้ประกอบการส่งข้อตกลงการจ้างงานให้คุณ รายการจะแสดงที่นี่</Typography>
      </Box>
    )
  }

  const statusChip = statusChipMap[agreement.status]

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ErrorAlert message={error} />
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
            <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>ข้อตกลงเลขที่ {agreementCode(agreement.id)}</Typography>
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy, mb: 2 }}>{agreement.company_name}</Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderTop: `1px solid ${colors.border}`, pt: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>วันเริ่มงาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{agreement.start_date}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ระยะเวลา</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{agreement.duration_months} เดือน</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>อัตราค่าตอบแทน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{agreement.wage_rate} บาท / ชั่วโมง</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ชั่วโมงการทำงาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{agreement.working_hours}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>เงื่อนไขการลางาน</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{agreement.leave_policy || '-'}</Typography>
            </Box>
            <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, color: '#697077' }}>ข้อกำหนดอื่น ๆ</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{agreement.additional_terms || '-'}</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>การตัดสินใจ</Typography>

            <Box sx={{ display: 'flex', gap: 1, bgcolor: '#FFF0DD', borderRadius: 2, p: 1.5, mb: 2 }}>
              <LockOutlinedIcon fontSize="small" sx={{ color: '#B5850C' }} />
              <Typography sx={{ fontSize: 12, color: '#8A6A1B' }}>ตรวจสอบรายละเอียดให้ครบก่อนตัดสินใจ การตอบรับ/ปฏิเสธไม่สามารถย้อนกลับได้</Typography>
            </Box>

            {agreement.status === 'pending' && !rejecting && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  disabled={submitting}
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

            {agreement.status === 'pending' && rejecting && (
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
                  disabled={rejectReason.trim().length === 0 || submitting}
                  onClick={confirmReject}
                  sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
                >
                  ยืนยันการปฏิเสธ
                </Button>
              </Box>
            )}

            {agreement.status !== 'pending' && (
              <Typography sx={{ fontSize: 13, color: '#697077' }}>
                คุณได้{agreement.status === 'accepted' ? 'ตอบรับ' : 'ปฏิเสธ'}ข้อตกลงนี้แล้ว
              </Typography>
            )}
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: colors.navy, mb: 1 }}>เมื่อตอบรับ</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.2, fontSize: 13, color: '#333' }}>
              <li>สถานะเปลี่ยนเป็น &quot;มีผลบังคับ&quot;</li>
              <li>จัดเก็บเป็นหลักฐานอ้างอิง</li>
              <li>แจ้งทุกฝ่ายให้รับทราบตรงกัน</li>
            </Box>
          </Box>
        </Box>
      </Box>

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
// Wired to the real backend (B6733827): candidates come from the employer's
// accepted applications; create/list/status go through the new agreement
// endpoints. Status IS a persisted field on EmploymentAgreement (added
// pragmatically — see the model comment), so accept/reject reflect correctly
// after a reload, unlike the interview-result flow.

type AgreementTab = 'create' | 'status' | 'history'

function EmployerEmploymentView() {
  usePageTitle('ระบบตกลงการจ้างงาน')
  const { token } = useAuth()

  const [tab, setTab] = useState<AgreementTab>('create')
  const [applications, setApplications] = useState<Application[]>([])
  const [passedStudentIds, setPassedStudentIds] = useState<Set<number>>(new Set())
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedAgreementId, setSelectedAgreementId] = useState<number | null>(null)

  const [studentId, setStudentId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState('')
  const [durationMonths, setDurationMonths] = useState(4)
  const [wageRate, setWageRate] = useState(60)
  const [workingHours, setWorkingHours] = useState('')
  const [leavePolicy, setLeavePolicy] = useState('')
  const [additionalTerms, setAdditionalTerms] = useState('')

  async function load() {
    if (!token) return
    setLoading(true)
    try {
      const [apps, agrs, interviews] = await Promise.all([listEmployerApplications(token), listMyAgreements(token), listMyInterviews(token)])
      setApplications(apps.filter((a) => a.status === 'accepted'))
      setAgreements(agrs)
      setPassedStudentIds(new Set(interviews.filter((i) => i.result === 'passed').map((i) => i.student_id)))
    } catch (err) {
      setError(apiErrorMessage(err, 'โหลดข้อมูลไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function doLoad() {
      setLoading(true)
      try {
        const [apps, agrs, interviews] = await Promise.all([listEmployerApplications(token!), listMyAgreements(token!), listMyInterviews(token!)])
        if (cancelled) return
        setApplications(apps.filter((a) => a.status === 'accepted'))
        setAgreements(agrs)
        setPassedStudentIds(new Set(interviews.filter((i) => i.result === 'passed').map((i) => i.student_id)))
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void doLoad()
    return () => { cancelled = true }
  }, [token])

  const agreedStudentIds = new Set(agreements.map((a) => a.student_id))
  // An agreement covers the student, not one application, so a candidate holding
  // several accepted applications must still appear once in the list.
  const eligibleCandidates = applications
    .filter((a) => passedStudentIds.has(a.student_id) && !agreedStudentIds.has(a.student_id))
    .filter((a, i, all) => all.findIndex((other) => other.student_id === a.student_id) === i)
  const selectedCandidate = applications.find((a) => a.student_id === studentId) ?? null

  async function send() {
    if (!token || !studentId) return
    setSubmitting(true)
    try {
      await createAgreement(token, {
        student_id: studentId,
        start_date: startDate,
        wage_rate: wageRate,
        duration_months: durationMonths,
        working_hours: workingHours,
        leave_policy: leavePolicy,
        additional_terms: additionalTerms,
      })
      await load()
      setSendConfirmOpen(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'สร้างข้อตกลงไม่สำเร็จ'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Box sx={{ maxWidth: 1100, mx: 'auto' }}><ErrorAlert message={error} /><Typography sx={{ color: '#697077' }}>กำลังโหลด...</Typography></Box>
  }

  const selectedAgreement = agreements.find((a) => a.id === selectedAgreementId) ?? agreements[0] ?? null

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <ErrorAlert message={error} />
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>ระบบตกลงการจ้างงาน</Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 2.5 }}>จัดทำข้อตกลงการจ้างงานแก่นักศึกษาที่ผ่านการสัมภาษณ์ กรอกเงื่อนไขให้ครบทุกหัวข้อ</Typography>

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
            <TextField
              select
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
              fullWidth
              sx={{ mb: 2 }}
              slotProps={{ select: { displayEmpty: true } }}
            >
              <MenuItem value="" disabled>— เลือกผู้สมัครที่ผ่านการสัมภาษณ์ —</MenuItem>
              {eligibleCandidates.map((a) => (
                <MenuItem key={a.student_id} value={a.student_id}>{a.student_name} — {a.position}</MenuItem>
              ))}
            </TextField>
            {eligibleCandidates.length === 0 && (
              <Typography sx={{ fontSize: 12, color: '#9AA0A6', mt: -1.5, mb: 2 }}>
                ยังไม่มีผู้สมัครที่พร้อมทำสัญญา — ต้องนัดสัมภาษณ์และประกาศผล &quot;ผ่าน&quot; ที่เมนู &quot;จัดการนัดหมายสัมภาษณ์&quot; ก่อน
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="วันที่เริ่มงาน" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="ระยะเวลา (เดือน)" type="number" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="อัตราค่าตอบแทน (บาท/ชม.)" type="number" value={wageRate} onChange={(e) => setWageRate(Number(e.target.value))} fullWidth />
              <TextField label="ชั่วโมงการทำงาน" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} placeholder="เช่น ไม่เกิน 20 ชม./สัปดาห์" fullWidth />
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
            <Typography sx={{ fontSize: 12, color: '#697077' }}>คู่สัญญา</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>{selectedCandidate ? selectedCandidate.student_name : '-'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>เริ่มงาน-ระยะเวลา</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>{startDate || '-'} • {durationMonths} เดือน</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>ค่าตอบแทน</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 2 }}>{wageRate} บาท / ชั่วโมง</Typography>
            <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 12, borderRadius: 2, p: 1.5, mb: 2 }}>
              ระบบจะตรวจสอบความครบถ้วนของทุกหัวข้อก่อนบันทึกสถานะ &quot;รอนักศึกษาตอบรับ&quot;
            </Box>
            <Button
              fullWidth
              variant="contained"
              disabled={!studentId || !startDate || !workingHours || submitting}
              onClick={send}
              sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
            >
              {submitting ? 'กำลังส่ง...' : 'ยืนยันสร้างและส่งให้นักศึกษา'}
            </Button>
          </Box>
        </Box>
      )}

      {tab === 'status' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
            {agreements.map((a, index) => (
              <Box
                key={a.id}
                onClick={() => setSelectedAgreementId(a.id)}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, cursor: 'pointer', borderTop: index > 0 ? `1px solid ${colors.border}` : 'none', bgcolor: selectedAgreement?.id === a.id ? '#EFF6FF' : 'transparent' }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{agreementCode(a.id)}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>{a.student_name}</Typography>
                </Box>
                <Chip label={statusChipMap[a.status].label} size="small" sx={{ bgcolor: statusChipMap[a.status].bg, color: statusChipMap[a.status].color, fontWeight: 600 }} />
              </Box>
            ))}
            {agreements.length === 0 && <Typography sx={{ fontSize: 13, color: '#9AA0A6', textAlign: 'center', py: 3 }}>ยังไม่มีข้อตกลงที่สร้าง</Typography>}
          </Box>
          {selectedAgreement && (
            <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{agreementCode(selectedAgreement.id)}</Typography>
                  <Typography sx={{ fontSize: 13, color: '#697077' }}>{selectedAgreement.student_name}</Typography>
                </Box>
                <Chip label={statusChipMap[selectedAgreement.status].label} size="small" sx={{ bgcolor: statusChipMap[selectedAgreement.status].bg, color: statusChipMap[selectedAgreement.status].color, fontWeight: 600 }} />
              </Box>
              {selectedAgreement.status === 'pending' && <Typography sx={{ fontSize: 13, color: '#697077' }}>ส่งให้นักศึกษาแล้ว กำลังรอนักศึกษาตอบรับหรือปฏิเสธ</Typography>}
              {selectedAgreement.status === 'accepted' && <Typography sx={{ fontSize: 13, color: colors.navy }}>นักศึกษาตอบรับข้อตกลงแล้ว — มีผลบังคับตั้งแต่ {selectedAgreement.start_date}</Typography>}
              {selectedAgreement.status === 'rejected' && (
                <Typography sx={{ fontSize: 13, color: '#DA1E28' }}>นักศึกษาปฏิเสธข้อตกลงนี้{selectedAgreement.reject_reason ? `: ${selectedAgreement.reject_reason}` : ''}</Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {tab === 'history' && (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.6fr 1fr 1.2fr', bgcolor: '#F7F9FC', px: 2.5, py: 1.5 }}>
            {['เลขที่', 'รายการ', 'คู่สัญญา', 'วันที่', 'สถานะ'].map((h) => (
              <Typography key={h} sx={{ fontSize: 12, fontWeight: 700, color: '#697077' }}>{h}</Typography>
            ))}
          </Box>
          {agreements.map((r, index) => (
            <Box key={r.id} sx={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.6fr 1fr 1.2fr', alignItems: 'center', px: 2.5, py: 1.5, borderTop: index > 0 ? `1px solid ${colors.border}` : 'none' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: colors.navy }}>{agreementCode(r.id)}</Typography>
              <Typography sx={{ fontSize: 13 }}>ข้อตกลงจ้างงาน</Typography>
              <Typography sx={{ fontSize: 13 }}>{r.student_name}</Typography>
              <Typography sx={{ fontSize: 13 }}>{r.start_date}</Typography>
              <Chip label={statusChipMap[r.status].label} size="small" sx={{ bgcolor: statusChipMap[r.status].bg, color: statusChipMap[r.status].color, fontWeight: 600, justifySelf: 'start' }} />
            </Box>
          ))}
          {agreements.length === 0 && <Typography sx={{ fontSize: 13, color: '#9AA0A6', textAlign: 'center', py: 3 }}>ยังไม่มีประวัติ</Typography>}
        </Box>
      )}

      <Dialog open={sendConfirmOpen} onClose={() => setSendConfirmOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
          <IconButton size="small" onClick={() => setSendConfirmOpen(false)} sx={{ position: 'absolute', top: 12, right: 12 }}><CloseOutlinedIcon fontSize="small" /></IconButton>
          <MailOutlineIcon sx={{ fontSize: 96, color: '#EA4335' }} />
          <Typography sx={{ fontSize: 14, color: '#333', mt: 2 }}>
            ส่งข้อตกลงการจ้างงานและแจ้งเตือนไปยังนักศึกษาเรียบร้อยแล้ว
          </Typography>
          <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mt: 2.5 }}>
            * กรุณารอการยืนยันผลการตอบรับจากนักศึกษาที่แท็บ &quot;รายละเอียด / ตอบรับ-ปฏิเสธ&quot;
          </Box>
          <Button
            onClick={() => { setSendConfirmOpen(false); setTab('status'); setStudentId(''); setStartDate(''); setWorkingHours(''); setLeavePolicy(''); setAdditionalTerms('') }}
            sx={{ mt: 2.5, textTransform: 'none', color: colors.navy }}
          >
            ← ตกลง
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}

export default function EmploymentPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerEmploymentView /> : <StudentEmploymentView />
}
