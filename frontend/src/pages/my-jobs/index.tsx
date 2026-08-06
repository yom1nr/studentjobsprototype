import { Box, Chip, Typography } from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import type { EmploymentAgreement } from '../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

// Mock active contracts until the /employment-agreements endpoint is available.
const MOCK_MY_JOBS: EmploymentAgreement[] = [
  {
    id: 1,
    company_name: 'Café Doi',
    position: 'พนักงานเสิร์ฟพาร์ทไทม์',
    start_date: '2026-07-01',
    wage_rate: 55,
    duration_months: 4,
    working_hours: 'จันทร์-ศุกร์ 16:00-20:00',
    leave_policy: 'ลาได้เดือนละ 2 วัน แจ้งล่วงหน้า 1 วัน',
    status: 'accepted',
  },
]

const statusMap: Record<EmploymentAgreement['status'], { label: string; color: string; bg: string }> = {
  awaiting_response: { label: 'รอตอบรับ', color: '#B5850C', bg: '#FFF6E0' },
  accepted: { label: 'กำลังทำงาน', color: '#217829', bg: '#EAF7EA' },
  rejected: { label: 'ปฏิเสธแล้ว', color: '#DA1E28', bg: '#FDEAEA' },
}

export default function MyJobsPage() {
  usePageTitle('งานของฉัน')
  const activeJobs = MOCK_MY_JOBS.filter((job) => job.status === 'accepted')

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 0.5 }}>
        งานของฉัน
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>งานที่คุณกำลังทำงานอยู่ในขณะนี้</Typography>

      {activeJobs.length === 0 && (
        <Typography sx={{ color: '#697077', textAlign: 'center', py: 6 }}>
          คุณยังไม่มีงานที่กำลังทำอยู่ ลองไปที่หน้า “ค้นหางาน” เพื่อสมัครงานใหม่
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {activeJobs.map((job) => {
          const status = statusMap[job.status]
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
              }}
            >
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy }}>{job.position}</Typography>
                  <Chip label={status.label} size="small" sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }} />
                </Box>
                <Typography sx={{ fontSize: 14, color: '#52545C', mb: 1.5 }}>{job.company_name}</Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EventOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                    <Typography sx={{ fontSize: 13, color: '#697077' }}>
                      เริ่มงาน {new Date(job.start_date).toLocaleDateString('th-TH')} · {job.duration_months} เดือน
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTimeOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                    <Typography sx={{ fontSize: 13, color: '#697077' }}>{job.working_hours}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PaidOutlinedIcon fontSize="small" sx={{ color: '#697077' }} />
                    <Typography sx={{ fontSize: 13, color: '#697077' }}>{job.wage_rate} บาท/ชม.</Typography>
                  </Box>
                </Box>

                <Typography sx={{ fontSize: 12, color: '#9AA0A6', mt: 1.5 }}>สิทธิ์การลา: {job.leave_policy}</Typography>
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
