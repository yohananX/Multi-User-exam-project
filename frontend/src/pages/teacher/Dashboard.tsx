import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen, Clock, CheckCircle, MessageSquare, Zap, XCircle,
  Upload, FolderOpen, FileText, ChevronRight, Bell, Check, Eye,
  Inbox,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── Helpers ────────────────────────────────────────────────────────

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
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

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-status-pending', bg: 'bg-status-pending-bg', label: 'Pending' },
  processing: { icon: Zap, color: 'text-status-processing', bg: 'bg-status-processing-bg', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-status-completed', bg: 'bg-status-completed-bg', label: 'Completed' },
  rejected: { icon: XCircle, color: 'text-status-rejected', bg: 'bg-status-rejected-bg', label: 'Rejected' },
}

// ─── Animated Number (count-up) ─────────────────────────────────────

function AnimatedNumber({ value, enabled = true, className }: { value: number; enabled?: boolean; className?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setDisplay(value)
      return
    }

    const duration = 700
    const start = performance.now()
    const from = 0

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Cubic ease-out for premium feel
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled])

  return <span className={className}>{display}</span>
}

// ─── Stat Card Skeleton ─────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl p-6 shadow-card animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-background-tertiary shimmer mb-4" />
      <div className="w-20 h-8 rounded bg-background-tertiary shimmer mb-2" />
      <div className="w-24 h-3 rounded bg-background-tertiary shimmer" />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const greeting = useGreeting()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await dashboardApi.teacher()
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = useCallback(async () => {
    if (!user?.auth_id) return
    setLoadingNotifications(true)
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at, read')
        .eq('recipient_id', user.auth_id)
        .order('created_at', { ascending: false })
        .limit(6)

      const items: any[] = []
      if (msgs) {
        for (const m of msgs) {
          let name = 'Admin'
          try {
            const { data: sender } = await supabase
              .from('users')
              .select('full_name')
              .eq('auth_id', m.sender_id)
              .single()
            if (sender) name = sender.full_name
          } catch { /* ignore */ }

          items.push({
            id: m.id,
            type: 'message',
            title: `New message from ${name}`,
            description: m.body,
            created_at: m.created_at,
            read: m.read,
          })
        }
      }
      setNotifications(items)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingNotifications(false)
    }
  }, [user?.auth_id])

  const markAsRead = async (msgId: number) => {
    try {
      await supabase.from('messages').update({ read: true }).eq('id', msgId)
      setNotifications(prev => prev.map(n => n.id === msgId ? { ...n, read: true } : n))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (!user?.auth_id) return
    const name = `db-notifications-${user.auth_id}`
    const existing = supabase.getChannels().find((c: any) => c.topic === name)
    if (existing) supabase.removeChannel(existing)
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.auth_id}` },
        () => fetchNotifications(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.auth_id, fetchNotifications])

  // Realtime subscription: refetch dashboard data when teacher_assignments change
  useEffect(() => {
    if (!user?.id) return
    const name = `db-assignments-${user.id}`
    const existing = supabase.getChannels().find((c: any) => c.topic === name)
    if (existing) supabase.removeChannel(existing)
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teacher_assignments', filter: `teacher_id=eq.${user.id}` },
        () => fetchData(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const firstName = user?.full_name?.split(' ')[0] || 'Teacher'
  const subjects = (data?.subjects || []).slice().sort(
    (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )
  const images = data?.images || { total: 0, pending: 0, completed: 0 }
  const stats = data?.stats || {}
  const totalSubjects = stats.total_subjects || subjects.length
  const unreadMessages = notifications.filter(n => !n.read).length
  const recentActivity = data?.recent_uploads || []
  const DateStr = useMemo(() => formatDate(), [])

  const statCards = [
    {
      icon: BookOpen, value: totalSubjects, label: 'Subjects',
      iconBg: 'bg-accent-subtle', iconColor: 'text-accent',
    },
    {
      icon: FileText, value: images.total, label: 'Scripts Uploaded',
      iconBg: 'bg-status-pending-bg', iconColor: 'text-status-pending',
    },
    {
      icon: CheckCircle, value: images.completed, label: 'Completed',
      iconBg: 'bg-status-completed-bg', iconColor: 'text-status-completed',
    },
    {
      icon: MessageSquare, value: unreadMessages, label: 'Unread Messages',
      iconBg: undefined as string | undefined, iconColor: undefined,
    },
  ]

  const quickActions = [
    { label: 'Upload Exam', icon: Upload, href: '/upload', primary: true },
    { label: 'My Uploads', icon: FolderOpen, href: '/uploads', primary: false },
    { label: 'Messages', icon: MessageSquare, href: '/messages', primary: false },
  ]

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-status-pending-bg text-status-pending'
      case 'processing': return 'bg-status-processing-bg text-status-processing'
      case 'completed': return 'bg-status-completed-bg text-status-completed'
      case 'rejected': return 'bg-status-rejected-bg text-status-rejected'
      default: return 'bg-background-tertiary text-text-secondary'
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 animate-fade-in">
        <p className="text-base text-text-secondary">Couldn't load your dashboard. Try refreshing.</p>
        <button
          onClick={fetchData}
          className="text-sm text-accent font-medium px-5 py-2 rounded-xl border border-border hover:bg-accent-subtle transition-all duration-fast"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ─── Greeting Section ─── */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary opacity-0 animate-fade-in">
          {greeting}, {firstName}
        </h1>
        <p
          className="text-sm text-text-secondary mt-1.5 opacity-0 animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          {DateStr}
        </p>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          statCards.map((stat, i) => {
            const Icon = stat.icon
            const colors = [
              { bg: 'bg-accent-subtle', icon: 'text-accent', inline: undefined },
              { bg: 'bg-status-pending-bg', icon: 'text-status-pending', inline: undefined },
              { bg: 'bg-status-completed-bg', icon: 'text-status-completed', inline: undefined },
              { bg: undefined, icon: undefined, inline: { bg: 'hsl(262 80% 97%)', icon: 'hsl(262 80% 58%)' } },
            ]
            const c = colors[i]
            return (
              <div
                key={stat.label}
                className="bg-surface rounded-2xl p-6 shadow-card transition-all duration-normal ease-apple hover:-translate-y-0.5 hover:shadow-lg opacity-0 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
                    c.bg,
                  )}
                  style={{
                    ...(c.inline ? { backgroundColor: c.inline.bg } : {}),
                    boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.35)',
                  }}
                >
                  <Icon
                    className={cn('w-5 h-5', c.icon)}
                    style={c.inline ? { color: c.inline.icon } : undefined}
                  />
                </div>
                <AnimatedNumber
                  value={stat.value}
                  enabled={!loading}
                  className="text-3xl font-bold tracking-tight text-text-primary leading-none mb-1"
                />
                <p className="text-sm text-text-secondary font-normal">{stat.label}</p>
              </div>
            )
          })
        )}
      </div>

      {/* ─── Two-Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* ── Recent Uploads Feed ── */}
          <div className="opacity-0 animate-fade-in" style={{ animationDelay: '160ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold text-text-primary">Recent Uploads</h2>
                {recentActivity.length > 0 && (
                  <span className="text-xs text-text-tertiary bg-background-secondary rounded-full px-2.5 py-0.5 font-medium">
                    {recentActivity.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/uploads')}
                className="text-sm text-accent font-medium hover:opacity-80 transition-opacity"
              >
                View all
              </button>
            </div>

            {loading ? (
              <div className="bg-surface rounded-2xl shadow-card p-4 space-y-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-background-tertiary shimmer flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="w-36 h-3 rounded bg-background-tertiary shimmer" />
                      <div className="w-24 h-2.5 rounded bg-background-tertiary shimmer" />
                    </div>
                    <div className="w-14 h-5 rounded-full bg-background-tertiary shimmer" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="bg-surface rounded-2xl shadow-card">
                {recentActivity.map((item: any, idx: number) => {
                  const config = statusConfig[item.status] || statusConfig.pending
                  const Icon = config.icon
                  return (
                    <div key={item.id}>
                      <div
                        onClick={() => navigate(`/subjects/${item.subject_id}`)}
                        className="flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-all duration-fast hover:bg-background-secondary opacity-0 animate-fade-in"
                        style={{ animationDelay: `${idx * 60}ms` }}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                          config.bg,
                        )}>
                          <Icon className={cn('w-4 h-4', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {item.subject_name}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {item.class_name} <span className="text-text-tertiary mx-1">·</span> Page {item.number}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={cn(
                            'rounded-full text-xs font-medium px-2.5 py-0.5',
                            getStatusStyle(item.status),
                          )}>
                            {config.label}
                          </span>
                          <p className="text-xs text-text-tertiary whitespace-nowrap">
                            {item.created_at ? formatRelativeTime(item.created_at) : ''}
                          </p>
                        </div>
                      </div>
                      {idx < recentActivity.length - 1 && (
                        <div className="ml-[72px] h-px bg-border" />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 bg-surface rounded-2xl shadow-card">
                <div className="w-12 h-12 rounded-xl bg-background-secondary flex items-center justify-center mb-4">
                  <FolderOpen className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-base text-text-secondary mb-1 font-medium">No uploads yet</p>
                <p className="text-sm text-text-tertiary">Upload your first exam to get started</p>
              </div>
            )}
          </div>

          {/* ── Notifications Card ── */}
          <div className="bg-surface rounded-2xl shadow-card p-6 opacity-0 animate-fade-in" style={{ animationDelay: '240ms' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-accent-subtle flex items-center justify-center">
                    <Bell className="w-4 h-4 text-accent" />
                  </div>
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-status-rejected ring-2 ring-surface animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Notifications & Messages</h3>
                  {unreadMessages > 0 && (
                    <p className="text-xs text-text-tertiary mt-0.5">{unreadMessages} unread</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate('/messages')}
                className="text-sm text-accent font-medium hover:opacity-80 transition-opacity"
              >
                Open Inbox
              </button>
            </div>

            {loadingNotifications ? (
              <div className="space-y-3">
                <div className="h-[72px] bg-background-secondary rounded-xl animate-pulse" />
                <div className="h-[72px] bg-background-secondary rounded-xl animate-pulse" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((n, idx) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3.5 p-3.5 rounded-xl border transition-all duration-fast opacity-0 animate-fade-in",
                      n.read
                        ? "bg-surface border-border/50"
                        : "bg-accent-subtle/40 border-accent/20 shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.06)]",
                    )}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      n.read ? "bg-background-secondary" : "bg-accent/10",
                    )}>
                      <MessageSquare className={cn("w-4 h-4", n.read ? "text-text-tertiary" : "text-accent")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={cn(
                          "text-sm truncate",
                          n.read ? "text-text-secondary" : "text-text-primary font-semibold",
                        )}>
                          {n.title}
                        </p>
                        <span className="text-xs text-text-tertiary flex-shrink-0">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-snug line-clamp-2">{n.description}</p>

                      {!n.read && (
                        <div className="flex gap-3 mt-2.5">
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition-opacity"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Mark read
                          </button>
                          <button
                            onClick={() => navigate('/messages')}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-xl bg-background-secondary flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-base text-text-secondary font-medium">All caught up!</p>
                <p className="text-sm text-text-tertiary mt-0.5">No new notifications or messages.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Quick Actions ── */}
          {!loading && (
            <div className="bg-surface rounded-2xl shadow-card opacity-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="px-6 pt-5 pb-1">
                <h3 className="text-base font-semibold text-text-primary">Quick Actions</h3>
              </div>
              <div className="px-2 pb-2">
                {quickActions.map((action, idx) => (
                  <div
                    key={action.label}
                    onClick={() => navigate(action.href)}
                    className="flex items-center gap-3.5 rounded-xl px-4 py-3 cursor-pointer transition-all duration-fast hover:bg-accent-subtle/40 group"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-fast',
                      action.primary
                        ? 'bg-accent text-accent-foreground shadow-sm shadow-accent/20'
                        : 'bg-background-secondary group-hover:bg-background-tertiary',
                    )}>
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      'text-sm flex-1 font-medium',
                      action.primary ? 'text-accent' : 'text-text-primary',
                    )}>
                      {action.label}
                    </span>
                    <ChevronRight className={cn(
                      'w-4 h-4 transition-all duration-fast',
                      action.primary ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary',
                    )} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Your Subjects ── */}
          {!loading && (
            <div className="bg-surface rounded-2xl shadow-card opacity-0 animate-fade-in" style={{ animationDelay: '280ms' }}>
              <div className="px-6 pt-5 pb-1">
                <h3 className="text-base font-semibold text-text-primary">Your Subjects</h3>
              </div>
              {subjects.length > 0 ? (
                <div className="px-4 pt-3 pb-4">
                  {subjects.slice(0, 5).map((s: any, idx: number) => (
                    <div
                      key={s.subject_id}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-fast hover:bg-background-secondary cursor-pointer',
                        idx > 0 && 'mt-0.5',
                      )}
                      onClick={() => navigate(`/subjects/${s.subject_id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                        <span className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          s.status === 'completed' ? 'bg-status-completed' :
                          s.status === 'pending' ? 'bg-status-pending' :
                          s.status === 'processing' ? 'bg-status-processing' :
                          s.status === 'rejected' ? 'bg-status-rejected' :
                          'bg-text-tertiary'
                        )} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{s.subject_name}</p>
                          <p className="text-xs text-text-tertiary truncate mt-0.5">{s.class_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {s.released && s.status === 'completed' && (
                          <span className="text-[10px] font-semibold text-status-completed bg-status-completed-bg rounded-full px-2 py-0.5">
                            Download
                          </span>
                        )}
                        <span className={cn(
                          'rounded-full text-[11px] font-medium px-2.5 py-0.5',
                          getStatusStyle(s.status),
                        )}>
                          {statusConfig[s.status]?.label || s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {subjects.length > 5 && (
                    <button
                      onClick={() => navigate('/uploads')}
                      className="text-sm text-accent font-medium mt-3 mx-3 block hover:opacity-80 transition-opacity"
                    >
                      See all {subjects.length} subjects
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary text-center py-8">No subjects assigned yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
