import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import TeacherDashboard from './pages/teacher/Dashboard'
import UploadPage from './pages/teacher/UploadPage'
import MyUploadsPage from './pages/teacher/MyUploadsPage'
import MessagesPage from './pages/teacher/MessagesPage'
import TeacherSubjectView from './pages/teacher/SubjectView'
import SettingsPage from './pages/teacher/SettingsPage'
import AdminDashboard from './pages/admin/Dashboard'
import AdminTeachers from './pages/admin/Teachers'
import AdminClasses from './pages/admin/Classes'
import AdminStructureView from './pages/admin/StructureView'
import AdminSubjectView from './pages/admin/SubjectView'
import SuperAdminPage from './pages/admin/SuperAdmin'

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
  return <AdminDashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
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
        <Route path="subjects/:subjectId" element={<TeacherSubjectView />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin/teachers" element={<ProtectedRoute adminOnly><AdminTeachers /></ProtectedRoute>} />
        <Route path="admin/classes" element={<ProtectedRoute adminOnly><AdminClasses /></ProtectedRoute>} />
        <Route path="admin/structure" element={<ProtectedRoute adminOnly><AdminStructureView /></ProtectedRoute>} />
        <Route path="admin/subjects/:subjectId" element={<ProtectedRoute adminOnly><AdminSubjectView /></ProtectedRoute>} />
        <Route path="admin/super" element={<ProtectedRoute adminOnly><SuperAdminPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
