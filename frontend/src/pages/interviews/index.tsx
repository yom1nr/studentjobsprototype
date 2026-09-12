import { useEffect, useMemo, useState } from 'react'
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SentimentDissatisfiedOutlinedIcon from '@mui/icons-material/SentimentDissatisfiedOutlined'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { useAuth } from '../../auth/useAuth'
import { ErrorAlert } from '../../components/ErrorAlert'
import { ApiError } from '../../services/https'
import { listEmployerApplications } from '../../services/https/applications'
import { listMyAgreements } from '../../services/https/agreements'
import {
  confirmInterviewAttendance,
  createInterview,
  listMyInterviews,
  approveReschedule,
  listReschedules,
  rejectReschedule,
  offerRescheduleSlots,
  requestReschedule,
  selectRescheduleSlot,
  sendInterviewResult,
  updateInterview,
} from '../../services/https/interviews'
import type { Application } from '../../interface/IJobInterface'
import type { AgreementRecord, InterviewScheduleRecord, RescheduleEntry } from '../../interface/IInterviewInterface'

// ═══════════════════════════════════════════════════════════════════════════════
// [B6733827] หน้าจอระบบย่อยที่ 1 : นัดหมายสัมภาษณ์  (lifeline ":InterviewUI" ใน Sequence)
//
// ไฟล์เดียว 2 มุมมอง เลือกตาม role ใน JWT (ดู InterviewsPage ท้ายไฟล์)
//   StudentInterviewsView  → U2 ยืนยันเข้าสัมภาษณ์, U3 ขอเลื่อน / เลือกเวลาที่เสนอ, ดูผล U5
//   EmployerInterviewsView → U1 นัด/แก้นัด, U3 เสนอเวลา / อนุมัติ-ปฏิเสธ, U5 ประกาศผล
//
// การไหลของข้อมูล:  services/https/interviews.ts (1 ฟังก์ชัน = 1 endpoint)
//                   ──► backend InterviewController ──► PostgreSQL
//   type ทุกตัวอยู่ใน interface/IInterviewInterface.ts (InterviewScheduleRecord, RescheduleEntry)
//
// เทคนิค React ที่ใช้
//   useState   เก็บฟอร์ม / dialog / loading / error       (ประมาณ 40 ตัว)
//   useEffect  โหลดข้อมูลตอน mount ด้วย async load() + cancelled flag (กัน race, ผ่าน lint set-state-in-effect)
//   useMemo    เลือกนัดที่จะแสดง (pickInterview) ไม่คำนวณซ้ำทุก render
//   useAuth    token + role   /   useNavigate เด้งหน้า   /   MUI Dialog, Chip, TextField
//
// หลัก UX: "ทำไม่ได้ = ไม่แสดงตัวเลือก" (กรอง dropdown ให้ตรงกฎ API) แต่กฎจริงบังคับที่ backend เสมอ
// ═══════════════════════════════════════════════════════════════════════════════
const colors = { navy: '#012150', border: '#DDE1E6', ok: '#217829' }

// เวลาทั้งระบบส่ง/เก็บเป็น UTC RFC3339 และแสดง "ตัวเลขเดิม" ไม่แปลง timezone — 13:30 ต้องไม่กลายเป็น 20:30
/** Slots travel as RFC3339 in UTC and the wall clock in them is the time both
 *  sides agreed to, so render those digits rather than shifting to the viewer's
 *  zone — a 13:30 interview must not read as 20:30 for a reader in Bangkok. */
