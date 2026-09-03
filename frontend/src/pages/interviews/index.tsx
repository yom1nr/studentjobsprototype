import { useEffect, useState } from 'react'
import { Box, Button, Chip, Dialog, IconButton, TextField, Typography } from '@mui/material'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import MailOutlineIcon from '@mui/icons-material/MailOutlineOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'
import { ErrorAlert } from '../../components/ErrorAlert'
import { ApiError } from '../../services/https'
import { listEmployerApplications } from '../../services/https/applications'
import {
  confirmInterviewAttendance,
  createInterview,
  listMyInterviews,
  requestReschedule,
  sendInterviewResult,
  updateInterview,
} from '../../services/https/interviews'
import type { Application } from '../../interface/IJobInterface'
import type { InterviewScheduleRecord } from '../../interface/IInterviewInterface'

const colors = { navy: '#012150', border: '#DDE1E6', ok: '#217829' }

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : fallback
}

function StepCard({
  step,
  title,
  subtitle,
  statusLabel,
  statusColor,
  statusBg,
  locked,
  actionLabel,
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
  actionLabel: string
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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', border: `1px solid ${colors.border}`, borderRadius: 2, p: 1.5 }}>
        <Button
          disabled={locked}
          onClick={onAction}
          endIcon={<ArrowForwardIcon fontSize="small" />}
          size="small"
          sx={{ bgcolor: locked ? '#E0E0E0' : actionColor, color: locked ? '#9AA0A6' : '#fff', borderRadius: '20px', textTransform: 'none', px: 2 }}
        >
          {actionLabel}
        </Button>
      </Box>
    </Box>
  )
}

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
          เรียบร้อยแล้วและทำการอัพเดตผลไปยังอีกฝ่ายเรียบร้อย
        </Typography>
        <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mt: 2.5 }}>{note}</Box>
        <Button onClick={onBack} sx={{ mt: 2.5, textTransform: 'none', color: colors.navy }}>← ตกลง</Button>
      </Box>
    </Dialog>
  )
}

