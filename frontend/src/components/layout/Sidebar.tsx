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

  // ─── Click-outside for profile dropdown ────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── State: structure tree, unread counts ──────────────────────
  const [structure, setStructure] = useState<any[]>([])
  const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set())
  const [unreadCount, setUnreadCount] = useState(0)
  const [newDownloads, setNewDownloads] = useState(0)

  // ─── Fetch structure (admin) ───────────────────────────────────
  useEffect(() => {
    if (!isTeacher) {
      dashboardApi.structure().then(res => setStructure(res.data)).catch(() => {})
    }
  }, [isTeacher])

  // ─── Fetch unread messages + real-time subscription ────────────
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

  // ─── Fetch new downloads count (teacher) ───────────────────────
  useEffect(() => {
    if (!isTeacher || !user?.id) return
    downloadsApi.getNewCount(user.id).then(setNewDownloads).catch(() => {})
  }, [isTeacher, user?.id, location.pathname])

  // ─── Helpers ───────────────────────────────────────────────────
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

  // ─── Shared nav item styles ────────────────────────────────────
  const navBase =
    'flex items-center gap-3 mx-2 h-9 rounded-lg text-sm transition-all duration-150 border-l-2'

  const navInactive =
    'text-text-secondary hover:text-text-primary hover:bg-background-tertiary/70 border-transparent'

  const navActive =
    'bg-accent/10 text-accent font-medium border-l-2 border-accent pl-[6px]'

  // ─── Section divider ───────────────────────────────────────────
  const SectionDivider = () => (
    <div className="mx-5 my-1 h-px bg-border/20" />
  )

  // ─── Sidebar content (shared between desktop + mobile) ─────────
  const sidebarContent = (
    <aside className="relative flex flex-col h-full w-[220px] bg-surface/70 backdrop-blur-2xl border-r border-border/20 shadow-2xl rounded-r-[28px] overflow-hidden">
      {/* Subtle noise texture overlay for macOS glass feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />
      {/* Inner highlight for glass depth */}
      <div className="absolute inset-0 pointer-events-none rounded-r-[28px] shadow-[inset_1px_0_0_hsl(var(--border)/0.06)]" />

      {/* ── Logo with glow ── */}
      <div className="flex items-center gap-2.5 h-14 px-5 flex-shrink-0 mt-2 relative z-10">
        <div className="relative flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-accent relative z-10" />
          <div className="absolute inset-0 bg-accent/25 blur-xl rounded-full animate-pulse" />
        </div>
        <span
          className="text-[15px] font-semibold text-text-primary tracking-tight"
          style={{ textShadow: '0 0 20px hsl(var(--accent) / 0.15)' }}
        >
          Scribe
        </span>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 relative z-10">
        {mainNav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => onClose()}
            className={cn(
              navBase,
              isActive(item.href) ? navActive : navInactive,
              isActive(item.href) ? 'pr-2' : 'px-2',
            )}
            style={
              isActive(item.href)
                ? { textShadow: '0 0 12px hsl(var(--accent) / 0.25)' }
                : undefined
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === '/downloads' && newDownloads > 0 && (
              <span className="text-[11px] font-semibold text-accent-foreground bg-accent rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm ring-1 ring-accent/30">
                {newDownloads > 99 ? '99+' : newDownloads}
              </span>
            )}
          </Link>
        ))}

        {/* ── Super Admin section ── */}
        {user?.role === 'super_admin' && (
          <>
            <SectionDivider />
            <div className="px-5 pt-4 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary/80">
                Super Admin
              </p>
            </div>
            <Link
              to="/admin/super"
              onClick={() => onClose()}
              className={cn(
                navBase,
                isActive('/admin/super') ? navActive : navInactive,
                isActive('/admin/super') ? 'pr-2' : 'px-2',
              )}
              style={
                isActive('/admin/super')
                  ? { textShadow: '0 0 12px hsl(var(--accent) / 0.25)' }
                  : undefined
              }
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Management</span>
            </Link>
          </>
        )}

        {/* ── Messages section ── */}
        <SectionDivider />
        <div className="px-5 pt-4 pb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary/80">
            Messages
          </p>
        </div>
        {messagesNav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => onClose()}
            className={cn(
              navBase,
              isActive(item.href) ? navActive : navInactive,
              isActive(item.href) ? 'pr-2' : 'px-2',
            )}
            style={
              isActive(item.href)
                ? { textShadow: '0 0 12px hsl(var(--accent) / 0.25)' }
                : undefined
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-accent-foreground bg-accent rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center shadow-sm ring-1 ring-accent/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        ))}

        {/* ── Structure section (admin) ── */}
        {!isTeacher && structure.length > 0 && (
          <>
            <SectionDivider />
            <div className="px-5 pt-4 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary/80">
                Structure
              </p>
            </div>
            {structure.map(cls => (
              <div key={cls.id}>
                <button
                  onClick={() => toggleClass(cls.id)}
                  className="flex items-center justify-between w-full mx-2 px-3 h-9 rounded-lg text-sm transition-all duration-150 text-text-secondary hover:text-text-primary hover:bg-background-tertiary/70 border-l-2 border-transparent group"
                  style={{ width: 'calc(100% - 16px)' }}
                >
                  <span className="truncate font-medium">{cls.name}</span>
                  {expandedClasses.has(cls.id) ? (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-text-tertiary/70 transition-transform duration-200 group-hover:text-text-secondary" />
                  ) : (
                    <ChevronRight className="w-3 h-3 flex-shrink-0 text-text-tertiary/70 transition-transform duration-200 group-hover:text-text-secondary" />
                  )}
                </button>
                {expandedClasses.has(cls.id) && cls.subjects?.map((subj: any) => (
                  <Link
                    key={subj.id}
                    to={`/admin/subjects/${subj.id}`}
                    onClick={() => onClose()}
                    className={cn(
                      'flex items-center gap-2 pl-7 pr-3 h-8 text-xs transition-all duration-150 mx-2 rounded-lg border-l-2',
                      location.pathname === `/admin/subjects/${subj.id}`
                        ? 'text-accent bg-accent/10 font-medium border-accent pl-[26px]'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-background-tertiary/70 border-transparent',
                    )}
                    style={{ width: 'calc(100% - 16px)' }}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0 ring-2 transition-all duration-150',
                        subj.status === 'completed'
                          ? 'bg-status-completed ring-status-completed/20'
                          : 'bg-status-pending ring-status-pending/20',
                      )}
                    />
                    <span className="truncate">{subj.name}</span>
                  </Link>
                ))}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* ── User section (bottom) ── */}
      <div className="flex-shrink-0 border-t border-border/20 px-3 py-2 relative z-10" ref={profileRef}>
        <div className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-3 w-full px-2 py-2.5 rounded-xl cursor-pointer hover:bg-background-tertiary/50 transition-all duration-150 group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-accent/20 ring-1 ring-white/10 dark:ring-white/5">
              <span className="text-[13px] font-semibold text-accent-foreground">{initials}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-medium text-text-primary truncate leading-tight">
                {user?.full_name}
              </p>
              <p className="text-[11px] text-text-tertiary capitalize truncate leading-tight">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <ChevronUp
              className={cn(
                'w-4 h-4 text-text-tertiary/70 transition-all duration-200 group-hover:text-text-secondary',
                profileOpen ? 'rotate-0' : 'rotate-180',
              )}
            />
          </button>

          {profileOpen && (
            <div
              className="absolute bottom-[calc(100%+10px)] left-0 right-0 bg-surface/80 backdrop-blur-2xl border border-border/20 rounded-2xl shadow-2xl overflow-hidden z-50 origin-bottom"
              style={{ animation: 'slideUp 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
              <button
                onClick={() => { navigate('/settings'); setProfileOpen(false) }}
                className="flex items-center gap-3 w-full h-11 px-4 text-sm text-text-primary hover:bg-background-secondary/80 transition-colors duration-150 group"
              >
                <Settings className="w-4 h-4 text-text-secondary transition-transform duration-150 group-hover:scale-110" />
                <span>Settings</span>
              </button>
              <div className="h-px bg-border/20 mx-3" />
              <button
                onClick={() => { logout(); setProfileOpen(false) }}
                className="flex items-center gap-3 w-full h-11 px-4 text-sm text-status-rejected hover:bg-status-rejected-bg/50 transition-colors duration-150 group"
              >
                <LogOut className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" />
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
      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:block h-screen fixed left-0 top-0 z-30 overflow-visible">
        {sidebarContent}
      </div>

      {/* ── Mobile overlay with blur ── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* ── Mobile drawer: slide-in with spring easing ── */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </div>
    </>
  )
}
