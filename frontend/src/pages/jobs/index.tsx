import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import RoomOutlinedIcon from '@mui/icons-material/RoomOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { closeJobpost, createJobpost, deleteJobpost, listMyJobposts, listOpenJobposts, updateJobpost } from '../../services/https/jobposts'
import { createApplication } from '../../services/https/applications'
import type { Jobpost, UpsertJobpostRequest } from '../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#9E9E9E', tagBg: 'rgba(0, 136, 255, 0.1)', thumbBg: '#D9D9D9' }

const jobTypeOptions = ['ทั้งหมด', 'พาร์ทไทม์', 'รายชั่วโมง', 'รายวัน', 'รายเดือน']
const locationOptions = ['ทั้งหมด', 'ประตู1, มทส', 'ประตู4, มทส', 'ประตู5, มทส']
const timeSlots = ['เช้า', 'บ่าย', 'เย็น', 'ดึก', 'เสาร์-อาทิตย์']
const distanceOptions = ['ไม่จำกัด', '1', '3', '5']

// FR5 — filter by distance. Job posts store their location as free text, so we
// resolve it against a handful of known SUT landmarks and fall back to the
// campus centre. Distance is then computed from the student's browser location.
const SUT_LANDMARKS: Record<string, { lat: number; lng: number }> = {
  'ประตู 1': { lat: 14.885, lng: 102.015 },
  'ประตู 4': { lat: 14.872, lng: 102.025 },
  'ประตู 5': { lat: 14.889, lng: 102.028 },
  'อาคารเรียนรวม': { lat: 14.8817, lng: 102.0207 },
  'สุรสัมมนาคาร': { lat: 14.883, lng: 102.023 },
  'ศูนย์เครื่องมือ': { lat: 14.889, lng: 102.028 },
  'บรรณสาร': { lat: 14.872, lng: 102.025 },
  'อาคารบริหาร': { lat: 14.881, lng: 102.021 },
  F9: { lat: 14.8805, lng: 102.0195 },
}
const SUT_CENTER = { lat: 14.8817, lng: 102.0207 }

