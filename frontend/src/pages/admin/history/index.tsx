import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { usePageTitle } from '../../../components/usePageTitle'
import { ErrorAlert } from '../../../components/ErrorAlert'
import { useAuth } from '../../../auth/useAuth'
import { ApiError } from '../../../services/https'
import { listAllAgreements } from '../../../services/https/agreements'
import { listAllInterviews } from '../../../services/https/interviews'
import type { AgreementRecord, InterviewScheduleRecord } from '../../../interface/IInterviewInterface'

// ═══════════════════════════════════════════════════════════════════════════════
// [B6733827 · U8 View History / Past Agreements — actor "University Staff"]
// หน้าอ่านอย่างเดียวของเจ้าหน้าที่มหาวิทยาลัย: เห็นนัดสัมภาษณ์และข้อตกลงของ *ทุกคน* ในระบบ
// ต่างจากหน้าของผู้ประกอบการ/นักศึกษาที่ backend กรองให้เห็นแค่ของตัวเอง
//   GET /api/v1/admin/interviews   → InterviewController.ListAll
//   GET /api/v1/admin/agreements   → EmploymentController.ListAll
// เข้าถึงได้เฉพาะ role=admin (RoleRoute ฝั่งเว็บ + RequireRole("admin") ฝั่ง API)
// ═══════════════════════════════════════════════════════════════════════════════

const colors = { navy: '#000349', border: '#e0e0e0' }

type HistoryTab = 'agreements' | 'interviews'

// ป้ายสถานะ — ใช้คำเดียวกับที่ผู้ประกอบการ/นักศึกษาเห็น เพื่อให้เจ้าหน้าที่คุยกับทั้งสองฝ่ายรู้เรื่อง
const agreementChip: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'รอนักศึกษาตอบรับ', color: '#B5850C', bg: '#FFF0DD' },
  accepted: { label: 'มีผลบังคับ', color: '#217829', bg: '#EAF7EA' },
  rejected: { label: 'นักศึกษาปฏิเสธ', color: '#DA1E28', bg: '#FDEAEA' },
  void: { label: 'ยกเลิกแล้ว (ลบโดยผู้ประกอบการ)', color: '#697077', bg: '#F0F0F0' },
}
const interviewChip: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'รอนักศึกษายืนยัน', color: '#B5850C', bg: '#FFF0DD' },
  confirmed: { label: 'ยืนยันแล้ว', color: '#217829', bg: '#EAF7EA' },
  rescheduling: { label: 'กำลังขอเลื่อนนัด', color: '#C2410C', bg: '#FFEDD5' },
  completed: { label: 'ประกาศผลแล้ว', color: '#0969da', bg: '#ddf4ff' },
  cancelled: { label: 'ยกเลิก', color: '#697077', bg: '#F0F0F0' },
}
const resultLabel: Record<string, string> = { passed: 'ผ่าน', failed: 'ไม่ผ่าน', '': '—' }

function StatusChip({ map, value }: Readonly<{ map: Record<string, { label: string; color: string; bg: string }>; value: string }>) {
  const c = map[value] ?? { label: value || '—', color: '#697077', bg: '#F0F0F0' }
  return <Chip label={c.label} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600 }} />
}

const cell = { color: '#444', fontWeight: 500 }
const code = (prefix: string, id: number) => `${prefix}-${String(id).padStart(4, '0')}`

