import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, LogOut, School, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/endpoints';

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    dashboardApi.teacher().then(res => {
      const subs = res.data.subjects || [];
      setSubjects(subs);
      const grouped: Record<string, any[]> = {};
      subs.forEach((s: any) => {
        const key = s.class_name;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });
      setExpanded(new Set(Object.keys(grouped)));
    }).catch(() => {});
  }, []);

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const grouped: Record<string, any[]> = {};
  subjects.forEach(s => {
    const key = s.class_name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--main-bg)' }}>
      <div className="sidebar w-64 flex flex-col flex-shrink-0">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
          <School className="w-6 h-6" style={{ color: 'var(--accent)' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>ExamVault</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <Link to="/" className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>My Subjects</p>
          </div>
          {Object.entries(grouped).map(([className, subs]) => (
            <div key={className}>
              <div className="sidebar-group-header" onClick={() => toggle(className)}>
                <span>{className}</span>
                {expanded.has(className) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </div>
              {expanded.has(className) && subs.map((s: any) => (
                <Link
                  key={s.subject_id}
                  to={`/subjects/${s.subject_id}`}
                  className={`sidebar-link pl-8 text-xs ${location.pathname === `/subjects/${s.subject_id}` ? 'active' : ''}`}
                >
                  <span className="flex items-center gap-1.5">
                    {s.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />}
                    <span>{s.subject_name}</span>
                  </span>
                  <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.status === 'completed' ? 'Done' : s.status || 'Active'}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          <div className="px-2 py-1 mb-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Teacher</p>
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
