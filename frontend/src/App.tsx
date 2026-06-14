import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TeacherDashboard from './pages/teacher/Dashboard'
import UploadPage from './pages/teacher/UploadPage'
import MyUploadsPage from './pages/teacher/MyUploadsPage'
import MessagesPage from './pages/teacher/MessagesPage'
import DownloadsPage from './pages/teacher/DownloadsPage'
import TeacherSubjectView from './pages/teacher/SubjectView'
import SettingsPage from './pages/teacher/SettingsPage'

// Lazy loaded admin pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminTeachers = lazy(() => import('./pages/admin/Teachers'))
const AdminClasses = lazy(() => import('./pages/admin/Classes'))
const AdminStructureView = lazy(() => import('./pages/admin/StructureView'))
const AdminSubjectView = lazy(() => import('./pages/admin/SubjectView'))
const SuperAdminPage = lazy(() => import('./pages/admin/SuperAdmin'))

function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role === 'teacher') return <Navigate to="/" replace />
  return <>{children}</>
}

function DashboardRouter() {
  const { user } = useAuth()
  if (user?.role === 'teacher') return <TeacherDashboard />
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardRouter />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="uploads" element={<MyUploadsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="subjects/:subjectId" element={<TeacherSubjectView />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="admin/*"
          element={
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
              </div>
            }>
              <Routes>
                <Route path="teachers" element={<ProtectedRoute adminOnly><AdminTeachers /></ProtectedRoute>} />
                <Route path="classes" element={<ProtectedRoute adminOnly><AdminClasses /></ProtectedRoute>} />
                <Route path="structure" element={<ProtectedRoute adminOnly><AdminStructureView /></ProtectedRoute>} />
                <Route path="subjects/:subjectId" element={<ProtectedRoute adminOnly><AdminSubjectView /></ProtectedRoute>} />
                <Route path="super" element={<ProtectedRoute adminOnly><SuperAdminPage /></ProtectedRoute>} />
                <Route path="messages" element={<ProtectedRoute adminOnly><MessagesPage /></ProtectedRoute>} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
