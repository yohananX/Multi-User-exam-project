import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherSubjectView from './pages/teacher/SubjectView';
import AdminDashboard from './pages/admin/Dashboard';
import AdminStructureView from './pages/admin/StructureView';
import AdminSubjectView from './pages/admin/SubjectView';
import AdminTeachers from './pages/admin/Teachers';
import AdminLayout from './components/AdminLayout';
import TeacherLayout from './components/TeacherLayout';
import AdminClasses from './pages/admin/Classes';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-main-bg"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === 'teacher' ? <TeacherLayout /> : <AdminLayout />}
          </ProtectedRoute>
        }
      >
        <Route index element={
          user?.role === 'teacher' ? <TeacherDashboard /> : <AdminDashboard />
        } />
        <Route path="subjects/:subjectId" element={
          user?.role === 'teacher' ? <TeacherSubjectView /> : <AdminSubjectView />
        } />
        <Route path="admin/structure" element={
          <ProtectedRoute roles={['super_admin', 'school_admin']}>
            <AdminStructureView />
          </ProtectedRoute>
        } />
        <Route path="admin/subjects/:subjectId" element={
          <ProtectedRoute roles={['super_admin', 'school_admin']}>
            <AdminSubjectView />
          </ProtectedRoute>
        } />
        <Route path="admin/teachers" element={
          <ProtectedRoute roles={['super_admin', 'school_admin']}>
            <AdminTeachers />
          </ProtectedRoute>
        } />
        <Route path="admin/classes" element={
          <ProtectedRoute roles={['super_admin', 'school_admin']}>
            <AdminClasses />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}