function jobCoords(loc: string): { lat: number; lng: number } {
  if (loc) {
    for (const [key, coord] of Object.entries(SUT_LANDMARKS)) {
      if (loc.includes(key) || loc.replace(/\s/g, '').includes(key.replace(/\s/g, ''))) return coord
    }
  }
  return SUT_CENTER
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function matchesTimeSlots(job: { period: string; job_description: string; job_type: string }, slots: string[]): boolean {
  if (slots.length === 0) return true
  const hay = `${job.period} ${job.job_description} ${job.job_type}`.toLowerCase()
  return slots.some((slot) => {
    if (slot === 'เสาร์-อาทิตย์') return /เสาร์|อาทิตย์|สุดสัปดาห์|weekend/.test(hay)
    return hay.includes(slot)
  })
}

type JobFilters = {
  jobType: string
  location: string
  minWage: string
  maxWage: string
  timeSlots: string[]
  maxDistanceKm: string
}

const DEFAULT_JOB_FILTERS: JobFilters = {
  jobType: 'ทั้งหมด',
  location: 'ทั้งหมด',
  minWage: '0',
  maxWage: '50000',
  timeSlots: [],
  maxDistanceKm: 'ไม่จำกัด',
}

function FilterDialog({
  open,
  onClose,
  value,
  onApply,
}: Readonly<{ open: boolean; onClose: () => void; value: JobFilters; onApply: (filters: JobFilters) => void }>) {
  // Seeded once per mount from `value`. The parent remounts this component (via a
  // `key` keyed to open/close) each time the dialog reopens, so this always starts
  // from the last-applied filters without needing an effect to resync it.
  const [draft, setDraft] = useState<JobFilters>(value)

  function toggleSlot(slot: string) {
    setDraft((d) => ({
      ...d,
      timeSlots: d.timeSlots.includes(slot) ? d.timeSlots.filter((x) => x !== slot) : [...d.timeSlots, slot],
    }))
  }

  function clear() {
    setDraft(DEFAULT_JOB_FILTERS)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4, p: 1 } } }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>ตัวกรอง</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>

        <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.5 }}>ประเภทงาน</Typography>
        <TextField select fullWidth size="small" value={draft.jobType} onChange={(e) => setDraft({ ...draft, jobType: e.target.value })} sx={{ mb: 2 }}>
          {jobTypeOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>

        <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.5 }}>สถานที่</Typography>
        <TextField select fullWidth size="small" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} sx={{ mb: 2 }}>
          {locationOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>

        <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.5 }}>รายได้</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <TextField size="small" value={draft.minWage} onChange={(e) => setDraft({ ...draft, minWage: e.target.value })} fullWidth />
          <Typography>-</Typography>
          <TextField size="small" value={draft.maxWage} onChange={(e) => setDraft({ ...draft, maxWage: e.target.value })} fullWidth />
          <Typography sx={{ whiteSpace: 'nowrap', fontSize: 14 }}>บาท</Typography>
        </Box>

        <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.5 }}>เวลาทำงาน</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1, mb: 2 }}>
          {timeSlots.map((slot) => (
            <FormControlLabel
              key={slot}
              control={<Checkbox size="small" checked={draft.timeSlots.includes(slot)} onChange={() => toggleSlot(slot)} />}
              label={<Typography sx={{ fontSize: 13 }}>{slot}</Typography>}
            />
          ))}
        </Box>

        <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 0.5 }}>รัศมีจากตำแหน่งของฉัน (กม.)</Typography>
        <TextField
          select
          fullWidth
          size="small"
          value={draft.maxDistanceKm}
          onChange={(e) => setDraft({ ...draft, maxDistanceKm: e.target.value })}
          sx={{ mb: 3 }}
        >
          {distanceOptions.map((o) => (
            <MenuItem key={o} value={o}>
              {o === 'ไม่จำกัด' ? 'ไม่จำกัด' : `ไม่เกิน ${o} กม.`}
            </MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button onClick={clear} fullWidth sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: '#F0F0F0', color: colors.navy, '&:hover': { bgcolor: '#E4E4E4' } }}>
            ล้างค่า
          </Button>
          <Button
            onClick={() => { onApply(draft); onClose() }}
            fullWidth
            variant="contained"
            sx={{ borderRadius: '40px', textTransform: 'none', bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            ใช้ตัวกรอง
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

function OutcomeDialog({
  open,
  onClose,
  success,
  message,
}: Readonly<{ open: boolean; onClose: () => void; success: boolean; message?: string | null }>) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <Box sx={{ p: 4, textAlign: 'center', position: 'relative' }}>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12 }}><CloseIcon /></IconButton>
        {success ? (
          <CheckCircleOutlineIcon sx={{ fontSize: 96, color: '#2E7D32' }} />
        ) : (
          <HighlightOffIcon sx={{ fontSize: 96, color: '#D32F2F' }} />
        )}
        <Typography sx={{ fontWeight: 700, fontSize: 26, color: colors.navy, mt: 2 }}>
          {success ? 'สมัครงานสำเร็จ' : 'สมัครงานไม่สำเร็จ'}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#697077', mt: 1 }}>
          {message ?? (success ? 'ตรวจสอบใบสมัครงานได้ที่เมนู "ใบสมัครงาน"' : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')}
        </Typography>
      </Box>
    </Dialog>
  )
}

// Renders a text field where the employer typed one item per line as a
// bulleted list. Falls back to a single line for plain text.
function DetailSection({ title, text }: Readonly<{ title: string; text: string }>) {
  const items = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (items.length === 0) return null
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>{title}</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {items.map((it, i) => (
          <Typography component="li" key={i} sx={{ fontSize: 13, color: '#333' }}>{it}</Typography>
        ))}
      </Box>
    </Box>
  )
}

