import { useEffect, useState } from 'react'
import { Alert, Box, Chip, Typography } from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { listMyAgreements } from '../../services/https/agreements'
import { listMyInterviews } from '../../services/https/interviews'
import { listEmployerApplications, listMyApplications } from '../../services/https/applications'
import type { AgreementRecord, InterviewScheduleRecord } from '../../interface/IInterviewInterface'
import type { Application } from '../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : fallback
}

/** When a contract runs out: its start date plus its duration in months. Null
 *  when either is missing, in which case the contract has no known end. */
function contractEnd(a: AgreementRecord): Date | null {
  if (!a.start_date || a.duration_months <= 0) return null
  const end = new Date(a.start_date)
  if (Number.isNaN(end.getTime())) return null
  end.setMonth(end.getMonth() + a.duration_months)
  return end
}

export default function MyJobsPage() {
  usePageTitle('งานของฉัน')
  const { token, user } = useAuth()
  const isEmployer = user?.role === 'employer'

  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [interviews, setInterviews] = useState<InterviewScheduleRecord[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) return
      setLoading(true)
      try {
        // The agreement holds the terms but not the job title — that lives on the
        // application the interview was booked for, so all three are needed to
        // name the position.
        const [agrs, ivs, apps] = await Promise.all([
          listMyAgreements(token),
          listMyInterviews(token),
          isEmployer ? listEmployerApplications(token) : listMyApplications(token),
        ])
        if (cancelled) return
        setAgreements(agrs)
        setInterviews(ivs)
        setApplications(apps)
        setLoadedAt(Date.now())
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, 'โหลดข้อมูลงานไม่สำเร็จ'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token, isEmployer])

  /** Agreement → the interview it came from → that interview's application → its position. */
  function positionFor(a: AgreementRecord): string {
    const iv = interviews.find((i) => i.id === a.interview_schedule_id)
    if (!iv) return 'ไม่ระบุตำแหน่ง'
    return applications.find((app) => app.id === iv.application_id)?.position ?? 'ไม่ระบุตำแหน่ง'
  }

  // Only signed contracts are jobs; drafts and declined offers are not.
  const signed = agreements.filter((a) => a.status === 'accepted')

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <ErrorAlert message={error} />
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ErrorAlert message={error} />
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 0.5 }}>
        งานของฉัน
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>
        {isEmployer ? 'นักศึกษาที่อยู่ภายใต้สัญญาจ้างงานของคุณ' : 'งานที่คุณกำลังทำงานอยู่ในขณะนี้'}
      </Typography>

      {signed.length === 0 && (
        <Typography sx={{ color: '#697077', textAlign: 'center', py: 6 }}>
          {isEmployer
            ? 'ยังไม่มีนักศึกษาที่ทำสัญญาจ้างงานกับคุณ — จัดทำข้อตกลงได้ที่เมนู "ตกลงการจ้างงาน"'
            : 'คุณยังไม่มีงานที่กำลังทำอยู่ ลองไปที่หน้า "ค้นหางาน" เพื่อสมัครงานใหม่'}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {signed.map((job) => {
          const end = contractEnd(job)
          const ended = end != null && end.getTime() <= loadedAt
          return (
            <Box
              key={job.id}
              sx={{
                border: `1px solid ${colors.border}`,
                borderRadius: 3,
                p: 3,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 2,
                opacity: ended ? 0.65 : 1,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{positionFor(job)}</Typography>
                  <Chip
                    label={ended ? 'สิ้นสุดสัญญาแล้ว' : 'กำลังทำงาน'}
                    size="small"
                    sx={{
                      bgcolor: ended ? '#F0F0F0' : '#EAF7EA',
                      color: ended ? '#697077' : '#217829',
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                  {isEmployer && <PersonOutlineOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />}
                  <Typography sx={{ fontSize: 14, color: '#52545C' }}>
                    {isEmployer ? job.student_name : job.company_name}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EventOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                    <Typography sx={{ fontSize: 13, color: '#697077' }}>
                      เริ่มงาน {job.start_date} · {job.duration_months} เดือน
                      {end && ` (ถึง ${end.toISOString().slice(0, 10)})`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTimeOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                    <Typography sx={{ fontSize: 13, color: '#697077' }}>{job.working_hours || '-'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PaidOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                    <Typography sx={{ fontSize: 13, color: '#697077' }}>{job.wage_rate} บาท/ชม.</Typography>
                  </Box>
                </Box>

                {job.leave_policy && (
                  <Typography sx={{ fontSize: 12, color: '#9AA0A6', mt: 1.5 }}>สิทธิ์การลา: {job.leave_policy}</Typography>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
