import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { approveEmployer, listEmployerApprovals, rejectEmployer } from '../../services/https/admin'
import type { EmployerApproval, EmployerApprovalStatus } from '../../interface/IAdminInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

const STATUS_TABS: { key: EmployerApprovalStatus; label: string }[] = [
  { key: 'pending', label: 'รอการตรวจสอบ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่อนุมัติ' },
]

const STATUS_CHIP: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'รอการตรวจสอบ', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  rejected: { label: 'ไม่อนุมัติ', color: 'error' },
}

export default function AdminEmployerApprovalsPage() {
  usePageTitle('อนุมัติผู้ประกอบการ')
  const { token } = useAuth()

  const [tab, setTab] = useState<EmployerApprovalStatus>('pending')
  const [employers, setEmployers] = useState<EmployerApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<EmployerApproval | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listEmployerApprovals(token!, tab)
        if (!cancelled) setEmployers(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดข้อมูลไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token, tab, reloadToken])

  function openDetail(employer: EmployerApproval) {
    setSelected(employer)
    setRejectReason('')
    setRejecting(false)
    setActionError(null)
  }

  async function handleApprove() {
    if (!token || !selected) return
    setDeciding(true)
    setActionError(null)
    try {
      await approveEmployer(token, selected.employer_id)
      setSelected(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'อนุมัติไม่สำเร็จ')
    } finally {
      setDeciding(false)
    }
  }

  async function handleReject() {
    if (!token || !selected) return
    if (rejectReason.trim().length === 0) {
      setActionError('กรุณาระบุเหตุผลการไม่อนุมัติ')
      return
    }
    setDeciding(true)
    setActionError(null)
    try {
      await rejectEmployer(token, selected.employer_id, { reason: rejectReason.trim() })
      setSelected(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setDeciding(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 0.5 }}>
        อนุมัติผู้ประกอบการ
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>ตรวจสอบและอนุมัติการสมัครของผู้ประกอบการ</Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {STATUS_TABS.map((t) => (
          <Button
            key={t.key}
            onClick={() => setTab(t.key)}
            sx={{
              borderRadius: '20px',
              textTransform: 'none',
              px: 2.5,
              bgcolor: tab === t.key ? colors.navy : '#F0F0F0',
              color: tab === t.key ? '#fff' : colors.navy,
              '&:hover': { bgcolor: tab === t.key ? colors.navy : '#E4E4E4' },
            }}
          >
            {t.label}
          </Button>
        ))}
      </Box>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#F7FAFF' }}>
                <TableCell>ชื่อบริษัท / ร้านค้า</TableCell>
                <TableCell>ประเภท</TableCell>
                <TableCell>ผู้ติดต่อ</TableCell>
                <TableCell>วันที่สมัคร</TableCell>
                <TableCell>สถานะ</TableCell>
                <TableCell align="right">จัดการ</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employers.map((e) => (
                <TableRow key={e.employer_id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{e.company_name}</TableCell>
                  <TableCell>{e.business_type || '-'}</TableCell>
                  <TableCell>{`${e.first_name} ${e.last_name}`}</TableCell>
                  <TableCell>{e.date_of_sign_up ? new Date(e.date_of_sign_up).toLocaleDateString('th-TH') : '-'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={STATUS_CHIP[e.status]?.label ?? e.status} color={STATUS_CHIP[e.status]?.color ?? 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openDetail(e)} sx={{ border: `1px solid ${colors.border}`, borderRadius: 1.5 }}>
                      <VisibilityOutlinedIcon fontSize="small" sx={{ color: colors.navy }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {employers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: '#697077', py: 4 }}>
                    ไม่มีรายการ
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        {selected && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 20, color: colors.navy }}>{selected.company_name}</Typography>
              <IconButton size="small" onClick={() => setSelected(null)}>
                <CloseOutlinedIcon />
              </IconButton>
            </Box>

            <ErrorAlert message={actionError} />

            <Box sx={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 1, columnGap: 2, mb: 2 }}>
              <Typography sx={{ fontWeight: 600, color: colors.navy }}>ผู้ติดต่อ</Typography>
              <Typography>{`${selected.first_name} ${selected.last_name}`}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy }}>อีเมล</Typography>
              <Typography>{selected.email}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy }}>ประเภทธุรกิจ</Typography>
              <Typography>{selected.business_type || '-'}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy }}>เลขผู้เสียภาษี</Typography>
              <Typography>{selected.tax_id || '-'}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy }}>ที่อยู่</Typography>
              <Typography>{selected.company_address || '-'}</Typography>
              <Typography sx={{ fontWeight: 600, color: colors.navy }}>สถานะ</Typography>
              <Chip size="small" sx={{ justifySelf: 'start' }} label={STATUS_CHIP[selected.status]?.label ?? selected.status} color={STATUS_CHIP[selected.status]?.color ?? 'default'} />
            </Box>

            {selected.status === 'pending' && (
              <>
                {rejecting && (
                  <TextField
                    label="เหตุผลการไม่อนุมัติ"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mb: 2 }}
                  />
                )}
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  {rejecting ? (
                    <>
                      <Button onClick={() => setRejecting(false)} sx={{ textTransform: 'none', color: colors.navy }}>
                        ยกเลิก
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => void handleReject()}
                        disabled={deciding}
                        sx={{ bgcolor: '#DA1E28', textTransform: 'none', borderRadius: '20px', '&:hover': { bgcolor: '#B01319' } }}
                      >
                        ยืนยันไม่อนุมัติ
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => setRejecting(true)}
                        sx={{ bgcolor: '#FCE4E4', color: '#DA1E28', textTransform: 'none', borderRadius: '20px', px: 2.5 }}
                      >
                        ไม่อนุมัติ
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => void handleApprove()}
                        disabled={deciding}
                        sx={{ bgcolor: colors.navy, textTransform: 'none', borderRadius: '20px', px: 2.5, '&:hover': { bgcolor: '#000226' } }}
                      >
                        อนุมัติ
                      </Button>
                    </>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </Dialog>
    </Box>
  )
}
