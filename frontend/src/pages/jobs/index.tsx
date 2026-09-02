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
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
import FavoriteIcon from '@mui/icons-material/Favorite'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { closeJobpost, createJobpost, listMyJobposts, listOpenJobposts, updateJobpost } from '../../services/https/jobposts'
import { createApplication } from '../../services/https/applications'
import type { Jobpost, UpsertJobpostRequest } from '../../interface/IJobInterface'

const colors = { navy: '#012150', border: '#D9D9D9', field: '#F0F0F0', thumbBg: '#C4C4C4', tagBg: '#EFEFEF' }

const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'ประตู 1': { lat: 14.8850, lng: 102.0150 },
  'ประตู1': { lat: 14.8850, lng: 102.0150 },
  'ประตู 4': { lat: 14.8720, lng: 102.0250 },
  'ประตู4': { lat: 14.8720, lng: 102.0250 },
  'ประตู 5': { lat: 14.8890, lng: 102.0280 },
  'ประตู5': { lat: 14.8890, lng: 102.0280 },
  'อาคารกิจกรรมนักศึกษา': { lat: 14.8817, lng: 102.0207 },
  'อาคารสิรินธรวิทยารมย์': { lat: 14.8805, lng: 102.0195 },
  'อาคารบรรณสาร': { lat: 14.8720, lng: 102.0250 },
  'ศูนย์เครื่องมือ': { lat: 14.8890, lng: 102.0280 },
  'อาคารบริหาร': { lat: 14.8810, lng: 102.0210 },
  'สุรสัมมนาคาร': { lat: 14.8830, lng: 102.0230 },
  'อาคารคอมพิวเตอร์': { lat: 14.8815, lng: 102.0200 },
  'อาคารสุรนิทัศน์': { lat: 14.8840, lng: 102.0220 },
  'สำนักงานอธิการบดี': { lat: 14.8810, lng: 102.0210 },
}

function getJobCoordinates(locStr: string): { lat: number; lng: number } {
  if (!locStr) return { lat: 14.8817, lng: 102.0207 }
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (locStr.includes(key)) return coords
  }
  return { lat: 14.8817, lng: 102.0207 }
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  return Math.round(d * 10) / 10
}

type JobFilters = {
  jobType: string
  location: string
  minWage: string
  maxWage: string
  maxDistanceKm: string
}

const DEFAULT_JOB_FILTERS: JobFilters = {
  jobType: 'ทั้งหมด',
  location: 'ทั้งหมด',
  minWage: '',
  maxWage: '',
  maxDistanceKm: 'ไม่จำกัด',
}

const JOB_TYPE_OPTIONS = ['ทั้งหมด', 'งานบริการ/สถานที่', 'งานวิชาการ/ธุรการ', 'งานสื่อ/กราฟิก', 'งานร้านอาหาร/คาเฟ่', 'งานคลังสินค้า/จัดส่ง']

function FilterDialog({
  open,
  onClose,
  value,
  onApply,
}: Readonly<{
  open: boolean
  onClose: () => void
  value: JobFilters
  onApply: (f: JobFilters) => void
}>) {
  const [draft, setDraft] = useState<JobFilters>(value)

  function handleReset() {
    setDraft(DEFAULT_JOB_FILTERS)
  }

  function handleApply() {
    onApply(draft)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
      <Box sx={{ p: 3.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>ตัวกรองการค้นหา</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            select
            label="ประเภทงาน"
            size="small"
            value={draft.jobType}
            onChange={(e) => setDraft({ ...draft, jobType: e.target.value })}
            fullWidth
            sx={{ bgcolor: colors.field, borderRadius: 1 }}
          >
            {JOB_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="สถานที่ปฏิบัติงาน"
            placeholder="เช่น ประตู 1, อาคารสิรินธร"
            size="small"
            value={draft.location === 'ทั้งหมด' ? '' : draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value || 'ทั้งหมด' })}
            fullWidth
            sx={{ bgcolor: colors.field, borderRadius: 1 }}
          />

          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 1 }}>รัศมีระยะทางสูงสุด (GPS)</Typography>
            <TextField
              select
              size="small"
              value={draft.maxDistanceKm}
              onChange={(e) => setDraft({ ...draft, maxDistanceKm: e.target.value })}
              fullWidth
              sx={{ bgcolor: colors.field, borderRadius: 1 }}
            >
              <MenuItem value="ไม่จำกัด">ไม่จำกัดระยะทาง</MenuItem>
              <MenuItem value="2">ภายใน 2 กิโลเมตร</MenuItem>
              <MenuItem value="5">ภายใน 5 กิโลเมตร</MenuItem>
              <MenuItem value="10">ภายใน 10 กิโลเมตร</MenuItem>
            </TextField>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: 14, color: colors.navy, mb: 1 }}>อัตราค่าจ้าง (บาท/ชั่วโมง)</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <TextField
                placeholder="ขั้นต่ำ"
                type="number"
                size="small"
                value={draft.minWage}
                onChange={(e) => setDraft({ ...draft, minWage: e.target.value })}
                sx={{ bgcolor: colors.field, borderRadius: 1, flex: 1 }}
              />
              <Typography sx={{ color: '#666' }}>-</Typography>
              <TextField
                placeholder="สูงสุด"
                type="number"
                size="small"
                value={draft.maxWage}
                onChange={(e) => setDraft({ ...draft, maxWage: e.target.value })}
                sx={{ bgcolor: colors.field, borderRadius: 1, flex: 1 }}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleReset}
            fullWidth
            sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, borderColor: '#C4C4C4', height: 44 }}
          >
            รีเซ็ต
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            fullWidth
            sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, height: 44, '&:hover': { bgcolor: '#000226' } }}
          >
            ปรับใช้ตัวกรอง
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}

