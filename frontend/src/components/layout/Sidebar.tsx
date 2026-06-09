import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  LogOut,
  School,
  GraduationCap,
  Users,
  Settings,
  Bell,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi } from '@/api/endpoints'

interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  children?: { label: string; href: string; id: number }[]
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isTeacher = user?.role === 'teacher'
  const [structure, setStructure] = useState<any[]>([])
  const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set())
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!isTeacher) {
      dashboardApi.structure().then(res => setStructure(res.data)).catch(() => {})
    }
  }, [isTeacher])

  const toggleClass = (id: number) => {
    setExpandedClasses(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const teacherNav: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Upload Exam', icon: Upload, href: '/upload' },
    { label: 'My Uploads', icon: FileText, href: '/uploads' },
    { label: 'Messages', icon: MessageSquare, href: '/messages' },
  ]

  const adminNav: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
    { label: 'Submissions', icon: FileText, href: '/admin/submissions' },
    { label: 'Teachers', icon: Users, href: '/admin/teachers' },
    { label: 'Classes', icon: GraduationCap, href: '/admin/classes' },
    { label: 'Messages', icon: MessageSquare, href: '/admin/messages' },
  ]

  const navItems = isTeacher ? teacherNav : adminNav

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-sidebar transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 h-14 px-4 border-b border-border', collapsed && 'justify-center px-0')}>
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <School className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight">ExamVault</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map(item => (
          <div key={item.label}>
            {item.href ? (
              <Link
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'hover:bg-sidebar-muted hover:text-foreground',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground',
                  collapsed && 'justify-center px-2',
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ) : null}
          </div>
        ))}

        {/* Structure tree for admin */}
        {!isTeacher && !collapsed && structure.length > 0 && (
          <>
            <Separator className="my-3" />
            <div className="px-3 py-1">
              <p className="text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                All Exams
              </p>
            </div>
            {structure.map(cls => (
              <div key={cls.id}>
                <button
                  onClick={() => toggleClass(cls.id)}
                  className="flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{cls.name}</span>
                  {expandedClasses.has(cls.id) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
                {expandedClasses.has(cls.id) && cls.subjects?.map((subj: any) => (
                  <Link
                    key={subj.id}
                    to={`/admin/subjects/${subj.id}`}
                    className={cn(
                      'flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-lg text-xs transition-colors',
                      location.pathname === `/admin/subjects/${subj.id}`
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      subj.status === 'completed' ? 'bg-status-completed' : 'bg-muted-foreground/30',
                    )} />
                    {subj.name}
                  </Link>
                ))}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className={cn('border-t border-border p-3', collapsed && 'flex flex-col items-center gap-2')}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-1 mb-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-2xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        {collapsed && (
          <Avatar className="w-8 h-8 mb-2">
            <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
          </Avatar>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn('w-full justify-start text-muted-foreground', collapsed && 'justify-center')}
          onClick={logout}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </div>
    </aside>
  )
}