function JobDetailDialog({
  job,
  onClose,
  onApply,
  applyLabel = 'ยื่นใบสมัครงาน',
}: Readonly<{ job: Jobpost | null; onClose: () => void; onApply: () => void; applyLabel?: string }>) {
  return (
    <Dialog open={job !== null} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      {job && (
        <Box sx={{ p: 3.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>รายละเอียดงาน</Typography>
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Box sx={{ width: 64, height: 64, borderRadius: '10px', bgcolor: colors.thumbBg, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>{job.position}</Typography>
              <Typography sx={{ fontSize: 14, color: colors.navy }}>{job.company_name}</Typography>
              {job.location && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <RoomOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                  <Typography sx={{ fontSize: 14, color: colors.navy }}>{job.location}</Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: 14, color: colors.navy, fontWeight: 600, mt: 0.25 }}>{job.wage} บาท/ชั่วโมง</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {job.job_type && <Chip label={job.job_type} size="small" sx={{ bgcolor: colors.tagBg, color: colors.navy, borderRadius: '5px' }} />}
          </Box>

          <DetailSection title="รายละเอียดงาน" text={job.job_description} />
          <DetailSection title="คุณสมบัติหลัก" text={job.property} />

          {job.period && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <AccessTimeOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy }}>เวลาทำงาน</Typography>
              </Box>
              <Typography sx={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line', pl: 3.25 }}>{job.period}</Typography>
            </Box>
          )}

          <DetailSection title="คุณสมบัติเพิ่มเติม" text={job.additional_qualification} />

          {job.welfare && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>สวัสดิการ</Typography>
              <Typography sx={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line' }}>{job.welfare}</Typography>
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            onClick={onApply}
            sx={{ height: 52, borderRadius: '40px', textTransform: 'none', fontWeight: 600, fontSize: 16, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
          >
            {applyLabel}
          </Button>
        </Box>
      )}
    </Dialog>
  )
}

function StudentJobSearchView() {
  usePageTitle('ค้นหางานพาร์ทไทม์')
  const { token } = useAuth()
  const routerLocation = useLocation()
  const navigate = useNavigate()

  const [jobs, setJobs] = useState<Jobpost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // A query typed on the Dashboard's search box arrives via router state.
  const [query, setQuery] = useState(() => (routerLocation.state as { query?: string } | null)?.query ?? '')
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS)
  const [selectedJob, setSelectedJob] = useState<Jobpost | null>(null)
  const [outcome, setOutcome] = useState<'success' | 'fail' | null>(null)
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoDenied, setGeoDenied] = useState(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoDenied(true),
      { timeout: 8000 },
    )
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listOpenJobposts(token)
        if (!cancelled) setJobs(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดประกาศงานไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    const minWage = Number(filters.minWage) || 0
    const maxWage = Number(filters.maxWage) || Number.POSITIVE_INFINITY

    const maxDist = filters.maxDistanceKm === 'ไม่จำกัด' ? Infinity : Number(filters.maxDistanceKm)

    return jobs.filter((job) => {
      if (q && !job.position.toLowerCase().includes(q) && !job.company_name.toLowerCase().includes(q)) return false
      if (filters.jobType !== 'ทั้งหมด' && job.job_type !== filters.jobType) return false
      if (filters.location !== 'ทั้งหมด' && job.location !== filters.location) return false
      if (job.wage < minWage || job.wage > maxWage) return false
      if (!matchesTimeSlots(job, filters.timeSlots)) return false
      if (maxDist !== Infinity && userCoords && distanceKm(userCoords, jobCoords(job.location)) > maxDist) return false
      return true
    })
  }, [jobs, query, filters, userCoords])

  function jobDistanceLabel(job: Jobpost): string | null {
    if (!userCoords) return null
    return `~${distanceKm(userCoords, jobCoords(job.location)).toFixed(1)} กม.`
  }

  async function apply() {
    if (!selectedJob) return
    if (!token) {
      setSelectedJob(null)
      navigate('/login')
      return
    }
    const jobId = selectedJob.id
    setSelectedJob(null)
    try {
      await createApplication(token, { jobpost_id: jobId })
      setOutcomeMessage(null)
      setOutcome('success')
    } catch (err) {
      setOutcomeMessage(err instanceof ApiError ? (err.detail ?? err.message) : null)
      setOutcome('fail')
    }
  }

  return (
    <Box sx={{ maxWidth: 950, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <TextField
          placeholder="พนักงานเสิร์ฟ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(158, 158, 158, 0.1)' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> } }}
        />
        <Button
          variant="outlined"
          startIcon={<TuneOutlinedIcon />}
          onClick={() => setFilterOpen(true)}
          sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, borderColor: '#C4C4C4', px: 3, flexShrink: 0 }}
        >
          ตัวกรอง
        </Button>
        <Button
          variant="contained"
          sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#0088FF', px: 4, flexShrink: 0, '&:hover': { bgcolor: '#0070D6' } }}
        >
          ค้นหา
        </Button>
      </Box>

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: colors.navy, mb: 1 }}>
        {query.trim().length === 0
          ? 'แนะนำสำหรับคุณ'
          : <>ผลการค้นหา <Box component="span" sx={{ fontWeight: 400, fontSize: 16 }}>{filteredJobs.length} รายการ</Box></>}
      </Typography>
      {geoDenied && filters.maxDistanceKm !== 'ไม่จำกัด' && (
        <Typography sx={{ fontSize: 12, color: '#B5850C', mb: 1 }}>
          ไม่สามารถเข้าถึงตำแหน่งของคุณได้ — ตัวกรองระยะทางถูกปิดใช้งาน
        </Typography>
      )}

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {filteredJobs.map((job) => (
            <Box
              key={job.id}
              onClick={() => setSelectedJob(job)}
              sx={{
                border: `1px solid ${colors.border}`,
                borderRadius: '20px',
                p: 2.5,
                display: 'flex',
                gap: 2,
                cursor: 'pointer',
                '&:hover': { boxShadow: '0px 4px 16px rgba(0,0,0,0.08)' },
              }}
            >
              <Box sx={{ width: 57, height: 57, borderRadius: '10px', bgcolor: colors.thumbBg, flexShrink: 0 }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>{job.position}</Typography>
                <Typography sx={{ fontSize: 16, color: colors.navy, mt: 0.5 }}>{job.company_name}</Typography>
                {job.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <RoomOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                    <Typography sx={{ fontSize: 16, color: colors.navy }}>{job.location}</Typography>
                    {jobDistanceLabel(job) && (
                      <Chip label={jobDistanceLabel(job)} size="small" sx={{ bgcolor: '#E5F2FF', color: '#0066CC', height: 20, fontSize: 12 }} />
                    )}
                  </Box>
                )}
                <Typography sx={{ fontSize: 16, color: colors.navy, mt: 0.5 }}>{job.wage} บาท/ชั่วโมง</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignSelf: 'flex-start' }}>
                {job.job_type && <Chip label={job.job_type} size="small" sx={{ bgcolor: colors.tagBg, color: colors.navy, borderRadius: '5px', fontSize: 13 }} />}
              </Box>
            </Box>
          ))}

          {filteredJobs.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 6 }}>ไม่พบตำแหน่งงานที่ค้นหา</Typography>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 4 }}>
        <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)} sx={{ textTransform: 'none', color: '#9E9E9E' }}>
          Previous
        </Button>
        {[1, 2, 3].map((n) => (
          <Box
            key={n}
            onClick={() => setPage(n)}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              bgcolor: page === n ? '#624DE3' : '#E0E0E0',
              color: page === n ? '#FFFFFF' : '#000000',
            }}
          >
            {n}
          </Box>
        ))}
        <Button onClick={() => setPage((p) => p + 1)} sx={{ textTransform: 'none', color: '#9E9E9E' }}>
          Next
        </Button>
      </Box>

      <FilterDialog key={String(filterOpen)} open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} />
      <JobDetailDialog
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={() => void apply()}
        applyLabel={token ? 'ยื่นใบสมัครงาน' : 'เข้าสู่ระบบเพื่อสมัครงาน'}
      />
      <OutcomeDialog open={outcome !== null} onClose={() => setOutcome(null)} success={outcome === 'success'} message={outcomeMessage} />
    </Box>
  )
}

