import { useEffect, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import { ApiError } from '../services/https'
import { listAuditLogs } from '../services/https/admin'
import type { AdminAuditLogEntry, AuditChange } from '../interface/IAdminInterface'

const FIELD_LABELS: Record<string, string> = {
  first_name: 'ชื่อ',
  last_name: 'นามสกุล',
  email: 'อีเมล',
  phone: 'เบอร์โทร',
  gender: 'เพศ',
  position: 'ตำแหน่ง',
  line_id: 'Line ID',
  company_name: 'ชื่อบริษัท',
  business_type: 'ประเภทธุรกิจ',
  tax_id: 'เลขผู้เสียภาษี',
  link: 'เว็บไซต์',
  company_address: 'ที่อยู่บริษัท',
  address: 'ที่อยู่',
  university: 'มหาวิทยาลัย',
  faculty: 'คณะ',
  major: 'สาขา',
  years: 'ชั้นปี',
  skill: 'ทักษะ',
  date_of_birth: 'วันเกิด',
}

function parseChanges(raw: string): Record<string, AuditChange> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, AuditChange>) : {}
  } catch {
    return {}
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

const rowFlex = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 } as const

/**
 * Read-only view of the admin audit trail for one target record. Refetches
 * whenever `refreshKey` changes (bump it after a successful save).
 */
export function AuditTrail({
  token,
  targetType,
  targetId,
  refreshKey = 0,
}: {
  token: string
  targetType: 'employer' | 'student'
  targetId: number
  refreshKey?: number
}) {
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listAuditLogs(token, { target_type: targetType, target_id: targetId, limit: 50 })
      .then((data) => {
        if (!cancelled) setLogs(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'ไม่สามารถโหลดประวัติการแก้ไขได้')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, targetType, targetId, refreshKey])

  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography sx={{ fontWeight: 600 }}>
            ประวัติการแก้ไข{!loading && !error ? ` (${logs.length})` : ''}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {loading && <Typography variant="body2" color="text.secondary">กำลังโหลด…</Typography>}
        {error && <Typography variant="body2" color="error">{error}</Typography>}
        {!loading && !error && logs.length === 0 && (
          <Typography variant="body2" color="text.secondary">ยังไม่มีการแก้ไข</Typography>
        )}
        {!loading && !error && logs.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {logs.map((entry) => {
              const changes = parseChanges(entry.changes)
              const fields = Object.keys(changes)
              return (
                <Box key={entry.id}>
                  <Box sx={{ ...rowFlex, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {entry.admin_email || `admin #${entry.admin_id ?? '—'}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatWhen(entry.created_at)}
                    </Typography>
                  </Box>
                  {fields.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">{entry.action}</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {fields.map((f) => (
                        <Box key={f} sx={rowFlex}>
                          <Chip size="small" label={FIELD_LABELS[f] ?? f} sx={{ height: 20 }} />
                          <Typography variant="body2" sx={{ color: '#b71c1c', textDecoration: 'line-through' }}>
                            {changes[f].from || '(ว่าง)'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">→</Typography>
                          <Typography variant="body2" sx={{ color: '#1b5e20' }}>
                            {changes[f].to || '(ว่าง)'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  <Divider sx={{ mt: 1.5 }} />
                </Box>
              )
            })}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  )
}
