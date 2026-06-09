import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AppShell } from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import TeacherDashboard from './pages/teacher/Dashboard'
import UploadPage from './pages/teacher/UploadPage'
import MyUploadsPage from './pages/teacher/MyUploadsPage'
import AdminDashboard from './pages/admin/Dashboard'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