function ApplicationOutcomeDialog({
  open,
  success,
  message,
  onClose,
}: Readonly<{
  open: boolean
  success: boolean
  message: string | null
  onClose: () => void
}>) {
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
            {job.period && <Chip label={job.period} size="small" sx={{ bgcolor: colors.tagBg, color: colors.navy, borderRadius: '5px' }} />}
          </Box>

          {job.job_description && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>ลักษณะงาน</Typography>
              <Typography sx={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line' }}>{job.job_description}</Typography>
            </Box>
          )}

          {job.property && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>คุณสมบัติผู้สมัคร</Typography>
              <Typography sx={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line' }}>{job.property}</Typography>
            </Box>
          )}

          {job.welfare && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: colors.navy, mb: 0.5 }}>สวัสดิการ</Typography>
              <Typography sx={{ fontSize: 13, color: '#333', whiteSpace: 'pre-line' }}>{job.welfare}</Typography>
            </Box>
          )}

          <Button
            variant="contained"
            onClick={onApply}
            fullWidth
            sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, height: 46, fontWeight: 600, '&:hover': { bgcolor: '#000226' } }}
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
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const storageKey = user?.id ? `favorite_jobs_${user.id}` : 'favorite_jobs_guest'

  const [jobs, setJobs] = useState<Jobpost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_JOB_FILTERS)
  const [selectedJob, setSelectedJob] = useState<Jobpost | null>(null)
  const [outcome, setOutcome] = useState<'success' | 'fail' | null>(null)
  const [outcomeMessage, setOutcomeMessage] = useState<string | null>(null)

  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  const [favoriteJobIds, setFavoriteJobIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      setFavoriteJobIds(saved ? JSON.parse(saved) : [])
    } catch {
      setFavoriteJobIds([])
    }
  }, [storageKey])

  function toggleFavorite(e: React.MouseEvent, jobId: number) {
    e.stopPropagation()
    setFavoriteJobIds((prev) => {
      const updated = prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const PAGE_SIZE = 8
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [query, filters, gpsEnabled, showOnlyFavorites])

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listOpenJobposts(token!)
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

  function handleToggleGps() {
    if (gpsEnabled) {
      setGpsEnabled(false)
      setUserCoords(null)
      return
    }

    setGpsLoading(true)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setGpsEnabled(true)
          setGpsLoading(false)
        },
        () => {
          // Fallback to SUT Campus Center coordinates
          setUserCoords({ lat: 14.8817, lng: 102.0207 })
          setGpsEnabled(true)
          setGpsLoading(false)
        },
        { timeout: 5000 },
      )
    } else {
      setUserCoords({ lat: 14.8817, lng: 102.0207 })
      setGpsEnabled(true)
      setGpsLoading(false)
    }
  }

  const filteredJobs = useMemo(() => {
    const q = query.trim().toLowerCase()
    const minWage = Number(filters.minWage) || 0
    const maxWage = Number(filters.maxWage) || Number.POSITIVE_INFINITY
    const maxDist = filters.maxDistanceKm !== 'ไม่จำกัด' ? Number(filters.maxDistanceKm) : Number.POSITIVE_INFINITY

    const list = jobs.filter((job) => {
      if (showOnlyFavorites && !favoriteJobIds.includes(job.id)) return false
      if (q && !job.position.toLowerCase().includes(q) && !job.company_name.toLowerCase().includes(q)) return false
      if (filters.jobType !== 'ทั้งหมด' && job.job_type !== filters.jobType) return false
      if (filters.location !== 'ทั้งหมด' && !job.location.includes(filters.location)) return false
      if (job.wage < minWage || job.wage > maxWage) return false

      if (gpsEnabled && userCoords) {
        const jobCoords = getJobCoordinates(job.location)
        const dist = calculateDistanceKm(userCoords.lat, userCoords.lng, jobCoords.lat, jobCoords.lng)
        if (dist > maxDist) return false
      }
      return true
    })

    if (gpsEnabled && userCoords) {
      return [...list].sort((a, b) => {
        const coordsA = getJobCoordinates(a.location)
        const coordsB = getJobCoordinates(b.location)
        const distA = calculateDistanceKm(userCoords.lat, userCoords.lng, coordsA.lat, coordsA.lng)
        const distB = calculateDistanceKm(userCoords.lat, userCoords.lng, coordsB.lat, coordsB.lng)
        return distA - distB
      })
    }

    return list
  }, [jobs, query, filters, gpsEnabled, userCoords])

  const totalPages = Math.ceil(filteredJobs.length / PAGE_SIZE) || 1
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredJobs.slice(start, start + PAGE_SIZE)
  }, [filteredJobs, page])

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

      <Box sx={{ display: 'flex', gap: 1.5, mb: 4, flexWrap: 'wrap' }}>
        <TextField
          placeholder="ค้นหาชื่อตำแหน่งงาน หรือชื่อร้านค้า..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1, minWidth: 240, '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(158, 158, 158, 0.1)' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> } }}
        />
        <Button
          variant={showOnlyFavorites ? 'contained' : 'outlined'}
          startIcon={showOnlyFavorites ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          onClick={() => setShowOnlyFavorites((v) => !v)}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            bgcolor: showOnlyFavorites ? '#E53935' : 'transparent',
            color: showOnlyFavorites ? '#fff' : '#E53935',
            borderColor: '#E53935',
            px: 2.5,
            flexShrink: 0,
            '&:hover': { bgcolor: showOnlyFavorites ? '#C62828' : 'rgba(229, 57, 53, 0.08)' },
          }}
        >
          {`งานที่สนใจ (${favoriteJobIds.length})`}
        </Button>
        <Button
          variant={gpsEnabled ? 'contained' : 'outlined'}
          startIcon={<MyLocationOutlinedIcon />}
          onClick={handleToggleGps}
          sx={{
            borderRadius: '20px',
            textTransform: 'none',
            bgcolor: gpsEnabled ? colors.navy : 'transparent',
            color: gpsEnabled ? '#fff' : colors.navy,
            borderColor: colors.navy,
            px: 2.5,
            flexShrink: 0,
            '&:hover': { bgcolor: gpsEnabled ? '#000226' : 'rgba(1, 33, 80, 0.04)' },
          }}
        >
          {gpsLoading ? 'กำลังดึงพิกัด GPS...' : gpsEnabled ? 'ค้นหางานใกล้ฉัน (เปิดใช้งาน)' : 'ค้นหางานใกล้ฉัน'}
        </Button>
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

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: colors.navy, mb: 2 }}>
        {query.trim().length === 0 && !gpsEnabled
          ? 'แนะนำสำหรับคุณ'
          : <>ผลการค้นหา {gpsEnabled ? '(เรียงจากงานที่ใกล้ที่สุด)' : ''} <Box component="span" sx={{ fontWeight: 400, fontSize: 16 }}>{filteredJobs.length} รายการ (หน้า {page}/{totalPages})</Box></>}
      </Typography>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {paginatedJobs.map((job) => {
            const jobCoords = getJobCoordinates(job.location)
            const distance = userCoords ? calculateDistanceKm(userCoords.lat, userCoords.lng, jobCoords.lat, jobCoords.lng) : null
            const isFav = favoriteJobIds.includes(job.id)

            return (
              <Box
                key={job.id}
                onClick={() => setSelectedJob(job)}
                sx={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: '20px',
                  p: 2.5,
                  display: 'flex',
                  gap: 2,
                  position: 'relative',
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
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 16, color: colors.navy, mt: 0.5 }}>{job.wage} บาท/ชั่วโมง</Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {job.job_type && <Chip label={job.job_type} size="small" sx={{ bgcolor: colors.tagBg, color: colors.navy, borderRadius: '5px', fontSize: 13 }} />}
                    <IconButton
                      size="small"
                      onClick={(e) => toggleFavorite(e, job.id)}
                      sx={{
                        color: isFav ? '#E53935' : '#9E9E9E',
                        '&:hover': { bgcolor: 'rgba(229, 57, 53, 0.08)' },
                      }}
                    >
                      {isFav ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
                    </IconButton>
                  </Box>
                  {distance !== null && (
                    <Chip
                      icon={<NearMeOutlinedIcon fontSize="small" />}
                      label={`ห่าง ${distance} กม.`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: 12 }}
                    />
                  )}
                </Box>
              </Box>
            )
          })}

          {filteredJobs.length === 0 && (
            <Typography sx={{ color: '#697077', textAlign: 'center', py: 6 }}>ไม่พบตำแหน่งงานที่ค้นหา</Typography>
          )}
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 4 }}>
          <Button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            sx={{ textTransform: 'none', color: page === 1 ? '#C4C4C4' : colors.navy, fontWeight: 600 }}
          >
            Previous
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Box
              key={n}
              onClick={() => setPage(n)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                bgcolor: page === n ? colors.navy : '#E0E0E0',
                color: page === n ? '#FFFFFF' : '#000000',
                transition: 'all 0.2s ease-in-out',
                '&:hover': { bgcolor: page === n ? colors.navy : '#D0D0D0' },
              }}
            >
              {n}
            </Box>
          ))}
          <Button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            sx={{ textTransform: 'none', color: page === totalPages ? '#C4C4C4' : colors.navy, fontWeight: 600 }}
          >
            Next
          </Button>
        </Box>
      )}

      <FilterDialog key={String(filterOpen)} open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={setFilters} />
      <JobDetailDialog
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={() => void apply()}
        applyLabel={token ? 'ยื่นใบสมัครงาน' : 'เข้าสู่ระบบเพื่อสมัครงาน'}
      />
      <ApplicationOutcomeDialog
        open={outcome !== null}
        success={outcome === 'success'}
        message={outcomeMessage}
        onClose={() => setOutcome(null)}
      />
    </Box>
  )
}

