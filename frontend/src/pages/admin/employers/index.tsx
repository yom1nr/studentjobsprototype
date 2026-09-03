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
import { listAllEmployers, updateEmployerDirectory } from '../../../services/https/admin'
import type { AdminUpdateEmployerRequest, EmployerDirectoryEntry } from '../../../interface/IAdminInterface'

const colors = { navy: '#000349', border: '#e0e0e0', blue: '#0066FF' }

export default function AdminEmployerDirectoryPage() {
  usePageTitle('รายชื่อผู้ประกอบการ')
  const { token } = useAuth()

  const [employers, setEmployers] = useState<EmployerDirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  const [editing, setEditing] = useState<EmployerDirectoryEntry | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listAllEmployers(token!)
        if (!cancelled) setEmployers(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ไม่สามารถโหลดข้อมูลผู้ประกอบการได้')
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
    if (!q) return employers
    return employers.filter(
      (e) =>
        e.company_name.toLowerCase().includes(q) ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q),
    )
  }, [employers, search])

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, color: colors.navy, fontSize: '1.8rem', mb: 3 }}>รายชื่อผู้ประกอบการ</Typography>

      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="ค้นหาชื่อบริษัท, ชื่อผู้ติดต่อ, เบอร์โทร..."
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
                <TableCell align="center">ชื่อบริษัท / ร้านค้า</TableCell>
                <TableCell align="center">ประเภทธุรกิจ</TableCell>
                <TableCell align="center">ชื่อผู้ติดต่อ</TableCell>
                <TableCell align="center">เบอร์โทรศัพท์</TableCell>
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
                  <TableRow key={row.employer_id} sx={{ '& td': { borderBottom: `1px solid ${colors.border}`, py: 2 }, '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{index + 1}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.company_name || 'ไม่ระบุ'}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.business_type || 'ไม่ระบุ'}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.first_name} {row.last_name}</TableCell>
                    <TableCell align="center" sx={{ color: '#444', fontWeight: 500 }}>{row.phone || 'ไม่ระบุ'}</TableCell>
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
        <EditEmployerDialog
          key={editing.employer_id}
          open={!!editing}
          employer={editing}
          token={token!}
          onClose={() => setEditing(null)}
          onSaved={() => setReloadToken((t) => t + 1)}
        />
      )}
    </Box>
  )
}

function EditEmployerDialog({
  open,
  employer,
  token,
  onClose,
  onSaved,
}: {
  open: boolean
  employer: EmployerDirectoryEntry
  token: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<AdminUpdateEmployerRequest>(() => ({
    first_name: employer.first_name,
    last_name: employer.last_name,
    email: employer.email,
    phone: employer.phone,
    gender: employer.gender,
    company_name: employer.company_name,
    business_type: employer.business_type,
    tax_id: employer.tax_id,
    link: employer.link,
    company_address: employer.company_address,
    position: employer.position,
    line_id: employer.line_id,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof AdminUpdateEmployerRequest, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSave() {
    setSaving(true)
    setError(null)
    try {
      await updateEmployerDirectory(token, employer.employer_id, form)
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
      <DialogTitle sx={{ fontWeight: 700 }}>แก้ไขข้อมูลผู้ประกอบการ: {employer.company_name}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1, color: 'text.secondary' }}>ข้อมูลบริษัท</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="ชื่อบริษัท/ร้านค้า" fullWidth value={form.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="ประเภทธุรกิจ" fullWidth value={form.business_type ?? ''} onChange={(e) => set('business_type', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="เลขประจำตัวผู้เสียภาษี" fullWidth value={form.tax_id ?? ''} onChange={(e) => set('tax_id', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="เว็บไซต์" fullWidth value={form.link ?? ''} onChange={(e) => set('link', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><TextField label="ที่อยู่สถานประกอบการ" fullWidth multiline rows={2} value={form.company_address ?? ''} onChange={(e) => set('company_address', e.target.value)} /></Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, color: 'text.secondary' }}>ข้อมูลผู้ติดต่อ</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="ชื่อ" fullWidth value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="นามสกุล" fullWidth value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="อีเมล" type="email" fullWidth value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="เบอร์โทร" fullWidth value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="ตำแหน่ง" fullWidth value={form.position ?? ''} onChange={(e) => set('position', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField label="Line ID" fullWidth value={form.line_id ?? ''} onChange={(e) => set('line_id', e.target.value)} /></Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <AuditTrail token={token} targetType="employer" targetId={employer.employer_id} />
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
