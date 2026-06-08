import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  GraduationCap,
  LogOut,
  ChevronLeft,
  ChevronRight,
  School,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/exams', icon: FileText, label: 'Exams' },
];

const adminItems = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/classes', icon: GraduationCap, label: 'Classes & Subjects' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } bg-white border-r border-slate-200 flex flex-col transition-all duration-200`}
      >
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200">
          <School className="w-8 h-8 text-primary-600 flex-shrink-0" />
          {!collapsed && (
            <span className="font-bold text-lg text-slate-900 truncate">
              Exam Platform
            </span>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className={`text-xs font-semibold uppercase text-slate-400 px-4 py-2 ${collapsed ? 'hidden' : ''}`}>
            Main
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-link ${
                  isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          {(user?.role === 'super_admin' || user?.role === 'school_admin') && (
            <>
              <p className={`text-xs font-semibold uppercase text-slate-400 px-4 py-2 pt-6 ${collapsed ? 'hidden' : ''}`}>
                Admin
              </p>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`sidebar-link ${
                      isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="border-t border-slate-200 p-3 space-y-2">
          {!collapsed && user && (
            <div className="px-2 py-1">
              <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-link sidebar-link-inactive w-full"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && 'Collapse'}
          </button>
          <button
            onClick={handleLogout}
            className="sidebar-link text-red-600 hover:bg-red-50 w-full"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-7xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