// ─────────────────────────── Student side ───────────────────────────
function StudentInterviewsView() {
  usePageTitle('ประกาศกำหนดการสัมภาษณ์ / ผลการสัมภาษณ์')
  const { token } = useAuth()
  const navigate = useNavigate()

  const [interviews, setInterviews] = useState<InterviewScheduleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'appointment'>('list')

  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleRequested, setRescheduleRequested] = useState(false)

  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await listMyInterviews(token!)
        if (!cancelled) setInterviews(data)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลนัดสัมภาษณ์ไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  const interview = interviews[0] ?? null

  async function submitReschedule() {
    if (!token || !interview) return
    setRescheduleSubmitting(true)
    try {
      await requestReschedule(token, interview.id, {
        reason: rescheduleReason,
        student_available_date_time: rescheduleDate && rescheduleTime ? `${rescheduleDate}T${rescheduleTime}:00Z` : undefined,
      })
      setRescheduleRequested(true)
      setRescheduleOpen(false)
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งคำขอเลื่อนนัดไม่สำเร็จ'))
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  async function confirmAttendance() {
    if (!token || !interview) return
    setConfirming(true)
    try {
      await confirmInterviewAttendance(token, interview.id)
      setConfirmed(true)
      setView('list')
    } catch (err) {
      setError(apiErrorMessage(err, 'ยืนยันเข้ารับสัมภาษณ์ไม่สำเร็จ'))
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return <Box sx={{ maxWidth: 850, mx: 'auto' }}><ErrorAlert message={error} /><Typography sx={{ color: '#697077' }}>กำลังโหลด...</Typography></Box>
  }

  if (!interview) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', textAlign: 'center', py: 8 }}>
        <ErrorAlert message={error} />
        <EventOutlinedIcon sx={{ fontSize: 80, color: '#DDE1E6' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy, mt: 2 }}>ยังไม่มีการนัดสัมภาษณ์</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mt: 1 }}>เมื่อผู้ประกอบการนัดสัมภาษณ์คุณ รายการจะแสดงที่นี่</Typography>
      </Box>
    )
  }

  if (view === 'appointment') {
    return (
      <Box sx={{ maxWidth: 950, mx: 'auto' }}>
        <ErrorAlert message={error} />
        <Button onClick={() => setView('list')} sx={{ textTransform: 'none', color: colors.navy, mb: 1, px: 0 }}>← กลับ</Button>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>รายละเอียดนัดสัมภาษณ์</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>ตรวจสอบรายละเอียดนัดหมาย และยืนยันการเข้ารับสัมภาษณ์</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Chip label={confirmed ? 'ยืนยันแล้ว' : 'รอการยืนยัน'} size="small" sx={{ bgcolor: confirmed ? '#EAF7EA' : '#FFF0DD', color: confirmed ? colors.ok : '#B5850C', fontWeight: 600 }} />
              <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>นัดหมายเลขที่ IV-{String(interview.id).padStart(4, '0')}</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>{interview.company_name}</Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, borderTop: `1px solid ${colors.border}`, pt: 2, mb: 2, mt: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EventOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>วันที่</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.appointment_date}</Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>เวลา</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.appointment_time} น.</Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PlaceOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                  <Typography sx={{ fontSize: 12, color: '#697077' }}>รูปแบบ</Typography>
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{interview.interview_format === 'onsite' ? 'สัมภาษณ์ ณ สถานที่' : 'สัมภาษณ์ออนไลน์'}</Typography>
              </Box>
            </Box>

            <Typography sx={{ fontSize: 12, color: '#697077' }}>สถานที่ / ลิงก์</Typography>
            <Typography sx={{ fontSize: 14, mb: 2 }}>{interview.location || '-'}</Typography>

            {interview.preparation_details && (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>สิ่งที่ต้องเตรียม</Typography>
                <Typography sx={{ fontSize: 13, color: '#333' }}>{interview.preparation_details}</Typography>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rescheduleRequested ? (
              <Chip label="ส่งคำขอเลื่อนนัดแล้ว รอผู้ประกอบการตอบรับ" sx={{ bgcolor: '#FFF0DD', color: '#B5850C', fontWeight: 600, height: 'auto', py: 1 }} />
            ) : (
              <Button variant="outlined" onClick={() => setRescheduleOpen(true)} sx={{ borderRadius: '40px', textTransform: 'none', color: colors.navy, borderColor: colors.border }}>
                ขอเลื่อน / เปลี่ยนนัด
              </Button>
            )}
            <Button
              variant="contained"
              disabled={confirmed || confirming}
              onClick={confirmAttendance}
              sx={{ borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
            >
              {confirmed ? 'ยืนยันแล้ว' : confirming ? 'กำลังยืนยัน...' : 'ยืนยันเข้ารับสัมภาษณ์'}
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
              นัดหมายเดิม: {interview.appointment_date} เวลา {interview.appointment_time} น.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField label="วันที่สะดวก" type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="เวลาที่สะดวก" type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
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
              disabled={!rescheduleDate || !rescheduleTime || rescheduleReason.trim().length === 0 || rescheduleSubmitting}
              onClick={submitReschedule}
              sx={{ height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              {rescheduleSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอเลื่อนนัด'}
            </Button>
          </Box>
        </Dialog>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 850, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <ErrorAlert message={error} />
      <StepCard
        step={1}
        title="การนัดสัมภาษณ์"
        subtitle={`${interview.company_name} • ${interview.appointment_date} ${interview.appointment_time} น.`}
        statusLabel={confirmed ? 'ยืนยันแล้ว' : 'มีการนัดสัมภาษณ์'}
        statusColor={confirmed ? colors.ok : '#B5850C'}
        statusBg={confirmed ? '#EAF7EA' : '#FFF0DD'}
        locked={false}
        actionLabel="รายละเอียด"
        actionColor={colors.navy}
        onAction={() => setView('appointment')}
      />

      <StepCard
        step={2}
        title="ผลการสัมภาษณ์"
        subtitle="ผลการพิจารณาจะส่งผ่านการแจ้งเตือน"
        statusLabel="ดูที่การแจ้งเตือน"
        statusColor="#0090FF"
        statusBg="#EFF6FF"
        locked={false}
        actionLabel="ไปที่การแจ้งเตือน"
        actionColor="#0090FF"
        onAction={() => navigate('/notifications')}
      />
    </Box>
  )
}

// ─────────────────────────── Employer side ───────────────────────────
// Wired to the real backend (B6733827): candidates come from the employer's
// accepted applications (existing /employer/applications endpoint); scheduling,
// reschedule requests, and interview-result notifications go through the new
// interview endpoints. There's no persisted "confirmed"/"interviewed"/"passed"
// field on InterviewSchedule (not in the class diagram — see
// interview_dto.go's InterviewResultRequest comment), so those states are
// derived loosely (has-interview / has-agreement) rather than tracked exactly.

type EmployerSubview = 'picker' | 'hub' | 'schedule' | 'detail' | 'reschedule' | 'results'

function EmployerInterviewsView() {
  usePageTitle('จัดการนัดหมายสัมภาษณ์')
  const { token } = useAuth()
  const navigate = useNavigate()

  const [applications, setApplications] = useState<Application[]>([])
  const [interviews, setInterviews] = useState<InterviewScheduleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null)
  const [subview, setSubview] = useState<EmployerSubview>('picker')

  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleFormat, setScheduleFormat] = useState<'onsite' | 'online'>('onsite')
  const [scheduleLocation, setScheduleLocation] = useState('')
  const [schedulePrep, setSchedulePrep] = useState('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  const [rescheduleNote, setRescheduleNote] = useState('')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false)

  const [resultComment, setResultComment] = useState('')
  const [resultSubmitting, setResultSubmitting] = useState(false)
  const [resultsConfirmOpen, setResultsConfirmOpen] = useState(false)

  async function load() {
    if (!token) return
    setLoading(true)
    try {
      const [apps, ivs] = await Promise.all([listEmployerApplications(token), listMyInterviews(token)])
      setApplications(apps.filter((a) => a.status === 'accepted'))
      setInterviews(ivs)
    } catch (err) {
      setError(apiErrorMessage(err, 'โหลดข้อมูลผู้สมัครไม่สำเร็จ'))
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
        const [apps, ivs] = await Promise.all([listEmployerApplications(token!), listMyInterviews(token!)])
        if (cancelled) return
        setApplications(apps.filter((a) => a.status === 'accepted'))
        setInterviews(ivs)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลผู้สมัครไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void doLoad()
    return () => { cancelled = true }
  }, [token])

  // Matched per application, not per student: one candidate can hold several
  // accepted applications with this employer, and each is scheduled separately.
  function interviewFor(applicationId: number): InterviewScheduleRecord | null {
    return interviews.find((iv) => iv.application_id === applicationId) ?? null
  }

  const notScheduled = applications.filter((a) => !interviewFor(a.id))
  const scheduled = applications.filter((a) => interviewFor(a.id))

  const selectedApplication = applications.find((a) => a.id === selectedApplicationId) ?? null
  const selectedInterview = selectedApplicationId ? interviewFor(selectedApplicationId) : null

  function pick(applicationId: number) {
    setSelectedApplicationId(applicationId)
    setSubview('hub')
  }

  async function submitSchedule() {
    if (!token || !selectedApplicationId) return
    setScheduleSubmitting(true)
    try {
      const payload = {
        interview_format: scheduleFormat,
        appointment_date: scheduleDate,
        appointment_time: scheduleTime,
        location: scheduleLocation,
        preparation_details: schedulePrep,
      }
      if (selectedInterview) {
        await updateInterview(token, selectedInterview.id, payload)
      } else {
        await createInterview(token, { application_id: selectedApplicationId, ...payload })
      }
      await load()
      setSubview('hub')
    } catch (err) {
      setError(apiErrorMessage(err, 'บันทึกนัดหมายไม่สำเร็จ'))
    } finally {
      setScheduleSubmitting(false)
    }
  }

  function openSchedule() {
    if (selectedInterview) {
      setScheduleDate(selectedInterview.appointment_date)
      setScheduleTime(selectedInterview.appointment_time)
      setScheduleFormat(selectedInterview.interview_format)
      setScheduleLocation(selectedInterview.location)
      setSchedulePrep(selectedInterview.preparation_details)
    } else {
      setScheduleDate('')
      setScheduleTime('')
      setScheduleFormat('onsite')
      setScheduleLocation('')
      setSchedulePrep('')
    }
    setSubview('schedule')
  }

  async function submitReschedule() {
    if (!token || !selectedInterview) return
    setRescheduleSubmitting(true)
    try {
      await requestReschedule(token, selectedInterview.id, { reason: rescheduleNote })
      setRescheduleConfirmOpen(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งคำขอเปลี่ยนกำหนดการไม่สำเร็จ'))
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  async function submitResult(result: 'passed' | 'failed') {
    if (!token || !selectedInterview) return
    setResultSubmitting(true)
    try {
      await sendInterviewResult(token, selectedInterview.id, { result, comment: resultComment })
      setResultsConfirmOpen(true)
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งผลการสัมภาษณ์ไม่สำเร็จ'))
    } finally {
      setResultSubmitting(false)
    }
  }

  if (loading) {
    return <Box sx={{ maxWidth: 1100, mx: 'auto' }}><ErrorAlert message={error} /><Typography sx={{ color: '#697077' }}>กำลังโหลด...</Typography></Box>
  }

  const HubHeader = selectedApplication && (
    <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
          {selectedApplication.student_name.charAt(0)}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>{selectedApplication.student_name}</Typography>
          <Typography sx={{ fontSize: 12, color: '#697077' }}>{selectedApplication.position}</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Chip
          label={
            !selectedInterview
              ? 'ยังไม่มีนัดสัมภาษณ์'
              : selectedInterview.result === 'passed'
                ? 'ผ่านการสัมภาษณ์'
                : selectedInterview.result === 'failed'
                  ? 'ไม่ผ่านการสัมภาษณ์'
                  : 'มีนัดสัมภาษณ์ — รอผล'
          }
          size="small"
          sx={{
            bgcolor: !selectedInterview ? '#F0F0F0' : selectedInterview.result === 'passed' ? '#EAF7EA' : selectedInterview.result === 'failed' ? '#FDEAEA' : '#FFF0DD',
            color: !selectedInterview ? '#697077' : selectedInterview.result === 'passed' ? colors.ok : selectedInterview.result === 'failed' ? '#DA1E28' : '#B5850C',
            fontWeight: 600,
          }}
        />
        <Button onClick={() => setSubview('picker')} size="small" sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2 }}>
          ← เปลี่ยนผู้สมัคร
        </Button>
      </Box>
    </Box>
  )

  if (subview === 'picker' || !selectedApplication) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <ErrorAlert message={error} />
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>เลือกผู้สมัคร</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 2 }}>
          เลือกผู้สมัคร 1 คนก่อน — ระบบนัดสัมภาษณ์ และระบบตกลงการจ้างงานจะเปิดใช้งานหลังเลือก
        </Typography>
        <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, mb: 3 }}>
          👋 รายชื่อด้านล่างมาจากใบสมัครที่คุณตอบรับแล้ว (ตรวจสอบใบสมัครได้ที่เมนู &quot;ผู้สมัครงาน&quot;)
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>🟠 ยังไม่นัดสัมภาษณ์</Typography>
              <Chip label={`${notScheduled.length} คน`} size="small" />
            </Box>
            <Typography sx={{ fontSize: 12, color: '#9AA0A6', mb: 1.5 }}>ผ่านการคัดเลือกใบสมัครแล้ว รอนัดสัมภาษณ์</Typography>
            {notScheduled.map((a) => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 3, p: 1.5, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{a.student_name.charAt(0)}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.student_name}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{a.position}</Typography>
                  </Box>
                </Box>
                <Button onClick={() => pick(a.id)} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2 }}>เลือก</Button>
              </Box>
            ))}
            {notScheduled.length === 0 && <Typography sx={{ fontSize: 13, color: '#9AA0A6', textAlign: 'center', py: 2 }}>ไม่มีรายการ</Typography>}
          </Box>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>🔵 นัดสัมภาษณ์แล้ว</Typography>
              <Chip label={`${scheduled.length} คน`} size="small" />
            </Box>
            <Typography sx={{ fontSize: 12, color: '#9AA0A6', mb: 1.5 }}>มีนัดสัมภาษณ์แล้ว — พร้อมแจ้งผลและจัดทำข้อตกลงการจ้างงาน</Typography>
            {scheduled.map((a) => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 3, p: 1.5, mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: '#EFF6FF', color: colors.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{a.student_name.charAt(0)}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.student_name}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{a.position}</Typography>
                  </Box>
                </Box>
                <Button onClick={() => pick(a.id)} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2 }}>เลือก</Button>
              </Box>
            ))}
            {scheduled.length === 0 && <Typography sx={{ fontSize: 13, color: '#9AA0A6', textAlign: 'center', py: 2 }}>ไม่มีรายการ</Typography>}
          </Box>
        </Box>
      </Box>
    )
  }

  if (subview === 'hub') {
    const unlocked = selectedInterview?.result === 'passed'
    // Once the result is out the appointment is closed: it can't be re-timed,
    // re-announced, or edited, so those rows are shown as unavailable rather
    // than letting the click fail against the backend's guard.
    const announced = !!selectedInterview?.result
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <ErrorAlert message={error} />
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
              { icon: <EventOutlinedIcon fontSize="small" />, label: selectedInterview ? 'แก้ไขนัดหมายสัมภาษณ์' : 'กำหนดนัดหมายสัมภาษณ์', action: openSchedule, disabled: announced },
              { icon: <VisibilityOutlinedIcon fontSize="small" />, label: 'รายละเอียดนัดหมาย', action: () => setSubview('detail'), disabled: !selectedInterview },
              { icon: <AutorenewOutlinedIcon fontSize="small" />, label: 'ขอเปลี่ยน / เลื่อนกำหนดการ', action: () => setSubview('reschedule'), disabled: !selectedInterview || announced },
              { icon: <NotificationsNoneOutlinedIcon fontSize="small" />, label: 'การแจ้งเตือน', action: () => navigate('/notifications') },
              { icon: <CampaignOutlinedIcon fontSize="small" />, label: 'แจ้งผลการพิจารณาการสัมภาษณ์', action: () => setSubview('results'), disabled: !selectedInterview || announced },
            ].map((row) => (
              <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${colors.border}`, borderRadius: 2, p: 1.5, mb: 1.25, opacity: row.disabled ? 0.5 : 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: colors.navy }}>
                  {row.icon}
                  <Typography sx={{ fontSize: 14 }}>{row.label}</Typography>
                </Box>
                <Button disabled={row.disabled} onClick={row.action} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, color: '#fff', px: 2 }}>ทำรายการ</Button>
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
                {selectedInterview
                  ? selectedInterview.result === 'failed'
                    ? '* ผู้สมัครคนนี้ไม่ผ่านการสัมภาษณ์ จึงไม่สามารถจัดทำข้อตกลงการจ้างงานได้'
                    : '* ต้องแจ้งผลการสัมภาษณ์เป็น "ผ่าน" ก่อน จึงจะเปิดใช้งานได้'
                  : '* ต้องนัดสัมภาษณ์และแจ้งผลว่า "ผ่าน" ก่อน จึงจะเปิดใช้งานได้'}
              </Box>
            )}
            {unlocked && (
              <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, mb: 1.5 }}>
                พร้อมจัดทำข้อตกลงการจ้างงานให้ผู้สมัครคนนี้แล้ว
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
                onClick={() => navigate('/employment')}
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
        <ErrorAlert message={error} />
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>กำหนดนัดหมายสัมภาษณ์</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>กำหนดวัน เวลา และสถานที่นัดสัมภาษณ์ให้ผู้สมัครที่ผ่านการคัดเลือกเบื้องต้น</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3, alignItems: 'start' }}>
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>ข้อมูลนัดสัมภาษณ์</Typography>
            <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>ผู้สมัคร</Typography>
            <TextField value={`${selectedApplication.student_name} — ${selectedApplication.position}`} fullWidth disabled sx={{ mb: 2 }} />
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
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>{scheduleDate || '-'} • {scheduleTime || '-'} น.</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>รูปแบบ</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5 }}>{scheduleFormat === 'onsite' ? 'สัมภาษณ์ ณ สถานที่' : 'สัมภาษณ์ออนไลน์'}</Typography>
            <Typography sx={{ fontSize: 12, color: '#697077' }}>สถานที่</Typography>
            <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 2 }}>{scheduleLocation || '-'}</Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setSubview('hub')} sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2.5 }}>ยกเลิก</Button>
              <Button
                fullWidth
                variant="contained"
                disabled={!scheduleDate || !scheduleTime || scheduleSubmitting}
                onClick={submitSchedule}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
              >
                {scheduleSubmitting ? 'กำลังบันทึก...' : 'บันทึกและส่งการแจ้งเตือน'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  if (subview === 'detail' && selectedInterview) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>รายละเอียดนัดหมาย</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>รายละเอียดนัดหมายที่บันทึกไว้กับผู้สมัคร</Typography>
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>วันที่</Typography><Typography sx={{ fontWeight: 600 }}>{selectedInterview.appointment_date}</Typography></Box>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>เวลา</Typography><Typography sx={{ fontWeight: 600 }}>{selectedInterview.appointment_time} น.</Typography></Box>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>รูปแบบ</Typography><Typography sx={{ fontWeight: 600 }}>{selectedInterview.interview_format === 'onsite' ? 'สัมภาษณ์ ณ สถานที่' : 'สัมภาษณ์ออนไลน์'}</Typography></Box>
            <Box><Typography sx={{ fontSize: 12, color: '#697077' }}>สถานที่</Typography><Typography sx={{ fontWeight: 600 }}>{selectedInterview.location || '-'}</Typography></Box>
          </Box>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setSubview('results')}
            sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: colors.ok, '&:hover': { bgcolor: '#1B5F21' } }}
          >
            ไปแจ้งผลการสัมภาษณ์
          </Button>
        </Box>
      </Box>
    )
  }

  if (subview === 'reschedule' && selectedInterview) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>ขอเปลี่ยน / เลื่อนกำหนดการ</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>เสนอกำหนดการสอบถามสำหรับนัดหมายที่ยืนยันแล้ว ระบบจะบันทึกประวัติทุกครั้ง</Typography>
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, maxWidth: 600 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>เสนอการขอเปลี่ยน / เลื่อนวันเวลา</Typography>
          <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>นัดหมายที่ต้องการเปลี่ยน</Typography>
          <TextField value={`IV-${String(selectedInterview.id).padStart(4, '0')} • ${selectedApplication.position} • ${selectedInterview.appointment_date} ${selectedInterview.appointment_time}`} fullWidth disabled sx={{ mb: 2 }} />
          <TextField
            label="ทำการสอบถามจากนักศึกษาวันที่ว่าง"
            value={rescheduleNote}
            onChange={(e) => setRescheduleNote(e.target.value)}
            placeholder="บอกรายละเอียดสอบถามนักศึกษาวันที่ว่างตามรายละเอียดตามที่ต้องการจะรู้"
            fullWidth
            multiline
            minRows={4}
            sx={{ mb: 2 }}
          />
          <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, mb: 2 }}>
            เมื่อส่งคำขอ ระบบจะแจ้งอีกฝ่ายให้ตรวจสอบและยืนยันรับทราบกำหนดการใหม่
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button onClick={() => setSubview('hub')} sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2.5 }}>ยกเลิก</Button>
            <Button
              fullWidth
              variant="contained"
              disabled={rescheduleNote.trim().length === 0 || rescheduleSubmitting}
              onClick={submitReschedule}
              sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
            >
              {rescheduleSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอเปลี่ยนกำหนดการ'}
            </Button>
          </Box>
        </Box>
        <GmailConfirmDialog
          open={rescheduleConfirmOpen}
          onClose={() => setRescheduleConfirmOpen(false)}
          email="student@gmail.com"
          note="กรุณารอการแจ้งเตือนวันนัดหมายใหม่จากนักศึกษาด้วยครับในการแจ้งเตือนนะครับ"
          onBack={() => { setRescheduleConfirmOpen(false); setRescheduleNote(''); setSubview('hub') }}
        />
      </Box>
    )
  }

  if (subview === 'results' && selectedInterview) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 28, color: colors.navy }}>แจ้งผลการพิจารณาผ่านการสัมภาษณ์</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>บันทึกและแจ้งผลการพิจารณาแก่ {selectedApplication.student_name} ระบบจะส่งการแจ้งเตือนผลทันที</Typography>
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          <TextField
            label="หมายเหตุ (ถ้ามี)"
            value={resultComment}
            onChange={(e) => setResultComment(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              fullWidth
              variant="contained"
              disabled={resultSubmitting}
              onClick={() => submitResult('passed')}
              sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: colors.ok, '&:hover': { bgcolor: '#1B5F21' } }}
            >
              ผ่านการสัมภาษณ์
            </Button>
            <Button
              fullWidth
              variant="contained"
              disabled={resultSubmitting}
              onClick={() => submitResult('failed')}
              sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
            >
              ไม่ผ่านการสัมภาษณ์
            </Button>
          </Box>
        </Box>
        <GmailConfirmDialog
          open={resultsConfirmOpen}
          onClose={() => setResultsConfirmOpen(false)}
          email="student@gmail.com"
          note="ทำการแจ้งผลการสัมภาษณ์ไปยังผู้สมัครเรียบร้อย หากผ่านสามารถไปสร้างข้อตกลงจ้างงานได้ที่เมนู ตกลงการจ้างงาน"
          onBack={() => { setResultsConfirmOpen(false); setResultComment(''); setSubview('hub') }}
        />
      </Box>
    )
  }

  return null
}

export default function InterviewsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerInterviewsView /> : <StudentInterviewsView />
}