function EmployerJobPostsView() {
  usePageTitle('ประกาศงานพาร์ทไทม์')
  const { token } = useAuth()

  const [jobposts, setJobposts] = useState<Jobpost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Jobpost | null>(null)

  const [position, setPosition] = useState('')
  const [jobType, setJobType] = useState('งานบริการ/สถานที่')
  const [jobDescription, setJobDescription] = useState('')
  const [wage, setWage] = useState('80')
  const [period, setPeriod] = useState('3 เดือน')
  const [location, setLocation] = useState('')
  const [welfare, setWelfare] = useState('')
  const [property, setProperty] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listMyJobposts(token!)
        if (!cancelled) setJobposts(data)
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

  function openCreateForm() {
    setEditingJob(null)
    setPosition('')
    setJobType('งานบริการ/สถานที่')
    setJobDescription('')
    setWage('80')
    setPeriod('3 เดือน')
    setLocation('')
    setWelfare('')
    setProperty('')
    setQuantity('1')
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(job: Jobpost) {
    setEditingJob(job)
    setPosition(job.position)
    setJobType(job.job_type ?? 'งานบริการ/สถานที่')
    setJobDescription(job.job_description ?? '')
    setWage(String(job.wage))
    setPeriod(job.period ?? '')
    setLocation(job.location ?? '')
    setWelfare(job.welfare ?? '')
    setProperty(job.property ?? '')
    setQuantity(String(job.quantity))
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSaveJobpost() {
    if (!token) return
    setFormError(null)

    if (!position.trim()) {
      setFormError('กรุณากรอกชื่อตำแหน่งงาน')
      return
    }

    setSubmitting(true)
    try {
      const payload: UpsertJobpostRequest = {
        position: position.trim(),
        job_type: jobType,
        job_description: jobDescription.trim() || undefined,
        wage: Number(wage) || 0,
        period: period.trim() || undefined,
        location: location.trim() || undefined,
        welfare: welfare.trim() || undefined,
        property: property.trim() || undefined,
        quantity: Number(quantity) || 1,
      }

      if (editingJob) {
        const updated = await updateJobpost(token, editingJob.id, payload)
        setJobposts((list) => list.map((j) => (j.id === updated.id ? updated : j)))
      } else {
        const created = await createJobpost(token, payload)
        setJobposts((list) => [created, ...list])
      }

      setFormOpen(false)
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.detail ? `${err.message}: ${err.detail}` : err.message)
      } else {
        setFormError('บันทึกประกาศงานไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseJob(id: number) {
    if (!token) return
    try {
      const updated = await closeJobpost(token, id)
      setJobposts((list) => list.map((j) => (j.id === updated.id ? updated : j)))
    } catch (err) {
      setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ปิดรับสมัครไม่สำเร็จ')
    }
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 24, color: colors.navy }}>ประกาศงานของฉัน</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateForm}
          sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, px: 3, '&:hover': { bgcolor: '#000226' } }}
        >
          สร้างประกาศงานใหม่
        </Button>
      </Box>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Table sx={{ border: `1px solid ${colors.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          <TableHead sx={{ bgcolor: colors.field }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: colors.navy }}>ตำแหน่งงาน</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.navy }}>ประเภทงาน</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.navy }}>ค่าจ้าง (บาท/ชม.)</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.navy }}>จำนวนรับ</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.navy }}>สถานะ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: colors.navy }}>การจัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobposts.map((job) => (
              <TableRow key={job.id} hover>
                <TableCell sx={{ fontWeight: 600, color: colors.navy }}>{job.position}</TableCell>
                <TableCell>{job.job_type ?? '-'}</TableCell>
                <TableCell>{job.wage} บาท</TableCell>
                <TableCell>{job.quantity} คน</TableCell>
                <TableCell>
                  <Chip
                    label={job.status === 'open' ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร'}
                    size="small"
                    color={job.status === 'open' ? 'success' : 'default'}
                    sx={{ fontWeight: 600, fontSize: 12 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <IconButton size="small" onClick={() => openEditForm(job)} sx={{ color: colors.navy }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    {job.status === 'open' && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => void handleCloseJob(job.id)}
                        sx={{ textTransform: 'none', fontSize: 12 }}
                      >
                        ปิดรับสมัคร
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}

            {jobposts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#697077' }}>
                  ยังไม่มีประกาศงาน คุณสามารถกดปุ่ม "สร้างประกาศงานใหม่" ได้ทันที
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Form Dialog for Create/Edit Jobpost */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <Box sx={{ p: 3.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 22, color: colors.navy }}>
              {editingJob ? 'แก้ไขประกาศงาน' : 'สร้างประกาศงานใหม่'}
            </Typography>
            <IconButton onClick={() => setFormOpen(false)} size="small"><CloseIcon /></IconButton>
          </Box>

          <ErrorAlert message={formError} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="ชื่อตำแหน่งงาน"
              placeholder="เช่น พนักงานคาเฟ่ / ผู้ช่วยห้องแล็บ"
              size="small"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              fullWidth
              required
            />
            <TextField
              select
              label="ประเภทงาน"
              size="small"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              fullWidth
            >
              {JOB_TYPE_OPTIONS.filter((o) => o !== 'ทั้งหมด').map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="ลักษณะงาน / รายละเอียด"
              multiline
              rows={3}
              size="small"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="ค่าจ้าง (บาท/ชั่วโมง)"
                type="number"
                size="small"
                value={wage}
                onChange={(e) => setWage(e.target.value)}
                fullWidth
              />
              <TextField
                label="ระยะเวลาจ้าง"
                placeholder="เช่น 3 เดือน / 1 เทอม"
                size="small"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                fullWidth
              />
            </Box>
            <TextField
              label="สถานที่ปฏิบัติงาน"
              placeholder="เช่น ร้านคาเฟ่ อาคารกิจกรรมนักศึกษา มทส."
              size="small"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
            />
            <TextField
              label="คุณสมบัติผู้สมัคร"
              multiline
              rows={2}
              size="small"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              fullWidth
            />
            <TextField
              label="สวัสดิการ"
              placeholder="เช่น ส่วนลดเครื่องดื่ม 50%, ชุดพนักงานฟรี"
              size="small"
              value={welfare}
              onChange={(e) => setWelfare(e.target.value)}
              fullWidth
            />
            <TextField
              label="จำนวนอัตราที่รับ (คน)"
              type="number"
              size="small"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              fullWidth
            />

            <Button
              variant="contained"
              onClick={() => void handleSaveJobpost()}
              disabled={submitting}
              fullWidth
              sx={{ borderRadius: '20px', textTransform: 'none', bgcolor: colors.navy, height: 46, fontWeight: 600, mt: 1, '&:hover': { bgcolor: '#000226' } }}
            >
              {submitting ? 'กำลังบันทึก…' : (editingJob ? 'บันทึกการแก้ไข' : 'ลงประกาศงาน')}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  )
}

export default function JobsPage() {
  const { user } = useAuth()
  return user?.role === 'employer' ? <EmployerJobPostsView /> : <StudentJobSearchView />
}