function formatSlot(rfc3339: string): string {
  if (!rfc3339) return '-'
  const d = new Date(rfc3339)
  if (Number.isNaN(d.getTime())) return rfc3339
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} เวลา ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} น.`
}

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : fallback
}

// นศ. มีหลายนัดได้ (คนละใบสมัคร) → เลือกนัดที่ควรโชว์: ลิงก์จากแจ้งเตือน > นัดที่รอตอบ > นัดที่ยังไม่จบ > ล่าสุด
/** Which of the student's interviews to put on screen. A deep link from a
 *  notification (?interview=<id>) wins; then the one that needs an answer
 *  (mid-reschedule); then any still-live one; then the most recent. Without
 *  this the page always showed interviews[0], so a student with more than one
 *  appointment could not see or act on a reschedule for any of the others. */
function pickInterview(
  list: InterviewScheduleRecord[],
  targetId: number | null,
): InterviewScheduleRecord | null {
  if (!list.length) return null
  if (targetId != null) {
    const hit = list.find((i) => i.id === targetId)
    if (hit) return hit
  }
  return (
    list.find((i) => i.status === 'rescheduling') ??
    list.find((i) => i.status !== 'completed' && i.status !== 'cancelled' && i.result === '') ??
    list[0]
  )
}

// การ์ดขั้นตอน 3 ใบ (นัดหมาย → ยืนยัน/เลื่อน → ผล) — ใบที่จบแล้วเป็นสีเทา+ไอคอนล็อก แก้ไม่ได้
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

// ┌─ มุมมองนักศึกษา ──────────────────────────────────────────────────────────────────┐
// │ Activity Diagram: "Review appointment details" → ◇ Available on schedule?         │
// │   Available     → confirmAttendance()  (U2)                                       │
// │   Not available → submitReschedule()   (U3 ทางที่ 1: เสนอ 1 เวลา รอผู้ประกอบการอนุมัติ)│
// │ ถ้าผู้ประกอบการเสนอเวลามา (U3 ทางที่ 2) → radio list → chooseSlot()                 │
// │ สถานะที่โชว์ (Chip) อ่านจาก interview.status / result ของจริงใน DB ไม่ใช่ state ในหน้า │
// └────────────────────────────────────────────────────────────────────────────────────┘
// ─────────────────────────── Student side ───────────────────────────
function StudentInterviewsView() {
  usePageTitle('ประกาศกำหนดการสัมภาษณ์ / ผลการสัมภาษณ์')
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const targetInterviewId = Number(searchParams.get('interview')) || null

  // ── state หลัก: นัดทั้งหมดจาก API / กำลังโหลด / ข้อความ error / หน้าย่อยที่ดูอยู่ (list = การ์ด 3 ใบ, appointment = รายละเอียด)
  const [interviews, setInterviews] = useState<InterviewScheduleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'appointment'>('list')

  // ── state ฟอร์มขอเลื่อนนัด (U3 ทางที่ 1): dialog เปิด?, วัน, เวลา, เหตุผล, กำลังส่ง?, ส่งไปแล้ว?
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleRequested, setRescheduleRequested] = useState(false)

  // ── state ปุ่มยืนยันเข้าสัมภาษณ์ (U2): กำลังส่ง? / ยืนยันแล้ว (optimistic)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  // ── ประวัติคำขอเลื่อนของนัดนี้ + reloadToken (บวก 1 = สั่งโหลดใหม่) + การเลือกเวลาที่ผู้ประกอบการเสนอ (U3 ทางที่ 2)
  const [reschedules, setReschedules] = useState<RescheduleEntry[]>([])
  const [reloadToken, setReloadToken] = useState(0)
  const [chosenSlot, setChosenSlot] = useState('')
  const [choosing, setChoosing] = useState(false)
  const [slotConfirmed, setSlotConfirmed] = useState<string | null>(null)

  // โหลดนัดทั้งหมดของฉัน (GET /interviews) ตอนเปิดหน้า และทุกครั้งที่ reloadToken เปลี่ยน — cancelled กันผลลัพธ์เก่าทับใหม่
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
  }, [token, reloadToken])

  const interview = useMemo(
    () => pickInterview(interviews, targetInterviewId),
    [interviews, targetInterviewId],
  )

  // The request history follows whichever interview is on screen — not always
  // the first — so a student with several appointments sees the one that needs
  // them, and the notification deep link lands on the right request.
  useEffect(() => {
    let cancelled = false
    async function loadReschedules() {
      if (!token || !interview) {
        if (!cancelled) setReschedules([])
        return
      }
      try {
        const rs = await listReschedules(token, interview.id)
        if (!cancelled) setReschedules(rs)
      } catch {
        if (!cancelled) setReschedules([])
      }
    }
    void loadReschedules()
    return () => { cancelled = true }
  }, [token, interview, reloadToken])

  // The appointment's real state lives on the record (pending / confirmed /
  // rescheduling / completed / cancelled). `confirmed` below is only an optimistic
  // flag for the moment right after the student clicks, so reading it alone made
  // every reloaded appointment look like it was still waiting to happen.
  // สถานะจริงมาจาก record (backend เป็น source of truth) — confirmed ในหน้าเป็นแค่ optimistic ชั่วคราวหลังกด
  const isFinished = interview != null && (interview.status === 'completed' || interview.result !== '')
  const isCancelled = interview?.status === 'cancelled'
  const isConfirmed = confirmed || interview?.status === 'confirmed'

  // A reschedule can be waiting on either side, and which side decides what the
  // student is shown: their own request waits for the employer's answer, while
  // the employer's offer is waiting on the student to pick a time.
  // มีคำขอเลื่อนค้างไหม และของฝั่งไหน → ตัดสินว่าจะโชว์ "รออนุมัติ" (ของฉัน) หรือ "กรุณาเลือกเวลา" (ของผู้ประกอบการ)
  const pendingRequest = reschedules.find((r) => r.status === 'pending')
  const awaitingEmployerApproval = pendingRequest?.requested_by === 'student'
  const slotOffer = pendingRequest?.requested_by === 'employer' ? pendingRequest : null

  // Chip สถานะบนการ์ด — เรียงความสำคัญ: จบแล้ว > ยกเลิก > รออนุมัติเลื่อน > รอเลือกเวลา > ยืนยันแล้ว > รอยืนยัน
  const appointmentChip = isFinished
    ? { label: 'สัมภาษณ์เสร็จสิ้น', color: '#217829', bg: '#EAF7EA' }
    : isCancelled
      ? { label: 'ยกเลิกนัดแล้ว', color: '#DA1E28', bg: '#FDEAEA' }
      : awaitingEmployerApproval
        ? { label: 'รอการอนุมัติเลื่อนนัด', color: '#B5850C', bg: '#FFF0DD' }
        : slotOffer
          ? { label: 'กรุณาเลือกวันสัมภาษณ์ใหม่', color: '#C2410C', bg: '#FFEDD5' }
          : isConfirmed
            ? { label: 'รอผลการสัมภาษณ์', color: colors.ok, bg: '#EAF7EA' }
            : { label: 'รอยืนยันเข้าสัมภาษณ์', color: '#B5850C', bg: '#FFF0DD' }

  // [U3] นศ. เลือก 1 เวลาจากที่ผู้ประกอบการเสนอ → POST /student/reschedules/:id/select
  async function chooseSlot() {
    if (!token || !slotOffer || !chosenSlot) return
    setChoosing(true)
    try {
      await selectRescheduleSlot(token, slotOffer.id, { selected_date_time: chosenSlot })
      setSlotConfirmed(chosenSlot)
      setChosenSlot('')
      setReloadToken((t) => t + 1)
    } catch (err) {
      setError(apiErrorMessage(err, 'เลือกวันสัมภาษณ์ไม่สำเร็จ'))
    } finally {
      setChoosing(false)
    }
  }

  // [U3] นศ. ขอเลื่อนนัด → POST /student/interviews/:id/reschedule  (date+time ในฟอร์ม → RFC3339 UTC)
  async function submitReschedule() {
    // The submit button is disabled until both fields are filled (below), so
    // this is reachable only once there's a real value to send.
    if (!token || !interview || !rescheduleDate || !rescheduleTime) return
    setRescheduleSubmitting(true)
    try {
      await requestReschedule(token, interview.id, {
        reason: rescheduleReason,
        student_available_date_time: `${rescheduleDate}T${rescheduleTime}:00Z`,
      })
      setRescheduleRequested(true)
      setRescheduleOpen(false)
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งคำขอเลื่อนนัดไม่สำเร็จ'))
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  // [U2] นศ. ยืนยันเข้าสัมภาษณ์ → POST /student/interviews/:id/confirm → backend แจ้งผู้ประกอบการ (U4)
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

  // ── หน้าว่าง: API คืน [] (กรองด้วย student_id — นัดของคนอื่นไม่โผล่)
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

  // ── หน้า "รายละเอียดนัดสัมภาษณ์" (กดจากการ์ดใบ 1): ซ้าย = ข้อมูลนัด / ขวา = ปุ่มยืนยัน (U2) + ขอเลื่อน (U3)
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
              <Chip label={appointmentChip.label} size="small" sx={{ bgcolor: appointmentChip.bg, color: appointmentChip.color, fontWeight: 600 }} />
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
            {/* Nothing left to confirm or move once the interview has happened or
                was cancelled — the API rejects both, so don't offer them. */}
            {isFinished || isCancelled ? (
              <Box sx={{ bgcolor: '#F7F9FC', border: `1px solid ${colors.border}`, borderRadius: 2, p: 2 }}>
                <Typography sx={{ fontSize: 13, color: '#697077' }}>
                  {isCancelled
                    ? 'นัดหมายนี้ถูกยกเลิกแล้ว'
                    : 'การสัมภาษณ์เสร็จสิ้นแล้ว — ดูผลการสัมภาษณ์ได้ที่หน้าก่อนหน้า'}
                </Typography>
              </Box>
            ) : (
              <>
                {rescheduleRequested || pendingRequest ? (
                  <Chip label="ส่งคำขอเลื่อนนัดแล้ว รอผู้ประกอบการตอบรับ" sx={{ bgcolor: '#FFF0DD', color: '#B5850C', fontWeight: 600, height: 'auto', py: 1 }} />
                ) : (
                  <Button variant="outlined" onClick={() => setRescheduleOpen(true)} sx={{ borderRadius: '40px', textTransform: 'none', color: colors.navy, borderColor: colors.border }}>
                    ขอเลื่อน / เปลี่ยนนัด
                  </Button>
                )}
                <Button
                  variant="contained"
                  disabled={isConfirmed || confirming}
                  onClick={confirmAttendance}
                  sx={{ borderRadius: '40px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
                >
                  {isConfirmed ? 'ยืนยันแล้ว' : confirming ? 'กำลังยืนยัน...' : 'ยืนยันเข้ารับสัมภาษณ์'}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Dialog ขอเลื่อนนัด (U3 ทางที่ 1): วัน + เวลา + เหตุผล — ปุ่มส่ง disabled จนกรอกครบ → submitReschedule() */}
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

  // ── หน้าหลักนักศึกษา (view = 'list'): การ์ดใบ 1 นัดหมาย → กล่องคำขอเลื่อน (ถ้ามี) → การ์ดใบ 2 ผลสัมภาษณ์
  return (
    <Box sx={{ maxWidth: 850, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <ErrorAlert message={error} />
      <StepCard
        step={1}
        title="การนัดสัมภาษณ์"
        subtitle={`${interview.company_name} • ${interview.appointment_date} ${interview.appointment_time} น.`}
        statusLabel={appointmentChip.label}
        statusColor={appointmentChip.color}
        statusBg={appointmentChip.bg}
        locked={false}
        actionLabel="รายละเอียด"
        actionColor={colors.navy}
        onAction={() => setView('appointment')}
      />

      {/* [U3 ทางที่ 2] ผู้ประกอบการเสนอเวลา → radio เลือก 1 → ปุ่มยืนยัน → chooseSlot() */}
      {/* The employer offered times and is waiting on the student — this is the
          one thing blocking the interview, so it goes above the result card. */}
      {slotOffer && (
        <Box sx={{ border: '1px solid #FDBA74', bgcolor: '#FFF7ED', borderRadius: 3, p: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#9A3412' }}>
            {interview.company_name} ขอเลื่อนนัด — กรุณาเลือกวันที่สะดวก
          </Typography>
          {slotOffer.reschedule_reason && (
            <Typography sx={{ fontSize: 13, color: '#7C2D12', mt: 0.5 }}>
              เหตุผล: {slotOffer.reschedule_reason}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 2 }}>
            {slotOffer.proposed_slots.map((slot) => {
              const picked = chosenSlot === slot
              return (
                <Box
                  key={slot}
                  onClick={() => setChosenSlot(slot)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                    border: `2px solid ${picked ? '#EA580C' : colors.border}`,
                    bgcolor: picked ? '#FFEDD5' : '#fff',
                    borderRadius: 2, px: 2, py: 1.5,
                  }}
                >
                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${picked ? '#EA580C' : '#C4C4C4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {picked && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#EA580C' }} />}
                  </Box>
                  <Typography sx={{ fontSize: 15, fontWeight: picked ? 700 : 500, color: colors.navy }}>
                    {formatSlot(slot)}
                  </Typography>
                </Box>
              )
            })}
          </Box>
          <Button
            fullWidth
            variant="contained"
            disabled={!chosenSlot || choosing}
            onClick={() => void chooseSlot()}
            sx={{ mt: 2.5, height: 48, borderRadius: '40px', textTransform: 'none', fontWeight: 700, bgcolor: '#EA580C', '&:hover': { bgcolor: '#C2410C' } }}
          >
            {choosing ? 'กำลังส่ง...' : 'ยืนยันวันที่เลือก'}
          </Button>
        </Box>
      )}

      {/* [U3 ทางที่ 1] ฉันขอเลื่อนไปแล้ว รอผู้ประกอบการตอบ — กำหนดการเดิมยังมีผล */}
      {/* Waiting on the employer to answer the student's own request. */}
      {awaitingEmployerApproval && pendingRequest && (
        <Box sx={{ border: `1px solid ${colors.border}`, bgcolor: '#FFFBEB', borderRadius: 3, p: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17, color: '#B5850C' }}>รอการอนุมัติเลื่อนนัด</Typography>
          <Typography sx={{ fontSize: 14, color: '#78350F', mt: 0.5 }}>
            คุณขอเลื่อนเป็นวันที่ <b>{formatSlot(pendingRequest.student_available_date_time)}</b> — รอ {interview.company_name} ตอบกลับ
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#9A7B2F', mt: 1 }}>
            ระหว่างนี้กำหนดการเดิมยังมีผลอยู่ หากไม่ได้รับการอนุมัติ ให้มาตามวันเดิม
          </Typography>
        </Box>
      )}

      {/* Just picked a slot — say plainly that they can simply turn up then. */}
      {slotConfirmed && !slotOffer && (
        <Box sx={{ border: '1px solid #C7E8C9', bgcolor: '#F4FBF4', borderRadius: 3, p: 3, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 56, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#217829', mt: 1 }}>
            บันทึกวันสัมภาษณ์ใหม่แล้ว
          </Typography>
          <Typography sx={{ fontSize: 15, color: '#3B5B3D', mt: 0.5 }}>
            คุณสามารถเข้ามาสัมภาษณ์ได้เลยในวันที่ <b>{formatSlot(slotConfirmed)}</b>
          </Typography>
        </Box>
      )}

      {/* [U5] ผลสัมภาษณ์: passed → การ์ดเขียว + ปุ่มไปหน้าข้อตกลง (U6/U7) / failed → การ์ดเทา / ยังไม่ประกาศ → การ์ดใบ 2 "รอผล" */}
      {/* The outcome is persisted on the interview, so show it here instead of
          sending the student off to dig through notifications. Only fall back to
          the "watch your notifications" card while no result has been announced. */}
      {interview.result === 'passed' ? (
        <Box sx={{ border: '1px solid #C7E8C9', bgcolor: '#F4FBF4', borderRadius: 3, p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 110, color: '#2E7D32' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 26, color: '#217829', mt: 1.5 }}>
            คุณผ่านการสัมภาษณ์แล้ว
          </Typography>
          <Typography sx={{ fontSize: 15, color: '#3B5B3D', mt: 1 }}>
            ยินดีด้วย! {interview.company_name} ตอบรับคุณเข้าทำงานแล้ว
          </Typography>
          {interview.result_comment && (
            <Box sx={{ bgcolor: '#fff', border: '1px solid #C7E8C9', borderRadius: 2, p: 2, mt: 2.5, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 12, color: '#697077', mb: 0.5 }}>ข้อความจากผู้ประกอบการ</Typography>
              <Typography sx={{ fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>{interview.result_comment}</Typography>
            </Box>
          )}
          <Box sx={{ bgcolor: '#EAF7EA', borderRadius: 2, p: 2, mt: 2.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#217829' }}>
              กรุณาไปที่เมนู &quot;แจ้งผลการจ้างงาน&quot; เพื่อตรวจสอบและตอบรับข้อตกลงการจ้างงาน
            </Typography>
          </Box>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/employment')}
            sx={{ mt: 3, px: 4, height: 52, borderRadius: '40px', textTransform: 'none', fontWeight: 700, fontSize: 16, bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
          >
            ไปที่แจ้งผลการจ้างงาน
          </Button>
        </Box>
      ) : interview.result === 'failed' ? (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 4, textAlign: 'center' }}>
          <SentimentDissatisfiedOutlinedIcon sx={{ fontSize: 96, color: '#9AA0A6' }} />
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy, mt: 1.5 }}>
            ผลการสัมภาษณ์: ไม่ผ่านการพิจารณา
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#697077', mt: 1 }}>
            ขอบคุณที่สนใจร่วมงานกับ {interview.company_name} — ยังมีงานอื่นรอคุณอยู่
          </Typography>
          {interview.result_comment && (
            <Box sx={{ bgcolor: '#F7F9FC', borderRadius: 2, p: 2, mt: 2.5, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 12, color: '#697077', mb: 0.5 }}>ข้อความจากผู้ประกอบการ</Typography>
              <Typography sx={{ fontSize: 14, color: '#333', whiteSpace: 'pre-wrap' }}>{interview.result_comment}</Typography>
            </Box>
          )}
          <Button
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/jobs')}
            sx={{ mt: 3, px: 3, borderRadius: '40px', textTransform: 'none', fontWeight: 600, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
          >
            ค้นหางานอื่น
          </Button>
        </Box>
      ) : (
        <StepCard
          step={2}
          title="ผลการสัมภาษณ์"
          subtitle="ยังไม่ประกาศผล — ผลการพิจารณาจะแจ้งให้ทราบที่นี่และผ่านการแจ้งเตือน"
          statusLabel="รอผล"
          statusColor="#B5850C"
          statusBg="#FFF0DD"
          locked={false}
          actionLabel="ไปที่การแจ้งเตือน"
          actionColor="#0090FF"
          onAction={() => navigate('/notifications')}
        />
      )}
    </Box>
  )
}

// ─────────────────────────── Employer side ───────────────────────────
// ┌─ มุมมองผู้ประกอบการ ──────────────────────────────────────────────────────────────┐
// │ subview: picker (เลือกผู้สมัคร) → hub (ศูนย์รวม) → schedule (U1) / reschedule (U3) │
// │          / results (U5) / detail                                                  │
// │ รายชื่อผู้สมัครมาจาก /employer/applications ที่ status = accepted                   │
// │ สถานะจริง (pending/confirmed/rescheduling/completed + result) อ่านจาก              │
// │ InterviewSchedule ใน DB โดยตรง — เก็บถาวรใน backend ไม่ได้เดาจากหน้า                │
// └────────────────────────────────────────────────────────────────────────────────────┘

type EmployerSubview = 'picker' | 'hub' | 'schedule' | 'detail' | 'reschedule' | 'results'

function EmployerInterviewsView() {
  usePageTitle('จัดการนัดหมายสัมภาษณ์')
  const { token } = useAuth()
  const navigate = useNavigate()

  // ── ข้อมูลจาก API 3 ชุด: ใบสมัครที่ accepted / นัดทั้งหมดของฉัน / ข้อตกลงทั้งหมดของฉัน
  const [applications, setApplications] = useState<Application[]>([])
  const [interviews, setInterviews] = useState<InterviewScheduleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── ผู้สมัครที่เลือกอยู่ + หน้าย่อยที่ดูอยู่ (picker → hub → schedule / detail / reschedule / results)
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null)
  const [subview, setSubview] = useState<EmployerSubview>('picker')

  // ── ฟอร์มนัดสัมภาษณ์ (U1): วัน เวลา รูปแบบ สถานที่ สิ่งที่ต้องเตรียม
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleFormat, setScheduleFormat] = useState<'onsite' | 'online'>('onsite')
  const [scheduleLocation, setScheduleLocation] = useState('')
  const [schedulePrep, setSchedulePrep] = useState('')
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)

  // ── ฟอร์มเสนอเวลาใหม่ (U3 ทางที่ 2): เหตุผล + ช่องเวลา 3 ช่อง (offerSlots) + คำขอที่ค้างของนัดนี้ (reschedules)
  const [rescheduleNote, setRescheduleNote] = useState('')
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false)
  const [offerSlots, setOfferSlots] = useState([
    { date: '', time: '' },
    { date: '', time: '' },
    { date: '', time: '' },
  ])
  const [reschedules, setReschedules] = useState<RescheduleEntry[]>([])
  const [respondingId, setRespondingId] = useState<number | null>(null)
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])

  // ── ฟอร์มประกาศผล (U5): ความเห็น + กำลังส่ง? + dialog สำเร็จ
  const [resultComment, setResultComment] = useState('')
  const [resultSubmitting, setResultSubmitting] = useState(false)
  const [resultsConfirmOpen, setResultsConfirmOpen] = useState(false)

  // The date+time inputs are wall clock; the API takes RFC3339. Tagging them as
  // UTC keeps the digits the employer typed intact end to end (see formatSlot).
  // ช่องเวลาที่กรอกครบ → แปลงเป็น RFC3339 UTC (เช่น 2026-09-25T09:00:00Z) ส่งให้ API
  const filledOfferSlots = offerSlots
    .filter((s) => s.date && s.time)
    .map((s) => `${s.date}T${s.time}:00Z`)

  // โหลด 3 ชุดพร้อมกัน (Promise.all) — เรียกซ้ำหลังทุก action เพื่อให้หน้าจอตรงกับ DB เสมอ
  async function load() {
    if (!token) return
    setLoading(true)
    try {
      const [apps, ivs, agrs] = await Promise.all([listEmployerApplications(token), listMyInterviews(token), listMyAgreements(token)])
      setApplications(apps.filter((a) => a.status === 'accepted'))
      setInterviews(ivs)
      setAgreements(agrs)
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
        const [apps, ivs, agrs] = await Promise.all([listEmployerApplications(token!), listMyInterviews(token!), listMyAgreements(token!)])
        if (cancelled) return
        setApplications(apps.filter((a) => a.status === 'accepted'))
        setInterviews(ivs)
        setAgreements(agrs)
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลผู้สมัครไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void doLoad()
    return () => { cancelled = true }
  }, [token])

  // จับคู่นัดกับ "ใบสมัคร" ไม่ใช่ "คน"  (Class Diagram: Application 1 ── 0..1 InterviewSchedule)
  // Matched per application, not per student: one candidate can hold several
  // accepted applications with this employer, and each is scheduled separately.
  function interviewFor(applicationId: number): InterviewScheduleRecord | null {
    return interviews.find((iv) => iv.application_id === applicationId) ?? null
  }

  // ── กฎระดับ "ตำแหน่ง" ──────────────────────────────────────────────────────────
  // ตำแหน่งที่มีข้อตกลงแล้ว (จ้างแล้ว / รอตอบ / ถูกปฏิเสธ) หายจากรายชื่อนัดสัมภาษณ์
  // แต่ตำแหน่งอื่นของคนเดียวกันยังอยู่ — ตรงกับกฎ backend (CreateAgreement: 1 นัด = 1 ข้อตกลง)
  // Once a position reaches the agreement stage its interview work is over —
  // hired, declined, or waiting on the student, there is nothing left to schedule
  // or announce here. It closes that position only: other positions the same
  // candidate applied for are separate decisions and stay open. Deleting the
  // agreement in "ตกลงการจ้างงาน > ประวัติย้อนหลัง" reopens the position.
  const settledApplicationIds = new Set(
    agreements
      .map((a) => interviews.find((i) => i.id === a.interview_schedule_id)?.application_id)
      .filter((id): id is number => id != null),
  )
  const inPlay = applications.filter((a) => !settledApplicationIds.has(a.id))
  const settledCount = applications.length - inPlay.length

  // แบ่ง 2 กลุ่มให้หน้า picker: ยังไม่นัด / นัดแล้ว
  const notScheduled = inPlay.filter((a) => !interviewFor(a.id))
  const scheduled = inPlay.filter((a) => interviewFor(a.id))

  const selectedApplication = applications.find((a) => a.id === selectedApplicationId) ?? null
  const selectedInterview = selectedApplicationId ? interviewFor(selectedApplicationId) : null
  const selectedInterviewId = selectedInterview?.id ?? null

  // Reschedule requests belong to one appointment, so they are fetched when a
  // candidate is picked rather than up front for every interview.
  useEffect(() => {
    let cancelled = false
    async function loadReschedules() {
      if (!token || !selectedInterviewId) {
        if (!cancelled) setReschedules([])
        return
      }
      try {
        const rs = await listReschedules(token, selectedInterviewId)
        if (!cancelled) setReschedules(rs)
      } catch {
        if (!cancelled) setReschedules([])
      }
    }
    void loadReschedules()
    return () => { cancelled = true }
  }, [token, selectedInterviewId, interviews])

  // คำขอเลื่อนที่ค้าง: มาจาก นศ. (เราต้องตอบ) หรือของเราเอง (รอ นศ. เลือก)
  const pendingStudentRequest = reschedules.find((r) => r.status === 'pending' && r.requested_by === 'student') ?? null
  const pendingOwnOffer = reschedules.find((r) => r.status === 'pending' && r.requested_by === 'employer') ?? null

  // [U3] ผู้ประกอบการตอบคำขอเลื่อนของ นศ. → POST /employer/reschedules/:id/approve | reject แล้ว reload
  async function respondToReschedule(rescheduleId: number, approve: boolean) {
    if (!token) return
    setRespondingId(rescheduleId)
    try {
      if (approve) await approveReschedule(token, rescheduleId)
      else await rejectReschedule(token, rescheduleId)
      await load()
      const rs = await listReschedules(token, selectedInterviewId!)
      setReschedules(rs)
    } catch (err) {
      setError(apiErrorMessage(err, approve ? 'อนุมัติไม่สำเร็จ' : 'ปฏิเสธไม่สำเร็จ'))
    } finally {
      setRespondingId(null)
    }
  }

  function pick(applicationId: number) {
    setSelectedApplicationId(applicationId)
    setSubview('hub')
  }

  // [U1] สร้างนัด (POST /employer/interviews) หรือแก้นัดเดิม (PUT /employer/interviews/:id) — ฟอร์มเดียวกัน
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

  // เปิดฟอร์มนัด: มีนัดอยู่แล้ว → เติมค่าเดิม (แก้ไข) / ยังไม่มี → ฟอร์มว่าง (สร้างใหม่)
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

  // [U3 ทางที่ 2] ผู้ประกอบการเสนอหลายเวลา → POST /employer/interviews/:id/reschedule-offer (proposed_slots[])
  async function submitReschedule() {
    if (!token || !selectedInterview) return
    setRescheduleSubmitting(true)
    try {
      await offerRescheduleSlots(token, selectedInterview.id, {
        reason: rescheduleNote,
        proposed_slots: filledOfferSlots,
      })
      setRescheduleConfirmOpen(true)
      await load()
    } catch (err) {
      setError(apiErrorMessage(err, 'ส่งคำขอเปลี่ยนกำหนดการไม่สำเร็จ'))
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  // [U5] ประกาศผล → POST /employer/interviews/:id/result  — ผล "passed" เปิดทางให้ระบบตกลงจ้างงาน (U6)
  async function submitResult(result: 'passed' | 'failed') {
    if (!token || !selectedInterview) return
    // A result is announced once. Guarding here as well as on the hub row keeps a
    // double click, or a stale screen, from firing a second submit.
    if (selectedInterview.result !== '') {
      setError('ประกาศผลการสัมภาษณ์ของผู้สมัครคนนี้ไปแล้ว')
      setSubview('hub')
      return
    }
    setResultSubmitting(true)
    try {
      await sendInterviewResult(token, selectedInterview.id, { result, comment: resultComment })
      // Refetch so the announced result lands in state — without it the hub still
      // thinks nothing was announced and leaves the actions open for a second
      // submit, which the API then rejects.
      await load()
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

  // ── แถบหัวของ hub: ชื่อ/ตำแหน่งผู้สมัคร + Chip สถานะ (ยังไม่นัด / รอผล / ผ่าน / ไม่ผ่าน) + ปุ่มเปลี่ยนคน
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

  // ── หน้า picker: รายชื่อผู้สมัครที่ผ่านคัดเลือก แบ่ง "ยังไม่นัด" / "นัดแล้ว" — ตำแหน่งที่มีข้อตกลงแล้วถูกซ่อน (บอกจำนวนไว้)
  if (subview === 'picker' || !selectedApplication) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <ErrorAlert message={error} />
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>เลือกผู้สมัคร</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 2 }}>
          เลือกผู้สมัคร 1 คนก่อน — ระบบนัดสัมภาษณ์ และระบบตกลงการจ้างงานจะเปิดใช้งานหลังเลือก
        </Typography>
        <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, mb: settledCount > 0 ? 1.5 : 3 }}>
          👋 รายชื่อด้านล่างมาจากใบสมัครที่คุณตอบรับแล้ว (ตรวจสอบใบสมัครได้ที่เมนู &quot;ผู้สมัครงาน&quot;)
        </Box>
        {settledCount > 0 && (
          <Box sx={{ bgcolor: '#F7F9FC', border: `1px solid ${colors.border}`, color: '#52545C', fontSize: 13, borderRadius: 2, p: 1.5, mb: 3 }}>
            มี {settledCount} ตำแหน่งที่ไม่แสดง เพราะเข้าสู่ขั้นตอนข้อตกลงการจ้างงานแล้ว (จ้างงานสำเร็จ
            รอนักศึกษาตอบรับ หรือถูกปฏิเสธ) — ดูสถานะได้ที่เมนู &quot;ตกลงการจ้างงาน&quot;
            ส่วนตำแหน่งอื่นที่ผู้สมัครยื่นไว้ยังดำเนินการต่อได้ตามปกติ
          </Box>
        )}
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

  // ── หน้า hub: การ์ด 1 ระบบนัดสัมภาษณ์ (5 เมนู) + การ์ด 2 ระบบตกลงจ้างงาน (ล็อกจน result === 'passed')
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
          {/* Once the result is announced this stage is over: the appointment can't
              be re-timed, re-announced, or moved, so the whole card is closed off
              rather than leaving live-looking buttons that the API would reject. */}
          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5, bgcolor: announced ? '#FAFAFA' : 'transparent', opacity: announced ? 0.72 : 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: announced ? '#E0E0E0' : colors.navy, color: announced ? '#9AA0A6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>1</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>จัดการนัดหมายสัมภาษณ์</Typography>
                  <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>
                    {announced ? 'ประกาศผลแล้ว — แก้ไขนัดหมายไม่ได้อีก' : 'กำหนดนัด ยืนยัน เลื่อน และแจ้งผลการพิจารณา'}
                  </Typography>
                </Box>
              </Box>
              <Chip
                icon={announced ? <LockOutlinedIcon sx={{ fontSize: 14 }} /> : undefined}
                label={announced ? 'เสร็จสิ้นแล้ว' : 'พร้อมใช้งาน'}
                size="small"
                sx={{ bgcolor: announced ? '#F0F0F0' : '#EAF7EA', color: announced ? '#697077' : colors.ok, fontWeight: 600 }}
              />
            </Box>
            {announced && (
              <Box sx={{ bgcolor: '#F0F0F0', color: '#52545C', fontSize: 13, borderRadius: 2, p: 1.5, mb: 1.5 }}>
                การสัมภาษณ์ของผู้สมัครคนนี้เสร็จสิ้นแล้ว ดูย้อนหลังได้ที่ &quot;รายละเอียดนัดหมาย&quot;
              </Box>
            )}
            {/* 5 เมนูของระบบ 1 — disabled ตามสถานะ: ประกาศผลแล้ว (announced) ปิดทุกอย่างยกเว้น "รายละเอียด" กับ "แจ้งเตือน" */}
            {[
              { icon: <EventOutlinedIcon fontSize="small" />, label: selectedInterview ? 'แก้ไขนัดหมายสัมภาษณ์' : 'กำหนดนัดหมายสัมภาษณ์', action: openSchedule, disabled: announced },
              // Viewing the finished appointment changes nothing, so it stays open.
              { icon: <VisibilityOutlinedIcon fontSize="small" />, label: 'รายละเอียดนัดหมาย', action: () => setSubview('detail'), disabled: !selectedInterview },
              { icon: <AutorenewOutlinedIcon fontSize="small" />, label: 'ขอเปลี่ยน / เลื่อนกำหนดการ', action: () => setSubview('reschedule'), disabled: !selectedInterview || announced },
              // Notifications is a page of its own, reachable from the sidebar
              // anyway — locking it here would be friction with no effect.
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

          {/* การ์ด 2: ตกลงจ้างงาน — unlocked เมื่อ result === 'passed' (U6 «extend» U5) / ไม่ผ่านหรือยังไม่ประกาศ → ล็อก + บอกเหตุผลสีแดง */}
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

  // ── หน้าฟอร์มนัด (U1): สร้างหรือแก้ไข → submitSchedule() ตัดสินเองว่า POST หรือ PUT
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

  // ── หน้ารายละเอียดนัด (อ่านอย่างเดียว) — เปิดได้แม้ประกาศผลแล้ว
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

  // ── หน้าเลื่อนนัด (U3): บน = คำขอจาก นศ. ที่รอตอบ (อนุมัติ/ปฏิเสธ → respondToReschedule) / ล่าง = ฟอร์มเสนอเวลา 3 ช่องของเรา
  if (subview === 'reschedule' && selectedInterview) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        {BackToHub}
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>ขอเปลี่ยน / เลื่อนกำหนดการ</Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>เสนอวันที่ว่างให้นักศึกษาเลือก หรือตอบคำขอเลื่อนนัดที่นักศึกษาส่งมา</Typography>

        {/* A student's request is waiting for a decision — answer it before
            offering new times, since only one request may be open at a time. */}
        {pendingStudentRequest && (
          <Box sx={{ border: '1px solid #FDBA74', bgcolor: '#FFF7ED', borderRadius: 3, p: 3, mb: 3, maxWidth: 600 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 17, color: '#9A3412' }}>นักศึกษาขอเลื่อนนัด — รอคุณอนุมัติ</Typography>
            <Typography sx={{ fontSize: 15, color: colors.navy, mt: 1.5 }}>
              ขอเลื่อนเป็นวันที่ <b>{formatSlot(pendingStudentRequest.student_available_date_time)}</b>
            </Typography>
            {pendingStudentRequest.reschedule_reason && (
              <Typography sx={{ fontSize: 13, color: '#7C2D12', mt: 0.5 }}>เหตุผล: {pendingStudentRequest.reschedule_reason}</Typography>
            )}
            <Typography sx={{ fontSize: 12, color: '#9A7B2F', mt: 1.5 }}>
              ถ้าอนุมัติ นัดจะถูกเปลี่ยนเป็นวันดังกล่าวทันที ถ้าไม่อนุมัติ กำหนดการเดิมยังมีผลอยู่
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
              <Button
                variant="contained"
                disabled={respondingId === pendingStudentRequest.id}
                onClick={() => void respondToReschedule(pendingStudentRequest.id, true)}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, px: 3, bgcolor: '#217829', '&:hover': { bgcolor: '#1B5F21' } }}
              >
                อนุมัติการเลื่อนนัด
              </Button>
              <Button
                variant="outlined"
                disabled={respondingId === pendingStudentRequest.id}
                onClick={() => void respondToReschedule(pendingStudentRequest.id, false)}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, px: 3, color: '#DA1E28', borderColor: '#DA1E28' }}
              >
                ไม่อนุมัติ
              </Button>
            </Box>
          </Box>
        )}

        {/* Already waiting on the student to pick — show what was offered. */}
        {pendingOwnOffer && (
          <Box sx={{ border: `1px solid ${colors.border}`, bgcolor: '#F7F9FC', borderRadius: 3, p: 3, mb: 3, maxWidth: 600 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy }}>ส่งวันให้นักศึกษาเลือกแล้ว — รอนักศึกษาตอบกลับ</Typography>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
              {pendingOwnOffer.proposed_slots.map((s) => (
                <Typography component="li" key={s} sx={{ fontSize: 14, color: '#333' }}>{formatSlot(s)}</Typography>
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3, maxWidth: 600, opacity: pendingStudentRequest || pendingOwnOffer ? 0.5 : 1, pointerEvents: pendingStudentRequest || pendingOwnOffer ? 'none' : 'auto' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: colors.navy, mb: 2 }}>เสนอการขอเปลี่ยน / เลื่อนวันเวลา</Typography>
          <Typography sx={{ fontSize: 13, color: '#697077', mb: 0.5 }}>นัดหมายที่ต้องการเปลี่ยน</Typography>
          <TextField value={`IV-${String(selectedInterview.id).padStart(4, '0')} • ${selectedApplication.position} • ${selectedInterview.appointment_date} ${selectedInterview.appointment_time}`} fullWidth disabled sx={{ mb: 2 }} />
          <TextField
            label="เหตุผลที่ขอเลื่อน"
            value={rescheduleNote}
            onChange={(e) => setRescheduleNote(e.target.value)}
            placeholder="เช่น ผู้สัมภาษณ์ติดประชุมด่วน"
            fullWidth
            multiline
            minRows={2}
            sx={{ mb: 2.5 }}
          />

          {/* Offering concrete times instead of asking an open question: the
              student picks one and the appointment is settled in a single step,
              with no second round of approval. */}
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>เสนอวันที่ว่างให้นักศึกษาเลือก</Typography>
          <Typography sx={{ fontSize: 13, color: '#697077', mb: 1.5 }}>
            กรอกอย่างน้อย 1 ช่วง (แนะนำ 3 ช่วง) — นักศึกษาจะเลือกได้เพียงวันเดียวจากที่คุณเสนอ และนัดจะถูกเปลี่ยนทันที
          </Typography>
          {offerSlots.map((slot, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
              <Typography sx={{ fontSize: 13, color: '#697077', width: 60, flexShrink: 0 }}>ตัวเลือก {i + 1}</Typography>
              <TextField
                type="date"
                value={slot.date}
                onChange={(e) => setOfferSlots(offerSlots.map((s, j) => (j === i ? { ...s, date: e.target.value } : s)))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="time"
                value={slot.time}
                onChange={(e) => setOfferSlots(offerSlots.map((s, j) => (j === i ? { ...s, time: e.target.value } : s)))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          ))}

          <Box sx={{ bgcolor: '#EFF6FF', color: '#045BE4', fontSize: 13, borderRadius: 2, p: 1.5, my: 2 }}>
            นักศึกษาจะได้รับการแจ้งเตือน และเลือกวันได้จากในกล่องการแจ้งเตือนทันที
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button onClick={() => setSubview('hub')} sx={{ borderRadius: '20px', textTransform: 'none', border: `1px solid ${colors.border}`, color: colors.navy, px: 2.5 }}>ยกเลิก</Button>
            <Button
              fullWidth
              variant="contained"
              disabled={filledOfferSlots.length === 0 || rescheduleNote.trim().length === 0 || rescheduleSubmitting}
              onClick={submitReschedule}
              sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, bgcolor: '#0090FF', '&:hover': { bgcolor: '#0070D6' } }}
            >
              {rescheduleSubmitting ? 'กำลังส่ง...' : `ส่งให้นักศึกษาเลือก (${filledOfferSlots.length} วัน)`}
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

  // ── หน้าประกาศผล (U5): ความเห็น + ปุ่ม ผ่าน / ไม่ผ่าน → submitResult('passed' | 'failed')
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

// จุดเข้า: อ่าน role จาก useAuth() → เรนเดอร์มุมมองผู้ประกอบการหรือนักศึกษา (route เดียว 2 หน้าที่)
export default function InterviewsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerInterviewsView /> : <StudentInterviewsView />
}