export default function AdminHistoryPage() {
  usePageTitle('ประวัติสัมภาษณ์และข้อตกลง')
  const { token } = useAuth()

  const [tab, setTab] = useState<HistoryTab>('agreements')
  const [agreements, setAgreements] = useState<AgreementRecord[]>([])
  const [interviews, setInterviews] = useState<InterviewScheduleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // โหลดทั้ง 2 ชุดพร้อมกัน — หน้าอ่านอย่างเดียว ไม่มี action จึงไม่ต้อง reload ซ้ำ
  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [agrs, ivs] = await Promise.all([listAllAgreements(token!), listAllInterviews(token!)])
        if (cancelled) return
        setAgreements(agrs)
        setInterviews(ivs)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ไม่สามารถโหลดประวัติได้')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  // ค้นหาด้วยชื่อนักศึกษาหรือชื่อบริษัท — ครอบทั้ง 2 แท็บ
  const q = search.trim().toLowerCase()
  const filteredAgreements = useMemo(
    () => (q ? agreements.filter((a) => `${a.student_name} ${a.company_name}`.toLowerCase().includes(q)) : agreements),
    [agreements, q],
  )
  const filteredInterviews = useMemo(
    () => (q ? interviews.filter((i) => `${i.student_name} ${i.company_name}`.toLowerCase().includes(q)) : interviews),
    [interviews, q],
  )

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1.8rem', mb: 0.5 }}>ประวัติสัมภาษณ์และข้อตกลง</Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>
        มุมมองเจ้าหน้าที่มหาวิทยาลัย — ดูได้ทุกรายการในระบบ (อ่านอย่างเดียว ใช้ตรวจสอบและไกล่เกลี่ย)
      </Typography>

      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tabs value={tab} onChange={(_, v: HistoryTab) => setTab(v)} sx={{ minHeight: 40 }}>
          <Tab value="agreements" label={`ข้อตกลงการจ้างงาน (${agreements.length})`} sx={{ textTransform: 'none', minHeight: 40 }} />
          <Tab value="interviews" label={`นัดสัมภาษณ์ (${interviews.length})`} sx={{ textTransform: 'none', minHeight: 40 }} />
        </Tabs>
        <TextField
          placeholder="ค้นหาชื่อนักศึกษา หรือชื่อบริษัท..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ ml: 'auto', width: 320, '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: '#fff' } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#6b6b6b' }} />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : tab === 'agreements' ? (
        <TableContainer sx={{ border: `1px solid ${colors.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: `1px solid ${colors.border}`, fontWeight: 700, color: colors.navy, py: 2 } }}>
                <TableCell>เลขที่</TableCell>
                <TableCell>นักศึกษา</TableCell>
                <TableCell>ผู้ประกอบการ</TableCell>
                <TableCell align="center">เริ่มงาน</TableCell>
                <TableCell align="center">ระยะเวลา</TableCell>
                <TableCell align="center">ค่าจ้าง/ชม.</TableCell>
                <TableCell align="center">สถานะ</TableCell>
                <TableCell>เหตุผลปฏิเสธ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAgreements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#6b6b6b' }}>ไม่พบข้อมูล</TableCell>
                </TableRow>
              ) : (
                filteredAgreements.map((a) => (
                  <TableRow key={a.id} sx={{ '& td': { borderBottom: `1px solid ${colors.border}`, py: 1.5 }, '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={cell}>{code('AG', a.id)}</TableCell>
                    <TableCell sx={cell}>{a.student_name || '—'}</TableCell>
                    <TableCell sx={cell}>{a.company_name || '—'}</TableCell>
                    <TableCell align="center" sx={cell}>{a.start_date || '—'}</TableCell>
                    <TableCell align="center" sx={cell}>{a.duration_months} เดือน</TableCell>
                    <TableCell align="center" sx={cell}>{a.wage_rate} บาท</TableCell>
                    <TableCell align="center"><StatusChip map={agreementChip} value={a.status} /></TableCell>
                    <TableCell sx={{ ...cell, fontSize: 13, color: '#697077' }}>{a.reject_reason || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer sx={{ border: `1px solid ${colors.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: `1px solid ${colors.border}`, fontWeight: 700, color: colors.navy, py: 2 } }}>
                <TableCell>เลขที่</TableCell>
                <TableCell>นักศึกษา</TableCell>
                <TableCell>ผู้ประกอบการ</TableCell>
                <TableCell align="center">วัน-เวลานัด</TableCell>
                <TableCell align="center">รูปแบบ</TableCell>
                <TableCell align="center">สถานะ</TableCell>
                <TableCell align="center">ผล</TableCell>
                <TableCell align="center">เลื่อนนัด</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInterviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#6b6b6b' }}>ไม่พบข้อมูล</TableCell>
                </TableRow>
              ) : (
                filteredInterviews.map((iv) => (
                  <TableRow key={iv.id} sx={{ '& td': { borderBottom: `1px solid ${colors.border}`, py: 1.5 }, '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={cell}>{code('IV', iv.id)}</TableCell>
                    <TableCell sx={cell}>{iv.student_name || '—'}</TableCell>
                    <TableCell sx={cell}>{iv.company_name || '—'}</TableCell>
                    <TableCell align="center" sx={cell}>{iv.appointment_date} {iv.appointment_time} น.</TableCell>
                    <TableCell align="center" sx={cell}>{iv.interview_format === 'online' ? 'ออนไลน์' : 'ณ สถานที่'}</TableCell>
                    <TableCell align="center"><StatusChip map={interviewChip} value={iv.status} /></TableCell>
                    <TableCell align="center" sx={{ ...cell, color: iv.result === 'passed' ? '#217829' : iv.result === 'failed' ? '#DA1E28' : '#697077', fontWeight: 700 }}>
                      {resultLabel[iv.result] ?? iv.result}
                    </TableCell>
                    <TableCell align="center" sx={{ ...cell, color: '#697077' }}>
                      {iv.reschedules?.length ? `${iv.reschedules.length} ครั้ง` : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
