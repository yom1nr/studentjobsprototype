import { Avatar, Badge, Box, Typography } from '@mui/material'
import { usePageTitle } from '../../components/usePageTitle'

const colors = { navy: '#012150', border: '#DDE1E6' }

type Thread = {
  id: number
  name: string
  lastMessage: string
  time: string
  unread: number
}

// Mock conversations until the /messages endpoint is available.
const MOCK_THREADS: Thread[] = [
  { id: 1, name: 'Café Doi', lastMessage: 'พรุ่งนี้เข้ากะ 16:00 นะครับ', time: '10 นาทีที่แล้ว', unread: 2 },
  { id: 2, name: 'บริษัท เทคสตาร์ท จำกัด', lastMessage: 'ขอบคุณสำหรับการสัมภาษณ์วันนี้ครับ', time: 'เมื่อวาน', unread: 0 },
  { id: 3, name: 'ฝ่ายดูแลระบบ', lastMessage: 'บัญชีของคุณได้รับการยืนยันแล้ว', time: '3 วันที่แล้ว', unread: 0 },
]

export default function MessagesPage() {
  usePageTitle('ข้อความ')

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 32, color: colors.navy, mb: 0.5 }}>
        ข้อความ
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#697077', mb: 3 }}>การสนทนากับนายจ้างและระบบ</Typography>

      <Box sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden' }}>
        {MOCK_THREADS.map((thread, index) => (
          <Box
            key={thread.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 2.5,
              py: 2,
              borderBottom: index < MOCK_THREADS.length - 1 ? `1px solid ${colors.border}` : 'none',
              cursor: 'pointer',
              '&:hover': { bgcolor: '#F7F9FC' },
            }}
          >
            <Badge
              badgeContent={thread.unread}
              color="error"
              invisible={thread.unread === 0}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Avatar sx={{ bgcolor: '#F0F0F0', color: colors.navy }}>{thread.name.charAt(0)}</Avatar>
            </Badge>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: thread.unread ? 700 : 600, fontSize: 15, color: colors.navy }}>
                {thread.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: 13,
                  color: '#697077',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {thread.lastMessage}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: '#9AA0A6', flexShrink: 0 }}>{thread.time}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
