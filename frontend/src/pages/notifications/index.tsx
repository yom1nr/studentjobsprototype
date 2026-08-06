import { useEffect, useState } from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import { useNavigate } from 'react-router-dom'
import { usePageTitle } from '../../components/usePageTitle'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../services/https'
import { listMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/https/notifications'
import type { NotificationItem } from '../../interface/INotificationInterface'

const colors = { navy: '#012150', border: '#DDE1E6' }

type Tab = 'all' | 'unread'

const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'unread', label: 'ยังไม่อ่าน' },
]

// Type-specific presentation. Unknown types fall back to a generic bell icon
// with no action link — new notification types can be added here as the
// subsystems that emit them (interviews, applications, ...) get built.
const TYPE_PRESENTATION: Record<string, { icon: React.ReactNode; actionLabel: string; actionPath: string }> = {
  employer_approval: {
    icon: <CampaignOutlinedIcon sx={{ color: '#217829' }} />,
    actionLabel: 'ดูข้อมูลบัญชี',
    actionPath: '/settings',
  },
  employer_rejection: {
    icon: <ReportProblemOutlinedIcon sx={{ color: '#DA1E28' }} />,
    actionLabel: 'ดูข้อมูลบัญชี',
    actionPath: '/settings',
  },
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'เมื่อสักครู่'
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return 'เมื่อวาน'
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`
  return new Date(iso).toLocaleDateString('th-TH')
}

export default function NotificationsPage() {
  usePageTitle('การแจ้งเตือน')
  const navigate = useNavigate()
  const { token } = useAuth()

  const [items, setItems] = useState<NotificationItem[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await listMyNotifications(token!)
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? (err.detail ? `${err.message}: ${err.detail}` : err.message) : 'โหลดการแจ้งเตือนไม่สำเร็จ')
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

  const unreadCount = items.filter((n) => !n.is_read).length
  const filtered = tab === 'unread' ? items.filter((n) => !n.is_read) : items

  async function markAllRead() {
    if (!token) return
    const previous = items
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    try {
      await markAllNotificationsRead(token)
    } catch {
      setItems(previous)
      setError('ทำเครื่องหมายว่าอ่านทั้งหมดไม่สำเร็จ')
    }
  }

  async function markRead(id: number) {
    if (!token) return
    const previous = items
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    try {
      await markNotificationRead(token, id)
    } catch {
      setItems(previous)
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <ErrorAlert message={error} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy }}>การแจ้งเตือน</Typography>
          <Typography sx={{ fontSize: 14, color: '#697077', mt: 0.5 }}>คำขอและอัปเดตต่าง ๆ — กดเข้าไปดูรายละเอียดเพื่อดำเนินการ</Typography>
        </Box>
        <Button
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
          sx={{ borderRadius: '20px', textTransform: 'none', color: colors.navy, border: `1px solid ${colors.border}`, px: 2 }}
        >
          ทำเครื่องหมายว่าอ่านทั้งหมด
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        {tabs.map((t) => (
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
            {t.key === 'unread' && unreadCount > 0 && (
              <Box component="span" sx={{ ml: 1, bgcolor: '#fff', color: colors.navy, borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {unreadCount}
              </Box>
            )}
          </Button>
        ))}
      </Box>

      {loading ? (
        <Alert severity="info">กำลังโหลดข้อมูล…</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map((n) => {
            const presentation = TYPE_PRESENTATION[n.notification_type]
            return (
              <Box key={n.id} sx={{ display: 'flex', gap: 2, p: 2.5, borderRadius: 3, border: `1px solid ${colors.border}`, bgcolor: !n.is_read ? '#F7FAFF' : 'transparent' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', bgcolor: '#F2F4F8', flexShrink: 0 }}>
                  {presentation?.icon ?? <NotificationsNoneOutlinedIcon sx={{ color: colors.navy }} />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography sx={{ fontWeight: !n.is_read ? 700 : 600, fontSize: 14, color: colors.navy }}>{n.title}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 12, color: '#9AA0A6' }}>{formatRelativeTime(n.created_at)}</Typography>
                      {!n.is_read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#0F62FE' }} />}
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 13, color: '#52545C', mt: 0.25, mb: presentation ? 1 : 0 }}>{n.message}</Typography>
                  {presentation && (
                    <Button
                      size="small"
                      onClick={() => {
                        if (!n.is_read) void markRead(n.id)
                        navigate(presentation.actionPath)
                      }}
                      sx={{ bgcolor: colors.navy, color: '#fff', textTransform: 'none', borderRadius: '20px', px: 2, '&:hover': { bgcolor: '#000226' } }}
                    >
                      {presentation.actionLabel} →
                    </Button>
                  )}
                  {!presentation && !n.is_read && (
                    <Button
                      size="small"
                      onClick={() => void markRead(n.id)}
                      sx={{ color: colors.navy, textTransform: 'none', px: 0, minWidth: 0 }}
                    >
                      ทำเครื่องหมายว่าอ่านแล้ว
                    </Button>
                  )}
                </Box>
              </Box>
            )
          })}
          {filtered.length === 0 && <Typography sx={{ color: '#697077', textAlign: 'center', py: 4 }}>ไม่มีการแจ้งเตือน</Typography>}
        </Box>
      )}
    </Box>
  )
}
