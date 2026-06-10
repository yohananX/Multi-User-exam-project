import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Settings, Menu, BookOpen, FolderOpen, Loader2, X, UserPlus, Upload, CheckCircle, MessageSquare, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { notificationsApi } from '@/api/endpoints'
import type { Notification } from '@/types'

interface TopbarProps {
  onMenuToggle: () => void
}

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/upload': 'Upload Exam',
  '/uploads': 'My Uploads',
  '/messages': 'Messages',
  '/settings': 'Settings',
  '/admin/submissions': 'Submissions',
  '/admin/teachers': 'Teachers',
  '/admin/classes': 'Classes',
  '/admin/messages': 'Messages',
  '/admin/super': 'Super Admin',
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  if (!date) return ''
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const NOTIF_ICON: Record<string, { icon: React.ElementType; bg: string; color: string }> = {
  new_teacher:        { icon: UserPlus,      bg: 'bg-[hsl(262_80%_97%)]',     color: 'text-[hsl(262_80%_58%)]' },
  script_uploaded:    { icon: Upload,        bg: 'bg-accent-subtle',          color: 'text-accent' },
  subject_completed:  { icon: CheckCircle,   bg: 'bg-status-completed-bg',    color: 'text-status-completed' },
  new_message:        { icon: MessageSquare, bg: 'bg-accent-subtle',          color: 'text-accent' },
  new_assignment:     { icon: BookOpen,      bg: 'bg-status-pending-bg',      color: 'text-status-pending' },
}

const NOTIF_BG: Record<string, string> = {
  new_teacher: 'bg-[hsl(262_80%_97%)]',
  script_uploaded: 'bg-accent-subtle',
  subject_completed: 'bg-status-completed-bg',
  new_message: 'bg-accent-subtle',
  new_assignment: 'bg-status-pending-bg',
}