const EMPLOYER_JOB_TYPES = ['พาร์ทไทม์', 'เต็มเวลา', 'รายชั่วโมง', 'ชั่วคราว']

type JobFormState = {
  position: string
  jobType: string
  location: string
  welfare: string
  jobDescription: string
  property: string
  additionalQualification: string
  wage: string
  quantity: number
  period: string
}

const EMPTY_JOB_FORM: JobFormState = {
  position: '',
  jobType: '',
  location: '',
  welfare: '',
  jobDescription: '',
  property: '',
  additionalQualification: '',
  wage: '',
  quantity: 1,
  period: '',
}

function jobpostToForm(job: Jobpost): JobFormState {
  return {
    position: job.position,
    jobType: job.job_type,
    location: job.location,
    welfare: job.welfare,
    jobDescription: job.job_description,
    property: job.property,
    additionalQualification: job.additional_qualification,
    wage: String(job.wage),
    quantity: job.quantity || 1,
    period: job.period,
  }
}

function formToPayload(form: JobFormState): UpsertJobpostRequest {
  return {
    position: form.position.trim(),
    job_type: form.jobType || undefined,
    job_description: form.jobDescription.trim() || undefined,
    wage: Number(form.wage) || 0,
    period: form.period.trim() || undefined,
    location: form.location.trim() || undefined,
    welfare: form.welfare.trim() || undefined,
    property: form.property.trim() || undefined,
    additional_qualification: form.additionalQualification.trim() || undefined,
    quantity: form.quantity,
  }
}

const JOB_STATUS_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'กำลังเปิดรับ', color: '#217829', bg: '#EAF7EA' },
  closed: { label: 'ปิดรับสมัครแล้ว', color: '#697077', bg: '#F0F0F0' },
  draft: { label: 'แบบร่าง', color: '#B5850C', bg: '#FFF6E0' },
}

