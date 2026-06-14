import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  FolderOpen,
  Download,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  LogOut,
  BookOpen,
  GraduationCap,
  Users,
  FileStack,
  Settings,
  ChevronUp,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi, messagesApi, downloadsApi } from '@/api/endpoints'

interface NavItem {
  label: string
  icon: React.ElementType
  href: string
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const teacherNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Upload Exam', icon: Upload, href: '/upload' },
  { label: 'My Uploads', icon: FolderOpen, href: '/uploads' },
  { label: 'Downloads', icon: Download, href: '/downloads' },
]

const adminNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { label: 'Teachers', icon: Users, href: '/admin/teachers' },
  { label: 'Classes', icon: GraduationCap, href: '/admin/classes' },
  { label: 'Structure', icon: FileStack, href: '/admin/structure' },
]

const messagesNav: NavItem[] = [
  { label: 'Messages', icon: MessageSquare, href: '/messages' },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isTeacher = user?.role === 'teacher'
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const [structure, setStructure] = useState<any[]>([])
  const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set())
  const [unreadCount, setUnreadCount] = useState(0)
  const [newDownloads, setNewDownloads] = useState(0)

  useEffect(() => {
    if (!isTeacher) {
      dashboardApi.structure().then(res => setStructure(res.data)).catch(() => {})
    }
  }, [isTeacher])

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: messages } = await messagesApi.list()
      if (!messages) return
      const myId = user?.auth_id
      if (!myId) return
      setUnreadCount(messages.filter((m: any) => m.recipient_id === myId && !m.read).length)
    }
    fetchUnread()
    const unsub = messagesApi.subscribe(user?.auth_id || '', () => fetchUnread())
    return () => { unsub.unsubscribe() }
  }, [user?.auth_id])

  useEffect(() => {
    if (!isTeacher || !user?.id) return
    downloadsApi.getNewCount(user.id).then(setNewDownloads).catch(() => {})
  }, [isTeacher, user?.id, location.pathname])

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

  const mainNav = isTeacher ? teacherNav : adminNav

  const sidebarContent = (
    <aside className="flex flex-col h-full bg-background-secondary border-r border-border w-[220px]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-14 px-5 flex-shrink-0">
        <BookOpen className="w-5 h-5 text-accent" />
        <span className="text-[15px] font-semibold text-text-primary">Scribe</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1">
        {mainNav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => onClose()}
            className={cn(
              'flex items-center gap-3 mx-2 px-2 h-8 rounded-sm text-sm transition-colors duration-fast',
              isActive(item.href)
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary',
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.href === '/downloads' && newDownloads > 0 && (
              <span className="text-[11px] font-semibold text-accent-foreground bg-accent rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                {newDownloads > 99 ? '99+' : newDownloads}
              </span>
            )}
          </Link>
        ))}

        {/* Super Admin section */}
        {user?.role === 'super_admin' && (
          <>
            <div className="px-4 pt-5 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                Super Admin
              </p>
            </div>
            <Link
              to="/admin/super"
              onClick={() => onClose()}
              className={cn(
                'flex items-center gap-3 mx-2 px-2 h-8 rounded-sm text-sm transition-colors duration-fast',
                isActive('/admin/super')
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary',
              )}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Management</span>
            </Link>
          </>
        )}

        {/* Messages section */}
        <div className="px-4 pt-5 pb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
            Messages
          </p>
        </div>
        {messagesNav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => onClose()}
            className={cn(
              'flex items-center gap-3 mx-2 px-2 h-8 rounded-sm text-sm transition-colors duration-fast',
              isActive(item.href)
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:bg-background-tertiary hover:text-text-primary',
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-accent-foreground bg-accent rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        ))}

        {/* Structure section for admin */}
        {!isTeacher && structure.length > 0 && (
          <>
            <div className="px-4 pt-5 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                Structure
              </p>
            </div>
            {structure.map(cls => (
              <div key={cls.id}>
                <button
                  onClick={() => toggleClass(cls.id)}
                  className={cn(
                    'flex items-center justify-between w-full mx-2 px-2 h-8 rounded-sm text-sm transition-colors duration-fast',
                    'text-text-secondary hover:bg-background-tertiary hover:text-text-primary',
                  )}
                  style={{ width: 'calc(100% - 16px)' }}
                >
                  <span className="truncate">{cls.name}</span>
                  {expandedClasses.has(cls.id) ? (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-text-tertiary" />
                  ) : (
                    <ChevronRight className="w-3 h-3 flex-shrink-0 text-text-tertiary" />
                  )}
                </button>
                {expandedClasses.has(cls.id) && cls.subjects?.map((subj: any) => (
                  <Link
                    key={subj.id}
                    to={`/admin/subjects/${subj.id}`}
                    onClick={() => onClose()}
                    className={cn(
                      'flex items-center gap-2 pl-7 pr-3 h-7 text-xs transition-colors duration-fast mx-2 rounded-sm',
                      location.pathname === `/admin/subjects/${subj.id}`
                        ? 'text-accent bg-accent/10 font-medium'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-background-tertiary',
                    )}
                    style={{ width: 'calc(100% - 16px)' }}
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      subj.status === 'completed' ? 'bg-status-completed' : 'bg-status-pending',
                    )} />
                    {subj.name}
                  </Link>
                ))}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 border-t border-border" ref={profileRef}>
        <div className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-3 w-full px-4 py-3 cursor-pointer hover:bg-background-tertiary transition-colors duration-fast"
          >
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-[13px] font-semibold text-accent-foreground">{initials}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-medium text-text-primary truncate">{user?.full_name}</p>
              <p className="text-[11px] text-text-tertiary capitalize truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
            <ChevronUp
              className={cn(
                'w-4 h-4 text-text-tertiary transition-transform duration-200',
                profileOpen ? 'rotate-0' : 'rotate-180',
              )}
            />
          </button>

          {profileOpen && (
            <div className="absolute bottom-[calc(100%+8px)] left-2 right-2 bg-surface border border-border rounded-[16px] shadow-lg overflow-hidden z-50 animate-slide-up">
              <button
                onClick={() => { navigate('/settings'); setProfileOpen(false) }}
                className="flex items-center gap-3 w-full h-11 px-4 text-sm text-text-primary hover:bg-background-secondary transition-colors duration-fast"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => { logout(); setProfileOpen(false) }}
                className="flex items-center gap-3 w-full h-11 px-4 text-sm text-status-rejected hover:bg-background-secondary transition-colors duration-fast"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block h-screen fixed left-0 top-0 z-30 overflow-visible">
        {sidebarContent}
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-slow ease-apple',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
