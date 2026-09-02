import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material'

// Icons
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import WorkOutlineIcon from '@mui/icons-material/WorkOutlineOutlined'
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'

import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import studentLogo from '../assets/studentlogo.png'
import { PageTitleProvider } from './PageTitleProvider'
import { useHeaderTitle } from './usePageTitle'
import { getUnreadNotificationCount } from '../services/https/notifications'

const SIDEBAR_WIDTH = 300

const colors = {
  text: '#000349',
  selectedText: '#0090FF',
  selectedBg: '#EFF6FF',
  border: '#E8E8E8',
  logoAccent: '#045BE4',
  logoText: '#324054',
  badge: '#FF472E',
  profileName: '#324054',
  profileEmail: '#71839B',
}

type NavItem = {
  label: string
  icon: React.ReactNode
  path: string
  badge?: number
}

// The "jobs" nav slot means different things per role — student search vs employer
// posting management (see JobsPage) — so its label/icon swap based on role.
const jobsNavItemByRole: Record<string, NavItem> = {
  employer: { label: 'ประกาศงาน', icon: <Inventory2OutlinedIcon />, path: '/jobs' },
  student: { label: 'ค้นหางาน', icon: <SearchOutlinedIcon />, path: '/jobs' },
}

// The applications nav slot means different things per role — student's own
// submitted applications vs the employer's incoming applicant list.
const applicationsNavItemByRole: Record<string, NavItem> = {
  employer: { label: 'ผู้สมัครงาน', icon: <GroupOutlinedIcon />, path: '/applications' },
  student: { label: 'ใบสมัครงาน', icon: <AssignmentOutlinedIcon />, path: '/applications' },
}

// Student sees "รายรับ" (their own pay history); employer sees "ค่าตอบแทน"
// (managing/approving pay for their students) — same route, per design.
const payrollNavItemByRole: Record<string, NavItem> = {
  employer: { label: 'ค่าตอบแทน', icon: <AccountBalanceWalletOutlinedIcon />, path: '/payroll' },
  student: { label: 'รายรับ', icon: <AccountBalanceWalletOutlinedIcon />, path: '/payroll' },
}

// Student sees their own interview appointment/result; employer manages every
// applicant's interview scheduling — same route, per B6733827's design.
const interviewsNavItemByRole: Record<string, NavItem> = {
  employer: { label: 'จัดการนัดหมายสัมภาษณ์', icon: <EventNoteOutlinedIcon />, path: '/interviews' },
  student: { label: 'ประกาศกำหนดการสัมภาษณ์ / ผลการสัมภาษณ์', icon: <EventNoteOutlinedIcon />, path: '/interviews' },
}

// Student reads/accepts the offer sent to them; employer authors and sends it.
const employmentNavItemByRole: Record<string, NavItem> = {
  employer: { label: 'ตกลงการจ้างงาน', icon: <CampaignOutlinedIcon />, path: '/employment' },
  student: { label: 'แจ้งผลการจ้างงาน', icon: <CampaignOutlinedIcon />, path: '/employment' },
}

const mainNavItems: NavItem[] = [
  { label: 'หน้าหลัก',     icon: <HomeOutlinedIcon />,                      path: '/profile' },
  { label: 'งานของฉัน',    icon: <WorkOutlineIcon />,                       path: '/my-jobs' },
  { label: 'เวลาทำงาน',    icon: <AccessTimeOutlinedIcon />,                path: '/time-tracking' },
  { label: 'แจ้งปัญหา / ร้องเรียน', icon: <ReportProblemOutlinedIcon />,   path: '/complaints' },
]

const adminNavItem: NavItem = {
  label: 'อนุมัติผู้ประกอบการ',
  icon: <FactCheckOutlinedIcon />,
  path: '/admin/employers',
}

const adminApplicationsNavItem: NavItem = {
  label: 'ตรวจสอบใบสมัคร',
  icon: <AssignmentOutlinedIcon />,
  path: '/admin/applications',
}

function buildBottomNavItems(unreadNotifications: number): NavItem[] {
  return [
    { label: 'ข้อความ',      icon: <ChatBubbleOutlineOutlinedIcon />,         path: '/messages',      badge: 2 },
    {
      label: 'การแจ้งเตือน',
      icon: <NotificationsNoneOutlinedIcon />,
      path: '/notifications',
      badge: unreadNotifications > 0 ? unreadNotifications : undefined,
    },
    { label: 'การตั้งค่า',   icon: <SettingsOutlinedIcon />,                  path: '/settings' },
  ]
}

export function AppShell() {
  return (
    <PageTitleProvider>
      <AppShellInner />
    </PageTitleProvider>
  )
}

function AppShellInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token, logout } = useAuth()
  const headerTitle = useHeaderTitle()
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getUnreadNotificationCount(token)
      .then((res) => {
        if (!cancelled) setUnreadNotifications(res.unread_count)
      })
      .catch(() => {
        // badge is a nice-to-have; silently ignore failures
      })
    return () => {
      cancelled = true
    }
  }, [token, location.pathname])

  const bottomNavItems = buildBottomNavItems(unreadNotifications)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  // User initials
  const initials = user?.user_name ? user.user_name.charAt(0).toUpperCase() : '?'

  const jobsNavItem = jobsNavItemByRole[user?.role ?? 'student'] ?? jobsNavItemByRole.student
  const applicationsNavItem = applicationsNavItemByRole[user?.role ?? 'student'] ?? applicationsNavItemByRole.student
  const payrollNavItem = payrollNavItemByRole[user?.role ?? 'student'] ?? payrollNavItemByRole.student
  const interviewsNavItem = interviewsNavItemByRole[user?.role ?? 'student'] ?? interviewsNavItemByRole.student
  const employmentNavItem = employmentNavItemByRole[user?.role ?? 'student'] ?? employmentNavItemByRole.student
  const visibleMainNavItems = [
    mainNavItems[0], // หน้าหลัก
    jobsNavItem,
    mainNavItems[1], // งานของฉัน
    applicationsNavItem,
    interviewsNavItem,
    employmentNavItem,
    mainNavItems[2], // เวลาทำงาน
    payrollNavItem,
    mainNavItems[3], // แจ้งปัญหา / ร้องเรียน
    ...(user?.role === 'admin' ? [adminApplicationsNavItem, adminNavItem] : []),
  ]

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* ─── Sidebar ─── */}
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#FFFFFF',
            color: colors.text,
            borderRight: `1px solid ${colors.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {/* Logo */}
        <Box
          component={RouterLink}
          to="/profile"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 2.5,
            textDecoration: 'none',
            color: 'inherit',
            flexShrink: 0,
          }}
        >
          <Box
            component="img"
            src={studentLogo}
            alt="Student Jobs"
            sx={{ width: 40, height: 38, flexShrink: 0 }}
          />
          <Typography sx={{ fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.2, color: colors.logoText }}>
            STUDENT <Box component="span" sx={{ color: colors.logoAccent }}>JOBS</Box>
          </Typography>
        </Box>

        <Divider sx={{ borderColor: colors.border, mx: 2 }} />

        {/* Main nav */}
        <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
          <List disablePadding>
            {visibleMainNavItems.map((item) => (
              <ListItemButton
                key={item.path}
                selected={isActive(item.path)}
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  mb: 0.25,
                  color: isActive(item.path) ? colors.selectedText : colors.text,
                  bgcolor: isActive(item.path) ? colors.selectedBg : 'transparent',
                  '&:hover': { bgcolor: colors.selectedBg },
                  '&.Mui-selected': {
                    bgcolor: colors.selectedBg,
                    '&:hover': { bgcolor: colors.selectedBg },
                  },
                  py: 0.9,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: '0.82rem',
                        fontWeight: isActive(item.path) ? 600 : 400,
                        lineHeight: 1.4,
                      },
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Divider sx={{ borderColor: colors.border, mx: 2 }} />

        {/* Bottom nav */}
        <Box sx={{ py: 1, flexShrink: 0 }}>
          <List disablePadding>
            {bottomNavItems.map((item) => (
              <ListItemButton
                key={item.path}
                selected={isActive(item.path)}
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  mb: 0.25,
                  color: colors.text,
                  bgcolor: isActive(item.path) ? colors.selectedBg : 'transparent',
                  '&:hover': { bgcolor: colors.selectedBg },
                  py: 0.9,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
                  {item.badge ? (
                    <Badge
                      badgeContent={item.badge}
                      sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', bgcolor: colors.badge, color: '#fff' } }}
                    >
                      {item.icon}
                    </Badge>
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: { sx: { fontSize: '0.82rem', fontWeight: isActive(item.path) ? 600 : 400 } },
                  }}
                />
              </ListItemButton>
            ))}
          </List>

          {/* User footer */}
          <Divider sx={{ borderColor: colors.border, mx: 2, mb: 1, mt: 0.5 }} />
          <Box
            onClick={() => navigate('/settings')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              mx: 1,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: colors.selectedBg },
            }}
          >
            <Avatar
              src={user?.profile_picture}
              sx={{
                width: 34,
                height: 34,
                bgcolor: colors.logoAccent,
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: colors.profileName,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.user_name ?? 'User'}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: colors.profileEmail,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email ?? ''}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* ─── Main Column ─── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top header */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            px: { xs: 2, md: 5 },
            py: 2,
            borderBottom: `1px solid ${colors.border}`,
            bgcolor: '#FFFFFF',
          }}
        >
          <span />
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: colors.text, textAlign: 'center', whiteSpace: 'nowrap' }}>
            {headerTitle}
          </Typography>
          <Button
            onClick={handleLogout}
            sx={{
              justifySelf: 'end',
              bgcolor: colors.text,
              color: '#fff',
              borderRadius: '40px',
              textTransform: 'none',
              px: 3,
              py: 1.2,
              fontWeight: 500,
              '&:hover': { bgcolor: colors.text, opacity: 0.9 },
            }}
          >
            Log Out
          </Button>
        </Box>

        {/* Page content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
            p: { xs: 2, md: 3 },
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
