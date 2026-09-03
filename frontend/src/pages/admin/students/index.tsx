import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { usePageTitle } from '../../../components/usePageTitle'
import { ErrorAlert } from '../../../components/ErrorAlert'
import { AuditTrail } from '../../../components/AuditTrail'
import { useAuth } from '../../../auth/useAuth'
import { ApiError } from '../../../services/https'
import { listAllStudents, updateStudentDirectory } from '../../../services/https/admin'
import type { AdminUpdateStudentRequest, StudentDirectoryEntry } from '../../../interface/IAdminInterface'

const colors = { navy: '#000349', border: '#e0e0e0', blue: '#0066FF' }

export default function AdminStudentDirectoryPage() {
  usePageTitle('รายชื่อนักศึกษา')
  const { token } = useAuth()

  const [students, setStudents] = useState<StudentDirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [editing, setEditing] = useState<StudentDirectoryEntry | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listAllStudents(token!)
        if (!cancelled) setStudents(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ไม่สามารถโหลดข้อมูลนักศึกษาได้')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, reloadToken])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.university.toLowerCase().includes(q),
    )
  }, [students, search])

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1.8rem', mb: 3 }}>รายชื่อนักศึกษา</Typography>

      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="ค้นหาชื่อ, อีเมล, มหาวิทยาลัย..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 350, '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: '#fff' } }}
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
      ) : (
        <TableContainer sx={{ border: `1px solid ${colors.border}`, borderRadius: '16px', overflow: 'hidden' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ '& th': { borderBottom: `1px solid ${colors.border}`, fontWeight: 700, color: colors.navy, py: 2.5 } }}>
                <TableCell align="center">ลำดับ</TableCell>
                <TableCell align="center">ชื่อ-นามสกุล</TableCell>
                <TableCell align="center">อีเมล</TableCell>
                <TableCell align="center">มหาวิทยาลัย</TableCell>
                <TableCell align="center">สาขาวิชา</TableCell>
                <TableCell align="center">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#6b6b6b' }}>
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row, index) => (
                  <TableRow key={row.student_id} sx={{ '& td': { borderBottom: `1px solid ${colors.border}`, py: 2 }, '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{index + 1}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.first_name} {row.last_name}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.email}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.university || 'ไม่ระบุ'}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.major || 'ไม่ระบุ'}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => setEditing(row)}
                        sx={{ border: `1px solid ${colors.blue}`, color: colors.blue, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(0,102,255,0.05)' } }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editing && (
        <EditStudentDialog
          key={editing.student_id}
          open={!!editing}
          student={editing}
          token={token!}
          onClose={() => setEditing(null)}
          onSaved={() => setReloadToken((t) => t + 1)}
        />
      )}
    </Box>
  )
}

function EditStudentDialog({
  open,
  student,
  token,
  onClose,
  onSaved,
}: {
  open: boolean
  student: StudentDirectoryEntry
  token: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<AdminUpdateStudentRequest>(() => ({
    first_name: student.first_name,
    last_name: student.last_name,
    email: student.email,
    phone: student.phone,
    gender: student.gender,
    university: student.university,
    faculty: student.faculty,
    major: student.major,
    skill: student.skill,
    years: student.years,
    address: student.address,
    date_of_birth: student.date_of_birth ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof AdminUpdateStudentRequest, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSave() {
    setSaving(true)
    setError(null)
    try {
      await updateStudentDirectory(token, student.student_id, form)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'บันทึกล้มเหลว')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>แก้ไขข้อมูลนักศึกษา: {student.first_name} {student.last_name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="ชื่อ" fullWidth value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="นามสกุล" fullWidth value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="อีเมล" type="email" fullWidth value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="เบอร์โทร" fullWidth value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="เพศ" fullWidth value={form.gender ?? ''} onChange={(e) => set('gender', e.target.value)}>
              <MenuItem value="">-- ไม่ระบุ --</MenuItem>
              <MenuItem value="ชาย">ชาย</MenuItem>
              <MenuItem value="หญิง">หญิง</MenuItem>
              <MenuItem value="อื่นๆ">อื่นๆ</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="วันเกิด" type="date" fullWidth value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="มหาวิทยาลัย" fullWidth value={form.university ?? ''} onChange={(e) => set('university', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="คณะ" fullWidth value={form.faculty ?? ''} onChange={(e) => set('faculty', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="สาขา" fullWidth value={form.major ?? ''} onChange={(e) => set('major', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="ชั้นปี" fullWidth value={form.years ?? ''} onChange={(e) => set('years', e.target.value)}>
              {['1', '2', '3', '4', '5'].map((y) => <MenuItem key={y} value={y}>ปีที่ {y}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}><TextField label="ทักษะ" fullWidth multiline rows={2} value={form.skill ?? ''} onChange={(e) => set('skill', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="ที่อยู่" fullWidth multiline rows={2} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <AuditTrail token={token} targetType="student" targetId={student.student_id} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none', fontWeight: 600 }}>ยกเลิก</Button>
        <Button
          variant="contained"
          onClick={() => void onSave()}
          disabled={saving}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, boxShadow: 'none' }}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
