import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderTree, Users, GraduationCap, LogOut,
  ChevronDown, ChevronRight, School,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/endpoints';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [structure, setStructure] = useState<any[]>([]);
  const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set());

  useEffect(() => {
    dashboardApi.structure().then(res => setStructure(res.data)).catch(() => {});
  }, []);

  const toggleClass = (id: number) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isActive = (path: string) => location.pathname === path;
  const isSubjectActive = (id: number) => location.pathname === `/admin/subjects/${id}`;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--main-bg)' }}>
      <div className="sidebar w-64 flex flex-col flex-shrink-0">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
          <School className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>ExamVault</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <Link to="/" className={`sidebar-link ${isActive('/') ? 'active' : ''}`}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>All Exams</p>
          </div>
          {structure.map(cls => (
            <div key={cls.id}>
              <div className="sidebar-group-header" onClick={() => toggleClass(cls.id)}>
                <span>{cls.name}</span>
                {expandedClasses.has(cls.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </div>
              {expandedClasses.has(cls.id) && cls.subjects?.map((subj: any) => (
                <Link
                  key={subj.id}
                  to={`/admin/subjects/${subj.id}`}
                  className={`sidebar-link pl-8 text-xs ${isSubjectActive(subj.id) ? 'active' : ''}`}
                >
                  <span className="flex items-center gap-1.5">
                    {subj.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />}
                    <span>{subj.name}</span>
                  </span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {subj.total_images}
                  </span>
                </Link>
              ))}
            </div>
          ))}
          <div className="pt-6 pb-2">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Admin</p>
          </div>
          <Link to="/admin/structure" className={`sidebar-link ${isActive('/admin/structure') ? 'active' : ''}`}>
            <FolderTree className="w-4 h-4" /> Structure
          </Link>
          <Link to="/admin/teachers" className={`sidebar-link ${isActive('/admin/teachers') ? 'active' : ''}`}>
            <Users className="w-4 h-4" /> Teachers
          </Link>
          <Link to="/admin/classes" className={`sidebar-link ${isActive('/admin/classes') ? 'active' : ''}`}>
            <GraduationCap className="w-4 h-4" /> Classes
          </Link>
        </div>
        <div className="border-t border-border p-3">
          <div className="px-2 py-1 mb-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Admin</p>
          </div>
          <button onClick={logout} className="sidebar-link w-full text-xs" style={{ color: '#ef4444' }}>
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