const NOTIF_COLOR: Record<string, string> = {
  new_teacher: 'text-[hsl(262_80%_58%)]',
  script_uploaded: 'text-accent',
  subject_completed: 'text-status-completed',
  new_message: 'text-accent',
  new_assignment: 'text-status-pending',
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ─── Notifications ────────────────────────────────────────────────

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const currentUserId = user?.id
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!currentUserId) return
    notificationsApi.list(currentUserId).then(setNotifications).catch(() => {})
    const channel = notificationsApi.subscribe(currentUserId, (n) => {
      setNotifications(prev => [n, ...prev])
    })
    return () => { channel.unsubscribe() }
  }, [currentUserId])

  useEffect(() => {
    return () => {
      if (markTimerRef.current) clearTimeout(markTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    if (!currentUserId) return
    try {
      await notificationsApi.markAllRead(currentUserId)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch { /* ignore */ }
  }, [currentUserId])

  const handleOpen = useCallback(() => {
    setOpen(v => !v)
    if (markTimerRef.current) clearTimeout(markTimerRef.current)
    markTimerRef.current = setTimeout(() => {
      handleMarkAllRead()
    }, 2000)
  }, [handleMarkAllRead])

  const pageTitle = useMemo(() => {
    const exact = routeTitles[location.pathname]
    if (exact) return exact
    if (location.pathname.startsWith('/admin/subjects/')) return 'Subject'
    if (location.pathname.startsWith('/subjects/')) return 'Subject'
    return 'Dashboard'
  }, [location.pathname])

  const isAdmin = user?.role === 'super_admin' || user?.role === 'school_admin'
  const userId = user?.auth_id

  // ─── Search ───────────────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    try {
      const [subjectsRes, classesRes] = await Promise.all([
        supabase.from('subjects').select('id, name, class_id, classes(name)').ilike('name', `%${q}%`).limit(5),
        supabase.from('classes').select('id, name').ilike('name', `%${q}%`).limit(3),
      ])
      const combined = [
        ...(subjectsRes.data || []).map((s: any) => ({
          ...s, _type: 'subject' as const,
          class_name: s.classes?.name || '',
        })),
        ...(classesRes.data || []).map((c: any) => ({ ...c, _type: 'class' as const })),
      ]
      setResults(combined)
      setSelectedIdx(-1)
    } catch { setResults([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query) {
      debounceRef.current = setTimeout(() => doSearch(query), 200)
    } else {
      setResults([])
      setShowResults(false)
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) { navigateToResult(results[selectedIdx]) }
    else if (e.key === 'Escape') { setShowResults(false); inputRef.current?.blur() }
  }

  const navigateToResult = (r: any) => {
    setQuery(''); setShowResults(false); setResults([])
    if (r._type === 'subject') navigate(isAdmin ? `/admin/subjects/${r.id}` : `/subjects/${r.id}`)
    else if (r._type === 'class') navigate(isAdmin ? `/admin/classes` : `/uploads?class=${r.id}`)
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-[52px] px-4 lg:px-6 border-b border-border/60 bg-surface/85 backdrop-blur-xl">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-sm text-text-secondary hover:bg-background-secondary transition-colors duration-fast"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="hidden lg:block text-[17px] font-semibold text-text-primary">
          {pageTitle}
        </h1>
      </div>

      {/* Center — search bar (admin only) */}
      {isAdmin && <div ref={searchRef} className="hidden md:block relative w-[240px]">
        <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search subjects, classes..."
          value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true) }}
          onFocus={() => { if (results.length > 0) setShowResults(true) }}
          onKeyDown={handleKeyDown}
          className="w-full h-[30px] pl-8 pr-8 text-sm bg-background-secondary border border-border rounded-full text-text-primary placeholder:text-text-tertiary outline-none transition-shadow duration-fast focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)]"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setShowResults(false); inputRef.current?.focus() }}
            className="absolute right-[6px] top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-tertiary hover:text-text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {showResults && (results.length > 0 || searching) && (
          <div className="absolute top-full mt-1.5 left-0 right-0 bg-surface rounded-[12px] shadow-xl border border-border overflow-hidden z-50">
            {searching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
              </div>
            ) : (
              results.map((r, idx) => (
                <button
                  key={`${r._type}-${r.id}`}
                  onClick={() => navigateToResult(r)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-fast',
                    idx === selectedIdx ? 'bg-background-secondary' : 'hover:bg-background-secondary',
                  )}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0',
                    r._type === 'subject' ? 'bg-accent-subtle' : 'bg-background-tertiary',
                  )}>
                    {r._type === 'subject' ? (
                      <BookOpen className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <FolderOpen className="w-3.5 h-3.5 text-text-secondary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">{r.name}</p>
                    <p className="text-[11px] text-text-tertiary capitalize">
                      {r._type === 'subject' ? (r.class_name || 'Subject') : r._type}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>}

      {/* Right */}
      <div className="flex items-center gap-1">
        <div ref={bellRef} className="relative">
          <button
            onClick={handleOpen}
            className="relative w-9 h-9 flex items-center justify-center rounded-sm text-text-secondary hover:bg-background-secondary transition-colors duration-fast"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                className={cn(
                  'absolute flex items-center justify-center rounded-full bg-[hsl(var(--status-rejected))] ring-2 ring-surface',
                  unreadCount > 9 ? 'w-[18px] h-[18px] top-[3px] right-[3px]' : 'w-[7px] h-[7px] top-[6px] right-[6px]',
                )}
              >
                {unreadCount > 9 && (
                  <span className="text-[10px] font-bold text-white leading-none">9+</span>
                )}
              </span>
            )}
          </button>

          {open && (
            <div
              className="absolute top-[calc(100%+8px)] right-0 w-[360px] max-sm:w-[calc(100vw-32px)] max-sm:max-w-[360px] bg-surface border border-border rounded-[20px] shadow-xl max-h-[480px] overflow-y-auto z-50 origin-top-right animate-scale-in"
              style={{ animationDuration: '200ms' }}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-12 border-b border-border bg-surface/95 backdrop-blur-sm">
                <span className="text-[15px] font-semibold text-text-primary">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[13px] font-medium text-accent hover:text-accent-hover transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              {notifications.length > 0 ? (
                <div className="divide-y divide-border">
                  {notifications.map(n => {
                    const style = NOTIF_ICON[n.type] || NOTIF_ICON.new_message
                    const Icon = style.icon
                    return (
                      <button
                        key={n.id}
                        onClick={async () => {
                          if (!n.read) {
                            try { await notificationsApi.markRead(n.id) } catch {}
                            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
                          }
                          if (n.link) navigate(n.link)
                          setOpen(false)
                        }}
                        className={cn(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-fast',
                          n.link ? 'cursor-pointer' : 'cursor-default',
                          'hover:bg-background-secondary',
                        )}
                        style={{ minHeight: '60px' }}
                      >
                        <div className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                          style.bg,
                        )}>
                          <Icon className={cn('w-4 h-4', style.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-[14px] leading-tight',
                            n.read ? 'text-text-secondary' : 'text-text-primary font-medium',
                          )}>
                            {n.title}
                          </p>
                          <p className="text-[13px] text-text-tertiary mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[12px] text-text-tertiary mt-1.5">{formatRelativeTime(n.created_at)}</p>
                        </div>
                        {!n.read && (
                          <span className="w-[7px] h-[7px] rounded-full bg-accent flex-shrink-0 mt-2" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 48, paddingBottom: 48 }}>
                  <BellOff className="w-8 h-8 text-text-tertiary mb-3" />
                  <p className="text-[14px] text-text-secondary">You're all caught up</p>
                  <p className="text-[12px] text-text-tertiary mt-1">No new notifications</p>
                </div>
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <button onClick={() => navigate('/settings')} className="w-9 h-9 flex items-center justify-center rounded-sm text-text-secondary hover:bg-background-secondary transition-colors duration-fast">
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}