function EmployerJobPostingsView() {
  usePageTitle('จัดการประกาศงาน')
  const { token } = useAuth()

  const [jobs, setJobs] = useState<Jobpost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<JobFormState>(EMPTY_JOB_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Jobpost | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listMyJobposts(token!)
        if (!cancelled) setJobs(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดประกาศงานไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, reloadToken])

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_JOB_FORM)
    setFormError(null)
    setMode('form')
  }

  function startEdit(job: Jobpost) {
    setEditingId(job.id)
    setForm(jobpostToForm(job))
    setFormError(null)
    setMode('form')
  }

  async function saveJob() {
    if (!token) return
    if (form.position.trim().length === 0 || Number(form.wage) <= 0) {
      setFormError('กรุณากรอกชื่อตำแหน่งงานและอัตราค่าตอบแทน')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const payload = formToPayload(form)
      if (editingId) {
        await updateJobpost(token, editingId, payload)
      } else {
        await createJobpost(token, payload)
      }
      setMode('list')
      setReloadToken((t) => t + 1)
    } catch (err) {
      setFormError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleClose(id: number) {
    if (!token) return
    setClosingId(id)
    try {
      await closeJobpost(token, id)
      setReloadToken((t) => t + 1)
    } catch {
      setError('ปิดรับสมัครไม่สำเร็จ')
    } finally {
      setClosingId(null)
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      await deleteJobpost(token, deleteTarget.id)
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ลบประกาศงานไม่สำเร็จ')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  if (mode === 'form') {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 28, color: colors.navy, mb: 3 }}>
          สร้าง/แก้ไขประกาศรับสมัครงาน
        </Typography>

        <Box sx={{ border: '1px solid #E8E8E8', borderRadius: 4, p: 4 }}>
          <ErrorAlert message={formError} />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="ชื่อตำแหน่งงาน"
                placeholder="เช่น พนักงานเสิร์ฟ"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                required
                fullWidth
              />
              <TextField
                select
                label="ประเภทงาน"
                value={form.jobType}
                onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                fullWidth
              >
                {EMPLOYER_JOB_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="รายละเอียดงาน"
                placeholder={'อธิบายลักษณะงาน (พิมพ์ 1 บรรทัด = 1 ข้อ)\nเช่น\nให้บริการลูกค้าและรับออเดอร์\nจัดเตรียมโต๊ะและเก้าอี้'}
                value={form.jobDescription}
                onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                multiline
                minRows={4}
                fullWidth
              />
              <TextField
                label="อัตราค่าตอบแทน"
                placeholder="กรอกค่าตอบแทน"
                type="number"
                value={form.wage}
                onChange={(e) => setForm({ ...form, wage: e.target.value })}
                required
                fullWidth
                slotProps={{ input: { endAdornment: <InputAdornment position="end">บาท/ชั่วโมง</InputAdornment> } }}
              />
              <TextField
                label="เวลาทำงาน"
                placeholder="เช่น จันทร์-ศุกร์ 17:00-23:00 (เลือกวันทำงานได้)"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="สถานที่ปฏิบัติงาน"
                placeholder="เช่น กรุงเทพมหานคร"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                fullWidth
              />
              <TextField
                label="สวัสดิการ"
                placeholder="เช่น ค่าอาหาร, โบนัส"
                value={form.welfare}
                onChange={(e) => setForm({ ...form, welfare: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
              <TextField
                label="คุณสมบัติหลัก"
                placeholder={'พิมพ์ 1 บรรทัด = 1 ข้อ\nเช่น\nอายุ 18 ปีขึ้นไป\nเพศชาย'}
                value={form.property}
                onChange={(e) => setForm({ ...form, property: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
              <TextField
                label="คุณสมบัติเพิ่มเติม"
                placeholder={'พิมพ์ 1 บรรทัด = 1 ข้อ\nเช่น\nตรงต่อเวลา\nบุคลิกภาพดี'}
                value={form.additionalQualification}
                onChange={(e) => setForm({ ...form, additionalQualification: e.target.value })}
                multiline
                minRows={3}
                fullWidth
              />
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy, mb: 0.75 }}>จำนวนพนักงานที่ต้องการ</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <IconButton
                    onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })}
                    sx={{ border: '1px solid #D9D9D9', borderRadius: 1.5 }}
                    size="small"
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{form.quantity}</Typography>
                  <IconButton
                    onClick={() => setForm({ ...form, quantity: form.quantity + 1 })}
                    sx={{ border: '1px solid #D9D9D9', borderRadius: 1.5 }}
                    size="small"
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
              <Box
                component="label"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  border: '1.5px dashed #B9C6DC',
                  borderRadius: 3,
                  p: 2,
                  cursor: 'pointer',
                }}
              >
                <input type="file" accept=".jpg,.jpeg,.png" hidden />
                <CloudUploadOutlinedIcon sx={{ color: colors.navy }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.navy }}>รูปภาพ</Typography>
                  <Typography sx={{ fontSize: 11, color: '#9AA0A6' }}>รองรับไฟล์ JPG, PNG (ขนาดไม่เกิน 5MB)</Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 4 }}>
            <Button
              onClick={() => setMode('list')}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 3, color: colors.navy, bgcolor: '#F0F0F0', '&:hover': { bgcolor: '#E4E4E4' } }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              onClick={() => void saveJob()}
              disabled={saving}
              sx={{ borderRadius: '40px', textTransform: 'none', px: 3, bgcolor: colors.navy, '&:hover': { bgcolor: '#000226' } }}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 28, color: colors.navy }}>
          ประกาศงานของฉัน
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={startCreate}
          sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: '#0088FF', px: 2.5, '&:hover': { bgcolor: '#0070D6' } }}
        >
          สร้างประกาศงานใหม่
        </Button>
      </Box>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ border: '1px solid #E8E8E8', borderRadius: 3, overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F7FAFF' }}>
                <TableCell>ชื่อตำแหน่งงาน</TableCell>
                <TableCell>ค่าจ้างต่อชั่วโมง (บาท)</TableCell>
                <TableCell>จำนวนรับสมัคร</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => {
                const status = JOB_STATUS_CHIP[job.status] ?? JOB_STATUS_CHIP.open
                return (
                  <TableRow key={job.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{job.position}</TableCell>
                    <TableCell>{job.wage}</TableCell>
                    <TableCell>{job.quantity}</TableCell>
                    <TableCell>
                      <Chip size="small" label={status.label} sx={{ bgcolor: status.bg, color: status.color, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <IconButton size="small" onClick={() => startEdit(job)} sx={{ border: '1px solid #D9D9D9', borderRadius: 1.5 }}>
                          <EditOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                        </IconButton>
                        <Button
                          size="small"
                          disabled={job.status === 'closed' || closingId === job.id}
                          onClick={() => void handleClose(job.id)}
                          sx={{ bgcolor: '#FCE4E4', color: '#DA1E28', textTransform: 'none', borderRadius: '20px', px: 1.5, fontSize: 13 }}
                        >
                          ปิดรับสมัคร
                        </Button>
                        <IconButton
                          size="small"
                          title="ลบประกาศงาน"
                          onClick={() => setDeleteTarget(job)}
                          sx={{ border: '1px solid #F3C2C4', borderRadius: 1.5 }}
                        >
                          <DeleteOutlineIcon fontSize="small" sx={{ color: '#DA1E28' }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                )
              })}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: '#697077', py: 4 }}>
                    ยังไม่มีประกาศงาน — กด "สร้างประกาศงานใหม่" เพื่อเริ่มต้น
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mb: 1 }}>ลบประกาศงานนี้?</Typography>
          <Typography sx={{ fontSize: 14, color: '#52545C', mb: 1.5 }}>
            {deleteTarget?.position}
          </Typography>
          <Box sx={{ bgcolor: '#FDEAEA', color: '#B3261E', fontSize: 13, borderRadius: 2, p: 1.5, mb: 2.5 }}>
            ใบสมัครทั้งหมดของประกาศนี้ และนัดสัมภาษณ์ที่ผูกกับใบสมัครเหล่านั้น จะถูกลบไปด้วย — ย้อนกลับไม่ได้
            <br />
            ถ้าแค่ไม่อยากรับสมัครเพิ่ม ให้กด &quot;ปิดรับสมัคร&quot; แทน
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', borderRadius: '40px', px: 3, color: colors.navy, bgcolor: '#F0F0F0' }}>
              ยกเลิก
            </Button>
            <Button
              variant="contained"
              disabled={deleting}
              onClick={() => void handleDelete()}
              sx={{ textTransform: 'none', borderRadius: '40px', px: 3, bgcolor: '#DA1E28', '&:hover': { bgcolor: '#B31923' } }}
            >
              {deleting ? 'กำลังลบ…' : 'ลบประกาศงาน'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  )
}

export default function JobsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerJobPostingsView /> : <StudentJobSearchView />
}
