import { Box, CircularProgress } from '@mui/material'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { PublicOnlyRoute } from '../components/PublicOnlyRoute'
import { RoleRoute } from '../components/RoleRoute'
import FullLayout from '../layout/FullLayout'
import GuestLayout from '../layout/GuestLayout'
import MiniLayout from '../layout/MiniLayout'
import LoginPage from '../pages/authentication/Login'
import RegisterPage from '../pages/authentication/Register'
import RegisterStudentPage from '../pages/authentication/RegisterStudent'
import RegisterEmployerPage from '../pages/authentication/RegisterEmployer'
import ForgotPasswordPage from '../pages/authentication/ForgotPassword'
import LandingPage from '../pages/landing'
import DashboardPage from '../pages/dashboard'
import TimeTrackingPage from '../pages/time-tracking'
import JobsPage from '../pages/jobs'
import MyJobsPage from '../pages/my-jobs'
import ApplicationsPage from '../pages/applications'
import InterviewsPage from '../pages/interviews'
import EmploymentPage from '../pages/employment'
import PayrollPage from '../pages/payroll'
import ComplaintsPage from '../pages/complaints'
import MessagesPage from '../pages/messages'
import NotificationsPage from '../pages/notifications'
import SettingsPage from '../pages/settings'
import AdminEmployerApprovalsPage from '../pages/admin'
import AdminApplicationVerificationPage from '../pages/admin/applications'
import NotFoundPage from '../pages/not-found'

function HomeRedirect() {
  const { token, isLoading } = useAuth()
  if (isLoading) return null
  if (token) return <Navigate to="/profile" replace />
  return <LandingPage />
}

// /jobs is reachable both signed out (browse/search only) and signed in
// (real apply for students, posting management for employers) — pick the
// shell to match, since GuestLayout has no sidebar/notifications/logout.
function JobsRouteShell() {
  const { token, isLoading } = useAuth()
  if (isLoading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }
  return token ? <FullLayout /> : <GuestLayout />
}

export function MainRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<MiniLayout />}>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/student" element={<RegisterStudentPage />} />
            <Route path="/register/employer" element={<RegisterEmployerPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        {/* /jobs is reachable signed out or signed in — kept outside ProtectedRoute */}
        <Route element={<JobsRouteShell />}>
          <Route path="/jobs" element={<JobsPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<FullLayout />}>
            <Route path="/profile" element={<DashboardPage />} />
            <Route path="/time-tracking" element={<TimeTrackingPage />} />
            <Route path="/my-jobs" element={<MyJobsPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/interviews" element={<InterviewsPage />} />
            <Route path="/employment" element={<EmploymentPage />} />
            <Route path="/payroll" element={<PayrollPage />} />
            <Route path="/complaints" element={<ComplaintsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            <Route element={<RoleRoute allow={['admin']} />}>
              <Route path="/admin/employers" element={<AdminEmployerApprovalsPage />} />
              <Route path="/admin/applications" element={<AdminApplicationVerificationPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
