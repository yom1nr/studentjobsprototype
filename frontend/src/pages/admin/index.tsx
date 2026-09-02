import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
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
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { approveEmployer, listEmployerApprovals, rejectEmployer, requestDocuments } from '../../services/https/admin'
import type { EmployerApproval, EmployerApprovalStatus } from '../../interface/IAdminInterface'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const colors = { navy: '#012150', border: '#DDE1E6' }

const STATUS_TABS: { key: EmployerApprovalStatus; label: string }[] = [
  { key: 'pending', label: 'รอการตรวจสอบ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่อนุมัติ' },
]

const STATUS_CHIP: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'info' }> = {
  pending: { label: 'รอการตรวจสอบ', color: 'warning' },
  approved: { label: 'อนุมัติแล้ว', color: 'success' },
  rejected: { label: 'ไม่อนุมัติ', color: 'error' },
  request_document: { label: 'ขอเอกสารเพิ่มเติม', color: 'info' },
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

  async function handleRequestDocuments() {
    if (!selected || !token) return
    setDeciding(true)
    setActionError(null)
    try {
      await requestDocuments(token, selected.employer_id)
      setSelected(null)
      setReload((r) => r + 1)
    } catch (err) {
      setActionError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setDeciding(false)
    }
  }

  if (selected) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: colors.navy, mb: 0.5, textAlign: 'center' }}>
          ตรวจสอบและอนุมัติการสมัครของผู้ประกอบการ
        </Typography>
        <Box sx={{ borderBottom: `1px solid ${colors.border}`, my: 3 }} />
        
        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: colors.navy, mb: 3 }}>
          รายละเอียดผู้ประกอบการ
        </Typography>

        <ErrorAlert message={actionError} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 4, p: 4, flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mb: 3 }}>ข้อมูลบริษัท</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 2.5, columnGap: 2 }}>
                <Typography sx={{ color: '#697077' }}>ชื่อบริษัท / ร้านค้า</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.company_name}</Typography>
                
                <Typography sx={{ color: '#697077' }}>ประเภทธุรกิจ</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.business_type || '-'}</Typography>
                
                <Typography sx={{ color: '#697077' }}>เลขประจำตัวผู้เสียภาษี</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.tax_id || '-'}</Typography>
                
                <Typography sx={{ color: '#697077' }}>ที่อยู่</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.company_address || '-'}</Typography>
              </Box>
            </Box>

            <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 4, p: 4, flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mb: 3 }}>ข้อมูลการติดต่อ</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 2.5, columnGap: 2 }}>
                <Typography sx={{ color: '#697077' }}>ชื่อผู้ติดต่อ</Typography>
                <Typography sx={{ color: '#52545C' }}>{`${selected.first_name} ${selected.last_name}`}</Typography>
                
                <Typography sx={{ color: '#697077' }}>เบอร์โทรศัพท์</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.phone || '-'}</Typography>
                
                <Typography sx={{ color: '#697077' }}>อีเมล</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.email}</Typography>
                
                <Typography sx={{ color: '#697077' }}>ตำแหน่งงาน</Typography>
                <Typography sx={{ color: '#52545C' }}>{selected.position || '-'}</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 4, p: 4 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.navy, mb: 3 }}>เอกสารที่แนบมา</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #697077', borderRadius: 10, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ border: '1px solid #697077', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <InsertDriveFileOutlinedIcon sx={{ color: '#697077' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: '#52545C', fontSize: 14 }}>หนังสือรับรองการจดทะเบียนบริษัท / ร้านค้า</Typography>
                    <Typography sx={{ color: '#9AA0A6', fontSize: 11 }}>
                      {selected.company_regis ? 'อัปโหลดแล้ว' : 'ไม่ได้แนบเอกสาร'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  component="a"
                  href={selected.company_regis ? `${API_URL}${selected.company_regis}` : '#'}
                  target="_blank"
                  disabled={!selected.company_regis}
                  sx={{ color: selected.company_regis ? '#0088FF' : '#B9C6DC' }}
                >
                  <FileDownloadOutlinedIcon />
                </IconButton>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #697077', borderRadius: 10, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ border: '1px solid #697077', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <InsertDriveFileOutlinedIcon sx={{ color: '#697077' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: '#52545C', fontSize: 14 }}>บัตรประชาชนของผู้มีอำนาจลงนาม</Typography>
                    <Typography sx={{ color: '#9AA0A6', fontSize: 11 }}>
                      {selected.card_id ? 'อัปโหลดแล้ว' : 'ไม่ได้แนบเอกสาร'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  component="a"
                  href={selected.card_id ? `${API_URL}${selected.card_id}` : '#'}
                  target="_blank"
                  disabled={!selected.card_id}
                  sx={{ color: selected.card_id ? '#0088FF' : '#B9C6DC' }}
                >
                  <FileDownloadOutlinedIcon />
                </IconButton>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #697077', borderRadius: 10, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ border: '1px solid #697077', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <InsertDriveFileOutlinedIcon sx={{ color: '#697077' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, color: '#52545C', fontSize: 14 }}>โลโก้บริษัท / ร้านค้า (ถ้ามี)</Typography>
                    <Typography sx={{ color: '#9AA0A6', fontSize: 11 }}>
                      {selected.logo ? 'อัปโหลดแล้ว' : 'ไม่ได้แนบเอกสาร'}
                    </Typography>
                  </Box>
                </Box>
                <IconButton
                  component="a"
                  href={selected.logo ? `${API_URL}${selected.logo}` : '#'}
                  target="_blank"
                  disabled={!selected.logo}
                  sx={{ color: selected.logo ? '#0088FF' : '#B9C6DC' }}
                >
                  <FileDownloadOutlinedIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        {rejecting && selected.status === 'pending' && (
          <TextField
            label="เหตุผลการไม่อนุมัติ"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            sx={{ mb: 4 }}
          />
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 4 }}>
          <Button onClick={() => setSelected(null)} sx={{ border: '1px solid #9AA0A6', color: '#52545C', borderRadius: '8px', px: 3, py: 1, textTransform: 'none' }}>
            ย้อนกลับ
          </Button>
          {selected.status === 'pending' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {rejecting ? (
                <>
                  <Button onClick={() => setRejecting(false)} sx={{ textTransform: 'none', color: '#52545C' }}>
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={() => void handleReject()}
                    disabled={deciding}
                    sx={{ bgcolor: '#FF3B30', color: '#fff', borderRadius: '8px', px: 3, py: 1, textTransform: 'none', '&:hover': { bgcolor: '#D32F2F' } }}
                  >
                    ยืนยันไม่อนุมัติ
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setRejecting(true)}
                    sx={{ bgcolor: '#FF3B30', color: '#fff', borderRadius: '8px', px: 3, py: 1, textTransform: 'none', '&:hover': { bgcolor: '#D32F2F' } }}
                  >
                    ไม่อนุมัติ
                  </Button>
                  <Button
                    onClick={() => void handleRequestDocuments()}
                    disabled={deciding}
                    sx={{ border: '1px solid #9AA0A6', color: '#52545C', borderRadius: '8px', px: 3, py: 1, textTransform: 'none' }}
                  >
                    ขอเอกสารเพิ่มเติม
                  </Button>
                  <Button
                    onClick={() => void handleApprove()}
                    disabled={deciding}
                    sx={{ bgcolor: '#28A745', color: '#fff', borderRadius: '8px', px: 3, py: 1, textTransform: 'none', '&:hover': { bgcolor: '#218838' } }}
                  >
                    อนุมัติ
                  </Button>
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>
    )
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
    </Box>
  )
}
